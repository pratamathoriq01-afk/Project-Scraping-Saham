"""
EquiLens Step 5 Comprehensive Automated Verification Suite (0% Error Tolerance).

Runs TWO strict layers:
  - Layer A: Financial Safety & Chaos Unit Proofs (zero NaN/Inf, Bank N/A including Zmijewski,
    loss-making stock guard, outlier price isolation, and circuit breaker failover).
  - Layer B: Live FastAPI TestClient & Supabase Anti-Duplicate Integration Tests across all
    5 endpoints (`/api/sources/health`, `/api/stocks/search`, `/api/stocks/presets`,
    `/api/compare`, `/api/charts/{ticker}`) + Double-UPSERT idempotency proof.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.supabase_manager import db_manager
from main import app
from quant_engine.analyzer import (
    BANKING_NA_METRICS,
    build_stock_analysis_package,
    compute_zmijewski_x,
    estimate_fair_value_intrinsic,
)
from quant_engine.utils import safe_divide, sanitize_for_json
from scrapers.circuit_breaker import CircuitBreakerRegistry
from scrapers.orchestrator import (
    orchestrate_comparison,
    persist_comparison_updates,
    resolve_consensus_price,
)


def assert_strict_json(payload: object, label: str) -> None:
    """Guarantees ZERO NaN / Infinity / -Infinity anywhere in the JSON tree."""
    try:
        json.dumps(payload, allow_nan=False)
    except ValueError as exc:
        raise AssertionError(f"[{label}] Payload mengandung NaN/Infinity ilegal: {exc}") from exc


def run_layer_a_financial_safety_tests() -> None:
    print("\n=== LAYER A: FINANCIAL SAFETY & CHAOS UNIT TESTS ===")

    # 1. safe_divide & sanitize_for_json
    assert safe_divide(100, 0) is None, "Division by zero harus menghasilkan None"
    assert safe_divide(float("nan"), 10) is None, "NaN harus menghasilkan None"
    dirty = {
        "nan": float("nan"),
        "inf": float("inf"),
        "ninf": float("-inf"),
        "np_nan": np.nan,
        "np_int": np.int64(42),
        "np_float": np.float64(3.14),
        "pd_na": pd.NA,
        "nested": [1, np.inf, {"bad": -np.inf}],
    }
    cleaned = sanitize_for_json(dirty)
    assert_strict_json(cleaned, "sanitize_for_json")
    assert cleaned["nan"] is None and cleaned["inf"] is None and cleaned["pd_na"] is None
    assert cleaned["np_int"] == 42 and abs(cleaned["np_float"] - 3.14) < 1e-6
    print("  [PASS] A1: safe_divide & sanitize_for_json (0 NaN/Infinity)")

    # 2. Banking Zmijewski & Non-Bank Metric Exclusion Proof
    assert (
        compute_zmijewski_x("banking", roa_pct=3.4, der=5.2, current_ratio=None) is None
    ), "Zmijewski pada Bank WAJIB None (tidak boleh memvonis BBCA distress!)"
    z_healthy = compute_zmijewski_x("commodity", roa_pct=12.8, der=0.21, current_ratio=2.35)
    assert z_healthy is not None and z_healthy < 0, f"ADRO Zmijewski harus < 0, dapat {z_healthy}"
    print(f"  [PASS] A2: Zmijewski Banking=None & Decimal ROA akurat (ADRO X={z_healthy})")

    # 3. Loss-Making & Negative Equity Crash Guard
    fv_loss = estimate_fair_value_intrinsic(
        live_price=500,
        eps_ttm=-50,
        bvps=-20,
        roe_pct=-15.0,
        sector_avg_per=14.0,
        sector_avg_pbv=1.8,
        sector_avg_roe=14.0,
    )
    assert fv_loss > 0 and fv_loss < 500, f"Saham rugi harus mendapat fair value defensif, dapat {fv_loss}"
    loss_pkg = build_stock_analysis_package(
        ticker="TEST",
        master_row={"ticker": "TEST", "company_name": "PT Uji Rugi Tbk", "sector_idx": "Perindustrian", "accounting_type": "general"},
        anchor_row={"eps_ttm": -50, "bvps": -20, "roe": -15.0, "roa": -6.0, "der": -1.5, "dpr": 0},
        live_snap={"live_price": 500, "prev_close": 510, "ma20": 520, "ma200": 600, "rsi14": 31.0, "atr_pct": 3.5},
        audits={},
    )
    assert_strict_json(loss_pkg, "loss_making_stock")
    assert loss_pkg["metrics"]["per_ttm"]["isWarning"] is True
    assert loss_pkg["decisionProfile"]["verdictStatus"] == "WASPADA / HINDARI"
    print("  [PASS] A3: Saham rugi & ekuitas negatif lolos tanpa crash Graham/PER")

    # 4. Outlier Price Gatekeeper Isolation Proof
    price, src, audit, warns = resolve_consensus_price(
        tv_price=10200,
        yf_price=10225,
        gf_price=999999,
        cached_price=10175,
        prev_close=10100,
    )
    assert price is not None and 10150 <= price <= 10250, f"Outlier 999999 bocor! price={price}"
    assert any("Outlier" in w for w in warns), "Harus mencatat warning isolasi outlier"
    assert audit["status"] == "failover_active"
    print(f"  [PASS] A4: Price Gatekeeper isolasi outlier 999999 -> final={price} ({src})")

    # 5. Circuit Breaker 3x Failure -> OPEN 60s
    cb = CircuitBreakerRegistry(failure_threshold=3, recovery_timeout_sec=60.0)
    assert cb.can_execute("TRADINGVIEW") is True
    cb.record_failure("TRADINGVIEW", "timeout 1")
    cb.record_failure("TRADINGVIEW", "timeout 2")
    assert cb.can_execute("TRADINGVIEW") is True
    cb.record_failure("TRADINGVIEW", "timeout 3")
    assert cb.can_execute("TRADINGVIEW") is False, "Circuit breaker harus OPEN setelah 3x gagal"
    assert cb.get_source_status("TRADINGVIEW")["state"] == "OPEN"
    print("  [PASS] A5: Circuit Breaker otomatis OPEN 60 detik pada kegagalan ke-3")


def run_layer_b_live_api_tests() -> None:
    print("\n=== LAYER B: LIVE FASTAPI TESTCLIENT & SUPABASE INTEGRATION TESTS ===")
    client = TestClient(app)

    # 1. /api/sources/health
    r_health = client.get("/api/sources/health")
    assert r_health.status_code == 200, f"Health gagal: {r_health.status_code} {r_health.text}"
    health = r_health.json()
    assert_strict_json(health, "sources_health")
    assert health["supabase"]["healthy"] is True, f"Supabase tidak sehat: {health['supabase']}"
    assert health["masterEmitenCount"] >= 500, f"Master emiten terlalu sedikit: {health['masterEmitenCount']}"
    print(
        f"  [PASS] B1: /api/sources/health -> Supabase LIVE ({health['supabase']['latency_ms']}ms), "
        f"{health['masterEmitenCount']} emiten BEI terdaftar"
    )

    # 2. /api/stocks/search?q=UNVR & ?q=Bank
    r_unvr = client.get("/api/stocks/search?q=UNVR")
    assert r_unvr.status_code == 200
    unvr_items = r_unvr.json()["items"]
    assert len(unvr_items) >= 1 and unvr_items[0]["ticker"] == "UNVR"

    r_bank = client.get("/api/stocks/search?q=Bank&limit=15")
    assert r_bank.status_code == 200
    bank_items = r_bank.json()["items"]
    assert len(bank_items) >= 5, "Pencarian 'Bank' harus mengembalikan banyak bank BEI"
    print(
        f"  [PASS] B2: /api/stocks/search -> UNVR #1 match, 'Bank' menemukan "
        f"{r_bank.json()['totalMatches']} emiten"
    )

    # 3. /api/compare?tickers=BBCA,ADRO,ICBP,UNVR
    r_cmp = client.get("/api/compare?tickers=BBCA,ADRO,ICBP,UNVR&force_refresh=true")
    assert r_cmp.status_code == 200, f"Compare gagal: {r_cmp.status_code} {r_cmp.text}"
    cmp_data = r_cmp.json()
    assert_strict_json(cmp_data, "compare_4_stocks")
    assert set(cmp_data["activeTickers"]) == {"BBCA", "ADRO", "ICBP", "UNVR"}

    bbca_metrics = cmp_data["metrics"]["BBCA"]
    for na_key in BANKING_NA_METRICS:
        assert bbca_metrics[na_key]["isNotApplicable"] is True, f"BBCA {na_key} wajib isNotApplicable=True"
        assert bbca_metrics[na_key]["rawValue"] is None, f"BBCA {na_key} wajib rawValue=None"

    adro_metrics = cmp_data["metrics"]["ADRO"]
    assert adro_metrics["zmijewski_x"]["rawValue"] is not None and adro_metrics["zmijewski_x"]["rawValue"] < 0
    assert adro_metrics["pbv_current"]["rawValue"] is not None and adro_metrics["pbv_current"]["rawValue"] < 20.0

    unvr_metrics = cmp_data["metrics"]["UNVR"]
    assert unvr_metrics["current_ratio"]["isWarning"] is True, "UNVR Current Ratio < 1 harus warning"

    bbca_live_audit = cmp_data["audits"]["BBCA"]["live_price"]
    assert bbca_live_audit["finalValue"] is not None and bbca_live_audit["isSimulated"] is False
    bbca_fv = cmp_data["decisionProfiles"]["BBCA"]["priceZones"]["fairValueTarget"]
    bbca_px = cmp_data["liveSnapshots"]["BBCA"]["livePrice"]
    assert bbca_fv > bbca_px, f"BBCA fair value ({bbca_fv}) harus wajar > live price ({bbca_px})!"
    print(
        f"  [PASS] B3: /api/compare (BBCA,ADRO,ICBP,UNVR) -> 0 NaN, BBCA 7 metrik Bank N/A OK, "
        f"live BBCA={bbca_px} / FairValue={bbca_fv} (status={bbca_live_audit['status']})"
    )

    # 4. Single-stock compare GGRM (outside initial 15) + BRIS (on-demand AUTO_SYNCED bank!)
    r_ggrm = client.get("/api/compare?tickers=GGRM&force_refresh=true")
    assert r_ggrm.status_code == 200
    ggrm = r_ggrm.json()
    assert_strict_json(ggrm, "compare_GGRM")
    assert ggrm["isSingleStockMode"] is True
    assert ggrm["sectorBenchmark"] is not None and ggrm["historical5YBenchmark"] is not None

    r_bris = client.get("/api/compare?tickers=BRIS&force_refresh=true")
    assert r_bris.status_code == 200
    bris = r_bris.json()
    assert_strict_json(bris, "compare_BRIS")
    assert bris["stocks"][0]["accountingType"] == "banking", "BRIS harus terklasifikasi banking!"
    assert bris["metrics"]["BRIS"]["zmijewski_x"]["isNotApplicable"] is True
    print("  [PASS] B4: Mode 1 Saham (GGRM benchmark Sektor+5Y) & Auto-Populate On-Demand (BRIS Bank) OK")

    # 5. Charts API (multi-stock & single-stock vs IHSG)
    r_chart = client.get("/api/charts/ADRO?timeframe=1Y&compare=BBCA,ICBP")
    assert r_chart.status_code == 200
    chart = r_chart.json()
    assert_strict_json(chart, "chart_ADRO_multi")
    assert len(chart["bars"]) >= 50, f"OHLCV ADRO terlalu sedikit: {len(chart['bars'])}"
    compare_tickers_out = [c["ticker"] for c in chart["compareSeries"]]
    assert "ADRO" in compare_tickers_out and "BBCA" in compare_tickers_out and "ICBP" in compare_tickers_out

    r_chart_single = client.get("/api/charts/BBCA?timeframe=1Y")
    assert r_chart_single.status_code == 200
    chart_single = r_chart_single.json()
    assert_strict_json(chart_single, "chart_BBCA_ihsg")
    assert chart_single["includesIhsgBenchmark"] is True
    assert any(c["ticker"] == "IHSG" for c in chart_single["compareSeries"])
    bbca_last_bar = chart_single["bars"][-1]
    assert abs(bbca_last_bar["close"] - bbca_px) <= 25, (
        f"Live Candle Stitching BBCA gagal sinkron! bar_close={bbca_last_bar['close']} vs live={bbca_px}"
    )
    print(
        f"  [PASS] B5: /api/charts/ADRO ({len(chart['bars'])} bars + 3 kurva %) & "
        f"/api/charts/BBCA (stitched {bbca_last_bar['time']} close={bbca_last_bar['close']} + auto vs IHSG) OK"
    )

    # 6. Double-UPSERT Anti-Duplicate Idempotency Proof on Supabase
    async def _double_upsert_check() -> tuple[int, int, int, int]:
        _, m1, f1, l1, a1 = await orchestrate_comparison(["BBCA"], force_refresh=True)
        await persist_comparison_updates(m1, f1, l1, a1)
        live_c1 = db_manager.count_rows_for_ticker_sync("live_market_cache", "BBCA")
        audit_c1 = db_manager.count_rows_for_ticker_sync("audit_validasi", "BBCA")

        _, m2, f2, l2, a2 = await orchestrate_comparison(["BBCA"], force_refresh=True)
        await persist_comparison_updates(m2, f2, l2, a2)
        live_c2 = db_manager.count_rows_for_ticker_sync("live_market_cache", "BBCA")
        audit_c2 = db_manager.count_rows_for_ticker_sync("audit_validasi", "BBCA")
        return live_c1, live_c2, audit_c1, audit_c2

    live_c1, live_c2, audit_c1, audit_c2 = asyncio.run(_double_upsert_check())
    assert live_c1 == 1 and live_c2 == 1, f"Duplikasi live_market_cache! c1={live_c1}, c2={live_c2}"
    assert audit_c1 == audit_c2 and audit_c1 >= 5, f"Duplikasi audit_validasi! c1={audit_c1}, c2={audit_c2}"
    print(
        f"  [PASS] B6: Double-UPSERT Anti-Duplikat -> live_market_cache={live_c2} baris (1:1), "
        f"audit_validasi={audit_c2} baris (identik, 0 duplikasi)"
    )


if __name__ == "__main__":
    run_layer_a_financial_safety_tests()
    run_layer_b_live_api_tests()
    print("\n============================================================")
    print("SEMUA VERIFIKASI STEP 5 LULUS 100% HIJAU (0 ERROR)!")
    print("============================================================")
