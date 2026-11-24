"""
EquiLens Backend API — FastAPI Server (Port 8000).

Endpoints:
  - GET /api/health
  - GET /api/sources/health
  - GET /api/stocks/search?q=&sector=&limit=30
  - GET /api/stocks/presets
  - GET /api/compare?tickers=BBCA,ADRO,ICBP&force_refresh=false
  - GET /api/charts/{ticker}?timeframe=1Y&compare=ADRO,ICBP
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.supabase_manager import db_manager
from quant_engine.utils import now_wib_display, safe_float, sanitize_for_json
from scrapers.circuit_breaker import circuit_breaker
from scrapers.orchestrator import (
    orchestrate_chart_bundle,
    orchestrate_comparison,
    persist_comparison_updates,
)
from scrapers.yahoo_scraper import fetch_yf_financial_statements


class StrictJSONResponse(Response):
    """Forces RFC-8259 strict JSON serialization (allow_nan=False) on every API response."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        clean = sanitize_for_json(content)
        return json.dumps(
            clean,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")


app = FastAPI(
    title="EquiLens IDX Quantitative Backend API",
    version="1.0.0",
    description=(
        "4-Layer Live Scraping + Circuit Breaker + Triple/Quad-Check Audit + "
        "Supabase 4-Kamar Quantitative Engine for BEI (IDX) Stocks."
    ),
    default_response_class=StrictJSONResponse,
)

_extra_origins = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        *_extra_origins,
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$|^https://[a-zA-Z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STOCK_PRESETS: list[dict[str, Any]] = [
    {
        "id": "big4-perbankan",
        "title": "Big 4 Perbankan",
        "subtitle": "BBCA • BMRI • BBRI • BBNI",
        "sectorLabel": "Perbankan & Keuangan",
        "tickers": ["BBCA", "BMRI", "BBRI", "BBNI"],
    },
    {
        "id": "pemimpin-batubara",
        "title": "Pemimpin Batu Bara & Energi",
        "subtitle": "ADRO • ITMG • PTBA • MEDC",
        "sectorLabel": "Energi & Tambang",
        "tickers": ["ADRO", "ITMG", "PTBA", "MEDC"],
    },
    {
        "id": "defensive-consumer",
        "title": "Defensive Consumer",
        "subtitle": "ICBP • INDF • MYOR • AMRT",
        "sectorLabel": "Consumer Non-Cyclicals",
        "tickers": ["ICBP", "INDF", "MYOR", "AMRT"],
    },
    {
        "id": "infra-otomotif",
        "title": "Infrastruktur & Konglomerasi",
        "subtitle": "TLKM • ISAT • ASII",
        "sectorLabel": "Infrastruktur",
        "tickers": ["TLKM", "ISAT", "ASII"],
    },
    {
        "id": "bluechip-dividen",
        "title": "Pemburu Dividen BEI",
        "subtitle": "ITMG • PTBA • BBRI • ASII • ADRO",
        "sectorLabel": "Mode Lintas Sektor",
        "tickers": ["ITMG", "PTBA", "BBRI", "ASII", "ADRO"],
    },
    {
        "id": "cross-sector-default",
        "title": "Lintas Sektor (Default)",
        "subtitle": "BBCA • ADRO • ICBP",
        "sectorLabel": "Mode Lintas Sektor",
        "tickers": ["BBCA", "ADRO", "ICBP"],
    },
]


@app.get("/")
async def get_root() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "equilens-backend",
        "message": "EquiLens IDX Quantitative Backend API is running.",
        "endpoints": {
            "health": "/api/health",
            "sourcesHealth": "/api/sources/health",
            "search": "/api/stocks/search?q=BBCA",
            "compare": "/api/compare?tickers=BBCA,ADRO,ICBP",
            "charts": "/api/charts/BBCA?timeframe=1Y",
            "financials": "/api/financials/BBCA?period=annual",
            "docs": "/docs",
        },
        "syncedAt": now_wib_display(),
    }


@app.get("/api/health")
async def get_health() -> dict[str, Any]:
    sb = await db_manager.check_health()
    if sb["healthy"]:
        circuit_breaker.record_success("SUPABASE_BEI", sb["latency_ms"])
    else:
        circuit_breaker.record_failure(
            "SUPABASE_BEI", sb.get("error") or "Supabase unavailable", sb["latency_ms"]
        )

    return {
        "status": "ok",
        "service": "equilens-backend",
        "supabaseHealthy": sb["healthy"],
        "supabaseMode": sb["mode"],
        "masterEmitenCount": sb["master_count"],
        "syncedAt": now_wib_display(),
    }


@app.get("/api/sources/health")
async def get_sources_health() -> dict[str, Any]:
    sb = await db_manager.check_health()
    if sb["healthy"]:
        circuit_breaker.record_success("SUPABASE_BEI", sb["latency_ms"])
    else:
        circuit_breaker.record_failure(
            "SUPABASE_BEI", sb.get("error") or "Supabase unavailable", sb["latency_ms"]
        )

    sources = circuit_breaker.get_all_status()
    return {
        "status": "ok",
        "masterEmitenCount": sb["master_count"],
        "supabase": sb,
        "sources": sources,
        "syncedAt": now_wib_display(),
    }


