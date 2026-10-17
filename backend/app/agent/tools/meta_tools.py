"""Meta tools: multi-model council deliberation (offline)."""
from __future__ import annotations

from ..registry import registry
from ...providers import ollama


@registry.tool(
    "council",
    "Ask several local models the same question and return a synthesized best answer. "
    "Use for hard/important questions where a second opinion helps.",
    {"question": {"type": "string", "description": "The question to deliberate on"}},
    plugin="council",
)
def council(question: str) -> str:
    result = ollama.deliberate(question)
    return result["answer"]
