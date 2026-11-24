"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Info,
  Pin,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { formatPercent, formatRupiah } from "@/data/stocksCatalog";
import {
  ALL_CATEGORY_IDS,
  evaluateLiveComparisonMatrix,
  formatIdNumber,
} from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { TripleCheckInspector } from "@/components/shared/TripleCheckInspector";
import { IndicatorSettingsModal } from "@/components/shared/IndicatorSettingsModal";
import type {
  EvaluatedMetricRow,
  MatrixColumnDescriptor,
  ValidationStatus,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

function getAuditDotClass(status: ValidationStatus): string {
  if (status === "verified") return "bg-positive";
  if (status === "minor_diff" || status === "failover_active")
    return "bg-caution";
  if (status === "quarantined") return "bg-negative";
  return "bg-info";
}

function fmtBankPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `${formatIdNumber(val, 1)}%`;
}

export function FundamentalMatrixMobile() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const expandedCategories = useStockStore((s) => s.expandedCategories);
  const toggleCategory = useStockStore((s) => s.toggleCategory);
  const expandAllCategories = useStockStore((s) => s.expandAllCategories);
  const collapseAllCategories = useStockStore((s) => s.collapseAllCategories);
  const hiddenMetricIds = useStockStore((s) => s.hiddenMetricIds);
  const mobilePinnedTicker = useStockStore((s) => s.mobilePinnedTicker);
  const setMobilePinnedTicker = useStockStore((s) => s.setMobilePinnedTicker);
  const mobileCompareIndex = useStockStore((s) => s.mobileCompareIndex);
  const setMobileCompareIndex = useStockStore((s) => s.setMobileCompareIndex);
  const stepMobileCompareIndex = useStockStore((s) => s.stepMobileCompareIndex);

  const compareData = useMarketDataStore((s) => s.compareData);
  const compareLoading = useMarketDataStore((s) => s.compareLoading);
  const compareRefreshing = useMarketDataStore((s) => s.compareRefreshing);
  const compareError = useMarketDataStore((s) => s.compareError);
  const loadCompare = useMarketDataStore((s) => s.loadCompare);

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isPinPickerOpen, setIsPinPickerOpen] = React.useState(false);
  const [inspectTarget, setInspectTarget] = React.useState<{
    metricId: string;
    columnId: string | null;
  } | null>(null);

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const matrix = React.useMemo(
    () =>
      evaluateLiveComparisonMatrix(compareData, activeTickers, hiddenMetricIds),
    [compareData, activeTickers, hiddenMetricIds]
  );

  const leftCol: MatrixColumnDescriptor | undefined =
    matrix.columns.find((c) => c.id === mobilePinnedTicker) ?? matrix.columns[0];

  const rightCandidates: MatrixColumnDescriptor[] = React.useMemo(() => {
    if (!leftCol) return [];
    const others = matrix.columns.filter((c) => c.id !== leftCol.id);
    return others.length > 0 ? others : [leftCol];
  }, [matrix.columns, leftCol]);

  const safeRightIndex = Math.max(
    0,
    Math.min(mobileCompareIndex, Math.max(0, rightCandidates.length - 1))
  );
  const rightCol = rightCandidates[safeRightIndex] ?? rightCandidates[0];
  const canSwipeRight = rightCandidates.length > 1;

  const inspectedRow: EvaluatedMetricRow | null = React.useMemo(() => {
    if (!inspectTarget) return null;
    for (const cat of matrix.categories) {
      const found = cat.rows.find((r) => r.metric.id === inspectTarget.metricId);
      if (found) return found;
    }
    return null;
  }, [inspectTarget, matrix.categories]);

  const allExpanded = expandedCategories.length >= ALL_CATEGORY_IDS.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canSwipeRight || e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      !canSwipeRight ||
      !touchStartRef.current ||
      e.changedTouches.length !== 1
    ) {
      touchStartRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx < 0) stepMobileCompareIndex(1);
      else stepMobileCompareIndex(-1);
    }
  };

  if (compareLoading && !compareData) {
    return (
      <section className="space-y-3 lg:hidden">
        <div className="h-24 animate-pulse rounded-xl border border-border-subtle bg-surface" />
        <div className="h-72 animate-pulse rounded-xl border border-border-subtle bg-surface" />
      </section>
    );
  }

  if (compareError && !compareData) {
    return (
      <section className="rounded-xl border border-negative-border bg-negative-soft/60 p-4 lg:hidden">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink">
              Backend Live Tidak Terjangkau
            </p>
            <p className="mt-1 text-[11px] text-ink-secondary">{compareError}</p>
            <button
              type="button"
              onClick={() => void loadCompare(activeTickers, true)}
              className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-cta px-3 text-xs font-semibold text-cta-fg"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!leftCol || !rightCol) return null;

  const visibleBankCols = [leftCol, rightCol].filter(
    (col, idx, arr) =>
      col.kind === "stock" &&
      col.accountingType === "banking" &&
      arr.findIndex((x) => x.id === col.id) === idx
  );

  const primaryWinnerText = matrix.overallSummary.valuasiWinner
    ? `Valuasi: ${matrix.overallSummary.valuasiWinner}`
    : matrix.overallSummary.profitabilitasWinner
      ? `Profitabilitas: ${matrix.overallSummary.profitabilitasWinner}`
      : "Komparasi 6 Kategori";

  const secondaryWinnerText = matrix.overallSummary.profitabilitasWinner
    ? `Profitabilitas: ${matrix.overallSummary.profitabilitasWinner}`
    : matrix.overallSummary.dividenWinner
      ? `Dividen: ${matrix.overallSummary.dividenWinner}`
      : null;

  return (
    <section
      aria-label="Matriks komparasi fundamental mobile"
      className="space-y-3 lg:hidden"
    >
      {/* Compact Winner Banner + Action Strip */}
      <div className="rounded-xl border border-border-subtle bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <Award className="h-4 w-4 shrink-0 text-positive" />
            <span className="truncate font-medium text-ink">
              <strong className="font-mono font-bold text-positive">
                {primaryWinnerText}
              </strong>
              {secondaryWinnerText && (
                <span className="text-ink-muted"> • {secondaryWinnerText}</span>
              )}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-ink-muted">
            {matrix.visibleMetrics}/{matrix.totalMetrics}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
          <button
            type="button"
            onClick={() => void loadCompare(activeTickers, true)}
            disabled={compareRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-positive-border bg-positive-soft px-2.5 text-xs font-semibold text-positive transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", compareRefreshing && "animate-spin")}
            />
            <span>{compareRefreshing ? "Sync..." : "Refresh Live"}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                allExpanded ? collapseAllCategories() : expandAllCategories()
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle bg-canvas px-2.5 text-xs font-medium text-ink"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Lipat</span>
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-ink-secondary" />
                  <span>Buka</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Atur indikator matriks"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-cta px-2.5 text-xs font-semibold text-cta-fg"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Indikator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky 2-Column Stock Header */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="sticky top-14 z-20 rounded-xl border border-border-subtle bg-surface/95 shadow-xs backdrop-blur-md"
      >
        <div className="grid grid-cols-2 divide-x divide-border-subtle">
          {/* Left Column: Pinned Anchor Stock */}
          <div className="p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-ink">
                <Pin className="h-3.5 w-3.5 text-positive" />
                {leftCol.label}
              </span>
              {activeTickers.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setIsPinPickerOpen((prev) => !prev)}
                  className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary hover:text-ink"
                >
                  Tukar Pin
                </button>
              )}
            </div>

            {leftCol.livePrice !== null && (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-sans text-xs font-bold text-ink tabular-nums">
                  {formatRupiah(leftCol.livePrice)}
                </span>
                {leftCol.changePercent !== null && (
                  <span
                    className={cn(
                      "font-sans text-[11px] font-semibold tabular-nums",
                      leftCol.changePercent >= 0
                        ? "text-positive"
                        : "text-negative"
                    )}
                  >
                    {formatPercent(leftCol.changePercent)}
                  </span>
                )}
              </div>
            )}
            <p className="mt-0.5 truncate text-[10px] text-ink-muted">
              Terkunci • {leftCol.subLabel}
            </p>
          </div>

          {/* Right Column: Swipeable Comparison Peer or Benchmark */}
          <div className="bg-elevated/35 p-3">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => stepMobileCompareIndex(-1)}
                disabled={!canSwipeRight}
                aria-label="Pembanding sebelumnya"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface text-ink-secondary disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 text-center">
                <span
                  className={cn(
                    "block truncate font-mono text-sm font-bold",
                    rightCol.kind !== "stock" ? "text-info" : "text-ink"
                  )}
                >
                  {rightCol.kind === "sector_avg"
                    ? "Rata2 Sektor"
                    : rightCol.kind === "history_5y"
                      ? "Historis"
                      : rightCol.label}
                </span>
              </div>

              <button
                type="button"
                onClick={() => stepMobileCompareIndex(1)}
                disabled={!canSwipeRight}
                aria-label="Pembanding berikutnya"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface text-ink-secondary disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {rightCol.livePrice !== null ? (
              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                <span className="font-sans text-xs font-bold text-ink tabular-nums">
                  {formatRupiah(rightCol.livePrice)}
                </span>
                {rightCol.changePercent !== null && (
                  <span
                    className={cn(
                      "font-sans text-[11px] font-semibold tabular-nums",
                      rightCol.changePercent >= 0
                        ? "text-positive"
                        : "text-negative"
                    )}
                  >
                    {formatPercent(rightCol.changePercent)}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 truncate text-center text-[11px] font-medium text-ink-secondary">
                {rightCol.subLabel}
              </p>
            )}

            {canSwipeRight && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {rightCandidates.map((cand, idx) => {
                  const isActiveDot = idx === safeRightIndex;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setMobileCompareIndex(idx)}
                      aria-label={`Geser ke ${cand.label}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        isActiveDot ? "w-4 bg-ink" : "w-1.5 bg-border-strong"
                      )}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inline Pin Switcher Drawer */}
        {isPinPickerOpen && activeTickers.length >= 2 && (
          <div className="border-t border-border-subtle bg-canvas px-3 py-2.5">
            <span className="block text-[11px] font-medium text-ink-muted">
              Pilih saham yang dikunci di kolom kiri:
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeTickers.map((ticker) => {
                const isPinned = ticker === leftCol.id;
                return (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => {
                      setMobilePinnedTicker(ticker);
                      setIsPinPickerOpen(false);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors",
                      isPinned
                        ? "border-ink bg-cta text-cta-fg"
                        : "border-border-subtle bg-surface text-ink"
                    )}
                  >
                    {isPinned ? `📌 ${ticker}` : ticker}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 6 Accordion Categories */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="space-y-2.5"
      >
        {matrix.categories.map((group) => {
          const isExpanded = expandedCategories.includes(group.category.id);
          const panelId = `mobile-cat-panel-${group.category.id}`;

          return (
            <div
              key={group.category.id}
              className="overflow-hidden rounded-xl border border-border-subtle bg-surface"
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                onClick={() => toggleCategory(group.category.id)}
                className="flex w-full items-center justify-between gap-2 bg-canvas/75 px-3.5 py-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface font-mono text-[11px] font-bold text-ink">
                    {group.category.numberLabel}
                  </span>
                  <span className="truncate font-display text-sm font-bold text-ink">
                    {group.category.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {group.winnerLabel && (
                    <span className="max-w-[125px] truncate rounded-full border border-positive-border bg-positive-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-positive">
                      {group.winnerLabel}
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

              {isExpanded && (
                <div id={panelId} className="divide-y divide-border-subtle">
                  {group.category.id === "kesehatan" &&
                    visibleBankCols.length > 0 && (
                      <div className="bg-info-soft/50 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-info">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Kesehatan Perbankan (OJK/BEI)</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {visibleBankCols.map((bankCol) => {
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
                                className="rounded-lg border border-info-border/70 bg-surface p-2.5"
                              >
                                <span className="font-mono text-xs font-bold text-ink">
                                  {bankCol.ticker}
                                </span>
                                {hasOjk && bh ? (
                                  <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center font-sans text-xs tabular-nums">
                                    <div>
                                      <span className="block text-[10px] text-ink-muted">
                                        CAR
                                      </span>
                                      <strong className="text-positive">
                                        {fmtBankPct(bh.carPct)}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-ink-muted">
                                        NPL
                                      </span>
                                      <strong className="text-ink">
                                        {fmtBankPct(bh.nplGrossPct)}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-ink-muted">
                                        NIM
                                      </span>
                                      <strong className="text-ink">
                                        {fmtBankPct(bh.nimPct)}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-ink-muted">
                                        CASA
                                      </span>
                                      <strong className="text-ink">
                                        {fmtBankPct(bh.casaPct)}
                                      </strong>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[11px] text-ink-muted">
                                    CAR/NPL/CASA menunggu impor resmi OJK/BEI.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {group.rows.length === 0 ? (
                    <div className="flex items-center justify-between px-3.5 py-3 text-xs text-ink-muted">
                      <span>Indikator kategori ini disembunyikan.</span>
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="font-semibold text-ink underline"
                      >
                        Atur
                      </button>
                    </div>
                  ) : (
                    group.rows.map((row) => {
                      const leftCell = row.cells[leftCol.id];
                      const rightCell = row.cells[rightCol.id];
                      if (!leftCell || !rightCell) return null;

                      return (
                        <div key={row.metric.id} className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              setInspectTarget({
                                metricId: row.metric.id,
                                columnId: leftCol.id,
                              })
                            }
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-ink">
                                  {row.metric.label}
                                </span>
                                {row.metric.isLiveReactive && (
                                  <Zap className="h-3 w-3 shrink-0 text-info" />
                                )}
                              </div>
                              <span className="block truncate text-[11px] text-ink-muted">
                                {row.sectorBenchmarkNote}
                              </span>
                            </div>
                            <Info className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                          </button>

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {[
                              { col: leftCol, cell: leftCell },
                              { col: rightCol, cell: rightCell },
                            ].map(({ col, cell }) => (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() =>
                                  setInspectTarget({
                                    metricId: row.metric.id,
                                    columnId: col.id,
                                  })
                                }
                                className={cn(
                                  "relative flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors",
                                  cell.isWinner
                                    ? "border-positive-border border-l-2 border-l-positive bg-positive-soft/75"
                                    : cell.isWarning
                                      ? "border-negative-border bg-negative-soft/60"
                                      : col.kind !== "stock"
                                        ? "border-border-subtle bg-elevated/45"
                                        : "border-border-subtle bg-canvas"
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "absolute top-2 right-2 h-1.5 w-1.5 rounded-full",
                                    getAuditDotClass(cell.audit.status)
                                  )}
                                />

                                <span
                                  className={cn(
                                    "leading-tight tracking-tight",
                                    cell.isNotApplicable
                                      ? "font-mono text-xs font-medium text-ink-muted"
                                      : cell.isWarning
                                        ? "font-sans text-[15px] font-bold text-negative tabular-nums"
                                        : cell.isWinner
                                          ? "font-sans text-[15px] font-bold text-positive tabular-nums"
                                          : "font-sans text-[15px] font-semibold text-ink tabular-nums"
                                  )}
                                >
                                  {cell.formattedValue}
                                </span>

                                {cell.subLabel && (
                                  <span
                                    className={cn(
                                      "mt-1 max-w-full truncate text-[11px]",
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
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
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
