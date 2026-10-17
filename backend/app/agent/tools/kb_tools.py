"""Knowledge tools: long-term memory and the markdown notes vault."""
from __future__ import annotations

from sqlmodel import select

from ..registry import registry
from ... import db
from ...models import Memory, Note


@registry.tool(
    "remember",
    "Save a fact/preference to long-term memory so it persists across sessions.",
    {
        "text": {"type": "string", "description": "The fact to remember"},
        "kind": {"type": "string", "description": "fact | preference | project", "_optional": True},
    },
    plugin="core",
)
def remember(text: str, kind: str = "fact") -> str:
    with db.get_session() as s:
        s.add(Memory(text=text, kind=kind))
        s.commit()
    return f"Remembered ({kind}): {text}"


@registry.tool(
    "recall",
    "Search long-term memory for relevant saved facts.",
    {"query": {"type": "string", "description": "What to look for", "_optional": True}},
    plugin="core",
)
def recall(query: str = "") -> str:
    q = (query or "").lower()
    with db.get_session() as s:
        rows = s.exec(select(Memory).order_by(Memory.id.desc())).all()
    hits = [m for m in rows if not q or q in m.text.lower()][:15]
    if not hits:
        return "No matching memories."
    return "\n".join(f"- [{m.kind}] {m.text}" for m in hits)


@registry.tool(
    "create_note",
    "Create or overwrite a markdown note in the vault. Use [[Wikilinks]] to connect notes.",
    {
        "name": {"type": "string", "description": "Note name, e.g. 'Project Ideas'"},
        "content": {"type": "string", "description": "Markdown content"},
        "tags": {"type": "string", "description": "Comma-separated tags", "_optional": True},
    },
    plugin="core",
)
def create_note(name: str, content: str = "", tags: str = "") -> str:
    if not name.endswith(".md"):
        name += ".md"
    with db.get_session() as s:
        existing = s.exec(select(Note).where(Note.name == name)).first()
        if existing:
            existing.content = content
            existing.tags = tags
            existing.updated_at = _now()
            s.add(existing)
        else:
            s.add(Note(name=name, content=content, tags=tags))
        s.commit()
    return f"Saved note: {name}"


@registry.tool(
    "import_folder",
    "Import a local folder's text files (.md, .txt, .py, .pdf) into the notes vault "
    "so they become searchable notes and graph nodes.",
    {
        "path": {"type": "string", "description": "Folder to import"},
        "tags": {"type": "string", "description": "Tags to apply", "_optional": True},
    },
    plugin="files",
)
def import_folder(path: str, tags: str = "imported") -> str:
    from pathlib import Path
    from ..safety import resolve_path
    folder = resolve_path(path, must_exist=True)
    if not folder.is_dir():
        return f"{folder} is not a folder."
    exts = {".md", ".txt", ".py", ".markdown", ".rst", ".pdf"}
    added = 0
    with db.get_session() as s:
        existing = {n.name for n in s.exec(select(Note)).all()}
        for f in sorted(folder.rglob("*")):
            if not f.is_file() or f.suffix.lower() not in exts:
                continue
            try:
                if f.suffix.lower() == ".pdf":
                    from pypdf import PdfReader
                    content = "\n".join((pg.extract_text() or "") for pg in PdfReader(str(f)).pages)
                else:
                    content = f.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            name = f.name if f.name.endswith(".md") else f.stem + ".md"
            if name in existing:
                continue
            s.add(Note(name=name, content=content[:20000], tags=tags))
            existing.add(name)
            added += 1
            if added >= 200:
                break
        s.commit()
    return f"Imported {added} file(s) from {folder} into the vault."


@registry.tool(
    "list_notes",
    "List all notes in the vault.",
    {},
    plugin="core",
)
def list_notes() -> str:
    with db.get_session() as s:
        rows = s.exec(select(Note).order_by(Note.updated_at.desc())).all()
    if not rows:
        return "The vault is empty."
    return "\n".join(f"- {n.name}  ({', '.join(n.tag_list()) or 'no tags'})" for n in rows)


@registry.tool(
    "read_note",
    "Read the content of a note from the vault by name.",
    {"name": {"type": "string", "description": "Note name"}},
    plugin="core",
)
def read_note(name: str) -> str:
    if not name.endswith(".md"):
        name += ".md"
    with db.get_session() as s:
        n = s.exec(select(Note).where(Note.name == name)).first()
    return n.content if n else f"No note named {name}."


def _now() -> str:
    from datetime import datetime
    return datetime.now().isoformat(timespec="seconds")
