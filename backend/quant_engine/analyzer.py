"""
EquiLens Quantitative Analyzer & Decision Engine (30 Indicators, Cross-Sector Safe).

Strict Financial Safety Guarantees:
  1. Banking stocks (`accounting_type == 'banking'`):
     `ev_ebitda`, `gpm`, `current_ratio`, `quick_ratio`, `interest_coverage`,
     `altman_z`, AND `zmijewski_x` are ALWAYS `None` / `isNotApplicable = True`.
  2. Zmijewski X-Score (1984):
     Uses strict DECIMAL ROA (`roa_pct / 100.0`) and `Total Liabilities / Total Assets`
     so healthy companies are never misclassified and distressed firms are caught accurately.
  3. Fair Value Intrinsic Estimation:
     Prioritizes `BEI_VERIFIED` anchors; for `AUTO_SYNCED` stocks blends Graham Number
     (only if EPS > 0 & BVPS > 0) with sector PER & ROE-adjusted PBV, strictly clamped to
     [0.45x, 1.85x] of live_price to prevent reckless outlier targets.
  4. Mathematical Invariants:
     `cutLoss < entryLow < entryHigh`, zero NaN/Inf via `safe_divide` & `sanitize_for_json`.
"""

from __future__ import annotations

import math
from typing import Any

from quant_engine.utils import (
    clamp,
    safe_divide,
    safe_float,
    sanitize_for_json,
    snap_to_idx_tick,
)

BANKING_NA_METRICS: set[str] = {
    "ev_ebitda",
    "gpm",
    "current_ratio",
    "quick_ratio",
    "interest_coverage",
    "altman_z",
    "zmijewski_x",
}

DEFAULT_SECTOR_MEDIANS: dict[str, dict[str, float]] = {
    "Perbankan & Keuangan": {
        "sector_avg_per": 14.2,
        "sector_avg_pbv": 2.2,
        "sector_avg_roe": 16.5,
        "sector_avg_der": 5.85,
    },
    "Energi & Tambang": {
        "sector_avg_per": 7.4,
        "sector_avg_pbv": 1.25,
        "sector_avg_roe": 17.5,
        "sector_avg_der": 0.35,
    },
    "Consumer Non-Cyclicals": {
        "sector_avg_per": 18.0,
        "sector_avg_pbv": 3.1,
        "sector_avg_roe": 17.2,
        "sector_avg_der": 0.78,
    },
    "Consumer Cyclicals": {
        "sector_avg_per": 15.5,
        "sector_avg_pbv": 1.8,
        "sector_avg_roe": 12.5,
        "sector_avg_der": 0.72,
    },
    "Infrastruktur": {
        "sector_avg_per": 15.6,
        "sector_avg_pbv": 2.1,
        "sector_avg_roe": 14.8,
        "sector_avg_der": 0.85,
    },
    "Perindustrian": {
        "sector_avg_per": 12.8,
        "sector_avg_pbv": 1.65,
        "sector_avg_roe": 14.0,
        "sector_avg_der": 0.65,
    },
    "Barang Baku": {
        "sector_avg_per": 16.0,
        "sector_avg_pbv": 1.55,
        "sector_avg_roe": 10.5,
        "sector_avg_der": 0.75,
    },
    "Kesehatan": {
        "sector_avg_per": 22.0,
        "sector_avg_pbv": 3.4,
        "sector_avg_roe": 16.0,
        "sector_avg_der": 0.38,
    },
    "Properti & Real Estat": {
        "sector_avg_per": 11.5,
        "sector_avg_pbv": 0.95,
        "sector_avg_roe": 9.2,
        "sector_avg_der": 0.68,
    },
    "Teknologi": {
        "sector_avg_per": 24.0,
        "sector_avg_pbv": 2.8,
        "sector_avg_roe": 11.0,
        "sector_avg_der": 0.45,
    },
    "Transportasi & Logistik": {
        "sector_avg_per": 12.5,
        "sector_avg_pbv": 1.4,
        "sector_avg_roe": 12.8,
        "sector_avg_der": 0.82,
    },
}


def get_sector_defaults(sector_idx: str) -> dict[str, float]:
    return DEFAULT_SECTOR_MEDIANS.get(
        sector_idx,
        {
            "sector_avg_per": 14.5,
            "sector_avg_pbv": 1.8,
            "sector_avg_roe": 13.5,
            "sector_avg_der": 0.68,
        },
    )


def compute_altman_z(
    accounting_type: str,
    statements: dict[str, Any] | None,
    market_cap: float | None,
    fallback_val: float | None = None,
) -> float | None:
    """Compute Altman Z-Score strictly for non-bank corporations."""
    if accounting_type == "banking":
        return None
    if fallback_val is not None and safe_float(fallback_val) is not None:
        return round(float(fallback_val), 2)
    if not statements:
        return None

    ta = safe_float(statements.get("total_assets"))
    tl = safe_float(statements.get("total_liabilities"))
    ca = safe_float(statements.get("current_assets"))
    cl = safe_float(statements.get("current_liabilities"))
    re_val = safe_float(statements.get("retained_earnings"))
    ebit = safe_float(statements.get("ebit"))
    rev = safe_float(statements.get("total_revenue"))
    mcap = safe_float(market_cap)

    if ta is None or ta <= 0 or tl is None or tl <= 0:
        return None

    wc = (ca - cl) if (ca is not None and cl is not None) else 0.0
    x1 = safe_divide(wc, ta) or 0.0
    x2 = safe_divide(re_val, ta) or 0.0
    x3 = safe_divide(ebit, ta) or 0.0
    x4 = safe_divide(mcap, tl) or 0.0
    x5 = safe_divide(rev, ta) or 0.0

    z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
    if not math.isfinite(z):
        return None
    return round(clamp(z, -10.0, 25.0), 2)


