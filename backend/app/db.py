"""SQLite engine + tiny helpers. One local file, no server, works offline."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine, select

from . import models
from .config import DB_PATH

# check_same_thread=False so the CustomTkinter UI thread and worker threads can
# both use the DB (fixes the threading bug noted in the old memory_service).
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _seed()


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def get_setting(key: str, default: str = "") -> str:
    with get_session() as s:
        row = s.get(models.Setting, key)
        return row.value if row else default


def set_setting(key: str, value: str) -> None:
    with get_session() as s:
        row = s.get(models.Setting, key)
        if row:
            row.value = value
        else:
            row = models.Setting(key=key, value=value)
        s.add(row)
        s.commit()


def _seed() -> None:
    """Seed built-in plugins once."""
    from .config import DEFAULT_MODELS, AGENT_ACCESS_MODE

    builtins = [
        ("shell", "Shell Runner", "Run local commands", "tool"),
        ("files", "File Manager", "Read & write & edit local files", "tool"),
        ("pdf", "PDF Studio", "Create & read PDFs offline", "tool"),
        ("slides", "Deck Builder", "Generate PowerPoint offline", "tool"),
        ("sheets", "Spreadsheet", "Generate .xlsx offline", "tool"),
        ("vision", "Vision", "Describe images with a local model", "ai"),
        ("python", "Python Runner", "Execute Python code locally", "tool"),
        ("charts", "Data Viz", "Generate charts offline", "visualization"),
        ("council", "Council", "Multi-model deliberation", "ai"),
        ("git", "Git Connector", "Local git operations for devs", "tool"),
        ("finance", "Finance", "Budgets, loans, retirement math", "tool"),
        ("invest", "Investing", "Returns, valuation, portfolio math", "tool"),
        ("business", "Business", "Break-even, pricing, invoices", "tool"),
        ("product", "Product", "RICE prioritization", "tool"),
        ("data", "Data Analysis", "Analyze CSV/Excel with pandas", "tool"),
        ("calendar", "Calendar", "Local events + ICS export", "tool"),
        ("tasks", "Tasks", "To-do list & reminders", "tool"),
        ("contacts", "Contacts", "Local address book (vCard)", "tool"),
        ("email", "Email", "Draft & read local mail offline", "tool"),
        ("database", "Database", "Query local SQLite databases", "tool"),
        ("translate", "Translate", "Local-model translation", "tool"),
        ("maps", "Maps", "Offline map cache (scrape/API + C++ geo)", "tool"),
        ("graph", "Knowledge Graph", "Force-directed note graph", "visualization"),
        ("voice", "Voice", "Offline speech in/out", "ai"),
    ]
    with get_session() as s:
        existing = {p.slug for p in s.exec(select(models.Plugin)).all()}
        for slug, name, desc, cat in builtins:
            if slug not in existing:
                s.add(models.Plugin(slug=slug, name=name, description=desc,
                                    category=cat, enabled=True, builtin=True))
        s.commit()

    # persist default settings if unset
    if not get_setting("models"):
        import json
        set_setting("models", json.dumps(DEFAULT_MODELS))
    if not get_setting("agent_access"):
        set_setting("agent_access", AGENT_ACCESS_MODE)
