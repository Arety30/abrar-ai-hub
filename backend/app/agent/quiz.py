"""Quiz generation from study material — fully local.

Produces multiple-choice questions grounded in the user's documents & notes using
the local model, returning a validated structure the UI can present and score.
"""
from __future__ import annotations

import json

from sqlmodel import select

from .. import db
from ..models import Document, Note
from ..providers import ollama


def material(source: str = "All material") -> str:
    with db.get_session() as s:
        docs = s.exec(select(Document)).all()
        notes = s.exec(select(Note)).all()
    chunks = []
    for d in docs:
        if source in ("All material", d.title):
            chunks.append(f"# {d.title}\n{d.content}")
    if source == "All material":
        chunks += [f"# {n.name}\n{n.content}" for n in notes]
    return "\n\n".join(chunks)[:6000]


def sources() -> list[str]:
    with db.get_session() as s:
        docs = s.exec(select(Document)).all()
    return ["All material"] + [d.title for d in docs]


_EXAMPLE = (
    '[{"question":"Which process produces ATP in plant cells?",'
    '"options":["Photosynthesis","Digestion","Erosion","Fermentation"],'
    '"answer":0,"explanation":"Photosynthesis converts light into chemical energy (ATP)."}]')


def _extract_objects(raw: str) -> list:
    """Pull every JSON object out of a model reply, whether it's a proper array or
    just newline-separated objects (small models do both)."""
    raw = raw.replace("```json", "").replace("```", "")
    dec = json.JSONDecoder()
    objs: list = []
    i = 0
    while i < len(raw):
        while i < len(raw) and raw[i] not in "[{":
            i += 1
        if i >= len(raw):
            break
        try:
            val, end = dec.raw_decode(raw, i)
        except json.JSONDecodeError:
            i += 1
            continue
        if isinstance(val, list):
            objs.extend(x for x in val if isinstance(x, dict))
        elif isinstance(val, dict):
            objs.append(val)
        i = end
    return objs


_OPEN_EXAMPLE = (
    '[{"question":"Explain why evaporation needs energy.","answer":"Evaporation absorbs '
    'heat energy to turn liquid water into vapor."}]')


def generate(source: str = "All material", n: int = 5, qtype: str = "mcq") -> list[dict]:
    """Generate quiz questions.

    qtype: 'mcq' (multiple choice), 'open' (typed answer), or 'mixed'.
    MCQ items: {type:'mcq', question, options[4], answer:index, explanation}
    Open items: {type:'open', question, answer:reference}
    """
    text = material(source)
    if not text.strip():
        return []

    if qtype == "open":
        prompt = (
            f"Create {n} open-ended short-answer questions based ONLY on the study "
            "material. For each give a concise reference answer.\n"
            f"Reply with ONLY JSON like: {_OPEN_EXAMPLE}\n\nMATERIAL:\n{text}")
        schema = {"type": "object", "properties": {"questions": {"type": "array", "items": {
            "type": "object", "properties": {"question": {"type": "string"},
                                             "answer": {"type": "string"}},
            "required": ["question", "answer"]}}}, "required": ["questions"]}
    else:
        prompt = (
            f"You are a quiz generator. Create {n} multiple-choice questions based ONLY on "
            "the study material. Each needs exactly 4 REAL, distinct options (never "
            "placeholders like 'a'/'b'), with exactly one correct (answer = 0-based index).\n"
            f"Reply with ONLY JSON in this shape (no prose, no code fences):\n{_EXAMPLE}\n\n"
            f"MATERIAL:\n{text}")
        schema = {"type": "object", "properties": {"questions": {"type": "array", "items": {
            "type": "object", "properties": {"question": {"type": "string"},
                                             "options": {"type": "array", "items": {"type": "string"}},
                                             "answer": {"type": "integer"},
                                             "explanation": {"type": "string"}},
            "required": ["question", "options", "answer"]}}}, "required": ["questions"]}

    # Preferred path: constrained structured output (reliable even on small models).
    items: list = []
    data = ollama.generate_json(prompt, schema, role="general")
    if isinstance(data, dict) and isinstance(data.get("questions"), list):
        items = data["questions"]
    if not items:  # fallback: free-text parse
        for _ in range(2):
            raw = ollama.generate(prompt, role="general", options={"temperature": 0.3})
            items = _extract_objects(raw)
            if items:
                break

    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        q = str(it.get("question", "")).strip()
        if not q:
            continue
        if qtype == "open":
            out.append({"type": "open", "question": q,
                        "answer": str(it.get("answer", ""))})
        else:
            opts = it.get("options") or []
            if not isinstance(opts, list) or len(opts) < 2:
                continue
            opts = [str(o) for o in opts][:4]
            try:
                ans = int(it.get("answer", 0))
            except Exception:
                ans = 0
            out.append({"type": "mcq", "question": q, "options": opts,
                        "answer": max(0, min(ans, len(opts) - 1)),
                        "explanation": str(it.get("explanation", ""))})
    if qtype == "mixed" and len(out) > 1:
        # convert half the MCQs into open questions
        for it in out[::2]:
            it["type"] = "open"
            it["answer"] = it["options"][it["answer"]] if it.get("options") else it.get("answer")
            it.pop("options", None)
    return out[:n]


def grade_open(question: str, reference: str, user_answer: str) -> dict:
    """Grade a typed answer with the local model. Returns {score 0-1, correct, feedback}."""
    if not user_answer.strip():
        return {"score": 0.0, "correct": False, "feedback": "No answer given."}
    prompt = (
        "Grade the student's answer against the reference answer. Award a HIGH score "
        "(0.8-1.0) if it is semantically correct, even if brief, differently worded, or a "
        "synonym. Only give low scores when it is actually wrong or missing. "
        'Reply ONLY as JSON: {"score": <0..1>, "feedback": "<one short sentence>"}.\n\n'
        f"QUESTION: {question}\nREFERENCE ANSWER: {reference}\nSTUDENT ANSWER: {user_answer}")
    import json
    raw = ollama.generate(prompt, role="general", options={"temperature": 0.0})
    start, end = raw.find("{"), raw.rfind("}")
    try:
        data = json.loads(raw[start:end + 1])
        score = float(data.get("score", 0))
    except Exception:
        # lenient fallback: keyword overlap
        ref_words = set(reference.lower().split())
        hit = len(ref_words & set(user_answer.lower().split()))
        score = min(1.0, hit / max(3, len(ref_words) * 0.4))
        return {"score": score, "correct": score >= 0.5,
                "feedback": "Auto-graded by keyword overlap."}
    score = max(0.0, min(1.0, score))
    return {"score": score, "correct": score >= 0.5,
            "feedback": str(data.get("feedback", ""))}


def save_attempt(source: str, score: int, total: int) -> None:
    from ..models import QuizAttempt
    with db.get_session() as s:
        s.add(QuizAttempt(source=source, score=score, total=total))
        s.commit()


def history(limit: int = 10) -> list:
    from ..models import QuizAttempt
    with db.get_session() as s:
        return s.exec(select(QuizAttempt).order_by(QuizAttempt.id.desc())).all()[:limit]
