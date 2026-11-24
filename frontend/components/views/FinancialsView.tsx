"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  Coins,
  RefreshCw,
  Search,
} from "lucide-react";
import { fetchFinancialsApi, searchStocksApi } from "@/lib/apiClient";
import {
  formatBillionIdr,
  formatIdNumber,
  formatSyncTimestamp,
} from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import type {
  FinancialStatementTable,
  FinancialsApiResponse,
  SearchStockResultItem,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

function StatementTableCard({
  title,
  subtitle,
  table,
}: {
  title: string;
  subtitle: string;
  table: FinancialStatementTable;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <div className="border-b border-border-subtle bg-canvas/70 px-5 py-3.5">
        <h2 className="font-display text-sm font-bold text-ink sm:text-base">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      </div>

      {table.periods.length === 0 || table.rows.length === 0 ? (
        <div className="px-5 py-6 text-xs text-ink-muted">
          Data tabel ini belum tersedia dari feed publik untuk emiten &amp;
          periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-elevated/40 text-[11px] font-semibold tracking-wider text-ink-secondary uppercase">
                <th className="sticky left-0 z-10 bg-surface px-5 py-3">
                  Pos Laporan Keuangan
                </th>
                {table.periods.map((p) => (
                  <th
                    key={p}
                    className="px-4 py-3 text-right font-mono whitespace-nowrap"
                  >
                    {p}
                  </th>
                ))}
                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Perubahan Terkini
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {table.rows.map((row) => {
                const chg = row.latestChangePct;
                return (
                  <tr
                    key={row.key}
                    className="transition-colors hover:bg-canvas/70"
                  >
                    <td className="sticky left-0 z-10 bg-surface px-5 py-3 font-medium text-ink">
                      {row.label}
                    </td>
                    {row.valuesBillionIdr.map((val, idx) => (
                      <td
                        key={`${row.key}-${idx}`}
                        className={cn(
                          "px-4 py-3 text-right font-sans font-semibold whitespace-nowrap tabular-nums",
                          val !== null && val < 0
                            ? "text-negative"
                            : "text-ink"
                        )}
                      >
                        {val !== null && Number.isFinite(val)
                          ? formatBillionIdr(val)
                          : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-sans font-semibold whitespace-nowrap tabular-nums">
                      {chg !== null && Number.isFinite(chg) ? (
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-[11px]",
                            chg >= 0
                              ? "border-positive-border bg-positive-soft text-positive"
                              : "border-negative-border bg-negative-soft text-negative"
                          )}
                        >
                          {chg > 0 ? "+" : ""}
                          {formatIdNumber(chg, 1)}%
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FinancialsView() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);

  const [selectedTicker, setSelectedTicker] = React.useState(
    focusedTicker || activeTickers[0] || "BBCA"
  );
  const [period, setPeriod] = React.useState<"annual" | "quarterly">("annual");
  const [data, setData] = React.useState<FinancialsApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    SearchStockResultItem[]
  >([]);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchFinancialsApi(
          selectedTicker,
          period,
          controller.signal
        );
        if (cancelled) return;
        setData(res);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : `Gagal memuat laporan keuangan ${selectedTicker}.`
        );
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedTicker, period, refreshTick]);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchStocksApi(q, "", 6, controller.signal);
        setSearchResults(res.items);
      } catch {
        setSearchResults([]);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const visibleSearchResults = query.trim() ? searchResults : [];

  const quickTickers = Array.from(new Set([selectedTicker, ...activeTickers]));

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Laporan Keuangan Emiten
              </h1>
              <span className="rounded-md border border-border-subtle bg-elevated px-2 py-0.5 font-mono text-xs font-bold text-ink">
                {selectedTicker}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-secondary">
              {data?.companyName
                ? `${data.companyName} — `
                : ""}
              Laporan Laba Rugi, Neraca, dan Arus Kas langsung dari data live
              emiten dalam satuan Miliar / Triliun Rupiah (IDR).
            </p>
          </div>

          {/* Period Switcher + Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border-subtle bg-canvas p-0.5">
              {(
                [
                  { id: "annual", label: "Tahunan (Annual)" },
                  { id: "quarterly", label: "Kuartalan (Quarterly)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    period === opt.id
                      ? "bg-cta text-cta-fg"
                      : "text-ink-secondary hover:text-ink"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-elevated disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Stock Pills + Any-BEI Search */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-muted">
              Emiten Aktif:
            </span>
            {quickTickers.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTicker(t)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition-colors",
                  t === selectedTicker
                    ? "border-ink bg-cta text-cta-fg"
                    : "border-border-subtle bg-canvas text-ink-secondary hover:border-border-strong hover:text-ink"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-1.5 focus-within:border-ink">
              <Search className="h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buka laporan emiten BEI lain..."
                className="w-full bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>

            {visibleSearchResults.length > 0 && (
              <div className="absolute right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl">
                {visibleSearchResults.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => {
                      setSelectedTicker(item.ticker);
                      setQuery("");
                      setSearchResults([]);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-elevated"
                  >
                    <span className="font-mono font-bold text-ink">
                      {item.ticker}
                    </span>
                    <span className="truncate text-ink-secondary">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FX Conversion Transparency Note (for USD-reporting IDX stocks like ADRO, ITMG, MEDC) */}
        {data && data.reportingCurrency !== "IDR" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-info-border bg-info-soft/60 px-3.5 py-2.5 text-xs text-info">
            <Coins className="h-4 w-4 shrink-0" />
            <span>
              <strong>Konversi Mata Uang Otomatis:</strong> {data.ticker}{" "}
              melaporkan keuangan asli dalam{" "}
              <strong className="font-mono">{data.reportingCurrency}</strong>.
              Seluruh angka di bawah telah dikonversi ke{" "}
              <strong className="font-mono">IDR</strong> menggunakan kurs live{" "}
              <strong className="font-mono">
                1 {data.reportingCurrency} = Rp{" "}
                {formatIdNumber(data.fxRateApplied, 0)}
              </strong>
              .
            </span>
          </div>
        )}
      </div>

      {/* Loading / Error / Statement Tables */}
      {loading && !data ? (
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-negative-border bg-negative-soft/60 p-5 text-xs">
          <div className="flex items-center gap-2.5 text-negative">
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
      ) : data ? (
        <div className="space-y-5">
          <StatementTableCard
            title="1. Laporan Laba Rugi (Income Statement)"
            subtitle={`Pendapatan, laba kotor, EBITDA, laba operasi, dan laba bersih • Sumber: ${data.source} • Sync ${formatSyncTimestamp(data.syncedAt)}`}
            table={data.incomeStatement}
          />
          <StatementTableCard
            title="2. Neraca Keuangan (Balance Sheet)"
            subtitle="Posisi kas, aset lancar, total aset, total liabilitas, dan ekuitas pemegang saham"
            table={data.balanceSheet}
          />
          <StatementTableCard
            title="3. Laporan Arus Kas (Cash Flow Statement)"
            subtitle="Arus kas operasional (OCF), belanja modal (CapEx), arus kas bebas (FCF), dan pembayaran dividen"
            table={data.cashFlow}
          />
        </div>
      ) : null}
    </div>
  );
}
