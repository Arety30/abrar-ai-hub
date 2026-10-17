"""Local map data store — JSON on disk, processed in Python.

Everything the agent queries lives here (offline). The scraper/API fetchers
upsert into this store when online; the agent reads it any time.
Also exports a compact TSV that the C++ geo engine reads for fast spatial queries.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ..config import DATA_DIR

MAPS_DIR = DATA_DIR / "maps"
PLACES_JSON = MAPS_DIR / "places.json"
PLACES_TSV = MAPS_DIR / "places.tsv"
MAPS_DIR.mkdir(parents=True, exist_ok=True)


def load() -> list[dict]:
    if PLACES_JSON.exists():
        try:
            return json.loads(PLACES_JSON.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _key(p: dict) -> str:
    return p.get("place_id") or f"{p.get('name','').lower()}|{round(p.get('lat',0),5)},{round(p.get('lng',0),5)}"


def upsert(new: list[dict]) -> int:
    """Merge new places into the store, de-duplicating. Returns count added/updated."""
    places = load()
    index = {_key(p): i for i, p in enumerate(places)}
    changed = 0
    for p in new:
        if not p.get("name"):
            continue
        p.setdefault("fetched_at", datetime.now().isoformat(timespec="seconds"))
        k = _key(p)
        if k in index:
            places[index[k]].update(p)
        else:
            index[k] = len(places)
            places.append(p)
        changed += 1
    save(places)
    return changed


def save(places: list[dict]) -> None:
    PLACES_JSON.write_text(json.dumps(places, ensure_ascii=False, indent=1), encoding="utf-8")
    _export_tsv(places)


def _export_tsv(places: list[dict]) -> None:
    """Flat file for the C++ geo engine: id<TAB>lat<TAB>lng<TAB>name<TAB>address."""
    lines = []
    for i, p in enumerate(places):
        name = str(p.get("name", "")).replace("\t", " ")
        addr = str(p.get("address", "")).replace("\t", " ")
        lines.append(f"{i}\t{p.get('lat',0)}\t{p.get('lng',0)}\t{name}\t{addr}")
    PLACES_TSV.write_text("\n".join(lines), encoding="utf-8")


def text_search(query: str, limit: int = 25) -> list[dict]:
    """Offline keyword search over cached places (name/address/types)."""
    q = (query or "").lower().strip()
    out = []
    for p in load():
        hay = f"{p.get('name','')} {p.get('address','')} {p.get('types','')}".lower()
        if not q or all(w in hay for w in q.split()):
            out.append(p)
    return out[:limit]


def count() -> int:
    return len(load())
