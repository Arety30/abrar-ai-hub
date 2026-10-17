"""Calendar view — a local agenda with .ics export (offline)."""
from __future__ import annotations

from datetime import datetime

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import CalendarEvent
from .. import theme


class CalendarView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(head, text="📅  Calendar", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        self.info = ctk.CTkLabel(head, text="", text_color=theme.MUTED, font=theme.f(12))
        self.info.pack(side="left", padx=12)
        ctk.CTkButton(head, text="⬇ Export .ics", width=110, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._export).pack(side="right")

        # add-event row
        add = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        add.grid(row=1, column=0, sticky="ew", padx=24, pady=(0, 8))
        add.grid_columnconfigure(0, weight=1)
        self.title_in = ctk.CTkEntry(add, placeholder_text="Event title…", fg_color=theme.CARD,
                                     border_width=0, font=theme.f(14))
        self.title_in.grid(row=0, column=0, sticky="ew", padx=(12, 6), pady=8)
        self.title_in.bind("<Return>", lambda e: self._add())
        self.when_in = ctk.CTkEntry(add, placeholder_text="2026-08-05T15:00", width=160,
                                    fg_color=theme.CARD2, border_width=0)
        self.when_in.grid(row=0, column=1, padx=6)
        self.loc_in = ctk.CTkEntry(add, placeholder_text="location", width=130,
                                   fg_color=theme.CARD2, border_width=0)
        self.loc_in.grid(row=0, column=2, padx=6)
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
            events = s.exec(select(CalendarEvent).order_by(CalendarEvent.start)).all()
        now = datetime.now().isoformat()
        upcoming = [e for e in events if e.start >= now]
        self.info.configure(text=f"{len(events)} events · {len(upcoming)} upcoming")
        if not events:
            ctk.CTkLabel(self.list, text="No events yet — add one above.",
                         text_color=theme.MUTED, font=theme.f(14)).grid(pady=30)
            return
        for e in events:
            self._row(e, is_upcoming=e.start >= now)

    def _row(self, e: CalendarEvent, is_upcoming: bool):
        row = ctk.CTkFrame(self.list, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        row.grid(sticky="ew", pady=3)
        row.grid_columnconfigure(1, weight=1)
        bar = ctk.CTkLabel(row, text="│", text_color=theme.SECONDARY if is_upcoming else theme.MUTED,
                           font=theme.f(20, "bold"))
        bar.grid(row=0, column=0, padx=(10, 4), pady=8, rowspan=2)
        when = self._fmt(e.start)
        ctk.CTkLabel(row, text=e.title, text_color=theme.FG, font=theme.f(15, "bold"),
                     anchor="w").grid(row=0, column=1, sticky="w", pady=(8, 0))
        sub = when + (f"   ·   {e.location}" if e.location else "")
        ctk.CTkLabel(row, text=sub, text_color=theme.MUTED, font=theme.f(12),
                     anchor="w").grid(row=1, column=1, sticky="w", pady=(0, 8))
        ctk.CTkButton(row, text="🗑", width=34, fg_color=theme.CARD2, hover_color=theme.PRIMARY,
                      command=lambda: self._delete(e.id)).grid(row=0, column=2, rowspan=2, padx=(4, 10))

    def _fmt(self, iso: str) -> str:
        try:
            return datetime.fromisoformat(iso).strftime("%a %d %b %Y · %H:%M")
        except Exception:
            return iso

    def _add(self):
        title = self.title_in.get().strip()
        when = self.when_in.get().strip()
        if not title or not when:
            self.info.configure(text="⚠ need a title and a start time")
            return
        with db.get_session() as s:
            s.add(CalendarEvent(title=title, start=when, location=self.loc_in.get().strip()))
            s.commit()
        self.title_in.delete(0, "end"); self.when_in.delete(0, "end"); self.loc_in.delete(0, "end")
        self._refresh()

    def _delete(self, eid: int):
        with db.get_session() as s:
            e = s.get(CalendarEvent, eid)
            if e:
                s.delete(e); s.commit()
        self._refresh()

    def _export(self):
        from ...agent.tools.office_tools import export_calendar
        msg = export_calendar("calendar.ics")
        self.info.configure(text=msg)
