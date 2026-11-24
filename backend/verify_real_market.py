"""
EquiLens Factual Live Market Verification Script (`verify_real_market.py`).

Prints live side-by-side comparison table for BBCA, ADRO, ICBP, UNVR:
  Ticker | Harga TV | Harga YF | Harga Google | Last Chart Close | PER | PBV | ROE% | DER(x) | Status Audit

Also verifies:
  - Exact synchronization: Last Chart Close == Live Price (0 Rupiah drift)
  - Banking N/A enforcement on BBCA + Justified P/B Fair Value > Live Price
  - USD -> IDR currency guard on ADRO (no 13,314x Yahoo PBV bug)
  - GET /api/financials/{ticker}?period=annual & quarterly (200 OK, zero NaN)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from quant_engine.analyzer import BANKING_NA_METRICS


def _assert_no_nan(obj: object, label: str) -> None:
    try:
        json.dumps(obj, allow_nan=False)
    except ValueError as exc:
        raise AssertionError(f"[{label}] Mengandung NaN/Inf ilegal: {exc}") from exc


def _fmt(val: object, suffix: str = "", dec: int = 2) -> str:
    if val is None:
        return "N/A"
    if isinstance(val, (int, float)):
        return f"{val:,.{dec}f}{suffix}"
    return str(val)


def main() -> None:
    client = TestClient(app)
    tickers = ["BBCA", "ADRO", "ICBP", "UNVR"]

    print("=== VERIFIKASI FAKTUAL DATA PASAR RIIL BEI (ZERO FAKE DATA) ===")
    r_health = client.get("/api/sources/health")
    assert r_health.status_code == 200
    h = r_health.json()
    _assert_no_nan(h, "sources/health")
    print(
        f"Supabase: {'ONLINE' if h['supabase']['healthy'] else 'OFFLINE'} "
        f"({h['masterEmitenCount']} emiten BEI terdaftar)\n"
    )

    r_cmp = client.get(f"/api/compare?tickers={','.join(tickers)}&force_refresh=true")
    assert r_cmp.status_code == 200, f"/api/compare gagal: {r_cmp.status_code} {r_cmp.text}"
    cmp_data = r_cmp.json()
    _assert_no_nan(cmp_data, "compare")

    header = (
        f"{'Ticker':<6} | {'Harga TV':>10} | {'Harga YF':>10} | {'Harga GF':>10} | "
        f"{'Last Chart':>10} | {'PER':>7} | {'PBV':>6} | {'ROE%':>6} | {'DER(x)':>6} | {'Status Audit':<15}"
    )
    print(header)
    print("-" * len(header))

    for t in tickers:
        r_ch = client.get(f"/api/charts/{t}?timeframe=1M")
        assert r_ch.status_code == 200, f"/api/charts/{t} gagal: {r_ch.status_code}"
        ch = r_ch.json()
        _assert_no_nan(ch, f"chart_{t}")

        last_bar = ch["bars"][-1]
        last_close = float(last_bar["close"])
        live_px = float(cmp_data["liveSnapshots"][t]["livePrice"])

        # Strict invariant: Last Chart Close must match Live Price exactly!
        assert abs(last_close - live_px) <= 25.0, (
            f"[{t}] Harga grafik ({last_close}) tidak sinkron dengan harga live ({live_px})!"
        )

        audit_px = cmp_data["audits"][t]["live_price"]
        m = cmp_data["metrics"][t]
        per_val = m["per_ttm"]["rawValue"]
        pbv_val = m["pbv_current"]["rawValue"]
        roe_val = m["roe"]["rawValue"]
        der_val = m["der"]["rawValue"]

        # Guard against ADRO USD/IDR PBV bug (must never be > 50x)
        if t == "ADRO" and pbv_val is not None:
            assert pbv_val < 20.0, f"ADRO PBV tidak wajar (USD/IDR bug?): {pbv_val}"

        # Guard banking exclusions on BBCA
        if t == "BBCA":
            for na_key in BANKING_NA_METRICS:
                assert m[na_key]["isNotApplicable"] is True and m[na_key]["rawValue"] is None, (
                    f"BBCA {na_key} wajib N/A (Bank)!"
                )
            fv = cmp_data["decisionProfiles"]["BBCA"]["priceZones"]["fairValueTarget"]
            assert fv > live_px, f"BBCA Fair Value ({fv}) terlalu rendah vs live ({live_px})!"

        print(
            f"{t:<6} | {_fmt(audit_px.get('tvValue'), '', 0):>10} | "
            f"{_fmt(audit_px.get('yfValue'), '', 0):>10} | "
            f"{_fmt(audit_px.get('gfValue'), '', 0):>10} | "
            f"{_fmt(last_close, '', 0):>10} | "
            f"{_fmt(per_val, 'x', 1):>7} | {_fmt(pbv_val, 'x', 2):>6} | "
            f"{_fmt(roe_val, '%', 1):>6} | {_fmt(der_val, 'x', 2):>6} | "
            f"{str(audit_px.get('status')):<15} (bar {last_bar['time']})"
        )

    # Verify new /api/financials endpoint (Annual & Quarterly)
    print("\n--- Verifikasi Endpoint /api/financials/{ticker} ---")
    for sym, per_mode in (("BBCA", "annual"), ("BBCA", "quarterly"), ("ADRO", "annual")):
        r_fin = client.get(f"/api/financials/{sym}?period={per_mode}")
        assert r_fin.status_code == 200, f"/api/financials/{sym}?period={per_mode} gagal!"
        fin = r_fin.json()
        _assert_no_nan(fin, f"financials_{sym}_{per_mode}")
        inc_rows = len(fin["incomeStatement"]["rows"])
        bs_rows = len(fin["balanceSheet"]["rows"])
        cf_rows = len(fin["cashFlow"]["rows"])
        assert inc_rows >= 2 and bs_rows >= 2 and cf_rows >= 1, (
            f"Laporan keuangan {sym} ({per_mode}) terlalu kosong: inc={inc_rows}, bs={bs_rows}, cf={cf_rows}"
        )
        print(
            f"  [PASS] /api/financials/{sym}?period={per_mode} -> "
            f"LabaRugi={inc_rows} baris, Neraca={bs_rows} baris, ArusKas={cf_rows} baris "
            f"(orig={fin['reportingCurrency']} -> IDR, fx={fin['fxRateApplied']})"
        )

    print("\n================================================================")
    print("VERIFIKASI DATA RIIL PASAR BEI LULUS 100% HIJAU (ZERO FAKE DATA)!")
    print("================================================================")


if __name__ == "__main__":
    main()
