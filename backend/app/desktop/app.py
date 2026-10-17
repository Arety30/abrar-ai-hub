"""Abrar AI Hub — CustomTkinter desktop shell.

    python -m app.desktop
"""
from __future__ import annotations

import threading

import customtkinter as ctk

from .. import db
from ..config import APP_NAME
from ..providers import ollama
from . import theme
from .views.agent_view import AgentView
from .views.crew_view import CrewView
from .views.connectors_view import ConnectorsView
from .views.study_view import StudyView
from .views.quiz_view import QuizView
from .views.review_view import ReviewView
from .views.calendar_view import CalendarView
from .views.tasks_view import TasksView
from .views.notes_view import NotesView
from .views.graph_view import GraphView
from .views.meeting_view import MeetingView
from .views.git_view import GitView
from .views.plugins_view import PluginsView
from .views.settings_view import SettingsView

NAV = [
    ("agent", "🤖  Chat", AgentView),
    ("crew", "🧑‍🤝‍🧑  Crew", CrewView),
    ("connectors", "🔌  Connectors", ConnectorsView),
    ("study", "📚  Study", StudyView),
    ("quiz", "🧠  Quiz", QuizView),
    ("review", "🔁  Review", ReviewView),
    ("calendar", "📅  Calendar", CalendarView),
    ("tasks", "✅  Tasks", TasksView),
    ("notes", "📝  Notes", NotesView),
    ("graph", "🕸  Graph", GraphView),
    ("meeting", "🎥  Meeting", MeetingView),
    ("git", "🔧  Git", GitView),
    ("plugins", "🧩  Plugins", PluginsView),
    ("settings", "⚙  Settings", SettingsView),
]


class HubApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        db.init_db()
        theme.apply()

        self.title(APP_NAME)
        self.geometry("1280x820")
        self.minsize(1040, 680)
        self.configure(fg_color=theme.BG)

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()

        # content host
        self.content = ctk.CTkFrame(self, fg_color=theme.BG, corner_radius=0)
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.grid_rowconfigure(0, weight=1)
        self.content.grid_columnconfigure(0, weight=1)

        self._views: dict[str, ctk.CTkFrame] = {}
        self._nav_btns: dict[str, ctk.CTkButton] = {}
        self._current: str | None = None

        for key, label, cls in NAV:
            self._add_nav(key, label)
        self._register_views()

        self.show("agent")
        self._refresh_status()

    # -- sidebar -----------------------------------------------------------
    def _build_sidebar(self) -> None:
        bar = ctk.CTkFrame(self, width=210, corner_radius=0, fg_color=theme.SIDEBAR)
        bar.grid(row=0, column=0, sticky="nsew")
        bar.grid_propagate(False)
        bar.grid_rowconfigure(2, weight=1)  # nav host expands + scrolls
        self.sidebar = bar

        logo = ctk.CTkFrame(bar, fg_color="transparent")
        logo.grid(row=0, column=0, sticky="ew", padx=16, pady=(18, 6))
        dot = ctk.CTkLabel(logo, text="◆", text_color=theme.PRIMARY, font=theme.f(20, "bold"))
        dot.pack(side="left")
        ctk.CTkLabel(logo, text="  Abrar AI", text_color=theme.FG,
                     font=theme.f(17, "bold")).pack(side="left")
        ctk.CTkLabel(bar, text="LOCAL · OFFLINE", text_color=theme.MUTED,
                     font=theme.f(10, "bold")).grid(row=1, column=0, sticky="w", padx=18)

        self._nav_host = ctk.CTkScrollableFrame(bar, fg_color="transparent")
        self._nav_host.grid(row=2, column=0, sticky="nsew", padx=6, pady=10)

        # status footer
        self.status_dot = ctk.CTkLabel(bar, text="●  checking…", text_color=theme.MUTED,
                                       font=theme.f(11))
        self.status_dot.grid(row=11, column=0, sticky="w", padx=18, pady=(6, 4))
        self.mode_lbl = ctk.CTkLabel(bar, text="", text_color=theme.MUTED, font=theme.f(11))
        self.mode_lbl.grid(row=12, column=0, sticky="w", padx=18, pady=(0, 16))

    def _add_nav(self, key: str, label: str) -> None:
        btn = ctk.CTkButton(
            self._nav_host, text=label, anchor="w", height=40,
            fg_color="transparent", hover_color=theme.CARD2, text_color=theme.FG,
            font=theme.f(14), corner_radius=theme.RADIUS,
            command=lambda k=key: self.show(k),
        )
        btn.pack(fill="x", pady=2)
        self._nav_btns[key] = btn

    def _register_views(self) -> None:
        for key, _label, cls in NAV:
            view = cls(self.content, self)
            view.grid(row=0, column=0, sticky="nsew")
            view.grid_remove()
            self._views[key] = view

    # -- navigation --------------------------------------------------------
    def show(self, key: str) -> None:
        if self._current == key:
            return
        if self._current:
            self._views[self._current].grid_remove()
            self._nav_btns[self._current].configure(fg_color="transparent",
                                                    text_color=theme.FG)
        view = self._views[key]
        view.grid()
        self._nav_btns[key].configure(fg_color=theme.CARD2, text_color=theme.PRIMARY)
        self._current = key
        if hasattr(view, "on_show"):
            view.on_show()

    # -- status ------------------------------------------------------------
    def _refresh_status(self) -> None:
        def worker():
            online = ollama.is_online()
            gen = ollama.models().get("general", "?")
            mode = db.get_setting("agent_access", "approval")
            self.after(0, lambda: self._set_status(online, gen, mode))
        threading.Thread(target=worker, daemon=True).start()
        self.after(5000, self._refresh_status)

    def _set_status(self, online: bool, model: str, mode: str) -> None:
        self.status_dot.configure(
            text=f"●  Ollama {'online' if online else 'offline'}",
            text_color=theme.SECONDARY if online else theme.PRIMARY)
        self.mode_lbl.configure(text=f"{model} · {mode}")

    # -- cross-thread approval gate ---------------------------------------
    def approve(self, name: str, args: dict) -> bool:
        """Called from a worker thread; shows a modal on the UI thread and waits."""
        from .widgets.approval import ask_approval
        event = threading.Event()
        result = {"ok": False}

        def show():
            result["ok"] = ask_approval(self, name, args)
            event.set()

        self.after(0, show)
        event.wait()
        return result["ok"]


def main() -> None:
    import sys
    if "--selftest" in sys.argv:
        _selftest()
        return
    app = HubApp()
    app.mainloop()


def _selftest() -> None:
    """Construct the window, cycle every view's on_show, report, and exit.
    Used to verify the whole UI builds without a human clicking around.
    """
    import os
    import traceback
    try:
        app = HubApp()
        app.update(); app.update_idletasks()
        print("SELFTEST construct: OK", flush=True)
        for key, _label, _cls in NAV:
            app.show(key)
            for _ in range(2):
                app.update(); app.update_idletasks()
            print(f"SELFTEST view {key}: OK", flush=True)
        app._views["notes"]._new(); app.update()
        gv = app._views["graph"]; gv._build(); gv._step(); gv._render(); app.update()
        print("SELFTEST notes/graph paths: OK", flush=True)
        print("SELFTEST ALL OK", flush=True)
        os._exit(0)
    except Exception:
        traceback.print_exc()
        os._exit(3)


if __name__ == "__main__":
    main()
