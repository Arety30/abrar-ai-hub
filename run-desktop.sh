#!/usr/bin/env bash
# Launch the Abrar AI Hub desktop app (local & offline).
set -e
cd "$(dirname "$0")/backend"
if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "⚠  Ollama doesn't look like it's running. Start it with:  ollama serve"
fi
exec ./venv/bin/python -m app.desktop
