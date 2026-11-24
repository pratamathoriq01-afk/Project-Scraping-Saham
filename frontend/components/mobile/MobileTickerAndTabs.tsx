"use client";

import * as React from "react";
import { Plus, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { formatPercent } from "@/data/stocksCatalog";
import {
  MAX_STOCKS,
  useStockStore,
  type MobileActiveTab,
} from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

const MOBILE_SEGMENTS: { id: MobileActiveTab; label: string }[] = [
  { id: "komparasi", label: "Komparasi" },
  { id: "charts", label: "Charts" },
  { id: "keputusan", label: "Keputusan" },
];

export function MobileTickerAndTabs() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const isSingleStockMode = useStockStore((s) => s.isSingleStockMode);
  const mobileActiveTab = useStockStore((s) => s.mobileActiveTab);
  const setFocusedTicker = useStockStore((s) => s.setFocusedTicker);
  const removeStock = useStockStore((s) => s.removeStock);
  const resetComparison = useStockStore((s) => s.resetComparison);
  const setMobileActiveTab = useStockStore((s) => s.setMobileActiveTab);

  const compareData = useMarketDataStore((s) => s.compareData);
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

  return (
    <section
      aria-label="Strip saham dan tab mobile"
      className="space-y-2.5 lg:hidden"
    >
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
          {activeTickers.map((ticker) => {
            const stock = stockMap[ticker];
            const isFocused = ticker === focusedTicker;
            const changePct = stock?.changePercent ?? null;
            const isPositive = (changePct ?? 0) >= 0;

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
                  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border pl-2.5 pr-1 transition-colors",
                  isFocused
                    ? "border-ink bg-surface text-ink shadow-xs dark:border-positive/70"
                    : "border-border-subtle bg-elevated/70 text-ink-secondary hover:bg-surface hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs font-semibold whitespace-nowrap",
                    isFocused ? "text-ink dark:text-positive" : "text-ink"
                  )}
                >
                  {ticker}
                </span>
                {changePct !== null && (
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums whitespace-nowrap",
                      isPositive ? "text-positive" : "text-negative"
                    )}
                  >
                    {formatPercent(changePct)}
                  </span>
                )}

                {isSingleStockMode ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSwapStockModal(ticker);
                    }}
                    title={`Ganti saham ${ticker}`}
                    aria-label={`Ganti saham ${ticker}`}
                    className="ml-0.5 inline-flex h-7 w-7 min-h-7 min-w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
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
                    className="ml-0.5 inline-flex h-7 w-7 min-h-7 min-w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-negative-soft hover:text-negative"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isSingleStockMode && (
            <button
              type="button"
              onClick={resetComparison}
              title={`Sisakan hanya ${focusedTicker}`}
              aria-label="Reset komparasi ke 1 saham fokus"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {canAddMore && (
            <button
              type="button"
              onClick={openAddStockModal}
              aria-label="Tambah saham ke komparasi"
              title={`Tambah saham (${activeTickers.length}/${MAX_STOCKS})`}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-cta px-2.5 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px]">
                {activeTickers.length}/{MAX_STOCKS}
              </span>
            </button>
          )}
        </div>
      </div>

      {isSingleStockMode && (
        <div className="flex items-center gap-1.5 rounded-lg border border-info-border bg-info-soft px-3 py-1.5 text-xs font-medium text-info">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Mode Analisis Tunggal (vs Rata-Rata Sektor &amp; Historis Multi-Tahun)
          </span>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Pilih tampilan analisis mobile"
        className="grid h-11 w-full grid-cols-3 rounded-xl border border-border-subtle bg-elevated p-1"
      >
        {MOBILE_SEGMENTS.map((tab) => {
          const isActive = mobileActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setMobileActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center rounded-lg text-xs transition-all",
                isActive
                  ? "bg-surface font-semibold text-ink shadow-xs"
                  : "font-medium text-ink-muted hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