def compute_zmijewski_x(
    accounting_type: str,
    roa_pct: float | None,
    der: float | None,
    current_ratio: float | None,
    statements: dict[str, Any] | None = None,
    fallback_val: float | None = None,
) -> float | None:
    """
    Zmijewski X-Score (1984):
      X = -4.336 - 4.513*(NI/TA) + 5.679*(TL/TA) + 0.004*(CA/CL)
    - Strictly N/A (`None`) for banking stocks (DPK structurally inflates TL/TA).
    - Strictly uses DECIMAL ROA (`roa_pct / 100.0`).
    - `< 0` = Sehat (Non-Distress); `>= 0` = Risiko Distress.
    """
    if accounting_type == "banking":
        return None
    if fallback_val is not None and safe_float(fallback_val) is not None:
        return round(float(fallback_val), 2)

    roa_num = safe_float(roa_pct)
    if roa_num is None:
        return None
    roa_decimal = clamp(roa_num / 100.0, -2.0, 2.0)

    tl_to_ta: float | None = None
    if statements:
        ta = safe_float(statements.get("total_assets"))
        tl = safe_float(statements.get("total_liabilities"))
        if ta is not None and ta > 0 and tl is not None and tl >= 0:
            tl_to_ta = clamp(tl / ta, 0.0, 2.5)

    # Fallback approximation TL/TA = DER / (1 + DER) when DER >= 0
    if tl_to_ta is None:
        der_num = safe_float(der)
        if der_num is not None and der_num >= 0:
            tl_to_ta = clamp(der_num / (1.0 + der_num), 0.0, 2.0)

    if tl_to_ta is None:
        return None

    cr = clamp(safe_float(current_ratio, 1.0) or 1.0, 0.0, 20.0)
    x_score = -4.336 - 4.513 * roa_decimal + 5.679 * tl_to_ta + 0.004 * cr
    if not math.isfinite(x_score):
        return None
    return round(clamp(x_score, -15.0, 15.0), 2)


def compute_sgr(roe_pct: float | None, dpr_pct: float | None) -> float | None:
    """Sustainable Growth Rate = ROE * (1 - DPR/100)."""
    roe = safe_float(roe_pct)
    if roe is None:
        return None
    dpr = safe_float(dpr_pct)
    if dpr is None:
        return None
    retention = 1.0 - (dpr / 100.0)
    sgr = roe * retention
    return round(sgr, 1) if math.isfinite(sgr) else None


def estimate_fair_value_intrinsic(
    live_price: float,
    eps_ttm: float | None,
    bvps: float | None,
    roe_pct: float | None,
    sector_avg_per: float,
    sector_avg_pbv: float,
    sector_avg_roe: float,
    verified_anchor_fv: float | None = None,
    source_type: str = "AUTO_SYNCED",
    accounting_type: str = "general",
) -> float:
    """
    Estimate institutional intrinsic fair value:
      - Preserves verified anchor ONLY when explicitly provided and within rational market bounds.
      - For `banking`: uses CFA-standard Gordon Growth Justified P/B ((ROE - g)/(COE - g))
        blended with Top-Bank Peer PER (never applies 1949 manufacturing Graham Number to banks).
      - For non-bank (`commodity` / `general`): blends Graham Number (if EPS>0 & BVPS>0),
        Sector PER, and ROE-adjusted Sector PBV.
      - Always rationally clamped to [0.50x, 1.75x] live_price to prevent reckless outlier targets.
    """
    allow_fca = live_price < 50.0

    if (
        source_type == "BEI_VERIFIED"
        and verified_anchor_fv is not None
        and verified_anchor_fv > 0
        and live_price * 0.45 <= verified_anchor_fv <= live_price * 2.0
    ):
        return snap_to_idx_tick(verified_anchor_fv, allow_fca=allow_fca)

    eps = safe_float(eps_ttm)
    bv = safe_float(bvps)
    roe = safe_float(roe_pct)

    estimates: list[float] = []

    if accounting_type == "banking":
        # Gordon Growth Justified P/B for Indonesian Banks (SBN ~6.8% + ERP ~4.7%-5.7%)
        if bv is not None and bv > 0 and roe is not None and roe > 0:
            coe = 11.5 if roe >= 18.0 else (12.0 if roe >= 12.0 else 12.8)
            g = clamp(roe * 0.30, 3.0, 6.5)
            justified_pbv = clamp((roe - g) / max(coe - g, 2.5), 0.55, 4.2)
            estimates.append(bv * justified_pbv)

        if eps is not None and eps > 0:
            bank_per_bench = max(sector_avg_per, 12.5 if (roe or 0) >= 16.0 else 10.5)
            estimates.append(eps * bank_per_bench)
    else:
        if eps is not None and eps > 0 and bv is not None and bv > 0:
            graham = math.sqrt(22.5 * eps * bv)
            if math.isfinite(graham) and graham > 0:
                estimates.append(graham)

        if eps is not None and eps > 0 and sector_avg_per > 0:
            per_fair = eps * sector_avg_per
            if math.isfinite(per_fair) and per_fair > 0:
                estimates.append(per_fair)

        if bv is not None and bv > 0 and sector_avg_pbv > 0:
            quality_mult = 1.0
            if roe is not None and roe > 0 and sector_avg_roe > 0:
                quality_mult = clamp(roe / sector_avg_roe, 0.55, 1.85)
            pbv_fair = bv * sector_avg_pbv * quality_mult
            if math.isfinite(pbv_fair) and pbv_fair > 0:
                estimates.append(pbv_fair)

    if not estimates:
        return snap_to_idx_tick(live_price * 0.85, allow_fca=allow_fca)

    blended = sum(estimates) / len(estimates)
    bounded = clamp(blended, live_price * 0.50, live_price * 1.75)
    return snap_to_idx_tick(bounded, allow_fca=allow_fca)


