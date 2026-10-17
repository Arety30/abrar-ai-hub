"""Notes view — a local markdown vault with [[wikilinks]] and autosave.

Notes here are the same records the Knowledge Graph visualises.
"""
from __future__ import annotations

from datetime import datetime

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import Note
from .. import theme


class NotesView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.current: Note | None = None
        self._save_job = None

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(self, text="Notes Vault", text_color=theme.FG, font=theme.f(20, "bold")
                     ).grid(row=0, column=0, columnspan=2, sticky="w", padx=24, pady=(16, 8))

        # left list
        left = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS, width=250)
        left.grid(row=1, column=0, sticky="nsew", padx=(24, 12), pady=(0, 16))
        left.grid_propagate(False)
        ctk.CTkButton(left, text="+ New note", fg_color=theme.SECONDARY,
                      hover_color=theme.SECONDARY_HOVER, command=self._new).pack(
            fill="x", padx=12, pady=12)
        self.list = ctk.CTkScrollableFrame(left, fg_color="transparent")
        self.list.pack(fill="both", expand=True, padx=6)

        # right editor
        right = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        right.grid(row=1, column=1, sticky="nsew", padx=(0, 24), pady=(0, 16))
        right.grid_rowconfigure(2, weight=1)
        right.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(right, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))
        top.grid_columnconfigure(0, weight=1)
        self.name = ctk.CTkEntry(top, placeholder_text="Note title", fg_color=theme.CARD2,
                                 border_width=0, font=theme.f(15, "bold"))
        self.name.grid(row=0, column=0, sticky="ew")
        self.name.bind("<KeyRelease>", lambda e: self._schedule_save())
        ctk.CTkButton(top, text="🗑", width=40, fg_color=theme.CARD2,
                      hover_color=theme.PRIMARY, command=self._delete).grid(row=0, column=1, padx=(8, 0))

        self.tags = ctk.CTkEntry(right, placeholder_text="tags, comma, separated",
                                 fg_color=theme.CARD2, border_width=0, font=theme.f(12))
        self.tags.grid(row=1, column=0, sticky="ew", padx=14, pady=4)
        self.tags.bind("<KeyRelease>", lambda e: self._schedule_save())

        self.editor = ctk.CTkTextbox(right, fg_color=theme.CARD2, text_color=theme.FG,
                                     font=theme.mono(13), wrap="word")
        self.editor.grid(row=2, column=0, sticky="nsew", padx=14, pady=(4, 6))
        self.editor.bind("<KeyRelease>", lambda e: self._schedule_save())

        self.status = ctk.CTkLabel(right, text="", text_color=theme.MUTED, font=theme.f(11))
        self.status.grid(row=3, column=0, sticky="w", padx=16, pady=(0, 10))

    def on_show(self):
        self._refresh()

    def _refresh(self):
        for w in self.list.winfo_children():
            w.destroy()
        with db.get_session() as s:
            notes = s.exec(select(Note).order_by(Note.updated_at.desc())).all()
        if not notes:
            ctk.CTkLabel(self.list, text="No notes yet", text_color=theme.MUTED).pack(pady=10)
        for n in notes:
            ctk.CTkButton(self.list, text=n.name, anchor="w", fg_color="transparent",
                          hover_color=theme.CARD2, text_color=theme.FG, font=theme.f(13),
                          command=lambda x=n.id: self._open(x)).pack(fill="x", pady=1)

    def _new(self):
        with db.get_session() as s:
            note = Note(name=f"Untitled {datetime.now():%H%M%S}.md", content="")
            s.add(note)
            s.commit()
            s.refresh(note)
            nid = note.id
        self._refresh()
        self._open(nid)

    def _open(self, note_id: int):
        with db.get_session() as s:
            note = s.get(Note, note_id)
        if not note:
            return
        self.current = note
        self.name.delete(0, "end"); self.name.insert(0, note.name)
        self.tags.delete(0, "end"); self.tags.insert(0, note.tags)
        self.editor.delete("1.0", "end"); self.editor.insert("1.0", note.content)
        self.status.configure(text=f"opened · {note.updated_at}")

    def _schedule_save(self):
        if self._save_job:
            self.after_cancel(self._save_job)
        self._save_job = self.after(500, self._save)

    def _save(self):
        if not self.current:
            return
        with db.get_session() as s:
            note = s.get(Note, self.current.id)
            if not note:
                return
            note.name = self.name.get().strip() or note.name
            note.tags = self.tags.get().strip()
            note.content = self.editor.get("1.0", "end").rstrip()
            note.updated_at = datetime.now().isoformat(timespec="seconds")
            s.add(note); s.commit()
        self.status.configure(text=f"saved · {datetime.now():%H:%M:%S}")
        self._refresh()

    def _delete(self):
        if not self.current:
            return
        with db.get_session() as s:
            note = s.get(Note, self.current.id)
            if note:
                s.delete(note); s.commit()
        self.current = None
        self.name.delete(0, "end"); self.tags.delete(0, "end")
        self.editor.delete("1.0", "end")
        self._refresh()
