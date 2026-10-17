"""Modal approval dialog for the agent's risky tool calls."""
from __future__ import annotations

import json

import customtkinter as ctk

from .. import theme


def ask_approval(parent, name: str, args: dict) -> bool:
    dlg = ctk.CTkToplevel(parent)
    dlg.title("Approve action")
    dlg.configure(fg_color=theme.CARD)
    dlg.geometry("480x300")
    dlg.transient(parent)
    dlg.grab_set()

    result = {"ok": False}

    ctk.CTkLabel(dlg, text="⚠  Agent wants to run a tool", text_color=theme.PRIMARY,
                 font=theme.f(16, "bold")).pack(anchor="w", padx=20, pady=(20, 6))
    ctk.CTkLabel(dlg, text=name, text_color=theme.FG,
                 font=theme.mono(14)).pack(anchor="w", padx=20)

    box = ctk.CTkTextbox(dlg, height=140, fg_color=theme.CARD2, text_color=theme.FG,
                         font=theme.mono(12), corner_radius=theme.RADIUS)
    box.pack(fill="both", expand=True, padx=20, pady=12)
    box.insert("1.0", json.dumps(args, indent=2))
    box.configure(state="disabled")

    row = ctk.CTkFrame(dlg, fg_color="transparent")
    row.pack(fill="x", padx=20, pady=(0, 18))

    def done(ok: bool):
        result["ok"] = ok
        dlg.grab_release()
        dlg.destroy()

    ctk.CTkButton(row, text="Deny", fg_color=theme.CARD2, hover_color=theme.BORDER,
                  text_color=theme.FG, command=lambda: done(False)).pack(side="right", padx=(8, 0))
    ctk.CTkButton(row, text="Allow", fg_color=theme.SECONDARY, hover_color=theme.SECONDARY_HOVER,
                  command=lambda: done(True)).pack(side="right")

    dlg.bind("<Escape>", lambda e: done(False))
    dlg.wait_window()
    return result["ok"]
