"""Git tools for the agent — local repo operations (offline)."""
from __future__ import annotations

from ..registry import registry
from ... import gitconn


@registry.tool(
    "git_status",
    "Show the git status of the active repository (branch + changed files).",
    {"repo": {"type": "string", "description": "Repo path (optional)", "_optional": True}},
    plugin="git",
)
def git_status(repo: str = "") -> str:
    return gitconn.status(repo or None)


@registry.tool(
    "git_diff",
    "Show the current git diff. Set staged=true for staged changes.",
    {
        "repo": {"type": "string", "description": "Repo path", "_optional": True},
        "staged": {"type": "boolean", "description": "Show staged diff", "_optional": True},
    },
    plugin="git",
)
def git_diff(repo: str = "", staged: bool = False) -> str:
    return gitconn.diff(repo or None, staged=bool(staged))[:15000]


@registry.tool(
    "git_log",
    "Show recent git commit history (graph, oneline).",
    {"repo": {"type": "string", "description": "Repo path", "_optional": True}},
    plugin="git",
)
def git_log(repo: str = "") -> str:
    return gitconn.log(repo or None)


@registry.tool(
    "git_commit",
    "Stage all changes and create a commit with the given message.",
    {
        "message": {"type": "string", "description": "Commit message"},
        "repo": {"type": "string", "description": "Repo path", "_optional": True},
    },
    danger=True, plugin="git",
)
def git_commit(message: str, repo: str = "") -> str:
    r = repo or None
    gitconn.run(["add", "-A"], r)
    return gitconn.run(["commit", "-m", message], r)


@registry.tool(
    "git_branch",
    "Create and switch to a new git branch (or list branches if no name).",
    {
        "name": {"type": "string", "description": "New branch name (blank = list)", "_optional": True},
        "repo": {"type": "string", "description": "Repo path", "_optional": True},
    },
    danger=True, plugin="git",
)
def git_branch(name: str = "", repo: str = "") -> str:
    r = repo or None
    if not name:
        return gitconn.branches(r)
    return gitconn.run(["checkout", "-b", name], r)
