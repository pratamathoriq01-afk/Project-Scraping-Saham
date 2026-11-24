import {
  STOCK_CATALOG,
  STOCK_MAP,
  formatPercent,
  formatRupiah,
  type StockItem,
} from "@/data/stocksCatalog";

export type ChartTimeframe = "1M" | "3M" | "1Y" | "5Y";
export type VerdictStatus =
  | "AKUMULASI BERTAHAP"
  | "TUNGGU KOREKSI"
  | "WASPADA / HINDARI";

export interface OhlcvBar {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: string;
  value: number;
}

export interface PriceZones {
  entryLow: number;
  entryHigh: number;
  fairValueTarget: number;
  cutLoss: number;
  upsidePct: number;
  riskPct: number;
  riskRewardRatio: number;
}

export interface SimpleNarrative {
  reasons: [string, string, string];
  capitalSimRp: number;
  estMaxLossRp: number;
  estTargetGainRp: number;
  simSummary: string;
}

export interface InvestorNarrative {
  reasons: [string, string, string];
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
}

export interface StockDecisionProfile {
  ticker: string;
  verdictStatus: VerdictStatus;
  quantScore: number;
  priceZones: PriceZones;
  simpleNarrative: SimpleNarrative;
  investorNarrative: InvestorNarrative;
  invalidationRule: string;
}

export interface MarketSeriesBundle {
  ticker: string;
  bars: OhlcvBar[];
  ma20: LinePoint[];
  ma200: LinePoint[];
  rsi14: LinePoint[];
  latestRsi14: number;
  latestMa200: number;
  priceVsMa200Pct: number;
  atr14Pct: number;
  maxDrawdown1YPct: number;
}

/**
 * Snap any price strictly to official IDX (BEI) price tick fractions.
 */
