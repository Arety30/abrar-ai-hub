#!/usr/bin/env bash
# Launch the Abrar AI Hub command-line interface (local & offline).
set -e
cd "$(dirname "$0")/backend"
exec ./venv/bin/python -m app.cli
