import { create } from "zustand";
import {
  ALL_CATEGORY_IDS,
  METRIC_DEFINITIONS,
} from "@/lib/fundamentalEngine";
import type {
  FundamentalCategoryId,
  MetricId,
} from "@/types/fundamental";

export const MAX_STOCKS = 5;

export type MobileActiveTab = "komparasi" | "charts" | "keputusan";
export type DecisionMode = "simple" | "investor";

const DEFAULT_ACTIVE_TICKERS = ["BBCA", "ADRO", "ICBP"];
const DEFAULT_FOCUSED_TICKER = "ADRO";

const IDX_TICKER_RE = /^[A-Z]{4}$/;

/**
 * Accepts ANY valid 4-letter BEI/IDX stock code (all 841+ issuers in Supabase),
 * instead of being restricted to a hardcoded 15-stock catalog.
 */
export function sanitizeTickers(tickers: string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of tickers) {
    const code = raw.trim().toUpperCase();
    if (!code || !IDX_TICKER_RE.test(code) || seen.has(code)) continue;
    seen.add(code);
    valid.push(code);
    if (valid.length >= MAX_STOCKS) break;
  }
  return valid;
}

function reconcileMobilePin(
  nextTickers: string[],
  prevPin: string,
  prevCompareIndex: number
): { mobilePinnedTicker: string; mobileCompareIndex: number } {
  const nextPin = nextTickers.includes(prevPin)
    ? prevPin
    : (nextTickers[0] ?? DEFAULT_ACTIVE_TICKERS[0]);

  const rightCount =
    nextTickers.length === 1
      ? 2
      : Math.max(1, nextTickers.length - 1);

  const clampedIndex = Math.max(0, Math.min(prevCompareIndex, rightCount - 1));

  return {
    mobilePinnedTicker: nextPin,
    mobileCompareIndex: clampedIndex,
  };
}

interface StockStoreState {
  activeTickers: string[];
  focusedTicker: string;
  isSingleStockMode: boolean;
  mobileActiveTab: MobileActiveTab;
  decisionMode: DecisionMode;
  selectedSector: string;
  activePresetId: string | null;

  // Step 4/6 — Fundamental Matrix & Mobile Pin-Swipe State
  expandedCategories: FundamentalCategoryId[];
  hiddenMetricIds: MetricId[];
  mobilePinnedTicker: string;
  mobileCompareIndex: number;

  addStock: (ticker: string) => void;
  removeStock: (ticker: string) => void;
  swapStock: (oldTicker: string, newTicker: string) => void;
  focusSingleStock: (ticker: string) => void;
  setFocusedTicker: (ticker: string) => void;
  applyPreset: (
    tickers: string[],
    meta?: { presetId?: string | null; sectorLabel?: string }
  ) => void;
  resetComparison: () => void;
  hydrateFromUrl: (tickers: string[], focus?: string | null) => void;
  setMobileActiveTab: (tab: MobileActiveTab) => void;
  setDecisionMode: (mode: DecisionMode) => void;
  setSelectedSector: (sector: string) => void;

  toggleCategory: (categoryId: FundamentalCategoryId) => void;
  expandAllCategories: () => void;
  collapseAllCategories: () => void;
  toggleMetricVisibility: (metricId: MetricId) => void;
  setCategoryMetricsVisibility: (
    categoryId: FundamentalCategoryId,
    visible: boolean
  ) => void;
  resetMetricVisibility: () => void;
  setMobilePinnedTicker: (ticker: string) => void;
  setMobileCompareIndex: (index: number) => void;
  stepMobileCompareIndex: (delta: number) => void;
}

