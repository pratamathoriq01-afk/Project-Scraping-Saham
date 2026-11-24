"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  ACCOUNTING_TYPE_META,
  formatPercent,
  formatRupiah,
} from "@/data/stocksCatalog";
import { searchStocksApi } from "@/lib/apiClient";
import { MAX_STOCKS, useStockStore } from "@/store/useStockStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { SearchStockResultItem } from "@/types/fundamental";
import { cn } from "@/lib/utils";

const IDX_IC_SECTOR_PILLS: string[] = [
  "Semua",
  "Perbankan & Keuangan",
  "Energi & Tambang",
  "Consumer Non-Cyclicals",
  "Consumer Cyclicals",
  "Infrastruktur",
  "Perindustrian",
  "Barang Baku",
  "Kesehatan",
  "Properti & Real Estat",
  "Teknologi",
  "Transportasi & Logistik",
];

const EMPTY_QUERY_LIMIT = 8;
const SEARCH_QUERY_LIMIT = 12;

export function SmartStockModal() {
  const isOpen = useWorkspaceStore((s) => s.isStockModalOpen);
  const mode = useWorkspaceStore((s) => s.stockModalMode);
  const swapTargetTicker = useWorkspaceStore((s) => s.swapTargetTicker);
  const openAddStockModal = useWorkspaceStore((s) => s.openAddStockModal);
  const closeStockModal = useWorkspaceStore((s) => s.closeStockModal);

  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const addStock = useStockStore((s) => s.addStock);
  const swapStock = useStockStore((s) => s.swapStock);
  const focusSingleStock = useStockStore((s) => s.focusSingleStock);
  const setFocusedTicker = useStockStore((s) => s.setFocusedTicker);
  const applyPreset = useStockStore((s) => s.applyPreset);

  const [query, setQuery] = React.useState("");
  const [sectorFilter, setSectorFilter] = React.useState<string>("Semua");
  const [results, setResults] = React.useState<SearchStockResultItem[]>([]);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const [totalUniverse, setTotalUniverse] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isSlotsFull = activeTickers.length >= MAX_STOCKS;
  const isSwapMode = mode === "swap" && Boolean(swapTargetTicker);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) closeStockModal();
        else openAddStockModal();
        return;
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeStockModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openAddStockModal, closeStockModal]);

  React.useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  // Live debounced search across all ~841+ BEI issuers in Supabase via FastAPI
  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const limit = query.trim() ? SEARCH_QUERY_LIMIT : EMPTY_QUERY_LIMIT;

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      searchStocksApi(query, sectorFilter, limit, controller.signal)
        .then((res) => {
          setResults(res.items);
          setTotalMatches(res.totalMatches);
          setTotalUniverse(res.totalUniverse);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setError(
            err instanceof Error
              ? err.message
              : "Gagal mencari emiten dari backend."
          );
          setLoading(false);
        });
    }, query.trim() ? 150 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, sectorFilter]);

  const handleClose = () => {
    setQuery("");
    setSectorFilter("Semua");
    closeStockModal();
  };

  const handleSelectStock = (stock: SearchStockResultItem) => {
    if (isSwapMode && swapTargetTicker) {
      swapStock(swapTargetTicker, stock.ticker);
      handleClose();
      return;
    }
    if (activeTickers.includes(stock.ticker)) {
      setFocusedTicker(stock.ticker);
      handleClose();
      return;
    }
    if (isSlotsFull) {
      swapStock(focusedTicker, stock.ticker);
      handleClose();
      return;
    }
    addStock(stock.ticker);
    handleClose();
  };

  const handleOpenSingle = (
    e: React.MouseEvent,
    stock: SearchStockResultItem
  ) => {
    e.stopPropagation();
    focusSingleStock(stock.ticker);
    handleClose();
  };

  const handleInsertTopSector = async () => {
    if (sectorFilter === "Semua") return;
    try {
      const res = await searchStocksApi("", sectorFilter, MAX_STOCKS);
      const tickers = res.items.slice(0, MAX_STOCKS).map((s) => s.ticker);
      if (tickers.length > 0) {
        applyPreset(tickers, { presetId: null, sectorLabel: sectorFilter });
        handleClose();
      }
    } catch {
      // error already surfaced
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isSwapMode
          ? `Ganti saham ${swapTargetTicker}`
          : "Cari dan tambah emiten BEI"
      }
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[7vh] sm:pt-[9vh]"
    >
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink">
              {isSwapMode ? (
                <ArrowRightLeft className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-ink sm:text-base">
                {isSwapMode ? (
                  <>
                    Mengganti{" "}
                    <span className="font-mono text-positive">
                      {swapTargetTicker}
                    </span>{" "}
                    &rarr; Pilih Pengganti
                  </>
                ) : (
                  "Cari & Tambah Emiten BEI (Live Database)"
                )}
              </h2>
              <p className="text-xs text-ink-muted">
                {isSwapMode
                  ? "Posisi kolom komparasi dipertahankan (in-place swap)."
                  : isSlotsFull
                    ? `Slot penuh (${MAX_STOCKS}/${MAX_STOCKS}) — pilih emiten untuk mengganti ${focusedTicker} atau buka tunggal.`
                    : `Slot ${activeTickers.length}/${MAX_STOCKS} terisi • Terhubung ke ${totalUniverse > 0 ? totalUniverse.toLocaleString("id-ID") : "840+"} emiten BEI.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup modal pencarian saham"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik kode 4 huruf (mis. BBCA, BRIS, GGRM, AMRT) atau nama perusahaan..."
              className="h-11 w-full rounded-xl border border-border-subtle bg-canvas pr-16 pl-10 text-sm text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
            />
            {loading ? (
              <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-ink-muted" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Hapus kata kunci pencarian"
                className="absolute right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                ESC
              </kbd>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
              {IDX_IC_SECTOR_PILLS.map((sector) => {
                const isSelected = sectorFilter === sector;
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => setSectorFilter(sector)}
                    className={cn(
                      "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                      isSelected
                        ? "border-cta bg-cta text-cta-fg"
                        : "border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
                    )}
                  >
                    {sector}
                  </button>
                );
              })}
            </div>

            {sectorFilter !== "Semua" && !isSwapMode && (
              <button
                type="button"
                onClick={() => void handleInsertTopSector()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-positive-border bg-positive-soft px-2.5 py-1 text-xs font-semibold text-positive transition-opacity hover:opacity-90 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Masukkan Top Sektor Ini</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2.5 sm:px-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="h-6 w-6 text-negative" />
              <p className="mt-2 text-sm font-semibold text-ink">
                Pencarian Live Gagal Terhubung
              </p>
              <p className="mt-1 max-w-sm text-xs text-ink-muted">{error}</p>
            </div>
          ) : !loading && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-semibold text-ink">
                Emiten &ldquo;{query}&rdquo; tidak ditemukan di direktori BEI
              </p>
              <p className="mt-1 max-w-sm text-xs text-ink-muted">
                Coba kode 4 huruf BEI seperti BBCA, BRIS, ADRO, GGRM, AMRT,
                KLBF, TLKM, atau ASII.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((stock) => {
                const isAlreadyActive = activeTickers.includes(stock.ticker);
                const isBeingSwapped =
                  isSwapMode && swapTargetTicker === stock.ticker;
                const changePct = stock.changePercent ?? 0;
                const isPositive = changePct >= 0;
                const acctMeta =
                  ACCOUNTING_TYPE_META[stock.accountingType] ??
                  ACCOUNTING_TYPE_META.general;

                return (
                  <div
                    key={stock.ticker}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectStock(stock)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectStock(stock);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      isBeingSwapped
                        ? "border-info-border bg-info-soft/60"
                        : isAlreadyActive
                          ? "border-border-subtle bg-elevated/50 hover:bg-elevated"
                          : "border-transparent hover:border-border-subtle hover:bg-elevated/60"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink whitespace-nowrap">
                          {stock.ticker}
                        </span>
                        <span className="truncate text-sm font-medium text-ink">
                          {stock.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                        <span>{stock.sector}</span>
                        {stock.subsector && (
                          <>
                            <span>•</span>
                            <span className="truncate">{stock.subsector}</span>
                          </>
                        )}
                        <span className="hidden rounded bg-elevated px-1.5 py-0.2 font-mono text-[11px] text-ink-secondary sm:inline">
                          {acctMeta.shortLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <div className="font-sans text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
                          {stock.price !== null ? formatRupiah(stock.price) : "—"}
                        </div>
                        {stock.changePercent !== null && (
                          <div
                            className={cn(
                              "text-xs font-medium tabular-nums whitespace-nowrap",
                              isPositive ? "text-positive" : "text-negative"
                            )}
                          >
                            {formatPercent(stock.changePercent)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isSwapMode && !isAlreadyActive && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenSingle(e, stock)}
                            title={`Buka analisis tunggal untuk ${stock.ticker}`}
                            className="hidden h-7 items-center gap-1 rounded-md border border-border-subtle bg-surface px-2 text-[11px] font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink sm:inline-flex whitespace-nowrap"
                          >
                            <Target className="h-3 w-3" />
                            <span>Tunggal</span>
                          </button>
                        )}

                        {isBeingSwapped ? (
                          <span className="inline-flex h-7 items-center rounded-md border border-info-border bg-info-soft px-2 text-xs font-semibold text-info whitespace-nowrap">
                            Sedang Diganti
                          </span>
                        ) : isAlreadyActive ? (
                          <span className="inline-flex h-7 items-center gap-1 rounded-md border border-positive-border bg-positive-soft px-2 text-xs font-semibold text-positive whitespace-nowrap">
                            <Check className="h-3.5 w-3.5" />
                            <span>Aktif</span>
                          </span>
                        ) : isSwapMode ? (
                          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-cta px-2.5 text-xs font-semibold text-cta-fg whitespace-nowrap">
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>Ganti</span>
                          </span>
                        ) : isSlotsFull ? (
                          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-cta px-2.5 text-xs font-semibold text-cta-fg whitespace-nowrap">
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>Ganti {focusedTicker}</span>
                          </span>
                        ) : (
                          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-cta px-2.5 text-xs font-semibold text-cta-fg whitespace-nowrap">
                            <Plus className="h-3.5 w-3.5" />
                            <span>Tambah</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-canvas px-4 py-2.5 text-xs text-ink-muted sm:px-5">
          <span>
            {query.trim()
              ? `Menampilkan ${results.length} dari ${totalMatches.toLocaleString("id-ID")} emiten cocok`
              : `Top ${results.length} berdasar kapitalisasi pasar • Total ${totalUniverse.toLocaleString("id-ID")} emiten BEI`}
          </span>
          <span className="font-mono text-[11px] text-positive">
            Live Database: Supabase • TV • YF • GF
          </span>
        </div>
      </div>
    </div>
  );
}
