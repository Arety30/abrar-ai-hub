"""Meeting room — local webcam, live transcript, and an AI participant you can
talk to. Everything runs offline: camera via OpenCV, speech via Whisper/pyttsx3,
brains via Ollama.
"""
from __future__ import annotations

import threading
import time

import customtkinter as ctk

from ...providers import ollama
from ...voice import tts
from .. import theme


class MeetingView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self._cap = None
        self._cam_on = False
        self._ctk_img = None

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=2)

        ctk.CTkLabel(self, text="Meeting Room", text_color=theme.FG, font=theme.f(20, "bold")
                     ).grid(row=0, column=0, columnspan=2, sticky="w", padx=24, pady=(16, 8))

        # video stage
        stage = ctk.CTkFrame(self, fg_color="#000000", corner_radius=theme.RADIUS)
        stage.grid(row=1, column=0, sticky="nsew", padx=(24, 12), pady=(0, 16))
        stage.grid_rowconfigure(0, weight=1)
        stage.grid_columnconfigure(0, weight=1)
        self.video = ctk.CTkLabel(stage, text="📷  Camera off", text_color=theme.MUTED,
                                  font=theme.f(15))
        self.video.grid(row=0, column=0, sticky="nsew")
        ctrl = ctk.CTkFrame(stage, fg_color="transparent")
        ctrl.grid(row=1, column=0, pady=10)
        self.cam_btn = ctk.CTkButton(ctrl, text="Start camera", fg_color=theme.SECONDARY,
                                     hover_color=theme.SECONDARY_HOVER, command=self._toggle_cam)
        self.cam_btn.pack(side="left", padx=6)
        ctk.CTkButton(ctrl, text="🎙 Talk to AI", fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._talk).pack(side="left", padx=6)

        # transcript + AI chat
        side = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        side.grid(row=1, column=1, sticky="nsew", padx=(0, 24), pady=(0, 16))
        side.grid_rowconfigure(1, weight=1)
        side.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(side, text="LIVE TRANSCRIPT · Lumina (AI)", text_color=theme.MUTED,
                     font=theme.f(11, "bold")).grid(row=0, column=0, sticky="w", padx=14, pady=(12, 4))
        self.log = ctk.CTkTextbox(side, fg_color=theme.CARD2, text_color=theme.FG,
                                  font=theme.f(12), wrap="word")
        self.log.grid(row=1, column=0, sticky="nsew", padx=12, pady=6)
        self.log.configure(state="disabled")

        # shared-notes / note-sharing action bar
        share = ctk.CTkFrame(side, fg_color="transparent")
        share.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 4))
        ctk.CTkButton(share, text="📝 AI Minutes", width=104, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, font=theme.f(11),
                      command=self._ai_minutes).pack(side="left", padx=2)
        ctk.CTkButton(share, text="💾 To Vault", width=90, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, font=theme.f(11),
                      command=self._save_to_vault).pack(side="left", padx=2)
        ctk.CTkButton(share, text="⬇ Export", width=84, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, font=theme.f(11),
                      command=self._export).pack(side="left", padx=2)

        row = ctk.CTkFrame(side, fg_color="transparent")
        row.grid(row=3, column=0, sticky="ew", padx=12, pady=(0, 12))
        row.grid_columnconfigure(0, weight=1)
        self.entry = ctk.CTkEntry(row, placeholder_text="Message the AI participant…",
                                  fg_color=theme.CARD2, border_width=0)
        self.entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.entry.bind("<Return>", lambda e: self._send())
        ctk.CTkButton(row, text="Send", width=70, fg_color=theme.PRIMARY,
                      hover_color=theme.PRIMARY_HOVER, command=self._send).grid(row=0, column=1)

    # -- transcript --------------------------------------------------------
    def _append(self, speaker: str, text: str, color: str):
        self.log.configure(state="normal")
        self.log.insert("end", f"{speaker}: ", ("spk",))
        self.log.insert("end", text + "\n\n")
        self.log.tag_config("spk", foreground=color)
        self.log.see("end")
        self.log.configure(state="disabled")

    # -- AI participant ----------------------------------------------------
    def _send(self):
        text = self.entry.get().strip()
        if not text:
            return
        self.entry.delete(0, "end")
        self._append("You", text, theme.SECONDARY)
        threading.Thread(target=self._ai_reply, args=(text,), daemon=True).start()

    def _ai_reply(self, text: str):
        try:
            prompt = ("You are Lumina, a concise AI participant in a live meeting. "
                      f"Respond briefly and helpfully.\n\nParticipant said: {text}")
            reply = ollama.generate(prompt, role="general")
        except Exception as e:
            reply = f"(offline error: {e})"
        self.app.after(0, lambda: self._append("Lumina", reply, theme.PRIMARY))
        threading.Thread(target=tts.speak, args=(reply,), daemon=True).start()

    def _talk(self):
        from ..widgets.recorder import available, record_wav
        if not available():
            self._append("System", "Mic capture unavailable (need sounddevice).", theme.MUTED)
            return
        self._append("System", "🎙 listening 4s…", theme.MUTED)

        def worker():
            try:
                path = record_wav(4)
                from ...voice import stt
                text = stt.transcribe(path)
            except Exception as e:
                text = ""
                self.app.after(0, lambda: self._append("System", f"error: {e}", theme.MUTED))
            if text:
                self.app.after(0, lambda: (self._append("You", text, theme.SECONDARY),
                                           threading.Thread(target=self._ai_reply,
                                                            args=(text,), daemon=True).start()))
        threading.Thread(target=worker, daemon=True).start()

    # -- note sharing --------------------------------------------------------
    def _transcript_text(self) -> str:
        self.log.configure(state="normal")
        text = self.log.get("1.0", "end").strip()
        self.log.configure(state="disabled")
        return text

    def _ai_minutes(self):
        """Turn the live transcript into structured meeting minutes with a local model."""
        transcript = self._transcript_text()
        if not transcript:
            self._append("System", "Nothing in the transcript yet.", theme.MUTED)
            return
        self._append("System", "📝 generating minutes…", theme.MUTED)

        def worker():
            prompt = ("Turn this meeting transcript into concise minutes with three "
                      "sections: Summary, Decisions, Action Items (checkbox list).\n\n"
                      f"TRANSCRIPT:\n{transcript[:6000]}")
            try:
                minutes = ollama.generate(prompt, role="general")
            except Exception as e:
                minutes = f"(error: {e})"
            self._minutes = minutes
            self.app.after(0, lambda: self._append("Minutes", minutes, theme.GOLD))
        threading.Thread(target=worker, daemon=True).start()

    def _save_to_vault(self):
        """Share the meeting notes into the Notes vault (and thus the knowledge graph)."""
        from datetime import datetime
        from sqlmodel import select
        from ... import db
        from ...models import Note, Meeting

        content = getattr(self, "_minutes", "") or self._transcript_text()
        if not content:
            self._append("System", "Nothing to save yet.", theme.MUTED)
            return
        stamp = datetime.now()
        name = f"Meeting {stamp:%Y-%m-%d %H%M}.md"
        body = (f"# Meeting notes — {stamp:%A %d %B %Y, %H:%M}\n\n"
                f"{content}\n\n---\nLinked: [[Meetings]]\n")
        with db.get_session() as s:
            s.add(Note(name=name, content=body, tags="meeting,shared"))
            # index note under a Meeting record too
            s.add(Meeting(title=name.replace(".md", ""),
                          scheduled_for=stamp.isoformat(timespec="minutes"),
                          notes=content[:2000]))
            # ensure the hub note all meetings link to exists
            if not s.exec(select(Note).where(Note.name == "Meetings.md")).first():
                s.add(Note(name="Meetings.md",
                           content="# Meetings\nHub note — every shared meeting links here.",
                           tags="meeting"))
            s.commit()
        self._append("System", f"💾 shared to vault as “{name}” (visible in Notes & Graph)",
                     theme.SECONDARY)

    def _export(self):
        """Export shared notes as Markdown + PDF into the workspace folder."""
        from datetime import datetime
        from ...agent.safety import workspace_out

        content = getattr(self, "_minutes", "") or self._transcript_text()
        if not content:
            self._append("System", "Nothing to export yet.", theme.MUTED)
            return
        stamp = datetime.now()
        base = f"meeting_{stamp:%Y%m%d_%H%M}"
        md_path = workspace_out(base + ".md")
        md_path.write_text(f"# Meeting notes — {stamp:%d %B %Y %H:%M}\n\n{content}\n",
                           encoding="utf-8")
        try:
            from ...agent.tools.doc_tools import create_pdf
            create_pdf(base + ".pdf", f"Meeting notes — {stamp:%d %B %Y}", content)
            msg = f"⬇ exported {md_path.name} + {base}.pdf to workspace/"
        except Exception as e:
            msg = f"⬇ exported {md_path.name} (PDF failed: {e})"
        self._append("System", msg, theme.SECONDARY)

    # -- camera ------------------------------------------------------------
    def _toggle_cam(self):
        if self._cam_on:
            self._cam_on = False
            self.cam_btn.configure(text="Start camera", fg_color=theme.SECONDARY)
            if self._cap:
                self._cap.release()
                self._cap = None
            self.video.configure(image=None, text="📷  Camera off")
            return
        try:
            import cv2
            self._cap = cv2.VideoCapture(0)
            if not self._cap.isOpened():
                raise RuntimeError("no camera")
        except Exception as e:
            self.video.configure(text=f"Camera unavailable: {e}")
            return
        self._cam_on = True
        self.cam_btn.configure(text="Stop camera", fg_color=theme.PRIMARY)
        threading.Thread(target=self._cam_loop, daemon=True).start()

    def _cam_loop(self):
        import cv2
        from PIL import Image
        while self._cam_on and self._cap:
            ok, frame = self._cap.read()
            if not ok:
                break
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(frame)
            self.app.after(0, lambda im=img: self._show_frame(im))
            time.sleep(1 / 20)

    def _show_frame(self, img):
        if not self._cam_on:
            return
        w = max(self.video.winfo_width(), 320)
        h = max(self.video.winfo_height(), 240)
        img = img.copy()
        img.thumbnail((w, h))
        self._ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=img.size)
        self.video.configure(image=self._ctk_img, text="")

    def destroy(self):
        self._cam_on = False
        if self._cap:
            self._cap.release()
        super().destroy()
