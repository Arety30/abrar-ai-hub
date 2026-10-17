"""The autonomous agent loop — local, offline, tool-using.

Uses Ollama function-calling so a local model can decide which tools to run.
Dangerous tools (shell, file writes, document generation) pass through an
approval gate governed by the agent-access setting. Emits structured events so
any UI (CLI or CustomTkinter) can show the agent's reasoning and tool activity.
"""
from __future__ import annotations

import json
from typing import Callable, Optional

from sqlmodel import select

from .. import db
from ..config import APP_NAME, MAX_AGENT_STEPS
from ..models import Memory
from ..providers import ollama
from .registry import registry
from .safety import access_mode
from . import personas
from .personas import Persona
from . import tools as _tools  # noqa: F401  (registers built-ins)

# event(kind, **data) -> None ; kinds: token, tool_call, tool_result, denied, step, done, error
Emit = Callable[..., None]
# approver(tool_name, args) -> bool
Approver = Optional[Callable[[str, dict], bool]]


def _study_context() -> str:
    """Concatenate study documents + notes for grounded personas."""
    from ..models import Document, Note
    with db.get_session() as s:
        docs = s.exec(select(Document)).all()
        notes = s.exec(select(Note)).all()
    chunks = [f"# {d.title}\n{d.content}" for d in docs]
    chunks += [f"# {n.name}\n{n.content}" for n in notes]
    return "\n\n".join(chunks)[:6000]


def _system_prompt(persona: Persona) -> str:
    from datetime import datetime
    with db.get_session() as s:
        mems = s.exec(select(Memory).order_by(Memory.id.desc())).all()[:12]
    mem_block = "\n".join(f"- {m.text}" for m in mems) or "(none yet)"

    base = (
        f"You are {APP_NAME}, a fully local, offline AI running on the user's own "
        f"machine. Today is {datetime.now():%A %d %B %Y}. You have NO internet access — "
        "never claim to browse the web.\n\n"
        f"ACTIVE MODE: {persona.name} — {persona.description}\n{persona.system}\n\n"
    )
    if persona.use_tools:
        base += ("You can take real actions on this computer by calling tools. Prefer "
                 f"calling a tool over describing it. Available tools: {', '.join(registry.names())}. "
                 "Chain tools when useful and never invent tool output.\n\n")
    if persona.grounded:
        material = _study_context() or "(no study material added yet)"
        base += f"STUDY MATERIAL (ground your help in this):\n{material}\n\n"
    base += f"Long-term memory about the user:\n{mem_block}"
    return base


def _disabled_plugins() -> set[str]:
    from ..models import Plugin
    with db.get_session() as s:
        rows = s.exec(select(Plugin)).all()
    return {p.slug for p in rows if not p.enabled}


def run(
    user_text: str,
    history: Optional[list[dict]] = None,
    emit: Optional[Emit] = None,
    approver: Approver = None,
    persona: "Persona | str" = "assistant",
) -> str:
    """Run one agent turn as the given pre-built agent (persona)."""
    emit = emit or (lambda *a, **k: None)
    if isinstance(persona, str):
        persona = personas.get(persona)
    schemas = registry.enabled_schemas(_disabled_plugins()) if persona.use_tools else None
    opts = {"temperature": persona.temperature}

    messages: list[dict] = [{"role": "system", "content": _system_prompt(persona)}]
    messages += history or []
    messages.append({"role": "user", "content": user_text})

    role = persona.role or ollama.smart_route(user_text)
    mode = access_mode()

    # Personas without tools are a straight streamed conversation.
    if not persona.use_tools:
        text = ollama.chat_stream(messages, role=role, options=opts,
                                  on_token=lambda t: emit("token", text=t))
        emit("done", text=text)
        return text

    # Tool turns must run on a tool-capable model regardless of routing.
    tool_role = ollama.tool_role(role)

    for step in range(MAX_AGENT_STEPS):
        emit("step", n=step + 1)
        try:
            msg = ollama.chat(messages, role=tool_role, tools=schemas, options=opts)
        except Exception as e:
            # model may not support tools — fall back to a plain streamed answer
            emit("error", message=f"tool-call unsupported, plain reply ({e})")
            text = ollama.chat_stream(messages, role=role, options=opts,
                                      on_token=lambda t: emit("token", text=t))
            emit("done", text=text)
            return text

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            text = ollama.strip_think(msg.get("content", "") or "")
            # stream it out for a live feel
            emit("token", text=text)
            emit("done", text=text)
            return text

        # record the assistant's decision to call tools
        messages.append({"role": "assistant", "content": msg.get("content", ""),
                         "tool_calls": tool_calls})

        for call in tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            args = fn.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {}
            tool = registry.get(name)
            emit("tool_call", name=name, args=args)

            if tool is None:
                result = f"Unknown tool: {name}"
            elif tool.danger and mode == "approval" and not _approved(approver, name, args):
                result = f"User denied permission to run '{name}'."
                emit("denied", name=name, args=args)
            else:
                try:
                    result = tool.func(**args)
                except Exception as e:
                    result = f"Tool error: {type(e).__name__}: {e}"
            emit("tool_result", name=name, result=result)
            messages.append({"role": "tool", "name": name, "content": str(result)})

    # ran out of steps — ask for a final summary
    messages.append({"role": "user",
                     "content": "Summarise what you did and the final answer, concisely."})
    text = ollama.chat_stream(messages, role=role,
                              on_token=lambda t: emit("token", text=t))
    emit("done", text=text)
    return text


def _approved(approver: Approver, name: str, args: dict) -> bool:
    if approver is None:
        return False  # no way to ask → deny in approval mode
    try:
        return bool(approver(name, args))
    except Exception:
        return False
