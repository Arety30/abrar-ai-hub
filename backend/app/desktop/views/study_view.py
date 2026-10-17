"""Study view — offline NotebookLM: sources, grounded Q&A, summaries, flashcards."""
from __future__ import annotations

import json
import threading

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import Document, Flashcard
from ...providers import ollama
from .. import theme


class StudyView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.selected: Document | None = None

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(self, text="Study", text_color=theme.FG, font=theme.f(20, "bold")
                     ).grid(row=0, column=0, columnspan=2, sticky="w", padx=24, pady=(16, 8))

        # left: sources
        left = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS, width=280)
        left.grid(row=1, column=0, sticky="nsew", padx=(24, 12), pady=(0, 16))
        left.grid_propagate(False)
        ctk.CTkLabel(left, text="SOURCES", text_color=theme.MUTED, font=theme.f(11, "bold")
                     ).pack(anchor="w", padx=14, pady=(12, 4))
        ctk.CTkButton(left, text="+ Add source", fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._add_source).pack(
            fill="x", padx=12, pady=(0, 8))
        self.src_list = ctk.CTkScrollableFrame(left, fg_color="transparent")
        self.src_list.pack(fill="both", expand=True, padx=6)

        # right: reader + tools
        right = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        right.grid(row=1, column=1, sticky="nsew", padx=(0, 24), pady=(0, 16))
        right.grid_rowconfigure(1, weight=1)
        right.grid_columnconfigure(0, weight=1)
        self.title_lbl = ctk.CTkLabel(right, text="Select a source", text_color=theme.FG,
                                      font=theme.f(16, "bold"))
        self.title_lbl.grid(row=0, column=0, sticky="w", padx=16, pady=(12, 4))
        self.reader = ctk.CTkTextbox(right, fg_color=theme.CARD2, text_color=theme.FG,
                                     font=theme.f(13), wrap="word")
        self.reader.grid(row=1, column=0, sticky="nsew", padx=16, pady=6)

        tools = ctk.CTkFrame(right, fg_color="transparent")
        tools.grid(row=2, column=0, sticky="ew", padx=16, pady=8)
        for txt, fn in (("Summarize", self._summarize), ("Flashcards", self._flashcards),
                        ("Action items", self._actions)):
            ctk.CTkButton(tools, text=txt, fg_color=theme.CARD2, hover_color=theme.BORDER,
                          width=110, command=fn).pack(side="left", padx=(0, 8))

        ask = ctk.CTkFrame(right, fg_color="transparent")
        ask.grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 14))
        ask.grid_columnconfigure(0, weight=1)
        self.q = ctk.CTkEntry(ask, placeholder_text="Ask a question about this source…",
                              fg_color=theme.CARD2, border_width=0)
        self.q.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.q.bind("<Return>", lambda e: self._ask())
        ctk.CTkButton(ask, text="Ask", width=80, fg_color=theme.PRIMARY,
                      hover_color=theme.PRIMARY_HOVER, command=self._ask).grid(row=0, column=1)

    def on_show(self):
        self._refresh_sources()

    # -- data --------------------------------------------------------------
    def _refresh_sources(self):
        for w in self.src_list.winfo_children():
            w.destroy()
        with db.get_session() as s:
            docs = s.exec(select(Document).order_by(Document.id.desc())).all()
        for d in docs:
            b = ctk.CTkButton(self.src_list, text=f"{d.title}\n{d.word_count} words",
                              anchor="w", fg_color="transparent", hover_color=theme.CARD2,
                              text_color=theme.FG, font=theme.f(12),
                              command=lambda x=d: self._open(x))
            b.pack(fill="x", pady=2)

    def _add_source(self):
        dlg = ctk.CTkInputDialog(text="Source title:", title="Add source")
        title = dlg.get_input()
        if not title:
            return
        # ask for content in a second window
        top = ctk.CTkToplevel(self)
        top.title("Paste content")
        top.geometry("560x420")
        top.configure(fg_color=theme.CARD)
        box = ctk.CTkTextbox(top, fg_color=theme.CARD2, text_color=theme.FG)
        box.pack(fill="both", expand=True, padx=12, pady=12)

        def save():
            content = box.get("1.0", "end").strip()
            with db.get_session() as s:
                s.add(Document(title=title, content=content,
                               word_count=len(content.split())))
                s.commit()
            top.destroy()
            self._refresh_sources()
        ctk.CTkButton(top, text="Save source", fg_color=theme.SECONDARY,
                      command=save).pack(pady=(0, 12))

    def _open(self, doc: Document):
        self.selected = doc
        self.title_lbl.configure(text=doc.title)
        self.reader.delete("1.0", "end")
        self.reader.insert("1.0", doc.content)

    # -- AI (local) --------------------------------------------------------
    def _need_doc(self) -> bool:
        if not self.selected:
            self.title_lbl.configure(text="⚠ Select a source first")
            return False
        return True

    def _run_ai(self, prompt: str, label: str):
        self.reader.delete("1.0", "end")
        self.reader.insert("1.0", f"⏳ {label}…")

        def worker():
            try:
                out = ollama.generate(prompt, role="general")
            except Exception as e:
                out = f"Error: {e}"
            self.app.after(0, lambda: self._show_ai(out))
        threading.Thread(target=worker, daemon=True).start()

    def _show_ai(self, text: str):
        self.reader.delete("1.0", "end")
        self.reader.insert("1.0", text)

    def _summarize(self):
        if not self._need_doc():
            return
        self._run_ai(f"Summarize the following study material into a concise study guide "
                     f"with headings and bullet points:\n\n{self.selected.content[:6000]}",
                     "summarizing")

    def _actions(self):
        if not self._need_doc():
            return
        self._run_ai(f"Extract a checklist of concrete action items from this material:\n\n"
                     f"{self.selected.content[:6000]}", "extracting action items")

    def _ask(self):
        if not self._need_doc():
            return
        question = self.q.get().strip()
        if not question:
            return
        self.q.delete(0, "end")
        self._run_ai(f"Using ONLY this source, answer the question.\n\nSOURCE:\n"
                     f"{self.selected.content[:6000]}\n\nQUESTION: {question}", "thinking")

    def _flashcards(self):
        if not self._need_doc():
            return
        self.reader.delete("1.0", "end")
        self.reader.insert("1.0", "⏳ generating flashcards…")

        def worker():
            prompt = (f'Create 6 study flashcards from this material. Reply ONLY with a JSON '
                      f'array of objects with "question" and "answer" keys.\n\n'
                      f'{self.selected.content[:6000]}')
            try:
                raw = ollama.generate(prompt, role="general")
                start, end = raw.find("["), raw.rfind("]")
                cards = json.loads(raw[start:end + 1]) if start >= 0 else []
            except Exception:
                cards = []
            self.app.after(0, lambda: self._show_cards(cards))
        threading.Thread(target=worker, daemon=True).start()

    def _show_cards(self, cards: list):
        self.reader.delete("1.0", "end")
        if not cards:
            self.reader.insert("1.0", "Could not parse flashcards. Try again.")
            return
        with db.get_session() as s:
            for c in cards:
                s.add(Flashcard(document_id=self.selected.id,
                                question=c.get("question", ""), answer=c.get("answer", "")))
            s.commit()
        text = "\n\n".join(f"Q{i+1}: {c.get('question','')}\nA: {c.get('answer','')}"
                           for i, c in enumerate(cards))
        self.reader.insert("1.0", text)
