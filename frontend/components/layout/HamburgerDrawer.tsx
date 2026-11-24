"use client";

import * as React from "react";
import {
  Building2,
  Check,
  Database,
  Flame,
  Layers,
  RadioTower,
  ShieldCheck,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { searchStocksApi } from "@/lib/apiClient";
import { MAX_STOCKS, useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

const IDX_IC_SECTORS: { label: string; tag: string }[] = [
  { label: "Perbankan & Keuangan", tag: "FIN" },
  { label: "Energi & Tambang", tag: "ENG" },
  { label: "Consumer Non-Cyclicals", tag: "CNS" },
  { label: "Consumer Cyclicals", tag: "CYC" },
  { label: "Infrastruktur", tag: "INF" },
  { label: "Perindustrian", tag: "IND" },
  { label: "Barang Baku", tag: "MAT" },
  { label: "Kesehatan", tag: "HLT" },
  { label: "Properti & Real Estat", tag: "PRP" },
  { label: "Teknologi", tag: "TEC" },
  { label: "Mode Lintas Sektor", tag: "ALL" },
];

const SOURCE_META: {
  key: string;
  code: string;
  name: string;
  role: string;
}[] = [
  {
    key: "TRADINGVIEW",
    code: "TV",
    name: "TradingView Scanner",
    role: "Quote live, OHLC & 840+ direktori BEI",
  },
  {
    key: "YAHOO_FINANCE",
    code: "YF",
    name: "Yahoo Finance (.JK)",
    role: "Histori OHLCV 5Y & laporan keuangan",
  },
  {
    key: "GOOGLE_FINANCE",
    code: "GF",
    name: "Google Finance (IDX)",
    role: "Validator harga ke-3 & failover",
  },
  {
    key: "SUPABASE_BEI",
    code: "BEI",
    name: "Supabase 4 Kamar",
    role: "Master emiten, jangkar & audit validasi",
  },
];

export function HamburgerDrawer() {
  const isDrawerOpen = useWorkspaceStore((s) => s.isDrawerOpen);
  const setDrawerOpen = useWorkspaceStore((s) => s.setDrawerOpen);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  const selectedSector = useStockStore((s) => s.selectedSector);
  const activePresetId = useStockStore((s) => s.activePresetId);
  const applyPreset = useStockStore((s) => s.applyPreset);
  const setSelectedSector = useStockStore((s) => s.setSelectedSector);

  const presets = useMarketDataStore((s) => s.presets);
  const sourcesHealth = useMarketDataStore((s) => s.sourcesHealth);
  const backendOnline = useMarketDataStore((s) => s.backendOnline);

  React.useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen, setDrawerOpen]);

  const handleSectorClick = async (sector: string) => {
    if (sector === "Mode Lintas Sektor") {
      applyPreset(["BBCA", "ADRO", "ICBP"], {
        presetId: "cross-sector-default",
        sectorLabel: "Mode Lintas Sektor",
      });
    } else {
      try {
        const res = await searchStocksApi("", sector, MAX_STOCKS);
        const topTickers = res.items.slice(0, MAX_STOCKS).map((s) => s.ticker);
        if (topTickers.length > 0) {
          applyPreset(topTickers, { presetId: null, sectorLabel: sector });
        } else {
          setSelectedSector(sector);
        }
      } catch {
        setSelectedSector(sector);
      }
    }
    setActiveTab("komparasi");
    setDrawerOpen(false);
  };

  const handlePresetClick = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    applyPreset(preset.tickers, {
      presetId: preset.id,
      sectorLabel: preset.sectorLabel,
    });
    setActiveTab("komparasi");
    setDrawerOpen(false);
  };

  return (
    <div
      id="equilens-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Menu filter sektor, preset komparasi, dan status data"
      aria-hidden={!isDrawerOpen}
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        isDrawerOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      )}
    >
      <div
        onClick={() => setDrawerOpen(false)}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />

      <aside
        className={cn(
          "relative flex h-full w-[310px] max-w-[86vw] flex-col border-r border-border-subtle bg-surface shadow-2xl transition-transform duration-200 ease-out",
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <div className="flex flex-col">
            <BrandLogo size="sm" />
            <span className="mt-0.5 text-xs text-ink-muted">
              Workspace Analitik Live BEI
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Tutup panel navigasi"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {/* 11 Official IDX-IC Sectors */}
          <section aria-labelledby="drawer-sectors-heading">
            <div className="mb-2.5 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-ink-muted" />
              <h2
                id="drawer-sectors-heading"
                className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
              >
                Filter Cepat Sektor IDX-IC
              </h2>
            </div>

            <div className="space-y-1">
              {IDX_IC_SECTORS.map(({ label, tag }) => {
                const isSelected = selectedSector === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void handleSectorClick(label)}
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-cta font-semibold text-cta-fg"
                        : "text-ink-secondary hover:bg-elevated hover:text-ink"
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <span
                      className={cn(
                        "ml-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap",
                        isSelected
                          ? "bg-white/15 text-cta-fg dark:bg-black/15"
                          : "bg-elevated text-ink-muted"
                      )}
                    >
                      {tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Presets from Live Backend */}
          {presets.length > 0 && (
            <section
              aria-labelledby="drawer-presets-heading"
              className="border-t border-border-subtle pt-5"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-ink-muted" />
                <h2
                  id="drawer-presets-heading"
                  className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
                >
                  Preset Komparasi 1-Klik
                </h2>
              </div>

              <div className="space-y-2">
                {presets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  const Icon =
                    preset.id === "big4-perbankan"
                      ? Building2
                      : preset.id === "pemimpin-batubara"
                        ? Flame
                        : preset.id === "defensive-consumer"
                          ? ShieldCheck
                          : preset.id === "infra-otomotif"
                            ? RadioTower
                            : Shuffle;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetClick(preset.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors",
                        isActive
                          ? "border-ink bg-elevated"
                          : "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated/60"
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink">
                            {preset.title}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-ink-muted">
                            {preset.subtitle}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <Check className="mt-1 h-4 w-4 shrink-0 text-positive" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Real Live 4-Channel Source Telemetry */}
          <section
            aria-labelledby="drawer-sources-heading"
            className="border-t border-border-subtle pt-5"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-ink-muted" />
              <h2
                id="drawer-sources-heading"
                className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
              >
                Kesehatan 4 Kanal Live
              </h2>
            </div>

            <div className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3">
              {SOURCE_META.map((source) => {
                const circuit = sourcesHealth?.sources?.[source.key];
                const isOnline =
                  backendOnline === true && (circuit ? circuit.healthy : true);
                const latency = circuit?.last_latency_ms
                  ? `${Math.round(circuit.last_latency_ms)}ms`
                  : null;

                return (
                  <div
                    key={source.code}
                    className="flex items-start justify-between gap-2 border-b border-border-subtle pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <span className="rounded bg-elevated px-1 py-0.2 font-mono text-[10px] text-ink-secondary">
                          {source.code}
                        </span>
                        <span>{source.name}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        {source.role}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                        backendOnline === false
                          ? "border-negative-border bg-negative-soft text-negative"
                          : isOnline
                            ? "border-positive-border bg-positive-soft text-positive"
                            : "border-caution-border bg-caution-soft text-caution"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {backendOnline === false
                        ? "Offline"
                        : isOnline
                          ? latency ?? "Live"
                          : "Failover"}
                    </span>
                  </div>
                );
              })}

              {sourcesHealth && (
                <p className="pt-1 font-mono text-[11px] text-ink-muted">
                  Supabase: {sourcesHealth.masterEmitenCount.toLocaleString("id-ID")}{" "}
                  emiten BEI • {sourcesHealth.syncedAt}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border-subtle px-4 py-3 text-xs text-ink-muted">
          <div className="flex items-center justify-between">
            <span>EquiLens Live Terminal</span>
            <span className="font-mono text-[11px]">v2.0 • BEI</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
