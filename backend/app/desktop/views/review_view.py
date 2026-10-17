"""Review view — spaced-repetition study (SM-2), offline."""
from __future__ import annotations

import customtkinter as ctk

from ...agent import review
from .. import theme

GRADES = [("Again", 1, theme.PRIMARY), ("Hard", 3, theme.GOLD),
          ("Good", 4, theme.BLUE), ("Easy", 5, theme.SECONDARY)]


class ReviewView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.queue: list = []
        self.current = None
        self._revealed = False

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(bar, text="🔁  Review", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        self.count_lbl = ctk.CTkLabel(bar, text="", text_color=theme.MUTED, font=theme.f(12))
        self.count_lbl.pack(side="left", padx=14)
        ctk.CTkButton(bar, text="+ Add card", width=90, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._add).pack(side="right", padx=6)
        ctk.CTkButton(bar, text="⚡ From flashcards", width=140, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._import).pack(side="right")

        self.card = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        self.card.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 16))
        self.card.grid_columnconfigure(0, weight=1)
        self.card.grid_rowconfigure(0, weight=1)

    def on_show(self):
        self.queue = review.due_items()
        self._refresh_count()
        self._next()

    def _refresh_count(self):
        due, total = review.counts()
        self.count_lbl.configure(text=f"{due} due · {total} cards")

    def _clear(self):
        for w in self.card.winfo_children():
            w.destroy()

    def _next(self):
        self._clear()
        self._revealed = False
        if not self.queue:
            ctk.CTkLabel(self.card, text="🎉  All caught up!", text_color=theme.SECONDARY,
                         font=theme.f(22, "bold")).grid(row=0, column=0, pady=(60, 8))
            ctk.CTkLabel(self.card, text="No cards due for review. Add cards or import from "
                         "flashcards.", text_color=theme.MUTED, font=theme.f(13)).grid(
                row=1, column=0)
            return
        self.current = self.queue[0]
        ctk.CTkLabel(self.card, text=self.current.front, text_color=theme.FG, justify="center",
                     wraplength=760, font=theme.f(20, "bold")).grid(row=0, column=0, padx=30,
                                                                    pady=(50, 10))
        self.answer_lbl = ctk.CTkLabel(self.card, text="", text_color=theme.SECONDARY,
                                       justify="center", wraplength=760, font=theme.f(16))
        self.answer_lbl.grid(row=1, column=0, padx=30)

        self.action = ctk.CTkFrame(self.card, fg_color="transparent")
        self.action.grid(row=2, column=0, pady=24)
        self.reveal_btn = ctk.CTkButton(self.action, text="Show answer", width=160, height=44,
                                        fg_color=theme.PRIMARY, hover_color=theme.PRIMARY_HOVER,
                                        font=theme.f(14, "bold"), command=self._reveal)
        self.reveal_btn.pack()

    def _reveal(self):
        self._revealed = True
        self.answer_lbl.configure(text=self.current.back)
        for w in self.action.winfo_children():
            w.destroy()
        ctk.CTkLabel(self.action, text="How well did you recall it?", text_color=theme.MUTED,
                     font=theme.f(12)).pack(pady=(0, 8))
        row = ctk.CTkFrame(self.action, fg_color="transparent")
        row.pack()
        for label, q, color in GRADES:
            ctk.CTkButton(row, text=label, width=90, height=42, fg_color=color,
                          font=theme.f(13, "bold"),
                          command=lambda q=q: self._grade(q)).pack(side="left", padx=6)

    def _grade(self, quality: int):
        review.grade(self.current.id, quality)
        self.queue.pop(0)
        if quality < 3:  # "Again" → requeue at the end of this session
            self.queue.append(self.current)
        self._refresh_count()
        self._next()

    def _import(self):
        n = review.generate_from_flashcards()
        self.queue = review.due_items()
        self._refresh_count()
        self._next()
        self.count_lbl.configure(text=self.count_lbl.cget("text") + f"  (+{n} imported)")

    def _add(self):
        top = ctk.CTkToplevel(self)
        top.title("Add review card")
        top.geometry("420x260")
        top.configure(fg_color=theme.CARD)
        ctk.CTkLabel(top, text="Front (question)", text_color=theme.MUTED).pack(anchor="w", padx=16, pady=(14, 2))
        front = ctk.CTkEntry(top, fg_color=theme.CARD2, border_width=0)
        front.pack(fill="x", padx=16)
        ctk.CTkLabel(top, text="Back (answer)", text_color=theme.MUTED).pack(anchor="w", padx=16, pady=(10, 2))
        back = ctk.CTkTextbox(top, height=90, fg_color=theme.CARD2)
        back.pack(fill="x", padx=16)

        def save():
            f = front.get().strip(); b = back.get("1.0", "end").strip()
            if f and b:
                review.add_item(f, b, "manual")
            top.destroy()
            self.on_show()
        ctk.CTkButton(top, text="Add", fg_color=theme.SECONDARY, command=save).pack(pady=12)