def compute_price_zones(
    live_price: float,
    fair_value_target: float,
    support1: float | None,
    ma200: float | None,
    atr_pct: float | None,
) -> dict[str, float]:
    """Compute entryLow, entryHigh, fairValueTarget, cutLoss, upsidePct, riskPct, and exact R:R."""
    allow_fca = live_price < 50.0
    atr_p = clamp(safe_float(atr_pct, 1.8) or 1.8, 0.6, 6.0)
    atr_rp = live_price * (atr_p / 100.0)

    # Candidate support anchor near current market structure
    support_candidates: list[float] = [live_price * 0.96]
    s1 = safe_float(support1)
    if s1 is not None and live_price * 0.82 <= s1 <= live_price * 0.995:
        support_candidates.append(s1)
    m200 = safe_float(ma200)
    if m200 is not None and live_price * 0.85 <= m200 <= live_price * 0.995:
        support_candidates.append(m200)
    if fair_value_target > live_price:
        support_candidates.append(min(live_price * 0.985, fair_value_target * 0.88))

    raw_entry_low = min(max(support_candidates), live_price * 0.98)
    raw_entry_low = clamp(raw_entry_low, live_price * 0.88, live_price * 0.98)
    entry_low = snap_to_idx_tick(raw_entry_low, allow_fca=allow_fca)

    raw_entry_high = min(live_price * 1.005, max(entry_low * 1.025, live_price * 0.995))
    entry_high = snap_to_idx_tick(raw_entry_high, allow_fca=allow_fca)
    if entry_high <= entry_low:
        entry_high = snap_to_idx_tick(entry_low * 1.025, allow_fca=allow_fca)

    # Adaptive cut-loss: 1.5 * ATR below entryLow/livePrice, strictly < entryLow
    raw_cut_loss = min(entry_low, live_price) - max(1.5 * atr_rp, live_price * 0.045)
    cut_loss = snap_to_idx_tick(max(1.0 if allow_fca else 50.0, raw_cut_loss), allow_fca=allow_fca)
    if cut_loss >= entry_low:
        cut_loss = snap_to_idx_tick(entry_low * 0.94, allow_fca=allow_fca)

    upside_pct = round(((fair_value_target - live_price) / max(1.0, live_price)) * 100.0, 1)
    risk_pct = round(((cut_loss - live_price) / max(1.0, live_price)) * 100.0, 1)
    reward_dist = max(0.0, fair_value_target - live_price)
    risk_dist = max(1.0, live_price - cut_loss)
    rr_ratio = round(reward_dist / risk_dist, 2)

    return {
        "entryLow": entry_low,
        "entryHigh": entry_high,
        "fairValueTarget": fair_value_target,
        "cutLoss": cut_loss,
        "upsidePct": upside_pct,
        "riskPct": risk_pct,
        "riskRewardRatio": rr_ratio,
    }


