export type AccountingType = "banking" | "commodity" | "general";

export type DataSourceCode = "TV" | "YF" | "GF" | "BEI";

export type StockSector =
  | "Perbankan"
  | "Energi & Tambang"
  | "Consumer Non-Cyclicals"
  | "Infrastruktur & Otomotif";

export type DrawerSectorFilter =
  | "Perbankan"
  | "Energi & Tambang"
  | "Consumer Non-Cyclicals"
  | "Infrastruktur & Otomotif"
  | "Properti"
  | "Mode Lintas Sektor";

export interface StockItem {
  ticker: string;
  name: string;
  sector: StockSector;
  subsector: string;
  accountingType: AccountingType;
  price: number;
  change: number;
  changePercent: number;
  quantScore: number;
  verifiedSources: DataSourceCode[];
}

export interface ComparisonPreset {
  id: string;
  title: string;
  subtitle: string;
  sectorLabel: DrawerSectorFilter;
  tickers: string[];
}

export const STOCK_SECTORS: StockSector[] = [
  "Perbankan",
  "Energi & Tambang",
  "Consumer Non-Cyclicals",
  "Infrastruktur & Otomotif",
];

export const ACCOUNTING_TYPE_META: Record<
  AccountingType,
  { shortLabel: string; metricsHint: string }
> = {
  banking: {
    shortLabel: "Bank",
    metricsHint: "CAR • NPL • NIM • CASA",
  },
  commodity: {
    shortLabel: "Komoditas",
    metricsHint: "DER • FCF • Strip/Cycle",
  },
  general: {
    shortLabel: "Korporasi",
    metricsHint: "DER • ICR • Current Ratio",
  },
};

