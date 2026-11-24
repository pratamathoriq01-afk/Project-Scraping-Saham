"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  Building2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Info,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  ACCOUNTING_TYPE_META,
  formatPercent,
  formatRupiah,
} from "@/data/stocksCatalog";
import {
  ALL_CATEGORY_IDS,
  buildMatrixCsv,
  evaluateLiveComparisonMatrix,
  formatIdNumber,
} from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { TripleCheckInspector } from "@/components/shared/TripleCheckInspector";
import { IndicatorSettingsModal } from "@/components/shared/IndicatorSettingsModal";
import type {
  EvaluatedMetricRow,
  ValidationStatus,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

function getAuditDotMeta(status: ValidationStatus): {
  dotClass: string;
  label: string;
} {
  if (status === "verified") {
    return { dotClass: "bg-positive", label: "Konsensus 4-Kanal ≤ 1,5%" };
  }
  if (status === "minor_diff") {
    return { dotClass: "bg-caution", label: "Selisih minor 1,5%–5,0%" };
  }
  if (status === "failover_active") {
    return { dotClass: "bg-caution", label: "Failover sumber cadangan" };
  }
  if (status === "quarantined") {
    return { dotClass: "bg-negative", label: "Karantina anomali > 5%" };
  }
  return { dotClass: "bg-info", label: "Jangkar Laporan BEI / Quant" };
}

function fmtBankPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `${formatIdNumber(val, 1)}%`;
}

