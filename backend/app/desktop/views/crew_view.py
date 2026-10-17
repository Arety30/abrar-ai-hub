"""Crew — a collaborative workspace where a team of AI coworkers tackle a goal."""
from __future__ import annotations

import threading

import customtkinter as ctk

from ...agent import crew, personas
from .. import theme


class CrewView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self._busy = False
        self._cur = None
        self._cur_text = ""
        self._roster_dots: dict[str, ctk.CTkLabel] = {}

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # header + goal
        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, columnspan=2, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(head, text="🧑‍🤝‍🧑  Crew", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        ctk.CTkLabel(head, text="your AI coworkers collaborate on a goal",
                     text_color=theme.MUTED, font=theme.f(12)).pack(side="left", padx=12)

        # feed
        self.feed = ctk.CTkScrollableFrame(self, fg_color=theme.BG)
        self.feed.grid(row=1, column=0, sticky="nsew", padx=(24, 8), pady=4)
        self.feed.grid_columnconfigure(0, weight=1)
        self._note("Give the crew a goal — a manager will split it into tasks and assign "
                   "each to the right teammate. They'll work a shared feed and hand you a "
                   "final deliverable.", theme.MUTED)

        # roster
        self._build_roster()

        # composer
        comp = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        comp.grid(row=2, column=0, columnspan=2, sticky="ew", padx=24, pady=16)
        comp.grid_columnconfigure(0, weight=1)
        self.goal = ctk.CTkEntry(comp, placeholder_text="e.g. Build a study plan for calculus and a practice quiz",
                                 fg_color=theme.CARD, border_width=0, font=theme.f(14))
        self.goal.grid(row=0, column=0, sticky="ew", padx=(12, 6), pady=10)
        self.goal.bind("<Return>", lambda e: self.assign())
        self.assign_btn = ctk.CTkButton(comp, text="Assign to crew ➤", width=150, height=40,
                                        fg_color=theme.PRIMARY, hover_color=theme.PRIMARY_HOVER,
                                        font=theme.f(14, "bold"), command=self.assign)
        self.assign_btn.grid(row=0, column=1, padx=(0, 10))

    def _build_roster(self):
        panel = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS, width=240)
        panel.grid(row=1, column=1, sticky="nsew", padx=(8, 24), pady=4)
        panel.grid_propagate(False)
        ctk.CTkLabel(panel, text="ROSTER", text_color=theme.MUTED,
                     font=theme.f(11, "bold")).pack(anchor="w", padx=14, pady=(12, 6))
        for p in personas.all():
            row = ctk.CTkFrame(panel, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=4)
            dot = ctk.CTkLabel(row, text="●", text_color=theme.MUTED, font=theme.f(13))
            dot.pack(side="left")
            self._roster_dots[p.key] = dot
            info = ctk.CTkFrame(row, fg_color="transparent")
            info.pack(side="left", fill="x", padx=6)
            ctk.CTkLabel(info, text=f"{p.icon} {p.name}", text_color=theme.FG,
                         font=theme.f(13, "bold")).pack(anchor="w")
            ctk.CTkLabel(info, text=p.description, text_color=theme.MUTED,
                         font=theme.f(10), wraplength=170, justify="left").pack(anchor="w")

    # -- feed helpers ------------------------------------------------------
    def _note(self, text, color, mono=False):
        lbl = ctk.CTkLabel(self.feed, text=text, justify="left", wraplength=640,
                           text_color=color, font=theme.mono(11) if mono else theme.f(12))
        lbl.grid(sticky="w", padx=12, pady=3)
        self.after(30, lambda: self.feed._parent_canvas.yview_moveto(1.0))
        return lbl

    def _card(self, title, color):
        card = ctk.CTkFrame(self.feed, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        card.grid(sticky="ew", padx=8, pady=6)
        card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(card, text=title, text_color=color,
                     font=theme.f(13, "bold")).grid(sticky="w", padx=12, pady=(8, 2))
        body = ctk.CTkLabel(card, text="▍", justify="left", wraplength=620,
                            text_color=theme.FG, font=theme.f(13))
        body.grid(sticky="w", padx=12, pady=(0, 10))
        self.after(30, lambda: self.feed._parent_canvas.yview_moveto(1.0))
        return body

    # -- run ---------------------------------------------------------------
    def assign(self):
        if self._busy:
            return
        goal = self.goal.get().strip()
        if not goal:
            return
        self.goal.delete(0, "end")
        self._note(f"🎯 Goal: {goal}", theme.SECONDARY)
        self._busy = True
        self.assign_btn.configure(state="disabled", text="working…")
        threading.Thread(target=self._run, args=(goal,), daemon=True).start()

    def _run(self, goal: str):
        def emit(kind, **k):
            self.app.after(0, lambda: self._on_event(kind, k))
        try:
            crew.run(goal, emit=emit, approver=self.app.approve)
        except Exception as e:
            self.app.after(0, lambda: self._note(f"⚠ error: {e}", theme.PRIMARY))
        self.app.after(0, self._finish)

    def _on_event(self, kind, k):
        if kind == "crew_plan":
            lines = "\n".join(f"  {i}. [{t['agent']}] {t['task']}"
                              for i, t in enumerate(k["tasks"], 1))
            self._note("🗂 Manager's plan:\n" + lines, theme.GOLD)
        elif kind == "agent_start":
            self._set_dot(k["agent"], theme.SECONDARY)
            self._note(f"▶ {k['agent_name']} — {k['task']}", theme.PRIMARY)
            self._cur = self._card(k["agent_name"], theme.SECONDARY)
            self._cur_text = ""
        elif kind == "token" and self._cur is not None:
            self._cur_text += k.get("text", "")
            self._cur.configure(text=self._cur_text + " ▍")
        elif kind == "tool_call":
            self._note(f"   → {k['name']} {str(k.get('args',''))[:80]}", theme.BLUE, mono=True)
        elif kind == "tool_result":
            self._note(f"   ✓ {k['name']} {str(k.get('result',''))[:100]}", theme.MUTED, mono=True)
        elif kind == "agent_done":
            if self._cur is not None:
                self._cur.configure(text=self._cur_text or "(done)")
            self._set_dot(k["agent"], theme.MUTED)
            self._cur = None
        elif kind == "crew_critique":
            self._note("🔎 Reviewer notes:\n" + k.get("critique", ""), theme.GOLD)
        elif kind == "crew_done":
            self._card("✅ Final deliverable", theme.SECONDARY).configure(
                text=k.get("summary", ""))

    def _set_dot(self, key, color):
        dot = self._roster_dots.get(key)
        if dot:
            dot.configure(text_color=color)

    def _finish(self):
        self._busy = False
        self.assign_btn.configure(state="normal", text="Assign to crew ➤")
