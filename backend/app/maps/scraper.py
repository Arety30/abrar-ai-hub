"""Playwright/Chromium scraper for maps.google.com.

Best-effort: opens Google Maps search, handles the consent wall, scrolls the
results feed, and extracts place name + coordinates (from each result URL) plus
best-effort address/rating. Results are upserted into the local JSON store so the
agent can read them offline. Runs headless; sync API (safe inside worker threads).

NOTE: scraping the Maps website is against Google's ToS and the DOM changes
often — expect to tweak selectors. The API fetcher (google.py) is more reliable.
"""
from __future__ import annotations

import re
import time
from urllib.parse import quote_plus

_COORD = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)")


def available() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except Exception:
        return False


def _dismiss_consent(page):
    for sel in ('button[aria-label*="Accept all"]', 'button:has-text("Accept all")',
                'button:has-text("Reject all")', 'form[action*="consent"] button'):
        try:
            btn = page.locator(sel).first
            if btn.count():
                btn.click(timeout=3000)
                page.wait_for_timeout(1200)
                return
        except Exception:
            continue


def scrape(query: str, max_results: int = 20, headless: bool = True) -> list[dict]:
    from playwright.sync_api import sync_playwright

    url = f"https://www.google.com/maps/search/{quote_plus(query)}?hl=en"
    out: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page(locale="en-US",
                                user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                                            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"))
        try:
            page.goto(url, timeout=45000, wait_until="domcontentloaded")
            _dismiss_consent(page)
            # results feed
            try:
                page.wait_for_selector('div[role="feed"], a.hfpxzc', timeout=15000)
            except Exception:
                pass
            # scroll the feed to load more cards
            for _ in range(8):
                try:
                    page.mouse.wheel(0, 3000)
                    page.wait_for_timeout(900)
                    if page.locator("a.hfpxzc").count() >= max_results:
                        break
                except Exception:
                    break

            cards = page.locator("a.hfpxzc")
            n = min(cards.count(), max_results)
            for i in range(n):
                try:
                    a = cards.nth(i)
                    name = (a.get_attribute("aria-label") or "").strip()
                    href = a.get_attribute("href") or ""
                    m = _COORD.search(href)
                    lat, lng = (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)
                    # best-effort address/rating from the parent card
                    addr, rating = "", 0.0
                    try:
                        card = a.locator("xpath=..")
                        txt = card.inner_text(timeout=1500)
                        rm = re.search(r"(\d\.\d)\s*(?:star|\()", txt)
                        rating = float(rm.group(1)) if rm else 0.0
                        # address = last comma-y line that isn't the name/rating
                        for ln in reversed(txt.splitlines()):
                            ln = ln.strip()
                            if ln and ln != name and any(c.isalpha() for c in ln) and "·" not in ln:
                                addr = ln; break
                    except Exception:
                        pass
                    if name:
                        out.append({"name": name, "address": addr, "lat": lat, "lng": lng,
                                    "rating": rating, "types": "", "place_id": "",
                                    "source": "scrape", "query": query, "url": href})
                except Exception:
                    continue
        finally:
            browser.close()
    return out