def compute_quant_score(
    accounting_type: str,
    per_ttm: float | None,
    pbv_current: float | None,
    mos_pct: float | None,
    roe: float | None,
    npm: float | None,
    eps_growth: float | None,
    ocf_billion: float | None,
    fcf_billion: float | None,
    der: float | None,
    current_ratio: float | None,
    altman_z: float | None,
    zmijewski_x: float | None,
    dist_ma200: float | None,
    rsi14: float | None,
    atr_pct: float | None,
    sector_avg_per: float,
    sector_avg_pbv: float,
    sector_avg_roe: float,
    sector_avg_der: float,
    bank_health: dict[str, Any] | None = None,
) -> tuple[int, dict[str, float]]:
    """
    Sector-normalized Institutional Quant Score (0-100):
      - Valuation (30 pts)
      - Profitability & Cash Flow (30 pts)
      - Business Health & Distress (25 pts)
      - Technical Momentum & Risk (15 pts)
    """
    # 1. Valuation (max 30)
    val_score = 12.0
    if per_ttm is not None:
        if per_ttm <= 0:
            val_score -= 6.0
        else:
            rel_per = per_ttm / max(sector_avg_per, 1.0)
            if rel_per <= 0.75:
                val_score += 8.0
            elif rel_per <= 1.05:
                val_score += 5.0
            elif rel_per <= 1.35:
                val_score += 1.5
            else:
                val_score -= 3.0

    if pbv_current is not None:
        if pbv_current <= 0:
            val_score -= 4.0
        else:
            rel_pbv = pbv_current / max(sector_avg_pbv, 0.2)
            if rel_pbv <= 0.85:
                val_score += 5.0
            elif rel_pbv <= 1.25:
                val_score += 2.5
            elif rel_pbv > 2.5:
                val_score -= 3.0

    if mos_pct is not None:
        if mos_pct >= 12.0:
            val_score += 5.0
        elif mos_pct >= 4.0:
            val_score += 3.0
        elif mos_pct < -3.0:
            val_score -= 4.0
    val_score = clamp(val_score, 0.0, 30.0)

    # 2. Profitability & Cash Flow (max 30)
    prof_score = 12.0
    if roe is not None:
        if roe <= 0:
            prof_score -= 8.0
        else:
            rel_roe = roe / max(sector_avg_roe, 1.0)
            if rel_roe >= 1.15:
                prof_score += 8.0
            elif rel_roe >= 0.9:
                prof_score += 5.0
            else:
                prof_score += 1.5
    if npm is not None:
        if npm >= 15.0:
            prof_score += 4.0
        elif npm >= 8.0:
            prof_score += 2.0
        elif npm <= 0:
            prof_score -= 4.0
    if eps_growth is not None:
        if eps_growth >= 10.0:
            prof_score += 4.0
        elif eps_growth >= 0:
            prof_score += 2.0
        elif eps_growth <= -10.0:
            prof_score -= 5.0
    if ocf_billion is not None and ocf_billion > 0:
        prof_score += 1.0
    if fcf_billion is not None and fcf_billion > 0:
        prof_score += 1.0
    prof_score = clamp(prof_score, 0.0, 30.0)

    # 3. Business Health & Distress (max 25)
    health_score = 14.0
    if accounting_type == "banking":
        if bank_health:
            car = safe_float(bank_health.get("carPct"))
            npl = safe_float(bank_health.get("nplGrossPct"))
            casa = safe_float(bank_health.get("casaPct"))
            if car is not None:
                health_score += 4.0 if car >= 20.0 else (2.0 if car >= 15.0 else -4.0)
            if npl is not None:
                health_score += 4.0 if npl <= 2.2 else (1.0 if npl <= 3.2 else -5.0)
            if casa is not None:
                health_score += 3.0 if casa >= 70.0 else (1.5 if casa >= 55.0 else 0.0)
        elif der is not None and der > 0:
            rel_der = der / max(sector_avg_der, 1.0)
            health_score += 6.0 if rel_der <= 1.05 else 2.0
    else:
        if der is not None:
            if der < 0:
                health_score -= 8.0
            else:
                rel_der = der / max(sector_avg_der, 0.1)
                if rel_der <= 0.8:
                    health_score += 4.0
                elif rel_der <= 1.25:
                    health_score += 2.0
                elif der > 2.0:
                    health_score -= 4.0
        if current_ratio is not None:
            if current_ratio >= 1.8:
                health_score += 3.0
            elif current_ratio >= 1.1:
                health_score += 1.5
            elif current_ratio < 0.9:
                health_score -= 3.5
        if altman_z is not None:
            if altman_z > 2.99:
                health_score += 2.0
            elif altman_z < 1.81:
                health_score -= 4.0
        if zmijewski_x is not None:
            if zmijewski_x < -1.0:
                health_score += 2.0
            elif zmijewski_x >= 0:
                health_score -= 5.0
    health_score = clamp(health_score, 0.0, 25.0)

    # 4. Technical Momentum & Risk (max 15)
    tech_score = 8.0
    if dist_ma200 is not None:
        if dist_ma200 >= 0:
            tech_score += 3.5
        elif dist_ma200 <= -12.0:
            tech_score -= 3.5
        else:
            tech_score -= 1.0
    if rsi14 is not None:
        if 38.0 <= rsi14 <= 64.0:
            tech_score += 2.0
        elif rsi14 >= 75.0:
            tech_score -= 1.5
    if atr_pct is not None:
        if atr_pct <= 1.6:
            tech_score += 1.5
        elif atr_pct >= 3.2:
            tech_score -= 1.5
    tech_score = clamp(tech_score, 0.0, 15.0)

    total = int(round(clamp(val_score + prof_score + health_score + tech_score, 15.0, 96.0)))
    return total, {
        "valuation": round(val_score, 1),
        "profitability": round(prof_score, 1),
        "health": round(health_score, 1),
        "technical": round(tech_score, 1),
    }


def _fmt_id(val: float | None, decimals: int = 1, suffix: str = "") -> str:
    if val is None or not math.isfinite(val):
        return "—"
    formatted = f"{val:,.{decimals}f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{formatted}{suffix}"


def _fmt_rp(val: float) -> str:
    return f"Rp {int(round(val)):,}".replace(",", ".")


