"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  NotebookPen,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { formatRupiah } from "@/data/stocksCatalog";
import { formatIdNumber, formatSyncTimestamp } from "@/lib/fundamentalEngine";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import { useStockStore } from "@/store/useStockStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { JournalEntry } from "@/types/fundamental";
import { cn } from "@/lib/utils";

const STYLE_TAGS: JournalEntry["styleTag"][] = [
  "Value",
  "Growth",
  "Dividend",
  "Swing",
];

function createJournalEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `jrn-${crypto.randomUUID()}`;
  }
  return `jrn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function JournalView() {
  const compareData = useMarketDataStore((s) => s.compareData);
  const journalEntries = useMarketDataStore((s) => s.journalEntries);
  const addJournalEntry = useMarketDataStore((s) => s.addJournalEntry);
  const removeJournalEntry = useMarketDataStore((s) => s.removeJournalEntry);

  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const focusSingleStock = useStockStore((s) => s.focusSingleStock);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  const loadedStocks = compareData?.stocks ?? [];
  const [selectedTicker, setSelectedTicker] = React.useState(focusedTicker);
  const [styleTag, setStyleTag] =
    React.useState<JournalEntry["styleTag"]>("Value");
  const [note, setNote] = React.useState("");
  const [filterTag, setFilterTag] = React.useState<
    "Semua" | JournalEntry["styleTag"]
  >("Semua");
  const [savedFeedback, setSavedFeedback] = React.useState(false);

  const effectiveTicker = loadedStocks.some((s) => s.ticker === selectedTicker)
    ? selectedTicker
    : (loadedStocks.find((s) => s.ticker === focusedTicker)?.ticker ??
      loadedStocks[0]?.ticker ??
      focusedTicker);

  const targetStock = loadedStocks.find((s) => s.ticker === effectiveTicker);
  const targetProfile = effectiveTicker
    ? compareData?.decisionProfiles?.[effectiveTicker]
    : undefined;

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStock || !targetProfile) return;

    const entry: JournalEntry = {
      id: createJournalEntryId(),
      createdAt: new Date().toISOString(),
      ticker: targetStock.ticker,
      companyName: targetStock.name,
      sector: targetStock.sector,
      priceAtAnalysis: targetStock.price,
      quantScore: targetProfile.quantScore,
      verdictStatus: targetProfile.verdictStatus,
      entryLow: targetProfile.priceZones.entryLow,
      entryHigh: targetProfile.priceZones.entryHigh,
      fairValueTarget: targetProfile.priceZones.fairValueTarget,
      cutLoss: targetProfile.priceZones.cutLoss,
      riskRewardRatio: targetProfile.priceZones.riskRewardRatio,
      styleTag,
      note:
        note.trim() ||
        `Snapshot otomatis ${targetStock.ticker}: ${targetProfile.verdictStatus} (Skor ${targetProfile.quantScore}/100).`,
    };

    addJournalEntry(entry);
    setNote("");
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 2600);
  };

  const handleExportJournalCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = [
      "Tanggal",
      "Ticker",
      "Emiten",
      "Gaya",
      "Harga Analisis",
      "Skor",
      "Keputusan",
      "Zona Cicil",
      "Target Wajar",
      "Cut-Loss",
      "R:R",
      "Catatan Tesis",
    ];
    const lines = [header.map(esc).join(",")];
    for (const item of journalEntries) {
      lines.push(
        [
          formatSyncTimestamp(item.createdAt),
          item.ticker,
          item.companyName,
          item.styleTag,
          item.priceAtAnalysis,
          item.quantScore,
          item.verdictStatus,
          `${item.entryLow} - ${item.entryHigh}`,
          item.fairValueTarget,
          item.cutLoss,
          `1:${item.riskRewardRatio}`,
          item.note,
        ]
          .map(esc)
          .join(",")
      );
    }

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `equilens-jurnal-keputusan.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const visibleEntries =
    filterTag === "Semua"
      ? journalEntries
      : journalEntries.filter((e) => e.styleTag === filterTag);

  return (
    <div className="space-y-5">
      {/* Top Snapshot Composer */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink">
                <NotebookPen className="h-4 w-4" />
              </span>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Jurnal Tesis &amp; Keputusan Investasi
              </h1>
            </div>
            <p className="mt-1.5 text-xs text-ink-secondary">
              Kunci snapshot harga live, target nilai wajar, dan batas cut-loss
              sebagai dokumentasi disiplin riset (tersimpan lokal di browser).
            </p>
          </div>

          {journalEntries.length > 0 && (
            <button
              type="button"
              onClick={handleExportJournalCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-elevated"
            >
              <Download className="h-3.5 w-3.5 text-ink-secondary" />
              <span>Export Jurnal CSV</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveSnapshot} className="mt-5 space-y-4">
          {/* Stock Selector + Live Snapshot Preview */}
          <div className="rounded-xl border border-border-subtle bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Pilih Emiten Live untuk Dikunci
              </span>
              <div className="flex flex-wrap gap-1.5">
                {loadedStocks.map((st) => (
                  <button
                    key={st.ticker}
                    type="button"
                    onClick={() => setSelectedTicker(st.ticker)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition-colors",
                      st.ticker === effectiveTicker
                        ? "border-ink bg-cta text-cta-fg"
                        : "border-border-subtle bg-surface text-ink-secondary hover:text-ink"
                    )}
                  >
                    {st.ticker}
                  </button>
                ))}
              </div>
            </div>

            {targetStock && targetProfile ? (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-5">
                <div>
                  <span className="block text-[10px] text-ink-muted">
                    Harga Live
                  </span>
                  <strong className="font-sans text-sm font-bold text-ink tabular-nums">
                    {formatRupiah(targetStock.price)}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-muted">
                    Skor &amp; Keputusan
                  </span>
                  <strong className="font-mono text-xs font-bold text-ink">
                    {targetProfile.quantScore}/100 •{" "}
                    {targetProfile.verdictStatus}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-muted">
                    Zona Cicil
                  </span>
                  <strong className="font-sans text-xs font-semibold text-ink tabular-nums">
                    {formatRupiah(targetProfile.priceZones.entryLow)} –{" "}
                    {targetProfile.priceZones.entryHigh.toLocaleString("id-ID")}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-muted">
                    Target Wajar
                  </span>
                  <strong className="font-sans text-xs font-semibold text-positive tabular-nums">
                    {formatRupiah(targetProfile.priceZones.fairValueTarget)}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-ink-muted">
                    Cut-Loss • R:R
                  </span>
                  <strong className="font-sans text-xs font-semibold text-negative tabular-nums">
                    {formatRupiah(targetProfile.priceZones.cutLoss)} • 1:
                    {formatIdNumber(targetProfile.priceZones.riskRewardRatio, 2)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-muted">
                Muat saham terlebih dahulu di tab Komparasi agar snapshot live
                dapat direkam.
              </p>
            )}
          </div>

          {/* Style Tag + Thesis Note */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <span className="mb-1.5 block text-xs font-semibold text-ink">
                Gaya Strategi
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setStyleTag(tag)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      styleTag === tag
                        ? "border-ink bg-cta text-cta-fg"
                        : "border-border-subtle bg-canvas text-ink-secondary hover:text-ink"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              <label
                htmlFor="journal-thesis-note"
                className="mb-1.5 block text-xs font-semibold text-ink"
              >
                Catatan Tesis / Alasan Masuk &amp; Skenario Batal
              </label>
              <textarea
                id="journal-thesis-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Valuasi di bawah median sektor, ROE stabil >18%, rencana cicil 2 tahap dekat support S1..."
                className="w-full rounded-xl border border-border-subtle bg-canvas px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {savedFeedback ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-positive">
                <CheckCircle2 className="h-4 w-4" />
                Snapshot tesis berhasil disimpan ke Jurnal!
              </span>
            ) : (
              <span className="text-[11px] text-ink-muted">
                Maksimal 100 catatan tersimpan secara permanen di browser ini.
              </span>
            )}

            <button
              type="submit"
              disabled={!targetStock || !targetProfile}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cta px-4 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Simpan Snapshot Analisis</span>
            </button>
          </div>
        </form>
      </section>

      {/* Filter Bar + Saved Entries */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink">
            Riwayat Catatan ({visibleEntries.length})
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {(["Semua", ...STYLE_TAGS] as const).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filterTag === tag
                    ? "border-ink bg-cta text-cta-fg"
                    : "border-border-subtle bg-surface text-ink-secondary hover:text-ink"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {visibleEntries.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
            <NotebookPen className="mx-auto h-8 w-8 text-ink-muted" />
            <h3 className="mt-3 font-display text-sm font-bold text-ink">
              Belum Ada Catatan Jurnal
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Klik &ldquo;Simpan Snapshot Analisis&rdquo; di atas untuk merekam
              keputusan riset Anda beserta harga live dan rasio R:R saat ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleEntries.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-base font-bold text-ink">
                          {entry.ticker}
                        </span>
                        <span className="rounded-md border border-info-border bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info">
                          {entry.styleTag}
                        </span>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                            entry.verdictStatus === "AKUMULASI BERTAHAP"
                              ? "border-positive-border bg-positive-soft text-positive"
                              : entry.verdictStatus === "TUNGGU KOREKSI"
                                ? "border-caution-border bg-caution-soft text-caution"
                                : "border-negative-border bg-negative-soft text-negative"
                          )}
                        >
                          {entry.verdictStatus}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        {entry.companyName} • {entry.sector}
                      </p>
                    </div>

                    <span className="font-mono text-[11px] text-ink-muted">
                      {formatSyncTimestamp(entry.createdAt)}
                    </span>
                  </div>

                  <p className="mt-3 rounded-xl border border-border-subtle bg-canvas p-3 text-xs leading-relaxed text-ink">
                    {entry.note}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-elevated/50 px-2.5 py-2">
                      <span className="block text-[10px] text-ink-muted">
                        Harga Kunci
                      </span>
                      <strong className="font-sans font-bold text-ink tabular-nums">
                        {formatRupiah(entry.priceAtAnalysis)}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-elevated/50 px-2.5 py-2">
                      <span className="block text-[10px] text-ink-muted">
                        Target Wajar
                      </span>
                      <strong className="font-sans font-bold text-positive tabular-nums">
                        {formatRupiah(entry.fairValueTarget)}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-elevated/50 px-2.5 py-2">
                      <span className="block text-[10px] text-ink-muted">
                        Cut-Loss
                      </span>
                      <strong className="font-sans font-bold text-negative tabular-nums">
                        {formatRupiah(entry.cutLoss)}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-elevated/50 px-2.5 py-2">
                      <span className="block text-[10px] text-ink-muted">
                        Skor • R:R
                      </span>
                      <strong className="font-mono font-bold text-ink">
                        {entry.quantScore} • 1:
                        {formatIdNumber(entry.riskRewardRatio, 2)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      focusSingleStock(entry.ticker);
                      setActiveTab("komparasi");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-info"
                  >
                    <span>Buka Analisis Live {entry.ticker}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeJournalEntry(entry.id)}
                    aria-label="Hapus catatan jurnal"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-muted transition-colors hover:border-negative-border hover:bg-negative-soft hover:text-negative"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
