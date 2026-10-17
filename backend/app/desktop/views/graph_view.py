"""Knowledge Graph — force-directed view of notes, [[wikilinks]], meetings & memory.

A local, dependency-free physics simulation drawn on a Tk canvas (ported from
the meeting-hub SVG force graph).
"""
from __future__ import annotations

import math
import re
import tkinter as tk

import customtkinter as ctk
from sqlmodel import select

from ... import db
from ...models import Note, Meeting, Memory
from .. import theme

WIKILINK = re.compile(r"\[\[(.*?)\]\]")

COLORS = {"note": theme.SECONDARY, "meeting": theme.BLUE,
          "memory": theme.GOLD, "tag": theme.PRIMARY}


class GraphView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app
        self.nodes: list[dict] = []
        self.links: list[tuple[int, int]] = []
        self._running = False

        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(head, text="Knowledge Graph", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        ctk.CTkButton(head, text="⟳ Rebuild", width=90, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._build).pack(side="right")
        legend = "  ".join(f"● {k}" for k in COLORS)
        ctk.CTkLabel(head, text=legend, text_color=theme.MUTED,
                     font=theme.f(11)).pack(side="right", padx=16)

        self.canvas = tk.Canvas(self, bg=theme.BG, highlightthickness=0)
        self.canvas.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 16))
        self.canvas.bind("<Configure>", lambda e: None)
        self.canvas.bind("<Button-1>", self._on_click)

    def on_show(self):
        self._build()
        if not self._running:
            self._running = True
            self._tick()

    def destroy(self):
        self._running = False
        super().destroy()

    # -- graph construction ------------------------------------------------
    def _build(self):
        with db.get_session() as s:
            notes = s.exec(select(Note)).all()
            meetings = s.exec(select(Meeting)).all()
            memories = s.exec(select(Memory).order_by(Memory.id.desc())).all()[:10]

        w = max(self.canvas.winfo_width(), 600)
        h = max(self.canvas.winfo_height(), 400)
        cx, cy = w / 2, h / 2

        self.nodes = []
        index_by_name = {}
        n = len(notes) + len(meetings) + len(memories) + 1
        i = 0

        def place(label, kind, ref=None):
            nonlocal i
            ang = (i / max(n, 1)) * math.tau
            node = {"label": label[:22], "kind": kind, "ref": ref,
                    "x": cx + math.cos(ang) * 160 + (i % 3) * 12,
                    "y": cy + math.sin(ang) * 160 + (i % 5) * 8,
                    "vx": 0.0, "vy": 0.0}
            self.nodes.append(node)
            i += 1
            return len(self.nodes) - 1

        for note in notes:
            idx = place(note.name.replace(".md", ""), "note", note.id)
            index_by_name[note.name.replace(".md", "").lower()] = idx
        for m in meetings:
            place(m.title, "meeting", m.id)
        for mem in memories:
            place(mem.text[:22], "memory", mem.id)

        # links from [[wikilinks]] in note bodies
        self.links = []
        for note in notes:
            src_name = note.name.replace(".md", "").lower()
            src = index_by_name.get(src_name)
            if src is None:
                continue
            for target in WIKILINK.findall(note.content or ""):
                tgt = index_by_name.get(target.strip().lower())
                if tgt is not None and tgt != src:
                    self.links.append((src, tgt))

        if not self.nodes:
            place("Create notes to grow your graph", "note")

    # -- physics -----------------------------------------------------------
    def _tick(self):
        if not self._running or not self.winfo_ismapped():
            if self._running:
                self.after(120, self._tick)
            return
        self._step()
        self._render()
        self.after(33, self._tick)

    def _step(self):
        w = max(self.canvas.winfo_width(), 600)
        h = max(self.canvas.winfo_height(), 400)
        cx, cy = w / 2, h / 2
        nodes = self.nodes
        # repulsion
        for a in range(len(nodes)):
            na = nodes[a]
            for b in range(a + 1, len(nodes)):
                nb = nodes[b]
                dx, dy = na["x"] - nb["x"], na["y"] - nb["y"]
                d2 = dx * dx + dy * dy + 0.01
                f = 1400.0 / d2
                fx, fy = dx * f, dy * f
                na["vx"] += fx; na["vy"] += fy
                nb["vx"] -= fx; nb["vy"] -= fy
        # spring on links
        for s, t in self.links:
            ns, nt = nodes[s], nodes[t]
            dx, dy = nt["x"] - ns["x"], nt["y"] - ns["y"]
            dist = math.hypot(dx, dy) or 1
            f = (dist - 110) * 0.02
            fx, fy = dx / dist * f, dy / dist * f
            ns["vx"] += fx; ns["vy"] += fy
            nt["vx"] -= fx; nt["vy"] -= fy
        # gravity to center + damping + integrate
        for nd in nodes:
            nd["vx"] += (cx - nd["x"]) * 0.008
            nd["vy"] += (cy - nd["y"]) * 0.008
            nd["vx"] *= 0.85; nd["vy"] *= 0.85
            nd["x"] += nd["vx"]; nd["y"] += nd["vy"]
            nd["x"] = min(max(nd["x"], 30), w - 30)
            nd["y"] = min(max(nd["y"], 30), h - 30)

    def _render(self):
        c = self.canvas
        c.delete("all")
        for s, t in self.links:
            ns, nt = self.nodes[s], self.nodes[t]
            c.create_line(ns["x"], ns["y"], nt["x"], nt["y"], fill=theme.BORDER, width=1)
        for nd in self.nodes:
            r = 8
            col = COLORS.get(nd["kind"], theme.SECONDARY)
            c.create_oval(nd["x"] - r, nd["y"] - r, nd["x"] + r, nd["y"] + r,
                          fill=col, outline=theme.BG, width=2)
            c.create_text(nd["x"], nd["y"] - 16, text=nd["label"], fill=theme.FG,
                          font=("TkDefaultFont", 9))

    def _on_click(self, event):
        for nd in self.nodes:
            if math.hypot(nd["x"] - event.x, nd["y"] - event.y) < 12:
                if nd["kind"] == "note" and nd.get("ref"):
                    self.app.show("notes")
                    self.app._views["notes"]._open(nd["ref"])
                return
