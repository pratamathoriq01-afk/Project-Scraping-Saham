"""
Layer 1 Primary Scraper — TradingView Indonesia Scanner API (< 0.4s batch).

Features:
  - Direct JSON POST to https://scanner.tradingview.com/indonesia/scan
  - Pulls live OHLC (open, high, low, close), 52W High/Low, EV/EBITDA, valuation,
    margins, balance sheet ratios, and technicals (RSI, SMA20, SMA200, ATR, Pivot S1/R1)
  - Automatic HTTP-400 safe-column fallback so column deprecation never breaks service
  - Full mapping to the 11 Official IDX-IC Sectors + 3-layer precision banking classifier
"""

from __future__ import annotations

import re
import time
from typing import Any

import httpx

from quant_engine.utils import safe_divide, safe_float, safe_int
from scrapers.circuit_breaker import circuit_breaker

TV_SCAN_URL = "https://scanner.tradingview.com/indonesia/scan"
TV_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.tradingview.com",
    "Referer": "https://www.tradingview.com/markets/stocks-indonesia/market-movers-all-stocks/",
}

TV_PRIMARY_COLUMNS: list[str] = [
    "name",
    "description",
    "sector",
    "industry",
    "open",
    "high",
    "low",
    "close",
    "change",
    "change_abs",
    "volume",
    "market_cap_basic",
    "price_earnings_ttm",
    "price_book_fq",
    "enterprise_value_ebitda_ttm",
    "return_on_equity",
    "return_on_assets",
    "debt_to_equity",
    "current_ratio",
    "quick_ratio",
    "gross_margin",
    "operating_margin",
    "net_margin",
    "dividends_yield_current",
    "earnings_per_share_basic_ttm",
    "book_value_per_share_fq",
    "RSI",
    "SMA20",
    "SMA200",
    "ATR",
    "Pivot.M.Classic.S1",
    "Pivot.M.Classic.R1",
    "price_52_week_high",
    "price_52_week_low",
]

TV_FALLBACK_COLUMNS: list[str] = [
    "name",
    "description",
    "sector",
    "open",
    "high",
    "low",
    "close",
    "change",
    "change_abs",
    "volume",
    "market_cap_basic",
    "price_earnings_ttm",
    "price_book_fq",
    "return_on_equity",
    "return_on_assets",
    "debt_to_equity",
    "dividends_yield_current",
    "earnings_per_share_basic_ttm",
    "book_value_per_share_fq",
    "RSI",
    "SMA20",
    "SMA200",
    "ATR",
    "price_52_week_high",
    "price_52_week_low",
]

IDX_BANK_TICKERS: set[str] = {
    "BBCA", "BMRI", "BBRI", "BBNI", "BRIS", "BBTN", "BNGA", "BDMN", "NISP",
    "PNBN", "MEGA", "BTPN", "BTPS", "ARTO", "BBYB", "BBHI", "AGRO", "BJBR",
    "BJTM", "BNBA", "BNII", "BNLI", "MAYA", "SDRA", "BSIM", "BACA", "BABP",
    "BGTG", "BINA", "BKSW", "BMAS", "BVIC", "DNAR", "INPC", "MASB", "MCOR",
    "NOBU", "BSWD", "AGRS", "BEKS", "BANK", "AMAR", "BBSI", "BCIC", "BBNP",
    "SUPA",
}

IDX_COMMODITY_TICKERS: set[str] = {
    "ADRO", "AADI", "PTBA", "ITMG", "ANTM", "MEDC", "INDY", "HRUM", "BUMI",
    "BYAN", "INCO", "MDKA", "MBMA", "NCKL", "PGAS", "AKRA", "ELSA", "AALI",
    "LSIP", "DSNG", "TAPG", "TINS", "BRMS", "AMMN", "DSSA", "GEMS", "KKGI",
    "DOID", "ENRG", "ESSA", "PTRO", "MBAP", "TOBA", "MYOH", "PSAB", "NICL",
}

TICKER_RE = re.compile(r"^[A-Z]{4}$")
BANK_NAME_RE = re.compile(r"\bbank\b", re.IGNORECASE)


