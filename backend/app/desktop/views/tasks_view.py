"""Tasks view — a local to-do list / reminders board (offline)."""
from __future__ import annotations

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import Task
from .. import theme

PRIO = {"high": theme.PRIMARY, "normal": theme.GOLD, "low": theme.MUTED}


class TasksView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.show_done = ctk.BooleanVar(value=False)

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(head, text="✅  Tasks", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        self.count = ctk.CTkLabel(head, text="", text_color=theme.MUTED, font=theme.f(12))
        self.count.pack(side="left", padx=12)
        ctk.CTkSwitch(head, text="show completed", variable=self.show_done,
                      progress_color=theme.SECONDARY, font=theme.f(12),
                      text_color=theme.MUTED, command=self._refresh).pack(side="right")

        # add-task row
        add = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        add.grid(row=1, column=0, sticky="ew", padx=24, pady=(0, 8))
        add.grid_columnconfigure(0, weight=1)
        self.title_in = ctk.CTkEntry(add, placeholder_text="New task…", fg_color=theme.CARD,
                                     border_width=0, font=theme.f(14))
        self.title_in.grid(row=0, column=0, sticky="ew", padx=(12, 6), pady=8)
        self.title_in.bind("<Return>", lambda e: self._add())
        self.due_in = ctk.CTkEntry(add, placeholder_text="due YYYY-MM-DD", width=130,
                                   fg_color=theme.CARD2, border_width=0)
        self.due_in.grid(row=0, column=1, padx=6)
        self.prio_in = ctk.CTkOptionMenu(add, values=["low", "normal", "high"], width=90,
                                         fg_color=theme.CARD2, button_color=theme.CARD2)
        self.prio_in.set("normal")
        self.prio_in.grid(row=0, column=2, padx=6)
        ctk.CTkButton(add, text="Add", width=70, fg_color=theme.PRIMARY,
                      hover_color=theme.PRIMARY_HOVER, command=self._add).grid(row=0, column=3, padx=(6, 10))

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=2, column=0, sticky="nsew", padx=24, pady=(0, 16))
        self.list.grid_columnconfigure(0, weight=1)

    def on_show(self):
        self._refresh()

    def _refresh(self):
        for w in self.list.winfo_children():
            w.destroy()
        with db.get_session() as s:
            tasks = s.exec(select(Task).order_by(Task.done, Task.due)).all()
        if not self.show_done.get():
            tasks = [t for t in tasks if not t.done]
        open_n = sum(1 for t in tasks if not t.done)
        self.count.configure(text=f"{open_n} open")
        if not tasks:
            ctk.CTkLabel(self.list, text="No tasks 🎉", text_color=theme.MUTED,
                         font=theme.f(14)).grid(pady=30)
            return
        for t in tasks:
            self._row(t)

    def _row(self, t: Task):
        row = ctk.CTkFrame(self.list, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        row.grid(sticky="ew", pady=3)
        row.grid_columnconfigure(1, weight=1)
        var = ctk.BooleanVar(value=t.done)
        ctk.CTkCheckBox(row, text="", variable=var, width=28, checkbox_width=20,
                        checkbox_height=20, fg_color=theme.SECONDARY,
                        command=lambda: self._toggle(t.id, var)).grid(row=0, column=0, padx=(10, 4), pady=8)
        label = t.title + (f"   ·   due {t.due}" if t.due else "")
        ctk.CTkLabel(row, text=label, text_color=theme.MUTED if t.done else theme.FG,
                     font=theme.f(14), anchor="w").grid(row=0, column=1, sticky="w")
        ctk.CTkLabel(row, text="●", text_color=PRIO.get(t.priority, theme.GOLD),
                     font=theme.f(14)).grid(row=0, column=2, padx=6)
        ctk.CTkButton(row, text="🗑", width=34, fg_color=theme.CARD2, hover_color=theme.PRIMARY,
                      command=lambda: self._delete(t.id)).grid(row=0, column=3, padx=(4, 10))

    def _add(self):
        title = self.title_in.get().strip()
        if not title:
            return
        with db.get_session() as s:
            s.add(Task(title=title, due=self.due_in.get().strip(), priority=self.prio_in.get()))
            s.commit()
        self.title_in.delete(0, "end"); self.due_in.delete(0, "end")
        self._refresh()

    def _toggle(self, tid: int, var):
        with db.get_session() as s:
            t = s.get(Task, tid)
            if t:
                t.done = bool(var.get()); s.add(t); s.commit()
        self._refresh()

    def _delete(self, tid: int):
        with db.get_session() as s:
            t = s.get(Task, tid)
            if t:
                s.delete(t); s.commit()
        self._refresh()
