"""Offline 'connector' tools that mirror what cloud chatbots offer — Calendar,
Tasks, Contacts, Email, local Database, and Translation. All local, no network.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlmodel import select

from ..registry import registry
from ..safety import resolve_path, workspace_out
from ... import db
from ...models import CalendarEvent, Task, Contact
from ...providers import ollama


# ------------------------------------------------------------- Calendar ---
@registry.tool(
    "add_event",
    "Add an event to the local calendar.",
    {
        "title": {"type": "string", "description": "Event title"},
        "start": {"type": "string", "description": "Start, ISO e.g. 2026-08-01T14:00"},
        "end": {"type": "string", "description": "End (ISO)", "_optional": True},
        "location": {"type": "string", "description": "Location", "_optional": True},
        "notes": {"type": "string", "description": "Notes", "_optional": True},
    },
    plugin="calendar",
)
def add_event(title: str, start: str, end: str = "", location: str = "", notes: str = "") -> str:
    with db.get_session() as s:
        s.add(CalendarEvent(title=title, start=start, end=end, location=location, notes=notes))
        s.commit()
    return f"Added event '{title}' at {start}."


@registry.tool(
    "list_events",
    "List calendar events, optionally only upcoming ones.",
    {"upcoming_only": {"type": "boolean", "description": "Only future events", "_optional": True}},
    plugin="calendar",
)
def list_events(upcoming_only: bool = False) -> str:
    with db.get_session() as s:
        events = s.exec(select(CalendarEvent).order_by(CalendarEvent.start)).all()
    now = datetime.now().isoformat()
    if upcoming_only:
        events = [e for e in events if e.start >= now]
    if not events:
        return "No events."
    return "\n".join(f"• {e.start}  {e.title}" + (f" @ {e.location}" if e.location else "")
                     for e in events[:50])


@registry.tool(
    "export_calendar",
    "Export the calendar to a standard .ics file (opens in any calendar app).",
    {"filename": {"type": "string", "description": "Output .ics name", "_optional": True}},
    plugin="calendar",
)
def export_calendar(filename: str = "calendar.ics") -> str:
    if not filename.endswith(".ics"):
        filename += ".ics"
    with db.get_session() as s:
        events = s.exec(select(CalendarEvent)).all()
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Abrar AI Hub//EN"]
    for e in events:
        st = e.start.replace("-", "").replace(":", "").replace("T", "T")
        lines += ["BEGIN:VEVENT", f"SUMMARY:{e.title}", f"DTSTART:{st}",
                  f"LOCATION:{e.location}", f"DESCRIPTION:{e.notes}", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    out = workspace_out(filename)
    out.write_text("\n".join(lines), encoding="utf-8")
    return f"Exported {len(events)} events to {out}"


# ---------------------------------------------------------------- Tasks ---
@registry.tool(
    "add_task",
    "Add a to-do task/reminder.",
    {
        "title": {"type": "string", "description": "Task description"},
        "due": {"type": "string", "description": "Due date (ISO)", "_optional": True},
        "priority": {"type": "string", "description": "low | normal | high", "_optional": True},
    },
    plugin="tasks",
)
def add_task(title: str, due: str = "", priority: str = "normal") -> str:
    with db.get_session() as s:
        s.add(Task(title=title, due=due, priority=priority))
        s.commit()
    return f"Added task: {title}" + (f" (due {due})" if due else "")


@registry.tool(
    "list_tasks",
    "List to-do tasks. Set include_done to show completed ones too.",
    {"include_done": {"type": "boolean", "description": "Include completed", "_optional": True}},
    plugin="tasks",
)
def list_tasks(include_done: bool = False) -> str:
    with db.get_session() as s:
        tasks = s.exec(select(Task).order_by(Task.done, Task.due)).all()
    if not include_done:
        tasks = [t for t in tasks if not t.done]
    if not tasks:
        return "No open tasks 🎉"
    mark = {"high": "🔴", "normal": "🟡", "low": "⚪"}
    return "\n".join(f"[{'x' if t.done else ' '}] {mark.get(t.priority,'🟡')} #{t.id} {t.title}"
                     + (f" (due {t.due})" if t.due else "") for t in tasks[:50])


@registry.tool(
    "complete_task",
    "Mark a task as done by its id.",
    {"task_id": {"type": "integer", "description": "Task id (from list_tasks)"}},
    plugin="tasks",
)
def complete_task(task_id: int) -> str:
    with db.get_session() as s:
        t = s.get(Task, task_id)
        if not t:
            return f"No task #{task_id}."
        t.done = True
        s.add(t); s.commit()
        return f"Completed: {t.title}"


# ------------------------------------------------------------- Contacts ---
@registry.tool(
    "add_contact",
    "Save a contact.",
    {
        "name": {"type": "string", "description": "Full name"},
        "email": {"type": "string", "description": "Email", "_optional": True},
        "phone": {"type": "string", "description": "Phone", "_optional": True},
        "notes": {"type": "string", "description": "Notes", "_optional": True},
    },
    plugin="contacts",
)
def add_contact(name: str, email: str = "", phone: str = "", notes: str = "") -> str:
    with db.get_session() as s:
        s.add(Contact(name=name, email=email, phone=phone, notes=notes))
        s.commit()
    return f"Saved contact: {name}"


@registry.tool(
    "find_contacts",
    "Search saved contacts by name/email (blank = list all).",
    {"query": {"type": "string", "description": "Search text", "_optional": True}},
    plugin="contacts",
)
def find_contacts(query: str = "") -> str:
    q = query.lower()
    with db.get_session() as s:
        rows = s.exec(select(Contact).order_by(Contact.name)).all()
    hits = [c for c in rows if not q or q in c.name.lower() or q in c.email.lower()][:50]
    if not hits:
        return "No matching contacts."
    return "\n".join(f"• {c.name}" + (f" <{c.email}>" if c.email else "")
                     + (f" {c.phone}" if c.phone else "") for c in hits)


# --------------------------------------------------------------- Email ---
@registry.tool(
    "draft_email",
    "Compose an email and save it locally as an .eml file (offline — does not send).",
    {
        "to": {"type": "string", "description": "Recipient address"},
        "subject": {"type": "string", "description": "Subject"},
        "body": {"type": "string", "description": "Email body"},
    },
    plugin="email",
)
def draft_email(to: str, subject: str, body: str) -> str:
    from email.message import EmailMessage
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    fname = "draft_" + "".join(c for c in subject if c.isalnum())[:20] + ".eml"
    out = workspace_out(fname)
    out.write_bytes(bytes(msg))
    return f"Draft saved: {out} (open in your mail app to send)."


@registry.tool(
    "read_mailbox",
    "Read a local mailbox (.mbox) or single .eml file and list messages.",
    {"path": {"type": "string", "description": "Path to a .mbox or .eml file"}},
    plugin="email",
)
def read_mailbox(path: str) -> str:
    p = resolve_path(path, must_exist=True)
    import mailbox
    from email import policy
    from email.parser import BytesParser
    out = []
    if p.suffix.lower() == ".eml":
        msg = BytesParser(policy=policy.default).parse(open(p, "rb"))
        out.append(f"From: {msg['from']}\nSubject: {msg['subject']}\n"
                   f"{(msg.get_body(preferencelist=('plain',)) or msg).get_content()[:1500]}"
                   if msg.get_body(preferencelist=('plain',)) else f"Subject: {msg['subject']}")
    else:
        mb = mailbox.mbox(str(p))
        for i, msg in enumerate(mb):
            out.append(f"#{i} {msg['from']} — {msg['subject']}")
            if i >= 40:
                break
    return "\n".join(out) or "(empty mailbox)"


# ------------------------------------------------------------ Database ---
@registry.tool(
    "sql_query",
    "Run a read-only SQL SELECT against a local SQLite database file.",
    {
        "db_path": {"type": "string", "description": "Path to a .db / .sqlite file"},
        "query": {"type": "string", "description": "A SELECT query"},
    },
    plugin="database",
)
def sql_query(db_path: str, query: str) -> str:
    if not query.strip().lower().startswith("select"):
        return "Only read-only SELECT queries are allowed."
    import sqlite3
    p = resolve_path(db_path, must_exist=True)
    try:
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        cur = con.execute(query)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = cur.fetchmany(50)
        con.close()
    except Exception as e:
        return f"SQL error: {e}"
    lines = [" | ".join(cols)] + [" | ".join(str(c) for c in r) for r in rows]
    return "\n".join(lines) or "(no rows)"


@registry.tool(
    "list_tables",
    "List the tables in a local SQLite database.",
    {"db_path": {"type": "string", "description": "Path to a .db / .sqlite file"}},
    plugin="database",
)
def list_tables(db_path: str) -> str:
    import sqlite3
    p = resolve_path(db_path, must_exist=True)
    try:
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        tables = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")]
        con.close()
    except Exception as e:
        return f"SQL error: {e}"
    return "Tables: " + ", ".join(tables) if tables else "(no tables)"


# ---------------------------------------------------------- Translation ---
@registry.tool(
    "translate_text",
    "Translate text into another language using the local model.",
    {
        "text": {"type": "string", "description": "Text to translate"},
        "target_language": {"type": "string", "description": "e.g. Spanish, French, Urdu"},
    },
    plugin="translate",
)
def translate_text(text: str, target_language: str) -> str:
    return ollama.generate(
        f"Translate the following text into {target_language}. Reply with ONLY the "
        f"translation.\n\n{text}", role="general", options={"temperature": 0.2})
