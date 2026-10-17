"""Local LLM access via Ollama (127.0.0.1). No cloud, ever.

Wraps the `ollama` python client and adds:
  - a model registry sourced from Settings (general/coder/reasoner/vision)
  - a lightweight local router that picks the right model per task
  - streaming chat, tool-calling chat, plain generate, and vision
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Iterator, Optional

import ollama

from ..config import OLLAMA_HOST, DEFAULT_MODELS
from ..db import get_setting

_client = ollama.Client(host=OLLAMA_HOST)

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def strip_think(text: str) -> str:
    """deepseek-r1 emits <think>…</think>; hide it from the user."""
    return _THINK_RE.sub("", text or "").strip()


def models() -> dict[str, str]:
    """Current model assignments (Settings override the defaults)."""
    raw = get_setting("models")
    if raw:
        try:
            data = DEFAULT_MODELS | json.loads(raw)
            return data
        except Exception:
            pass
    return dict(DEFAULT_MODELS)


def installed() -> list[str]:
    try:
        resp = _client.list()
        return [m.get("model") or m.get("name") for m in resp.get("models", [])]
    except Exception:
        return []


def is_online() -> bool:
    """Is the local Ollama server reachable?"""
    try:
        _client.list()
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Routing: classify a user turn to a model role, fully locally.
# ---------------------------------------------------------------------------
_CODE_HINT = re.compile(
    r"\b(code|python|javascript|bug|function|regex|compile|traceback|refactor|"
    r"script|sql|api|class|npm|pip|git)\b", re.I)


def route(text: str) -> str:
    """Return a model role ('coder' | 'reasoner' | 'general') using cheap heuristics.

    Kept heuristic (not an LLM call) so it's instant and never blocks offline.
    """
    if _CODE_HINT.search(text or ""):
        return "coder"
    if len(text or "") > 400 or re.search(r"\b(why|reason|prove|step by step|plan)\b", text, re.I):
        return "reasoner"
    return "general"


def model_for(role: str) -> str:
    m = models()
    return m.get(role, m["general"])


# preference order of small, memory-light local models to fall back to on error/OOM
_FALLBACK_ORDER = ["llama3.2:1b", "gemma3:1b", "deepseek-coder:1.3b"]


def _fallback_model(current: str) -> Optional[str]:
    """Pick a smaller installed model different from `current` (brain.py OOM idea)."""
    inst = set(installed())
    for cand in _FALLBACK_ORDER:
        if cand in inst and cand != current:
            return cand
    for cand in inst:
        if cand != current:
            return cand
    return None


# Models that reliably support Ollama function-calling. Reasoning/vision/gemma
# models don't, so tool turns must not be routed to them.
_TOOL_CAPABLE = ("llama3.1", "llama3.2", "llama3.3", "llama4",
                 "qwen2.5", "qwen3", "mistral", "command-r", "hermes", "firefunction")


def is_tool_capable(model: str) -> bool:
    m = (model or "").lower()
    return any(x in m for x in _TOOL_CAPABLE)


def tool_role(role: str) -> str:
    """Return a role whose model can call tools.

    If the requested role's model can't (e.g. gemma/deepseek-r1/vision), fall back
    to the dedicated 'tools' model, then 'general' as a last resort.
    """
    if is_tool_capable(model_for(role)):
        return role
    if is_tool_capable(model_for("tools")):
        return "tools"
    return role


def smart_route(text: str) -> str:
    """LLM-assisted routing: ask the router model to classify the task.

    Falls back to the heuristic route() on any error so it never blocks offline.
    """
    try:
        prompt = ("Classify this request into exactly one word: CODING, REASONING, or "
                  f"GENERAL. Reply with only the word.\n\nRequest: {text}")
        resp = _client.generate(model=model_for("router"), prompt=prompt,
                                options={"temperature": 0.0, "num_predict": 4})
        word = strip_think(resp.get("response", "")).upper()
        if "COD" in word:
            return "coder"
        if "REAS" in word:
            return "reasoner"
        return "general"
    except Exception:
        return route(text)


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
def chat(
    messages: list[dict],
    role: str = "general",
    tools: Optional[list[dict]] = None,
    options: Optional[dict] = None,
) -> dict:
    """One-shot chat. Returns the raw ollama message dict (may contain tool_calls)."""
    model = model_for(role)
    try:
        resp = _client.chat(model=model, messages=messages, tools=tools,
                            options=options or {"temperature": 0.6})
    except Exception as e:
        fb = _fallback_model(model)
        if not fb:
            raise
        # tools may be why it failed; retry small model, tools kept
        resp = _client.chat(model=fb, messages=messages, tools=tools,
                            options=options or {"temperature": 0.6})
    return resp["message"]


def chat_stream(
    messages: list[dict],
    role: str = "general",
    options: Optional[dict] = None,
    on_token: Optional[Callable[[str], None]] = None,
) -> str:
    """Streaming chat; calls on_token for each chunk and returns the full text."""
    def _stream(model: str) -> list[str]:
        acc: list[str] = []
        for part in _client.chat(model=model, messages=messages, stream=True,
                                 options=options or {"temperature": 0.6}):
            tok = part.get("message", {}).get("content", "")
            if tok:
                acc.append(tok)
                if on_token:
                    on_token(tok)
        return acc

    model = model_for(role)
    try:
        full = _stream(model)
    except Exception:
        fb = _fallback_model(model)
        if not fb:
            raise
        full = _stream(fb)
    return strip_think("".join(full))


def generate(prompt: str, role: str = "general", options: Optional[dict] = None) -> str:
    model = model_for(role)
    try:
        resp = _client.generate(model=model, prompt=prompt,
                                options=options or {"temperature": 0.5})
    except Exception:
        fb = _fallback_model(model)
        if not fb:
            raise
        resp = _client.generate(model=fb, prompt=prompt,
                                options=options or {"temperature": 0.5})
    return strip_think(resp.get("response", ""))


def generate_json(prompt: str, schema: dict, role: str = "general",
                  options: Optional[dict] = None):
    """Constrained JSON generation via Ollama's structured-output `format`.

    Forces the local model to emit JSON matching `schema` (works even with models
    that are bad at free-form JSON, like gemma). Returns the parsed object or None.
    """
    model = model_for(role)
    try:
        resp = _client.generate(model=model, prompt=prompt, format=schema,
                                options=options or {"temperature": 0.2})
    except Exception:
        fb = _fallback_model(model)
        if not fb:
            return None
        try:
            resp = _client.generate(model=fb, prompt=prompt, format=schema,
                                    options=options or {"temperature": 0.2})
        except Exception:
            return None
    try:
        return json.loads(strip_think(resp.get("response", "")))
    except Exception:
        return None


def deliberate(question: str, roles: Optional[list[str]] = None) -> dict:
    """Council mode: ask several local models, then synthesize (council.py idea).

    Returns {"answer": synthesized, "opinions": {model: text}}. Fully offline.
    """
    roles = roles or ["general", "reasoner", "coder"]
    seen: set[str] = set()
    opinions: dict[str, str] = {}
    for r in roles:
        mdl = model_for(r)
        if mdl in seen:
            continue
        seen.add(mdl)
        try:
            opinions[mdl] = generate(question, role=r, options={"temperature": 0.7})
        except Exception as e:
            opinions[mdl] = f"(unavailable: {e})"

    panel = "\n\n".join(f"### {m}\n{t}" for m, t in opinions.items())
    synth_prompt = (
        "Several local AI models answered the same question. Synthesize their best "
        "points into one clear, correct, concise final answer. Resolve disagreements "
        f"sensibly.\n\nQUESTION: {question}\n\nPANEL:\n{panel}\n\nFINAL ANSWER:")
    try:
        answer = generate(synth_prompt, role="general", options={"temperature": 0.4})
    except Exception:
        answer = next(iter(opinions.values()), "")
    return {"answer": answer, "opinions": opinions}


def vision(prompt: str, image_paths: list[str]) -> str:
    """Describe/answer about local image files using the local vision model."""
    resp = _client.chat(
        model=model_for("vision"),
        messages=[{"role": "user", "content": prompt, "images": image_paths}],
    )
    return strip_think(resp["message"].get("content", ""))