export const STOCK_CATALOG: StockItem[] = [
  // Perbankan (banking)
  {
    ticker: "BBCA",
    name: "Bank Central Asia Tbk",
    sector: "Perbankan",
    subsector: "Bank Swasta Utama",
    accountingType: "banking",
    price: 10200,
    change: 100,
    changePercent: 1.0,
    quantScore: 86,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "BMRI",
    name: "Bank Mandiri (Persero) Tbk",
    sector: "Perbankan",
    subsector: "Bank BUMN KBMI 4",
    accountingType: "banking",
    price: 6850,
    change: 95,
    changePercent: 1.4,
    quantScore: 85,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "BBRI",
    name: "Bank Rakyat Indonesia (Persero) Tbk",
    sector: "Perbankan",
    subsector: "Bank Mikro & UMKM",
    accountingType: "banking",
    price: 4780,
    change: -40,
    changePercent: -0.8,
    quantScore: 80,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "BBNI",
    name: "Bank Negara Indonesia (Persero) Tbk",
    sector: "Perbankan",
    subsector: "Bank Korporasi BUMN",
    accountingType: "banking",
    price: 5325,
    change: 25,
    changePercent: 0.5,
    quantScore: 81,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },

  // Energi & Tambang (commodity)
  {
    ticker: "ADRO",
    name: "Alamtri Resources Indonesia Tbk",
    sector: "Energi & Tambang",
    subsector: "Batu Bara & Transisi Energi",
    accountingType: "commodity",
    price: 3650,
    change: -18,
    changePercent: -0.5,
    quantScore: 84,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "PTBA",
    name: "Bukit Asam Tbk",
    sector: "Energi & Tambang",
    subsector: "Pertambangan Batu Bara",
    accountingType: "commodity",
    price: 2890,
    change: 10,
    changePercent: 0.3,
    quantScore: 79,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "ITMG",
    name: "Indo Tambangraya Megah Tbk",
    sector: "Energi & Tambang",
    subsector: "Batu Bara Kalori Tinggi",
    accountingType: "commodity",
    price: 26400,
    change: 225,
    changePercent: 0.9,
    quantScore: 82,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "ANTM",
    name: "Aneka Tambang Tbk",
    sector: "Energi & Tambang",
    subsector: "Logam Emas & Nikel",
    accountingType: "commodity",
    price: 1585,
    change: -25,
    changePercent: -1.6,
    quantScore: 74,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },

  // Consumer Non-Cyclicals (general)
  {
    ticker: "ICBP",
    name: "Indofood CBP Sukses Makmur Tbk",
    sector: "Consumer Non-Cyclicals",
    subsector: "Makanan & Minuman Olahan",
    accountingType: "general",
    price: 11450,
    change: 50,
    changePercent: 0.4,
    quantScore: 78,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "INDF",
    name: "Indofood Sukses Makmur Tbk",
    sector: "Consumer Non-Cyclicals",
    subsector: "Konglomerasi Pangan Terintegrasi",
    accountingType: "general",
    price: 7625,
    change: 50,
    changePercent: 0.7,
    quantScore: 79,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "UNVR",
    name: "Unilever Indonesia Tbk",
    sector: "Consumer Non-Cyclicals",
    subsector: "Produk Rumah Tangga & Perawatan",
    accountingType: "general",
    price: 1845,
    change: -20,
    changePercent: -1.1,
    quantScore: 66,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "MYOR",
    name: "Mayora Indah Tbk",
    sector: "Consumer Non-Cyclicals",
    subsector: "Makanan Ringan & Ekspor",
    accountingType: "general",
    price: 2540,
    change: -10,
    changePercent: -0.4,
    quantScore: 77,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },

  // Infrastruktur & Otomotif (general)
  {
    ticker: "TLKM",
    name: "Telkom Indonesia (Persero) Tbk",
    sector: "Infrastruktur & Otomotif",
    subsector: "Telekomunikasi & Data Center",
    accountingType: "general",
    price: 2980,
    change: 30,
    changePercent: 1.0,
    quantScore: 81,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "ISAT",
    name: "Indosat Ooredoo Hutchison Tbk",
    sector: "Infrastruktur & Otomotif",
    subsector: "Operator Seluler & AI Cloud",
    accountingType: "general",
    price: 2490,
    change: 40,
    changePercent: 1.6,
    quantScore: 80,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
  {
    ticker: "ASII",
    name: "Astra International Tbk",
    sector: "Infrastruktur & Otomotif",
    subsector: "Otomotif, Alat Berat & Jasa Keuangan",
    accountingType: "general",
    price: 5175,
    change: -25,
    changePercent: -0.5,
    quantScore: 83,
    verifiedSources: ["TV", "YF", "GF", "BEI"],
  },
];

export const STOCK_MAP: Record<string, StockItem> = Object.fromEntries(
  STOCK_CATALOG.map((item) => [item.ticker, item])
);

export const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    id: "big4-perbankan",
    title: "Big 4 Perbankan",
    subtitle: "BBCA • BMRI • BBRI • BBNI",
    sectorLabel: "Perbankan",
    tickers: ["BBCA", "BMRI", "BBRI", "BBNI"],
  },
  {
    id: "pemimpin-batubara",
    title: "Pemimpin Batu Bara",
    subtitle: "ADRO • ITMG • PTBA",
    sectorLabel: "Energi & Tambang",
    tickers: ["ADRO", "ITMG", "PTBA"],
  },
  {
    id: "defensive-consumer",
    title: "Defensive Consumer",
    subtitle: "ICBP • INDF • MYOR",
    sectorLabel: "Consumer Non-Cyclicals",
    tickers: ["ICBP", "INDF", "MYOR"],
  },
  {
    id: "infra-otomotif",
    title: "Infrastruktur & Otomotif",
    subtitle: "TLKM • ISAT • ASII",
    sectorLabel: "Infrastruktur & Otomotif",
    tickers: ["TLKM", "ISAT", "ASII"],
  },
  {
    id: "cross-sector-default",
    title: "Lintas Sektor (Default)",
    subtitle: "BBCA • ADRO • ICBP",
    sectorLabel: "Mode Lintas Sektor",
    tickers: ["BBCA", "ADRO", "ICBP"],
  },
];

export function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

export function formatSignedChange(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("id-ID")}`;
}

/**
 * Smart ranked stock search designed to scale cleanly to 940+ IDX tickers:
 * 1. Exact ticker match -> 2. Prefix ticker match -> 3. Company name / subsector match.
 */
export function searchStockCatalog(
  query: string,
  sectorFilter: "Semua" | StockSector,
  limit: number
): { items: StockItem[]; totalMatches: number } {
  const q = query.trim().toLowerCase();
  const pool =
    sectorFilter === "Semua"
      ? STOCK_CATALOG
      : STOCK_CATALOG.filter((s) => s.sector === sectorFilter);

  if (!q) {
    const sorted = [...pool].sort((a, b) => b.quantScore - a.quantScore);
    return { items: sorted.slice(0, limit), totalMatches: sorted.length };
  }

  const scored = pool
    .map((stock) => {
      const ticker = stock.ticker.toLowerCase();
      const name = stock.name.toLowerCase();
      const subsector = stock.subsector.toLowerCase();
      const sector = stock.sector.toLowerCase();

      let rank = 0;
      if (ticker === q) rank = 100;
      else if (ticker.startsWith(q)) rank = 80;
      else if (ticker.includes(q)) rank = 60;
      else if (name.startsWith(q)) rank = 50;
      else if (name.includes(q)) rank = 40;
      else if (subsector.includes(q) || sector.includes(q)) rank = 25;

      return { stock, rank };
    })
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return b.stock.quantScore - a.stock.quantScore;
    });

  return {
    items: scored.slice(0, limit).map((e) => e.stock),
    totalMatches: scored.length,
  };
}