@app.get("/api/stocks/presets")
async def get_stock_presets() -> dict[str, Any]:
    return {
        "presets": STOCK_PRESETS,
        "count": len(STOCK_PRESETS),
    }


@app.get("/api/stocks/search")
async def search_stocks(
    q: str = Query(default="", max_length=64),
    sector: str = Query(default="", max_length=64),
    limit: int = Query(default=30, ge=1, le=50),
) -> dict[str, Any]:
    directory = await db_manager.fetch_all_master_emiten()
    live_caps = await db_manager.fetch_all_live_market_caps()

    query = q.strip().lower()
    sec_filter = sector.strip().lower()
    if sec_filter in {"semua", "all", "mode lintas sektor", ""}:
        sec_filter = ""

    scored: list[tuple[int, float, dict[str, Any]]] = []

    for row in directory:
        ticker = str(row.get("ticker") or "").upper()
        name = str(row.get("company_name") or "")
        sec = str(row.get("sector_idx") or "Lainnya")
        subsec = str(row.get("subsector_idx") or "")

        if sec_filter and sec_filter not in sec.lower():
            continue

        t_low = ticker.lower()
        n_low = name.lower()
        s_low = sec.lower()
        sub_low = subsec.lower()

        if query:
            rank = 0
            if t_low == query:
                rank = 100
            elif t_low.startswith(query):
                rank = 85
            elif query in t_low:
                rank = 65
            elif n_low.startswith(query):
                rank = 55
            elif query in n_low:
                rank = 45
            elif query in sub_low or query in s_low:
                rank = 25
            if rank == 0:
                continue
        else:
            rank = 10

        live = live_caps.get(ticker) or {}
        mcap = safe_float(live.get("market_cap"), 0.0) or 0.0
        item = {
            "ticker": ticker,
            "name": name,
            "sector": sec,
            "subsector": subsec,
            "accountingType": row.get("accounting_type", "general"),
            "price": safe_float(live.get("live_price")),
            "changePercent": safe_float(live.get("change_pct")),
            "marketCap": mcap if mcap > 0 else None,
            "quantScore": live.get("quant_score"),
            "verdictStatus": live.get("verdict_status"),
        }
        scored.append((rank, mcap, item))

    scored.sort(key=lambda entry: (-entry[0], -entry[1], entry[2]["ticker"]))
    total_matches = len(scored)
    items = [entry[2] for entry in scored[:limit]]

    return {
        "query": q,
        "sector": sector or "Semua",
        "totalMatches": total_matches,
        "totalUniverse": len(directory),
        "items": items,
    }


@app.get("/api/compare")
async def compare_stocks(
    background_tasks: BackgroundTasks,
    tickers: str = Query(
        default="BBCA,ADRO,ICBP",
        description="Daftar 1-5 kode saham BEI dipisahkan koma (misal BBCA,ADRO,ICBP)",
    ),
    force_refresh: bool = Query(default=False),
) -> dict[str, Any]:
    parsed = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not parsed:
        raise HTTPException(
            status_code=400, detail="Minimal 1 kode saham BEI harus diberikan."
        )
    if len(parsed) > 5:
        parsed = parsed[:5]

    payload, m_upserts, f_upserts, l_upserts, a_upserts = await orchestrate_comparison(
        parsed, force_refresh=force_refresh
    )

    if not payload.get("stocks"):
        raise HTTPException(
            status_code=404,
            detail=f"Data saham untuk {','.join(parsed)} tidak ditemukan dari seluruh sumber.",
        )

    if m_upserts or f_upserts or l_upserts or a_upserts:
        background_tasks.add_task(
            persist_comparison_updates, m_upserts, f_upserts, l_upserts, a_upserts
        )

    return payload


@app.get("/api/charts/{ticker}")
async def get_stock_chart(
    ticker: str,
    timeframe: str = Query(default="1Y", pattern="^(1M|3M|1Y|5Y|1m|3m|1y|5y)$"),
    compare: str = Query(default=""),
) -> dict[str, Any]:
    code = ticker.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Ticker tidak valid.")

    peers = [c.strip().upper() for c in compare.split(",") if c.strip()]
    try:
        return await orchestrate_chart_bundle(
            ticker=code,
            timeframe=timeframe.upper(),
            compare_tickers=peers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/financials/{ticker}")
async def get_stock_financials(
    ticker: str,
    period: str = Query(default="annual", pattern="^(annual|quarterly)$"),
) -> dict[str, Any]:
    """Return real multi-period Income Statement, Balance Sheet, and Cash Flow in Miliar IDR."""
    code = ticker.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Ticker tidak valid.")

    cache_key = f"financials:{code}:{period}"
    cached = db_manager.chart_cache.get(cache_key)
    if cached is not None:
        return cached

    data = await fetch_yf_financial_statements(code, period=period)
    if data is None:
        raise HTTPException(
            status_code=503,
            detail=f"Laporan keuangan {code} ({period}) sementara tidak tersedia dari sumber data.",
        )

    data["syncedAt"] = now_wib_display()
    db_manager.chart_cache.set(cache_key, data, ttl=900.0)
    return data
