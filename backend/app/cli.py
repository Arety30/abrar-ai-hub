"""Abrar AI Hub — command-line interface.

    python -m app.cli

A fully offline REPL over the same agent the desktop app uses. Streams tokens,
shows tool activity, and asks for approval before risky actions.
"""
from __future__ import annotations

import json
import sys

from . import db
from .config import APP_NAME, APP_TAGLINE
from .agent import core
from .agent.registry import registry
from .providers import ollama

# ANSI colours (red/green theme to match the desktop app)
R, G, DIM, BOLD, RST = "\033[91m", "\033[92m", "\033[2m", "\033[1m", "\033[0m"
CY = "\033[96m"

HELP = f"""{BOLD}Commands{RST}
  /help              show this help
  /mode <m>          set agent access: approval | yolo | sandbox
  /agent <key>       switch pre-built agent: assistant|study_partner|coder|brainstorm
  /agents            list pre-built agents
  /plan <goal>       autonomous multi-step plan & execute
  /crew <goal>       a team of AI agents collaborate on a goal
  /council <q>       ask several local models & synthesize
  /models            show model assignments
  /tools             list available tools
  /notes             list vault notes
  /mem               show long-term memory
  /clear             clear conversation history
  /quit              exit
Anything else is sent to the agent."""


def _approver(name: str, args: dict) -> bool:
    print(f"\n{R}⚠ approve tool{RST} {BOLD}{name}{RST}({DIM}{json.dumps(args)[:200]}{RST})")
    try:
        ans = input(f"  run it? [y/N] ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes")


def _emit(kind: str, **k):
    if kind == "token":
        sys.stdout.write(k.get("text", ""))
        sys.stdout.flush()
    elif kind == "tool_call":
        print(f"\n{CY}→ {k['name']}{RST} {DIM}{json.dumps(k['args'])[:160]}{RST}")
    elif kind == "tool_result":
        res = str(k.get("result", ""))
        print(f"{G}✓ {k['name']}{RST} {DIM}{res[:200].replace(chr(10), ' ')}{RST}")
    elif kind == "denied":
        print(f"{R}✗ denied {k['name']}{RST}")
    elif kind == "plan":
        print(f"\n{BOLD}Plan:{RST}")
        for i, st in enumerate(k.get("steps", []), 1):
            print(f"  {i}. {st}")
    elif kind == "plan_step":
        print(f"\n{R}▶ step {k['n']}/{k['total']}:{RST} {k['step']}")
    elif kind == "plan_done":
        print(f"\n{G}✓ plan complete{RST}")
    elif kind == "crew_plan":
        print(f"\n{BOLD}Crew plan:{RST}")
        for i, t in enumerate(k.get("tasks", []), 1):
            print(f"  {i}. [{t['agent']}] {t['task']}")
    elif kind == "agent_start":
        print(f"\n{R}▶ {k.get('agent_name', k.get('agent'))}:{RST} {k.get('task','')}")
    elif kind == "agent_done":
        print(f"{G}✓ {k.get('agent_name', k.get('agent'))} done{RST}")
    elif kind == "crew_critique":
        print(f"\n{DIM}🔎 reviewer: {k.get('critique','')[:200]}{RST}")
    elif kind == "crew_done":
        print(f"\n{BOLD}{G}✅ Deliverable:{RST}\n{k.get('summary','')}")
    elif kind == "error":
        print(f"{DIM}({k.get('message','')}){RST}")


def main() -> None:
    db.init_db()
    online = ollama.is_online()
    print(f"{R}{BOLD}{APP_NAME}{RST} {DIM}— {APP_TAGLINE}{RST}")
    if not online:
        print(f"{R}Ollama not reachable at 127.0.0.1:11434 — start it with `ollama serve`.{RST}")
    print(f"{DIM}Access mode: {db.get_setting('agent_access','approval')} · "
          f"type /help for commands{RST}\n")

    history: list[dict] = []
    persona = "assistant"
    while True:
        try:
            text = input(f"{G}you ▸ {RST}").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue

        if text.startswith("/"):
            cmd, _, arg = text[1:].partition(" ")
            arg = arg.strip()
            if cmd in ("quit", "exit", "q"):
                break
            elif cmd == "help":
                print(HELP)
            elif cmd == "mode":
                if arg in ("approval", "yolo", "sandbox"):
                    db.set_setting("agent_access", arg)
                    print(f"{DIM}access mode → {arg}{RST}")
                else:
                    print("usage: /mode approval|yolo|sandbox")
            elif cmd == "agents":
                from .agent import personas
                for p in personas.all():
                    mark = "→" if p.key == persona else " "
                    print(f" {mark} {BOLD}{p.key}{RST} {p.icon} {p.name} — {p.description}")
            elif cmd == "agent":
                from .agent import personas
                if arg in personas.PERSONAS:
                    persona = arg
                    p = personas.get(persona)
                    print(f"{DIM}switched to {p.icon} {p.name}{RST}")
                else:
                    print("usage: /agent assistant|study_partner|coder|brainstorm")
            elif cmd == "plan":
                if not arg:
                    print("usage: /plan <goal>")
                else:
                    from .agent import planner
                    print(f"{R}planning…{RST}")
                    planner.run(arg, emit=_emit, approver=_approver)
                    print()
            elif cmd == "crew":
                if not arg:
                    print("usage: /crew <goal>")
                else:
                    from .agent import crew
                    print(f"{R}assembling the crew…{RST}")
                    crew.run(arg, emit=_emit, approver=_approver)
                    print()
            elif cmd == "council":
                if not arg:
                    print("usage: /council <question>")
                else:
                    print(f"{DIM}consulting the council…{RST}")
                    res = ollama.deliberate(arg)
                    for m, op in res["opinions"].items():
                        print(f"{DIM}— {m}: {op[:120].replace(chr(10),' ')}{RST}")
                    print(f"{R}synthesis ▸ {RST}{res['answer']}\n")
            elif cmd == "models":
                print(json.dumps(ollama.models(), indent=2))
            elif cmd == "tools":
                for t in registry.all():
                    flag = f"{R}!{RST}" if t.danger else " "
                    print(f" {flag} {BOLD}{t.name}{RST} — {t.description}")
            elif cmd == "notes":
                from .agent.tools.kb_tools import list_notes
                print(list_notes())
            elif cmd == "mem":
                from .agent.tools.kb_tools import recall
                print(recall(""))
            elif cmd == "clear":
                history = []
                print(f"{DIM}history cleared{RST}")
            else:
                print(f"unknown command: /{cmd}")
            continue

        print(f"{R}ai ▸ {RST}", end="", flush=True)
        try:
            answer = core.run(text, history=history, emit=_emit, approver=_approver,
                              persona=persona)
        except Exception as e:
            print(f"\n{R}error: {e}{RST}")
            continue
        print("\n")
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        history = history[-16:]  # keep context bounded


if __name__ == "__main__":
    main()