def map_tv_sector_to_idx_ic(tv_sector: str | None, tv_industry: str | None = None) -> str:
    """Map TradingView English sector/industry cleanly into the 11 Official BEI IDX-IC sectors."""
    sec = (tv_sector or "").strip().lower()
    ind = (tv_industry or "").strip().lower()

    if "real estate" in ind or "property" in ind or "reit" in ind or "homebuilding" in ind:
        return "Properti & Real Estat"

    if sec == "finance":
        return "Perbankan & Keuangan"

    if sec in {"energy minerals"} or any(
        k in ind for k in ("coal", "oil & gas", "petroleum", "oilfield", "energy")
    ):
        return "Energi & Tambang"

    if sec == "non-energy minerals":
        if any(
            k in ind
            for k in ("mining", "metals", "gold", "silver", "nickel", "mineral", "aluminum", "copper")
        ):
            return "Energi & Tambang"
        return "Barang Baku"

    if sec == "process industries":
        if any(k in ind for k in ("agricultural", "palm", "plantation", "fish")):
            return "Consumer Non-Cyclicals"
        return "Barang Baku"

    if sec in {"consumer non-durables"} or any(
        k in ind for k in ("food", "beverage", "tobacco", "household", "personal products", "supermarket")
    ):
        return "Consumer Non-Cyclicals"

    if sec in {"consumer durables", "consumer services", "retail trade", "distribution services"}:
        if any(k in ind for k in ("food retail", "drugstore", "grocery")):
            return "Consumer Non-Cyclicals"
        return "Consumer Cyclicals"

    if sec in {"health technology", "health services"} or any(
        k in ind for k in ("pharma", "hospital", "medical", "health")
    ):
        return "Kesehatan"

    if sec in {"technology services", "electronic technology"}:
        return "Teknologi"

    if sec in {"communications", "utilities"} or any(
        k in ind for k in ("telecom", "wireless", "electric", "toll", "construction", "engineering")
    ):
        return "Infrastruktur"

    if sec == "transportation":
        return "Transportasi & Logistik"

    if sec in {"producer manufacturing", "industrial services", "commercial services"}:
        return "Perindustrian"

    return "Perindustrian"


def classify_accounting_type(
    ticker: str,
    company_name: str,
    tv_sector: str | None,
    tv_industry: str | None,
) -> str:
    """3-layer precision accounting classification: banking | commodity | general."""
    code = ticker.upper()
    ind = (tv_industry or "").lower()
    sec = (tv_sector or "").lower()
    name = (company_name or "").lower()

    if (
        code in IDX_BANK_TICKERS
        or any(k in ind for k in ("major banks", "regional banks", "savings banks"))
        or (
            BANK_NAME_RE.search(name) is not None
            and "non-bank" not in name
            and "multifinance" not in name
        )
    ):
        return "banking"

    if (
        code in IDX_COMMODITY_TICKERS
        or sec in {"energy minerals", "non-energy minerals"}
        or any(
            k in ind
            for k in (
                "coal",
                "oil",
                "gas",
                "mining",
                "metals",
                "gold",
                "nickel",
                "mineral",
                "plantation",
                "palm",
            )
        )
    ):
        return "commodity"

    return "general"


def _normalize_tv_record(
    raw_symbol: str,
    values: list[Any],
    columns: list[str],
) -> dict[str, Any] | None:
    """Convert raw TradingView scanner row into normalized EquiLens schema."""
    row = {col: values[idx] if idx < len(values) else None for idx, col in enumerate(columns)}
    ticker = str(row.get("name") or raw_symbol.split(":")[-1]).strip().upper()
    if not TICKER_RE.fullmatch(ticker):
        return None

    company_name = str(row.get("description") or ticker).strip()
    tv_sector = row.get("sector")
    tv_industry = row.get("industry")
    sector_idx = map_tv_sector_to_idx_ic(tv_sector, tv_industry)
    accounting_type = classify_accounting_type(ticker, company_name, tv_sector, tv_industry)

    close = safe_float(row.get("close"))
    change_pct = safe_float(row.get("change"))
    change_abs = safe_float(row.get("change_abs"))
    prev_close = (
        round(close - change_abs, 2)
        if close is not None and change_abs is not None
        else None
    )

    atr_abs = safe_float(row.get("ATR"))
    atr_ratio = safe_divide(atr_abs, close)
    atr_pct = round(atr_ratio * 100.0, 2) if atr_ratio is not None else None

    der_raw = safe_float(row.get("debt_to_equity"))
    if der_raw is not None and accounting_type != "banking" and der_raw > 30.0:
        der_raw = round(der_raw / 100.0, 2)

    return {
        "ticker": ticker,
        "company_name": company_name,
        "sector_idx": sector_idx,
        "subsector_idx": str(tv_industry or tv_sector or "").strip(),
        "accounting_type": accounting_type,
        "open": safe_float(row.get("open")),
        "high": safe_float(row.get("high")),
        "low": safe_float(row.get("low")),
        "live_price": close,
        "prev_close": prev_close,
        "change_abs": change_abs,
        "change_pct": round(change_pct, 2) if change_pct is not None else None,
        "volume": safe_int(row.get("volume"), 0),
        "market_cap": safe_float(row.get("market_cap_basic")),
        "per_ttm": safe_float(row.get("price_earnings_ttm")),
        "pbv_current": safe_float(row.get("price_book_fq")),
        "ev_ebitda": None if accounting_type == "banking" else safe_float(row.get("enterprise_value_ebitda_ttm")),
        "roe": safe_float(row.get("return_on_equity")),
        "roa": safe_float(row.get("return_on_assets")),
        "der": der_raw,
        "current_ratio": None if accounting_type == "banking" else safe_float(row.get("current_ratio")),
        "quick_ratio": None if accounting_type == "banking" else safe_float(row.get("quick_ratio")),
        "gpm": None if accounting_type == "banking" else safe_float(row.get("gross_margin")),
        "opm": safe_float(row.get("operating_margin")),
        "npm": safe_float(row.get("net_margin")),
        "div_yield": safe_float(row.get("dividends_yield_current")),
        "eps_ttm": safe_float(row.get("earnings_per_share_basic_ttm")),
        "bvps": safe_float(row.get("book_value_per_share_fq")),
        "rsi14": safe_float(row.get("RSI")),
        "ma20": safe_float(row.get("SMA20")),
        "ma200": safe_float(row.get("SMA200")),
        "atr_pct": atr_pct,
        "support1": safe_float(row.get("Pivot.M.Classic.S1")),
        "resistance1": safe_float(row.get("Pivot.M.Classic.R1")),
        "high_52w": safe_float(row.get("price_52_week_high")),
        "low_52w": safe_float(row.get("price_52_week_low")),
        "source": "TRADINGVIEW",
    }


