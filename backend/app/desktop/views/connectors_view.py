"""Connectors hub — pick a specialist role; opens the chat as that expert agent."""
from __future__ import annotations

import customtkinter as ctk

from ... import connectors
from ...agent.registry import registry
from .. import theme


class ConnectorsView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(head, text="🔌  Connectors", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        ctk.CTkLabel(head, text="specialist agents wired to domain tools — pick your role",
                     text_color=theme.MUTED, font=theme.f(12)).pack(side="left", padx=12)

        grid = ctk.CTkScrollableFrame(self, fg_color="transparent")
        grid.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 16))
        for i in range(2):
            grid.grid_columnconfigure(i, weight=1, uniform="c")

        for idx, c in enumerate(connectors.all()):
            self._card(grid, c, idx // 2, idx % 2)

    def _tools_for(self, plugins: list[str]) -> list[str]:
        return [t.name for t in registry.all() if t.plugin in plugins]

    def _card(self, parent, c, r, col):
        card = ctk.CTkFrame(parent, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        card.grid(row=r, column=col, sticky="nsew", padx=8, pady=8)
        card.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 2))
        ctk.CTkLabel(top, text=c.icon, font=theme.f(24)).pack(side="left")
        ctk.CTkLabel(top, text=f"  {c.name}", text_color=theme.FG,
                     font=theme.f(16, "bold")).pack(side="left")
        ctk.CTkLabel(card, text=c.description, text_color=theme.MUTED, justify="left",
                     wraplength=340, font=theme.f(12)).grid(row=1, column=0, sticky="w", padx=14)

        tools = self._tools_for(c.plugins)
        if tools:
            ctk.CTkLabel(card, text="🛠 " + ", ".join(tools[:6]) + ("…" if len(tools) > 6 else ""),
                         text_color=theme.BLUE, justify="left", wraplength=340,
                         font=theme.mono(10)).grid(row=2, column=0, sticky="w", padx=14, pady=(6, 0))
        for ex in c.examples[:2]:
            ctk.CTkLabel(card, text=f"“{ex}”", text_color=theme.GOLD, justify="left",
                         wraplength=340, font=theme.f(11)).grid(sticky="w", padx=14)

        ctk.CTkButton(card, text=f"Open {c.name} in Chat  →", fg_color=theme.PRIMARY,
                      hover_color=theme.PRIMARY_HOVER, font=theme.f(13, "bold"),
                      command=lambda k=c.persona: self._open(k)).grid(
            row=6, column=0, sticky="ew", padx=14, pady=12)

    def _open(self, persona_key: str):
        self.app.show("agent")
        agent = self.app._views["agent"]
        if hasattr(agent, "set_persona"):
            agent.set_persona(persona_key)
