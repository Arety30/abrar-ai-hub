"""Online map fetcher (Google Maps Platform). Only used when there's a
connection; results are cached locally so the agent can read them offline.

The API key is read from the `google_maps_key` setting (or GOOGLE_MAPS_KEY env),
never hard-coded. Set it with:  db.set_setting("google_maps_key", "...")
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

from ..db import get_setting

_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json"
_TEXT = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_NEARBY = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"


def get_key() -> str:
    return get_setting("google_maps_key", "") or os.getenv("GOOGLE_MAPS_KEY", "")


def is_online(timeout: float = 4.0) -> bool:
    """Quick connectivity probe (does not use the API quota)."""
    try:
        httpx.head("https://maps.googleapis.com/", timeout=timeout)
        return True
    except Exception:
        return False


def available() -> bool:
    return bool(get_key()) and is_online()


def _get(url: str, params: dict) -> Optional[dict]:
    key = get_key()
    if not key:
        return None
    params = {**params, "key": key}
    try:
        r = httpx.get(url, params=params, timeout=12)
        return r.json()
    except Exception:
        return None


def geocode(address: str) -> Optional[dict]:
    data = _get(_GEOCODE, {"address": address})
    if not data or not data.get("results"):
        return None
    res = data["results"][0]
    loc = res["geometry"]["location"]
    return {"formatted_address": res.get("formatted_address", ""),
            "lat": loc["lat"], "lng": loc["lng"],
            "place_id": res.get("place_id", ""), "raw": res}


def reverse_geocode(lat: float, lng: float) -> Optional[dict]:
    data = _get(_GEOCODE, {"latlng": f"{lat},{lng}"})
    if not data or not data.get("results"):
        return None
    res = data["results"][0]
    return {"formatted_address": res.get("formatted_address", ""),
            "lat": lat, "lng": lng, "place_id": res.get("place_id", ""), "raw": res}


def _norm_place(p: dict) -> dict:
    loc = (p.get("geometry", {}) or {}).get("location", {}) or {}
    return {
        "place_id": p.get("place_id", ""),
        "name": p.get("name", ""),
        "address": p.get("formatted_address") or p.get("vicinity", ""),
        "lat": loc.get("lat", 0.0), "lng": loc.get("lng", 0.0),
        "types": ",".join(p.get("types", []) or []),
        "rating": float(p.get("rating", 0) or 0),
        "raw": p,
    }


def text_search(query: str) -> list[dict]:
    data = _get(_TEXT, {"query": query})
    if not data:
        return []
    return [_norm_place(p) for p in data.get("results", [])]


def nearby(lat: float, lng: float, radius: int = 1500, ptype: str = "") -> list[dict]:
    params = {"location": f"{lat},{lng}", "radius": radius}
    if ptype:
        params["type"] = ptype
    data = _get(_NEARBY, params)
    if not data:
        return []
    return [_norm_place(p) for p in data.get("results", [])]


def details(place_id: str) -> dict:
    data = _get(_DETAILS, {"place_id": place_id,
                           "fields": "name,formatted_address,formatted_phone_number,website,rating"})
    return (data or {}).get("result", {}) if data else {}
