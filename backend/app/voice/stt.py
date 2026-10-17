"""Offline speech-to-text via faster-whisper. No network; model is lazy-loaded.

The first call downloads a small Whisper model IF online; once cached it runs
fully offline. Pre-cache with: app.voice.stt.warmup().
"""
from __future__ import annotations

import threading

_model = None
_lock = threading.Lock()
_MODEL_SIZE = "base"  # good accuracy/speed tradeoff on CPU


def _get():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


def warmup() -> None:
    with _lock:
        _get()


def transcribe(audio_path: str, language: str | None = None) -> str:
    """Transcribe a local audio/wav file to text."""
    with _lock:
        model = _get()
    segments, _info = model.transcribe(audio_path, language=language, vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments).strip()