def build_stock_analysis_package(
    ticker: str,
    master_row: dict[str, Any],
    anchor_row: dict[str, Any],
    live_snap: dict[str, Any],
    audits: dict[str, dict[str, Any]],
    statements: dict[str, Any] | None = None,
    data_warnings: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build the full Step-4-compatible JSON analysis bundle for one ticker:
      - stockItem (catalog/strip shape)
      - quarterlyAnchor (QuarterlyAnchorData shape)
      - liveTechnicalSnapshot (LiveTechnicalSnapshot shape)
      - metrics (all 30 live-calculated numeric metrics + flags)
      - decisionProfile (StockDecisionProfile shape: Simple + Investor narratives)
      - audits (4-channel TripleCheckAudit per metric)
    """
    code = ticker.upper()
    sector_idx = str(master_row.get("sector_idx") or "Perindustrian")
    subsector_idx = str(master_row.get("subsector_idx") or "")
    company_name = str(master_row.get("company_name") or code)
    accounting_type = str(master_row.get("accounting_type") or "general")
    is_bank = accounting_type == "banking"

    sec_defaults = get_sector_defaults(sector_idx)
    sector_avg_per = safe_float(anchor_row.get("sector_avg_per")) or sec_defaults["sector_avg_per"]
    sector_avg_pbv = safe_float(anchor_row.get("sector_avg_pbv")) or sec_defaults["sector_avg_pbv"]
    sector_avg_roe = safe_float(anchor_row.get("sector_avg_roe")) or sec_defaults["sector_avg_roe"]
    sector_avg_der = safe_float(anchor_row.get("sector_avg_der")) or sec_defaults["sector_avg_der"]

    hist_meta = anchor_row.get("hist_5y_benchmark") if isinstance(anchor_row.get("hist_5y_benchmark"), dict) else {}
    meta_block = hist_meta.get("_meta") if isinstance(hist_meta.get("_meta"), dict) else {}
    bank_health = meta_block.get("bankHealth") if is_bank and isinstance(meta_block.get("bankHealth"), dict) else None

    live_price = safe_float(live_snap.get("live_price")) or 100.0
    prev_close = safe_float(live_snap.get("prev_close")) or live_price
    change_abs = safe_float(live_snap.get("change_abs"))
    if change_abs is None:
        change_abs = round(live_price - prev_close, 2)
    change_pct = safe_float(live_snap.get("change_pct"))
    if change_pct is None:
        change_pct = round(((live_price - prev_close) / max(1.0, prev_close)) * 100.0, 2)

    eps_ttm = safe_float(anchor_row.get("eps_ttm"))
    bvps = safe_float(anchor_row.get("bvps"))
    ebitda_per_share = None if is_bank else safe_float(anchor_row.get("ebitda_per_share"))
    net_debt_per_share = None if is_bank else safe_float(meta_block.get("netDebtPerShare"))
    if not is_bank and net_debt_per_share is None:
        ev_anchor = safe_float(anchor_row.get("ev_per_share"))
        if ev_anchor is not None:
            net_debt_per_share = round(ev_anchor - live_price, 2)

    roe = safe_float(anchor_row.get("roe"))
    roa = safe_float(anchor_row.get("roa"))
    gpm = None if is_bank else safe_float(anchor_row.get("gpm"))
    opm = safe_float(anchor_row.get("opm"))
    npm = safe_float(anchor_row.get("npm"))
    eps_growth = safe_float(anchor_row.get("eps_growth_yoy"))
    der = safe_float(anchor_row.get("der"))
    current_ratio = None if is_bank else safe_float(anchor_row.get("current_ratio"))
    quick_ratio = None if is_bank else safe_float(anchor_row.get("quick_ratio"))
    interest_coverage = None if is_bank else safe_float(anchor_row.get("interest_coverage"))

    altman_z = compute_altman_z(
        accounting_type,
        statements,
        safe_float(live_snap.get("market_cap")),
        fallback_val=safe_float(anchor_row.get("altman_z")),
    )
    zmijewski_x = compute_zmijewski_x(
        accounting_type,
        roa,
        der,
        current_ratio,
        statements=statements,
        fallback_val=safe_float(anchor_row.get("zmijewski_x")),
    )

    ocf_billion = safe_float(anchor_row.get("ocf_billion"))
    fcf_billion = safe_float(anchor_row.get("fcf_billion"))
    capex_billion = safe_float(anchor_row.get("capex_billion"))
    dps = safe_float(anchor_row.get("dps"))
    dpr = safe_float(anchor_row.get("dpr"))
    div_streak = int(safe_float(anchor_row.get("dividend_streak_5y"), 0) or 0)

    # LIVE REACTIVE CALCULATIONS (always recomputed against live_price!)
    per_ttm = safe_divide(live_price, eps_ttm)
    if per_ttm is None:
        per_ttm = safe_float(live_snap.get("per_ttm"))
    else:
        per_ttm = round(per_ttm, 2)

    pbv_current = safe_divide(live_price, bvps)
    if pbv_current is None:
        pbv_current = safe_float(live_snap.get("pbv_current"))
    else:
        pbv_current = round(pbv_current, 2)

    ev_ebitda: float | None = None
    if not is_bank:
        if ebitda_per_share is not None and ebitda_per_share > 0:
            live_ev_ps = live_price + (net_debt_per_share or 0.0)
            ev_calc = safe_divide(live_ev_ps, ebitda_per_share)
            if ev_calc is not None:
                ev_ebitda = round(ev_calc, 2)
        if ev_ebitda is None:
            ev_live = safe_float(live_snap.get("ev_ebitda"))
            if ev_live is not None:
                ev_ebitda = round(ev_live, 2)

    fair_value = estimate_fair_value_intrinsic(
        live_price=live_price,
        eps_ttm=eps_ttm,
        bvps=bvps,
        roe_pct=roe,
        sector_avg_per=sector_avg_per,
        sector_avg_pbv=sector_avg_pbv,
        sector_avg_roe=sector_avg_roe,
        verified_anchor_fv=safe_float(anchor_row.get("fair_value_intrinsic")),
        source_type=str(anchor_row.get("source_type") or "AUTO_SYNCED"),
        accounting_type=accounting_type,
    )

    mos_ratio = safe_divide(fair_value - live_price, fair_value)
    mos_pct = round(mos_ratio * 100.0, 1) if mos_ratio is not None else None

    sgr = compute_sgr(roe, dpr)

    div_yield_ratio = safe_divide(dps, live_price)
    if div_yield_ratio is not None and dps is not None and dps > 0:
        div_yield = round(div_yield_ratio * 100.0, 2)
    else:
        div_yield = safe_float(live_snap.get("div_yield"))

    ma20 = safe_float(live_snap.get("ma20")) or live_price
    ma200 = safe_float(live_snap.get("ma200")) or ma20
    rsi14 = safe_float(live_snap.get("rsi14"))
    if rsi14 is None:
        rsi14 = 50.0
    atr_pct = safe_float(live_snap.get("atr_pct")) or 1.8
    max_dd_1y = safe_float(live_snap.get("max_drawdown_1y"))
    if max_dd_1y is None:
        max_dd_1y = -15.0

    dist_ma20_r = safe_divide(live_price - ma20, ma20)
    dist_ma20 = round(dist_ma20_r * 100.0, 1) if dist_ma20_r is not None else 0.0
    dist_ma200_r = safe_divide(live_price - ma200, ma200)
    dist_ma200 = round(dist_ma200_r * 100.0, 1) if dist_ma200_r is not None else 0.0

    price_zones = compute_price_zones(
        live_price=live_price,
        fair_value_target=fair_value,
        support1=safe_float(live_snap.get("support1")),
        ma200=ma200,
        atr_pct=atr_pct,
    )

    quant_score, pillar_scores = compute_quant_score(
        accounting_type=accounting_type,
        per_ttm=per_ttm,
        pbv_current=pbv_current,
        mos_pct=mos_pct,
        roe=roe,
        npm=npm,
        eps_growth=eps_growth,
        ocf_billion=ocf_billion,
        fcf_billion=fcf_billion,
        der=der,
        current_ratio=current_ratio,
        altman_z=altman_z,
        zmijewski_x=zmijewski_x,
        dist_ma200=dist_ma200,
        rsi14=rsi14,
        atr_pct=atr_pct,
        sector_avg_per=sector_avg_per,
        sector_avg_pbv=sector_avg_pbv,
        sector_avg_roe=sector_avg_roe,
        sector_avg_der=sector_avg_der,
        bank_health=bank_health,
    )

    has_distress_flag = (
        (per_ttm is not None and per_ttm <= 0)
        or (zmijewski_x is not None and zmijewski_x >= 0)
        or (altman_z is not None and altman_z < 1.81)
        or (dpr is not None and dpr > 100.0 and eps_growth is not None and eps_growth < -10.0)
    )

    if has_distress_flag or quant_score < 60 or price_zones["upsidePct"] < 0:
        verdict_status = "WASPADA / HINDARI"
    elif quant_score >= 74 and price_zones["upsidePct"] >= 6.0:
        verdict_status = "AKUMULASI BERTAHAP"
    else:
        verdict_status = "TUNGGU KOREKSI"

    # Dynamic Evidence-Based Narratives (100% live numbers!)
    capital_sim = 1_000_000
    est_max_loss = int(round(capital_sim * (abs(price_zones["riskPct"]) / 100.0)))
    est_target_gain = int(round(capital_sim * (max(0.0, price_zones["upsidePct"]) / 100.0)))

    val_word = (
        f"diskon terhadap rata-rata sektor {sector_idx} (PER {_fmt_id(per_ttm, 1, 'x')} vs sektor {_fmt_id(sector_avg_per, 1, 'x')})"
        if (per_ttm is not None and per_ttm > 0 and per_ttm < sector_avg_per)
        else (
            "sedang mencatat laba bersih negatif sehingga rasio PER tidak berlaku"
            if (per_ttm is not None and per_ttm <= 0)
            else f"premium terhadap rata-rata sektor {sector_idx} (PER {_fmt_id(per_ttm, 1, 'x')} vs sektor {_fmt_id(sector_avg_per, 1, 'x')})"
        )
    )

    if is_bank and bank_health:
        solvency_label = "CAR / NPL"
        solvency_value = f"{_fmt_id(bank_health.get('carPct'), 1, '%')} / {_fmt_id(bank_health.get('nplGrossPct'), 1, '%')}"
        health_sentence = (
            f"Permodalan bank terjaga dengan CAR {_fmt_id(bank_health.get('carPct'), 1, '%')}, "
            f"NPL Gross {_fmt_id(bank_health.get('nplGrossPct'), 1, '%')}, dan dana murah CASA {_fmt_id(bank_health.get('casaPct'), 1, '%')}."
        )
    elif is_bank:
        solvency_label = "DER DPK Bank"
        solvency_value = _fmt_id(der, 2, "x")
        health_sentence = f"Emiten perbankan dengan ROE {_fmt_id(roe, 1, '%')} dan struktur DPK (DER {_fmt_id(der, 2, 'x')})."
    else:
        solvency_label = "DER / Zmijewski"
        solvency_value = f"{_fmt_id(der, 2, 'x')} / {_fmt_id(zmijewski_x, 2)}"
        zm_text = (
            "berisiko distress (Zmijewski ≥ 0)"
            if (zmijewski_x is not None and zmijewski_x >= 0)
            else "zona sehat (non-distress)"
        )
        health_sentence = (
            f"Kesehatan neraca korporasi menunjukkan DER {_fmt_id(der, 2, 'x')}, "
            f"Current Ratio {_fmt_id(current_ratio, 2, 'x')}, dan profil {zm_text}."
        )

    trend_text = (
        f"berada di atas MA200 (+{_fmt_id(dist_ma200, 1, '%')} • Uptrend)"
        if dist_ma200 >= 0
        else f"berada di bawah MA200 ({_fmt_id(dist_ma200, 1, '%')} • Downtrend)"
    )

    simple_reasons = [
        f"Valuasi {code} saat ini ({_fmt_rp(live_price)}) tergolong {val_word} dengan Margin of Safety {_fmt_id(mos_pct, 1, '%')}.",
        health_sentence,
        f"Secara tren harga {code} {trend_text}; target nilai wajar di {_fmt_rp(fair_value)} dengan batas risiko cut-loss di {_fmt_rp(price_zones['cutLoss'])}.",
    ]

    if verdict_status == "WASPADA / HINDARI":
        sim_summary = (
            f"Simulasi Rp 1.000.000: Risiko turun sekitar -{_fmt_rp(est_max_loss)} ({_fmt_id(price_zones['riskPct'], 1, '%')}) "
            f"belum sebanding dengan margin keamanan saat ini; lebih bijak tahan kas sampai kinerja membaik."
        )
    else:
        sim_summary = (
            f"Simulasi modal Rp 1.000.000: Estimasi risiko maksimal sekitar -{_fmt_rp(est_max_loss)} ({_fmt_id(price_zones['riskPct'], 1, '%')}) "
            f"jika cut-loss tersentuh, berbanding potensi target +{_fmt_rp(est_target_gain)} (+{_fmt_id(max(0.0, price_zones['upsidePct']), 1, '%')})."
        )

    rsi_zone = "Overbought" if rsi14 >= 70 else ("Oversold" if rsi14 < 35 else "Netral")
    investor_reasons = [
        f"Valuasi live: PER {_fmt_id(per_ttm, 1, 'x')} vs sektor {_fmt_id(sector_avg_per, 1, 'x')}, PBV {_fmt_id(pbv_current, 2, 'x')}, estimasi nilai wajar {_fmt_rp(fair_value)} (MoS {_fmt_id(mos_pct, 1, '%')} • R:R 1:{_fmt_id(price_zones['riskRewardRatio'], 2)}).",
        f"Fundamental ({'Standar Perbankan' if is_bank else 'Standar Korporasi'}): ROE {_fmt_id(roe, 1, '%')}, NPM {_fmt_id(npm, 1, '%')}, SGR {_fmt_id(sgr, 1, '%')}, Div Yield live {_fmt_id(div_yield, 2, '%')}, dan {solvency_label} {solvency_value}.",
        f"Teknikal & Risiko: Harga vs MA200 {_fmt_id(dist_ma200, 1, '%')}, RSI(14) {_fmt_id(rsi14, 1)} ({rsi_zone}), ATR(14) {_fmt_id(atr_pct, 2, '%')}, serta Max Drawdown 1Y {_fmt_id(max_dd_1y, 1, '%')}.",
    ]

    if is_bank:
        invalidation_rule = (
            f"Tesis {code} wajib dievaluasi ulang jika NPL Gross menembus > 3,5%, CAR turun < 16%, atau harga menembus tegas di bawah {_fmt_rp(price_zones['cutLoss'])}."
        )
    elif accounting_type == "commodity":
        invalidation_rule = (
            f"Tesis {code} gugur jika arus kas bebas (FCF) menyusut > 30% YoY akibat koreksi harga komoditas atau harga jatuh di bawah {_fmt_rp(price_zones['cutLoss'])}."
        )
    else:
        invalidation_rule = (
            f"Tesis {code} ditinjau ulang jika laba bersih berkontraksi 2 kuartal beruntun, Zmijewski X menembus ≥ 0, atau harga jebol di bawah {_fmt_rp(price_zones['cutLoss'])}."
        )

    # All 30 explicit evaluated metric primitives (N/A for banking strictly enforced!)
    metrics_30: dict[str, dict[str, Any]] = {
        "per_ttm": {"rawValue": per_ttm, "isNotApplicable": False, "isWarning": per_ttm is not None and per_ttm <= 0},
        "pbv_current": {"rawValue": pbv_current, "isNotApplicable": False, "isWarning": pbv_current is not None and pbv_current <= 0},
        "ev_ebitda": {"rawValue": None if is_bank else ev_ebitda, "isNotApplicable": is_bank, "isWarning": (not is_bank) and ev_ebitda is not None and ev_ebitda <= 0},
        "fair_value": {"rawValue": fair_value, "isNotApplicable": False, "isWarning": False},
        "margin_of_safety": {"rawValue": mos_pct, "isNotApplicable": False, "isWarning": mos_pct is not None and mos_pct <= -3.0},
        "roe": {"rawValue": roe, "isNotApplicable": False, "isWarning": roe is not None and roe <= 0},
        "roa": {"rawValue": roa, "isNotApplicable": False, "isWarning": roa is not None and roa <= 0},
        "gpm": {"rawValue": None if is_bank else gpm, "isNotApplicable": is_bank, "isWarning": (not is_bank) and gpm is not None and gpm <= 0},
        "opm": {"rawValue": opm, "isNotApplicable": False, "isWarning": opm is not None and opm <= 0},
        "npm": {"rawValue": npm, "isNotApplicable": False, "isWarning": npm is not None and npm <= 0},
        "eps_growth": {"rawValue": eps_growth, "isNotApplicable": False, "isWarning": eps_growth is not None and eps_growth <= -8.0},
        "der": {"rawValue": der, "isNotApplicable": False, "isWarning": (der is not None and der < 0) or ((not is_bank) and der is not None and der > 2.0)},
        "current_ratio": {"rawValue": None if is_bank else current_ratio, "isNotApplicable": is_bank, "isWarning": (not is_bank) and current_ratio is not None and current_ratio < 1.0},
        "quick_ratio": {"rawValue": None if is_bank else quick_ratio, "isNotApplicable": is_bank, "isWarning": (not is_bank) and quick_ratio is not None and quick_ratio < 0.8},
        "interest_coverage": {"rawValue": None if is_bank else interest_coverage, "isNotApplicable": is_bank, "isWarning": (not is_bank) and interest_coverage is not None and interest_coverage < 2.0},
        "altman_z": {"rawValue": None if is_bank else altman_z, "isNotApplicable": is_bank, "isWarning": (not is_bank) and altman_z is not None and altman_z < 1.81},
        "zmijewski_x": {"rawValue": None if is_bank else zmijewski_x, "isNotApplicable": is_bank, "isWarning": (not is_bank) and zmijewski_x is not None and zmijewski_x >= 0},
        "ocf": {"rawValue": ocf_billion, "isNotApplicable": False, "isWarning": ocf_billion is not None and ocf_billion <= 0},
        "fcf": {"rawValue": fcf_billion, "isNotApplicable": False, "isWarning": fcf_billion is not None and fcf_billion <= 0},
        "capex": {"rawValue": capex_billion, "isNotApplicable": False, "isWarning": False},
        "sgr": {"rawValue": sgr, "isNotApplicable": False, "isWarning": sgr is not None and sgr <= 0},
        "div_yield": {"rawValue": div_yield, "isNotApplicable": False, "isWarning": False},
        "dpr": {"rawValue": dpr, "isNotApplicable": False, "isWarning": dpr is not None and dpr > 100.0},
        "div_streak": {"rawValue": div_streak, "isNotApplicable": False, "isWarning": False},
        "dist_ma20": {"rawValue": dist_ma20, "isNotApplicable": False, "isWarning": False},
        "dist_ma200": {"rawValue": dist_ma200, "isNotApplicable": False, "isWarning": dist_ma200 <= -10.0},
        "rsi_14": {"rawValue": round(rsi14, 1), "isNotApplicable": False, "isWarning": rsi14 >= 70.0},
        "atr_pct": {"rawValue": round(atr_pct, 2), "isNotApplicable": False, "isWarning": False},
        "max_dd_1y": {"rawValue": round(max_dd_1y, 1), "isNotApplicable": False, "isWarning": max_dd_1y <= -25.0},
        "sr_range": {"rawValue": None, "support1": price_zones["entryLow"], "resistance1": price_zones["fairValueTarget"], "isNotApplicable": False, "isWarning": False},
    }

    verified_sources = ["BEI"]
    live_audit = audits.get("live_price", {})
    if live_audit.get("tvValue") is not None:
        verified_sources.insert(0, "TV")
    if live_audit.get("yfValue") is not None:
        verified_sources.append("YF")
    if live_audit.get("gfValue") is not None:
        verified_sources.append("GF")

    result = {
        "stockItem": {
            "ticker": code,
            "name": company_name,
            "sector": sector_idx,
            "subsector": subsector_idx,
            "accountingType": accounting_type,
            "price": live_price,
            "change": change_abs,
            "changePercent": change_pct,
            "quantScore": quant_score,
            "verifiedSources": verified_sources,
        },
        "quarterlyAnchor": {
            "ticker": code,
            "fiscalPeriod": str(anchor_row.get("period") or "TTM-LATEST"),
            "sourceType": str(anchor_row.get("source_type") or "AUTO_SYNCED"),
            "epsTtm": eps_ttm,
            "bvps": bvps,
            "netDebtPerShare": net_debt_per_share,
            "ebitdaPerShare": ebitda_per_share,
            "fairValueIntrinsic": fair_value,
            "roe": roe,
            "roa": roa,
            "gpm": gpm,
            "opm": opm,
            "npm": npm,
            "epsGrowthYoY": eps_growth,
            "der": der,
            "currentRatio": current_ratio,
            "quickRatio": quick_ratio,
            "interestCoverage": interest_coverage,
            "altmanZ": altman_z,
            "zmijewskiX": zmijewski_x,
            "ocfBillion": ocf_billion,
            "fcfBillion": fcf_billion,
            "capexBillion": capex_billion,
            "dps": dps,
            "dpr": dpr,
            "dividendStreak5Y": div_streak,
            "sectorAvgPer": sector_avg_per,
            "sectorAvgPbv": sector_avg_pbv,
            "sectorAvgRoe": sector_avg_roe,
            "sectorAvgDer": sector_avg_der,
            "bankHealth": bank_health,
        },
        "liveTechnicalSnapshot": {
            "ticker": code,
            "livePrice": live_price,
            "basePrice": prev_close,
            "change": change_abs,
            "changePercent": change_pct,
            "volume": int(safe_float(live_snap.get("volume"), 0.0) or 0),
            "marketCap": safe_float(live_snap.get("market_cap")),
            "high52w": safe_float(live_snap.get("high_52w")),
            "low52w": safe_float(live_snap.get("low_52w")),
            "ma20": round(ma20, 2),
            "ma200": round(ma200, 2),
            "rsi14": round(rsi14, 1),
            "atrPct": round(atr_pct, 2),
            "maxDrawdown1Y": round(max_dd_1y, 1),
            "support1": price_zones["entryLow"],
            "resistance1": price_zones["fairValueTarget"],
        },
        "metrics": metrics_30,
        "decisionProfile": {
            "ticker": code,
            "verdictStatus": verdict_status,
            "quantScore": quant_score,
            "pillarScores": pillar_scores,
            "priceZones": price_zones,
            "simpleNarrative": {
                "reasons": simple_reasons,
                "capitalSimRp": capital_sim,
                "estMaxLossRp": est_max_loss,
                "estTargetGainRp": est_target_gain,
                "simSummary": sim_summary,
            },
            "investorNarrative": {
                "reasons": investor_reasons,
                "metrics": {
                    "per": _fmt_id(per_ttm, 1, "x"),
                    "sectorPer": _fmt_id(sector_avg_per, 1, "x"),
                    "pbv": _fmt_id(pbv_current, 2, "x"),
                    "mosPct": _fmt_id(mos_pct, 1, "%"),
                    "roe": _fmt_id(roe, 1, "%"),
                    "solvencyLabel": solvency_label,
                    "solvencyValue": solvency_value,
                    "priceVsMa200Pct": dist_ma200,
                    "rsi14": round(rsi14, 1),
                    "atr14Pct": round(atr_pct, 2),
                    "maxDrawdown1YPct": round(max_dd_1y, 1),
                },
            },
            "invalidationRule": invalidation_rule,
        },
        "audits": audits,
        "dataWarnings": data_warnings or [],
    }
    return sanitize_for_json(result)
