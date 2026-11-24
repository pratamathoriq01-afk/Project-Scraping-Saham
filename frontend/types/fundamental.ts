import type { AccountingType } from "@/data/stocksCatalog";

export type ValidationStatus =
  | "verified"
  | "minor_diff"
  | "bei_anchor"
  | "failover_active"
  | "quarantined";

export type MetricPolarity =
  | "higher_better"
  | "lower_positive_better"
  | "lower_better"
  | "optimal_dpr"
  | "neutral";

export type MetricUnit =
  | "multiple_x"
  | "percent"
  | "rupiah"
  | "billion_idr"
  | "score"
  | "years_5"
  | "price_range";

export type FundamentalCategoryId =
  | "valuasi"
  | "profitabilitas"
  | "kesehatan"
  | "aruskas"
  | "dividen"
  | "teknikal";

export type MetricId =
  | "per_ttm"
  | "pbv_current"
  | "ev_ebitda"
  | "fair_value"
  | "margin_of_safety"
  | "roe"
  | "roa"
  | "gpm"
  | "opm"
  | "npm"
  | "eps_growth"
  | "der"
  | "current_ratio"
  | "quick_ratio"
  | "interest_coverage"
  | "altman_z"
  | "zmijewski_x"
  | "ocf"
  | "fcf"
  | "capex"
  | "sgr"
  | "div_yield"
  | "dpr"
  | "div_streak"
  | "dist_ma20"
  | "dist_ma200"
  | "rsi_14"
  | "atr_pct"
  | "max_dd_1y"
  | "sr_range";

export interface TripleCheckAudit {
  tvValue: number | string | null;
  yfValue: number | string | null;
  gfValue: number | string | null;
  beiValue: number | string | null;
  finalValue?: number | string | null;
  spreadPct: number;
  status: ValidationStatus;
  lastSynced: string;
  isSimulated: boolean;
}

export interface EvaluatedCell {
  columnId: string;
  rawValue: number | null;
  formattedValue: string;
  subLabel?: string;
  isNotApplicable?: boolean;
  isWarning?: boolean;
  isWinner?: boolean;
  comparisonScore?: number | null;
  audit: TripleCheckAudit;
}

export interface BankHealthAnchor {
  carPct: number | null;
  nplGrossPct: number | null;
  nimPct: number | null;
  casaPct: number | null;
}

export interface QuarterlyAnchorData {
  ticker: string;
  fiscalPeriod: string;
  sourceType?: "BEI_VERIFIED" | "AUTO_SYNCED";
  epsTtm: number | null;
  bvps: number | null;
  netDebtPerShare: number | null;
  ebitdaPerShare: number | null;
  fairValueIntrinsic: number | null;
  roe: number | null;
  roa: number | null;
  gpm: number | null;
  opm: number | null;
  npm: number | null;
  epsGrowthYoY: number | null;
  der: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  interestCoverage: number | null;
  altmanZ: number | null;
  zmijewskiX: number | null;
  ocfBillion: number | null;
  fcfBillion: number | null;
  capexBillion: number | null;
  dps: number | null;
  dpr: number | null;
  dividendStreak5Y: number | null;
  sectorAvgPer: number | null;
  sectorAvgPbv: number | null;
  sectorAvgRoe: number | null;
  sectorAvgDer: number | null;
  bankHealth?: BankHealthAnchor | null;
}

export interface LiveTechnicalSnapshot {
  ticker: string;
  livePrice: number;
  basePrice: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number | null;
  high52w?: number | null;
  low52w?: number | null;
  ma20: number | null;
  ma200: number | null;
  rsi14: number | null;
  atrPct: number | null;
  maxDrawdown1Y: number | null;
  support1: number | null;
  resistance1: number | null;
}

export interface LiveStockItem {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  accountingType: AccountingType;
  price: number;
  change: number;
  changePercent: number;
  quantScore: number;
  verifiedSources: string[];
}

