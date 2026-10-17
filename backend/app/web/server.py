"""Web backend for Abrar AI Hub — a FastAPI server that exposes the same local,
offline core (agent, tools, tasks, calendar, plugins) over HTTP.

Serves two front-ends by Host header:
  • test.aretytech…  → the AI Hub web app  (index.html)
  • suite.aretytech… → the backend console (suite.html)

Run:  python -m app.web        (listens on 127.0.0.1:8100, behind Apache)
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import select

from .. import db
from ..config import APP_NAME
from ..agent import core, personas
from ..agent.registry import registry
from ..providers import ollama
from ..models import Task, CalendarEvent, Plugin, Conversation, Message
from . import auth

STATIC = Path(__file__).parent / "static"

# Paths reachable without a login.
_PUBLIC = {"/login", "/health", "/sw.js", "/manifest.webmanifest",
           "/api/auth/login", "/api/auth/register", "/api/auth/status"}

app = FastAPI(title=f"{APP_NAME} Web")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    public = (path in _PUBLIC or path.startswith("/static") or
              path.startswith("/favicon"))
    if not public:
        user = auth.user_for_token(request.cookies.get(auth.COOKIE))
        if not user:
            if path.startswith("/api") or path.startswith("/v1"):
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
            return RedirectResponse("/login")
        request.state.user = user
    return await call_next(request)


@app.on_event("startup")
def _startup():
    db.init_db()


# ----------------------------------------------------------------- auth ---
class Credentials(BaseModel):
    username: str
    password: str
    email: str = ""


@app.get("/api/auth/status")
def auth_status():
    return {"registered": auth.user_count() > 0}


def _is_https(request: Request) -> bool:
    # Behind Apache: trust X-Forwarded-Proto; else fall back to the request scheme.
    return (request.headers.get("x-forwarded-proto", request.url.scheme) == "https")


def _set_session(resp: JSONResponse, token: str, request: Request) -> None:
    # Secure only over HTTPS so login also works on plain-HTTP hosts (tailnet/LAN).
    resp.set_cookie(auth.COOKIE, token, httponly=True, samesite="lax",
                    secure=_is_https(request), max_age=auth.SESSION_DAYS * 86400)


@app.post("/api/auth/register")
def register(body: Credentials, request: Request):
    # First account (admin) is always allowed. After that, registration is closed
    # unless an admin opens it via the "allow_registration" setting.
    if auth.user_count() > 0 and db.get_setting("allow_registration", "0") != "1":
        return JSONResponse({"detail": "registration is closed"}, status_code=403)
    if len(body.username) < 3 or len(body.password) < 6:
        return JSONResponse({"detail": "username ≥3 and password ≥6 chars"}, status_code=400)
    if auth.get_user(body.username):
        return JSONResponse({"detail": "username taken"}, status_code=400)
    u = auth.create_user(body.username, body.password, body.email)
    token = auth.create_session(u.id)
    resp = JSONResponse({"ok": True, "username": u.username, "role": u.role})
    _set_session(resp, token, request)
    return resp


@app.post("/api/auth/login")
def login(body: Credentials, request: Request):
    u = auth.get_user(body.username)
    if not u or not auth.verify_password(body.password, u.password_hash):
        return JSONResponse({"detail": "invalid username or password"}, status_code=401)
    token = auth.create_session(u.id)
    resp = JSONResponse({"ok": True, "username": u.username, "role": u.role})
    _set_session(resp, token, request)
    return resp


@app.post("/api/auth/logout")
def logout(request: Request):
    auth.delete_session(request.cookies.get(auth.COOKIE))
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE)
    return resp


@app.get("/api/auth/me")
def me(request: Request):
    u = getattr(request.state, "user", None)
    return {"username": u.username, "role": u.role} if u else {}


# --------------------------------------------------------------- health ---
@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": APP_NAME,
        "ollama_online": ollama.is_online(),
        "models": ollama.models(),
        "tools": len(registry.names()),
        "personas": [p.key for p in personas.all()],
    }


# ----------------------------------------------------------------- chat ---
class ChatIn(BaseModel):
    message: str
    persona: str = "assistant"
    history: list[dict] = []


@app.post("/api/chat")
def api_chat(body: ChatIn):
    events: list[dict] = []
    answer = core.run(body.message, history=body.history,
                      emit=lambda kind, **k: events.append({"kind": kind, **k}),
                      approver=lambda *a: True, persona=body.persona)
    tool_calls = [e for e in events if e["kind"] in ("tool_call", "tool_result")]
    return {"reply": answer, "events": tool_calls}


# OpenAI-compatible shim (so /v1 clients + the vite proxy work)
@app.post("/v1/chat/completions")
def v1_chat(body: dict):
    msgs = body.get("messages", [])
    user = next((m["content"] for m in reversed(msgs) if m.get("role") == "user"), "")
    history = [{"role": m["role"], "content": m["content"]}
               for m in msgs if m.get("role") in ("user", "assistant")][:-1]
    reply = core.run(user, history=history, approver=lambda *a: True)
    return {"id": "chatcmpl-local", "object": "chat.completion",
            "model": ollama.model_for("general"),
            "choices": [{"index": 0, "message": {"role": "assistant", "content": reply},
                         "finish_reason": "stop"}]}


# ---------------------------------------------------------------- tasks ---
@app.get("/api/tasks")
def get_tasks():
    with db.get_session() as s:
        return [t.model_dump() for t in s.exec(select(Task).order_by(Task.done, Task.due)).all()]


@app.post("/api/tasks")
def add_task(body: dict):
    with db.get_session() as s:
        t = Task(title=body.get("title", ""), due=body.get("due", ""),
                 priority=body.get("priority", "normal"))
        s.add(t); s.commit(); s.refresh(t)
        return t.model_dump()


@app.post("/api/tasks/{tid}/toggle")
def toggle_task(tid: int):
    with db.get_session() as s:
        t = s.get(Task, tid)
        if t:
            t.done = not t.done; s.add(t); s.commit()
        return {"ok": bool(t)}


# ------------------------------------------------------------- calendar ---
@app.get("/api/events")
def get_events():
    with db.get_session() as s:
        return [e.model_dump() for e in s.exec(select(CalendarEvent).order_by(CalendarEvent.start)).all()]


@app.post("/api/events")
def add_event(body: dict):
    with db.get_session() as s:
        e = CalendarEvent(title=body.get("title", ""), start=body.get("start", ""),
                          location=body.get("location", ""))
        s.add(e); s.commit(); s.refresh(e)
        return e.model_dump()


# -------------------------------------------------- console (suite) data ---
@app.get("/api/plugins")
def get_plugins():
    with db.get_session() as s:
        return [p.model_dump() for p in s.exec(select(Plugin)).all()]


@app.post("/api/plugins/{slug}/toggle")
def toggle_plugin(slug: str):
    with db.get_session() as s:
        p = s.exec(select(Plugin).where(Plugin.slug == slug)).first()
        if p:
            p.enabled = not p.enabled; s.add(p); s.commit()
        return {"ok": bool(p), "enabled": p.enabled if p else None}


@app.get("/api/tools")
def get_tools():
    return [{"name": t.name, "plugin": t.plugin, "danger": t.danger,
             "description": t.description} for t in registry.all()]


@app.get("/api/stats")
def stats():
    from ..models import Note, Document, Memory
    with db.get_session() as s:
        return {
            "conversations": len(s.exec(select(Conversation)).all()),
            "messages": len(s.exec(select(Message)).all()),
            "notes": len(s.exec(select(Note)).all()),
            "documents": len(s.exec(select(Document)).all()),
            "tasks": len(s.exec(select(Task)).all()),
            "events": len(s.exec(select(CalendarEvent)).all()),
            "memories": len(s.exec(select(Memory)).all()),
            "plugins_enabled": len([p for p in s.exec(select(Plugin)).all() if p.enabled]),
        }


# ---------------------------------------------------------------- notes ---
@app.get("/api/notes")
def get_notes():
    from ..models import Note
    with db.get_session() as s:
        return [n.model_dump() for n in s.exec(select(Note).order_by(Note.updated_at.desc())).all()]


@app.post("/api/notes")
def save_note(body: dict):
    from datetime import datetime
    from ..models import Note
    name = body.get("name", "Untitled.md")
    if not name.endswith(".md"):
        name += ".md"
    with db.get_session() as s:
        n = s.exec(select(Note).where(Note.name == name)).first()
        if not n:
            n = Note(name=name)
        n.content = body.get("content", "")
        n.tags = body.get("tags", "")
        n.updated_at = datetime.now().isoformat(timespec="seconds")
        s.add(n); s.commit(); s.refresh(n)
        return n.model_dump()


@app.delete("/api/notes/{nid}")
def delete_note(nid: int):
    from ..models import Note
    with db.get_session() as s:
        n = s.get(Note, nid)
        if n:
            s.delete(n); s.commit()
    return {"ok": True}


# ---------------------------------------------------------------- graph ---
@app.get("/api/graph")
def get_graph():
    import re
    from ..models import Note, Meeting
    wl = re.compile(r"\[\[(.*?)\]\]")
    with db.get_session() as s:
        notes = s.exec(select(Note)).all()
        meetings = s.exec(select(Meeting)).all()
    nodes, idx = [], {}
    for n in notes:
        key = n.name.replace(".md", "")
        idx[key.lower()] = len(nodes)
        nodes.append({"id": key, "type": "note"})
    for m in meetings:
        nodes.append({"id": m.title, "type": "meeting"})
    links = []
    for n in notes:
        src = idx.get(n.name.replace(".md", "").lower())
        for tgt in wl.findall(n.content or ""):
            j = idx.get(tgt.strip().lower())
            if j is not None and j != src:
                links.append({"source": src, "target": j})
    return {"nodes": nodes, "links": links}


# ---------------------------------------------------------------- study ---
@app.get("/api/documents")
def get_documents():
    from ..models import Document
    with db.get_session() as s:
        return [d.model_dump() for d in s.exec(select(Document).order_by(Document.id.desc())).all()]


@app.post("/api/documents")
def add_document(body: dict):
    from ..models import Document
    content = body.get("content", "")
    with db.get_session() as s:
        d = Document(title=body.get("title", "Untitled"), content=content,
                     category=body.get("category", "General"), word_count=len(content.split()))
        s.add(d); s.commit(); s.refresh(d)
        return d.model_dump()


@app.post("/api/study/ask")
def study_ask(body: dict):
    from ..models import Document
    with db.get_session() as s:
        d = s.get(Document, body.get("doc_id"))
    ctx = d.content[:6000] if d else ""
    mode = body.get("mode", "ask")
    q = body.get("question", "")
    if mode == "summary":
        prompt = f"Summarize this into a concise study guide with headings:\n\n{ctx}"
    elif mode == "actions":
        prompt = f"Extract a checklist of action items from this:\n\n{ctx}"
    else:
        prompt = f"Using ONLY this source, answer.\n\nSOURCE:\n{ctx}\n\nQUESTION: {q}"
    return {"answer": ollama.generate(prompt, role="general")}


# ----------------------------------------------------------------- quiz ---
@app.post("/api/quiz/generate")
def quiz_generate(body: dict):
    from ..agent import quiz
    return {"questions": quiz.generate(body.get("source", "All material"),
                                       int(body.get("n", 5)), body.get("qtype", "mcq"))}


@app.post("/api/quiz/grade")
def quiz_grade(body: dict):
    from ..agent import quiz
    return quiz.grade_open(body.get("question", ""), body.get("reference", ""),
                           body.get("answer", ""))


@app.get("/api/quiz/sources")
def quiz_sources():
    from ..agent import quiz
    return quiz.sources()


# --------------------------------------------------------------- review ---
@app.get("/api/review/due")
def review_due():
    from ..agent import review
    due, total = review.counts()
    return {"due": [i.model_dump() for i in review.due_items()], "total": total}


@app.post("/api/review/grade")
def review_grade(body: dict):
    from ..agent import review
    review.grade(int(body["id"]), int(body["quality"]))
    return {"ok": True}


@app.post("/api/review/import")
def review_import():
    from ..agent import review
    return {"added": review.generate_from_flashcards()}


# ------------------------------------------------------------ connectors ---
@app.get("/api/connectors")
def get_connectors():
    from .. import connectors
    from ..agent.registry import registry
    out = []
    for c in connectors.all():
        tools = [t.name for t in registry.all() if t.plugin in c.plugins]
        out.append({"key": c.key, "name": c.name, "icon": c.icon,
                    "description": c.description, "persona": c.persona,
                    "tools": tools, "examples": c.examples})
    return out


# ------------------------------------------------------------- settings ---
@app.get("/api/settings")
def get_settings():
    return {"models": ollama.models(), "agent_access": db.get_setting("agent_access", "approval"),
            "installed": ollama.installed()}


@app.post("/api/settings")
def set_settings(body: dict):
    import json
    if "models" in body:
        db.set_setting("models", json.dumps(body["models"]))
    if "agent_access" in body:
        db.set_setting("agent_access", body["agent_access"])
    return {"ok": True}


# --------------------------------------------------------------- pages ---
@app.get("/")
def index(request: Request):
    host = request.headers.get("host", "")
    page = "suite.html" if host.startswith("suite") else "index.html"
    return FileResponse(STATIC / page)


@app.get("/login")
def login_page():
    return FileResponse(STATIC / "login.html")


@app.get("/suite")
def suite_page():
    return FileResponse(STATIC / "suite.html")


@app.get("/sw.js")
def sw():
    return FileResponse(STATIC / "sw.js", media_type="application/javascript")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")


if (STATIC).exists():
    app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


def main():
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8100, log_level="info")


if __name__ == "__main__":
    main()