export function snapToIdxTick(rawPrice: number): number {
  const price = Math.max(50, rawPrice);
  let tick = 1;
  if (price >= 5000) tick = 25;
  else if (price >= 2000) tick = 10;
  else if (price >= 500) tick = 5;
  else if (price >= 200) tick = 2;
  return Math.max(50, Math.round(price / tick) * tick);
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate N deterministic weekday trading dates ending at referenceDate (YYYY-MM-DD).
 */
function buildTradingDates(count: number, endIso = "2026-11-23"): string[] {
  const [y, m, d] = endIso.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const dates: string[] = [];

  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      const yyyy = cursor.getUTCFullYear();
      const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getUTCDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates.reverse();
}

const TRADING_DATES_5Y = buildTradingDates(1260, "2026-11-23");

interface StockSimConfig {
  driftAnnual: number;
  dailyVol: number;
  avgVolume: number;
  verdict: VerdictStatus;
  per: number;
  sectorPer: number;
  pbv: number;
  roe: number;
  solvencyLabel: string;
  solvencyValue: string;
  entryDiscountLow: number; // relative to price
  entryDiscountHigh: number;
  targetUpside: number;
  cutLossBelowEntry: number;
  simplePoints: [string, string, string];
  invalidation: string;
}

const SIM_CONFIGS: Record<string, StockSimConfig> = {
  BBCA: {
    driftAnnual: 0.11,
    dailyVol: 0.0115,
    avgVolume: 72_000_000,
    verdict: "TUNGGU KOREKSI",
    per: 21.4,
    sectorPer: 14.2,
    pbv: 4.2,
    roe: 21.2,
    solvencyLabel: "CAR / NPL",
    solvencyValue: "29,1% / 1,9%",
    entryDiscountLow: 0.06,
    entryDiscountHigh: 0.03,
    targetUpside: 0.08,
    cutLossBelowEntry: 0.055,
    simplePoints: [
      "Kualitas bisnis bank terbaik di Indonesia dengan nasabah loyal & dana murah (CASA 81%).",
      "Harga saat ini tergolong premium dibanding rata-rata sektor perbankan, jadi lebih bijak tunggu koreksi sehat.",
      "Cocok dicicil saat harga turun mendekati area support Rp 9.600–Rp 9.900 agar ruang untung lebih lega.",
    ],
    invalidation:
      "Tesis ditinjau ulang jika NPL Gross menembus > 2,8% atau pertumbuhan kredit melambat di bawah 5% YoY.",
  },
  BMRI: {
    driftAnnual: 0.14,
    dailyVol: 0.0145,
    avgVolume: 98_000_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 11.4,
    sectorPer: 14.2,
    pbv: 2.3,
    roe: 20.8,
    solvencyLabel: "CAR / NPL",
    solvencyValue: "21,4% / 1,2%",
    entryDiscountLow: 0.025,
    entryDiscountHigh: 0.005,
    targetUpside: 0.16,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Pertumbuhan kredit korporasi & digital Livin' sangat kencang namun harga saham masih di bawah rata-rata PER bank besar.",
      "Kualitas kredit sangat terjaga (NPL rendah 1,2%) dengan dividen tahunan yang rutin bertumbuh.",
      "Harga berada di area wajar untuk akumulasi bertahap sambil menjaga batas disiplin risiko.",
    ],
    invalidation:
      "Tesis batal jika Cost of Credit (CoC) melonjak > 1,8% atau NIM tergerus di bawah 4,5%.",
  },
  BBRI: {
    driftAnnual: 0.04,
    dailyVol: 0.0165,
    avgVolume: 185_000_000,
    verdict: "TUNGGU KOREKSI",
    per: 12.1,
    sectorPer: 14.2,
    pbv: 2.2,
    roe: 18.6,
    solvencyLabel: "CAR / NPL",
    solvencyValue: "25,2% / 3,1%",
    entryDiscountLow: 0.05,
    entryDiscountHigh: 0.02,
    targetUpside: 0.14,
    cutLossBelowEntry: 0.065,
    simplePoints: [
      "Dividen sangat menarik untuk jangka panjang, tetapi kredit segmen mikro masih butuh waktu pemulihan kualitas aset.",
      "Volatilitas harian cukup tinggi karena arus dana asing masih keluar-masuk.",
      "Tunggu konfirmasi pembalikan tren atau cicil kecil di area support bawah agar risiko lebih terkendali.",
    ],
    invalidation:
      "Batalkan akumulasi jika rasio NPL segmen mikro terus naik 2 kuartal beruntun di atas 3,5%.",
  },
  BBNI: {
    driftAnnual: 0.09,
    dailyVol: 0.014,
    avgVolume: 56_000_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 9.2,
    sectorPer: 14.2,
    pbv: 1.25,
    roe: 14.2,
    solvencyLabel: "CAR / NPL",
    solvencyValue: "21,8% / 2,0%",
    entryDiscountLow: 0.025,
    entryDiscountHigh: 0.005,
    targetUpside: 0.15,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Valuasi paling ekonomis di antara Big 4 Bank (PER 9,2x dan PBV 1,25x) dengan transformasi kredit korporasi yang makin sehat.",
      "Rasio kredit bermasalah turun konsisten ke kisaran 2,0% sehingga risiko kejutan laba jauh lebih kecil.",
      "Ideal untuk strategi cicil bertahap selama harga bertahan di atas support teknikal.",
    ],
    invalidation:
      "Tesis ditinjau ulang jika CASA merosot di bawah 65% atau pertumbuhan laba bersih negatif YoY.",
  },
  ADRO: {
    driftAnnual: 0.16,
    dailyVol: 0.019,
    avgVolume: 48_200_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 4.8,
    sectorPer: 7.4,
    pbv: 0.9,
    roe: 18.4,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,21x / 18,4x",
    entryDiscountLow: 0.02,
    entryDiscountHigh: -0.003,
    targetUpside: 0.137,
    cutLossBelowEntry: 0.063,
    simplePoints: [
      "Valuasi diskon 35% dibanding rata-rata historis sektor energi (PER 4,8x & PBV di bawah 1x nilai buku).",
      "Arus kas operasional sangat tebal dan utang berbunga sangat rendah (DER 0,21x), plus dukungan dividen tinggi.",
      "Harga bergerak mendekati zona akumulasi kuat dengan potensi kenaikan lebih besar dibanding batas risiko.",
    ],
    invalidation:
      "Tesis gugur jika harga batu bara acuan global turun stabil < $95/ton atau Free Cash Flow anjlok > 30% YoY.",
  },
  PTBA: {
    driftAnnual: 0.07,
    dailyVol: 0.016,
    avgVolume: 26_000_000,
    verdict: "TUNGGU KOREKSI",
    per: 6.4,
    sectorPer: 7.4,
    pbv: 1.45,
    roe: 22.1,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,18x / 24,0x",
    entryDiscountLow: 0.045,
    entryDiscountHigh: 0.015,
    targetUpside: 0.12,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Terkenal rajin membagikan dividen jumbo, tetapi margin laba sensitif terhadap kewajiban harga DMO domestik.",
      "Harga saat ini sudah naik mendekati area resisten menengah sehingga margin keamanan mulai menipis.",
      "Lebih nyaman menunggu koreksi wajar ke area support sebelum menambah posisi.",
    ],
    invalidation:
      "Evaluasi ulang jika rasio pembayaran dividen (DPR) dipangkas di bawah 50% atau volume angkut logistik terhambat.",
  },
  ITMG: {
    driftAnnual: 0.12,
    dailyVol: 0.017,
    avgVolume: 1_900_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 5.3,
    sectorPer: 7.4,
    pbv: 1.05,
    roe: 19.6,
    solvencyLabel: "DER / Kas",
    solvencyValue: "0,04x / Net Cash",
    entryDiscountLow: 0.025,
    entryDiscountHigh: 0.005,
    targetUpside: 0.145,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Posisi kas bersih (net cash) sangat besar dengan utang hampir nol, menjadi bantalan kuat saat harga komoditas berfluktuasi.",
      "Valuasi masih murah (PER 5,3x) dengan rekam jejak dividend yield dua digit yang konsisten.",
      "Cocok dicicil perlahan oleh investor pencari arus kas dividen dengan batas cut-loss terukur.",
    ],
    invalidation:
      "Tesis batal jika cadangan tambang baru tertunda signifikan atau strip ratio biaya produksi melonjak tajam.",
  },
  ANTM: {
    driftAnnual: -0.04,
    dailyVol: 0.0225,
    avgVolume: 84_000_000,
    verdict: "WASPADA / HINDARI",
    per: 15.8,
    sectorPer: 7.4,
    pbv: 1.35,
    roe: 8.6,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,14x / 9,2x",
    entryDiscountLow: 0.08,
    entryDiscountHigh: 0.05,
    targetUpside: 0.05,
    cutLossBelowEntry: 0.075,
    simplePoints: [
      "Volatilitas harga sangat tinggi mengikuti ayunan harga nikel & emas global, namun margin keuntungan bersih masih tipis.",
      "Valuasi PER 15,8x relatif mahal dibanding sektor tambang lain sementara tren menengah masih rawan tekanan jual.",
      "Sebaiknya hindari mengejar harga di atas; tunggu perbaikan laba kuartalan yang lebih konsisten.",
    ],
    invalidation:
      "Status baru membaik jika harga berhasil menembus stabil di atas MA200 disertai kenaikan ROE > 12%.",
  },
  ICBP: {
    driftAnnual: 0.08,
    dailyVol: 0.0125,
    avgVolume: 6_500_000,
    verdict: "TUNGGU KOREKSI",
    per: 15.2,
    sectorPer: 18.0,
    pbv: 2.8,
    roe: 14.8,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,85x / 6,8x",
    entryDiscountLow: 0.04,
    entryDiscountHigh: 0.015,
    targetUpside: 0.11,
    cutLossBelowEntry: 0.055,
    simplePoints: [
      "Produk kebutuhan pokok (Indomie dkk.) sangat tahan resesi dengan penjualan stabil di dalam maupun luar negeri.",
      "Kinerja kuartalan sempat dipengaruhi selisih kurs pada utang obligasi USD, walau bisnis operasional tetap solid.",
      "Tunggu koreksi ringan ke area beli ideal agar rasio potensi untung vs risiko makin optimal.",
    ],
    invalidation:
      "Tesis ditinjau ulang jika pelemahan Rupiah memicu lonjakan beban bunga & menekan margin operasional < 14%.",
  },
  INDF: {
    driftAnnual: 0.09,
    dailyVol: 0.012,
    avgVolume: 9_800_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 7.1,
    sectorPer: 18.0,
    pbv: 1.05,
    roe: 15.4,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,72x / 7,4x",
    entryDiscountLow: 0.02,
    entryDiscountHigh: 0.003,
    targetUpside: 0.15,
    cutLossBelowEntry: 0.055,
    simplePoints: [
      "Cara paling murah untuk memiliki ekosistem Indofood (termasuk ICBP & Bogasari) di PER 7,1x.",
      "Arus kas dari divisi pangan & agribisnis stabil dengan volatilitas jauh lebih tenang dibanding sektor komoditas.",
      "Sangat ramah untuk strategi cicil bertahap investor konservatif maupun value investor.",
    ],
    invalidation:
      "Tesis batal jika utang berbunga naik signifikan tanpa diimbangi pertumbuhan arus kas operasional.",
  },
  UNVR: {
    driftAnnual: -0.14,
    dailyVol: 0.0185,
    avgVolume: 38_000_000,
    verdict: "WASPADA / HINDARI",
    per: 19.6,
    sectorPer: 18.0,
    pbv: 18.5,
    roe: 94.0,
    solvencyLabel: "Current Ratio",
    solvencyValue: "0,68x (Ketat)",
    entryDiscountLow: 0.1,
    entryDiscountHigh: 0.06,
    targetUpside: -0.04,
    cutLossBelowEntry: 0.08,
    simplePoints: [
      "Tren penjualan dan pangsa pasar masih tertekan persaingan ketat sehingga grafik jangka panjang masih menurun.",
      "Meskipun harga sudah turun banyak, valuasi PER 19,6x belum bisa disebut murah jika laba terus menyusut.",
      "Disarankan hindari dulu (*jangan menangkap pisau jatuh*) sampai ada bukti nyata pertumbuhan omzet 2 kuartal beruntun.",
    ],
    invalidation:
      "Baru layak dilirik ulang jika pertumbuhan pendapatan kembali positif > 5% YoY dan tren harga menembus MA200.",
  },
  MYOR: {
    driftAnnual: 0.06,
    dailyVol: 0.014,
    avgVolume: 14_000_000,
    verdict: "TUNGGU KOREKSI",
    per: 17.1,
    sectorPer: 18.0,
    pbv: 3.4,
    roe: 20.2,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,34x / 12,1x",
    entryDiscountLow: 0.045,
    entryDiscountHigh: 0.018,
    targetUpside: 0.125,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Merek ekspor sangat kuat di Asia & global dengan profitabilitas modal (ROE > 20%) yang sehat.",
      "Kenaikan harga bahan baku kopi & kakao masih bisa menekan margin laba dalam jangka pendek.",
      "Tunggu koreksi ke area support sebelum masuk bertahap untuk menjaga keamanan modal.",
    ],
    invalidation:
      "Evaluasi ulang jika Gross Profit Margin turun di bawah 21% akibat lonjakan biaya bahan baku berkepanjangan.",
  },
  TLKM: {
    driftAnnual: 0.05,
    dailyVol: 0.0135,
    avgVolume: 112_000_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 11.8,
    sectorPer: 15.6,
    pbv: 2.15,
    roe: 17.9,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,48x / 10,8x",
    entryDiscountLow: 0.025,
    entryDiscountHigh: 0.005,
    targetUpside: 0.16,
    cutLossBelowEntry: 0.06,
    simplePoints: [
      "Pemimpin jaringan telekomunikasi & data center Indonesia yang sedang dihargai di bawah rata-rata historis 5 tahunnya.",
      "Arus kas operasional sangat besar dengan dukungan dividen rutin sekitar 5–6% per tahun.",
      "Area harga sekarang menarik untuk dicicil bertahap dengan horizon investasi menengah-panjang.",
    ],
    invalidation:
      "Tesis ditinjau ulang jika perang tarif data menekan ARPU seluler turun > 8% YoY.",
  },
  ISAT: {
    driftAnnual: 0.18,
    dailyVol: 0.017,
    avgVolume: 42_000_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 14.2,
    sectorPer: 15.6,
    pbv: 2.45,
    roe: 16.5,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,95x / 4,9x",
    entryDiscountLow: 0.03,
    entryDiscountHigh: 0.005,
    targetUpside: 0.17,
    cutLossBelowEntry: 0.065,
    simplePoints: [
      "Pertumbuhan laba pasca merger sangat solid dengan ekspansi agresif ke infrastruktur AI Cloud & data center.",
      "Momentum teknikal jangka menengah masih terjaga positif di atas rata-rata pergerakan utamanya.",
      "Menarik untuk akumulasi bertahap sambil memantau rasio utang agar tetap sehat.",
    ],
    invalidation:
      "Tesis batal jika belanja modal (CapEx) membengkak tanpa diikuti pertumbuhan EBITDA margin.",
  },
  ASII: {
    driftAnnual: 0.07,
    dailyVol: 0.0135,
    avgVolume: 54_000_000,
    verdict: "AKUMULASI BERTAHAP",
    per: 6.3,
    sectorPer: 12.8,
    pbv: 1.02,
    roe: 16.2,
    solvencyLabel: "DER / ICR",
    solvencyValue: "0,41x / 14,2x",
    entryDiscountLow: 0.025,
    entryDiscountHigh: 0.005,
    targetUpside: 0.155,
    cutLossBelowEntry: 0.055,
    simplePoints: [
      "Konglomerasi raksasa (otomotif, pembiayaan, alat berat UNTR) yang kini dijual sangat murah di kisaran PBV 1,0x & PER 6,3x.",
      "Imbal hasil dividen tinggi (7–9%) memberikan perlindungan modal yang kuat selama pasar bergerak mendatar.",
      "Risiko penurunan relatif terbatas dibanding potensi pemulihan valuasi jangka menengah.",
    ],
    invalidation:
      "Tesis ditinjau ulang jika pangsa pasar otomotif turun di bawah 45% secara permanen dan kontribusi UNTR melemah tajam.",
  },
};

