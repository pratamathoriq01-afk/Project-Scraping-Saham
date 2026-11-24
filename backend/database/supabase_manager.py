"""
Supabase 4-Kamar Connector, In-Memory TTL Cache, and Atomic Local JSON Fallback.

Tables managed (strictly UPSERT-only to guarantee zero duplicate rows):
  1. master_emiten        -> on_conflict="ticker"
  2. fundamental_kuartal  -> on_conflict="ticker,period"
  3. live_market_cache    -> on_conflict="ticker"
  4. audit_validasi       -> on_conflict="ticker,metric_key"
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from quant_engine.utils import now_wib_iso, sanitize_for_json

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BACKEND_DIR / ".env"
LOCAL_FALLBACK_PATH = (
    Path("/tmp/equilens_local_fallback_cache.json")
    if os.getenv("VERCEL")
    else Path(__file__).resolve().parent / "local_fallback_cache.json"
)

# Load backend/.env without overriding process env vars
load_dotenv(ENV_PATH, override=False)

VALID_AUDIT_DB_STATUSES = {"verified", "minor_diff", "bei_anchor", "failover_active"}
VALID_ACCOUNTING_TYPES = {"banking", "commodity", "general"}


class TTLCache:
    """Lightweight thread-safe in-memory TTL cache."""

    def __init__(self, default_ttl: float = 15.0, max_entries: int = 2000) -> None:
        self._default_ttl = default_ttl
        self._max_entries = max_entries
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if now >= expires_at:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        expires_at = time.monotonic() + (ttl if ttl is not None else self._default_ttl)
        with self._lock:
            if len(self._store) >= self._max_entries:
                # Evict expired entries first, then oldest ~10%
                now = time.monotonic()
                expired = [k for k, (exp, _) in self._store.items() if now >= exp]
                for k in expired:
                    self._store.pop(k, None)
                if len(self._store) >= self._max_entries:
                    for k in list(self._store.keys())[: max(1, self._max_entries // 10)]:
                        self._store.pop(k, None)
            self._store[key] = (expires_at, value)

    def invalidate(self, prefix: str | None = None) -> None:
        with self._lock:
            if prefix is None:
                self._store.clear()
            else:
                for k in [k for k in self._store if k.startswith(prefix)]:
                    self._store.pop(k, None)


class SupabaseManager:
    """Thread-safe Supabase 4-Kamar connector with TTL caching and local JSON fallback."""

    def __init__(self) -> None:
        self.url: str = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or ""
        ).strip()
        # Support both new Supabase Secret Key (sb_secret_...) & legacy Service Role Key
        self.write_key: str = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SECRET_KEY")
            or ""
        ).strip()
        self.read_key: str = (
            os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("SUPABASE_PUBLISHABLE_KEY")
            or self.write_key
        ).strip()

        self._client: Client | None = None
        self._client_lock = threading.Lock()
        self._fallback_lock = threading.Lock()

        # Fast TTL caches: 15s live quotes, 15m (900s) 5Y OHLCV history, 5m directory
        self.live_cache = TTLCache(default_ttl=15.0, max_entries=1500)
        self.chart_cache = TTLCache(default_ttl=900.0, max_entries=600)
        self.directory_cache = TTLCache(default_ttl=300.0, max_entries=20)

        self._fallback_data: dict[str, dict[str, Any]] = self._load_local_fallback()

    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.write_key)

    def _get_client(self) -> Client | None:
        if not self.is_configured:
            return None
        if self._client is not None:
            return self._client
        with self._client_lock:
            if self._client is None:
                self._client = create_client(self.url, self.write_key)
        return self._client

    def _load_local_fallback(self) -> dict[str, dict[str, Any]]:
        empty: dict[str, dict[str, Any]] = {
            "master_emiten": {},
            "fundamental_kuartal": {},
            "live_market_cache": {},
            "audit_validasi": {},
        }
        if not LOCAL_FALLBACK_PATH.exists():
            return empty
        try:
            with LOCAL_FALLBACK_PATH.open("r", encoding="utf-8") as fh:
                loaded = json.load(fh)
            if isinstance(loaded, dict):
                for key in empty:
                    if isinstance(loaded.get(key), dict):
                        empty[key] = loaded[key]
        except Exception:
            pass
        return empty

    def _persist_local_fallback(self) -> None:
        with self._fallback_lock:
            try:
                tmp_path = LOCAL_FALLBACK_PATH.with_suffix(".tmp")
                payload = sanitize_for_json(self._fallback_data)
                with tmp_path.open("w", encoding="utf-8") as fh:
                    json.dump(payload, fh, ensure_ascii=False, allow_nan=False)
                tmp_path.replace(LOCAL_FALLBACK_PATH)
            except Exception:
                pass

    def _chunked(self, rows: list[dict[str, Any]], size: int = 250) -> list[list[dict[str, Any]]]:
        return [rows[i : i + size] for i in range(0, len(rows), size)]

    # ------------------------------------------------------------------
    # HEALTH CHECK
    # ------------------------------------------------------------------
    def check_health_sync(self) -> dict[str, Any]:
        start = time.perf_counter()
        client = self._get_client()
        if client is None:
            return {
                "healthy": False,
                "latency_ms": 0.0,
                "master_count": len(self._fallback_data["master_emiten"]),
                "mode": "local_fallback",
                "error": "SUPABASE_URL atau SUPABASE_SECRET_KEY belum terkonfigurasi",
            }
        try:
            res = (
                client.table("master_emiten")
                .select("ticker", count="exact")
                .limit(1)
                .execute()
            )
            latency_ms = round((time.perf_counter() - start) * 1000.0, 1)
            total = res.count if res.count is not None else len(res.data or [])
            return {
                "healthy": True,
                "latency_ms": latency_ms,
                "master_count": int(total),
                "mode": "supabase_live",
                "error": None,
            }
        except Exception as exc:
            latency_ms = round((time.perf_counter() - start) * 1000.0, 1)
            return {
                "healthy": False,
                "latency_ms": latency_ms,
                "master_count": len(self._fallback_data["master_emiten"]),
                "mode": "local_fallback",
                "error": str(exc)[:220],
            }

    async def check_health(self) -> dict[str, Any]:
        return await asyncio.to_thread(self.check_health_sync)

    # ------------------------------------------------------------------
    # KAMAR 1: master_emiten (on_conflict="ticker")
    # ------------------------------------------------------------------
    def upsert_master_emiten_sync(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        if not rows:
            return {"count": 0, "persisted_remote": False}

        now = now_wib_iso()
        dedup: dict[str, dict[str, Any]] = {}
        for r in rows:
            ticker = str(r.get("ticker", "")).strip().upper()
            if not ticker:
                continue
            acct = str(r.get("accounting_type", "general")).lower()
            if acct not in VALID_ACCOUNTING_TYPES:
                acct = "general"
            clean_row = sanitize_for_json(
                {
                    "ticker": ticker,
                    "company_name": str(r.get("company_name") or ticker).strip(),
                    "sector_idx": str(r.get("sector_idx") or "Lainnya").strip(),
                    "subsector_idx": str(r.get("subsector_idx") or "").strip(),
                    "accounting_type": acct,
                    "board": str(r.get("board") or "Utama").strip(),
                    "is_active": bool(r.get("is_active", True)),
                    "updated_at": now,
                }
            )
            dedup[ticker] = clean_row

        payload = list(dedup.values())
        with self._fallback_lock:
            for item in payload:
                self._fallback_data["master_emiten"][item["ticker"]] = item
        self._persist_local_fallback()
        self.directory_cache.invalidate()

        client = self._get_client()
        if client is None:
            return {"count": len(payload), "persisted_remote": False}

        try:
            for batch in self._chunked(payload, 250):
                client.table("master_emiten").upsert(
                    batch, on_conflict="ticker"
                ).execute()
            return {"count": len(payload), "persisted_remote": True}
        except Exception as exc:
            return {
                "count": len(payload),
                "persisted_remote": False,
                "error": str(exc)[:220],
            }

    async def upsert_master_emiten(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        return await asyncio.to_thread(self.upsert_master_emiten_sync, rows)

    def fetch_all_master_emiten_sync(self) -> list[dict[str, Any]]:
        cached = self.directory_cache.get("master_all")
        if cached is not None:
            return cached

        client = self._get_client()
        if client is not None:
            try:
                all_rows: list[dict[str, Any]] = []
                page_size = 1000
                offset = 0
                while True:
                    res = (
                        client.table("master_emiten")
                        .select("*")
                        .eq("is_active", True)
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )
                    chunk = res.data or []
                    all_rows.extend(chunk)
                    if len(chunk) < page_size:
                        break
                    offset += page_size

                if all_rows:
                    with self._fallback_lock:
                        for row in all_rows:
                            t = row.get("ticker")
                            if t:
                                self._fallback_data["master_emiten"][t] = row
                    self.directory_cache.set("master_all", all_rows)
                    return all_rows
            except Exception:
                pass

        fallback_rows = list(self._fallback_data["master_emiten"].values())
        if fallback_rows:
            self.directory_cache.set("master_all", fallback_rows, ttl=60.0)
        return fallback_rows

    async def fetch_all_master_emiten(self) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self.fetch_all_master_emiten_sync)

    def fetch_master_by_tickers_sync(self, tickers: list[str]) -> dict[str, dict[str, Any]]:
        clean = [t.strip().upper() for t in tickers if t.strip()]
        if not clean:
            return {}

        client = self._get_client()
        if client is not None:
            try:
                res = (
                    client.table("master_emiten")
                    .select("*")
                    .in_("ticker", clean)
                    .execute()
                )
                rows = res.data or []
                if rows:
                    mapping = {r["ticker"]: r for r in rows if r.get("ticker")}
                    with self._fallback_lock:
                        self._fallback_data["master_emiten"].update(mapping)
                    return mapping
            except Exception:
                pass

        return {
            t: self._fallback_data["master_emiten"][t]
            for t in clean
            if t in self._fallback_data["master_emiten"]
        }

    async def fetch_master_by_tickers(self, tickers: list[str]) -> dict[str, dict[str, Any]]:
        return await asyncio.to_thread(self.fetch_master_by_tickers_sync, tickers)

    # ------------------------------------------------------------------
    # KAMAR 2: fundamental_kuartal (on_conflict="ticker,period")
    # ------------------------------------------------------------------
    def upsert_fundamental_kuartal_sync(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        if not rows:
            return {"count": 0, "persisted_remote": False}

        now = now_wib_iso()
        dedup: dict[tuple[str, str], dict[str, Any]] = {}
        allowed_cols = {
            "ticker",
            "period",
            "source_type",
            "eps_ttm",
            "bvps",
            "ev_per_share",
            "ebitda_per_share",
            "fair_value_intrinsic",
            "roe",
            "roa",
            "gpm",
            "opm",
            "npm",
            "eps_growth_yoy",
            "der",
            "current_ratio",
            "quick_ratio",
            "interest_coverage",
            "altman_z",
            "zmijewski_x",
            "ocf_billion",
            "fcf_billion",
            "capex_billion",
            "dps",
            "dpr",
            "dividend_streak_5y",
            "sector_avg_per",
            "sector_avg_pbv",
            "sector_avg_roe",
            "sector_avg_der",
            "hist_5y_benchmark",
            "updated_at",
        }

        for r in rows:
            ticker = str(r.get("ticker", "")).strip().upper()
            if not ticker:
                continue
            period = str(r.get("period") or "TTM-LATEST").strip()
            src = str(r.get("source_type") or "AUTO_SYNCED").strip().upper()
            if src not in {"BEI_VERIFIED", "AUTO_SYNCED"}:
                src = "AUTO_SYNCED"

            filtered = {k: r.get(k) for k in allowed_cols if k in r}
            filtered["ticker"] = ticker
            filtered["period"] = period
            filtered["source_type"] = src
            if not isinstance(filtered.get("hist_5y_benchmark"), dict):
                filtered["hist_5y_benchmark"] = {}
            filtered["updated_at"] = now
            dedup[(ticker, period)] = sanitize_for_json(filtered)

        payload = list(dedup.values())
        with self._fallback_lock:
            for item in payload:
                key = f"{item['ticker']}|{item['period']}"
                self._fallback_data["fundamental_kuartal"][key] = item
        self._persist_local_fallback()

        client = self._get_client()
        if client is None:
            return {"count": len(payload), "persisted_remote": False}

        try:
            for batch in self._chunked(payload, 150):
                client.table("fundamental_kuartal").upsert(
                    batch, on_conflict="ticker,period"
                ).execute()
            return {"count": len(payload), "persisted_remote": True}
        except Exception as exc:
            return {
                "count": len(payload),
                "persisted_remote": False,
                "error": str(exc)[:220],
            }

    async def upsert_fundamental_kuartal(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        return await asyncio.to_thread(self.upsert_fundamental_kuartal_sync, rows)

    def fetch_fundamentals_by_tickers_sync(
        self, tickers: list[str]
    ) -> dict[str, dict[str, Any]]:
        """Return highest-priority fundamental row per ticker (BEI_VERIFIED > AUTO_SYNCED)."""
        clean = [t.strip().upper() for t in tickers if t.strip()]
        if not clean:
            return {}

        rows: list[dict[str, Any]] = []
        client = self._get_client()
        if client is not None:
            try:
                res = (
                    client.table("fundamental_kuartal")
                    .select("*")
                    .in_("ticker", clean)
                    .execute()
                )
                rows = res.data or []
            except Exception:
                rows = []

        if not rows:
            with self._fallback_lock:
                for item in self._fallback_data["fundamental_kuartal"].values():
                    if item.get("ticker") in clean:
                        rows.append(item)

        # Pick BEI_VERIFIED first, then latest updated_at
        chosen: dict[str, dict[str, Any]] = {}
        for row in rows:
            t = row.get("ticker")
            if not t:
                continue
            prev = chosen.get(t)
            if prev is None:
                chosen[t] = row
            else:
                prev_rank = 2 if prev.get("source_type") == "BEI_VERIFIED" else 1
                cur_rank = 2 if row.get("source_type") == "BEI_VERIFIED" else 1
                if cur_rank > prev_rank or (
                    cur_rank == prev_rank
                    and str(row.get("updated_at", "")) > str(prev.get("updated_at", ""))
                ):
                    chosen[t] = row

        return chosen

    async def fetch_fundamentals_by_tickers(
        self, tickers: list[str]
    ) -> dict[str, dict[str, Any]]:
        return await asyncio.to_thread(self.fetch_fundamentals_by_tickers_sync, tickers)

    # ------------------------------------------------------------------
    # KAMAR 3: live_market_cache (on_conflict="ticker")
    # ------------------------------------------------------------------
    def upsert_live_market_cache_sync(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        if not rows:
            return {"count": 0, "persisted_remote": False}

        now = now_wib_iso()
        allowed_cols = {
            "ticker",
            "live_price",
            "prev_close",
            "change_abs",
            "change_pct",
            "volume",
            "market_cap",
            "ma20",
            "ma200",
            "rsi14",
            "atr_pct",
            "max_drawdown_1y",
            "support1",
            "resistance1",
            "quant_score",
            "verdict_status",
            "primary_source",
            "updated_at",
        }
        dedup: dict[str, dict[str, Any]] = {}
        for r in rows:
            ticker = str(r.get("ticker", "")).strip().upper()
            price = r.get("live_price")
            if not ticker or price is None:
                continue
            filtered = {k: r.get(k) for k in allowed_cols if k in r}
            filtered["ticker"] = ticker
            filtered["updated_at"] = now
            dedup[ticker] = sanitize_for_json(filtered)

        payload = list(dedup.values())
        with self._fallback_lock:
            for item in payload:
                self._fallback_data["live_market_cache"][item["ticker"]] = item
        self._persist_local_fallback()

        client = self._get_client()
        if client is None:
            return {"count": len(payload), "persisted_remote": False}

        try:
            for batch in self._chunked(payload, 250):
                client.table("live_market_cache").upsert(
                    batch, on_conflict="ticker"
                ).execute()
            return {"count": len(payload), "persisted_remote": True}
        except Exception as exc:
            return {
                "count": len(payload),
                "persisted_remote": False,
                "error": str(exc)[:220],
            }

    async def upsert_live_market_cache(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        return await asyncio.to_thread(self.upsert_live_market_cache_sync, rows)

    def fetch_live_cache_by_tickers_sync(
        self, tickers: list[str]
    ) -> dict[str, dict[str, Any]]:
        clean = [t.strip().upper() for t in tickers if t.strip()]
        if not clean:
            return {}

        client = self._get_client()
        if client is not None:
            try:
                res = (
                    client.table("live_market_cache")
                    .select("*")
                    .in_("ticker", clean)
                    .execute()
                )
                rows = res.data or []
                if rows:
                    mapping = {r["ticker"]: r for r in rows if r.get("ticker")}
                    with self._fallback_lock:
                        self._fallback_data["live_market_cache"].update(mapping)
                    return mapping
            except Exception:
                pass

        return {
            t: self._fallback_data["live_market_cache"][t]
            for t in clean
            if t in self._fallback_data["live_market_cache"]
        }

    async def fetch_live_cache_by_tickers(
        self, tickers: list[str]
    ) -> dict[str, dict[str, Any]]:
        return await asyncio.to_thread(self.fetch_live_cache_by_tickers_sync, tickers)

    def fetch_all_live_market_caps_sync(self) -> dict[str, dict[str, Any]]:
        cached = self.directory_cache.get("live_caps")
        if cached is not None:
            return cached

        client = self._get_client()
        if client is not None:
            try:
                mapping: dict[str, dict[str, Any]] = {}
                page_size = 1000
                offset = 0
                while True:
                    res = (
                        client.table("live_market_cache")
                        .select("ticker,live_price,change_pct,market_cap,quant_score,verdict_status")
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )
                    chunk = res.data or []
                    for row in chunk:
                        t = row.get("ticker")
                        if t:
                            mapping[t] = row
                    if len(chunk) < page_size:
                        break
                    offset += page_size
                if mapping:
                    self.directory_cache.set("live_caps", mapping, ttl=60.0)
                    return mapping
            except Exception:
                pass

        return dict(self._fallback_data["live_market_cache"])

    async def fetch_all_live_market_caps(self) -> dict[str, dict[str, Any]]:
        return await asyncio.to_thread(self.fetch_all_live_market_caps_sync)

    # ------------------------------------------------------------------
    # KAMAR 4: audit_validasi (on_conflict="ticker,metric_key")
    # ------------------------------------------------------------------
    def upsert_audit_validasi_sync(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        if not rows:
            return {"count": 0, "persisted_remote": False}

        now = now_wib_iso()
        dedup: dict[tuple[str, str], dict[str, Any]] = {}
        for r in rows:
            ticker = str(r.get("ticker", "")).strip().upper()
            metric_key = str(r.get("metric_key", "")).strip()
            if not ticker or not metric_key:
                continue

            status = str(r.get("status") or "verified").strip()
            # Strictly honor DB CHECK constraint: verified | minor_diff | bei_anchor | failover_active
            if status not in VALID_AUDIT_DB_STATUSES:
                status = "failover_active"

            clean_row = sanitize_for_json(
                {
                    "ticker": ticker,
                    "metric_key": metric_key,
                    "tv_value": r.get("tv_value"),
                    "yf_value": r.get("yf_value"),
                    "gf_value": r.get("gf_value"),
                    "bei_value": r.get("bei_value"),
                    "final_value": r.get("final_value"),
                    "spread_pct": r.get("spread_pct", 0.0) or 0.0,
                    "status": status,
                    "checked_at": now,
                }
            )
            dedup[(ticker, metric_key)] = clean_row

        payload = list(dedup.values())
        with self._fallback_lock:
            for item in payload:
                key = f"{item['ticker']}|{item['metric_key']}"
                self._fallback_data["audit_validasi"][key] = item
        self._persist_local_fallback()

        client = self._get_client()
        if client is None:
            return {"count": len(payload), "persisted_remote": False}

        try:
            for batch in self._chunked(payload, 250):
                client.table("audit_validasi").upsert(
                    batch, on_conflict="ticker,metric_key"
                ).execute()
            return {"count": len(payload), "persisted_remote": True}
        except Exception as exc:
            return {
                "count": len(payload),
                "persisted_remote": False,
                "error": str(exc)[:220],
            }

    async def upsert_audit_validasi(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        return await asyncio.to_thread(self.upsert_audit_validasi_sync, rows)

    def count_rows_for_ticker_sync(self, table: str, ticker: str) -> int:
        clean = ticker.strip().upper()
        client = self._get_client()
        if client is not None:
            try:
                res = (
                    client.table(table)
                    .select("ticker", count="exact")
                    .eq("ticker", clean)
                    .execute()
                )
                return int(res.count if res.count is not None else len(res.data or []))
            except Exception:
                pass

        store = self._fallback_data.get(table, {})
        return sum(1 for item in store.values() if item.get("ticker") == clean)


# Singleton instance shared across FastAPI, scrapers, and seeder
db_manager = SupabaseManager()
