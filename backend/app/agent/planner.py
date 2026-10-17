"""Plan mode — autonomous multi-step task execution (adapted from OpenManus's
planning flow, simplified for local/offline use).

Given a high-level goal, the planner asks a local model to break it into a short
ordered list of steps, then executes each step with the normal tool-using agent,
feeding results forward. Emits the same event stream as core.run plus plan events.
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

from ..providers import ollama
from . import core

Emit = Callable[..., None]


def _make_plan(goal: str) -> list[str]:
    prompt = (
        "Break the following goal into a short ordered list of 2-6 concrete, "
        "actionable steps an AI agent can execute with tools (shell, files, python, "
        "documents, notes). Reply ONLY with a JSON array of step strings.\n\n"
        f"GOAL: {goal}")
    raw = ollama.generate(prompt, role="reasoner", options={"temperature": 0.3})
    start, end = raw.find("["), raw.rfind("]")
    if start >= 0 and end > start:
        try:
            steps = json.loads(raw[start:end + 1])
            steps = [str(s).strip() for s in steps if str(s).strip()]
            if steps:
                return steps[:6]
        except Exception:
            pass
    # fallback: split numbered lines
    lines = [re.sub(r"^\s*\d+[.)]\s*", "", ln).strip()
             for ln in raw.splitlines() if ln.strip()]
    return [l for l in lines if l][:6] or [goal]


def run(goal: str, emit: Optional[Emit] = None, approver=None) -> str:
    """Plan then execute. Returns a final summary."""
    emit = emit or (lambda *a, **k: None)
    steps = _make_plan(goal)
    emit("plan", steps=steps)

    transcript: list[dict] = []
    results: list[str] = []
    for i, step in enumerate(steps, 1):
        emit("plan_step", n=i, total=len(steps), step=step)
        instruction = (
            f"You are executing step {i} of {len(steps)} toward the goal: '{goal}'.\n"
            f"Current step: {step}\n"
            "Do exactly this step using tools where useful, then report the result.")
        answer = core.run(instruction, history=transcript[-8:], emit=emit,
                          approver=approver)
        results.append(f"Step {i}: {step}\n{answer}")
        transcript.append({"role": "user", "content": step})
        transcript.append({"role": "assistant", "content": answer})

    summary_prompt = ("Summarise the outcome of this multi-step task for the user, "
                      f"concisely.\n\nGOAL: {goal}\n\n" + "\n\n".join(results))
    summary = ollama.generate(summary_prompt, role="general")
    emit("plan_done", summary=summary)
    return summary
