"""
BEI Official Financial Report Importer CLI (CSV / JSON -> Supabase Kamar 2 `fundamental_kuartal`).

Usage:
  backend/.venv/Scripts/python.exe backend/scrapers/bei_importer.py path/to/bei_q4_2026.csv --period "TTM Q4 2026"
  backend/.venv/Scripts/python.exe backend/scrapers/bei_importer.py path/to/bei_q4_2026.json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.supabase_manager import db_manager
from quant_engine.utils import safe_float, safe_int

NUMERIC_FIELDS = (
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
    "sector_avg_per",
    "sector_avg_pbv",
    "sector_avg_roe",
    "sector_avg_der",
)


def _normalize_row(raw: dict[str, Any], default_period: str) -> dict[str, Any] | None:
    ticker = str(raw.get("ticker", "")).strip().upper()
    if not ticker:
        return None

    row: dict[str, Any] = {
        "ticker": ticker,
        "period": str(raw.get("period") or default_period).strip(),
        "source_type": "BEI_VERIFIED",
        "dividend_streak_5y": safe_int(raw.get("dividend_streak_5y"), 0) or 0,
    }
    for col in NUMERIC_FIELDS:
        if col in raw:
            row[col] = safe_float(raw.get(col))

    hist_bench = raw.get("hist_5y_benchmark")
    if isinstance(hist_bench, str) and hist_bench.strip():
        try:
            hist_bench = json.loads(hist_bench)
        except json.JSONDecodeError:
            hist_bench = {}
    row["hist_5y_benchmark"] = hist_bench if isinstance(hist_bench, dict) else {}

    # Optional bank health columns in flat CSV (car_pct, npl_gross_pct, nim_pct, casa_pct)
    if any(k in raw for k in ("car_pct", "npl_gross_pct", "nim_pct", "casa_pct")):
        meta = dict(row["hist_5y_benchmark"].get("_meta") or {})
        meta["bankHealth"] = {
            "carPct": safe_float(raw.get("car_pct")),
            "nplGrossPct": safe_float(raw.get("npl_gross_pct")),
            "nimPct": safe_float(raw.get("nim_pct")),
            "casaPct": safe_float(raw.get("casa_pct")),
        }
        row["hist_5y_benchmark"]["_meta"] = meta

    return row


def import_bei_file(file_path: Path, default_period: str = "TTM-LATEST") -> dict[str, Any]:
    if not file_path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {file_path}")

    raw_rows: list[dict[str, Any]] = []
    suffix = file_path.suffix.lower()

    if suffix == ".json":
        with file_path.open("r", encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, list):
            raw_rows = [r for r in loaded if isinstance(r, dict)]
        elif isinstance(loaded, dict) and isinstance(loaded.get("rows"), list):
            raw_rows = [r for r in loaded["rows"] if isinstance(r, dict)]
    elif suffix == ".csv":
        with file_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            raw_rows = [dict(r) for r in reader]
    else:
        raise ValueError("Format file harus .csv atau .json")

    normalized = [
        item
        for item in (_normalize_row(r, default_period) for r in raw_rows)
        if item is not None
    ]
    return db_manager.upsert_fundamental_kuartal_sync(normalized)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Impor ringkasan laporan keuangan BEI (.csv/.json) ke Supabase Kamar 2."
    )
    parser.add_argument("file", type=Path, help="Path ke file .csv atau .json")
    parser.add_argument(
        "--period",
        default="TTM-LATEST",
        help="Label periode default jika kolom period kosong (default: TTM-LATEST)",
    )
    args = parser.parse_args()
    result = import_bei_file(args.file, args.period)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
