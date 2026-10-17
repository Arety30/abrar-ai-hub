"""Path sandboxing + access-mode helpers shared by tools."""
from __future__ import annotations

from pathlib import Path

from ..config import WORKSPACE_DIR
from ..db import get_setting


def access_mode() -> str:
    return get_setting("agent_access", "approval") or "approval"


def resolve_path(path: str, *, must_exist: bool = False) -> Path:
    """Resolve a user/agent supplied path.

    In 'sandbox' mode every path is forced inside WORKSPACE_DIR. In other modes
    absolute paths are honoured but relative paths still root at the workspace.
    """
    p = Path(path).expanduser()
    if not p.is_absolute():
        p = WORKSPACE_DIR / p
    p = p.resolve()

    if access_mode() == "sandbox":
        ws = WORKSPACE_DIR.resolve()
        if ws not in p.parents and p != ws:
            raise PermissionError(
                f"Sandbox mode: '{p}' is outside the workspace ({ws}).")
    if must_exist and not p.exists():
        raise FileNotFoundError(f"No such path: {p}")
    return p


def workspace_out(filename: str) -> Path:
    """Where generated documents land."""
    name = Path(filename).name  # strip any directory components
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    return WORKSPACE_DIR / name
