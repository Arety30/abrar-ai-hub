"""Central configuration for Abrar AI Hub — 100% local & offline.

Every setting has a safe local default. Nothing here reaches the internet;
the only network calls the app ever makes are to a local Ollama server on
127.0.0.1. Settings persist in the SQLite DB (see models.Setting) and can be
overridden by environment variables for power users.
"""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(os.getenv("AIHUB_ROOT", Path(__file__).resolve().parents[2]))
DATA_DIR = Path(os.getenv("AIHUB_DATA", ROOT / "data"))
WORKSPACE_DIR = Path(os.getenv("AIHUB_WORKSPACE", ROOT / "workspace"))
PLUGINS_DIR = Path(os.getenv("AIHUB_PLUGINS", ROOT / "plugins"))
DB_PATH = Path(os.getenv("AIHUB_DB", DATA_DIR / "aihub.db"))

for _d in (DATA_DIR, WORKSPACE_DIR, PLUGINS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Local LLM (Ollama) — the only "backend" and it's on localhost
# ---------------------------------------------------------------------------
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")

# Sensible defaults picked from the models actually installed locally.
# All overridable at runtime via Settings UI.
DEFAULT_MODELS = {
    "general": os.getenv("AIHUB_MODEL_GENERAL", "gemma3:1b"),
    # `tools` MUST be a function-calling-capable model (gemma can't call tools),
    # so agent tool turns route here regardless of the general model.
    "tools": os.getenv("AIHUB_MODEL_TOOLS", "llama3.2:1b"),
    "coder": os.getenv("AIHUB_MODEL_CODER", "qwen2.5-coder:1.5b"),
    "reasoner": os.getenv("AIHUB_MODEL_REASONER", "deepseek-r1:1.5b"),
    "vision": os.getenv("AIHUB_MODEL_VISION", "granite3.2-vision:2b"),
    "router": os.getenv("AIHUB_MODEL_ROUTER", "gemma3:1b"),
}

# ---------------------------------------------------------------------------
# Agent behaviour
# ---------------------------------------------------------------------------
# How much power the autonomous agent has over the real machine:
#   "approval" - can run shell/file writes but each risky action needs a click
#   "yolo"     - runs everything without asking (the gemini.md "YOLO mode")
#   "sandbox"  - file/shell restricted to WORKSPACE_DIR, no arbitrary system access
AGENT_ACCESS_MODE = os.getenv("AIHUB_AGENT_ACCESS", "approval")

MAX_AGENT_STEPS = int(os.getenv("AIHUB_MAX_STEPS", "12"))
OFFLINE_ONLY = os.getenv("AIHUB_OFFLINE", "1") == "1"  # block any online-only tool

APP_NAME = "Abrar AI Hub"
APP_TAGLINE = "Local · Offline · Autonomous"
