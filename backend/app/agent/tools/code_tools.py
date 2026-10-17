"""Code & data tools: run Python, precisely edit files, and make charts — offline.

Ported/adapted from OpenManus (python_execute, str_replace_editor, chart viz).
"""
from __future__ import annotations

import json
import subprocess
import sys

from ..registry import registry
from ..safety import resolve_path, workspace_out


@registry.tool(
    "python_exec",
    "Execute a snippet of Python code locally and return its printed output. "
    "Only stdout is captured — use print() to see results.",
    {"code": {"type": "string", "description": "Python code to run"}},
    danger=True, plugin="python",
)
def python_exec(code: str) -> str:
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True, text=True, timeout=30,
        )
    except subprocess.TimeoutExpired:
        return "Execution timed out after 30s."
    out = (proc.stdout or "") + (proc.stderr or "")
    return (out[:15000] or "(no output — remember to print())") + \
        (f"\n[exit {proc.returncode}]" if proc.returncode else "")


@registry.tool(
    "edit_file",
    "Precisely edit a text file by replacing an exact string. old_str must match "
    "exactly once. Great for surgical code/note edits.",
    {
        "path": {"type": "string", "description": "File to edit"},
        "old_str": {"type": "string", "description": "Exact text to replace (must be unique)"},
        "new_str": {"type": "string", "description": "Replacement text"},
    },
    danger=True, plugin="files",
)
def edit_file(path: str, old_str: str, new_str: str = "") -> str:
    p = resolve_path(path, must_exist=True)
    text = p.read_text(encoding="utf-8")
    count = text.count(old_str)
    if count == 0:
        return "old_str not found — no change made."
    if count > 1:
        return f"old_str appears {count} times; add more context so it's unique."
    p.write_text(text.replace(old_str, new_str), encoding="utf-8")
    return f"Edited {p} (1 replacement)."


@registry.tool(
    "make_chart",
    "Create a chart image (PNG) offline from data. chart_type: bar | line | pie.",
    {
        "filename": {"type": "string", "description": "Output PNG name, e.g. sales.png"},
        "chart_type": {"type": "string", "description": "bar | line | pie"},
        "title": {"type": "string", "description": "Chart title", "_optional": True},
        "labels_json": {"type": "string", "description": "JSON list of category labels"},
        "values_json": {"type": "string", "description": "JSON list of numeric values"},
    },
    plugin="charts",
)
def make_chart(filename: str, chart_type: str, labels_json: str,
               values_json: str, title: str = "") -> str:
    import matplotlib
    matplotlib.use("Agg")  # headless / offline
    import matplotlib.pyplot as plt

    try:
        labels = json.loads(labels_json)
        values = [float(v) for v in json.loads(values_json)]
    except Exception as e:
        return f"labels_json/values_json must be JSON lists: {e}"
    if len(labels) != len(values):
        return "labels and values must be the same length."

    if not filename.lower().endswith(".png"):
        filename += ".png"
    out = workspace_out(filename)

    plt.figure(figsize=(8, 5))
    ct = (chart_type or "bar").lower()
    colors = ["#ef4444", "#10b981", "#3b82f6", "#f5b301", "#a855f7", "#737373"]
    if ct == "line":
        plt.plot(labels, values, color="#10b981", marker="o", linewidth=2)
    elif ct == "pie":
        plt.pie(values, labels=labels, autopct="%1.0f%%",
                colors=colors * (len(values) // len(colors) + 1))
    else:
        plt.bar(labels, values, color=[colors[i % len(colors)] for i in range(len(values))])
    if title:
        plt.title(title)
    plt.tight_layout()
    plt.savefig(str(out), dpi=110)
    plt.close()
    return f"Saved {ct} chart: {out}"