export const useStockStore = create<StockStoreState>((set) => ({
  activeTickers: DEFAULT_ACTIVE_TICKERS,
  focusedTicker: DEFAULT_FOCUSED_TICKER,
  isSingleStockMode: false,
  mobileActiveTab: "komparasi",
  decisionMode: "simple",
  selectedSector: "Mode Lintas Sektor",
  activePresetId: "cross-sector-default",

  expandedCategories: ["valuasi"],
  hiddenMetricIds: [],
  mobilePinnedTicker: DEFAULT_ACTIVE_TICKERS[0],
  mobileCompareIndex: 0,

  addStock: (rawTicker) =>
    set((state) => {
      const code = rawTicker.trim().toUpperCase();
      if (!IDX_TICKER_RE.test(code)) return state;

      if (state.activeTickers.includes(code)) {
        return { focusedTicker: code };
      }

      if (state.activeTickers.length >= MAX_STOCKS) return state;

      const nextTickers = [...state.activeTickers, code];
      const mobileState = reconcileMobilePin(
        nextTickers,
        state.mobilePinnedTicker,
        state.mobileCompareIndex
      );

      return {
        activeTickers: nextTickers,
        focusedTicker: code,
        isSingleStockMode: nextTickers.length === 1,
        activePresetId: null,
        ...mobileState,
      };
    }),

  removeStock: (rawTicker) =>
    set((state) => {
      if (state.activeTickers.length <= 1) return state;

      const code = rawTicker.trim().toUpperCase();
      if (!state.activeTickers.includes(code)) return state;

      const nextTickers = state.activeTickers.filter((t) => t !== code);
      const nextFocus =
        state.focusedTicker === code ? nextTickers[0] : state.focusedTicker;
      const mobileState = reconcileMobilePin(
        nextTickers,
        state.mobilePinnedTicker,
        state.mobileCompareIndex
      );

      return {
        activeTickers: nextTickers,
        focusedTicker: nextFocus,
        isSingleStockMode: nextTickers.length === 1,
        activePresetId: null,
        ...mobileState,
      };
    }),

  swapStock: (rawOld, rawNew) =>
    set((state) => {
      const oldCode = rawOld.trim().toUpperCase();
      const newCode = rawNew.trim().toUpperCase();
      if (!IDX_TICKER_RE.test(newCode)) return state;

      const idx = state.activeTickers.indexOf(oldCode);
      if (idx === -1) return state;

      if (oldCode === newCode || state.activeTickers.includes(newCode)) {
        return { focusedTicker: newCode };
      }

      const nextTickers = [...state.activeTickers];
      nextTickers[idx] = newCode;
      const desiredPin =
        state.mobilePinnedTicker === oldCode
          ? newCode
          : state.mobilePinnedTicker;
      const mobileState = reconcileMobilePin(
        nextTickers,
        desiredPin,
        state.mobileCompareIndex
      );

      return {
        activeTickers: nextTickers,
        focusedTicker: newCode,
        isSingleStockMode: nextTickers.length === 1,
        activePresetId: null,
        ...mobileState,
      };
    }),

  focusSingleStock: (rawTicker) =>
    set(() => {
      const code = rawTicker.trim().toUpperCase();
      if (!IDX_TICKER_RE.test(code)) return {};
      return {
        activeTickers: [code],
        focusedTicker: code,
        isSingleStockMode: true,
        activePresetId: null,
        mobilePinnedTicker: code,
        mobileCompareIndex: 0,
      };
    }),

  setFocusedTicker: (rawTicker) =>
    set((state) => {
      const code = rawTicker.trim().toUpperCase();
      if (!state.activeTickers.includes(code)) return state;
      if (state.focusedTicker === code) return state;
      return { focusedTicker: code };
    }),

  applyPreset: (tickers, meta) =>
    set((state) => {
      const nextTickers = sanitizeTickers(tickers);
      if (nextTickers.length === 0) return state;

      const nextFocus = nextTickers[0];
      const mobileState = reconcileMobilePin(nextTickers, nextTickers[0], 0);
      return {
        activeTickers: nextTickers,
        focusedTicker: nextFocus,
        isSingleStockMode: nextTickers.length === 1,
        selectedSector: meta?.sectorLabel ?? state.selectedSector,
        activePresetId: meta?.presetId ?? null,
        ...mobileState,
      };
    }),

  resetComparison: () =>
    set((state) => {
      const keep = state.activeTickers.includes(state.focusedTicker)
        ? state.focusedTicker
        : (state.activeTickers[0] ?? DEFAULT_FOCUSED_TICKER);

      return {
        activeTickers: [keep],
        focusedTicker: keep,
        isSingleStockMode: true,
        activePresetId: null,
        mobilePinnedTicker: keep,
        mobileCompareIndex: 0,
      };
    }),

  hydrateFromUrl: (tickers, focus) =>
    set(() => {
      const valid = sanitizeTickers(tickers);
      const finalTickers = valid.length > 0 ? valid : DEFAULT_ACTIVE_TICKERS;
      const focusCode = focus?.trim().toUpperCase() ?? "";
      const finalFocus = finalTickers.includes(focusCode)
        ? focusCode
        : finalTickers[0];
      const mobileState = reconcileMobilePin(finalTickers, finalTickers[0], 0);

      return {
        activeTickers: finalTickers,
        focusedTicker: finalFocus,
        isSingleStockMode: finalTickers.length === 1,
        activePresetId: null,
        ...mobileState,
      };
    }),

  setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),
  setDecisionMode: (mode) => set({ decisionMode: mode }),
  setSelectedSector: (sector) => set({ selectedSector: sector }),

  toggleCategory: (categoryId) =>
    set((state) => {
      const exists = state.expandedCategories.includes(categoryId);
      return {
        expandedCategories: exists
          ? state.expandedCategories.filter((id) => id !== categoryId)
          : [...state.expandedCategories, categoryId],
      };
    }),

  expandAllCategories: () => set({ expandedCategories: [...ALL_CATEGORY_IDS] }),

  collapseAllCategories: () => set({ expandedCategories: [] }),

  toggleMetricVisibility: (metricId) =>
    set((state) => {
      const isHidden = state.hiddenMetricIds.includes(metricId);
      return {
        hiddenMetricIds: isHidden
          ? state.hiddenMetricIds.filter((id) => id !== metricId)
          : [...state.hiddenMetricIds, metricId],
      };
    }),

  setCategoryMetricsVisibility: (categoryId, visible) =>
    set((state) => {
      const categoryMetricIds = METRIC_DEFINITIONS.filter(
        (m) => m.categoryId === categoryId
      ).map((m) => m.id);
      const hiddenSet = new Set(state.hiddenMetricIds);

      for (const id of categoryMetricIds) {
        if (visible) hiddenSet.delete(id);
        else hiddenSet.add(id);
      }

      return { hiddenMetricIds: Array.from(hiddenSet) };
    }),

  resetMetricVisibility: () => set({ hiddenMetricIds: [] }),

  setMobilePinnedTicker: (rawTicker) =>
    set((state) => {
      const code = rawTicker.trim().toUpperCase();
      if (!state.activeTickers.includes(code)) return state;
      if (state.mobilePinnedTicker === code) return state;
      return {
        mobilePinnedTicker: code,
        mobileCompareIndex: 0,
      };
    }),

  setMobileCompareIndex: (index) =>
    set((state) => {
      const rightCount =
        state.activeTickers.length === 1
          ? 2
          : Math.max(1, state.activeTickers.length - 1);
      const clamped = Math.max(0, Math.min(index, rightCount - 1));
      return { mobileCompareIndex: clamped };
    }),

  stepMobileCompareIndex: (delta) =>
    set((state) => {
      const rightCount =
        state.activeTickers.length === 1
          ? 2
          : Math.max(1, state.activeTickers.length - 1);
      if (rightCount <= 1) return state;
      const next = (state.mobileCompareIndex + delta + rightCount) % rightCount;
      return { mobileCompareIndex: next };
    }),
}));
