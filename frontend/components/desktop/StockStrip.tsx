"use client";

import * as React from "react";
import {
  ChevronDown,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  ACCOUNTING_TYPE_META,
  formatPercent,
  formatRupiah,
} from "@/data/stocksCatalog";
import { MAX_STOCKS, useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

export function StockStrip() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const isSingleStockMode = useStockStore((s) => s.isSingleStockMode);
  const setFocusedTicker = useStockStore((s) => s.setFocusedTicker);
  const removeStock = useStockStore((s) => s.removeStock);
  const resetComparison = useStockStore((s) => s.resetComparison);

  const compareData = useMarketDataStore((s) => s.compareData);
  const compareLoading = useMarketDataStore((s) => s.compareLoading);
  const compareRefreshing = useMarketDataStore((s) => s.compareRefreshing);
  const loadCompare = useMarketDataStore((s) => s.loadCompare);

  const openAddStockModal = useWorkspaceStore((s) => s.openAddStockModal);
  const openSwapStockModal = useWorkspaceStore((s) => s.openSwapStockModal);

  const canAddMore = activeTickers.length < MAX_STOCKS;

  const stockMap = React.useMemo(() => {
    const map: Record<string, (NonNullable<typeof compareData>["stocks"])[number]> = {};
    for (const s of compareData?.stocks ?? []) {
      map[s.ticker] = s;
    }
    return map;
  }, [compareData]);

  const focusedItem = stockMap[focusedTicker];
  const isCrossSector = compareData?.isCrossSector ?? activeTickers.length > 1;

  const totalSlots = Math.min(
    MAX_STOCKS,
    activeTickers.length + (canAddMore ? 1 : 0)
  );

  const gridColsClass =
    totalSlots <= 2
      ? "grid-cols-2"
      : totalSlots === 3
        ? "grid-cols-3"
        : totalSlots === 4
          ? "grid-cols-4"
          : "grid-cols-5";

  return (
    <section
      aria-label="Strip pemilih saham desktop"
      className="hidden space-y-3 lg:block"
    >
      {/* Top Status & Quick Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isSingleStockMode ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-info-border bg-info-soft px-3 py-1 text-xs font-medium text-info">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>
                Mode Analisis Tunggal (vs Rata-Rata Sektor &amp; Historis Multi-Tahun)
              </span>
            </div>
          ) : isCrossSector ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-ink-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-info" />
              <span>Lintas Sektor (Normalized Persentil Sektor)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-positive-border bg-positive-soft px-3 py-1 text-xs font-medium text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>
                Peer Sektor Apple-to-Apple: {focusedItem?.sector ?? "BEI"}
              </span>
            </div>
          )}

          {compareData?.syncedAt && (
            <span className="font-mono text-[11px] text-ink-muted">
              Update: {compareData.syncedAt}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadCompare(activeTickers, true)}
            disabled={compareRefreshing}
            title="Segarkan data live dari TV, YF, GF & Supabase"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:bg-elevated hover:text-ink disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3 w-3", compareRefreshing && "animate-spin")}
            />
            <span>Refresh Live</span>
          </button>

          <span className="rounded-md border border-border-subtle bg-surface px-2.5 py-1 font-mono text-xs font-medium text-ink-secondary whitespace-nowrap">
            {activeTickers.length}/{MAX_STOCKS} Saham
          </span>

          {!isSingleStockMode && (
            <button
              type="button"
              onClick={resetComparison}
              title={`Tutup pembanding lain dan sisakan ${focusedTicker} saja`}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:bg-elevated hover:text-ink"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Stock Selector Cards Row (1-5 live stocks + Add Slot) */}
      <div className={cn("grid gap-3", gridColsClass)}>
        {activeTickers.map((ticker) => {
          const stock = stockMap[ticker];
          const isFocused = ticker === focusedTicker;
          const isPositive = (stock?.changePercent ?? 0) >= 0;
          const acctType = stock?.accountingType ?? "general";
          const acctMeta = ACCOUNTING_TYPE_META[acctType];

          return (
            <div
              key={ticker}
              role="button"
              tabIndex={0}
              aria-pressed={isFocused}
              onClick={() => setFocusedTicker(ticker)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFocusedTicker(ticker);
                }
              }}
              className={cn(
                "group relative flex min-w-0 cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                isFocused
                  ? "border-ink bg-surface shadow-sm ring-1 ring-ink/15 dark:border-positive/70 dark:ring-positive/25"
                  : "border-border-subtle bg-surface hover:border-border-strong hover:shadow-xs"
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSwapStockModal(ticker);
                      }}
                      title={`Tukar ${ticker} dengan saham BEI lain`}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 -ml-1 font-mono text-sm font-semibold tracking-tight transition-colors whitespace-nowrap hover:bg-elevated",
                        isFocused ? "text-ink dark:text-positive" : "text-ink"
                      )}
                    >
                      <span>{ticker}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
                    </button>

                    {isFocused && (
                      <span className="rounded bg-cta px-1.5 py-0.5 text-[11px] font-semibold leading-none text-cta-fg whitespace-nowrap">
                        Fokus
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-1 truncate text-xs text-ink-muted"
                    title={stock?.name ?? ticker}
                  >
                    {stock?.name ?? (compareLoading ? "Memuat data live..." : ticker)}
                  </p>
                </div>

                {isSingleStockMode ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSwapStockModal(ticker);
                    }}
                    title={`Ganti saham ${ticker}`}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-elevated px-2 text-xs font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface whitespace-nowrap"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Ganti</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStock(ticker);
                    }}
                    title="Hapus dari komparasi"
                    aria-label={`Hapus ${ticker} dari komparasi`}
                    className="inline-flex h-7 w-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-negative-soft hover:text-negative focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <span className="truncate rounded bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                  {stock?.sector ?? "BEI"}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-ink-muted">
                  • {acctMeta.shortLabel}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-2 border-t border-border-subtle pt-2.5">
                <div className="min-w-0">
                  {stock ? (
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-sans text-base font-bold tracking-tight text-ink tabular-nums whitespace-nowrap">
                        {formatRupiah(stock.price)}
                      </span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap",
                          isPositive
                            ? "border-positive-border bg-positive-soft text-positive"
                            : "border-negative-border bg-negative-soft text-negative"
                        )}
                      >
                        {formatPercent(stock.changePercent)}
                      </span>
                    </div>
                  ) : (
                    <div className="h-6 w-28 animate-pulse rounded bg-elevated" />
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span className="block text-[11px] leading-none text-ink-muted">
                    Skor
                  </span>
                  <span className="mt-0.5 inline-block font-sans text-sm font-bold text-ink tabular-nums">
                    {stock ? stock.quantScore : "—"}
                    <span className="text-xs font-normal text-ink-muted">
                      /100
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {canAddMore && (
          <button
            type="button"
            onClick={openAddStockModal}
            className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/60 p-3.5 text-center transition-colors hover:border-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-ink-secondary">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink">
              + Tambah Saham
            </span>
            <span className="font-mono text-xs text-ink-muted">
              840+ Emiten BEI • ⌘K
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
