"""Tool registry for the autonomous agent.

Every capability the agent can use is a Tool: a name, a JSON-schema parameter
spec (so local models can call it via Ollama function-calling), a python
callable, and a `danger` flag that decides whether the approval gate fires.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict            # JSON schema (properties + required)
    func: Callable[..., str]
    danger: bool = False        # writes/executes on the real machine
    plugin: str = "core"        # owning plugin slug (for enable/disable)

    def schema(self) -> dict:
        """Ollama / OpenAI tool schema."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters,
                    "required": [k for k, v in self.parameters.items()
                                 if not v.get("_optional")],
                },
            },
        }


class Registry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def add(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def tool(self, name: str, description: str, parameters: dict | None = None,
             danger: bool = False, plugin: str = "core"):
        def deco(fn: Callable[..., str]) -> Callable[..., str]:
            self.add(Tool(name, description, parameters or {}, fn, danger, plugin))
            return fn
        return deco

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def enabled_schemas(self, disabled_plugins: set[str]) -> list[dict]:
        return [t.schema() for t in self._tools.values()
                if t.plugin not in disabled_plugins]

    def names(self) -> list[str]:
        return list(self._tools)


# Global registry; tool modules register into it on import.
registry = Registry()