export function FundamentalMatrixDesktop() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const setFocusedTicker = useStockStore((s) => s.setFocusedTicker);
  const expandedCategories = useStockStore((s) => s.expandedCategories);
  const toggleCategory = useStockStore((s) => s.toggleCategory);
  const expandAllCategories = useStockStore((s) => s.expandAllCategories);
  const collapseAllCategories = useStockStore((s) => s.collapseAllCategories);
  const hiddenMetricIds = useStockStore((s) => s.hiddenMetricIds);
  const resetMetricVisibility = useStockStore((s) => s.resetMetricVisibility);

  const compareData = useMarketDataStore((s) => s.compareData);
  const compareLoading = useMarketDataStore((s) => s.compareLoading);
  const compareRefreshing = useMarketDataStore((s) => s.compareRefreshing);
  const compareError = useMarketDataStore((s) => s.compareError);
  const loadCompare = useMarketDataStore((s) => s.loadCompare);

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [inspectTarget, setInspectTarget] = React.useState<{
    metricId: string;
    columnId: string | null;
  } | null>(null);

  const matrix = React.useMemo(
    () =>
      evaluateLiveComparisonMatrix(compareData, activeTickers, hiddenMetricIds),
    [compareData, activeTickers, hiddenMetricIds]
  );

  const inspectedRow: EvaluatedMetricRow | null = React.useMemo(() => {
    if (!inspectTarget) return null;
    for (const cat of matrix.categories) {
      const found = cat.rows.find((r) => r.metric.id === inspectTarget.metricId);
      if (found) return found;
    }
    return null;
  }, [inspectTarget, matrix.categories]);

  const allExpanded = expandedCategories.length >= ALL_CATEGORY_IDS.length;
  const gridTemplateStyle: React.CSSProperties = {
    gridTemplateColumns: `272px repeat(${Math.max(1, matrix.columns.length)}, minmax(0, 1fr))`,
  };

  const handleExportCsv = () => {
    const csv = buildMatrixCsv(matrix);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `equilens-komparasi-${activeTickers.join("-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summaryItems = [
    { label: "Valuasi", winner: matrix.overallSummary.valuasiWinner },
    {
      label: "Profitabilitas",
      winner: matrix.overallSummary.profitabilitasWinner,
    },
    { label: "Kesehatan", winner: matrix.overallSummary.kesehatanWinner },
    { label: "Dividen", winner: matrix.overallSummary.dividenWinner },
  ].filter((item) => Boolean(item.winner));

  if (compareLoading && !compareData) {
    return (
      <section
        aria-label="Memuat matriks komparasi fundamental"
        className="hidden space-y-3 lg:block"
      >
        <div className="h-24 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
        <div className="h-96 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      </section>
    );
  }

  if (compareError && !compareData) {
    return (
      <section
        aria-label="Status matriks offline"
        className="hidden rounded-2xl border border-negative-border bg-negative-soft/60 p-6 lg:block"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                Matriks Fundamental Live Tidak Tersedia (Backend Offline)
              </h2>
              <p className="mt-1 text-xs text-ink-secondary">{compareError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadCompare(activeTickers, true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3.5 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Coba Muat Ulang Live</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Matriks komparasi fundamental desktop"
      className="hidden space-y-3 lg:block"
    >
      {/* Top Control Card */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-lg font-bold tracking-tight text-ink">
                Matriks Komparasi Fundamental
              </h2>
              <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 font-mono text-xs font-medium text-ink-secondary">
                {matrix.visibleMetrics}/{matrix.totalMetrics} Indikator Aktif
              </span>
              {matrix.isSingleStockMode && (
                <span className="inline-flex items-center gap-1 rounded-full border border-info-border bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info">
                  <Sparkles className="h-3 w-3" />
                  Auto Benchmark Sektor &amp; Historis
                </span>
              )}
            </div>

            {/* Dynamic Winner Summary Ribbon */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary">
              {summaryItems.length > 0 ? (
                summaryItems.map((item, idx) => (
                  <React.Fragment key={item.label}>
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-border-strong">
                        •
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-positive" />
                      <span>Unggul {item.label}:</span>
                      <strong className="font-mono font-bold text-positive">
                        {item.winner}
                      </strong>
                    </span>
                  </React.Fragment>
                ))
              ) : (
                <span>
                  Bandingkan rasio fundamental, arus kas, dividen, dan teknikal
                  lintas emiten secara live dari TradingView, Yahoo Finance,
                  Google Finance &amp; Supabase.
                </span>
              )}
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => void loadCompare(activeTickers, true)}
              disabled={compareRefreshing}
              title="Paksa sinkronisasi ulang data harga & rasio live dari 4 sumber"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-positive-border bg-positive-soft px-3 text-xs font-semibold text-positive transition-colors hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", compareRefreshing && "animate-spin")}
              />
              <span>{compareRefreshing ? "Menyinkronkan..." : "Refresh Live"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                allExpanded ? collapseAllCategories() : expandAllCategories()
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-elevated whitespace-nowrap"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Lipat Semua</span>
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Buka Semua</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-elevated whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-ink-secondary" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Atur Indikator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified CSS Grid Matrix (NO overflow-hidden wrapper -> 100% sticky top-16!) */}
      <div role="table" aria-label="Tabel komparasi 30 indikator fundamental">
        {/* Sticky Column Header */}
        <div
          role="row"
          style={gridTemplateStyle}
          className="sticky top-16 z-20 grid items-stretch rounded-t-2xl border border-border-subtle bg-surface/95 shadow-xs backdrop-blur-md"
        >
          <div
            role="columnheader"
            className="flex flex-col justify-center border-r border-border-subtle px-4 py-3.5"
          >
            <span className="text-xs font-bold tracking-wider text-ink uppercase">
              Indikator &amp; Acuan
            </span>
            <span className="mt-0.5 font-mono text-[11px] text-ink-muted">
              Sync: {matrix.generatedAt}
            </span>
          </div>

          {matrix.columns.map((col, idx) => {
            const isFocused =
              col.kind === "stock" && col.ticker === focusedTicker;
            const isPositive = (col.changePercent ?? 0) >= 0;
            const acctMeta = ACCOUNTING_TYPE_META[col.accountingType];

            return (
              <div
                key={col.id}
                role="columnheader"
                className={cn(
                  "flex flex-col justify-between px-4 py-3 text-right transition-colors",
                  idx < matrix.columns.length - 1 &&
                    "border-r border-border-subtle",
                  col.kind !== "stock"
                    ? "bg-elevated/60"
                    : isFocused
                      ? "bg-elevated/50"
                      : "bg-transparent"
                )}
              >
                <div className="flex items-center justify-end gap-1.5">
                  {col.kind === "stock" ? (
                    <button
                      type="button"
                      onClick={() => setFocusedTicker(col.ticker)}
                      className="-mr-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-elevated"
                      title={`Fokuskan grafik & keputusan ke ${col.ticker}`}
                    >
                      {isFocused && (
                        <span className="rounded bg-cta px-1.5 py-0.5 text-[10px] font-semibold leading-none text-cta-fg">
                          Fokus
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-mono text-sm font-bold tracking-tight",
                          isFocused ? "text-ink dark:text-positive" : "text-ink"
                        )}
                      >
                        {col.label}
                      </span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-info-border bg-info-soft px-2 py-0.5 font-mono text-xs font-bold text-info">
                      {col.label}
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  {col.livePrice !== null ? (
                    <div className="inline-flex flex-wrap items-baseline justify-end gap-1.5 px-1 py-0.5">
                      <span className="font-sans text-sm font-bold text-ink tabular-nums">
                        {formatRupiah(col.livePrice)}
                      </span>
                      {col.changePercent !== null && (
                        <span
                          className={cn(
                            "font-sans text-xs font-semibold tabular-nums",
                            isPositive ? "text-positive" : "text-negative"
                          )}
                        >
                          {formatPercent(col.changePercent)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="block text-xs font-medium text-ink-secondary">
                      Pembanding Acuan
                    </span>
                  )}

                  <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                    {col.subLabel}
                    {col.kind === "stock" ? ` • ${acctMeta.shortLabel}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 6 Accordion Categories */}
        <div className="divide-y divide-border-subtle rounded-b-2xl border-x border-b border-border-subtle bg-surface">
          {matrix.categories.map((group) => {
            const isExpanded = expandedCategories.includes(group.category.id);
            const panelId = `desktop-cat-panel-${group.category.id}`;

            return (
              <div key={group.category.id}>
                {/* Category Accordion Header */}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleCategory(group.category.id)}
                  className="flex w-full items-center justify-between gap-4 bg-canvas/80 px-4 py-3.5 text-left transition-colors hover:bg-elevated/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface font-mono text-xs font-bold text-ink">
                      {group.category.numberLabel}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-ink">
                          {group.category.title}
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          ({group.visibleMetricCount}/{group.totalMetricCount}{" "}
                          indikator)
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {group.category.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    {group.winnerLabel && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-border bg-positive-soft px-2.5 py-1 text-xs font-semibold text-positive">
                        <Award className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Unggul:{" "}
                          <strong className="font-mono">
                            {group.winnerLabel}
                          </strong>
                        </span>
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-ink-secondary transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* Category Body */}
                {isExpanded && (
                  <div id={panelId} className="divide-y divide-border-subtle">
                    {/* Contextual Bank Health Strip in Category 3 */}
                    {group.category.id === "kesehatan" &&
                      matrix.bankingColumns.length > 0 && (
                        <div className="border-t border-info-border/60 bg-info-soft/45 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-info">
                              <Building2 className="h-4 w-4 shrink-0" />
                              <span>
                                Ringkasan Kesehatan Khusus Perbankan (Standar
                                OJK/BEI)
                              </span>
                            </div>
                            <span className="text-[11px] text-ink-muted">
                              Current/Quick Ratio, ICR, Altman Z, &amp; Zmijewski X
                              otomatis N/A (Bank)
                            </span>
                          </div>

                          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                            {matrix.bankingColumns.map((bankCol) => {
                              const bh = bankCol.bankHealth;
                              const hasOjk =
                                bh &&
                                (bh.carPct !== null ||
                                  bh.nplGrossPct !== null ||
                                  bh.nimPct !== null ||
                                  bh.casaPct !== null);

                              return (
                                <div
                                  key={bankCol.id}
                                  className="rounded-xl border border-info-border/70 bg-surface px-3.5 py-2.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-ink">
                                      {bankCol.ticker}
                                    </span>
                                    <span className="font-mono text-[11px] text-positive">
                                      {hasOjk && bh?.carPct !== null
                                        ? `CAR ${fmtBankPct(bh?.carPct)}`
                                        : "Standar Bank OJK"}
                                    </span>
                                  </div>
                                  {hasOjk && bh ? (
                                    <div className="mt-1.5 grid grid-cols-3 gap-2 border-t border-border-subtle pt-1.5 font-sans text-xs tabular-nums">
                                      <div>
                                        <span className="block text-[10px] text-ink-muted">
                                          NPL Gross
                                        </span>
                                        <strong
                                          className={cn(
                                            "font-semibold",
                                            (bh.nplGrossPct ?? 0) >= 3.0
                                              ? "text-caution"
                                              : "text-ink"
                                          )}
                                        >
                                          {fmtBankPct(bh.nplGrossPct)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] text-ink-muted">
                                          NIM
                                        </span>
                                        <strong className="font-semibold text-ink">
                                          {fmtBankPct(bh.nimPct)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] text-ink-muted">
                                          CASA
                                        </span>
                                        <strong className="font-semibold text-ink">
                                          {fmtBankPct(bh.casaPct)}
                                        </strong>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-1.5 border-t border-border-subtle pt-1.5 text-[11px] text-ink-muted">
                                      CAR/NPL/CASA menunggu impor resmi OJK/BEI
                                      (zero fake data).
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Empty state when user hid all rows in this category */}
                    {group.rows.length === 0 ? (
                      <div className="flex items-center justify-between px-4 py-4 text-xs text-ink-muted">
                        <span>
                          Semua indikator di kategori ini sedang disembunyikan.
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSettingsOpen(true)}
                          className="font-semibold text-ink underline hover:text-info"
                        >
                          Atur Indikator
                        </button>
                      </div>
                    ) : (
                      group.rows.map((row) => (
                        <div
                          key={row.metric.id}
                          role="row"
                          style={gridTemplateStyle}
                          className="grid items-stretch transition-colors hover:bg-canvas/55"
                        >
                          {/* Metric Name Cell */}
                          <button
                            type="button"
                            role="rowheader"
                            onClick={() =>
                              setInspectTarget({
                                metricId: row.metric.id,
                                columnId: matrix.columns[0]?.id ?? null,
                              })
                            }
                            className="group flex flex-col justify-center border-r border-border-subtle px-4 py-3 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-ink group-hover:text-info">
                                {row.metric.label}
                              </span>
                              {row.metric.isLiveReactive && (
                                <Zap
                                  aria-label="Reaktif harga live"
                                  className="h-3 w-3 shrink-0 text-info"
                                />
                              )}
                              <Info className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-muted opacity-50 transition-opacity group-hover:opacity-100" />
                            </div>
                            <span className="mt-0.5 truncate text-[11px] text-ink-muted">
                              {row.sectorBenchmarkNote}
                            </span>
                          </button>

                          {/* Evaluated Stock / Benchmark Cells */}
                          {matrix.columns.map((col, colIdx) => {
                            const cell = row.cells[col.id];
                            if (!cell) return null;

                            const dotMeta = getAuditDotMeta(cell.audit.status);
                            const isBenchmarkCol = col.kind !== "stock";

                            return (
                              <button
                                key={col.id}
                                type="button"
                                role="cell"
                                onClick={() =>
                                  setInspectTarget({
                                    metricId: row.metric.id,
                                    columnId: col.id,
                                  })
                                }
                                title={`${col.label} • ${row.metric.label}: ${cell.formattedValue} (${dotMeta.label}) — Klik untuk Audit 4-Kanal`}
                                className={cn(
                                  "relative flex flex-col items-end justify-center px-4 py-3 text-right transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
                                  colIdx < matrix.columns.length - 1 &&
                                    "border-r border-border-subtle",
                                  cell.isWinner
                                    ? "border-l-2 border-l-positive bg-positive-soft/75 hover:bg-positive-soft"
                                    : cell.isWarning
                                      ? "bg-negative-soft/55 hover:bg-negative-soft/80"
                                      : isBenchmarkCol
                                        ? "bg-elevated/35 hover:bg-elevated/70"
                                        : "hover:bg-elevated/55"
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "absolute top-2 right-2 h-1.5 w-1.5 rounded-full opacity-80",
                                    dotMeta.dotClass
                                  )}
                                />

                                <span
                                  className={cn(
                                    "leading-tight tracking-tight",
                                    cell.isNotApplicable
                                      ? "font-mono text-xs font-medium text-ink-muted"
                                      : cell.isWarning
                                        ? "font-sans text-sm font-bold text-negative tabular-nums"
                                        : cell.isWinner
                                          ? "font-sans text-sm font-bold text-positive tabular-nums"
                                          : isBenchmarkCol
                                            ? "font-sans text-[13.5px] font-medium text-ink-secondary tabular-nums"
                                            : "font-sans text-sm font-semibold text-ink tabular-nums"
                                  )}
                                >
                                  {cell.formattedValue}
                                </span>

                                {cell.subLabel && (
                                  <span
                                    className={cn(
                                      "mt-0.5 max-w-full truncate text-[11px]",
                                      cell.isWarning
                                        ? "font-semibold text-negative"
                                        : cell.isWinner
                                          ? "font-medium text-positive"
                                          : "text-ink-muted"
                                    )}
                                  >
                                    {cell.subLabel}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Audit Legend & Quick Restore */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-xs text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-positive" />
            Konsensus 4-Kanal (≤ 1,5%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-caution" />
            Selisih Minor / Failover
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-info" />
            Jangkar Laporan BEI / Quant
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3 text-info" />
            Reaktif Harga Live
          </span>
        </div>

        <div className="flex items-center gap-3">
          {hiddenMetricIds.length > 0 && (
            <button
              type="button"
              onClick={resetMetricVisibility}
              className="font-semibold text-ink underline hover:text-info"
            >
              Tampilkan Semua ({matrix.totalMetrics})
            </button>
          )}
          <span className="font-mono text-[11px]">
            Klik sel mana pun untuk Audit TV • YF • GF • BEI
          </span>
        </div>
      </div>

      <TripleCheckInspector
        isOpen={Boolean(inspectTarget && inspectedRow)}
        onClose={() => setInspectTarget(null)}
        row={inspectedRow}
        columns={matrix.columns}
        initialColumnId={inspectTarget?.columnId}
      />

      <IndicatorSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </section>
  );
}
