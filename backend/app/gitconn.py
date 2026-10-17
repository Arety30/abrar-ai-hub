"""Local git connector — thin wrapper over the `git` CLI (offline, no remotes needed).

Shared by the agent's git tools and the desktop Git view. The active repo path is
stored in Settings so both stay in sync.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .config import WORKSPACE_DIR
from .db import get_setting, set_setting


def get_repo() -> str:
    return get_setting("git_repo") or str(WORKSPACE_DIR)


def set_repo(path: str) -> None:
    set_setting("git_repo", str(Path(path).expanduser()))


def run(args: list[str], repo: str | None = None, timeout: int = 60) -> str:
    cwd = repo or get_repo()
    try:
        proc = subprocess.run(["git", *args], cwd=cwd, capture_output=True,
                              text=True, timeout=timeout)
    except FileNotFoundError:
        return "git is not installed on this machine."
    except NotADirectoryError:
        return f"Not a directory: {cwd}"
    except subprocess.TimeoutExpired:
        return "git command timed out."
    except Exception as e:
        return f"git error: {e}"
    out = (proc.stdout or "") + (proc.stderr or "")
    return out.strip() or "(no output)"


def is_repo(repo: str | None = None) -> bool:
    return run(["rev-parse", "--is-inside-work-tree"], repo).strip() == "true"


def status(repo: str | None = None) -> str:
    return run(["status", "-sb"], repo)


def diff(repo: str | None = None, staged: bool = False) -> str:
    args = ["diff", "--stat", "-p"]
    if staged:
        args.insert(1, "--staged")
    return run(args, repo)


def log(repo: str | None = None, n: int = 15) -> str:
    return run(["log", f"-{n}", "--oneline", "--decorate", "--graph"], repo)


def branches(repo: str | None = None) -> str:
    return run(["branch", "-a"], repo)


def current_branch(repo: str | None = None) -> str:
    return run(["rev-parse", "--abbrev-ref", "HEAD"], repo)
