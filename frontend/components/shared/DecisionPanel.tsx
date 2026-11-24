"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Loader2,
  NotebookPen,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { formatPercent, formatRupiah } from "@/data/stocksCatalog";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { DecisionProfileApi } from "@/types/fundamental";
import { cn } from "@/lib/utils";

function getVerdictStyles(status: DecisionProfileApi["verdictStatus"]): {
  badgeClass: string;
  dotClass: string;
  scoreClass: string;
} {
  if (status === "AKUMULASI BERTAHAP") {
    return {
      badgeClass: "border-positive-border bg-positive-soft text-positive",
      dotClass: "bg-positive",
      scoreClass: "text-positive",
    };
  }
  if (status === "TUNGGU KOREKSI") {
    return {
      badgeClass: "border-caution-border bg-caution-soft text-caution",
      dotClass: "bg-caution",
      scoreClass: "text-caution",
    };
  }
  return {
    badgeClass: "border-negative-border bg-negative-soft text-negative",
    dotClass: "bg-negative",
    scoreClass: "text-negative",
  };
}

export function DecisionPanel() {
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const decisionMode = useStockStore((s) => s.decisionMode);
  const setDecisionMode = useStockStore((s) => s.setDecisionMode);

  const compareData = useMarketDataStore((s) => s.compareData);
  const compareLoading = useMarketDataStore((s) => s.compareLoading);
  const compareError = useMarketDataStore((s) => s.compareError);
  const addToWatchlist = useMarketDataStore((s) => s.addToWatchlist);
  const watchlistTickers = useMarketDataStore((s) => s.watchlistTickers);
  const addJournalEntry = useMarketDataStore((s) => s.addJournalEntry);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  const [savedNotice, setSavedNotice] = React.useState(false);

  const stock = compareData?.stocks?.find((s) => s.ticker === focusedTicker);
  const profile = compareData?.decisionProfiles?.[focusedTicker];
  const isInWatchlist = watchlistTickers.includes(focusedTicker);

  if (compareLoading && !profile) {
    return (
      <aside className="flex h-full min-h-[480px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface p-6 text-xs text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
        <span>Menghitung evaluasi kuantitatif live {focusedTicker}...</span>
      </aside>
    );
  }

  if (!profile || !stock) {
    return (
      <aside className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-negative-border bg-negative-soft/40 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-negative" />
        <p className="mt-2 text-sm font-semibold text-ink">
          Panel Keputusan Menunggu Data Live
        </p>
        <p className="mt-1 text-xs text-ink-secondary">
          {compareError ??
            "Pastikan backend FastAPI (port 8000) aktif untuk menarik evaluasi kuantitatif real-time."}
        </p>
      </aside>
    );
  }

  const styles = getVerdictStyles(profile.verdictStatus);
  const { priceZones, simpleNarrative, investorNarrative } = profile;
  const reasons =
    decisionMode === "simple"
      ? simpleNarrative.reasons
      : investorNarrative.reasons;

  const handleQuickSaveJournal = () => {
    addJournalEntry({
      id: `${focusedTicker}-${Date.now()}`,
      createdAt: new Date().toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      ticker: stock.ticker,
      companyName: stock.name,
      sector: stock.sector,
      priceAtAnalysis: stock.price,
      quantScore: profile.quantScore,
      verdictStatus: profile.verdictStatus,
      entryLow: priceZones.entryLow,
      entryHigh: priceZones.entryHigh,
      fairValueTarget: priceZones.fairValueTarget,
      cutLoss: priceZones.cutLoss,
      riskRewardRatio: priceZones.riskRewardRatio,
      styleTag: "Value",
      note: simpleNarrative.reasons[0] ?? "",
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  return (
    <aside
      aria-label={`Keputusan investasi untuk ${focusedTicker}`}
      className="flex h-full flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 md:p-6"
    >
      <div>
        {/* Top Header + Simple Mode | Investor View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold tracking-tight text-ink">
              Keputusan Investasi
            </h2>
            <span className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
              {focusedTicker}
            </span>
          </div>

          <div
            role="group"
            aria-label="Mode kedalaman analisis keputusan"
            className="inline-flex rounded-lg border border-border-subtle bg-elevated p-0.5 text-xs"
          >
            <button
              type="button"
              onClick={() => setDecisionMode("simple")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors whitespace-nowrap",
                decisionMode === "simple"
                  ? "bg-surface font-semibold text-ink shadow-xs"
                  : "font-medium text-ink-muted hover:text-ink"
              )}
            >
              Simple Mode
            </button>
            <button
              type="button"
              onClick={() => setDecisionMode("investor")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors whitespace-nowrap",
                decisionMode === "investor"
                  ? "bg-surface font-semibold text-ink shadow-xs"
                  : "font-medium text-ink-muted hover:text-ink"
              )}
            >
              Investor View
            </button>
          </div>
        </div>

        {/* Verdict & Quant Score Banner */}
        <div className="mt-4 rounded-xl border border-border-subtle bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Sinyal Model ({stock.sector})
              </span>
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold tracking-tight",
                  styles.badgeClass
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 rounded-full", styles.dotClass)}
                />
                {profile.verdictStatus}
              </span>
            </div>

            <div className="shrink-0 text-right">
              <span className="block text-[11px] font-medium text-ink-muted">
                Quant Score
              </span>
              <div className="mt-0.5 flex items-baseline justify-end">
                <span
                  className={cn(
                    "font-sans text-3xl font-bold tracking-tight tabular-nums",
                    styles.scoreClass
                  )}
                >
                  {profile.quantScore}
                </span>
                <span className="ml-0.5 text-xs font-medium text-ink-muted">
                  /100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Evidence-Based Reasons */}
        <div className="mt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
              {decisionMode === "simple"
                ? "3 Alasan Utama (Live)"
                : "3 Pilar Analisis Kuantitatif"}
            </h3>
            <span className="font-mono text-[11px] text-ink-muted">
              {decisionMode === "simple" ? "Pemula" : "Institusional"}
            </span>
          </div>

          <ul className="space-y-2.5">
            {reasons.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-canvas/70 p-3"
              >
                {profile.verdictStatus === "WASPADA / HINDARI" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                )}
                <p className="text-xs leading-relaxed text-ink-secondary">
                  {reason}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Simple Rp 1 Jt Simulation vs Investor Quant Grid */}
        {decisionMode === "simple" ? (
          <div className="mt-4 rounded-xl border border-info-border bg-info-soft/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-info">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>Simulasi Penempatan Modal Rp 1.000.000</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
              {simpleNarrative.simSummary}
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-canvas p-3 text-xs">
            <div>
              <span className="block text-[11px] text-ink-muted">
                Price vs MA200
              </span>
              <span
                className={cn(
                  "font-sans font-semibold tabular-nums",
                  investorNarrative.metrics.priceVsMa200Pct >= 0
                    ? "text-positive"
                    : "text-negative"
                )}
              >
                {formatPercent(investorNarrative.metrics.priceVsMa200Pct)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-ink-muted">RSI (14)</span>
              <span className="font-sans font-semibold text-ink tabular-nums">
                {investorNarrative.metrics.rsi14.toFixed(1).replace(".", ",")}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-ink-muted">
                Volatilitas ATR (14)
              </span>
              <span className="font-sans font-semibold text-ink tabular-nums">
                {investorNarrative.metrics.atr14Pct.toFixed(2).replace(".", ",")}%
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-ink-muted">
                Max Drawdown 1Y
              </span>
              <span className="font-sans font-semibold text-negative tabular-nums">
                {investorNarrative.metrics.maxDrawdown1YPct
                  .toFixed(1)
                  .replace(".", ",")}
                %
              </span>
            </div>
          </div>
        )}

        {/* Execution Plan & Risk Boundaries */}
        <div className="mt-4 border-t border-border-subtle pt-4">
          <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Rencana Eksekusi &amp; Batas Risiko
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border-subtle bg-canvas p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                Area Masuk Ideal
              </span>
              <span className="mt-1 block font-sans text-sm font-bold text-ink tabular-nums">
                {formatRupiah(priceZones.entryLow)}–
                {priceZones.entryHigh.toLocaleString("id-ID")}
              </span>
            </div>

            <div className="rounded-xl border border-border-subtle bg-canvas p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-info" />
                Target Nilai Wajar
              </span>
              <span className="mt-1 block font-sans text-sm font-bold text-ink tabular-nums">
                {formatRupiah(priceZones.fairValueTarget)}{" "}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    priceZones.upsidePct >= 0 ? "text-positive" : "text-negative"
                  )}
                >
                  ({formatPercent(priceZones.upsidePct)})
                </span>
              </span>
            </div>

            <div className="rounded-xl border border-negative-border bg-negative-soft/60 p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-negative">
                <span className="h-1.5 w-1.5 rounded-full bg-negative" />
                Batas Cut Loss
              </span>
              <span className="mt-1 block font-sans text-sm font-bold text-negative tabular-nums">
                &lt; {formatRupiah(priceZones.cutLoss)}{" "}
                <span className="text-xs font-semibold">
                  ({formatPercent(priceZones.riskPct)})
                </span>
              </span>
            </div>

            <div className="rounded-xl border border-border-subtle bg-canvas p-3">
              <span className="block text-[11px] font-medium text-ink-muted">
                Rasio Risk / Reward
              </span>
              <span className="mt-1 block font-mono text-sm font-bold text-ink">
                1 : {priceZones.riskRewardRatio.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-caution-border bg-caution-soft/70 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
            <p className="text-xs leading-relaxed text-ink-secondary">
              <strong className="font-semibold text-caution">
                Syarat Pembatalan:
              </strong>{" "}
              {profile.invalidationRule}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Journal/Watchlist Actions + Live Provenance Footer */}
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-3.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleQuickSaveJournal}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cta px-2.5 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            <span>{savedNotice ? "Tersimpan!" : "Catat Jurnal"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              addToWatchlist(focusedTicker);
              setActiveTab("watchlist");
            }}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-elevated"
          >
            <BookmarkPlus className="h-3.5 w-3.5 text-positive" />
            <span>{isInWatchlist ? "Di Watchlist" : "+ Watchlist"}</span>
          </button>
        </div>

        <div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-ink-secondary">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-positive" />
            <span>
              Live Verified: TV • YF • GF • BEI ({compareData?.syncedAt ?? "Live"})
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Quantitative Decision Support System (Riset Non-Transaksional)
          </p>
        </div>
      </div>
    </aside>
  );
}
