"""Spaced-repetition review — SM-2 scheduling over local flashcards/notes (offline)."""
from __future__ import annotations

from datetime import date, timedelta

from sqlmodel import select

from .. import db
from ..models import ReviewItem, Flashcard, Document


def add_item(front: str, back: str, source: str = "") -> None:
    with db.get_session() as s:
        s.add(ReviewItem(front=front.strip(), back=back.strip(), source=source))
        s.commit()


def due_items() -> list[ReviewItem]:
    today = date.today().isoformat()
    with db.get_session() as s:
        items = s.exec(select(ReviewItem).order_by(ReviewItem.due)).all()
    return [i for i in items if i.due <= today]


def counts() -> tuple[int, int]:
    """(due now, total)."""
    with db.get_session() as s:
        items = s.exec(select(ReviewItem)).all()
    today = date.today().isoformat()
    return sum(1 for i in items if i.due <= today), len(items)


def grade(item_id: int, quality: int) -> None:
    """Apply SM-2. quality: 1=Again, 3=Hard, 4=Good, 5=Easy."""
    with db.get_session() as s:
        item = s.get(ReviewItem, item_id)
        if not item:
            return
        if quality < 3:
            item.reps = 0
            item.interval = 1
        else:
            if item.reps == 0:
                item.interval = 1
            elif item.reps == 1:
                item.interval = 6
            else:
                item.interval = max(1, round(item.interval * item.ease))
            item.reps += 1
        item.ease = max(1.3, item.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
        item.due = (date.today() + timedelta(days=item.interval)).isoformat()
        s.add(item)
        s.commit()


def generate_from_flashcards() -> int:
    """Turn any stored flashcards into review cards (skipping duplicates)."""
    with db.get_session() as s:
        cards = s.exec(select(Flashcard)).all()
        existing = {i.front for i in s.exec(select(ReviewItem)).all()}
        added = 0
        for c in cards:
            if c.question and c.question not in existing:
                s.add(ReviewItem(front=c.question, back=c.answer, source="flashcards"))
                added += 1
        s.commit()
    return added
