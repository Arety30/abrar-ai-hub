"""System tools: files, shell, directory, time, (offline-aware) web search."""
from __future__ import annotations

import subprocess
from datetime import datetime

from ...config import OFFLINE_ONLY, WORKSPACE_DIR
from ..registry import registry
from ..safety import resolve_path, access_mode

_BLOCKED = {"nano", "vim", "vi", "top", "htop", "less", "more", "man", "ssh", "ftp"}


@registry.tool(
    "write_file",
    "Write text to a local file. Prefer a bare filename (it lands in the workspace); "
    "do not invent absolute paths.",
    {
        "path": {"type": "string", "description": "File name or path (bare names go to the workspace)"},
        "content": {"type": "string", "description": "Full file content to write"},
    },
    danger=True, plugin="files",
)
def write_file(path: str, content: str = "") -> str:
    from pathlib import Path
    from ..safety import workspace_out
    p = resolve_path(path)
    # If the model invented a path whose parent doesn't exist / isn't writable,
    # fall back to the workspace instead of erroring out.
    if not p.parent.exists():
        p = workspace_out(Path(path).name)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    except (PermissionError, OSError):
        p = workspace_out(Path(path).name)
        p.write_text(content, encoding="utf-8")
    return f"Wrote {len(content)} chars to {p}"


@registry.tool(
    "read_file",
    "Read a local text file and return its contents.",
    {"path": {"type": "string", "description": "File path to read"}},
    plugin="files",
)
def read_file(path: str) -> str:
    p = resolve_path(path, must_exist=True)
    data = p.read_text(encoding="utf-8", errors="replace")
    return data[:20000]


@registry.tool(
    "list_dir",
    "List files and folders in a local directory.",
    {"path": {"type": "string", "description": "Directory path", "_optional": True}},
    plugin="files",
)
def list_dir(path: str = ".") -> str:
    p = resolve_path(path or ".", must_exist=True)
    items = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
    lines = [("📄 " if x.is_file() else "📁 ") + x.name for x in items[:200]]
    return f"{p}\n" + "\n".join(lines) if lines else f"{p} (empty)"


@registry.tool(
    "run_shell",
    "Run a shell command on the local machine and return stdout/stderr.",
    {"command": {"type": "string", "description": "The shell command to execute"}},
    danger=True, plugin="shell",
)
def run_shell(command: str) -> str:
    first = (command or "").strip().split()[:1]
    if first and first[0] in _BLOCKED:
        return f"Refused: '{first[0]}' is an interactive command and is blocked."
    cwd = str(WORKSPACE_DIR) if access_mode() == "sandbox" else None
    try:
        proc = subprocess.run(
            command, shell=True, executable="/bin/bash",
            capture_output=True, text=True, timeout=120, cwd=cwd,
        )
    except subprocess.TimeoutExpired:
        return "Command timed out after 120s."
    out = (proc.stdout or "") + (proc.stderr or "")
    return (out[:15000] or "(no output)") + f"\n[exit {proc.returncode}]"


@registry.tool(
    "get_datetime",
    "Get the current local date and time.",
    {},
    plugin="core",
)
def get_datetime() -> str:
    return datetime.now().strftime("%A, %d %B %Y, %H:%M:%S")


@registry.tool(
    "web_search",
    "Search the web. NOTE: only works when the machine is online.",
    {"query": {"type": "string", "description": "Search query"}},
    plugin="core",
)
def web_search(query: str) -> str:
    if OFFLINE_ONLY:
        return ("Web search is disabled — this assistant runs in offline mode. "
                "Answer from local knowledge, memory, or stored documents instead.")
    try:
        import httpx
        r = httpx.get("https://duckduckgo.com/html/", params={"q": query}, timeout=8,
                      headers={"User-Agent": "Mozilla/5.0"})
        return f"(online) fetched {len(r.text)} bytes for '{query}'. Parsing not enabled."
    except Exception as e:
        return f"Web search failed (likely offline): {e}"
