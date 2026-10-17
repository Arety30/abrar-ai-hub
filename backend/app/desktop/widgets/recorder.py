"""Microphone capture to a local WAV file (offline). Uses sounddevice."""
from __future__ import annotations

from ...config import DATA_DIR

SAMPLE_RATE = 16000


def available() -> bool:
    try:
        import sounddevice  # noqa: F401
        import soundfile    # noqa: F401
        return True
    except Exception:
        return False


def record_wav(seconds: float = 4.0, path: str | None = None) -> str:
    import numpy as np
    import sounddevice as sd
    import soundfile as sf

    out = path or str(DATA_DIR / "mic_capture.wav")
    frames = int(seconds * SAMPLE_RATE)
    audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=1, dtype="float32")
    sd.wait()
    sf.write(out, np.squeeze(audio), SAMPLE_RATE)
    return out
