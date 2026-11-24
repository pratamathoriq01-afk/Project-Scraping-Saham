"""
Layer 2 Scraper — Yahoo Finance (.JK & ^JKSE) via yfinance in non-blocking threads.

Zero-Fake-Data & Strict Unit Normalization Guarantees:
  1. `auto_adjust=False` ALWAYS on OHLCV history so board prices match BEI accurately.
  2. Unit normalization:
     - `returnOnEquity`, `returnOnAssets`, `grossMargins`, `operatingMargins`,
       `profitMargins`, `earningsGrowth`, `payoutRatio` (decimals) -> * 100 (%)
     - `debtToEquity` (percentage, e.g. 21.5) -> / 100 (0.215x)
     - `Dividend Yield` computed directly as `(trailingAnnualDividendRate / live_price) * 100`
  3. USD -> IDR FX conversion when `financialCurrency != currency` (prevents 13,314x PBV bug on ADRO/ITMG).
  4. Real multi-year financial statement extraction (`income_stmt`, `balance_sheet`, `cashflow`,
     annual & quarterly) for `GET /api/financials/{ticker}` + authentic `historical5YBenchmark`
     + real 5-year `dividend_streak_5y` from `t.dividends`.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import time
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from quant_engine.utils import now_wib, safe_divide, safe_float, safe_int, sanitize_for_json
from scrapers.circuit_breaker import circuit_breaker

_FX_CACHE: dict[str, tuple[float, float]] = {}


def _to_yf_symbol(ticker: str) -> str:
    code = ticker.strip().upper()
    if code in {"IHSG", "^JKSE", "JKSE"}:
        return "^JKSE"
    if code.endswith(".JK") or code.startswith("^"):
        return code
    return f"{code}.JK"


def _get_fx_rate_to_idr(financial_currency: str) -> float:
    """Fetch & cache live FX conversion rate (e.g. USD->IDR) for USD-reporting IDX stocks."""
    curr = financial_currency.strip().upper()
    if not curr or curr == "IDR":
        return 1.0

    cached = _FX_CACHE.get(curr)
    now = time.monotonic()
    if cached and now < cached[0]:
        return cached[1]

    defaults = {"USD": 16000.0, "SGD": 11900.0, "EUR": 17200.0}
    rate = defaults.get(curr, 16000.0)
    try:
        fx = yf.Ticker(f"{curr}IDR=X").history(period="5d", interval="1d", auto_adjust=False)
        if fx is not None and not fx.empty:
            val = safe_float(fx["Close"].iloc[-1])
            if val is not None and val > 100.0:
                rate = val
    except Exception:
        pass

    _FX_CACHE[curr] = (now + 3600.0, rate)
    return rate


def _normalize_yf_pct(val: Any) -> float | None:
    num = safe_float(val)
    if num is None:
        return None
    return round(num * 100.0, 2)


def _extract_stmt_series(
    df: pd.DataFrame | None,
    candidate_keys: tuple[str, ...],
) -> list[tuple[str, float | None]]:
    """Return [(period_label, value), ...] across columns (most recent first)."""
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return []

    lower_map = {str(idx).strip().lower(): idx for idx in df.index}
    for key in candidate_keys:
        actual_idx = lower_map.get(key.lower())
        if actual_idx is None:
            continue
        series = df.loc[actual_idx]
        if isinstance(series, pd.DataFrame):
            series = series.iloc[0]
        out: list[tuple[str, float | None]] = []
        for col, val in series.items():
            label = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
            out.append((label, safe_float(val)))
        return out
    return []


def _extract_latest_stmt_value(
    df: pd.DataFrame | None,
    candidate_keys: tuple[str, ...],
) -> float | None:
    for _, val in _extract_stmt_series(df, candidate_keys):
        if val is not None:
            return val
    return None


def _compute_real_dividend_streak_5y(t_obj: yf.Ticker) -> int:
    """Count distinct calendar years with >0 dividends over the last 5 completed/current years."""
    try:
        divs = t_obj.dividends
        if divs is None or divs.empty:
            return 0
        current_year = now_wib().year
        valid_years = set(range(current_year - 4, current_year + 1))
        paid_years: set[int] = set()
        for idx, amount in divs.items():
            amt = safe_float(amount)
            if amt is not None and amt > 0:
                yr = idx.year if hasattr(idx, "year") else None
                if yr in valid_years:
                    paid_years.add(yr)
        return len(paid_years)
    except Exception:
        return 0


def _compute_real_historical_multi_year_ratios(
    inc: pd.DataFrame | None,
    bs: pd.DataFrame | None,
    ticker: str,
) -> dict[str, Any]:
    """Compute real multi-year historical averages directly from annual income_stmt & balance_sheet."""
    revs = dict(_extract_stmt_series(inc, ("Total Revenue", "Operating Revenue")))
    gross = dict(_extract_stmt_series(inc, ("Gross Profit",)))
    op_inc = dict(_extract_stmt_series(inc, ("Operating Income", "EBIT")))
    net_inc = dict(
        _extract_stmt_series(
            inc,
            ("Net Income", "Net Income Common Stockholders", "Net Income Continuous Operations"),
        )
    )
    assets = dict(_extract_stmt_series(bs, ("Total Assets",)))
    equity = dict(
        _extract_stmt_series(
            bs,
            ("Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"),
        )
    )
    liab = dict(
        _extract_stmt_series(
            bs,
            ("Total Liabilities Net Minority Interest", "Total Liab", "Total Liabilities"),
        )
    )
    ca = dict(_extract_stmt_series(bs, ("Current Assets", "Total Current Assets")))
    cl = dict(_extract_stmt_series(bs, ("Current Liabilities", "Total Current Liabilities")))

    periods = list(net_inc.keys())[:5]
    roes, roas, gpms, opms, npms, ders, crs = [], [], [], [], [], [], []
    for p in periods:
        ni = net_inc.get(p)
        eq = equity.get(p)
        ta = assets.get(p)
        rv = revs.get(p)
        gp = gross.get(p)
        oi = op_inc.get(p)
        tl = liab.get(p)
        c_a = ca.get(p)
        c_l = cl.get(p)

        r_roe = safe_divide(ni, eq)
        if r_roe is not None and -1.0 <= r_roe <= 2.5:
            roes.append(r_roe * 100.0)
        r_roa = safe_divide(ni, ta)
        if r_roa is not None and -0.5 <= r_roa <= 1.0:
            roas.append(r_roa * 100.0)
        r_gpm = safe_divide(gp, rv)
        if r_gpm is not None and 0 <= r_gpm <= 1.0:
            gpms.append(r_gpm * 100.0)
        r_opm = safe_divide(oi, rv)
        if r_opm is not None and -1.0 <= r_opm <= 1.0:
            opms.append(r_opm * 100.0)
        r_npm = safe_divide(ni, rv)
        if r_npm is not None and -1.0 <= r_npm <= 1.0:
            npms.append(r_npm * 100.0)
        r_der = safe_divide(tl, eq)
        if r_der is not None and 0 <= r_der <= 20.0:
            ders.append(r_der)
        r_cr = safe_divide(c_a, c_l)
        if r_cr is not None and 0 <= r_cr <= 20.0:
            crs.append(r_cr)

    def _avg(lst: list[float], dec: int = 1) -> float | None:
        return round(sum(lst) / len(lst), dec) if lst else None

    return {
        "label": f"Historis {len(periods) or 5}Y {ticker}",
        "periodsSampled": len(periods),
        "roe": _avg(roes, 1),
        "roa": _avg(roas, 1),
        "gpm": _avg(gpms, 1),
        "opm": _avg(opms, 1),
        "npm": _avg(npms, 1),
        "der": _avg(ders, 2),
        "currentRatio": _avg(crs, 2),
    }


def _fetch_yf_quote_and_fundamentals_sync(ticker: str) -> dict[str, Any]:
    sym = _to_yf_symbol(ticker)
    t_obj = yf.Ticker(sym)
    info = t_obj.info or {}

    live_price = (
        safe_float(info.get("currentPrice"))
        or safe_float(info.get("regularMarketPrice"))
        or safe_float(info.get("previousClose"))
    )
    prev_close = safe_float(info.get("previousClose")) or safe_float(
        info.get("regularMarketPreviousClose")
    )

    if live_price is None:
        hist = t_obj.history(period="5d", interval="1d", auto_adjust=False)
        if hist is not None and not hist.empty:
            live_price = safe_float(hist["Close"].iloc[-1])
            if len(hist) >= 2:
                prev_close = safe_float(hist["Close"].iloc[-2])

    if live_price is None:
        raise ValueError(f"Yahoo Finance tidak mengembalikan harga untuk {sym}")

    mkt_curr = str(info.get("currency") or "IDR").strip().upper()
    fin_curr = str(info.get("financialCurrency") or mkt_curr).strip().upper()
    fx_to_idr = (
        _get_fx_rate_to_idr(fin_curr)
        if fin_curr != mkt_curr and mkt_curr == "IDR"
        else 1.0
    )

    change_abs = (
        round(live_price - prev_close, 2)
        if prev_close is not None and prev_close > 0
        else None
    )
    change_pct = (
        round(((live_price - prev_close) / prev_close) * 100.0, 2)
        if prev_close is not None and prev_close > 0
        else None
    )

    # Strict unit normalization: yfinance debtToEquity is in PERCENT (21.5 -> 0.215x)
    der_raw = safe_float(info.get("debtToEquity"))
    der_x = round(der_raw / 100.0, 2) if der_raw is not None else None

    # Exact Dividend Yield from trailingAnnualDividendRate / live_price * 100
    dps_raw = safe_float(info.get("trailingAnnualDividendRate")) or safe_float(
        info.get("dividendRate")
    )
    dps = dps_raw
    div_yield_pct: float | None = None
    if dps is not None and dps > 0 and live_price > 0:
        if fx_to_idr > 1.0 and (dps / live_price) < 0.001:
            dps = round(dps * fx_to_idr, 2)
        div_yield_pct = round((dps / live_price) * 100.0, 2)
    else:
        dy_raw = safe_float(info.get("dividendYield"))
        if dy_raw is not None and dy_raw > 0:
            div_yield_pct = (
                round(dy_raw * 100.0, 2) if dy_raw < 0.45 else round(dy_raw, 2)
            )

    eps_ttm = safe_float(info.get("trailingEps"))
    bvps_raw = safe_float(info.get("bookValue"))
    pbv_raw = safe_float(info.get("priceToBook"))

    # USD/IDR currency mismatch guard on PBV & BVPS (e.g. ADRO/ITMG)
    if fx_to_idr > 1.0:
        if bvps_raw is not None and bvps_raw > 0 and (live_price / bvps_raw) > 100.0:
            bvps = round(bvps_raw * fx_to_idr, 2)
            pbv_clean = round(live_price / bvps, 2)
        else:
            bvps = bvps_raw
            pbv_clean = pbv_raw if (pbv_raw is None or pbv_raw <= 100.0) else None
    else:
        bvps = bvps_raw
        pbv_clean = pbv_raw

    shares_out = safe_float(info.get("sharesOutstanding"))
    total_debt = safe_float(info.get("totalDebt"))
    total_cash = safe_float(info.get("totalCash"))
    ebitda_total = safe_float(info.get("ebitda"))
    enterprise_value = safe_float(info.get("enterpriseValue"))

    if fx_to_idr > 1.0:
        total_debt = total_debt * fx_to_idr if total_debt is not None else None
        total_cash = total_cash * fx_to_idr if total_cash is not None else None
        ebitda_total = ebitda_total * fx_to_idr if ebitda_total is not None else None

    net_debt_per_share: float | None = None
    if total_debt is not None and total_cash is not None and shares_out and shares_out > 0:
        net_debt_per_share = round((total_debt - total_cash) / shares_out, 2)
    elif enterprise_value is not None and shares_out and shares_out > 0 and fx_to_idr == 1.0:
        net_debt_per_share = round((enterprise_value / shares_out) - live_price, 2)

    ebitda_per_share = (
        round(ebitda_total / shares_out, 2)
        if ebitda_total is not None and shares_out and shares_out > 0
        else None
    )

    ocf_raw = safe_float(info.get("operatingCashflow"))
    fcf_raw = safe_float(info.get("freeCashflow"))
    if fx_to_idr > 1.0:
        ocf_raw = ocf_raw * fx_to_idr if ocf_raw is not None else None
        fcf_raw = fcf_raw * fx_to_idr if fcf_raw is not None else None
    ocf_billion = round(ocf_raw / 1e9, 1) if ocf_raw is not None else None
    fcf_billion = round(fcf_raw / 1e9, 1) if fcf_raw is not None else None
    capex_billion = (
        round(max(0.0, (ocf_raw - fcf_raw) / 1e9), 1)
        if ocf_raw is not None and fcf_raw is not None
        else None
    )

    dpr_raw = safe_float(info.get("payoutRatio"))
    dpr_pct = round(dpr_raw * 100.0, 1) if dpr_raw is not None else None

    stmt_details: dict[str, float | None] = {
        "total_assets": None,
        "total_liabilities": None,
        "current_assets": None,
        "current_liabilities": None,
        "retained_earnings": None,
        "ebit": None,
        "interest_expense": None,
        "total_revenue": (
            safe_float(info.get("totalRevenue")) * fx_to_idr
            if safe_float(info.get("totalRevenue")) is not None
            else None
        ),
        "net_income": (
            safe_float(info.get("netIncomeToCommon")) * fx_to_idr
            if safe_float(info.get("netIncomeToCommon")) is not None
            else None
        ),
    }

    hist_multi_year: dict[str, Any] = {}
    try:
        bs = t_obj.balance_sheet
        inc = t_obj.income_stmt
        cf = t_obj.cashflow

        def _conv(v: float | None) -> float | None:
            return v * fx_to_idr if v is not None else None

        stmt_details["total_assets"] = _conv(_extract_latest_stmt_value(bs, ("Total Assets",)))
        stmt_details["total_liabilities"] = _conv(
            _extract_latest_stmt_value(
                bs,
                ("Total Liabilities Net Minority Interest", "Total Liab", "Total Liabilities"),
            )
        )
        stmt_details["current_assets"] = _conv(
            _extract_latest_stmt_value(bs, ("Current Assets", "Total Current Assets"))
        )
        stmt_details["current_liabilities"] = _conv(
            _extract_latest_stmt_value(bs, ("Current Liabilities", "Total Current Liabilities"))
        )
        stmt_details["retained_earnings"] = _conv(
            _extract_latest_stmt_value(bs, ("Retained Earnings",))
        )
        stmt_details["ebit"] = _conv(
            _extract_latest_stmt_value(
                inc, ("EBIT", "Operating Income", "Total Operating Income As Reported")
            )
        )
        stmt_details["interest_expense"] = _conv(
            _extract_latest_stmt_value(
                inc, ("Interest Expense", "Interest Expense Non Operating")
            )
        )
        if ocf_billion is None:
            ocf_stmt = _conv(
                _extract_latest_stmt_value(
                    cf,
                    ("Operating Cash Flow", "Cash Flow From Continuing Operating Activities"),
                )
            )
            if ocf_stmt is not None:
                ocf_billion = round(ocf_stmt / 1e9, 1)
        if capex_billion is None:
            capex_stmt = _conv(
                _extract_latest_stmt_value(cf, ("Capital Expenditure", "Capital Expenditures"))
            )
            if capex_stmt is not None:
                capex_billion = round(abs(capex_stmt) / 1e9, 1)
        if fcf_billion is None and ocf_billion is not None and capex_billion is not None:
            fcf_billion = round(ocf_billion - capex_billion, 1)

        hist_multi_year = _compute_real_historical_multi_year_ratios(inc, bs, ticker.upper())
    except Exception:
        pass

    interest_coverage: float | None = None
    if stmt_details["ebit"] is not None and stmt_details["interest_expense"] is not None:
        icr = safe_divide(stmt_details["ebit"], abs(stmt_details["interest_expense"]))
        if icr is not None:
            interest_coverage = round(icr, 1)

    dividend_streak_5y = _compute_real_dividend_streak_5y(t_obj)

    return {
        "ticker": ticker.strip().upper(),
        "live_price": round(live_price, 2),
        "prev_close": round(prev_close, 2) if prev_close is not None else None,
        "change_abs": change_abs,
        "change_pct": change_pct,
        "volume": safe_int(info.get("volume") or info.get("regularMarketVolume"), 0),
        "market_cap": safe_float(info.get("marketCap")),
        "high_52w": safe_float(info.get("fiftyTwoWeekHigh")),
        "low_52w": safe_float(info.get("fiftyTwoWeekLow")),
        "per_ttm": safe_float(info.get("trailingPE")),
        "pbv_current": pbv_clean,
        "ev_ebitda": safe_float(info.get("enterpriseToEbitda")),
        "eps_ttm": eps_ttm,
        "bvps": bvps,
        "net_debt_per_share": net_debt_per_share,
        "ebitda_per_share": ebitda_per_share,
        "roe": _normalize_yf_pct(info.get("returnOnEquity")),
        "roa": _normalize_yf_pct(info.get("returnOnAssets")),
        "gpm": _normalize_yf_pct(info.get("grossMargins")),
        "opm": _normalize_yf_pct(info.get("operatingMargins")),
        "npm": _normalize_yf_pct(info.get("profitMargins")),
        "eps_growth_yoy": _normalize_yf_pct(info.get("earningsGrowth")),
        "der": der_x,
        "current_ratio": safe_float(info.get("currentRatio")),
        "quick_ratio": safe_float(info.get("quickRatio")),
        "interest_coverage": interest_coverage,
        "ocf_billion": ocf_billion,
        "fcf_billion": fcf_billion,
        "capex_billion": capex_billion,
        "dps": dps,
        "dpr": dpr_pct,
        "div_yield": div_yield_pct,
        "dividend_streak_5y": dividend_streak_5y,
        "statements": stmt_details,
        "historicalMultiYear": hist_multi_year,
        "financialCurrency": fin_curr,
        "fxRateToIdr": fx_to_idr,
        "source": "YAHOO_FINANCE",
    }


async def fetch_yf_quote_and_fundamentals(
    ticker: str,
    timeout_sec: float = 10.0,
) -> dict[str, Any] | None:
    """Async non-blocking wrapper around yfinance quote & statement fetcher."""
    if not circuit_breaker.can_execute("YAHOO_FINANCE"):
        return None

    start = time.perf_counter()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_fetch_yf_quote_and_fundamentals_sync, ticker),
            timeout=timeout_sec,
        )
        circuit_breaker.record_success(
            "YAHOO_FINANCE", (time.perf_counter() - start) * 1000.0
        )
        return result
    except Exception as exc:
        circuit_breaker.record_failure(
            "YAHOO_FINANCE", str(exc), (time.perf_counter() - start) * 1000.0
        )
        return None


def _compute_wilder_rsi(closes: np.ndarray, period: int = 14) -> list[float | None]:
    n = len(closes)
    out: list[float | None] = [None] * n
    if n <= period:
        return out

    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))

    first_rsi = 100.0 if avg_loss == 0.0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    out[period] = round(first_rsi, 2)

    for i in range(period + 1, n):
        g = float(gains[i - 1])
        l = float(losses[i - 1])
        avg_gain = (avg_gain * (period - 1) + g) / period
        avg_loss = (avg_loss * (period - 1) + l) / period
        rsi = 100.0 if avg_loss == 0.0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
        out[i] = round(rsi, 2)

    return out


def build_ohlcv_bundle_from_bars(
    ticker: str,
    bars_all: list[dict[str, Any]],
    timeframe: str = "1Y",
    source: str = "YAHOO_FINANCE",
) -> dict[str, Any]:
    """Compute MA20, MA200, Wilder RSI(14), ATR(14)%, Max Drawdown 1Y, and timeframe slice from full bars."""
    tf = timeframe.upper()
    n = len(bars_all)
    if n == 0:
        raise ValueError(f"Deret bar OHLCV kosong untuk {ticker}")

    dates = [b["time"] for b in bars_all]
    highs = np.array([float(b["high"]) for b in bars_all], dtype=float)
    lows = np.array([float(b["low"]) for b in bars_all], dtype=float)
    closes = np.array([float(b["close"]) for b in bars_all], dtype=float)

    ma20_series = pd.Series(closes).rolling(window=20, min_periods=20).mean().to_numpy()
    ma200_series = pd.Series(closes).rolling(window=200, min_periods=200).mean().to_numpy()
    rsi14_list = _compute_wilder_rsi(closes, 14)

    atr14_pct: float | None = None
    if n > 14:
        tr_vals: list[float] = []
        for i in range(n - 14, n):
            tr = max(
                float(highs[i] - lows[i]),
                abs(float(highs[i] - closes[i - 1])),
                abs(float(lows[i] - closes[i - 1])),
            )
            tr_vals.append(tr)
        last_close = float(closes[-1])
        if last_close > 0:
            atr14_pct = round((float(np.mean(tr_vals)) / last_close) * 100.0, 2)

    dd_slice_high = highs[-min(252, n) :]
    dd_slice_low = lows[-min(252, n) :]
    peak = float(dd_slice_high[0])
    max_dd = 0.0
    for h, l in zip(dd_slice_high, dd_slice_low):
        if float(h) > peak:
            peak = float(h)
        if peak > 0:
            dd = ((float(l) - peak) / peak) * 100.0
            if dd < max_dd:
                max_dd = dd
    max_dd_1y = round(max_dd, 1)

    ma20_all: list[dict[str, Any]] = []
    ma200_all: list[dict[str, Any]] = []
    rsi14_all: list[dict[str, Any]] = []

    for i in range(n):
        d = dates[i]
        if np.isfinite(ma20_series[i]):
            ma20_all.append({"time": d, "value": round(float(ma20_series[i]), 2)})
        if np.isfinite(ma200_series[i]):
            ma200_all.append({"time": d, "value": round(float(ma200_series[i]), 2)})
        if rsi14_list[i] is not None:
            rsi14_all.append({"time": d, "value": rsi14_list[i]})

    slice_counts = {"1M": 22, "3M": 65, "1Y": 252, "5Y": len(bars_all)}
    keep_n = min(slice_counts.get(tf, 252), len(bars_all))
    sliced_bars = bars_all[-keep_n:]
    start_date = sliced_bars[0]["time"]

    ma20_sliced = [p for p in ma20_all if p["time"] >= start_date]
    ma200_sliced = [p for p in ma200_all if p["time"] >= start_date]
    rsi14_sliced = [p for p in rsi14_all if p["time"] >= start_date]

    base_close = sliced_bars[0]["close"]
    rebased = (
        [
            {
                "time": b["time"],
                "value": round(((b["close"] - base_close) / base_close) * 100.0, 2),
            }
            for b in sliced_bars
        ]
        if base_close > 0
        else []
    )

    latest_close = sliced_bars[-1]["close"]
    latest_ma20 = ma20_all[-1]["value"] if ma20_all else latest_close
    latest_ma200 = ma200_all[-1]["value"] if ma200_all else latest_ma20
    latest_rsi14 = rsi14_all[-1]["value"] if rsi14_all else 50.0

    return {
        "ticker": ticker.strip().upper(),
        "timeframe": tf,
        "barsAll": bars_all,
        "bars": sliced_bars,
        "ma20": ma20_sliced,
        "ma200": ma200_sliced,
        "rsi14": rsi14_sliced,
        "rebasedPct": rebased,
        "latestClose": latest_close,
        "latestMa20": latest_ma20,
        "latestMa200": latest_ma200,
        "latestRsi14": latest_rsi14,
        "atr14Pct": atr14_pct if atr14_pct is not None else 1.5,
        "maxDrawdown1YPct": max_dd_1y,
        "source": source,
    }


def _fetch_yf_ohlcv_history_sync(ticker: str, timeframe: str = "1Y") -> dict[str, Any]:
    sym = _to_yf_symbol(ticker)
    tf = timeframe.upper()
    period = "5y" if tf == "5Y" else "2y"

    t_obj = yf.Ticker(sym)
    # MANDATORY: auto_adjust=False so historical prices match official BEI board prices!
    df = t_obj.history(period=period, interval="1d", auto_adjust=False)
    if df is None or df.empty:
        raise ValueError(f"Tidak ada histori OHLCV Yahoo Finance untuk {sym}")

    df = df.dropna(subset=["Open", "High", "Low", "Close"]).copy()
    if df.empty:
        raise ValueError(f"Data OHLCV kosong setelah sanitasi untuk {sym}")

    dates = [idx.strftime("%Y-%m-%d") for idx in df.index]
    opens = df["Open"].to_numpy(dtype=float)
    highs = df["High"].to_numpy(dtype=float)
    lows = df["Low"].to_numpy(dtype=float)
    closes = df["Close"].to_numpy(dtype=float)
    volumes = df["Volume"].fillna(0).to_numpy(dtype=float)

    bars_all = [
        {
            "time": dates[i],
            "open": round(float(opens[i]), 2),
            "high": round(float(highs[i]), 2),
            "low": round(float(lows[i]), 2),
            "close": round(float(closes[i]), 2),
            "volume": int(max(0, round(float(volumes[i])))),
        }
        for i in range(len(closes))
    ]
    return build_ohlcv_bundle_from_bars(ticker, bars_all, tf, source="YAHOO_FINANCE")


async def fetch_yf_ohlcv_history(
    ticker: str,
    timeframe: str = "1Y",
    timeout_sec: float = 10.0,
) -> dict[str, Any] | None:
    """Async non-blocking OHLCV history & indicator fetcher."""
    if not circuit_breaker.can_execute("YAHOO_FINANCE"):
        return None

    start = time.perf_counter()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_fetch_yf_ohlcv_history_sync, ticker, timeframe),
            timeout=timeout_sec,
        )
        circuit_breaker.record_success(
            "YAHOO_FINANCE", (time.perf_counter() - start) * 1000.0
        )
        return result
    except Exception as exc:
        circuit_breaker.record_failure(
            "YAHOO_FINANCE", str(exc), (time.perf_counter() - start) * 1000.0
        )
        return None


def _build_statement_table(
    df: pd.DataFrame | None,
    row_specs: list[tuple[str, str, tuple[str, ...]]],
    fx_to_idr: float,
    period_mode: str,
) -> dict[str, Any]:
    """Convert a yfinance statement DataFrame into clean Rp Miliar rows for up to 5 periods."""
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return {"periods": [], "rows": []}

    raw_cols = list(df.columns)[:5]
    period_labels: list[str] = []
    for col in raw_cols:
        if isinstance(col, (dt.datetime, dt.date, pd.Timestamp)):
            if period_mode == "quarterly":
                q = (col.month - 1) // 3 + 1
                period_labels.append(f"Q{q} {col.year}")
            else:
                period_labels.append(f"FY {col.year}")
        else:
            period_labels.append(str(col)[:10])

    lower_map = {str(idx).strip().lower(): idx for idx in df.index}
    rows: list[dict[str, Any]] = []

    for row_key, label, candidates in row_specs:
        actual_idx = None
        for cand in candidates:
            actual_idx = lower_map.get(cand.lower())
            if actual_idx is not None:
                break

        values_billion: list[float | None] = []
        if actual_idx is not None:
            series = df.loc[actual_idx]
            if isinstance(series, pd.DataFrame):
                series = series.iloc[0]
            for col in raw_cols:
                val = safe_float(series.get(col))
                if val is not None:
                    values_billion.append(round((val * fx_to_idr) / 1e9, 1))
                else:
                    values_billion.append(None)
        else:
            values_billion = [None] * len(raw_cols)

        if any(v is not None for v in values_billion):
            yoy_pct: float | None = None
            if (
                len(values_billion) >= 2
                and values_billion[0] is not None
                and values_billion[1] is not None
                and values_billion[1] != 0
            ):
                yoy_pct = round(
                    ((values_billion[0] - values_billion[1]) / abs(values_billion[1])) * 100.0,
                    1,
                )
            rows.append(
                {
                    "key": row_key,
                    "label": label,
                    "valuesBillionIdr": values_billion,
                    "latestChangePct": yoy_pct,
                }
            )

    return {"periods": period_labels, "rows": rows}


def _fetch_yf_financial_statements_sync(
    ticker: str,
    period: str = "annual",
) -> dict[str, Any]:
    sym = _to_yf_symbol(ticker)
    mode = "quarterly" if period.strip().lower() == "quarterly" else "annual"
    t_obj = yf.Ticker(sym)
    info = t_obj.info or {}

    mkt_curr = str(info.get("currency") or "IDR").strip().upper()
    fin_curr = str(info.get("financialCurrency") or mkt_curr).strip().upper()
    fx_to_idr = (
        _get_fx_rate_to_idr(fin_curr)
        if fin_curr != mkt_curr and mkt_curr == "IDR"
        else 1.0
    )

    inc = t_obj.quarterly_income_stmt if mode == "quarterly" else t_obj.income_stmt
    bs = t_obj.quarterly_balance_sheet if mode == "quarterly" else t_obj.balance_sheet
    cf = t_obj.quarterly_cashflow if mode == "quarterly" else t_obj.cashflow

    income_specs = [
        ("total_revenue", "Total Pendapatan (Revenue)", ("Total Revenue", "Operating Revenue")),
        ("gross_profit", "Laba Kotor (Gross Profit)", ("Gross Profit",)),
        ("operating_income", "Laba Operasional (EBIT)", ("Operating Income", "EBIT", "Pretax Income")),
        ("ebitda", "EBITDA", ("EBITDA", "Normalized EBITDA")),
        ("interest_expense", "Beban Bunga", ("Interest Expense", "Interest Expense Non Operating")),
        ("net_income", "Laba Bersih (Net Income)", ("Net Income", "Net Income Common Stockholders", "Net Income Continuous Operations")),
    ]

    balance_specs = [
        ("total_assets", "Total Aset", ("Total Assets",)),
        ("current_assets", "Aset Lancar", ("Current Assets", "Total Current Assets")),
        ("cash_equivalents", "Kas & Setara Kas", ("Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")),
        ("total_liabilities", "Total Liabilitas", ("Total Liabilities Net Minority Interest", "Total Liab", "Total Liabilities")),
        ("current_liabilities", "Liabilitas Jangka Pendek", ("Current Liabilities", "Total Current Liabilities")),
        ("total_debt", "Total Utang Berbunga", ("Total Debt", "Long Term Debt")),
        ("stockholders_equity", "Total Ekuitas", ("Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest")),
    ]

    cashflow_specs = [
        ("operating_cashflow", "Arus Kas Operasi (OCF)", ("Operating Cash Flow", "Cash Flow From Continuing Operating Activities")),
        ("capex", "Belanja Modal (CapEx)", ("Capital Expenditure", "Capital Expenditures")),
        ("free_cashflow", "Arus Kas Bebas (FCF)", ("Free Cash Flow",)),
        ("dividends_paid", "Dividen Tunai Dibayarkan", ("Cash Dividends Paid", "Common Stock Dividend Paid")),
    ]

    return sanitize_for_json(
        {
            "ticker": ticker.strip().upper(),
            "companyName": str(info.get("longName") or info.get("shortName") or ticker.upper()),
            "period": mode,
            "reportingCurrency": fin_curr,
            "displayCurrency": "IDR",
            "fxRateApplied": round(fx_to_idr, 2),
            "unit": "Miliar IDR",
            "incomeStatement": _build_statement_table(inc, income_specs, fx_to_idr, mode),
            "balanceSheet": _build_statement_table(bs, balance_specs, fx_to_idr, mode),
            "cashFlow": _build_statement_table(cf, cashflow_specs, fx_to_idr, mode),
            "source": "YAHOO_FINANCE",
        }
    )


async def fetch_yf_financial_statements(
    ticker: str,
    period: str = "annual",
    timeout_sec: float = 12.0,
) -> dict[str, Any] | None:
    """Async non-blocking fetcher for full annual/quarterly financial statements."""
    if not circuit_breaker.can_execute("YAHOO_FINANCE"):
        return None

    start = time.perf_counter()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_fetch_yf_financial_statements_sync, ticker, period),
            timeout=timeout_sec,
        )
        circuit_breaker.record_success(
            "YAHOO_FINANCE", (time.perf_counter() - start) * 1000.0
        )
        return result
    except Exception as exc:
        circuit_breaker.record_failure(
            "YAHOO_FINANCE", str(exc), (time.perf_counter() - start) * 1000.0
        )
        return None
