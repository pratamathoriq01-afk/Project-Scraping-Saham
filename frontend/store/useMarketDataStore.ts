import { create } from "zustand";
import {
  fetchCompareApi,
  fetchPresetsApi,
  fetchSourcesHealthApi,
} from "@/lib/apiClient";
import type {
  CompareApiResponse,
  JournalEntry,
  SourcesHealthApiResponse,
  StockPresetApiItem,
} from "@/types/fundamental";

const WATCHLIST_STORAGE_KEY = "equilens_watchlist_v1";
const JOURNAL_STORAGE_KEY = "equilens_journal_v1";
const DEFAULT_WATCHLIST = ["BBCA", "BMRI", "ADRO", "ICBP", "TLKM"];

let latestCompareReqId = 0;

interface MarketDataState {
  compareData: CompareApiResponse | null;
  compareLoading: boolean;
  compareRefreshing: boolean;
  compareError: string | null;

  sourcesHealth: SourcesHealthApiResponse | null;
  backendOnline: boolean | null;

  presets: StockPresetApiItem[];

  // Local user-persisted Watchlist & Decision Journal
  watchlistTickers: string[];
  journalEntries: JournalEntry[];
  userListsHydrated: boolean;

  loadCompare: (tickers: string[], forceRefresh?: boolean) => Promise<void>;
  loadSourcesHealth: () => Promise<void>;
  loadPresets: () => Promise<void>;

  hydrateUserLists: () => void;
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  removeJournalEntry: (id: string) => void;
}

function saveLocalJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  compareData: null,
  compareLoading: true,
  compareRefreshing: false,
  compareError: null,

  sourcesHealth: null,
  backendOnline: null,
  presets: [],

  watchlistTickers: DEFAULT_WATCHLIST,
  journalEntries: [],
  userListsHydrated: false,

  loadCompare: async (tickers, forceRefresh = false) => {
    const clean = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (clean.length === 0) return;

    const reqId = ++latestCompareReqId;
    const hasExisting = get().compareData !== null;

    set({
      compareLoading: !hasExisting,
      compareRefreshing: hasExisting,
      compareError: null,
    });

    try {
      const data = await fetchCompareApi(clean, forceRefresh);
      if (reqId !== latestCompareReqId) return;
      set({
        compareData: data,
        compareLoading: false,
        compareRefreshing: false,
        compareError: null,
        backendOnline: true,
      });
    } catch (err) {
      if (reqId !== latestCompareReqId) return;
      if (err instanceof Error && err.name === "AbortError") return;
      const message =
        err instanceof Error
          ? err.message
          : "Gagal terhubung ke backend live EquiLens (port 8000).";
      set({
        compareLoading: false,
        compareRefreshing: false,
        compareError: message,
        backendOnline: false,
      });
    }
  },

  loadSourcesHealth: async () => {
    try {
      const health = await fetchSourcesHealthApi();
      set({
        sourcesHealth: health,
        backendOnline: true,
      });
    } catch {
      set({
        backendOnline: false,
      });
    }
  },

  loadPresets: async () => {
    try {
      const presets = await fetchPresetsApi();
      if (presets.length > 0) {
        set({ presets });
      }
    } catch {
      // handled transparently by backendOnline indicator
    }
  },

  hydrateUserLists: () => {
    if (typeof window === "undefined" || get().userListsHydrated) return;
    let nextWatchlist = DEFAULT_WATCHLIST;
    let nextJournal: JournalEntry[] = [];

    try {
      const rawWl = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (rawWl) {
        const parsed = JSON.parse(rawWl) as unknown;
        if (Array.isArray(parsed)) {
          const clean = parsed
            .map((x) => String(x).trim().toUpperCase())
            .filter((x) => /^[A-Z]{4}$/.test(x));
          if (clean.length > 0) nextWatchlist = Array.from(new Set(clean));
        }
      }
    } catch {
      // ignore corrupted storage
    }

    try {
      const rawJ = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
      if (rawJ) {
        const parsed = JSON.parse(rawJ) as unknown;
        if (Array.isArray(parsed)) {
          nextJournal = parsed as JournalEntry[];
        }
      }
    } catch {
      // ignore corrupted storage
    }

    set({
      watchlistTickers: nextWatchlist,
      journalEntries: nextJournal,
      userListsHydrated: true,
    });
  },

  addToWatchlist: (rawTicker) => {
    const code = rawTicker.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) return;
    const prev = get().watchlistTickers;
    if (prev.includes(code)) return;
    const next = [code, ...prev].slice(0, 20);
    saveLocalJson(WATCHLIST_STORAGE_KEY, next);
    set({ watchlistTickers: next });
  },

  removeFromWatchlist: (rawTicker) => {
    const code = rawTicker.trim().toUpperCase();
    const next = get().watchlistTickers.filter((t) => t !== code);
    saveLocalJson(WATCHLIST_STORAGE_KEY, next);
    set({ watchlistTickers: next });
  },

  addJournalEntry: (entry) => {
    const next = [entry, ...get().journalEntries].slice(0, 100);
    saveLocalJson(JOURNAL_STORAGE_KEY, next);
    set({ journalEntries: next });
  },

  removeJournalEntry: (id) => {
    const next = get().journalEntries.filter((item) => item.id !== id);
    saveLocalJson(JOURNAL_STORAGE_KEY, next);
    set({ journalEntries: next });
  },
}));
