"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { formatPercent, formatRupiah } from "@/data/stocksCatalog";
import { fetchCompareApi, searchStocksApi } from "@/lib/apiClient";
import { formatIdNumber, formatSyncTimestamp } from "@/lib/fundamentalEngine";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useStockStore } from "@/store/useStockStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type {
  DecisionProfileApi,
  LiveStockItem,
  SearchStockResultItem,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

interface WatchlistLiveRow {
  stock: LiveStockItem;
  profile: DecisionProfileApi | undefined;
}

export function WatchlistView() {
  const watchlistTickers = useMarketDataStore((s) => s.watchlistTickers);
  const addToWatchlist = useMarketDataStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useMarketDataStore((s) => s.removeFromWatchlist);

  const addStock = useStockStore((s) => s.addStock);
  const focusSingleStock = useStockStore((s) => s.focusSingleStock);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  const [rows, setRows] = React.useState<WatchlistLiveRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [syncedAt, setSyncedAt] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Quick live add-to-watchlist search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    SearchStockResultItem[]
  >([]);
  const [searching, setSearching] = React.useState(false);

  const tickersKey = watchlistTickers.join(",");

  React.useEffect(() => {
    const tickers = tickersKey.split(",").filter(Boolean);
    if (tickers.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    const loadAllBatches = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      // Chunk watchlist into batches of 5 (matching /api/compare max 5 tickers per request)
      const chunks: string[][] = [];
      for (let i = 0; i < tickers.length; i += 5) {
        chunks.push(tickers.slice(i, i + 5));
      }

      try {
        const responses = await Promise.all(
          chunks.map((chunk) =>
            fetchCompareApi(chunk, refreshTick > 0, controller.signal)
          )
        );
        if (cancelled) return;

        const map = new Map<string, WatchlistLiveRow>();
        let latestSync: string | null = null;

        for (const res of responses) {
          if (res.syncedAt) latestSync = res.syncedAt;
          for (const st of res.stocks) {
            map.set(st.ticker, {
              stock: st,
              profile: res.decisionProfiles[st.ticker],
            });
          }
        }

        const ordered = tickers
          .map((t) => map.get(t))
          .filter((item): item is WatchlistLiveRow => Boolean(item));

        setRows(ordered);
        setSyncedAt(latestSync);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat data live watchlist dari backend."
        );
        setLoading(false);
      }
    };

    void loadAllBatches();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tickersKey, refreshTick]);

  // Debounced live search across 841+ BEI stocks
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchStocksApi(q, "", 6, controller.signal);
        setSearchResults(res.items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const visibleRows = watchlistTickers.length === 0 ? [] : rows;
  const visibleSearchResults = searchQuery.trim() ? searchResults : [];
  const isSearching = Boolean(searchQuery.trim()) && searching;

  const entryZoneHits = visibleRows.filter(
    ({ stock, profile }) =>
      profile &&
      profile.verdictStatus !== "WASPADA / HINDARI" &&
      stock.price <= profile.priceZones.entryHigh
  ).length;

  const handleOpenInCompare = (ticker: string) => {
    addStock(ticker);
    setActiveTab("komparasi");
  };

  const handleOpenFinancials = (ticker: string) => {
    focusSingleStock(ticker);
    setActiveTab("keuangan");
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink">
                <Bookmark className="h-4 w-4" />
              </span>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Watchlist Saham BEI
              </h1>
              <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 font-mono text-xs font-medium text-ink-secondary">
                {watchlistTickers.length} Emiten Dipantau
              </span>
              {entryZoneHits > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-positive-border bg-positive-soft px-2.5 py-0.5 text-xs font-semibold text-positive">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {entryZoneHits} Masuk Zona Cicil Beli
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-secondary">
              Pantau harga live, skor kuantitatif, dan sinyal masuk Zona Cicil
              Beli otomatis untuk saham incaran Anda. Tersimpan otomatis di
              browser ini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {syncedAt && (
              <span className="font-mono text-[11px] text-ink-muted">
                Sync: {formatSyncTimestamp(syncedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-positive-border bg-positive-soft px-3 text-xs font-semibold text-positive transition-colors hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>{loading ? "Menyinkronkan..." : "Refresh Live"}</span>
            </button>
          </div>
        </div>

        {/* Live Add-Stock Search Bar */}
        <div className="relative mt-4 max-w-xl">
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas px-3 py-2 focus-within:border-ink">
            <Search className="h-4 w-4 shrink-0 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tambah emiten ke watchlist (contoh: BBRI, TLKM, ASII, BRIS)..."
              className="w-full bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
            />
            {isSearching && (
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" />
            )}
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="absolute right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl">
              {visibleSearchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-ink-muted">
                  {isSearching
                    ? "Mencari di katalog 841+ emiten BEI..."
                    : `Tidak ditemukan emiten cocok untuk "${searchQuery}".`}
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {visibleSearchResults.map((item) => {
                    const alreadyIn = watchlistTickers.includes(item.ticker);
                    return (
                      <button
                        key={item.ticker}
                        type="button"
                        disabled={alreadyIn}
                        onClick={() => {
                          addToWatchlist(item.ticker);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated disabled:cursor-default disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-ink">
                              {item.ticker}
                            </span>
                            <span className="truncate text-xs text-ink-secondary">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-ink-muted">
                            {item.sector}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                            alreadyIn
                              ? "bg-elevated text-ink-muted"
                              : "bg-cta text-cta-fg"
                          )}
                        >
                          <Plus className="h-3 w-3" />
                          {alreadyIn ? "Sudah Ada" : "Pantau"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Honest Error State */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-negative-border bg-negative-soft/60 p-4 text-xs">
          <div className="flex items-center gap-2 text-negative">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="rounded-lg bg-cta px-3 py-1.5 font-semibold text-cta-fg"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Watchlist Content */}
      {watchlistTickers.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-ink-muted" />
          <h2 className="mt-3 font-display text-base font-bold text-ink">
            Watchlist Anda Masih Kosong
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Gunakan kolom pencarian di atas untuk memantau harga live dan zona
            cicil beli emiten pilihan Anda.
          </p>
        </div>
      ) : loading && visibleRows.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {watchlistTickers.map((t) => (
            <div
              key={t}
              className="h-48 animate-pulse rounded-2xl border border-border-subtle bg-surface"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map(({ stock, profile }) => {
            const isUp = stock.changePercent >= 0;
            const inEntryZone =
              profile &&
              profile.verdictStatus !== "WASPADA / HINDARI" &&
              stock.price <= profile.priceZones.entryHigh;

            return (
              <article
                key={stock.ticker}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-surface p-4 transition-colors",
                  inEntryZone
                    ? "border-positive-border shadow-xs"
                    : "border-border-subtle"
                )}
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-base font-bold text-ink">
                          {stock.ticker}
                        </span>
                        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-secondary">
                          Skor {stock.quantScore}/100
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-secondary">
                        {stock.name}
                      </p>
                      <p className="text-[11px] text-ink-muted">{stock.sector}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-sans text-base font-bold text-ink tabular-nums">
                        {formatRupiah(stock.price)}
                      </p>
                      <p
                        className={cn(
                          "font-sans text-xs font-semibold tabular-nums",
                          isUp ? "text-positive" : "text-negative"
                        )}
                      >
                        {formatPercent(stock.changePercent)}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {profile && (
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                          profile.verdictStatus === "AKUMULASI BERTAHAP"
                            ? "border-positive-border bg-positive-soft text-positive"
                            : profile.verdictStatus === "TUNGGU KOREKSI"
                              ? "border-caution-border bg-caution-soft text-caution"
                              : "border-negative-border bg-negative-soft text-negative"
                        )}
                      >
                        {profile.verdictStatus}
                      </span>
                    )}
                    {inEntryZone && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-positive-border bg-positive-soft px-2 py-0.5 text-[11px] font-semibold text-positive">
                        <CheckCircle2 className="h-3 w-3" />
                        Masuk Zona Cicil Beli
                      </span>
                    )}
                  </div>

                  {/* Price Zones Grid */}
                  {profile && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-canvas p-2.5 text-xs">
                      <div>
                        <span className="block text-[10px] text-ink-muted">
                          Zona Cicil Beli
                        </span>
                        <span className="font-sans font-semibold text-ink tabular-nums">
                          {formatRupiah(profile.priceZones.entryLow)} –{" "}
                          {profile.priceZones.entryHigh.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-ink-muted">
                          Target Wajar (Upside)
                        </span>
                        <span className="font-sans font-semibold text-positive tabular-nums">
                          {formatRupiah(profile.priceZones.fairValueTarget)} (
                          {profile.priceZones.upsidePct > 0 ? "+" : ""}
                          {formatIdNumber(profile.priceZones.upsidePct, 1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenInCompare(stock.ticker)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-cta px-2.5 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover"
                    >
                      <span>Buka di Komparasi</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenFinancials(stock.ticker)}
                      title="Lihat Laporan Keuangan"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(stock.ticker)}
                    aria-label={`Hapus ${stock.ticker} dari watchlist`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-muted transition-colors hover:border-negative-border hover:bg-negative-soft hover:text-negative"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
