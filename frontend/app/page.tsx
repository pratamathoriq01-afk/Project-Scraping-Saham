"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { StockStrip } from "@/components/desktop/StockStrip";
import { FundamentalMatrixDesktop } from "@/components/desktop/FundamentalMatrixDesktop";
import { MobileTickerAndTabs } from "@/components/mobile/MobileTickerAndTabs";
import { FundamentalMatrixMobile } from "@/components/mobile/FundamentalMatrixMobile";
import { InteractiveCharts } from "@/components/shared/InteractiveCharts";
import { LiveMarketSummaryStrip } from "@/components/shared/LiveMarketSummaryStrip";
import { DecisionPanel } from "@/components/shared/DecisionPanel";
import { WatchlistView } from "@/components/views/WatchlistView";
import { FinancialsView } from "@/components/views/FinancialsView";
import { JournalView } from "@/components/views/JournalView";
import { formatRupiah } from "@/data/stocksCatalog";
import { formatSyncTimestamp } from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const mobileActiveTab = useStockStore((s) => s.mobileActiveTab);
  const setMobileActiveTab = useStockStore((s) => s.setMobileActiveTab);

  const compareData = useMarketDataStore((s) => s.compareData);
  const backendOnline = useMarketDataStore((s) => s.backendOnline);
  const compareError = useMarketDataStore((s) => s.compareError);
  const compareRefreshing = useMarketDataStore((s) => s.compareRefreshing);
  const loadCompare = useMarketDataStore((s) => s.loadCompare);
  const loadSourcesHealth = useMarketDataStore((s) => s.loadSourcesHealth);

  const focusedProfile = compareData?.decisionProfiles?.[focusedTicker] ?? null;

  const showChartsOnMobile = mobileActiveTab === "charts";
  const showDecisionOnMobile = mobileActiveTab === "keputusan";
  const showMatrixOnMobile = mobileActiveTab === "komparasi";

  const handleRetryBackend = () => {
    void loadSourcesHealth();
    void loadCompare(activeTickers, true);
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Print-Only Institutional Report Masthead */}
      <div className="hidden border-b border-border-strong pb-3 print:block">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-ink">
              EquiLens — Laporan Analisis Saham BEI
            </h1>
            <p className="text-xs text-ink-secondary">
              Emiten Aktif: {activeTickers.join(" • ")} | Fokus: {focusedTicker}
            </p>
          </div>
          <span className="font-mono text-xs text-ink-muted">
            Sync: {formatSyncTimestamp(compareData?.syncedAt)}
          </span>
        </div>
      </div>

      {/* Honest Offline Banner — Zero Simulation Fallback */}
      {backendOnline === false && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-negative-border bg-negative-soft/80 px-4 py-3 text-xs print:hidden"
        >
          <div className="flex items-start gap-2.5 text-negative">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong className="font-semibold">
                Backend Live FastAPI (Port 8000) Tidak Terjangkau.
              </strong>{" "}
              <span className="text-ink-secondary">
                {compareError ??
                  "EquiLens tidak pernah menampilkan angka palsu/simulasi. Pastikan uvicorn aktif di port 8000 lalu coba sambungkan ulang."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryBackend}
            disabled={compareRefreshing}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-cta px-3 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", compareRefreshing && "animate-spin")}
            />
            <span>Coba Sambungkan Ulang</span>
          </button>
        </div>
      )}

      {/* Multi-View Navigation Router */}
      {activeTab === "watchlist" ? (
        <WatchlistView />
      ) : activeTab === "keuangan" ? (
        <FinancialsView />
      ) : activeTab === "jurnal" ? (
        <JournalView />
      ) : (
        <>
          {/* ZONA 1 — Flexible Live Stock Selector Strip */}
          <StockStrip />
          <MobileTickerAndTabs />

          {/* ZONA 2 — Equal-Height 2-Column Split (Desktop: 8/4 cols; Mobile: 3-Tab) */}
          <section
            aria-label="Grafik interaktif dan keputusan investasi"
            className={cn(
              "grid-cols-1 items-stretch gap-6 lg:grid lg:grid-cols-12",
              showChartsOnMobile || showDecisionOnMobile
                ? "grid"
                : "hidden lg:grid"
            )}
          >
            {/* Left Column (~66.7% / 8 cols) — Flex Equal-Height InteractiveCharts + LiveMarketSummaryStrip */}
            <div
              className={cn(
                "flex h-full flex-col gap-4 lg:col-span-8",
                showChartsOnMobile ? "flex" : "hidden lg:flex"
              )}
            >
              <InteractiveCharts />
              <LiveMarketSummaryStrip />

              {/* Mobile-only compact 1-row Live Decision Summary Strip under Charts */}
              {focusedProfile && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-3.5 lg:hidden">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">
                        {focusedTicker}
                      </span>
                      <span
                        className={cn(
                          "truncate rounded border px-1.5 py-0.5 text-[11px] font-bold",
                          focusedProfile.verdictStatus === "AKUMULASI BERTAHAP"
                            ? "border-positive-border bg-positive-soft text-positive"
                            : focusedProfile.verdictStatus === "TUNGGU KOREKSI"
                              ? "border-caution-border bg-caution-soft text-caution"
                              : "border-negative-border bg-negative-soft text-negative"
                        )}
                      >
                        {focusedProfile.verdictStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted tabular-nums">
                      Skor {focusedProfile.quantScore}/100 • Target{" "}
                      {formatRupiah(focusedProfile.priceZones.fairValueTarget)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileActiveTab("keputusan")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-cta px-3 py-2 text-xs font-semibold text-cta-fg whitespace-nowrap"
                  >
                    <span>Alasan Lengkap</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Column (~33.3% / 4 cols) — Equal-Height DecisionPanel */}
            <div
              className={cn(
                "flex h-full flex-col lg:col-span-4",
                showDecisionOnMobile ? "flex" : "hidden lg:flex"
              )}
            >
              <DecisionPanel />
            </div>
          </section>

          {/* ZONA 3 — Full-Width Live 30-Indicator Fundamental Comparison Matrix */}
          <FundamentalMatrixDesktop />
          {showMatrixOnMobile && <FundamentalMatrixMobile />}
        </>
      )}
    </div>
  );
}
