"use client";

import * as React from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  Info,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { CATEGORY_DEFINITIONS, formatIdNumber } from "@/lib/fundamentalEngine";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import type {
  EvaluatedMetricRow,
  MatrixColumnDescriptor,
  ValidationStatus,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

interface TripleCheckInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  row: EvaluatedMetricRow | null;
  columns: MatrixColumnDescriptor[];
  initialColumnId?: string | null;
}

function getValidationBadge(status: ValidationStatus): {
  label: string;
  desc: string;
  badgeClass: string;
  dotClass: string;
} {
  if (status === "verified") {
    return {
      label: "Konsensus 4-Kanal (≤ 1,5%)",
      desc: "Selisih antar sumber live berada dalam batas toleransi ketat ≤ 1,5%.",
      badgeClass: "border-positive-border bg-positive-soft text-positive",
      dotClass: "bg-positive",
    };
  }
  if (status === "minor_diff") {
    return {
      label: "Selisih Minor (1,5%–5,0%)",
      desc: "Perbedaan tipis antar penyedia akibat jeda sinkronisasi kuartalan; jangkar BEI / konsensus menjadi acuan utama.",
      badgeClass: "border-caution-border bg-caution-soft text-caution",
      dotClass: "bg-caution",
    };
  }
  if (status === "failover_active") {
    return {
      label: "Failover Sumber Cadangan",
      desc: "Sumber utama sedang mengalami gangguan sementara; nilai diamankan otomatis dari sumber cadangan yang lolos pagar validasi.",
      badgeClass: "border-caution-border bg-caution-soft text-caution",
      dotClass: "bg-caution",
    };
  }
  if (status === "quarantined") {
    return {
      label: "Karantina Anomali (> 5%)",
      desc: "Nilai outlier diisolasi oleh pagar validasi 5-lapis (anti-stock-split & anti-typo) hingga konsensus pulih.",
      badgeClass: "border-negative-border bg-negative-soft text-negative",
      dotClass: "bg-negative",
    };
  }
  return {
    label: "Jangkar Laporan BEI / Quant",
    desc: "Dihitung langsung dari laporan keuangan kuartalan/tahunan emiten di Supabase atau engine kuantitatif EquiLens.",
    badgeClass: "border-info-border bg-info-soft text-info",
    dotClass: "bg-info",
  };
}

function fmtOptPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "—";
  return `${formatIdNumber(val, 1)}%`;
}

