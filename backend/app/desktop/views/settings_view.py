"""Settings — model assignments, agent access mode, workspace, voice warmup."""
from __future__ import annotations

import json
import threading

import customtkinter as ctk

from ... import db
from ...config import WORKSPACE_DIR, DATA_DIR, OFFLINE_ONLY
from ...providers import ollama
from .. import theme

ROLES = [("general", "General chat"), ("tools", "Tool-calling"), ("coder", "Coding"),
         ("reasoner", "Reasoning"), ("vision", "Vision")]


class SettingsView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(self, text="Settings", text_color=theme.FG, font=theme.f(20, "bold")
                     ).grid(row=0, column=0, sticky="w", padx=24, pady=(16, 8))

        body = ctk.CTkScrollableFrame(self, fg_color="transparent")
        body.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 16))
        body.grid_columnconfigure(0, weight=1)

        # --- Models ---
        self.model_menus: dict[str, ctk.CTkOptionMenu] = {}
        mcard = self._card(body, "Models", "Local Ollama models per task")
        installed = ollama.installed() or ["(none — is ollama running?)"]
        current = ollama.models()
        for role, label in ROLES:
            row = ctk.CTkFrame(mcard, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=4)
            ctk.CTkLabel(row, text=label, text_color=theme.FG, font=theme.f(13),
                         width=140, anchor="w").pack(side="left")
            menu = ctk.CTkOptionMenu(row, values=installed, fg_color=theme.CARD2,
                                     button_color=theme.CARD2, command=lambda *_: self._save_models())
            menu.set(current.get(role, installed[0]))
            menu.pack(side="left", fill="x", expand=True)
            self.model_menus[role] = menu

        # --- Agent access ---
        acard = self._card(body, "Agent access", "How much power the autonomous agent has")
        self.mode_var = ctk.StringVar(value=db.get_setting("agent_access", "approval"))
        seg = ctk.CTkSegmentedButton(
            acard, values=["approval", "yolo", "sandbox"], variable=self.mode_var,
            selected_color=theme.PRIMARY, command=self._save_mode)
        seg.pack(anchor="w", padx=16, pady=(4, 10))
        ctk.CTkLabel(acard, text=(
            "approval — risky actions ask first   ·   yolo — no prompts   ·   "
            "sandbox — files/shell limited to the workspace"),
            text_color=theme.MUTED, font=theme.f(11)).pack(anchor="w", padx=16, pady=(0, 12))

        # --- Voice / offline ---
        vcard = self._card(body, "Voice & environment", "")
        self.voice_status = ctk.CTkLabel(vcard, text="", text_color=theme.MUTED, font=theme.f(12))
        self.voice_status.pack(anchor="w", padx=16, pady=(2, 6))
        ctk.CTkButton(vcard, text="Warm up Whisper (offline STT)", fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._warm).pack(anchor="w", padx=16, pady=(0, 8))
        ctk.CTkLabel(vcard, text=f"Offline-only mode: {'ON' if OFFLINE_ONLY else 'off'}",
                     text_color=theme.SECONDARY if OFFLINE_ONLY else theme.MUTED,
                     font=theme.f(12, "bold")).pack(anchor="w", padx=16, pady=(0, 4))
        ctk.CTkLabel(vcard, text=f"Workspace: {WORKSPACE_DIR}", text_color=theme.MUTED,
                     font=theme.mono(11)).pack(anchor="w", padx=16)
        ctk.CTkLabel(vcard, text=f"Data: {DATA_DIR}", text_color=theme.MUTED,
                     font=theme.mono(11)).pack(anchor="w", padx=16, pady=(0, 12))

    def on_show(self):
        from ...voice import stt, tts
        self.voice_status.configure(
            text=f"STT (whisper): {'ready' if stt.available() else 'unavailable'}   ·   "
                 f"TTS (pyttsx3): {'ready' if tts.available() else 'unavailable'}")

    def _card(self, parent, title, sub) -> ctk.CTkFrame:
        card = ctk.CTkFrame(parent, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        card.pack(fill="x", pady=8)
        ctk.CTkLabel(card, text=title, text_color=theme.FG, font=theme.f(15, "bold")
                     ).pack(anchor="w", padx=16, pady=(12, 0))
        if sub:
            ctk.CTkLabel(card, text=sub, text_color=theme.MUTED, font=theme.f(12)
                         ).pack(anchor="w", padx=16, pady=(0, 4))
        return card

    def _save_models(self):
        data = {r: m.get() for r, m in self.model_menus.items()}
        db.set_setting("models", json.dumps(data))

    def _save_mode(self, *_):
        db.set_setting("agent_access", self.mode_var.get())

    def _warm(self):
        self.voice_status.configure(text="warming up Whisper…")

        def worker():
            from ...voice import stt
            try:
                stt.warmup()
                msg = "Whisper ready (cached offline)"
            except Exception as e:
                msg = f"Whisper warmup failed: {e}"
            self.app.after(0, lambda: self.voice_status.configure(text=msg))
        threading.Thread(target=worker, daemon=True).start()