export function computeSMA(bars: OhlcvBar[], period: number): LinePoint[] {
  const result: LinePoint[] = [];
  if (bars.length < period) return result;

  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) {
      sum -= bars[i - period].close;
    }
    if (i >= period - 1) {
      result.push({
        time: bars[i].time,
        value: Number((sum / period).toFixed(2)),
      });
    }
  }
  return result;
}

/**
 * Standard Wilder's Smoothed RSI (14) matching TradingView calculation.
 */
export function computeRSI(bars: OhlcvBar[], period = 14): LinePoint[] {
  const result: LinePoint[] = [];
  if (bars.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const delta = bars[i].close - bars[i - 1].close;
    if (delta >= 0) gainSum += delta;
    else lossSum += -delta;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRsi =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({
    time: bars[period].time,
    value: Number(firstRsi.toFixed(2)),
  });

  for (let i = period + 1; i < bars.length; i++) {
    const delta = bars[i].close - bars[i - 1].close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({
      time: bars[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return result;
}

export function computeATRPercent(bars: OhlcvBar[], period = 14): number {
  if (bars.length <= period) return 1.5;
  const recent = bars.slice(-(period + 1));
  let trSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const cur = recent[i];
    const prevClose = recent[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose)
    );
    trSum += tr;
  }
  const atr = trSum / period;
  const lastClose = recent[recent.length - 1].close;
  return lastClose > 0 ? Number(((atr / lastClose) * 100).toFixed(2)) : 1.5;
}

export function computeMaxDrawdownPct(bars: OhlcvBar[]): number {
  if (bars.length === 0) return 0;
  let peak = bars[0].high;
  let maxDd = 0;
  for (const bar of bars) {
    if (bar.high > peak) peak = bar.high;
    const dd = ((bar.low - peak) / peak) * 100;
    if (dd < maxDd) maxDd = dd;
  }
  return Number(maxDd.toFixed(1));
}

export function sliceBarsByTimeframe(
  bars: OhlcvBar[],
  timeframe: ChartTimeframe
): OhlcvBar[] {
  const count =
    timeframe === "1M"
      ? 22
      : timeframe === "3M"
        ? 65
        : timeframe === "1Y"
          ? 252
          : bars.length;
  return bars.slice(-Math.min(count, bars.length));
}

export function rebaseBarsToPercent(bars: OhlcvBar[]): LinePoint[] {
  if (bars.length === 0) return [];
  const base = bars[0].close;
  if (base <= 0) return [];
  return bars.map((bar) => ({
    time: bar.time,
    value: Number((((bar.close - base) / base) * 100).toFixed(2)),
  }));
}

function generateOhlcvSeries(
  ticker: string,
  targetLastPrice: number,
  targetLastChange: number,
  driftAnnual: number,
  dailyVol: number,
  avgVolume: number,
  snapTicks: boolean
): OhlcvBar[] {
  const rng = createMulberry32(hashString(`EQUILENS_V3_${ticker}`));
  const n = TRADING_DATES_5Y.length;
  const rawCloses: number[] = new Array(n);

  let price = 1000;
  const dailyDrift = driftAnnual / 252;
  const cycleFreq = 0.015 + rng() * 0.015;
  const cyclePhase = rng() * Math.PI * 2;

  for (let i = 0; i < n; i++) {
    // Box-Muller approximate Gaussian shock
    const u1 = Math.max(1e-6, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const wave = Math.sin(i * cycleFreq + cyclePhase) * dailyVol * 0.14;
    const ret = dailyDrift + wave + z * dailyVol;
    price = Math.max(20, price * Math.exp(ret));
    rawCloses[i] = price;
  }

  // Anchor final close exactly to targetLastPrice
  const scale = targetLastPrice / rawCloses[n - 1];
  const bars: OhlcvBar[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const rawClose = isLast ? targetLastPrice : rawCloses[i] * scale;
    const close = snapTicks ? snapToIdxTick(rawClose) : Number(rawClose.toFixed(2));

    let prevClose: number;
    if (i === 0) {
      prevClose = close;
    } else if (isLast) {
      prevClose = Math.max(50, targetLastPrice - targetLastChange);
    } else {
      prevClose = bars[i - 1].close;
    }

    const gapNoise = (rng() - 0.5) * dailyVol * 0.45 * prevClose;
    const openRaw = isLast
      ? prevClose + targetLastChange * 0.25
      : prevClose + gapNoise;
    const open = snapTicks ? snapToIdxTick(openRaw) : Number(openRaw.toFixed(2));

    const bodyTop = Math.max(open, close);
    const bodyBot = Math.min(open, close);
    const upperWick = rng() * dailyVol * 0.9 * close;
    const lowerWick = rng() * dailyVol * 0.9 * close;

    const high = snapTicks
      ? Math.max(bodyTop, snapToIdxTick(bodyTop + upperWick))
      : Number((bodyTop + upperWick).toFixed(2));
    const low = snapTicks
      ? Math.min(bodyBot, snapToIdxTick(Math.max(50, bodyBot - lowerWick)))
      : Number(Math.max(10, bodyBot - lowerWick).toFixed(2));

    const volatilityBoost =
      1 + Math.min(2.2, Math.abs(close - open) / Math.max(1, close * dailyVol));
    const volume = Math.round(avgVolume * (0.55 + rng() * 0.95) * volatilityBoost);

    bars[i] = {
      time: TRADING_DATES_5Y[i],
      open,
      high,
      low,
      close,
      volume,
    };
  }

  // Guarantee exact penultimate close relation for final day delta accuracy
  if (n >= 2) {
    const prevExpected = snapTicks
      ? snapToIdxTick(targetLastPrice - targetLastChange)
      : Number((targetLastPrice - targetLastChange).toFixed(2));
    bars[n - 2] = {
      ...bars[n - 2],
      close: prevExpected,
      high: Math.max(bars[n - 2].high, prevExpected),
      low: Math.min(bars[n - 2].low, prevExpected),
    };
  }

  return bars;
}

const seriesCache = new Map<string, MarketSeriesBundle>();
const decisionCache = new Map<string, StockDecisionProfile>();

export function getMarketSeries(ticker: string): MarketSeriesBundle {
  const code = ticker.toUpperCase();
  const cached = seriesCache.get(code);
  if (cached) return cached;

  let bars: OhlcvBar[];
  if (code === "IHSG") {
    bars = generateOhlcvSeries(
      "IHSG",
      7185,
      -14,
      0.06,
      0.0085,
      18_500_000_000,
      false
    );
  } else {
    const stock: StockItem = STOCK_MAP[code] ?? STOCK_CATALOG[0];
    const cfg = SIM_CONFIGS[stock.ticker] ?? SIM_CONFIGS.ADRO;
    bars = generateOhlcvSeries(
      stock.ticker,
      stock.price,
      stock.change,
      cfg.driftAnnual,
      cfg.dailyVol,
      cfg.avgVolume,
      true
    );
  }

  const ma20 = computeSMA(bars, 20);
  const ma200 = computeSMA(bars, 200);
  const rsi14 = computeRSI(bars, 14);
  const latestClose = bars[bars.length - 1]?.close ?? 1;
  const latestMa200 = ma200[ma200.length - 1]?.value ?? latestClose;
  const latestRsi14 = rsi14[rsi14.length - 1]?.value ?? 50;
  const priceVsMa200Pct = Number(
    (((latestClose - latestMa200) / Math.max(1, latestMa200)) * 100).toFixed(1)
  );
  const atr14Pct = computeATRPercent(bars, 14);
  const maxDrawdown1YPct = computeMaxDrawdownPct(bars.slice(-252));

  const bundle: MarketSeriesBundle = {
    ticker: code,
    bars,
    ma20,
    ma200,
    rsi14,
    latestRsi14,
    latestMa200,
    priceVsMa200Pct,
    atr14Pct,
    maxDrawdown1YPct,
  };

  seriesCache.set(code, bundle);
  return bundle;
}

export function getStockDecisionProfile(ticker: string): StockDecisionProfile {
  const code = ticker.toUpperCase();
  const cached = decisionCache.get(code);
  if (cached) return cached;

  const stock: StockItem = STOCK_MAP[code] ?? STOCK_CATALOG[0];
  const cfg = SIM_CONFIGS[stock.ticker] ?? SIM_CONFIGS.ADRO;
  const series = getMarketSeries(stock.ticker);

  const entryLow = snapToIdxTick(stock.price * (1 - cfg.entryDiscountLow));
  const entryHigh = Math.max(
    entryLow + snapToIdxTick(stock.price * 0.015) - stock.price * 0.015 >= 0
      ? snapToIdxTick(stock.price * (1 - cfg.entryDiscountHigh))
      : entryLow,
    entryLow
  );
  const adjustedEntryHigh =
    entryHigh <= entryLow ? snapToIdxTick(entryLow * 1.02) : entryHigh;

  const fairValueTarget = snapToIdxTick(stock.price * (1 + cfg.targetUpside));
  const cutLoss = Math.min(
    snapToIdxTick(entryLow * (1 - cfg.cutLossBelowEntry)),
    snapToIdxTick(stock.price * (1 - cfg.cutLossBelowEntry))
  );

  const upsidePct = Number(
    (((fairValueTarget - stock.price) / stock.price) * 100).toFixed(1)
  );
  const riskPct = Number(
    (((cutLoss - stock.price) / stock.price) * 100).toFixed(1)
  );

  // Mathematically exact R:R from current price to fairValue vs cutLoss
  const rewardDist = Math.max(0, fairValueTarget - stock.price);
  const riskDist = Math.max(1, stock.price - cutLoss);
  const riskRewardRatio = Number((rewardDist / riskDist).toFixed(2));

  const capitalSimRp = 1_000_000;
  const estMaxLossRp = Math.round(
    capitalSimRp * (Math.abs(riskPct) / 100)
  );
  const estTargetGainRp = Math.round(
    capitalSimRp * (Math.max(0, upsidePct) / 100)
  );

  const mosPctVal = upsidePct;
  const mosLabel = formatPercent(mosPctVal);

  const maPosText =
    series.priceVsMa200Pct >= 0
      ? `di atas MA200 (${formatPercent(series.priceVsMa200Pct)})`
      : `di bawah MA200 (${formatPercent(series.priceVsMa200Pct)})`;

  const rsiZoneText =
    series.latestRsi14 >= 70
      ? "Overbought"
      : series.latestRsi14 <= 30
        ? "Oversold"
        : "Netral";

  const investorReasons: [string, string, string] = [
    `Valuasi relatif: PER ${cfg.per.toFixed(1).replace(".", ",")}x vs rata-rata sektor ${cfg.sectorPer.toFixed(1).replace(".", ",")}x, PBV ${cfg.pbv.toFixed(2).replace(".", ",")}x, dengan estimasi Margin of Safety ${mosLabel}.`,
    `Kesehatan finansial (${stock.accountingType === "banking" ? "Standar Perbankan" : "Standar Korporasi"}): ROE ${cfg.roe.toFixed(1).replace(".", ",")}% dengan indikator ${cfg.solvencyLabel} di level ${cfg.solvencyValue}.`,
    `Momentum & risiko kuantitatif: Harga saat ini ${maPosText}, RSI (14) di ${series.latestRsi14.toFixed(1).replace(".", ",")} (${rsiZoneText}), volatilitas ATR(14) ${series.atr14Pct.toFixed(2).replace(".", ",")}%, & Max Drawdown 1Y ${series.maxDrawdown1YPct.toFixed(1).replace(".", ",")}%.`,
  ];

  const simSummary =
    cfg.verdict === "WASPADA / HINDARI"
      ? `Simulasi Rp 1.000.000: Risiko turun hingga -${formatRupiah(estMaxLossRp)} (${riskPct.toFixed(1).replace(".", ",")}%) belum sebanding dengan potensi kenaikan; lebih aman tahan kas.`
      : `Simulasi modal Rp 1.000.000: Toleransi koreksi maksimal sekitar -${formatRupiah(estMaxLossRp)} (${riskPct.toFixed(1).replace(".", ",")}%) jika cut-loss tersentuh, vs potensi target +${formatRupiah(estTargetGainRp)} (${formatPercent(upsidePct)}).`;

  const profile: StockDecisionProfile = {
    ticker: stock.ticker,
    verdictStatus: cfg.verdict,
    quantScore: stock.quantScore,
    priceZones: {
      entryLow,
      entryHigh: adjustedEntryHigh,
      fairValueTarget,
      cutLoss,
      upsidePct,
      riskPct,
      riskRewardRatio,
    },
    simpleNarrative: {
      reasons: cfg.simplePoints,
      capitalSimRp,
      estMaxLossRp,
      estTargetGainRp,
      simSummary,
    },
    investorNarrative: {
      reasons: investorReasons,
      metrics: {
        per: `${cfg.per.toFixed(1).replace(".", ",")}x`,
        sectorPer: `${cfg.sectorPer.toFixed(1).replace(".", ",")}x`,
        pbv: `${cfg.pbv.toFixed(2).replace(".", ",")}x`,
        mosPct: mosLabel,
        roe: `${cfg.roe.toFixed(1).replace(".", ",")}%`,
        solvencyLabel: cfg.solvencyLabel,
        solvencyValue: cfg.solvencyValue,
        priceVsMa200Pct: series.priceVsMa200Pct,
        rsi14: series.latestRsi14,
        atr14Pct: series.atr14Pct,
        maxDrawdown1YPct: series.maxDrawdown1YPct,
      },
    },
    invalidationRule: cfg.invalidation,
  };

  decisionCache.set(code, profile);
  return profile;
}
