"""SQLModel ORM — the entire local datastore (one SQLite file, offline).

Covers every section of the app: agent memory/conversations, the notes vault
+ knowledge-graph edges, study documents & flashcards, meetings & transcripts,
plugins, and key/value settings.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


# --- Settings (key/value) ---------------------------------------------------
class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str = ""


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = ""
    password_hash: str = ""     # "pbkdf2$iters$salt$hash"
    role: str = "user"          # user | admin
    created_at: str = Field(default_factory=_now)


class UserSession(SQLModel, table=True):
    token: str = Field(primary_key=True)
    user_id: int = Field(index=True)
    created_at: str = Field(default_factory=_now)
    expires_at: str = ""


# --- Agent memory & conversations ------------------------------------------
class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = "New chat"
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(index=True, foreign_key="conversation.id")
    role: str = "user"          # user | assistant | tool | system
    content: str = ""
    meta: str = "{}"            # JSON: tool calls, attachments, timings
    created_at: str = Field(default_factory=_now)

    def meta_dict(self) -> dict:
        try:
            return json.loads(self.meta or "{}")
        except Exception:
            return {}


class Memory(SQLModel, table=True):
    """Long-term facts the agent chooses to remember across sessions."""
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str = ""
    kind: str = "fact"          # fact | preference | project
    created_at: str = Field(default_factory=_now)


# --- Notes vault + knowledge graph -----------------------------------------
class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "Untitled.md"
    content: str = ""
    tags: str = ""              # comma-separated
    kind: str = "note"          # note | attachment
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)

    def tag_list(self) -> list[str]:
        return [t.strip() for t in self.tags.split(",") if t.strip()]


# --- Study / NotebookLM ----------------------------------------------------
class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = ""
    content: str = ""
    category: str = "General"
    word_count: int = 0
    source_url: str = ""
    created_at: str = Field(default_factory=_now)


class Flashcard(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: Optional[int] = Field(default=None, index=True)
    question: str = ""
    answer: str = ""
    created_at: str = Field(default_factory=_now)


class QuizAttempt(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source: str = "All material"
    score: int = 0
    total: int = 0
    created_at: str = Field(default_factory=_now)


class ReviewItem(SQLModel, table=True):
    """A spaced-repetition card scheduled with an SM-2 style algorithm."""
    id: Optional[int] = Field(default=None, primary_key=True)
    front: str = ""
    back: str = ""
    source: str = ""
    ease: float = 2.5
    interval: int = 0            # days until next review
    reps: int = 0
    due: str = Field(default_factory=lambda: datetime.now().date().isoformat())
    created_at: str = Field(default_factory=_now)


# --- Meetings --------------------------------------------------------------
class Meeting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = "Untitled meeting"
    scheduled_for: str = ""
    notes: str = ""
    created_at: str = Field(default_factory=_now)


class TranscriptEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: Optional[int] = Field(default=None, index=True)
    speaker: str = ""
    text: str = ""
    is_ai: bool = False
    created_at: str = Field(default_factory=_now)


# --- Plugins ---------------------------------------------------------------
class CalendarEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = ""
    start: str = ""             # ISO datetime/date
    end: str = ""
    location: str = ""
    notes: str = ""
    created_at: str = Field(default_factory=_now)


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = ""
    due: str = ""               # ISO date, optional
    priority: str = "normal"    # low | normal | high
    done: bool = False
    created_at: str = Field(default_factory=_now)


class Contact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = ""
    email: str = ""
    phone: str = ""
    notes: str = ""
    created_at: str = Field(default_factory=_now)


class Place(SQLModel, table=True):
    """A cached map place (from Google Places / OSM). The agent reads these offline."""
    id: Optional[int] = Field(default=None, primary_key=True)
    place_id: str = Field(index=True, default="")
    name: str = ""
    address: str = ""
    lat: float = 0.0
    lng: float = 0.0
    types: str = ""            # comma-separated
    rating: float = 0.0
    phone: str = ""
    website: str = ""
    query: str = ""            # the search that found it
    source: str = "google"     # google | osm
    raw: str = "{}"
    fetched_at: str = Field(default_factory=_now)


class GeoCache(SQLModel, table=True):
    """Cached geocode/reverse-geocode lookups so they resolve offline."""
    id: Optional[int] = Field(default=None, primary_key=True)
    query: str = Field(index=True, default="")   # address or "lat,lng"
    formatted_address: str = ""
    lat: float = 0.0
    lng: float = 0.0
    kind: str = "geocode"      # geocode | reverse
    source: str = "google"
    fetched_at: str = Field(default_factory=_now)


class Plugin(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(index=True)
    name: str = ""
    description: str = ""
    category: str = "utility"   # utility | ai | visualization | tool
    enabled: bool = True
    builtin: bool = False
    created_at: str = Field(default_factory=_now)
