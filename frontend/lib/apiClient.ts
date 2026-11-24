/**
 * EquiLens Live Backend API Client (proxied via Next.js `/api/:path*` -> `127.0.0.1:8000`).
 * Zero Simulation Fallback: surfaces honest errors whenever the backend is unreachable.
 */

import type {
  ChartApiResponse,
  CompareApiResponse,
  FinancialsApiResponse,
  SearchStocksApiResponse,
  SourcesHealthApiResponse,
  StockPresetApiItem,
} from "@/types/fundamental";

export class ApiOfflineError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiOfflineError";
    this.status = status;
  }
}

async function fetchJson<T>(
  url: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 20000;
  const timeoutId =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  const onExternalAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onExternalAbort);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore JSON parse errors on non-JSON error responses
      }
      throw new ApiOfflineError(detail, res.status);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiOfflineError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new ApiOfflineError(
      "Backend FastAPI (port 8000) tidak merespons. Pastikan uvicorn sedang aktif."
    );
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export function fetchCompareApi(
  tickers: string[],
  forceRefresh = false,
  signal?: AbortSignal
): Promise<CompareApiResponse> {
  const clean = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  const params = new URLSearchParams({
    tickers: clean.join(","),
    force_refresh: forceRefresh ? "true" : "false",
  });
  return fetchJson<CompareApiResponse>(`/api/compare?${params.toString()}`, {
    signal,
    timeoutMs: 25000,
  });
}

export function fetchChartApi(
  ticker: string,
  timeframe: "1M" | "3M" | "1Y" | "5Y",
  compareTickers: string[] = [],
  signal?: AbortSignal
): Promise<ChartApiResponse> {
  const code = encodeURIComponent(ticker.trim().toUpperCase());
  const params = new URLSearchParams({ timeframe });
  const peers = compareTickers
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t && t !== ticker.trim().toUpperCase());
  if (peers.length > 0) {
    params.set("compare", peers.join(","));
  }
  return fetchJson<ChartApiResponse>(`/api/charts/${code}?${params.toString()}`, {
    signal,
    timeoutMs: 25000,
  });
}

export function searchStocksApi(
  query: string,
  sector = "",
  limit = 12,
  signal?: AbortSignal
): Promise<SearchStocksApiResponse> {
  const params = new URLSearchParams({
    q: query.trim(),
    sector: sector === "Semua" ? "" : sector,
    limit: String(limit),
  });
  return fetchJson<SearchStocksApiResponse>(
    `/api/stocks/search?${params.toString()}`,
    { signal, timeoutMs: 10000 }
  );
}

export async function fetchPresetsApi(
  signal?: AbortSignal
): Promise<StockPresetApiItem[]> {
  const res = await fetchJson<{ presets: StockPresetApiItem[] }>(
    "/api/stocks/presets",
    { signal, timeoutMs: 8000 }
  );
  return res.presets ?? [];
}

export function fetchFinancialsApi(
  ticker: string,
  period: "annual" | "quarterly" = "annual",
  signal?: AbortSignal
): Promise<FinancialsApiResponse> {
  const code = encodeURIComponent(ticker.trim().toUpperCase());
  return fetchJson<FinancialsApiResponse>(
    `/api/financials/${code}?period=${period}`,
    { signal, timeoutMs: 25000 }
  );
}

export function fetchSourcesHealthApi(
  signal?: AbortSignal
): Promise<SourcesHealthApiResponse> {
  return fetchJson<SourcesHealthApiResponse>("/api/sources/health", {
    signal,
    timeoutMs: 8000,
  });
}
