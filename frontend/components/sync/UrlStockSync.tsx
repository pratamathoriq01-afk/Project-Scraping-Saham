"use client";

import * as React from "react";
import { useStockStore, sanitizeTickers } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";

/**
 * Bulletproof URL Multi-Stock Sync + Live Backend Auto-Refresh (30s):
 *   1. Reads & decodes `?stocks=BBCA,ADRO,ICBP&focus=ADRO` from `window.location.search`
 *      FIRST before ever permitting `history.replaceState` writes (fixing the 1-stock reset bug).
 *   2. Zero synchronous React setState inside useEffect (100% React 19 ESLint compliant).
 *   3. Triggers `/api/compare` whenever `activeTickers` changes + gentle 30s background polling.
 *   4. Hydrates localStorage Watchlist & Journal + loads `/api/sources/health` & `/api/stocks/presets`.
 */
export function UrlStockSync() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const hydrateFromUrl = useStockStore((s) => s.hydrateFromUrl);

  const loadCompare = useMarketDataStore((s) => s.loadCompare);
  const loadSourcesHealth = useMarketDataStore((s) => s.loadSourcesHealth);
  const loadPresets = useMarketDataStore((s) => s.loadPresets);
  const hydrateUserLists = useMarketDataStore((s) => s.hydrateUserLists);

  const pendingUrlTickersRef = React.useRef<string | null>(null);
  const mountedRef = React.useRef(false);

  // 1. Hydrate URL query parameters ONCE on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const rawStocks = params.get("stocks");
    const rawFocus = params.get("focus");

    if (rawStocks) {
      let decoded = rawStocks;
      try {
        decoded = decodeURIComponent(rawStocks);
      } catch {
        decoded = rawStocks;
      }
      const parsed = sanitizeTickers(decoded.split(","));
      if (parsed.length > 0) {
        const expectedKey = parsed.join(",");
        const currentKey = useStockStore.getState().activeTickers.join(",");
        if (expectedKey !== currentKey) {
          pendingUrlTickersRef.current = expectedKey;
        }
        hydrateFromUrl(parsed, rawFocus ? rawFocus.trim().toUpperCase() : null);
      }
    }

    hydrateUserLists();
    void loadSourcesHealth();
    void loadPresets();
    mountedRef.current = true;
  }, [hydrateFromUrl, hydrateUserLists, loadSourcesHealth, loadPresets]);

  // 2. Keep URL cleanly synced + fetch live /api/compare + 30s background poll
  const tickersKey = activeTickers.join(",");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // If mount effect detected URL stocks different from store defaults, wait for the
    // hydrated render before writing URL or calling /api/compare (prevents clobbering!).
    if (
      pendingUrlTickersRef.current !== null &&
      tickersKey !== pendingUrlTickersRef.current
    ) {
      return;
    }
    pendingUrlTickersRef.current = null;

    const nextParams = new URLSearchParams(window.location.search);
    if (
      nextParams.get("stocks") !== tickersKey ||
      nextParams.get("focus") !== focusedTicker
    ) {
      nextParams.set("stocks", tickersKey);
      nextParams.set("focus", focusedTicker);
      const nextUrl = `${window.location.pathname}?${nextParams.toString()}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, [tickersKey, focusedTicker]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pendingUrlTickersRef.current !== null &&
      tickersKey !== pendingUrlTickersRef.current
    ) {
      return;
    }

    const tickersList = tickersKey.split(",").filter(Boolean);
    if (tickersList.length === 0) return;

    void loadCompare(tickersList, false);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCompare(tickersList, false);
        void loadSourcesHealth();
      }
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [tickersKey, loadCompare, loadSourcesHealth]);

  return null;
}
