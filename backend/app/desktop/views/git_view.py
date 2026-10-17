"""Git view — a local git connector for devs, with AI assist (offline)."""
from __future__ import annotations

import threading

import customtkinter as ctk

from ... import gitconn
from ...providers import ollama
from .. import theme


class GitView(ctk.CTkFrame):
    def __init__(self, master, app):
        super().__init__(master, fg_color=theme.BG)
        self.app = app

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # repo bar
        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=0, column=0, sticky="ew", padx=24, pady=(16, 6))
        ctk.CTkLabel(bar, text="🔧  Git", text_color=theme.FG,
                     font=theme.f(20, "bold")).pack(side="left")
        self.branch_lbl = ctk.CTkLabel(bar, text="", text_color=theme.SECONDARY,
                                       font=theme.f(12, "bold"))
        self.branch_lbl.pack(side="right")

        repo_row = ctk.CTkFrame(self, fg_color="transparent")
        repo_row.grid(row=1, column=0, sticky="ew", padx=24, pady=(0, 6))
        repo_row.grid_columnconfigure(0, weight=1)
        self.repo_entry = ctk.CTkEntry(repo_row, placeholder_text="/path/to/repo",
                                       fg_color=theme.CARD2, border_width=0)
        self.repo_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ctk.CTkButton(repo_row, text="Set repo", width=80, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._set_repo).grid(row=0, column=1)
        for txt, fn in (("Status", self._status), ("Diff", self._diff),
                        ("Log", self._log), ("Branches", self._branches)):
            ctk.CTkButton(repo_row, text=txt, width=80, fg_color=theme.CARD2,
                          hover_color=theme.BORDER,
                          command=fn).grid(row=0, column=repo_row.grid_size()[0], padx=(6, 0))

        # output
        self.out = ctk.CTkTextbox(self, fg_color=theme.CARD2, text_color=theme.FG,
                                  font=theme.mono(12), wrap="none")
        self.out.grid(row=2, column=0, sticky="nsew", padx=24, pady=6)

        # commit + AI bar
        commit = ctk.CTkFrame(self, fg_color=theme.CARD, corner_radius=theme.RADIUS)
        commit.grid(row=3, column=0, sticky="ew", padx=24, pady=(6, 16))
        commit.grid_columnconfigure(0, weight=1)
        self.msg = ctk.CTkEntry(commit, placeholder_text="Commit message…",
                                fg_color=theme.CARD, border_width=0)
        self.msg.grid(row=0, column=0, sticky="ew", padx=(12, 6), pady=10)
        ctk.CTkButton(commit, text="✨ AI message", width=110, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._ai_message).grid(row=0, column=1, padx=4)
        ctk.CTkButton(commit, text="🔍 AI review", width=100, fg_color=theme.CARD2,
                      hover_color=theme.BORDER, command=self._ai_review).grid(row=0, column=2, padx=4)
        ctk.CTkButton(commit, text="Stage all & Commit", width=150, fg_color=theme.PRIMARY,
                      hover_color=theme.PRIMARY_HOVER, font=theme.f(13, "bold"),
                      command=self._commit).grid(row=0, column=3, padx=(4, 10))

    def on_show(self):
        self.repo_entry.delete(0, "end")
        self.repo_entry.insert(0, gitconn.get_repo())
        self._refresh_branch()
        if gitconn.is_repo():
            self._status()
        else:
            self._set_out("Not a git repository. Set a repo path above (or run `git init`).")

    # -- helpers -----------------------------------------------------------
    def _set_out(self, text: str):
        self.out.delete("1.0", "end")
        self.out.insert("1.0", text)

    def _refresh_branch(self):
        b = gitconn.current_branch() if gitconn.is_repo() else "—"
        self.branch_lbl.configure(text=f"⎇ {b}")

    def _set_repo(self):
        gitconn.set_repo(self.repo_entry.get().strip())
        self._refresh_branch()
        self.on_show()

    def _status(self): self._set_out(gitconn.status())
    def _diff(self): self._set_out(gitconn.diff() or "(no changes)")
    def _log(self): self._set_out(gitconn.log())
    def _branches(self): self._set_out(gitconn.branches())

    def _commit(self):
        msg = self.msg.get().strip()
        if not msg:
            self._set_out("Enter a commit message first (or use ✨ AI message).")
            return
        gitconn.run(["add", "-A"])
        result = gitconn.run(["commit", "-m", msg])
        self.msg.delete(0, "end")
        self._refresh_branch()
        self._set_out(result)

    # -- AI assist (local coder model) ------------------------------------
    def _ai_message(self):
        diff = gitconn.diff(staged=False) + gitconn.diff(staged=True)
        if not diff or diff == "(no output)":
            self._set_out("No changes to describe.")
            return
        self._set_out("✨ writing commit message from the diff…")

        def worker():
            prompt = ("Write a concise, conventional git commit message (one summary line, "
                      "imperative mood, optional short body) for this diff:\n\n" + diff[:6000])
            try:
                msg = ollama.generate(prompt, role="coder").strip().strip("`")
            except Exception as e:
                msg = f"(error: {e})"
            self.app.after(0, lambda: self._put_message(msg))
        threading.Thread(target=worker, daemon=True).start()

    def _put_message(self, msg: str):
        first = msg.splitlines()[0] if msg else ""
        self.msg.delete(0, "end")
        self.msg.insert(0, first[:200])
        self._set_out("Suggested commit message:\n\n" + msg)

    def _ai_review(self):
        diff = gitconn.diff(staged=False) + gitconn.diff(staged=True)
        if not diff or diff == "(no output)":
            self._set_out("No changes to review.")
            return
        self._set_out("🔍 reviewing the diff locally…")

        def worker():
            prompt = ("You are a senior engineer. Review this git diff: note bugs, risks, "
                      "and improvements as a short bullet list.\n\n" + diff[:6000])
            try:
                review = ollama.generate(prompt, role="coder")
            except Exception as e:
                review = f"(error: {e})"
            self.app.after(0, lambda: self._set_out(review))
        threading.Thread(target=worker, daemon=True).start()
