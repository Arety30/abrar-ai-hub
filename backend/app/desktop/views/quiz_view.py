"""Quiz view — generate MCQ quizzes from your study material and take them."""
from __future__ import annotations

import threading

import customtkinter as ctk

from ...agent import quiz
from .. import theme


class QuizView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.questions: list[dict] = []
        self.idx = 0
        self.score = 0
        self._answered = False

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # setup bar
        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(bar, text="🧠  Quiz", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        self.source_menu = ctk.CTkOptionMenu(bar, values=["All material"], width=180,
                                              fg_color=theme.CARD2, button_color=theme.CARD2)
        self.source_menu.pack(side="left", padx=12)
        self.count_menu = ctk.CTkOptionMenu(bar, values=["3", "5", "8"], width=64,
                                            fg_color=theme.CARD2, button_color=theme.CARD2)
        self.count_menu.set("5")
        self.count_menu.pack(side="left", padx=(0, 6))
        self.type_menu = ctk.CTkOptionMenu(bar, values=["mcq", "open", "mixed"], width=90,
                                           fg_color=theme.CARD2, button_color=theme.CARD2)
        self.type_menu.set("mcq")
        self.type_menu.pack(side="left")
        self.gen_btn = ctk.CTkButton(bar, text="Generate quiz", fg_color=theme.PRIMARY,
                                     hover_color=theme.PRIMARY_HOVER, font=theme.f(13, "bold"),
                                     command=self._generate)
        self.gen_btn.pack(side="left", padx=12)
        self.hist_lbl = ctk.CTkLabel(bar, text="", text_color=theme.MUTED, font=theme.f(11))
        self.hist_lbl.pack(side="right")

        # card area
        self.card = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        self.card.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 16))
        self.card.grid_columnconfigure(0, weight=1)
        self._show_idle("Pick a source and hit Generate quiz to begin.")

    def on_show(self):
        self.source_menu.configure(values=quiz.sources())
        self._refresh_history()

    def _refresh_history(self):
        h = quiz.history()
        if h:
            best = max((a.score / a.total) for a in h if a.total) if any(a.total for a in h) else 0
            self.hist_lbl.configure(text=f"attempts: {len(h)} · best {best*100:.0f}%")

    def _clear(self):
        for w in self.card.winfo_children():
            w.destroy()

    def _show_idle(self, msg: str):
        self._clear()
        ctk.CTkLabel(self.card, text=msg, text_color=theme.MUTED,
                     font=theme.f(14)).grid(row=0, column=0, padx=30, pady=40)

    # -- generation --------------------------------------------------------
    def _generate(self):
        self._show_idle("⏳ generating quiz from your material…")
        self.gen_btn.configure(state="disabled")
        src = self.source_menu.get()
        n = int(self.count_menu.get())
        qtype = self.type_menu.get()

        def worker():
            qs = quiz.generate(src, n, qtype)
            self.app.after(0, lambda: self._start(qs))
        threading.Thread(target=worker, daemon=True).start()

    def _start(self, qs: list[dict]):
        self.gen_btn.configure(state="normal")
        if not qs:
            self._show_idle("Couldn't generate a quiz — add richer study sources and retry.")
            return
        self.questions = qs
        self.idx = 0
        self.score = 0
        self._render_question()

    # -- taking ------------------------------------------------------------
    def _render_question(self):
        self._clear()
        self._answered = False
        q = self.questions[self.idx]
        ctk.CTkLabel(self.card, text=f"Question {self.idx+1} of {len(self.questions)}   ·   "
                     f"score {self.score}", text_color=theme.MUTED,
                     font=theme.f(11, "bold")).grid(row=0, column=0, sticky="w", padx=20, pady=(16, 2))
        ctk.CTkLabel(self.card, text=q["question"], text_color=theme.FG, justify="left",
                     wraplength=760, font=theme.f(17, "bold")).grid(row=1, column=0, sticky="w",
                                                                    padx=20, pady=(4, 14))
        if q.get("type") == "open":
            self._render_open(q)
            return
        self.opt_btns = []
        for i, opt in enumerate(q["options"]):
            b = ctk.CTkButton(self.card, text=f"{chr(65+i)}.  {opt}", anchor="w",
                              fg_color=theme.CARD2, hover_color=theme.BORDER, text_color=theme.FG,
                              font=theme.f(14), height=44,
                              command=lambda i=i: self._answer(i))
            b.grid(row=2 + i, column=0, sticky="ew", padx=20, pady=4)
            self.opt_btns.append(b)
        self.feedback = ctk.CTkLabel(self.card, text="", text_color=theme.MUTED,
                                     justify="left", wraplength=760, font=theme.f(12))
        self.feedback.grid(row=7, column=0, sticky="w", padx=20, pady=(10, 6))
        self.next_btn = ctk.CTkButton(self.card, text="Next ➤", fg_color=theme.SECONDARY,
                                      hover_color=theme.SECONDARY_HOVER, state="disabled",
                                      command=self._next)
        self.next_btn.grid(row=8, column=0, sticky="e", padx=20, pady=(4, 16))

    def _answer(self, choice: int):
        if self._answered:
            return
        self._answered = True
        q = self.questions[self.idx]
        correct = q["answer"]
        for i, b in enumerate(self.opt_btns):
            if i == correct:
                b.configure(fg_color=theme.SECONDARY)
            elif i == choice:
                b.configure(fg_color=theme.PRIMARY)
            b.configure(state="disabled")
        if choice == correct:
            self.score += 1
            verdict = "✓ Correct!"
        else:
            verdict = f"✗ Correct answer: {chr(65+correct)}"
        self.feedback.configure(text=f"{verdict}  {q.get('explanation','')}",
                                text_color=theme.FG)
        self.next_btn.configure(
            state="normal",
            text="See results ➤" if self.idx == len(self.questions) - 1 else "Next ➤")

    def _render_open(self, q):
        self.answer_box = ctk.CTkTextbox(self.card, height=90, fg_color=theme.CARD2,
                                         text_color=theme.FG, font=theme.f(14), wrap="word")
        self.answer_box.grid(row=2, column=0, sticky="ew", padx=20, pady=4)
        self.feedback = ctk.CTkLabel(self.card, text="", text_color=theme.MUTED,
                                     justify="left", wraplength=760, font=theme.f(12))
        self.feedback.grid(row=3, column=0, sticky="w", padx=20, pady=(8, 4))
        self.submit_btn = ctk.CTkButton(self.card, text="Submit answer", fg_color=theme.PRIMARY,
                                        hover_color=theme.PRIMARY_HOVER, command=self._submit_open)
        self.submit_btn.grid(row=4, column=0, sticky="e", padx=20, pady=(4, 8))
        self.next_btn = ctk.CTkButton(self.card, text="Next ➤", fg_color=theme.SECONDARY,
                                      hover_color=theme.SECONDARY_HOVER, state="disabled",
                                      command=self._next)
        self.next_btn.grid(row=5, column=0, sticky="e", padx=20, pady=(0, 16))

    def _submit_open(self):
        if self._answered:
            return
        user = self.answer_box.get("1.0", "end").strip()
        if not user:
            return
        self._answered = True
        self.submit_btn.configure(state="disabled", text="grading…")
        q = self.questions[self.idx]

        def worker():
            result = quiz.grade_open(q["question"], q.get("answer", ""), user)
            self.app.after(0, lambda: self._open_result(q, result))
        threading.Thread(target=worker, daemon=True).start()

    def _open_result(self, q, result):
        pct = int(result["score"] * 100)
        if result["correct"]:
            self.score += 1
            head = f"✓ {pct}% — {result['feedback']}"
            col = theme.SECONDARY
        else:
            head = f"✗ {pct}% — {result['feedback']}"
            col = theme.PRIMARY
        self.feedback.configure(text=f"{head}\n\nReference: {q.get('answer','')}", text_color=theme.FG)
        self.submit_btn.configure(text="submitted")
        self.next_btn.configure(
            state="normal",
            text="See results ➤" if self.idx == len(self.questions) - 1 else "Next ➤")

    def _next(self):
        if self.idx < len(self.questions) - 1:
            self.idx += 1
            self._render_question()
        else:
            self._finish()

    def _finish(self):
        total = len(self.questions)
        quiz.save_attempt(self.source_menu.get(), self.score, total)
        self._refresh_history()
        self._clear()
        pct = self.score / total * 100 if total else 0
        ctk.CTkLabel(self.card, text=f"{self.score} / {total}", text_color=theme.PRIMARY,
                     font=theme.f(40, "bold")).grid(row=0, column=0, pady=(50, 6))
        msg = ("Outstanding!" if pct >= 80 else "Good effort — review and retry!"
               if pct >= 50 else "Keep studying — you've got this.")
        ctk.CTkLabel(self.card, text=f"{pct:.0f}%  ·  {msg}", text_color=theme.FG,
                     font=theme.f(16)).grid(row=1, column=0, pady=4)
        ctk.CTkButton(self.card, text="New quiz", fg_color=theme.SECONDARY,
                      hover_color=theme.SECONDARY_HOVER, command=self._generate).grid(
            row=2, column=0, pady=20)
