"""Strict numerical safety, IDX tick rules, and recursive JSON sanitization utilities."""

from __future__ import annotations

import datetime as dt
import math
from decimal import Decimal
from typing import Any, Iterable

import numpy as np
import pandas as pd

WIB_TZ = dt.timezone(dt.timedelta(hours=7))


def now_wib() -> dt.datetime:
    return dt.datetime.now(tz=WIB_TZ)


def now_wib_iso() -> str:
    return now_wib().isoformat(timespec="seconds")


def now_wib_display() -> str:
    return now_wib().strftime("%d %b %Y, %H:%M WIB")


def safe_float(val: Any, default: float | None = None) -> float | None:
    """Safely convert any scalar value to a finite Python float, rejecting bool/NaN/Inf."""
    if val is None or isinstance(val, bool):
        return default
    try:
        if val is pd.NA:
            return default
    except Exception:
        pass

    if isinstance(val, (np.bool_,)):
        return default

    if isinstance(val, (int, float, Decimal, np.integer, np.floating)):
        num = float(val)
        return num if math.isfinite(num) else default

    if isinstance(val, str):
        cleaned = val.strip().replace(",", "")
        if not cleaned or cleaned.lower() in {"nan", "inf", "-inf", "none", "null", "n/a", "-", "—"}:
            return default
        if cleaned.endswith("%"):
            cleaned = cleaned[:-1].strip()
        try:
            num = float(cleaned)
            return num if math.isfinite(num) else default
        except ValueError:
            return default

    return default


def safe_int(val: Any, default: int | None = None) -> int | None:
    num = safe_float(val, default=None)
    if num is None:
        return default
    return int(round(num))


def safe_divide(numerator: Any, denominator: Any) -> float | None:
    """Strict division guard preventing ZeroDivisionError, NaN, Infinity, and -Infinity."""
    num = safe_float(numerator)
    den = safe_float(denominator)
    if num is None or den is None or den == 0.0:
        return None
    res = num / den
    return res if math.isfinite(res) else None


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def get_idx_tick_size(price: float) -> int:
    """Official IDX (BEI) price tick fraction rules."""
    if price >= 5000:
        return 25
    if price >= 2000:
        return 10
    if price >= 500:
        return 5
    if price >= 200:
        return 2
    return 1


def snap_to_idx_tick(raw_price: float, allow_fca: bool = False) -> float:
    """Snap price strictly to official IDX tick fractions."""
    floor_price = 1.0 if allow_fca else 50.0
    price = max(floor_price, float(raw_price))
    tick = get_idx_tick_size(price)
    snapped = round(price / tick) * tick
    return float(max(floor_price, snapped))


def is_price_within_ara_arb(
    price: float,
    prev_close: float | None = None,
    max_daily_move_pct: float = 35.0,
) -> tuple[bool, str | None]:
    """Validate price sanity against IDX floor and maximum daily ARA/ARB bracket."""
    p = safe_float(price)
    if p is None or p < 1.0:
        return False, "Harga tidak valid (<= 0 atau non-finite)"

    prev = safe_float(prev_close)
    if prev is not None and prev >= 1.0:
        pct_move = abs((p - prev) / prev) * 100.0
        if pct_move > max_daily_move_pct:
            return (
                False,
                f"Lonjakan harga ekstrem {pct_move:.1f}% melebihi batas harian BEI ({max_daily_move_pct:.0f}%)",
            )
    return True, None


def compute_spread_pct(values: Iterable[Any]) -> float:
    """Compute max-min percentage spread relative to median magnitude."""
    clean = [v for v in (safe_float(x) for x in values) if v is not None]
    if len(clean) < 2:
        return 0.0
    sorted_vals = sorted(clean)
    mid = len(sorted_vals) // 2
    median = (
        sorted_vals[mid]
        if len(sorted_vals) % 2 == 1
        else (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0
    )
    denom = max(abs(median), 0.01)
    spread = ((sorted_vals[-1] - sorted_vals[0]) / denom) * 100.0
    return round(spread, 2) if math.isfinite(spread) else 0.0


def trimmed_median(
    values: Iterable[Any],
    min_val: float | None = None,
    max_val: float | None = None,
    trim_ratio: float = 0.1,
) -> float | None:
    """Outlier-resistant trimmed median for IDX sector benchmarks."""
    clean: list[float] = []
    for raw in values:
        v = safe_float(raw)
        if v is None:
            continue
        if min_val is not None and v < min_val:
            continue
        if max_val is not None and v > max_val:
            continue
        clean.append(v)

    if not clean:
        return None
    clean.sort()
    n = len(clean)
    if n >= 5 and 0.0 < trim_ratio < 0.4:
        cut = max(1, int(n * trim_ratio))
        trimmed = clean[cut : n - cut]
        if trimmed:
            clean = trimmed

    m = len(clean)
    mid = m // 2
    med = clean[mid] if m % 2 == 1 else (clean[mid - 1] + clean[mid]) / 2.0
    return round(med, 2)


def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively convert NaN, Inf, -Inf, pd.NA, numpy scalars/arrays, Decimal, and dates
    into strictly RFC-8259 JSON-compliant Python primitives (allow_nan=False safe).
    """
    if obj is None:
        return None

    if isinstance(obj, bool):
        return obj

    if isinstance(obj, np.bool_):
        return bool(obj)

    try:
        if obj is pd.NA or obj is pd.NaT:
            return None
    except Exception:
        pass

    if isinstance(obj, (np.integer,)):
        return int(obj)

    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return f if math.isfinite(f) else None

    if isinstance(obj, Decimal):
        f = float(obj)
        return f if math.isfinite(f) else None

    if isinstance(obj, (dt.datetime, dt.date)):
        return obj.isoformat()

    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(item) for item in obj.tolist()]

    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(item) for item in obj]

    if isinstance(obj, (int, str)):
        return obj

    # Fallback check for pandas/numpy scalar NaNs
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass

    return str(obj)
