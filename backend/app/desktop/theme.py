"""Design tokens for the desktop UI — lifted from the Figma 'Nexus AI' palette
(dark red / green / black). Central so every view stays consistent.
"""
from __future__ import annotations

import customtkinter as ctk

# Palette (from the Figma theme.css)
BG = "#0a0a0a"          # app background
CARD = "#141414"        # panels / cards
CARD2 = "#1a1a1a"       # muted / inputs
SIDEBAR = "#000000"
BORDER = "#2a2a2a"
FG = "#e5e5e5"          # primary text
MUTED = "#737373"       # secondary text
PRIMARY = "#ef4444"     # red accent
PRIMARY_HOVER = "#dc2626"
SECONDARY = "#10b981"   # green accent
SECONDARY_HOVER = "#059669"
GOLD = "#f5b301"
BLUE = "#3b82f6"

RADIUS = 8

FONT = "Inter"          # falls back to system if absent
MONO = "JetBrains Mono"


def apply() -> None:
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("dark-blue")  # overridden per-widget anyway


def f(size: int = 13, weight: str = "normal") -> ctk.CTkFont:
    return ctk.CTkFont(family=FONT, size=size, weight=weight)


def mono(size: int = 12) -> ctk.CTkFont:
    return ctk.CTkFont(family=MONO, size=size)