async def _post_tv_scan(
    payload: dict[str, Any],
    timeout_sec: float = 8.0,
) -> tuple[list[dict[str, Any]], list[str]]:
    """POST to TradingView Scanner with automatic HTTP-400 column fallback & transient retry."""
    if not circuit_breaker.can_execute("TRADINGVIEW"):
        raise RuntimeError("Circuit breaker TRADINGVIEW sedang OPEN")

    columns_to_try = [TV_PRIMARY_COLUMNS, TV_FALLBACK_COLUMNS]
    last_exc: Exception | None = None

    start = time.perf_counter()
    async with httpx.AsyncClient(headers=TV_HEADERS, timeout=timeout_sec) as client:
        for cols in columns_to_try:
            body = {**payload, "columns": cols}
            for attempt in range(2):
                try:
                    resp = await client.post(TV_SCAN_URL, json=body)
                    if resp.status_code == 400 and cols is TV_PRIMARY_COLUMNS:
                        break
                    resp.raise_for_status()
                    data = resp.json()
                    latency_ms = (time.perf_counter() - start) * 1000.0
                    circuit_breaker.record_success("TRADINGVIEW", latency_ms)
                    return data.get("data", []), cols
                except httpx.TimeoutException as exc:
                    last_exc = exc
                    if attempt == 0:
                        continue
                    break
                except Exception as exc:
                    last_exc = exc
                    break
            else:
                continue
            if isinstance(last_exc, httpx.HTTPStatusError) and last_exc.response.status_code == 400:
                continue
            if last_exc is None:
                continue

    latency_ms = (time.perf_counter() - start) * 1000.0
    err_msg = repr(last_exc) if last_exc is not None else "TradingView request failed"
    circuit_breaker.record_failure("TRADINGVIEW", err_msg, latency_ms)
    raise RuntimeError(f"TradingView scan gagal: {err_msg}")


async def fetch_all_idx_directory(limit: int = 1200) -> list[dict[str, Any]]:
    """Fetch all ~840-940 active IDX stocks in a single TradingView Scanner batch call."""
    payload = {
        "filter": [
            {"left": "exchange", "operation": "equal", "right": "IDX"},
            {"left": "type", "operation": "equal", "right": "stock"},
        ],
        "options": {"lang": "en"},
        "markets": ["indonesia"],
        "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"},
        "range": [0, limit],
    }

    raw_rows, used_cols = await _post_tv_scan(payload, timeout_sec=15.0)
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    for entry in raw_rows:
        sym = str(entry.get("s", ""))
        vals = entry.get("d", [])
        norm = _normalize_tv_record(sym, vals, used_cols)
        if norm and norm["ticker"] not in seen:
            seen.add(norm["ticker"])
            results.append(norm)

    return results


async def fetch_batch_tv_quotes(tickers: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch live real-time snapshot for 1-10 IDX stocks simultaneously."""
    clean = [t.strip().upper() for t in tickers if t.strip()]
    if not clean:
        return {}

    tv_symbols = [f"IDX:{t}" for t in clean]
    payload = {
        "symbols": {
            "tickers": tv_symbols,
            "query": {"types": []},
        },
        "options": {"lang": "en"},
    }

    raw_rows, used_cols = await _post_tv_scan(payload, timeout_sec=5.0)
    mapped: dict[str, dict[str, Any]] = {}
    for entry in raw_rows:
        sym = str(entry.get("s", ""))
        vals = entry.get("d", [])
        norm = _normalize_tv_record(sym, vals, used_cols)
        if norm:
            mapped[norm["ticker"]] = norm

    return mapped
