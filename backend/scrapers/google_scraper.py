"""
Layer 3 Emergency Live Fallback Scraper — Google Finance (TICKER:IDX).

4-tier resilient parser supporting both Google Finance's embedded quote JSON payload
and DOM price selectors (`span[jsname="Pdsbrc"]`, `data-last-price`, `div.YMlKec.fxKbKc`).
"""

from __future__ import annotations

import re
import time
from typing import Any

import httpx
from bs4 import BeautifulSoup

from quant_engine.utils import safe_float
from scrapers.circuit_breaker import circuit_breaker

GF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

PRICE_NUM_RE = re.compile(r"([0-9][0-9,]*\.?[0-9]*)")


def _parse_gf_price_text(raw_text: str | None) -> float | None:
    if not raw_text:
        return None
    cleaned = (
        raw_text.replace("\xa0", " ")
        .replace("Rp", "")
        .replace("IDR", "")
        .strip()
    )
    match = PRICE_NUM_RE.search(cleaned)
    if not match:
        return None
    return safe_float(match.group(1).replace(",", ""))


def _extract_from_embedded_json(
    html: str,
    gf_code: str,
) -> tuple[float | None, float | None, float | None, float | None]:
    """
    Match Google Finance embedded quote payload:
      ["BBCA","IDX"],"Bank Central Asia Tbk PT",0,"IDR",[5675,125,2.2522523,...],null,5550
    Returns (live_price, prev_close, change_abs, change_pct).
    """
    sym_escaped = re.escape(gf_code)
    pattern = re.compile(
        rf'\["{sym_escaped}","IDX"\],"[^"]*",\d+,"[A-Z]{{3}}",\[([0-9.+-]+),([0-9.+-]+),([0-9.+-]+)[^\]]*\],null,([0-9.+-]+)'
    )
    m = pattern.search(html)
    if m:
        live_price = safe_float(m.group(1))
        change_abs = safe_float(m.group(2))
        change_pct = safe_float(m.group(3))
        prev_close = safe_float(m.group(4))
        if live_price is not None and live_price > 0:
            return live_price, prev_close, change_abs, change_pct

    # Secondary embedded array pattern
    pattern2 = re.compile(
        rf'\[null,\["{sym_escaped}","IDX"\]\],null,[0-9.+-]+,"[^"]+",[0-9.+-]+,[0-9.+-]+,([0-9.+-]+),\d+,([0-9.+-]+),\d+,([0-9.+-]+),\d+,"[A-Z]{{3}}","{sym_escaped}:IDX","[^"]*",([0-9.+-]+)'
    )
    m2 = pattern2.search(html)
    if m2:
        live_price = safe_float(m2.group(1))
        change_abs = safe_float(m2.group(2))
        change_pct = safe_float(m2.group(3))
        prev_close = safe_float(m2.group(4))
        if live_price is not None and live_price > 0:
            return live_price, prev_close, change_abs, change_pct

    return None, None, None, None


def _extract_from_html(html: str, ticker: str, gf_code: str) -> dict[str, Any] | None:
    live_price, prev_close, change_abs, change_pct = _extract_from_embedded_json(
        html, gf_code
    )

    if live_price is None:
        soup = BeautifulSoup(html, "lxml")

        # Tier 2: Current Google Finance live price span
        pds_el = soup.select_one('span[jsname="Pdsbrc"]')
        if pds_el is not None:
            live_price = _parse_gf_price_text(pds_el.get_text(" ", strip=True))

        # Tier 3: Structured data-last-price attribute
        if live_price is None:
            node = soup.find(attrs={"data-last-price": True})
            if node is not None:
                live_price = safe_float(node.get("data-last-price"))
                prev_close = safe_float(node.get("data-previous-close"))

        # Tier 4: Legacy YMlKec.fxKbKc selector
        if live_price is None:
            price_el = soup.select_one("div.YMlKec.fxKbKc")
            if price_el is not None:
                live_price = _parse_gf_price_text(price_el.get_text(" ", strip=True))

    if live_price is None or live_price <= 0:
        return None

    if change_abs is None and prev_close is not None and prev_close > 0:
        change_abs = round(live_price - prev_close, 2)
    if change_pct is None and prev_close is not None and prev_close > 0:
        change_pct = round(((live_price - prev_close) / prev_close) * 100.0, 2)

    return {
        "ticker": ticker.strip().upper(),
        "live_price": round(live_price, 2),
        "prev_close": round(prev_close, 2) if prev_close is not None else None,
        "change_abs": round(change_abs, 2) if change_abs is not None else None,
        "change_pct": round(change_pct, 2) if change_pct is not None else None,
        "source": "GOOGLE_FINANCE",
    }


async def _fetch_gf_html(url: str, timeout_sec: float = 4.0) -> str:
    try:
        from curl_cffi.requests import AsyncSession

        async with AsyncSession(impersonate="chrome", timeout=timeout_sec) as session:
            resp = await session.get(url, headers=GF_HEADERS)
            resp.raise_for_status()
            return resp.text
    except Exception:
        async with httpx.AsyncClient(
            headers=GF_HEADERS, timeout=timeout_sec, follow_redirects=True
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text


async def fetch_google_finance_quote(
    ticker: str,
    timeout_sec: float = 4.5,
) -> dict[str, Any] | None:
    """Fetch live quote fallback from Google Finance IDX page."""
    if not circuit_breaker.can_execute("GOOGLE_FINANCE"):
        return None

    code = ticker.strip().upper()
    gf_code = "COMPOSITE" if code in {"IHSG", "^JKSE", "JKSE"} else code
    url = f"https://www.google.com/finance/quote/{gf_code}:IDX?hl=en"

    start = time.perf_counter()
    try:
        html = await _fetch_gf_html(url, timeout_sec=timeout_sec)
        parsed = _extract_from_html(html, code, gf_code)
        latency_ms = (time.perf_counter() - start) * 1000.0
        if parsed is None:
            circuit_breaker.record_failure(
                "GOOGLE_FINANCE", f"Gagal parse harga untuk {gf_code}:IDX", latency_ms
            )
            return None
        circuit_breaker.record_success("GOOGLE_FINANCE", latency_ms)
        return parsed
    except Exception as exc:
        circuit_breaker.record_failure(
            "GOOGLE_FINANCE", str(exc), (time.perf_counter() - start) * 1000.0
        )
        return None
