"use client";

import * as React from "react";
import { Activity, BarChart2, Gauge, ShieldCheck } from "lucide-react";
import { formatPercent, formatRupiah } from "@/data/stocksCatalog";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { cn } from "@/lib/utils";

function formatMarketCapId(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val) || val <= 0) {
    return "—";
  }
  if (val >= 1e12) {
    return `Rp ${(val / 1e12).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} T`;
  }
  if (val >= 1e9) {
    return `Rp ${(val / 1e9).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })} M`;
  }
  return formatRupiah(Math.round(val));
}

function formatVolumeId(vol: number | null | undefined): string {
  if (vol === null || vol === undefined || !Number.isFinite(vol) || vol <= 0) {
    return "—";
  }
  if (vol >= 1e9) {
    return `${(vol / 1e9).toFixed(2).replace(".", ",")} M lbr`;
  }
  if (vol >= 1e6) {
    return `${(vol / 1e6).toFixed(2).replace(".", ",")} Jt lbr`;
  }
  if (vol >= 1e3) {
    return `${(vol / 1e3).toFixed(1).replace(".", ",")} Rb lbr`;
  }
  return `${vol.toLocaleString("id-ID")} lbr`;
}

function formatPriceOpt(val: number | string | null | undefined): string {
  if (typeof val === "number" && Number.isFinite(val)) {
    return Math.round(val).toLocaleString("id-ID");
  }
  if (typeof val === "string" && val.trim()) return val;
  return "—";
}

/**
 * 4-Card Live Market Summary & 3-Source Price Consensus Strip.
 * Anchored cleanly underneath InteractiveCharts inside the left equal-height column
 * so the Desktop hero grid stays 100% flush with DecisionPanel (zero empty black void!).
 */
export function LiveMarketSummaryStrip() {
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const compareData = useMarketDataStore((s) => s.compareData);
  const compareLoading = useMarketDataStore((s) => s.compareLoading);

  const snap = compareData?.liveSnapshots?.[focusedTicker];
  const liveAudit = compareData?.audits?.[focusedTicker]?.live_price;

  if (compareLoading && !snap) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-xl border border-border-subtle bg-surface p-3.5"
          />
        ))}
      </div>
    );
  }

  if (!snap) return null;

  const low52 = snap.low52w ?? null;
  const high52 = snap.high52w ?? null;
  const has52w =
    low52 !== null && high52 !== null && high52 > low52 && snap.livePrice > 0;
  const pos52Pct = has52w
    ? Math.max(
        0,
        Math.min(100, ((snap.livePrice - low52) / (high52 - low52)) * 100)
      )
    : 50;

  const ma200Pct =
    snap.ma200 && snap.ma200 > 0
      ? Number((((snap.livePrice - snap.ma200) / snap.ma200) * 100).toFixed(1))
      : null;
  const rsi14 = snap.rsi14 ?? null;
  const atrPct = snap.atrPct ?? null;

  const spreadPct = liveAudit?.spreadPct ?? 0;
  const auditStatus = liveAudit?.status ?? "verified";

  return (
    <div
      aria-label={`Ringkasan pasar live dan konsensus harga ${focusedTicker}`}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* Card 1: 52-Week Range Bar */}
      <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            <Gauge className="h-3.5 w-3.5 text-info" />
            Rentang 52 Minggu
          </span>
          {has52w && (
            <span className="font-mono text-[11px] font-semibold text-ink-secondary tabular-nums">
              {Math.round(pos52Pct)}%
            </span>
          )}
        </div>

        <div className="mt-2.5">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-negative/70 via-caution/70 to-positive/80"
              style={{ width: `${pos52Pct}%` }}
            />
            {has52w && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-xs"
                style={{ left: `${pos52Pct}%` }}
              />
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between font-sans text-[11px] font-medium text-ink-secondary tabular-nums">
            <span>L: {low52 ? formatRupiah(Math.round(low52)) : "—"}</span>
            <span>H: {high52 ? formatRupiah(Math.round(high52)) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Market Cap & Live Volume */}
      <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface p-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          <BarChart2 className="h-3.5 w-3.5 text-ink-secondary" />
          Kapitalisasi &amp; Volume
        </span>
        <div className="mt-2">
          <p className="font-sans text-base font-bold tracking-tight text-ink tabular-nums">
            {formatMarketCapId(snap.marketCap)}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
            Vol: <strong className="font-medium text-ink-secondary">{formatVolumeId(snap.volume)}</strong>
          </p>
        </div>
      </div>

      {/* Card 3: 3-Source Live Price Consensus (TV • YF • GF) */}
      <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface p-3.5">
        <div className="flex items-center justify-between gap-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            <ShieldCheck className="h-3.5 w-3.5 text-positive" />
            Konsensus 3 Sumber
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
              auditStatus === "verified"
                ? "bg-positive-soft text-positive"
                : auditStatus === "minor_diff"
                  ? "bg-caution-soft text-caution"
                  : "bg-info-soft text-info"
            )}
          >
            Δ {spreadPct.toFixed(2).replace(".", ",")}%
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {[
            { code: "TV", val: liveAudit?.tvValue },
            { code: "YF", val: liveAudit?.yfValue },
            { code: "GF", val: liveAudit?.gfValue },
          ].map((src) => (
            <div
              key={src.code}
              className="rounded-md border border-border-subtle bg-canvas px-1 py-1"
            >
              <span className="block font-mono text-[10px] font-semibold text-ink-muted">
                {src.code}
              </span>
              <span className="block font-sans text-xs font-bold text-ink tabular-nums">
                {formatPriceOpt(src.val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 4: Momentum Snapshot (vs MA200, RSI 14, ATR %) */}
      <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface p-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          <Activity className="h-3.5 w-3.5 text-positive" />
          Snapshot Momentum
        </span>

        <div className="mt-2 grid grid-cols-3 gap-1.5 font-sans tabular-nums">
          <div>
            <span className="block text-[10px] text-ink-muted">vs MA200</span>
            <strong
              className={cn(
                "text-xs font-bold",
                ma200Pct === null
                  ? "text-ink-muted"
                  : ma200Pct >= 0
                    ? "text-positive"
                    : "text-negative"
              )}
            >
              {ma200Pct !== null ? formatPercent(ma200Pct) : "—"}
            </strong>
          </div>
          <div>
            <span className="block text-[10px] text-ink-muted">RSI (14)</span>
            <strong
              className={cn(
                "text-xs font-bold",
                rsi14 === null
                  ? "text-ink-muted"
                  : rsi14 >= 70
                    ? "text-negative"
                    : rsi14 < 35
                      ? "text-positive"
                      : "text-ink"
              )}
            >
              {rsi14 !== null ? rsi14.toFixed(1).replace(".", ",") : "—"}
            </strong>
          </div>
          <div>
            <span className="block text-[10px] text-ink-muted">ATR %</span>
            <strong className="text-xs font-bold text-ink">
              {atrPct !== null ? `${atrPct.toFixed(2).replace(".", ",")}%` : "—"}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
