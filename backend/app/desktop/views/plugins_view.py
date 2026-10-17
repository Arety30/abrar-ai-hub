"""Plugins view — enable/disable capabilities. Disabling a plugin hides its
tools from the agent and its features from the UI.
"""
from __future__ import annotations

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import Plugin
from ...agent.registry import registry
from .. import theme

CAT_COLOR = {"tool": theme.BLUE, "ai": theme.PRIMARY,
             "visualization": theme.GOLD, "utility": theme.SECONDARY}


class PluginsView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 8))
        ctk.CTkLabel(head, text="Plugins", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        ctk.CTkLabel(head, text="Toggle capabilities the agent and app can use",
                     text_color=theme.MUTED, font=theme.f(12)).pack(side="left", padx=14)

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 16))
        self.list.grid_columnconfigure(0, weight=1)

    def on_show(self):
        self._refresh()

    def _tools_for(self, slug: str) -> list[str]:
        return [t.name for t in registry.all() if t.plugin == slug]

    def _refresh(self):
        for w in self.list.winfo_children():
            w.destroy()
        with db.get_session() as s:
            plugins = s.exec(select(Plugin).order_by(Plugin.category)).all()
        for p in plugins:
            card = ctk.CTkFrame(self.list, fg_color=theme.CARD, corner_radius=theme.RADIUS)
            card.pack(fill="x", pady=6)
            card.grid_columnconfigure(0, weight=1)

            left = ctk.CTkFrame(card, fg_color="transparent")
            left.grid(row=0, column=0, sticky="w", padx=16, pady=12)
            title = ctk.CTkFrame(left, fg_color="transparent")
            title.pack(anchor="w")
            ctk.CTkLabel(title, text=p.name, text_color=theme.FG,
                         font=theme.f(15, "bold")).pack(side="left")
            ctk.CTkLabel(title, text=f"  {p.category}",
                         text_color=CAT_COLOR.get(p.category, theme.MUTED),
                         font=theme.f(11, "bold")).pack(side="left")
            ctk.CTkLabel(left, text=p.description, text_color=theme.MUTED,
                         font=theme.f(12)).pack(anchor="w", pady=(2, 0))
            tools = self._tools_for(p.slug)
            if tools:
                ctk.CTkLabel(left, text="tools: " + ", ".join(tools), text_color=theme.MUTED,
                             font=theme.mono(10)).pack(anchor="w", pady=(2, 0))

            var = ctk.BooleanVar(value=p.enabled)
            sw = ctk.CTkSwitch(card, text="", variable=var, progress_color=theme.SECONDARY,
                               command=lambda pid=p.id, v=var: self._toggle(pid, v))
            sw.grid(row=0, column=1, padx=16)

    def _toggle(self, plugin_id: int, var):
        with db.get_session() as s:
            p = s.get(Plugin, plugin_id)
            if p:
                p.enabled = bool(var.get())
                s.add(p); s.commit()
