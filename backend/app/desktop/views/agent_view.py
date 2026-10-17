"""Agent view — the autonomous assistant chat with live tool activity."""
from __future__ import annotations

import threading

import customtkinter as ctk

from ... import db
from ...agent import core, personas
from ...voice import tts
from .. import theme


class AgentView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.history: list[dict] = []
        self._cur_bubble: ctk.CTkLabel | None = None
        self._cur_text = ""
        self._busy = False
        self.persona = "assistant"
        self._plan_mode = False
        self._persona_by_label = {f"{p.icon} {p.name}": p.key for p in personas.all()}

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # header
        head = ctk.CTkFrame(self, fg_color=theme.BG, height=54)
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 4))
        ctk.CTkLabel(head, text="Chat", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")

        # pre-built agent (persona) selector — the "mode" of the chat
        labels = list(self._persona_by_label.keys())
        self.mode_menu = ctk.CTkOptionMenu(
            head, values=labels, width=180, fg_color=theme.CARD2,
            button_color=theme.CARD2, font=theme.f(13), command=self._on_mode)
        self.mode_menu.set(labels[0])
        self.mode_menu.pack(side="left", padx=16)

        self.tts_var = ctk.BooleanVar(value=False)
        ctk.CTkSwitch(head, text="🔊 Speak", variable=self.tts_var,
                      progress_color=theme.SECONDARY, font=theme.f(12),
                      text_color=theme.MUTED).pack(side="right")
        self.plan_var = ctk.BooleanVar(value=False)
        ctk.CTkSwitch(head, text="🧭 Plan mode", variable=self.plan_var,
                      progress_color=theme.PRIMARY, font=theme.f(12),
                      text_color=theme.MUTED, command=self._on_plan).pack(side="right", padx=12)

        # chat scroll area
        self.scroll = ctk.CTkScrollableFrame(self, fg_color=theme.BG)
        self.scroll.grid(row=1, column=0, sticky="nsew", padx=12)
        self.scroll.grid_columnconfigure(0, weight=1)

        self._welcome()

        # composer
        comp = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        comp.grid(row=2, column=0, sticky="ew", padx=24, pady=16)
        comp.grid_columnconfigure(0, weight=1)
        self.entry = ctk.CTkTextbox(comp, height=56, fg_color=theme.CARD,
                                    text_color=theme.FG, font=theme.f(14),
                                    border_width=0, wrap="word")
        self.entry.grid(row=0, column=0, sticky="ew", padx=(12, 6), pady=8)
        self.entry.bind("<Return>", self._on_return)
        self.entry.bind("<Shift-Return>", lambda e: None)

        btns = ctk.CTkFrame(comp, fg_color="transparent")
        btns.grid(row=0, column=1, padx=(0, 10))
        self.mic_btn = ctk.CTkButton(btns, text="🎙", width=44, height=44,
                                     fg_color=theme.CARD2, hover_color=theme.BORDER,
                                     command=self._voice_input)
        self.mic_btn.pack(side="left", padx=(0, 6))
        self.send_btn = ctk.CTkButton(btns, text="Send ➤", width=90, height=44,
                                      fg_color=theme.PRIMARY, hover_color=theme.PRIMARY_HOVER,
                                      font=theme.f(14, "bold"), command=self.send)
        self.send_btn.pack(side="left")

    # -- bubbles -----------------------------------------------------------
    def _welcome(self):
        self._add_bubble(
            "assistant",
            "Hi — I'm your local, offline agent. I can run commands, read & write "
            "files, generate PDFs/decks/spreadsheets, analyse images, take notes, and "
            "remember things — all on this machine. What should we do?")

    def _add_bubble(self, role: str, text: str) -> ctk.CTkLabel:
        row = ctk.CTkFrame(self.scroll, fg_color="transparent")
        row.grid(sticky="ew", padx=12, pady=6)
        row.grid_columnconfigure(0, weight=1)
        is_user = role == "user"
        bubble = ctk.CTkFrame(
            row, fg_color=theme.PRIMARY if is_user else theme.CARD,
            corner_radius=theme.RADIUS)
        bubble.grid(row=0, column=0, sticky="e" if is_user else "w")
        lbl = ctk.CTkLabel(
            bubble, text=text, justify="left", wraplength=720,
            text_color="#ffffff" if is_user else theme.FG, font=theme.f(14))
        lbl.pack(padx=14, pady=10, anchor="w")
        self._scroll_bottom()
        return lbl

    def _add_chip(self, text: str, color: str):
        row = ctk.CTkFrame(self.scroll, fg_color="transparent")
        row.grid(sticky="ew", padx=24, pady=1)
        row.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(row, text=text, justify="left", wraplength=700,
                     text_color=color, font=theme.mono(11)).grid(sticky="w")
        self._scroll_bottom()

    def _scroll_bottom(self):
        self.after(30, lambda: self.scroll._parent_canvas.yview_moveto(1.0))

    # -- send flow ---------------------------------------------------------
    def _on_return(self, event):
        if event.state & 0x1:  # shift held → newline
            return
        self.send()
        return "break"

    def send(self):
        if self._busy:
            return
        text = self.entry.get("1.0", "end").strip()
        if not text:
            return
        self.entry.delete("1.0", "end")
        self._add_bubble("user", text)
        self._pending_user = text
        self._busy = True
        self.send_btn.configure(state="disabled", text="…")
        self._cur_text = ""
        self._cur_bubble = self._add_bubble("assistant", "▍")
        threading.Thread(target=self._run, args=(text,), daemon=True).start()

    def set_persona(self, key: str):
        """Programmatically switch the chat to a persona (used by the Connectors hub)."""
        p = personas.get(key)
        label = f"{p.icon} {p.name}"
        if label in self._persona_by_label:
            self.mode_menu.set(label)
        self._on_mode(label)

    def _on_mode(self, label: str):
        self.persona = self._persona_by_label.get(label, "assistant")
        p = personas.get(self.persona)
        if not p.use_tools and self.plan_var.get():
            self.plan_var.deselect(); self._plan_mode = False
        self._add_chip(f"— switched to {p.icon} {p.name} mode — {p.description}", theme.GOLD)

    def _on_plan(self):
        self._plan_mode = bool(self.plan_var.get())
        msg = ("🧭 Plan mode ON — I'll break goals into steps and execute them."
               if self._plan_mode else "Plan mode off.")
        self._add_chip(msg, theme.PRIMARY if self._plan_mode else theme.MUTED)

    def _run(self, text: str):
        def emit(kind, **k):
            self.app.after(0, lambda: self._on_event(kind, k))
        try:
            if self._plan_mode:
                from ...agent import planner
                answer = planner.run(text, emit=emit, approver=self.app.approve)
            else:
                answer = core.run(text, history=self.history, emit=emit,
                                  approver=self.app.approve, persona=self.persona)
        except Exception as e:
            self.app.after(0, lambda: self._finish(f"⚠ error: {e}"))
            return
        self.app.after(0, lambda: self._finish(answer))

    def _on_event(self, kind: str, k: dict):
        if kind == "token":
            self._cur_text += k.get("text", "")
            if self._cur_bubble:
                self._cur_bubble.configure(text=self._cur_text + " ▍")
                self._scroll_bottom()
        elif kind == "tool_call":
            args = str(k.get("args", ""))[:120]
            self._add_chip(f"→ {k['name']}  {args}", theme.BLUE)
        elif kind == "tool_result":
            res = str(k.get("result", "")).replace("\n", " ")[:160]
            self._add_chip(f"✓ {k['name']}  {res}", theme.SECONDARY)
        elif kind == "denied":
            self._add_chip(f"✗ denied {k['name']}", theme.PRIMARY)
        elif kind == "plan":
            steps = k.get("steps", [])
            self._add_chip("🧭 Plan:\n" + "\n".join(f"  {i}. {s}" for i, s in enumerate(steps, 1)),
                           theme.GOLD)
        elif kind == "plan_step":
            self._add_chip(f"▶ step {k['n']}/{k['total']}: {k['step']}", theme.PRIMARY)
            self._cur_text = ""
            self._cur_bubble = self._add_bubble("assistant", "▍")
        elif kind == "plan_done":
            pass

    def _finish(self, answer: str):
        if self._cur_bubble:
            self._cur_bubble.configure(text=answer or "(no response)")
        self.history.append({"role": "user", "content": getattr(self, "_pending_user", "")})
        self.history.append({"role": "assistant", "content": answer})
        self.history = self.history[-16:]
        self._busy = False
        self.send_btn.configure(state="normal", text="Send ➤")
        if self.tts_var.get() and answer:
            threading.Thread(target=tts.speak, args=(answer,), daemon=True).start()

    # -- voice input -------------------------------------------------------
    def _voice_input(self):
        from ...voice import stt
        if not stt.available():
            self._add_chip("Voice input needs faster-whisper (installed).", theme.MUTED)
            return
        self.mic_btn.configure(text="●", text_color=theme.PRIMARY)
        self._add_chip("🎙 recording 4s… speak now", theme.MUTED)
        threading.Thread(target=self._record_and_transcribe, daemon=True).start()

    def _record_and_transcribe(self):
        from ..widgets.recorder import record_wav
        try:
            path = record_wav(seconds=4)
            from ...voice import stt
            text = stt.transcribe(path)
        except Exception as e:
            text = ""
            self.app.after(0, lambda: self._add_chip(f"voice error: {e}", theme.PRIMARY))
        self.app.after(0, lambda: self._after_voice(text))

    def _after_voice(self, text: str):
        self.mic_btn.configure(text="🎙", text_color=theme.FG)
        if text:
            self.entry.insert("end", text)
