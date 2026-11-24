"use client";

import * as React from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Menu,
  Printer,
  Search,
  User,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import {
  buildMatrixCsv,
  evaluateLiveComparisonMatrix,
} from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useWorkspaceStore, type NavTab } from "@/store/useWorkspaceStore";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: "komparasi", label: "Komparasi" },
  { id: "watchlist", label: "Watchlist" },
  { id: "keuangan", label: "Keuangan" },
  { id: "jurnal", label: "Jurnal" },
];

export function TopHeader() {
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const toggleDrawer = useWorkspaceStore((s) => s.toggleDrawer);
  const isDrawerOpen = useWorkspaceStore((s) => s.isDrawerOpen);
  const openAddStockModal = useWorkspaceStore((s) => s.openAddStockModal);

  const backendOnline = useMarketDataStore((s) => s.backendOnline);
  const compareRefreshing = useMarketDataStore((s) => s.compareRefreshing);
  const loadCompare = useMarketDataStore((s) => s.loadCompare);
  const loadSourcesHealth = useMarketDataStore((s) => s.loadSourcesHealth);

  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isExportOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setIsExportOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExportOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isExportOpen]);

  const handleExportCsv = () => {
    const { activeTickers, hiddenMetricIds } = useStockStore.getState();
    const { compareData } = useMarketDataStore.getState();
    const matrix = evaluateLiveComparisonMatrix(
      compareData,
      activeTickers,
      hiddenMetricIds
    );
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
    setIsExportOpen(false);
  };

  const handlePrintPdf = () => {
    setIsExportOpen(false);
    window.setTimeout(() => window.print(), 120);
  };

  const handleStatusRefresh = () => {
    const { activeTickers } = useStockStore.getState();
    void loadSourcesHealth();
    void loadCompare(activeTickers, true);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface/95 backdrop-blur-md transition-colors print:hidden">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:h-16 md:px-6">
        {/* Left: Hamburger + Canonical Logo + Unified Desktop Navigation */}
        <div className="flex min-w-0 items-center gap-2 md:gap-6">
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label="Buka menu navigasi dan filter sektor"
            aria-expanded={isDrawerOpen}
            aria-controls="equilens-drawer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("komparasi")}
            className="rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <BrandLogo />
          </button>

          <nav
            aria-label="Navigasi utama"
            className="hidden h-16 items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
                    isActive
                      ? "font-semibold text-ink"
                      : "font-medium text-ink-muted hover:text-ink"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-ink"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Search + Live Pipeline Status + Theme + Export Dropdown + Avatar */}
        <div className="flex items-center gap-2 md:gap-2.5">
          {/* Mobile Search Trigger */}
          <button
            type="button"
            onClick={openAddStockModal}
            aria-label="Cari emiten IDX"
            title="Cari emiten IDX (Ctrl+K)"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:bg-elevated hover:text-ink lg:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Desktop Command Search Trigger */}
          <button
            type="button"
            onClick={openAddStockModal}
            aria-label="Cari emiten IDX (Ctrl+K)"
            className="hidden h-9 w-48 items-center justify-between rounded-lg border border-border-subtle bg-elevated/70 px-3 text-xs text-ink-muted transition-colors hover:border-border-strong hover:text-ink lg:inline-flex xl:w-56"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Cari 841+ emiten IDX...</span>
            </span>
            <kbd className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-secondary">
              ⌘K
            </kbd>
          </button>

          {/* Live Data Pipeline Status Badge (Honest Online / Offline) */}
          <button
            type="button"
            onClick={handleStatusRefresh}
            title={
              backendOnline === false
                ? "Backend FastAPI (port 8000) offline — klik untuk mencoba sambungkan ulang"
                : "Pipeline Live 4-Kanal aktif (TradingView • Yahoo Finance • Google Finance • Supabase) — klik untuk refresh"
            }
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors sm:inline-flex",
              backendOnline === false
                ? "border-negative-border bg-negative-soft text-negative hover:opacity-90"
                : backendOnline === true
                  ? "border-positive-border bg-positive-soft text-positive hover:opacity-90"
                  : "border-border-subtle bg-elevated text-ink-secondary"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 rounded-full",
                backendOnline === false
                  ? "bg-negative"
                  : backendOnline === true
                    ? cn("bg-positive", compareRefreshing && "animate-ping")
                    : "animate-pulse bg-caution"
              )}
            />
            <span className="font-mono text-[11px] font-medium whitespace-nowrap">
              {backendOnline === false
                ? "Backend Offline"
                : backendOnline === true
                  ? "Data BEI • Live (TV • YF • GF)"
                  : "Menghubungkan Live..."}
            </span>
          </button>

          <ThemeSwitcher />

          {/* Export Dropdown (CSV + Cetak PDF) */}
          <div ref={exportMenuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              aria-expanded={isExportOpen}
              aria-haspopup="menu"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-elevated"
            >
              <Download className="h-3.5 w-3.5 text-ink-secondary" />
              <span>Export</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-ink-muted transition-transform",
                  isExportOpen && "rotate-180"
                )}
              />
            </button>

            {isExportOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border-subtle bg-surface p-1 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportCsv}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
                >
                  <FileSpreadsheet className="h-4 w-4 text-positive" />
                  <div>
                    <span className="block font-semibold">Unduh CSV (Excel)</span>
                    <span className="block text-[10px] text-ink-muted">
                      30 indikator &amp; pemenang baris
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handlePrintPdf}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
                >
                  <Printer className="h-4 w-4 text-info" />
                  <div>
                    <span className="block font-semibold">Cetak / Simpan PDF</span>
                    <span className="block text-[10px] text-ink-muted">
                      Laporan riset siap presentasi
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* User Avatar (Opens Journal Tab) */}
          <button
            type="button"
            onClick={() => setActiveTab("jurnal")}
            aria-label="Buka jurnal investor"
            title="Jurnal Keputusan Investor"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta text-cta-fg transition-opacity hover:opacity-90"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