export interface PriceZonesApi {
  entryLow: number;
  entryHigh: number;
  fairValueTarget: number;
  cutLoss: number;
  upsidePct: number;
  riskPct: number;
  riskRewardRatio: number;
}

export interface DecisionProfileApi {
  ticker: string;
  verdictStatus: "AKUMULASI BERTAHAP" | "TUNGGU KOREKSI" | "WASPADA / HINDARI";
  quantScore: number;
  pillarScores?: {
    valuation: number;
    profitability: number;
    health: number;
    technical: number;
  };
  priceZones: PriceZonesApi;
  simpleNarrative: {
    reasons: string[];
    capitalSimRp: number;
    estMaxLossRp: number;
    estTargetGainRp: number;
    simSummary: string;
  };
  investorNarrative: {
    reasons: string[];
    metrics: {
      per: string;
      sectorPer: string;
      pbv: string;
      mosPct: string;
      roe: string;
      solvencyLabel: string;
      solvencyValue: string;
      priceVsMa200Pct: number;
      rsi14: number;
      atr14Pct: number;
      maxDrawdown1YPct: number;
    };
  };
  invalidationRule: string;
}

export interface BenchmarkApiData {
  label: string;
  sector?: string;
  accountingType?: AccountingType;
  periodsSampled?: number;
  per?: number | null;
  pbv?: number | null;
  evEbitda?: number | null;
  roe?: number | null;
  roa?: number | null;
  gpm?: number | null;
  opm?: number | null;
  npm?: number | null;
  epsGrowthYoY?: number | null;
  der?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  interestCoverage?: number | null;
  altmanZ?: number | null;
  zmijewskiX?: number | null;
  divYield?: number | null;
  dpr?: number | null;
  dividendStreak5Y?: number | null;
}

export interface RawMetricApiValue {
  rawValue: number | null;
  isNotApplicable?: boolean;
  isWarning?: boolean;
  support1?: number | null;
  resistance1?: number | null;
}

export interface SourceCircuitStatus {
  source: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  healthy: boolean;
  consecutive_failures: number;
  total_requests: number;
  total_failures: number;
  last_latency_ms: number;
  avg_latency_ms: number;
  cooldown_remaining_sec: number;
  last_success_at: string | null;
  last_error: string | null;
}

export interface CompareApiResponse {
  activeTickers: string[];
  isSingleStockMode: boolean;
  isCrossSector: boolean;
  stocks: LiveStockItem[];
  quarterlyAnchors: Record<string, QuarterlyAnchorData>;
  liveSnapshots: Record<string, LiveTechnicalSnapshot>;
  metrics: Record<string, Record<string, RawMetricApiValue>>;
  decisionProfiles: Record<string, DecisionProfileApi>;
  audits: Record<string, Record<string, TripleCheckAudit>>;
  sectorBenchmark: BenchmarkApiData | null;
  historical5YBenchmark: BenchmarkApiData | null;
  sectorBenchmarksByTicker: Record<string, BenchmarkApiData>;
  historical5YBenchmarksByTicker: Record<string, BenchmarkApiData>;
  dataWarnings: Record<string, string[]>;
  sourceHealth: Record<string, SourceCircuitStatus>;
  syncedAt: string;
}

export interface ChartOhlcvBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartLinePoint {
  time: string;
  value: number;
}

export interface ChartCompareSeriesApi {
  ticker: string;
  isBenchmark?: boolean;
  latestPct: number;
  points: ChartLinePoint[];
}

export interface ChartApiResponse {
  ticker: string;
  timeframe: "1M" | "3M" | "1Y" | "5Y";
  bars: ChartOhlcvBar[];
  ma20: ChartLinePoint[];
  ma200: ChartLinePoint[];
  rsi14: ChartLinePoint[];
  latestClose: number;
  latestMa20: number;
  latestMa200: number;
  latestRsi14: number;
  atr14Pct: number;
  maxDrawdown1YPct: number | null;
  priceZones: PriceZonesApi | null;
  compareSeries: ChartCompareSeriesApi[];
  includesIhsgBenchmark: boolean;
  source: string;
  dataWarnings: string[];
  syncedAt: string;
}

