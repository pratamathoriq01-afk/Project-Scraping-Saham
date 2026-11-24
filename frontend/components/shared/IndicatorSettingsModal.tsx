"use client";

import * as React from "react";
import { Check, RotateCcw, SlidersHorizontal, X, Zap } from "lucide-react";
import {
  CATEGORY_DEFINITIONS,
  METRIC_DEFINITIONS,
} from "@/lib/fundamentalEngine";
import { useStockStore } from "@/store/useStockStore";
import { cn } from "@/lib/utils";

interface IndicatorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IndicatorSettingsModal({
  isOpen,
  onClose,
}: IndicatorSettingsModalProps) {
  const hiddenMetricIds = useStockStore((s) => s.hiddenMetricIds);
  const toggleMetricVisibility = useStockStore((s) => s.toggleMetricVisibility);
  const setCategoryMetricsVisibility = useStockStore(
    (s) => s.setCategoryMetricsVisibility
  );
  const resetMetricVisibility = useStockStore((s) => s.resetMetricVisibility);

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

  if (!isOpen) return null;

  const hiddenSet = new Set(hiddenMetricIds);
  const totalMetrics = METRIC_DEFINITIONS.length;
  const activeCount = totalMetrics - hiddenMetricIds.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicator-settings-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <h3
                id="indicator-settings-title"
                className="font-display text-base font-bold tracking-tight text-ink sm:text-lg"
              >
                Atur Indikator Matriks
              </h3>
              <p className="text-xs text-ink-muted">
                Centang metrik fundamental &amp; teknikal yang ingin ditampilkan
                ({activeCount}/{totalMetrics} aktif)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan indikator"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-canvas text-ink-secondary transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable 6-Category Checklists */}
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {CATEGORY_DEFINITIONS.map((category) => {
            const items = METRIC_DEFINITIONS.filter(
              (m) => m.categoryId === category.id
            );
            const visibleInCat = items.filter((m) => !hiddenSet.has(m.id)).length;
            const allVisible = visibleInCat === items.length;

            return (
              <div
                key={category.id}
                className="rounded-xl border border-border-subtle bg-canvas p-3.5"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-secondary">
                      {category.numberLabel}
                    </span>
                    <h4 className="text-xs font-bold text-ink sm:text-sm">
                      {category.title}
                    </h4>
                    <span className="font-mono text-[11px] text-ink-muted">
                      ({visibleInCat}/{items.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCategoryMetricsVisibility(category.id, !allVisible)
                    }
                    className="rounded-md border border-border-subtle bg-surface px-2 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
                  >
                    {allVisible ? "Sembunyikan Grup" : "Pilih Semua"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map((metric) => {
                    const isChecked = !hiddenSet.has(metric.id);
                    return (
                      <button
                        key={metric.id}
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => toggleMetricVisibility(metric.id)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                          isChecked
                            ? "border-border-strong bg-surface text-ink"
                            : "border-border-subtle bg-elevated/40 text-ink-muted hover:bg-surface/70"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                              isChecked
                                ? "border-cta bg-cta text-cta-fg"
                                : "border-border-strong bg-surface"
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span className="truncate text-xs font-medium">
                            {metric.label}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {metric.isLiveReactive && (
                            <span
                              title="Dihitung ulang otomatis saat harga live berubah"
                              className="inline-flex items-center rounded bg-info-soft px-1 py-0.5 text-[10px] font-semibold text-info"
                            >
                              <Zap className="h-2.5 w-2.5" />
                            </span>
                          )}
                          {metric.notApplicableForBanking && (
                            <span
                              title="Otomatis N/A (Bank) untuk emiten perbankan"
                              className="rounded bg-elevated px-1 py-0.5 font-mono text-[10px] text-ink-muted"
                            >
                              Non-Bank
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-canvas/80 px-5 py-3.5">
          <button
            type="button"
            onClick={resetMetricVisibility}
            disabled={hiddenMetricIds.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Tampilkan Semua ({totalMetrics})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg bg-cta px-4 text-xs font-semibold text-cta-fg transition-colors hover:bg-cta-hover"
          >
            Terapkan &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
