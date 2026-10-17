"""Offline text-to-speech via pyttsx3 (espeak/nsss). No network, lazy-init."""
from __future__ import annotations

import threading

_engine = None
_lock = threading.Lock()


def _get():
    global _engine
    if _engine is None:
        import pyttsx3
        _engine = pyttsx3.init()
        _engine.setProperty("rate", 175)
    return _engine


def available() -> bool:
    try:
        _get()
        return True
    except Exception:
        return False


def speak(text: str) -> None:
    """Blocking speak. Call from a worker thread to avoid freezing a UI."""
    if not text:
        return
    with _lock:
        eng = _get()
        eng.say(text)
        eng.runAndWait()


def save(text: str, path: str) -> str:
    with _lock:
        eng = _get()
        eng.save_to_file(text, path)
        eng.runAndWait()
    return path
