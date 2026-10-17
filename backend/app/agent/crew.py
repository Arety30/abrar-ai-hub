"""Crew — a team of AI coworkers that collaborate on a goal (fully local).

A "manager" model breaks the goal into tasks and assigns each to the best-suited
pre-built agent (persona). The agents then work the tasks in sequence, each able
to see prior teammates' output (a shared task feed), and a final synthesis pass
produces the deliverable. Built on personas + the tool agent; no cloud.
"""
from __future__ import annotations

import json
from typing import Callable, Optional

from ..providers import ollama
from . import core, personas

Emit = Callable[..., None]


def _plan_crew(goal: str) -> list[dict]:
    """Ask the manager model to split the goal into assigned tasks."""
    valid = list(personas.PERSONAS)
    roster = "\n".join(f"- {p.key}: {p.name} — {p.description}" for p in personas.all())
    prompt = (
        "You are a project manager assigning work to a team of AI coworkers.\n"
        f"TEAM (use these exact agent keys):\n{roster}\n\n"
        f"GOAL: {goal}\n\n"
        "Break the goal into 2-5 concrete tasks and assign the best teammate to each.")
    schema = {"type": "object", "properties": {"tasks": {"type": "array", "items": {
        "type": "object", "properties": {"task": {"type": "string"},
                                         "agent": {"type": "string", "enum": valid}},
        "required": ["task", "agent"]}}}, "required": ["tasks"]}

    data = ollama.generate_json(prompt, schema, role="reasoner", options={"temperature": 0.3})
    if isinstance(data, dict) and isinstance(data.get("tasks"), list):
        out = []
        for it in data["tasks"]:
            task = str(it.get("task", "")).strip()
            agent = it.get("agent", "assistant")
            if agent not in personas.PERSONAS:
                agent = "assistant"
            if task:
                out.append({"task": task, "agent": agent})
        if out:
            return out[:6]
    # fallback: single task to the generalist
    return [{"task": goal, "agent": "assistant"}]


def run(goal: str, emit: Optional[Emit] = None, approver=None) -> str:
    """Run the crew on a goal. Returns the synthesized deliverable."""
    emit = emit or (lambda *a, **k: None)
    tasks = _plan_crew(goal)
    emit("crew_plan", tasks=tasks)

    shared: list[str] = []
    for i, t in enumerate(tasks, 1):
        agent, task = t["agent"], t["task"]
        p = personas.get(agent)
        emit("agent_start", n=i, total=len(tasks), agent=agent,
             agent_name=f"{p.icon} {p.name}", task=task)
        context = "\n\n".join(shared[-3:]) or "(you are first)"
        instruction = (
            f"You are {p.name}, part of an AI crew working toward this GOAL: {goal}\n\n"
            f"Prior teammates' results:\n{context}\n\n"
            f"YOUR TASK: {task}\n\nComplete it and report your result concisely.")
        answer = core.run(instruction, emit=emit, approver=approver, persona=agent)
        shared.append(f"[{p.name}] {task}\n{answer}")
        emit("agent_done", agent=agent, agent_name=f"{p.icon} {p.name}")

    # critic pass — a reviewer checks the combined work before the lead synthesizes
    critique = ""
    try:
        critique = ollama.generate(
            "You are a demanding reviewer. List concrete problems, gaps, or errors in the "
            f"team's work toward the goal — bullet points only.\n\nGOAL: {goal}\n\n"
            + "\n\n".join(shared), role="reasoner", options={"temperature": 0.3})
        emit("crew_critique", critique=critique)
    except Exception:
        pass

    synth_prompt = (
        "You are the crew lead. Combine your teammates' work into one clear, final "
        "deliverable for the user, fixing the issues the reviewer raised.\n\n"
        f"GOAL: {goal}\n\nTEAM OUTPUT:\n" + "\n\n".join(shared)
        + (f"\n\nREVIEWER NOTES:\n{critique}" if critique else ""))
    summary = ollama.generate(synth_prompt, role="general", options={"temperature": 0.4})
    emit("crew_done", summary=summary)
    return summary
