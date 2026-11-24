"use client";

import * as React from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
} from "lucide-react";
import { formatPercent, formatRupiah } from "@/data/stocksCatalog";
import { fetchChartApi } from "@/lib/apiClient";
import { useStockStore } from "@/store/useStockStore";
import { useMarketDataStore } from "@/store/useMarketDataStore";
import type {
  ChartApiResponse,
  ChartOhlcvBar,
  PriceZonesApi,
} from "@/types/fundamental";
import { cn } from "@/lib/utils";

type ChartViewMode = "price-zone" | "compare-pct";
type PriceStyle = "area" | "candle";
type ChartTimeframe = "1M" | "3M" | "1Y" | "5Y";

const TIMEFRAMES: ChartTimeframe[] = ["1M", "3M", "1Y", "5Y"];

const COMPARE_PALETTE_LIGHT = [
  "#047857",
  "#1D4ED8",
  "#B45309",
  "#BE123C",
  "#6D28D9",
];

const COMPARE_PALETTE_DARK = [
  "#34D399",
  "#60A5FA",
  "#FBBF24",
  "#FB7185",
  "#A78BFA",
];

const emptySubscribe = () => () => {};

interface CrosshairPriceReadout {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

interface CompareLegendItem {
  ticker: string;
  color: string;
  isBenchmark?: boolean;
  latestPct: number;
  hoverPct: number | null;
}

function formatChartDateId(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const mIdx = Number(parts[1]) - 1;
  return `${parts[2]} ${months[mIdx] ?? parts[1]} ${parts[0]}`;
}

function formatCompactVol(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1).replace(".", ",")}K`;
  return String(vol);
}

interface ChartSurfaceProps {
  heightClass: string;
  chartData: ChartApiResponse;
  priceZones: PriceZonesApi | null;
  viewMode: ChartViewMode;
  priceStyle: PriceStyle;
  showMa: boolean;
  showRsi: boolean;
  showVolume: boolean;
  includeIhsg: boolean;
  isDark: boolean;
  onPriceReadout: (readout: CrosshairPriceReadout | null) => void;
  onCompareHover: (map: Record<string, number> | null) => void;
}

function ChartCanvas({
  heightClass,
  chartData,
  priceZones,
  viewMode,
  priceStyle,
  showMa,
  showRsi,
  showVolume,
  includeIhsg,
  isDark,
  onPriceReadout,
  onCompareHover,
}: ChartSurfaceProps) {
  const mainContainerRef = React.useRef<HTMLDivElement>(null);
  const rsiContainerRef = React.useRef<HTMLDivElement>(null);

  const onPriceReadoutRef = React.useRef(onPriceReadout);
  const onCompareHoverRef = React.useRef(onCompareHover);
  React.useEffect(() => {
    onPriceReadoutRef.current = onPriceReadout;
    onCompareHoverRef.current = onCompareHover;
  }, [onPriceReadout, onCompareHover]);

  React.useEffect(() => {
    const mainEl = mainContainerRef.current;
    if (!mainEl || chartData.bars.length === 0) return;

    const bgColor = isDark ? "#111827" : "#FFFFFF";
    const textColor = isDark ? "#94A3B8" : "#64748B";
    const gridColor = isDark
      ? "rgba(148, 163, 184, 0.08)"
      : "rgba(15, 23, 42, 0.06)";
    const borderColor = isDark ? "#1F2937" : "#E2E8F0";
    const crosshairColor = isDark ? "#475569" : "#94A3B8";
    const positiveColor = isDark ? "#34D399" : "#047857";
    const negativeColor = isDark ? "#FB7185" : "#BE123C";
    const infoColor = isDark ? "#60A5FA" : "#1D4ED8";
    const cautionColor = isDark ? "#FBBF24" : "#B45309";
    const palette = isDark ? COMPARE_PALETTE_DARK : COMPARE_PALETTE_LIGHT;

    const mainChart: IChartApi = createChart(mainEl, {
      width: Math.max(240, mainEl.clientWidth),
      height: Math.max(280, mainEl.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "var(--font-inter), Inter, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? "#1E293B" : "#0F172A",
        },
        horzLine: {
          color: crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? "#1E293B" : "#0F172A",
        },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: {
          top: 0.08,
          bottom: viewMode === "price-zone" && showVolume ? 0.24 : 0.08,
        },
      },
      timeScale: {
        borderColor,
        timeVisible: false,
        rightOffset: 6,
      },
      localization: {
        locale: "id-ID",
        priceFormatter: (price: number) => {
          if (viewMode === "compare-pct") {
            const sign = price > 0 ? "+" : "";
            return `${sign}${price.toFixed(1).replace(".", ",")}%`;
          }
          return `Rp ${Math.round(price).toLocaleString("id-ID")}`;
        },
      },
    });

    let rsiChart: IChartApi | null = null;
    const barByTime = new Map<string, ChartOhlcvBar>();
    const prevCloseByTime = new Map<string, number>();
    const compareSeriesMap = new Map<string, ISeriesApi<SeriesType>>();

    if (viewMode === "price-zone") {
      const bars = chartData.bars;
      bars.forEach((bar, i) => {
        barByTime.set(bar.time, bar);
        prevCloseByTime.set(bar.time, i > 0 ? bars[i - 1].close : bar.open);
      });

      const zoneAutoscaleProvider = (
        original: () => AutoscaleInfo | null
      ): AutoscaleInfo | null => {
        const res = original();
        if (!res || !res.priceRange || !priceZones) return res;
        const baseMin = res.priceRange.minValue;
        const baseMax = res.priceRange.maxValue;
        const targetMin = Math.min(
          baseMin,
          priceZones.cutLoss,
          priceZones.entryLow
        );
        const targetMax = Math.max(
          baseMax,
          priceZones.fairValueTarget,
          priceZones.entryHigh
        );
        const span = Math.max(targetMax - targetMin, targetMax * 0.04, 1);
        const pad = span * 0.05;
        return {
          ...res,
          priceRange: {
            minValue: Math.max(0, targetMin - pad),
            maxValue: targetMax + pad,
          },
        };
      };

      let primarySeries: ISeriesApi<SeriesType>;

      if (priceStyle === "candle") {
        const candleSeries = mainChart.addSeries(CandlestickSeries, {
          upColor: positiveColor,
          downColor: negativeColor,
          borderVisible: false,
          wickUpColor: positiveColor,
          wickDownColor: negativeColor,
          autoscaleInfoProvider: zoneAutoscaleProvider,
        });
        candleSeries.setData(
          bars.map((b) => ({
            time: b.time as Time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          }))
        );
        primarySeries = candleSeries;
      } else {
        const areaSeries = mainChart.addSeries(AreaSeries, {
          lineColor: positiveColor,
          topColor: isDark
            ? "rgba(52, 211, 153, 0.22)"
            : "rgba(4, 120, 87, 0.16)",
          bottomColor: isDark
            ? "rgba(52, 211, 153, 0.0)"
            : "rgba(4, 120, 87, 0.0)",
          lineWidth: 2,
          priceLineVisible: true,
          autoscaleInfoProvider: zoneAutoscaleProvider,
        });
        areaSeries.setData(
          bars.map((b) => ({
            time: b.time as Time,
            value: b.close,
          }))
        );
        primarySeries = areaSeries;
      }

      // Price Zone Overlays (always inside Y-axis thanks to autoscaleInfoProvider!)
      if (priceZones) {
        primarySeries.createPriceLine({
          price: priceZones.fairValueTarget,
          color: infoColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Target Wajar (${formatRupiah(priceZones.fairValueTarget)})`,
        });

        primarySeries.createPriceLine({
          price: priceZones.entryHigh,
          color: positiveColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Zona Beli Atas",
        });

        primarySeries.createPriceLine({
          price: priceZones.entryLow,
          color: positiveColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Zona Beli Bawah",
        });

        primarySeries.createPriceLine({
          price: priceZones.cutLoss,
          color: negativeColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Cut Loss (< ${formatRupiah(priceZones.cutLoss)})`,
        });
      }

      if (showVolume) {
        const volumeSeries = mainChart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "vol",
        });
        mainChart.priceScale("vol").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
          visible: false,
        });
        volumeSeries.setData(
          bars.map((b) => ({
            time: b.time as Time,
            value: b.volume,
            color:
              b.close >= b.open
                ? isDark
                  ? "rgba(52, 211, 153, 0.32)"
                  : "rgba(4, 120, 87, 0.25)"
                : isDark
                  ? "rgba(251, 113, 133, 0.32)"
                  : "rgba(190, 18, 60, 0.25)",
          }))
        );
      }

      if (showMa) {
        if (chartData.ma20.length > 0) {
          const ma20Series = mainChart.addSeries(LineSeries, {
            color: infoColor,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: "MA20",
          });
          ma20Series.setData(
            chartData.ma20.map((p) => ({ time: p.time as Time, value: p.value }))
          );
        }
        if (chartData.ma200.length > 0) {
          const ma200Series = mainChart.addSeries(LineSeries, {
            color: cautionColor,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            title: "MA200",
          });
          ma200Series.setData(
            chartData.ma200.map((p) => ({ time: p.time as Time, value: p.value }))
          );
        }
      }

      mainChart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        if (!param.time || typeof param.time !== "string") {
          onPriceReadoutRef.current(null);
          return;
        }
        const bar = barByTime.get(param.time);
        if (!bar) {
          onPriceReadoutRef.current(null);
          return;
        }
        const prev = prevCloseByTime.get(param.time) ?? bar.open;
        const changePct = prev > 0 ? ((bar.close - prev) / prev) * 100 : 0;
        onPriceReadoutRef.current({
          date: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          changePct,
        });
      });

      if (showRsi && rsiContainerRef.current && chartData.rsi14.length > 0) {
        const rsiEl = rsiContainerRef.current;
        rsiChart = createChart(rsiEl, {
          width: Math.max(240, rsiEl.clientWidth),
          height: 112,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor,
            fontFamily: "var(--font-inter), Inter, sans-serif",
            fontSize: 10,
            attributionLogo: false,
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor },
          },
          rightPriceScale: {
            borderColor,
            scaleMargins: { top: 0.12, bottom: 0.12 },
          },
          timeScale: {
            borderColor,
            visible: false,
            rightOffset: 6,
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
        });

        const rsiSeries = rsiChart.addSeries(LineSeries, {
          color: isDark ? "#A78BFA" : "#6D28D9",
          lineWidth: 2,
          priceLineVisible: false,
          title: "RSI (14)",
        });
        rsiSeries.setData(
          chartData.rsi14.map((p) => ({ time: p.time as Time, value: p.value }))
        );
        rsiSeries.createPriceLine({
          price: 70,
          color: negativeColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "70",
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: positiveColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "30",
        });

        let syncing = false;
        mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (syncing || !range || !rsiChart) return;
          syncing = true;
          rsiChart.timeScale().setVisibleLogicalRange(range);
          syncing = false;
        });
        rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (syncing || !range) return;
          syncing = true;
          mainChart.timeScale().setVisibleLogicalRange(range);
          syncing = false;
        });
      }
    } else {
      // Compare % Mode (rebased 0% across active peers or auto vs IHSG)
      let colorIdx = 0;
      const visibleSeries = chartData.compareSeries.filter(
        (s) => !s.isBenchmark || includeIhsg || chartData.includesIhsgBenchmark
      );

      visibleSeries.forEach((entry, idx) => {
        if (entry.points.length === 0) return;
        const isBench = Boolean(entry.isBenchmark);
        const color = isBench
          ? isDark
            ? "#94A3B8"
            : "#475569"
          : palette[colorIdx++ % palette.length];

        const lineSeries = mainChart.addSeries(LineSeries, {
          color,
          lineWidth: isBench ? 2 : entry.ticker === chartData.ticker ? 3 : 2,
          lineStyle: isBench ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: true,
          title: entry.ticker,
        });
        lineSeries.setData(
          entry.points.map((p) => ({ time: p.time as Time, value: p.value }))
        );
        if (idx === 0) {
          lineSeries.createPriceLine({
            price: 0,
            color: borderColor,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: "0%",
          });
        }
        compareSeriesMap.set(entry.ticker, lineSeries);
      });

      mainChart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
        if (!param.time) {
          onCompareHoverRef.current(null);
          return;
        }
        const map: Record<string, number> = {};
        compareSeriesMap.forEach((s, ticker) => {
          const pt = param.seriesData.get(s) as { value?: number } | undefined;
          if (pt && typeof pt.value === "number") {
            map[ticker] = pt.value;
          }
        });
        onCompareHoverRef.current(Object.keys(map).length > 0 ? map : null);
      });
    }

    mainChart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0 && h > 0) {
          mainChart.applyOptions({ width: w, height: h });
          if (rsiChart) rsiChart.applyOptions({ width: w });
        }
      }
    });
    ro.observe(mainEl);

    return () => {
      ro.disconnect();
      if (rsiChart) rsiChart.remove();
      mainChart.remove();
    };
  }, [
    chartData,
    priceZones,
    viewMode,
    priceStyle,
    showMa,
    showRsi,
    showVolume,
    includeIhsg,
    isDark,
  ]);

  return (
    <div className="flex flex-1 flex-col space-y-2">
      <div
        ref={mainContainerRef}
        className={cn("w-full flex-1 select-none", heightClass)}
      />
      {viewMode === "price-zone" && showRsi && (
        <div className="rounded-xl border border-border-subtle bg-canvas/50 pt-1.5">
          <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-medium text-ink-muted">
            <span className="font-mono font-semibold text-ink-secondary">
              RSI (14) • Wilder
            </span>
            <span className="font-mono">Overbought 70 • Oversold 30</span>
          </div>
          <div ref={rsiContainerRef} className="h-[112px] w-full select-none" />
        </div>
      )}
    </div>
  );
}

export function InteractiveCharts() {
  const activeTickers = useStockStore((s) => s.activeTickers);
  const focusedTicker = useStockStore((s) => s.focusedTicker);
  const isSingleStockMode = useStockStore((s) => s.isSingleStockMode);
  const compareData = useMarketDataStore((s) => s.compareData);

  const { resolvedTheme } = useTheme();
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isDark = isMounted && resolvedTheme === "dark";

  const [viewMode, setViewMode] = React.useState<ChartViewMode>("price-zone");
  const [timeframe, setTimeframe] = React.useState<ChartTimeframe>("1Y");
  const [priceStyle, setPriceStyle] = React.useState<PriceStyle>("candle");
  const [showMa, setShowMa] = React.useState(false);
  const [showRsi, setShowRsi] = React.useState(false);
  const [showVolume, setShowVolume] = React.useState(false);
  const [includeIhsg, setIncludeIhsg] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const [chartState, setChartState] = React.useState<{
    data: ChartApiResponse | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  const [hoverPriceState, setHoverPriceState] = React.useState<{
    key: string;
    value: CrosshairPriceReadout;
  } | null>(null);
  const [hoverCompareState, setHoverCompareState] = React.useState<{
    key: string;
    value: Record<string, number>;
  } | null>(null);

  const peersKey = activeTickers
    .filter((t) => t !== focusedTicker)
    .join(",");

  // Fetch 100% real OHLCV + stitched live candle from FastAPI /api/charts/{ticker}
  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const peers = peersKey ? peersKey.split(",") : [];

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setChartState((prev) => ({
        data: prev.data?.ticker === focusedTicker ? prev.data : null,
        loading: true,
        error: null,
      }));

      try {
        const res = await fetchChartApi(
          focusedTicker,
          timeframe,
          peers,
          controller.signal
        );
        if (cancelled) return;
        setChartState({ data: res, loading: false, error: null });
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setChartState({
          data: null,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Gagal memuat grafik live dari backend.",
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [focusedTicker, timeframe, peersKey, reloadNonce]);

  React.useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const contextKey = `${focusedTicker}|${viewMode}|${timeframe}|${peersKey}`;
  const priceReadout =
    hoverPriceState?.key === contextKey ? hoverPriceState.value : null;
  const compareHover =
    hoverCompareState?.key === contextKey ? hoverCompareState.value : null;

  const handlePriceReadout = React.useCallback(
    (readout: CrosshairPriceReadout | null) => {
      setHoverPriceState(readout ? { key: contextKey, value: readout } : null);
    },
    [contextKey]
  );

  const handleCompareHover = React.useCallback(
    (map: Record<string, number> | null) => {
      setHoverCompareState(map ? { key: contextKey, value: map } : null);
    },
    [contextKey]
  );

  const focusedStock = compareData?.stocks?.find(
    (s) => s.ticker === focusedTicker
  );
  const priceZones =
    compareData?.decisionProfiles?.[focusedTicker]?.priceZones ??
    chartState.data?.priceZones ??
    null;

  const defaultReadout: CrosshairPriceReadout | null = React.useMemo(() => {
    const bars = chartState.data?.bars;
    if (!bars || bars.length === 0) return null;
    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2].close : last.open;
    const changePct = prev > 0 ? ((last.close - prev) / prev) * 100 : 0;
    return {
      date: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      changePct,
    };
  }, [chartState.data]);

  const activeReadout = priceReadout ?? defaultReadout;

  const compareLegend: CompareLegendItem[] = React.useMemo(() => {
    if (!chartState.data) return [];
    const palette = isDark ? COMPARE_PALETTE_DARK : COMPARE_PALETTE_LIGHT;
    let colorIdx = 0;
    return chartState.data.compareSeries
      .filter(
        (s) =>
          !s.isBenchmark || includeIhsg || chartState.data?.includesIhsgBenchmark
      )
      .map((s) => ({
        ticker: s.ticker,
        color: s.isBenchmark
          ? isDark
            ? "#94A3B8"
            : "#475569"
          : palette[colorIdx++ % palette.length],
        isBenchmark: s.isBenchmark,
        latestPct: s.latestPct,
        hoverPct: compareHover?.[s.ticker] ?? null,
      }));
  }, [chartState.data, isDark, includeIhsg, compareHover]);

  const renderControls = (compact = false) => (
    <div className="space-y-3">
      {/* Row 1: Stock Price Readout + View Mode Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-base font-bold tracking-tight text-ink">
              {focusedTicker}
            </span>
            {focusedStock && (
              <span className="truncate text-xs text-ink-muted">
                {focusedStock.name}
              </span>
            )}
          </div>

          {viewMode === "price-zone" && activeReadout ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-sans text-xl font-bold tracking-tight text-ink tabular-nums sm:text-2xl">
                {formatRupiah(activeReadout.close)}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                  activeReadout.changePct >= 0
                    ? "border-positive-border bg-positive-soft text-positive"
                    : "border-negative-border bg-negative-soft text-negative"
                )}
              >
                {formatPercent(activeReadout.changePct)}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                {formatChartDateId(activeReadout.date)} • O{" "}
                {activeReadout.open.toLocaleString("id-ID")} H{" "}
                {activeReadout.high.toLocaleString("id-ID")} L{" "}
                {activeReadout.low.toLocaleString("id-ID")} • Vol{" "}
                {formatCompactVol(activeReadout.volume)}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">
              {isSingleStockMode
                ? `Performa relatif ${focusedTicker} melawan indeks acuan IHSG (rebased 0% per ${timeframe}).`
                : `Performa kumulatif ${activeTickers.length} emiten aktif (rebased 0% pada awal periode ${timeframe}).`}
            </p>
          )}
        </div>

        {/* Mode Switcher: Zona Harga | Bandingkan % */}
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Mode tampilan grafik"
            className="inline-flex rounded-lg border border-border-subtle bg-elevated p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "price-zone"}
              onClick={() => setViewMode("price-zone")}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap",
                viewMode === "price-zone"
                  ? "bg-surface font-semibold text-ink shadow-xs"
                  : "font-medium text-ink-muted hover:text-ink"
              )}
            >
              Zona Harga
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "compare-pct"}
              onClick={() => setViewMode("compare-pct")}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap",
                viewMode === "compare-pct"
                  ? "bg-surface font-semibold text-ink shadow-xs"
                  : "font-medium text-ink-muted hover:text-ink"
              )}
            >
              Bandingkan %
            </button>
          </div>

          {!compact && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Buka grafik layar penuh"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-elevated hover:text-ink lg:hidden"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Penuh</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Timeframes + Style Toggle + Optional Indicator Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border-subtle py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-border-subtle bg-canvas p-0.5">
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "min-w-[36px] rounded-md px-2 py-1 font-mono text-xs transition-colors",
                    active
                      ? "bg-cta font-semibold text-cta-fg"
                      : "font-medium text-ink-muted hover:text-ink"
                  )}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {viewMode === "price-zone" && (
            <div className="inline-flex rounded-lg border border-border-subtle bg-canvas p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPriceStyle("area")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  priceStyle === "area"
                    ? "bg-elevated font-semibold text-ink"
                    : "font-medium text-ink-muted hover:text-ink"
                )}
              >
                Area
              </button>
              <button
                type="button"
                onClick={() => setPriceStyle("candle")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  priceStyle === "candle"
                    ? "bg-elevated font-semibold text-ink"
                    : "font-medium text-ink-muted hover:text-ink"
                )}
              >
                Candle
              </button>
            </div>
          )}
        </div>

        {viewMode === "price-zone" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: "+ MA", active: showMa, toggle: () => setShowMa((v) => !v) },
              { label: "+ RSI", active: showRsi, toggle: () => setShowRsi((v) => !v) },
              { label: "+ Volume", active: showVolume, toggle: () => setShowVolume((v) => !v) },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={chip.active}
                onClick={chip.toggle}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap",
                  chip.active
                    ? "border-info-border bg-info-soft text-info"
                    : "border-border-subtle bg-surface text-ink-muted hover:border-border-strong hover:text-ink"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {!isSingleStockMode && (
              <button
                type="button"
                aria-pressed={includeIhsg}
                onClick={() => setIncludeIhsg((v) => !v)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                  includeIhsg
                    ? "border-border-strong bg-elevated text-ink"
                    : "border-border-subtle bg-surface text-ink-muted hover:text-ink"
                )}
              >
                + IHSG
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mode Legends */}
      {viewMode === "compare-pct" && compareLegend.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {compareLegend.map((item) => {
            const val = item.hoverPct ?? item.latestPct;
            return (
              <span
                key={item.ticker}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-canvas px-2 py-1 text-xs tabular-nums"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-mono font-semibold text-ink">
                  {item.ticker}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    val >= 0 ? "text-positive" : "text-negative"
                  )}
                >
                  {formatPercent(val)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {viewMode === "price-zone" && priceZones && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-info" />
            Target Wajar:{" "}
            <strong className="font-semibold text-ink">
              {formatRupiah(priceZones.fairValueTarget)}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-positive" />
            Zona Cicil:{" "}
            <strong className="font-semibold text-ink">
              {formatRupiah(priceZones.entryLow)}–
              {priceZones.entryHigh.toLocaleString("id-ID")}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-negative" />
            Cut Loss:{" "}
            <strong className="font-semibold text-negative">
              &lt; {formatRupiah(priceZones.cutLoss)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-1 flex-col rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 md:p-6">
        {renderControls(false)}

        <div className="mt-3 flex flex-1 flex-col">
          {chartState.error && !chartState.data ? (
            <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center rounded-xl border border-negative-border bg-negative-soft/40 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-negative" />
              <p className="mt-2 text-sm font-semibold text-ink">
                Grafik Live Belum Tersedia
              </p>
              <p className="mt-1 max-w-md text-xs text-ink-secondary">
                {chartState.error}
              </p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-cta px-3 text-xs font-semibold text-cta-fg"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Muat Ulang Grafik</span>
              </button>
            </div>
          ) : !chartState.data ? (
            <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-border-subtle bg-canvas/60 text-xs text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
              <span>Menarik histori OHLCV live {focusedTicker} ({timeframe})...</span>
            </div>
          ) : (
            <div className="relative flex flex-1 flex-col">
              {chartState.loading && (
                <div className="pointer-events-none absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface/90 px-2 py-1 text-[11px] font-medium text-ink-secondary shadow-xs backdrop-blur-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Sinkronisasi...</span>
                </div>
              )}
              <ChartCanvas
                heightClass="min-h-[360px] sm:min-h-[400px] lg:min-h-[420px]"
                chartData={chartState.data}
                priceZones={priceZones}
                viewMode={viewMode}
                priceStyle={priceStyle}
                showMa={showMa}
                showRsi={showRsi}
                showVolume={showVolume}
                includeIhsg={includeIhsg}
                isDark={isDark}
                onPriceReadout={handlePriceReadout}
                onCompareHover={handleCompareHover}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Fullscreen Modal */}
      {isFullscreen && chartState.data && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Grafik layar penuh ${focusedTicker}`}
          className="fixed inset-0 z-50 flex flex-col bg-surface p-4"
        >
          <div className="mb-3 flex items-center justify-between border-b border-border-subtle pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">
                {focusedTicker}
              </span>
              <span className="text-xs text-ink-muted">Mode Layar Penuh</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-elevated px-3 text-xs font-semibold text-ink"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Tutup</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {renderControls(true)}
          <div className="mt-3 flex flex-1 flex-col overflow-hidden">
            <ChartCanvas
              heightClass="h-[calc(100vh-270px)] min-h-[300px]"
              chartData={chartState.data}
              priceZones={priceZones}
              viewMode={viewMode}
              priceStyle={priceStyle}
              showMa={showMa}
              showRsi={showRsi}
              showVolume={showVolume}
              includeIhsg={includeIhsg}
              isDark={isDark}
              onPriceReadout={handlePriceReadout}
              onCompareHover={handleCompareHover}
            />
          </div>
        </div>
      )}
    </>
  );
}