export function TripleCheckInspector({
  isOpen,
  onClose,
  row,
  columns,
  initialColumnId,
}: TripleCheckInspectorProps) {
  const compareData = useMarketDataStore((s) => s.compareData);

  const [selectedOverride, setSelectedOverride] = React.useState<{
    metricId: string;
    columnId: string;
  } | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !row || columns.length === 0) return null;

  const activeColumnId =
    selectedOverride &&
    selectedOverride.metricId === row.metric.id &&
    columns.some((c) => c.id === selectedOverride.columnId)
      ? selectedOverride.columnId
      : initialColumnId && columns.some((c) => c.id === initialColumnId)
        ? initialColumnId
        : columns[0].id;

  const activeColumn =
    columns.find((c) => c.id === activeColumnId) ?? columns[0];
  const cell = row.cells[activeColumn.id];
  const category = CATEGORY_DEFINITIONS.find(
    (c) => c.id === row.metric.categoryId
  );

  if (!cell) return null;

  const auditMeta = getValidationBadge(cell.audit.status);
  const anchor =
    activeColumn.kind === "stock"
      ? compareData?.quarterlyAnchors?.[activeColumn.ticker]
      : undefined;
  const stockWarnings =
    activeColumn.kind === "stock"
      ? (compareData?.dataWarnings?.[activeColumn.ticker] ?? [])
      : [];

  const channels: {
    code: string;
    name: string;
    value: number | string | null;
    role: string;
  }[] = [
    {
      code: "BEI",
      name:
        anchor?.sourceType === "BEI_VERIFIED"
          ? "Laporan Resmi BEI"
          : "Supabase Fundamental",
      value: cell.audit.beiValue,
      role: "Jangkar Utama",
    },
    {
      code: "TV",
      name: "TradingView Scanner",
      value: cell.audit.tvValue,
      role: "Cross-Check 1",
    },
    {
      code: "YF",
      name: "Yahoo Finance (.JK)",
      value: cell.audit.yfValue,
      role: "Cross-Check 2",
    },
    {
      code: "GF",
      name: "Google Finance (IDX:)",
      value: cell.audit.gfValue,
      role: "Cross-Check 3",
    },
  ];

  const hasBankMetrics =
    anchor?.bankHealth &&
    (anchor.bankHealth.carPct !== null ||
      anchor.bankHealth.nplGrossPct !== null ||
      anchor.bankHealth.nimPct !== null ||
      anchor.bankHealth.casaPct !== null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="triple-check-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {category && (
                <span className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-secondary">
                  {category.numberLabel} {category.shortTitle}
                </span>
              )}
              {row.metric.isLiveReactive && (
                <span className="inline-flex items-center gap-1 rounded border border-info-border bg-info-soft px-1.5 py-0.5 text-[11px] font-semibold text-info">
                  <Zap className="h-3 w-3" />
                  Reaktif Live Price
                </span>
              )}
            </div>
            <h3
              id="triple-check-title"
              className="mt-1.5 font-display text-lg font-bold tracking-tight text-ink"
            >
              {row.metric.label}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup inspektor audit"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* Column Switcher Pills */}
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              Pilih Kolom untuk Diaudit
            </span>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((col) => {
                const colCell = row.cells[col.id];
                const isSelected = col.id === activeColumn.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      setSelectedOverride({
                        metricId: row.metric.id,
                        columnId: col.id,
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      isSelected
                        ? "border-ink bg-cta font-semibold text-cta-fg"
                        : "border-border-subtle bg-canvas font-medium text-ink-secondary hover:border-border-strong hover:text-ink"
                    )}
                  >
                    <span className="font-mono">{col.label}</span>
                    {colCell && (
                      <span
                        className={cn(
                          "font-sans text-xs tabular-nums",
                          isSelected ? "opacity-90" : "text-ink-muted"
                        )}
                      >
                        {colCell.formattedValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Value Readout Box */}
          <div className="rounded-xl border border-border-subtle bg-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">
                    {activeColumn.label}
                  </span>
                  <span className="text-xs text-ink-muted">
                    • {activeColumn.subLabel}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "text-2xl font-bold tracking-tight tabular-nums",
                      cell.isNotApplicable
                        ? "font-mono text-lg text-ink-muted"
                        : cell.isWarning
                          ? "font-sans text-negative"
                          : cell.isWinner
                            ? "font-sans text-positive"
                            : "font-sans text-ink"
                    )}
                  >
                    {cell.formattedValue}
                  </span>
                  {cell.subLabel && (
                    <span className="text-xs font-medium text-ink-secondary">
                      {cell.subLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {cell.isWinner && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-positive-border bg-positive-soft px-2 py-1 text-xs font-semibold text-positive">
                    <Award className="h-3.5 w-3.5" />
                    Unggul di Baris Ini
                  </span>
                )}
                {cell.isWarning && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-negative-border bg-negative-soft px-2 py-1 text-xs font-semibold text-negative">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Peringatan Risiko
                  </span>
                )}
                {cell.isNotApplicable && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-elevated px-2 py-1 font-mono text-xs font-medium text-ink-secondary">
                    <Building2 className="h-3.5 w-3.5" />
                    Dikecualikan (Bank)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4-Channel Audit Section */}
          <div className="rounded-xl border border-border-subtle bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-positive" />
                <h4 className="text-xs font-semibold tracking-wider text-ink uppercase">
                  Audit Validasi 4-Kanal (TV • YF • GF • BEI)
                </h4>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  auditMeta.badgeClass
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", auditMeta.dotClass)}
                />
                {auditMeta.label}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {channels.map((ch) => (
                <div
                  key={ch.code}
                  className="rounded-lg border border-border-subtle bg-surface p-2.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-ink">
                      {ch.code}
                    </span>
                    <span className="text-[10px] font-medium text-ink-muted">
                      {ch.role}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">
                    {ch.name}
                  </p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-ink tabular-nums">
                    {ch.value ?? "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
              <span className="font-mono">
                Max Spread:{" "}
                <strong className="text-ink">
                  {formatIdNumber(cell.audit.spreadPct, 2)}%
                </strong>
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                Sync: {cell.audit.lastSynced}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {auditMeta.desc}
            </p>

            {/* Live Pipeline Transparency Box */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-positive-border/70 bg-positive-soft/50 px-3 py-2 text-xs text-ink-secondary">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
              <span>
                <strong className="font-semibold text-positive">
                  Data Live Terverifikasi:
                </strong>{" "}
                Diambil langsung melalui pipeline FastAPI + Supabase 4-Kamar
                (TradingView, Yahoo Finance .JK, Google Finance IDX, dan jangkar
                laporan keuangan emiten — tanpa angka simulasi).
              </span>
            </div>

            {stockWarnings.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-caution-border bg-caution-soft/60 px-3 py-2 text-xs text-caution">
                <strong className="font-semibold">Catatan Validasi:</strong>{" "}
                {stockWarnings.join(" • ")}
              </div>
            )}
          </div>

          {/* Formula & Academic Explanation */}
          <div className="space-y-3 rounded-xl border border-border-subtle bg-canvas p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-info" />
              <h4 className="text-xs font-semibold tracking-wider text-ink uppercase">
                Rumus &amp; Interpretasi Akademik
              </h4>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 font-mono text-xs text-ink">
              {row.metric.formula}
            </div>

            <p className="text-xs leading-relaxed text-ink-secondary">
              {row.metric.academicGuide}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2 py-1 text-ink-secondary">
                <Info className="h-3.5 w-3.5 text-info" />
                Acuan Sehat:{" "}
                <strong className="text-ink">{row.metric.benchmarkHint}</strong>
              </span>
              {anchor && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2 py-1 font-mono text-[11px] text-ink-secondary">
                  Sektor {activeColumn.sector}: PER{" "}
                  {anchor.sectorAvgPer != null
                    ? `${formatIdNumber(anchor.sectorAvgPer, 1)}x`
                    : "—"}{" "}
                  • PBV{" "}
                  {anchor.sectorAvgPbv != null
                    ? `${formatIdNumber(anchor.sectorAvgPbv, 1)}x`
                    : "—"}{" "}
                  • ROE {fmtOptPct(anchor.sectorAvgRoe)}
                </span>
              )}
            </div>

            {/* Extra Bank Context if inspecting a banking stock */}
            {activeColumn.kind === "stock" &&
              activeColumn.accountingType === "banking" && (
                <div className="rounded-lg border border-info-border bg-info-soft/60 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-info">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      Kesehatan Perbankan {activeColumn.ticker} (Standar OJK/BEI)
                    </span>
                  </div>
                  {hasBankMetrics && anchor?.bankHealth ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 font-sans sm:grid-cols-4 tabular-nums">
                      <div>
                        <span className="block text-[11px] text-ink-muted">CAR</span>
                        <strong className="text-ink">
                          {fmtOptPct(anchor.bankHealth.carPct)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-ink-muted">
                          NPL Gross
                        </span>
                        <strong className="text-ink">
                          {fmtOptPct(anchor.bankHealth.nplGrossPct)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-ink-muted">NIM</span>
                        <strong className="text-ink">
                          {fmtOptPct(anchor.bankHealth.nimPct)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-ink-muted">CASA</span>
                        <strong className="text-ink">
                          {fmtOptPct(anchor.bankHealth.casaPct)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary">
                      Rasio khusus OJK (CAR, NPL Gross, NIM, CASA) tidak
                      dipublikasikan melalui feed publik Yahoo/TradingView dan
                      sengaja dibiarkan kosong (zero-fake-data) hingga diimpor dari
                      laporan publikasi resmi OJK/BEI melalui{" "}
                      <code className="font-mono">bei_importer.py</code>.
                    </p>
                  )}
                </div>
              )}

            {cell.isWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-negative-border bg-negative-soft/70 px-3 py-2 text-xs text-negative">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Metrik ini memicu bendera peringatan risiko sehingga otomatis
                  didiskualifikasi dari kandidat pemenang baris.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
