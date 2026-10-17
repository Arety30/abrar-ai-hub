"""Map tools — the agent reads cached map data OFFLINE; refreshes via the
Google API or the Playwright scraper when there's a connection.

Pipeline: scraper/API (online) → local JSON store (python) → TSV → C++ geo engine.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from ..registry import registry
from ...maps import store, google

_GEO_BIN = Path(__file__).resolve().parents[2] / "maps" / "geo_query"


def _refresh(query: str, max_results: int = 20) -> int:
    """Populate the local store from the API (preferred) or the scraper. Online only."""
    if not google.is_online():
        return 0
    places = []
    if google.get_key():
        places = google.text_search(query)          # API path (reliable)
    if not places:
        try:
            from ...maps import scraper
            places = scraper.scrape(query, max_results=max_results)   # website scrape
        except Exception:
            places = []
    return store.upsert(places) if places else 0


@registry.tool(
    "map_search",
    "Search local map data for places (name/type/area). Works offline from the "
    "cache; if nothing is cached and you're online, it fetches then caches.",
    {"query": {"type": "string", "description": "e.g. 'coffee shops in Karachi'"}},
    plugin="maps",
)
def map_search(query: str) -> str:
    hits = store.text_search(query)
    if not hits:
        added = _refresh(query)
        if added:
            hits = store.text_search(query)
    if not hits:
        return (f"No cached places for '{query}'. "
                + ("Offline — connect and try map_refresh." if not google.is_online()
                   else "Nothing found."))
    lines = [f"• {p['name']}" + (f" — {p['address']}" if p.get('address') else "")
             + (f"  ({p['lat']:.4f},{p['lng']:.4f})" if p.get('lat') else "")
             + (f"  ★{p['rating']}" if p.get('rating') else "")
             for p in hits[:20]]
    return f"{len(hits)} place(s) for '{query}':\n" + "\n".join(lines)


@registry.tool(
    "map_refresh",
    "Fetch fresh map data for a query from the Google API / website and cache it "
    "locally (requires an internet connection).",
    {
        "query": {"type": "string", "description": "Search to fetch, e.g. 'pharmacies near me'"},
        "max_results": {"type": "integer", "description": "Max places", "_optional": True},
    },
    plugin="maps",
)
def map_refresh(query: str, max_results: int = 20) -> str:
    if not google.is_online():
        return "No internet connection — cannot refresh. The cache still works offline."
    added = _refresh(query, max_results)
    return (f"Cached {added} place(s) for '{query}'. Total in store: {store.count()}."
            if added else f"Couldn't fetch results for '{query}' (check the API key / try again).")


@registry.tool(
    "map_near",
    "Find cached places near a coordinate, ranked by distance (fast C++ geo engine). Offline.",
    {
        "lat": {"type": "number", "description": "Latitude"},
        "lng": {"type": "number", "description": "Longitude"},
        "radius_km": {"type": "number", "description": "Search radius in km", "_optional": True},
    },
    plugin="maps",
)
def map_near(lat: float, lng: float, radius_km: float = 5.0) -> str:
    if not _GEO_BIN.exists():
        return "Geo engine not built. Run: g++ -O2 -o geo_query geo_query.cpp"
    if not store.PLACES_TSV.exists() or store.count() == 0:
        return "No cached map data yet — use map_refresh first."
    try:
        proc = subprocess.run([str(_GEO_BIN), str(store.PLACES_TSV), "near",
                               str(lat), str(lng), str(radius_km)],
                              capture_output=True, text=True, timeout=20)
    except Exception as e:
        return f"Geo query failed: {e}"
    rows = [r for r in proc.stdout.strip().splitlines() if r]
    if not rows:
        return f"No cached places within {radius_km} km of ({lat},{lng})."
    out = []
    for r in rows[:20]:
        parts = r.split("\t")
        if len(parts) >= 4:
            out.append(f"• {parts[2]} — {parts[1]} km" + (f" · {parts[3]}" if parts[3] else ""))
    return f"Places within {radius_km} km:\n" + "\n".join(out)


@registry.tool(
    "geocode",
    "Turn an address into coordinates. Uses the local cache first (offline); "
    "fetches from Google if online and not cached.",
    {"address": {"type": "string", "description": "An address or place name"}},
    plugin="maps",
)
def geocode(address: str) -> str:
    from ... import db
    from ...models import GeoCache
    from sqlmodel import select
    q = address.strip().lower()
    with db.get_session() as s:
        row = s.exec(select(GeoCache).where(GeoCache.query == q)).first()
    if row:
        return f"{row.formatted_address} → {row.lat:.5f}, {row.lng:.5f} (cached)"
    if not google.is_online() or not google.get_key():
        return "Not cached and offline (or no API key) — can't geocode right now."
    res = google.geocode(address)
    if not res:
        return f"Couldn't geocode '{address}'."
    with db.get_session() as s:
        s.add(GeoCache(query=q, formatted_address=res["formatted_address"],
                       lat=res["lat"], lng=res["lng"], kind="geocode"))
        s.commit()
    return f"{res['formatted_address']} → {res['lat']:.5f}, {res['lng']:.5f}"