export interface SearchStockResultItem {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  accountingType: AccountingType;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  quantScore: number | null;
  verdictStatus: string | null;
}

export interface SearchStocksApiResponse {
  query: string;
  sector: string;
  totalMatches: number;
  totalUniverse: number;
  items: SearchStockResultItem[];
}

export interface StockPresetApiItem {
  id: string;
  title: string;
  subtitle: string;
  sectorLabel: string;
  tickers: string[];
}

export interface SourcesHealthApiResponse {
  status: string;
  masterEmitenCount: number;
  supabase: {
    healthy: boolean;
    latency_ms: number;
    master_count: number;
    mode: string;
    error: string | null;
  };
  sources: Record<string, SourceCircuitStatus>;
  syncedAt: string;
}

export interface FinancialStatementRow {
  key: string;
  label: string;
  valuesBillionIdr: (number | null)[];
  latestChangePct: number | null;
}

export interface FinancialStatementTable {
  periods: string[];
  rows: FinancialStatementRow[];
}

export interface FinancialsApiResponse {
  ticker: string;
  companyName: string;
  period: "annual" | "quarterly";
  reportingCurrency: string;
  displayCurrency: string;
  fxRateApplied: number;
  unit: string;
  incomeStatement: FinancialStatementTable;
  balanceSheet: FinancialStatementTable;
  cashFlow: FinancialStatementTable;
  source: string;
  syncedAt: string;
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  ticker: string;
  companyName: string;
  sector: string;
  priceAtAnalysis: number;
  quantScore: number;
  verdictStatus: string;
  entryLow: number;
  entryHigh: number;
  fairValueTarget: number;
  cutLoss: number;
  riskRewardRatio: number;
  styleTag: "Value" | "Growth" | "Dividend" | "Swing";
  note: string;
}

export interface MetricDefinition {
  id: MetricId;
  categoryId: FundamentalCategoryId;
  label: string;
  shortLabel: string;
  formula: string;
  academicGuide: string;
  polarity: MetricPolarity;
  unit: MetricUnit;
  isLiveReactive: boolean;
  notApplicableForBanking?: boolean;
  requirePositiveToWin?: boolean;
  benchmarkHint: string;
}

export interface CategoryDefinition {
  id: FundamentalCategoryId;
  numberLabel: string;
  title: string;
  shortTitle: string;
  description: string;
}

export type MatrixColumnKind = "stock" | "sector_avg" | "history_5y";

export interface MatrixColumnDescriptor {
  id: string;
  kind: MatrixColumnKind;
  ticker: string;
  label: string;
  subLabel: string;
  sector: string;
  accountingType: AccountingType;
  livePrice: number | null;
  changePercent: number | null;
  bankHealth?: BankHealthAnchor | null;
}

export interface EvaluatedMetricRow {
  metric: MetricDefinition;
  cells: Record<string, EvaluatedCell>;
  winnerColumnIds: string[];
  sectorBenchmarkNote: string;
}

export interface EvaluatedCategoryGroup {
  category: CategoryDefinition;
  rows: EvaluatedMetricRow[];
  totalMetricCount: number;
  visibleMetricCount: number;
  winnerColumnId: string | null;
  winnerLabel: string | null;
  winnerWinCount: number;
  winCounts: Record<string, number>;
}

export interface EvaluatedComparisonMatrix {
  isSingleStockMode: boolean;
  isCrossSector: boolean;
  columns: MatrixColumnDescriptor[];
  categories: EvaluatedCategoryGroup[];
  totalMetrics: number;
  visibleMetrics: number;
  bankingColumns: MatrixColumnDescriptor[];
  overallSummary: {
    valuasiWinner: string | null;
    profitabilitasWinner: string | null;
    kesehatanWinner: string | null;
    dividenWinner: string | null;
  };
  generatedAt: string;
}
