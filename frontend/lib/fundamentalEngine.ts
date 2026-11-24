import { formatRupiah } from "@/data/stocksCatalog";
import type {
  BenchmarkApiData,
  CategoryDefinition,
  CompareApiResponse,
  EvaluatedCategoryGroup,
  EvaluatedCell,
  EvaluatedComparisonMatrix,
  EvaluatedMetricRow,
  FundamentalCategoryId,
  LiveTechnicalSnapshot,
  MatrixColumnDescriptor,
  MetricDefinition,
  MetricId,
  QuarterlyAnchorData,
  RawMetricApiValue,
  TripleCheckAudit,
} from "@/types/fundamental";

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "valuasi",
    numberLabel: "01",
    title: "Valuasi & Harga Wajar",
    shortTitle: "Valuasi",
    description:
      "Mengukur murah-mahalnya harga pasar live terhadap laba, ekuitas, EV/EBITDA, dan estimasi nilai wajar intrinsik.",
  },
  {
    id: "profitabilitas",
    numberLabel: "02",
    title: "Profitabilitas & Efisiensi",
    shortTitle: "Profitabilitas",
    description:
      "Menilai efektivitas manajemen menghasilkan laba atas modal (ROE), aset (ROA), margin operasional, dan pertumbuhan EPS.",
  },
  {
    id: "kesehatan",
    numberLabel: "03",
    title: "Kesehatan Bisnis & Risiko Distress",
    shortTitle: "Kesehatan",
    description:
      "Menguji ketahanan neraca, likuiditas, beban bunga, skor kebangkrutan (Altman/Zmijewski), dan khusus Bank (CAR/NPL/NIM/CASA).",
  },
  {
    id: "aruskas",
    numberLabel: "04",
    title: "Arus Kas & Pertumbuhan (SGR)",
    shortTitle: "Arus Kas",
    description:
      "Memverifikasi apakah laba akuntansi benar-benar menjadi uang tunai operasional (OCF), arus kas bebas (FCF), dan laju tumbuh mandiri.",
  },
  {
    id: "dividen",
    numberLabel: "05",
    title: "Dividen & Payout",
    shortTitle: "Dividen",
    description:
      "Mengukur imbal hasil dividen live, keberlanjutan rasio pembayaran laba (DPR), dan rekam jejak konsistensi 5 tahun.",
  },
  {
    id: "teknikal",
    numberLabel: "06",
    title: "Indikator Teknikal & Risiko Pasar",
    shortTitle: "Teknikal",
    description:
      "Menyatukan tren harga terhadap MA20/MA200, momentum Wilder RSI (14), volatilitas harian ATR, risiko drawdown 1Y, dan level S1–R1.",
  },
];

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // 01 Valuasi & Harga Wajar (5)
  {
    id: "per_ttm",
    categoryId: "valuasi",
    label: "PER (TTM)",
    shortLabel: "PER",
    formula: "Harga Saham Live / EPS (TTM)",
    academicGuide:
      "Price to Earnings Ratio menunjukkan berapa tahun laba bersih yang dibayar investor pada harga saat ini. Nilai negatif (rugi bersih) tidak valid dibandingkan dan otomatis didiskualifikasi.",
    polarity: "lower_positive_better",
    unit: "multiple_x",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "Ideal < rata-rata sektor & > 0x",
  },
  {
    id: "pbv_current",
    categoryId: "valuasi",
    label: "Price to Book Value (PBV)",
    shortLabel: "PBV",
    formula: "Harga Saham Live / Book Value per Share (BVPS)",
    academicGuide:
      "Membandingkan harga pasar terhadap nilai buku ekuitas bersih per saham. PBV rendah yang ditopang ROE tinggi menandakan valuasi yang menarik secara institusional.",
    polarity: "lower_positive_better",
    unit: "multiple_x",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "Bandingkan sepadan dengan ROE",
  },
  {
    id: "ev_ebitda",
    categoryId: "valuasi",
    label: "EV / EBITDA",
    shortLabel: "EV/EBITDA",
    formula: "(Harga Live + Net Debt/Saham) / EBITDA per Saham",
    academicGuide:
      "Valuasi struktur modal utuh yang memperhitungkan utang berbunga dan posisi kas (Net Cash menurunkan EV). Tidak berlaku untuk bank karena struktur bunga dan dana pihak ketiga.",
    polarity: "lower_positive_better",
    unit: "multiple_x",
    isLiveReactive: true,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "Korporasi sehat umumnya < 8x",
  },
  {
    id: "fair_value",
    categoryId: "valuasi",
    label: "Estimasi Nilai Wajar Intrinsik",
    shortLabel: "Nilai Wajar",
    formula:
      "Bank: Gordon Growth Justified P/B + Peer PER • Non-Bank: Graham + Peer PER/PBV",
    academicGuide:
      "Estimasi nilai intrinsik jangkar kuartalan yang disinkronkan langsung dengan garis Target Nilai Wajar pada grafik dan Decision Panel.",
    polarity: "neutral",
    unit: "rupiah",
    isLiveReactive: false,
    benchmarkHint: "Acuan target wajar menengah",
  },
  {
    id: "margin_of_safety",
    categoryId: "valuasi",
    label: "Diskon Margin of Safety",
    shortLabel: "MoS %",
    formula: "((Nilai Wajar Intrinsik − Harga Live) / Nilai Wajar Intrinsik) × 100%",
    academicGuide:
      "Bantalan keamanan (konsep Benjamin Graham) terhadap kesalahan estimasi. Positif berarti harga pasar sedang diskon terhadap nilai wajar; negatif berarti harga diperdagangkan premium.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "Positif (> 10% diskon menarik)",
  },

  // 02 Profitabilitas & Efisiensi (6)
  {
    id: "roe",
    categoryId: "profitabilitas",
    label: "Return on Equity (ROE)",
    shortLabel: "ROE",
    formula: "(Laba Bersih TTM / Total Ekuitas) × 100%",
    academicGuide:
      "Mengukur produktivitas modal pemegang saham dalam mencetak laba bersih. Periksa bersama DER agar ROE tinggi bukan semata-mata berasal dari ekuitas yang terlalu tipis.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Unggul institusional ≥ 15%",
  },
  {
    id: "roa",
    categoryId: "profitabilitas",
    label: "Return on Assets (ROA)",
    shortLabel: "ROA",
    formula: "(Laba Bersih TTM / Total Aset) × 100%",
    academicGuide:
      "Efisiensi seluruh aset perusahaan dalam menghasilkan laba bersih. Catatan khusus: pada perbankan, ROA 2%–3,5% sudah tergolong elit karena aset bank terdiri dari kredit produktif.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Non-Bank ≥ 7% • Bank ≥ 2,0%",
  },
  {
    id: "gpm",
    categoryId: "profitabilitas",
    label: "Gross Profit Margin (GPM)",
    shortLabel: "GPM",
    formula: "(Laba Kotor / Pendapatan) × 100%",
    academicGuide:
      "Menunjukkan kekuatan daya tawar harga (pricing power) produk di atas beban pokok produksi. Tidak relevan untuk bank karena struktur pendapatan bunga (gunakan NIM).",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "Makin stabil & tinggi makin baik",
  },
  {
    id: "opm",
    categoryId: "profitabilitas",
    label: "Operating Profit Margin (OPM)",
    shortLabel: "OPM",
    formula: "(Laba Operasional / Pendapatan) × 100%",
    academicGuide:
      "Efisiensi inti operasi bisnis sebelum bunga dan pajak. Margin operasional yang terjaga menandakan kendali biaya operasional (OpEx) yang disiplin.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Indikator efisiensi inti usaha",
  },
  {
    id: "npm",
    categoryId: "profitabilitas",
    label: "Net Profit Margin (NPM)",
    shortLabel: "NPM",
    formula: "(Laba Bersih / Pendapatan) × 100%",
    academicGuide:
      "Persentase akhir pendapatan yang tersisa sebagai laba bersih milik pemegang saham setelah seluruh biaya operasional, bunga, dan pajak dibayarkan.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Margin bersih ≥ 10% sehat",
  },
  {
    id: "eps_growth",
    categoryId: "profitabilitas",
    label: "Pertumbuhan Laba / EPS YoY",
    shortLabel: "EPS YoY",
    formula: "((EPS TTM − EPS Tahun Lalu) / |EPS Tahun Lalu|) × 100%",
    academicGuide:
      "Kecepatan pertumbuhan laba per saham secara tahunan. Kontraksi laba negatif berturut-turut menjadi sinyal waspada meskipun valuasi tampak murah (risiko value trap).",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Positif & konsisten > inflasi",
  },

  // 03 Kesehatan Bisnis & Risiko Distress (6)
  {
    id: "der",
    categoryId: "kesehatan",
    label: "Debt to Equity Ratio (DER)",
    shortLabel: "DER",
    formula: "Total Liabilitas / Total Ekuitas",
    academicGuide:
      "Rasio pengungkit utang terhadap modal sendiri. Pada bank, dana nasabah (DPK) tercatat sebagai liabilitas sehingga DER bank wajar di 5x–7x; saat lintas sektor, sistem menormalisasi terhadap rata-rata sektor masing-masing.",
    polarity: "lower_positive_better",
    unit: "multiple_x",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Non-Bank < 1,0x • Bank cek CAR/NPL",
  },
  {
    id: "current_ratio",
    categoryId: "kesehatan",
    label: "Current Ratio",
    shortLabel: "Current Ratio",
    formula: "Aset Lancar / Liabilitas Jangka Pendek",
    academicGuide:
      "Kemampuan melunasi kewajiban jatuh tempo < 12 bulan dengan aset lancar. Di bawah 1,0x menandakan likuiditas jangka pendek ketat. Tidak dipakai pada bank (gunakan LDR/LCR).",
    polarity: "higher_better",
    unit: "multiple_x",
    isLiveReactive: false,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "Korporasi sehat ≥ 1,5x",
  },
  {
    id: "quick_ratio",
    categoryId: "kesehatan",
    label: "Quick Ratio",
    shortLabel: "Quick Ratio",
    formula: "(Aset Lancar − Persediaan) / Liabilitas Jangka Pendek",
    academicGuide:
      "Uji likuiditas lebih ketat dibanding Current Ratio karena mengeluarkan persediaan yang tidak langsung cair menjadi kas. Tidak berlaku untuk sektor perbankan.",
    polarity: "higher_better",
    unit: "multiple_x",
    isLiveReactive: false,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "Ideal ≥ 1,0x tanpa jual stok",
  },
  {
    id: "interest_coverage",
    categoryId: "kesehatan",
    label: "Interest Coverage Ratio (ICR)",
    shortLabel: "ICR",
    formula: "Laba Operasional (EBIT) / Beban Bunga",
    academicGuide:
      "Berapa kali laba operasional mampu menutup kewajiban bunga utang. Di bawah 2,0x merupakan peringatan dini risiko gagal bayar saat suku bunga naik. Tidak berlaku untuk bank.",
    polarity: "higher_better",
    unit: "multiple_x",
    isLiveReactive: false,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "Aman ≥ 5,0x beban bunga",
  },
  {
    id: "altman_z",
    categoryId: "kesehatan",
    label: "Altman Z-Score",
    shortLabel: "Altman Z",
    formula: "1,2X₁ + 1,4X₂ + 3,3X₃ + 0,6X₄ + 1,0X₅",
    academicGuide:
      "Model prediksi risiko kebangkrutan korporasi: > 2,99 Zona Aman, 1,81–2,99 Grey Area, < 1,81 Zona Distress. Secara metodologi akademik tidak berlaku untuk lembaga keuangan/bank.",
    polarity: "higher_better",
    unit: "score",
    isLiveReactive: false,
    notApplicableForBanking: true,
    requirePositiveToWin: true,
    benchmarkHint: "> 2,99 Zona Aman",
  },
  {
    id: "zmijewski_x",
    categoryId: "kesehatan",
    label: "Zmijewski X-Score",
    shortLabel: "Zmijewski X",
    formula: "−4,336 − 4,513(NI/TA) + 5,679(TL/TA) + 0,004(CA/CL)",
    academicGuide:
      "Model probabilitas distress berbasis profitabilitas, leverage, dan likuiditas: nilai < 0 menandakan perusahaan Sehat (Non-Distress), sedangkan ≥ 0 menandakan Risiko Distress. Tidak berlaku untuk bank karena DPK meningkatkan TL/TA secara struktural.",
    polarity: "lower_better",
    unit: "score",
    isLiveReactive: false,
    notApplicableForBanking: true,
    benchmarkHint: "< 0 Sehat • ≥ 0 Risiko Distress",
  },

  // 04 Arus Kas & Pertumbuhan / SGR (4)
  {
    id: "ocf",
    categoryId: "aruskas",
    label: "Operating Cash Flow (OCF)",
    shortLabel: "OCF",
    formula: "Arus Kas Bersih dari Aktivitas Operasi (TTM)",
    academicGuide:
      "Uang tunai nyata yang dihasilkan operasi utama. OCF positif dan konsisten melampaui laba bersih membuktikan kualitas laba yang sehat tanpa rekayasa akrual.",
    polarity: "higher_better",
    unit: "billion_idr",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Wajib positif & bertumbuh",
  },
  {
    id: "fcf",
    categoryId: "aruskas",
    label: "Free Cash Flow (FCF)",
    shortLabel: "FCF",
    formula: "Operating Cash Flow − Belanja Modal (CapEx)",
    academicGuide:
      "Sisa kas bebas setelah membiayai perawatan/ekspansi aset tetap. FCF tebal memungkinkan perusahaan membayar dividen, melunasi utang, atau ekspansi tanpa mengencerkan pemegang saham.",
    polarity: "higher_better",
    unit: "billion_idr",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Sumber utama dividen berkelanjutan",
  },
  {
    id: "capex",
    categoryId: "aruskas",
    label: "Belanja Modal (CapEx)",
    shortLabel: "CapEx",
    formula: "Pengeluaran Aset Tetap & Infrastruktur (TTM)",
    academicGuide:
      "Investasi aset produktif jangka panjang (pabrik, jaringan telekomunikasi, infrastruktur digital). Bersifat netral: tinggi di sektor infrastruktur/ekspansi, rendah di bisnis asset-light.",
    polarity: "neutral",
    unit: "billion_idr",
    isLiveReactive: false,
    benchmarkHint: "Nilai kontekstual sesuai fase ekspansi",
  },
  {
    id: "sgr",
    categoryId: "aruskas",
    label: "Sustainable Growth Rate (SGR)",
    shortLabel: "SGR",
    formula: "ROE × (1 − DPR / 100)",
    academicGuide:
      "Laju pertumbuhan maksimum yang dapat dicapai perusahaan secara mandiri dari laba ditahan tanpa menambah utang baru atau penerbitan saham baru (Right Issue).",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Tumbuh organik tanpa tambah utang",
  },

  // 05 Dividen & Payout (3)
  {
    id: "div_yield",
    categoryId: "dividen",
    label: "Dividend Yield (Live)",
    shortLabel: "Div Yield",
    formula: "(Dividen per Saham / Harga Saham Live) × 100%",
    academicGuide:
      "Persentase pendapatan tunai tahunan relatif terhadap harga beli saat ini. Yield otomatis naik saat harga saham terkoreksi dan turun saat harga menguat.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "Bandingkan dengan bunga deposito/SBN",
  },
  {
    id: "dpr",
    categoryId: "dividen",
    label: "Dividend Payout Ratio (DPR)",
    shortLabel: "DPR",
    formula: "(Dividen per Saham / EPS TTM) × 100%",
    academicGuide:
      "Proporsi laba bersih yang dibagikan sebagai dividen. Zona sehat berkelanjutan adalah 20%–85% (titik seimbang ~55%). DPR > 100% menandakan perusahaan menggerus kas/ekuitas untuk membayar dividen.",
    polarity: "optimal_dpr",
    unit: "percent",
    isLiveReactive: false,
    benchmarkHint: "Zona sehat 20%–85% (≤ 100%)",
  },
  {
    id: "div_streak",
    categoryId: "dividen",
    label: "Konsistensi Dividen 5 Tahun",
    shortLabel: "Streak 5Y",
    formula: "Jumlah Tahun Pembagian Dividen dalam 5 Tahun Terakhir",
    academicGuide:
      "Mengukur kedisiplinan manajemen berbagi keuntungan kepada pemegang saham publik secara rutin sepanjang siklus ekonomi 5 tahun terakhir.",
    polarity: "higher_better",
    unit: "years_5",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "5 / 5 Tahun = Dividen Konsisten",
  },

  // 06 Indikator Teknikal & Risiko Pasar (6)
  {
    id: "dist_ma20",
    categoryId: "teknikal",
    label: "Posisi Harga vs MA20",
    shortLabel: "vs MA20",
    formula: "((Harga Live − MA20) / MA20) × 100%",
    academicGuide:
      "Mengukur momentum jangka pendek (~1 bulan bursa). Di atas 0% menandakan tekanan beli jangka pendek positif; terlalu jauh di atas MA20 berpotensi rawan pullback sehat.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "> 0% momentum pendek positif",
  },
  {
    id: "dist_ma200",
    categoryId: "teknikal",
    label: "Tren Utama vs MA200",
    shortLabel: "vs MA200",
    formula: "((Harga Live − MA200) / MA200) × 100%",
    academicGuide:
      "Filter tren jangka panjang standar institusional (~1 tahun bursa). Harga di atas MA200 (> 0%) mengonfirmasi struktur Uptrend utama; di bawah 0% menandakan fase Downtrend/konsolidasi.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: true,
    requirePositiveToWin: true,
    benchmarkHint: "> 0% Uptrend Utama",
  },
  {
    id: "rsi_14",
    categoryId: "teknikal",
    label: "Momentum RSI (14)",
    shortLabel: "RSI (14)",
    formula: "Wilder's Smoothed RSI 14 Hari Bursa",
    academicGuide:
      "Osilator momentum 0–100: < 35 Oversold (jenuh jual, peluang pantulan), 35–69 Netral Sehat, ≥ 70 Overbought (jenuh beli, rawan koreksi wajar).",
    polarity: "neutral",
    unit: "score",
    isLiveReactive: false,
    benchmarkHint: "< 35 Oversold • ≥ 70 Overbought",
  },
  {
    id: "atr_pct",
    categoryId: "teknikal",
    label: "Volatilitas Harian ATR (14)",
    shortLabel: "ATR %",
    formula: "(Average True Range 14 Hari / Harga Penutupan) × 100%",
    academicGuide:
      "Mengukur rata-rata ayunan harga harian dalam persen. ATR rendah menandakan pergerakan harga lebih tenang dan stabil untuk penempatan modal besar.",
    polarity: "lower_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: true,
    benchmarkHint: "Makin rendah makin stabil",
  },
  {
    id: "max_dd_1y",
    categoryId: "teknikal",
    label: "Maximum Drawdown 1 Tahun",
    shortLabel: "Max DD 1Y",
    formula: "Penurunan Maksimum dari Puncak ke Lembah (252 Hari Bursa)",
    academicGuide:
      "Mengukur skenario terburuk penurunan modal dalam 1 tahun terakhir. Semakin kecil kerugiannya (misal −9,4% dibanding −26,0%), semakin defensif profil risiko saham tersebut.",
    polarity: "higher_better",
    unit: "percent",
    isLiveReactive: false,
    requirePositiveToWin: false,
    benchmarkHint: "Makin kecil minusnya makin tahan banting",
  },
  {
    id: "sr_range",
    categoryId: "teknikal",
    label: "Rentang Support S1 – Resistance R1",
    shortLabel: "S1 – R1",
    formula: "Area Support Utama (S1) – Target Resistance Wajar (R1)",
    academicGuide:
      "Batas lantai permintaan (Support S1) dan atap penawaran/nilai wajar (Resistance R1) yang tersinkron langsung dengan zona harga grafik dan Decision Panel.",
    polarity: "neutral",
    unit: "price_range",
    isLiveReactive: false,
    benchmarkHint: "Acuan area cicil & ambil untung",
  },
];

export const METRIC_MAP: Record<MetricId, MetricDefinition> = Object.fromEntries(
  METRIC_DEFINITIONS.map((m) => [m.id, m])
) as Record<MetricId, MetricDefinition>;

export const ALL_CATEGORY_IDS: FundamentalCategoryId[] =
  CATEGORY_DEFINITIONS.map((c) => c.id);

export const ALL_METRIC_IDS: MetricId[] = METRIC_DEFINITIONS.map((m) => m.id);

export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined
  ) {
    return null;
  }
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

export function formatIdNumber(value: number, decimals = 1): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBillionIdr(valueBillion: number): string {
  const abs = Math.abs(valueBillion);
  const sign = valueBillion < 0 ? "-" : "";
  if (abs >= 1000) {
    return `${sign}Rp ${formatIdNumber(abs / 1000, 1)} T`;
  }
  return `${sign}Rp ${Math.round(abs).toLocaleString("id-ID")} M`;
}

export function formatSyncTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return "Menunggu sinkronisasi";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  try {
    const formatted = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
    return `${formatted} WIB`;
  } catch {
    return isoString;
  }
}

export function formatMetricValue(
  metric: MetricDefinition,
  rawValue: number | null,
  rangePair?: { s1: number; r1: number }
): string {
  if (metric.unit === "price_range") {
    if (!rangePair) return "—";
    return `${formatRupiah(rangePair.s1)} – ${rangePair.r1.toLocaleString("id-ID")}`;
  }
  if (rawValue === null || !Number.isFinite(rawValue)) return "—";

  switch (metric.unit) {
    case "multiple_x": {
      const decimals =
        metric.id === "pbv_current" ||
        metric.id === "der" ||
        metric.id === "current_ratio" ||
        metric.id === "quick_ratio"
          ? 2
          : 1;
      return `${formatIdNumber(rawValue, decimals)}x`;
    }
    case "percent": {
      const signedMetrics: MetricId[] = [
        "margin_of_safety",
        "eps_growth",
        "dist_ma20",
        "dist_ma200",
      ];
      const decimals = metric.id === "atr_pct" ? 2 : 1;
      const sign = signedMetrics.includes(metric.id) && rawValue > 0 ? "+" : "";
      return `${sign}${formatIdNumber(rawValue, decimals)}%`;
    }
    case "rupiah":
      return formatRupiah(Math.round(rawValue));
    case "billion_idr":
      return formatBillionIdr(rawValue);
    case "score": {
      const decimals = metric.id === "rsi_14" ? 1 : 2;
      return formatIdNumber(rawValue, decimals);
    }
    case "years_5":
      return `${Math.round(rawValue)} / 5 Thn`;
    default:
      return String(rawValue);
  }
}

function formatAuditField(
  metric: MetricDefinition,
  val: number | string | null | undefined,
  isPriceAudit = false
): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  if (!Number.isFinite(val)) return null;
  if (isPriceAudit) return formatRupiah(Math.round(val));
  return formatMetricValue(metric, val);
}

function resolveLiveAudit(
  metric: MetricDefinition,
  tickerAudits: Record<string, TripleCheckAudit> | undefined,
  formattedValue: string,
  isNotApplicable: boolean,
  anchor: QuarterlyAnchorData | undefined,
  lastSyncedLabel: string
): TripleCheckAudit {
  if (isNotApplicable) {
    return {
      tvValue: "N/A (Bank)",
      yfValue: "N/A (Bank)",
      gfValue: "N/A (Bank)",
      beiValue: "Standar OJK/PSAK Bank",
      spreadPct: 0,
      status: "bei_anchor",
      lastSynced: lastSyncedLabel,
      isSimulated: false,
    };
  }

  // 1. Direct metric-level 4-channel audit from FastAPI orchestrator
  const direct = tickerAudits?.[metric.id];
  if (direct) {
    return {
      tvValue: formatAuditField(metric, direct.tvValue),
      yfValue: formatAuditField(metric, direct.yfValue),
      gfValue: formatAuditField(metric, direct.gfValue),
      beiValue: formatAuditField(metric, direct.beiValue) ?? formattedValue,
      spreadPct: Number.isFinite(direct.spreadPct) ? direct.spreadPct : 0,
      status: direct.status ?? "bei_anchor",
      lastSynced: formatSyncTimestamp(direct.lastSynced) || lastSyncedLabel,
      isSimulated: Boolean(direct.isSimulated),
    };
  }

  // 2. Price-reactive metrics inherit real live 3-source price consensus audit
  const livePriceAudit = tickerAudits?.live_price;
  if (metric.isLiveReactive && livePriceAudit) {
    return {
      tvValue: formatAuditField(metric, livePriceAudit.tvValue, true),
      yfValue: formatAuditField(metric, livePriceAudit.yfValue, true),
      gfValue: formatAuditField(metric, livePriceAudit.gfValue, true),
      beiValue: formattedValue,
      spreadPct: Number.isFinite(livePriceAudit.spreadPct)
        ? livePriceAudit.spreadPct
        : 0,
      status: livePriceAudit.status ?? "verified",
      lastSynced: formatSyncTimestamp(livePriceAudit.lastSynced) || lastSyncedLabel,
      isSimulated: Boolean(livePriceAudit.isSimulated),
    };
  }

  // 3. Pure statement / quantitative engine calculation
  const isVerifiedBei = anchor?.sourceType === "BEI_VERIFIED";
  return {
    tvValue: null,
    yfValue: !isVerifiedBei && formattedValue !== "—" ? formattedValue : null,
    gfValue: null,
    beiValue: formattedValue !== "—" ? formattedValue : null,
    spreadPct: 0,
    status: "bei_anchor",
    lastSynced: lastSyncedLabel,
    isSimulated: false,
  };
}

function buildStockSubLabel(
  metric: MetricDefinition,
  rawValue: number | null,
  isBank: boolean,
  anchor: QuarterlyAnchorData | undefined,
  snap: LiveTechnicalSnapshot | undefined
): string | undefined {
  if (metric.id === "sr_range") {
    return snap ? `S1 / R1 • Live ${formatRupiah(snap.livePrice)}` : "S1 / R1";
  }
  if (rawValue === null || !Number.isFinite(rawValue)) return "Data belum tersedia";

  switch (metric.id) {
    case "per_ttm": {
      if (rawValue <= 0) return "Rugi Bersih";
      if (anchor?.sectorAvgPer && anchor.sectorAvgPer > 0) {
        const vsSector = ((rawValue - anchor.sectorAvgPer) / anchor.sectorAvgPer) * 100;
        if (vsSector <= -5) return `${formatIdNumber(Math.abs(vsSector), 0)}% < Sektor`;
        if (vsSector >= 5) return `${formatIdNumber(vsSector, 0)}% > Sektor`;
        return `≈ Sektor (${formatIdNumber(anchor.sectorAvgPer, 1)}x)`;
      }
      return undefined;
    }
    case "pbv_current":
      if (rawValue <= 0) return "Ekuitas Negatif";
      return anchor?.sectorAvgPbv
        ? `Sektor ${formatIdNumber(anchor.sectorAvgPbv, 1)}x`
        : undefined;
    case "ev_ebitda":
      if (rawValue <= 0) return "EBITDA/EV Negatif";
      if (anchor?.netDebtPerShare !== null && anchor?.netDebtPerShare !== undefined && anchor.netDebtPerShare < 0) {
        return "Net Cash";
      }
      return "Enterprise Multiple";
    case "fair_value":
      return anchor?.fiscalPeriod ?? "Model Intrinsik Live";
    case "margin_of_safety":
      if (rawValue >= 10) return "Diskon Menarik";
      if (rawValue > 0) return "Diskon Tipis";
      return "Premium / Mahal";
    case "roe":
      if (rawValue <= 0) return "Rugi Ekuitas";
      if (rawValue > 60 && (anchor?.der ?? 0) > 2) return "Ekuitas Tipis";
      return anchor?.sectorAvgRoe
        ? `Sektor ${formatIdNumber(anchor.sectorAvgRoe, 1)}%`
        : undefined;
    case "roa":
      if (rawValue <= 0) return "Negatif";
      if (isBank) return rawValue >= 2.5 ? "ROA Bank Elit" : "ROA Bank Sehat";
      return rawValue >= 10 ? "Aset Efisien" : "Moderat";
    case "gpm":
      return rawValue <= 0 ? "Margin Negatif" : rawValue >= 35 ? "Pricing Power" : "Kompetitif";
    case "opm":
      return rawValue <= 0 ? "Rugi Operasi" : rawValue >= 25 ? "Margin Tebal" : "Stabil";
    case "npm":
      return rawValue <= 0 ? "Rugi Bersih" : rawValue >= 15 ? "Profitabel" : "Normal";
    case "eps_growth":
      if (rawValue < 0) return "Kontraksi YoY";
      return rawValue >= 10 ? "Tumbuh Kuat" : "Tumbuh Stabil";
    case "der":
      if (rawValue < 0) return "Ekuitas Negatif";
      if (isBank) {
        return anchor?.bankHealth?.carPct != null
          ? `DPK Bank • CAR ${formatIdNumber(anchor.bankHealth.carPct, 1)}%`
          : "Struktur DPK Bank";
      }
      if (rawValue > 2.0) return "Leverage Tinggi";
      if (rawValue < 0.5) return "Utang Konservatif";
      return anchor?.sectorAvgDer
        ? `Sektor ${formatIdNumber(anchor.sectorAvgDer, 2)}x`
        : undefined;
    case "current_ratio":
      if (rawValue < 1.0) return "Likuiditas Ketat";
      return rawValue >= 2.0 ? "Sangat Likuid" : "Cukup Likuid";
    case "quick_ratio":
      if (rawValue < 0.8) return "Kas Ketat";
      return rawValue >= 1.5 ? "Bantalan Kuat" : "Memadai";
    case "interest_coverage":
      if (rawValue < 2.0) return "Beban Bunga Berat";
      return rawValue >= 10 ? "Sangat Aman" : "Terkendali";
    case "altman_z":
      if (rawValue > 2.99) return "Zona Aman";
      return rawValue >= 1.81 ? "Grey Area" : "Zona Distress";
    case "zmijewski_x":
      return rawValue < 0 ? "Sehat (Non-Distress)" : "Risiko Distress";
    case "ocf":
      return rawValue <= 0 ? "Arus Kas Negatif" : "Kas Operasi Positif";
    case "fcf":
      return rawValue <= 0 ? "FCF Negatif" : "Surplus Kas Bebas";
    case "capex": {
      const capexRatio = safeDivide(Math.abs(rawValue), Math.max(1, anchor?.ocfBillion ?? 0));
      return capexRatio !== null && (anchor?.ocfBillion ?? 0) > 0
        ? `${formatIdNumber(capexRatio * 100, 0)}% dari OCF`
        : "Belanja Modal";
    }
    case "sgr":
      return rawValue <= 0 ? "SGR Negatif" : "Tumbuh Mandiri";
    case "div_yield":
      return anchor?.dps != null && anchor.dps > 0
        ? `DPS ${formatRupiah(Math.round(anchor.dps))}`
        : "Yield Live";
    case "dpr":
      if (rawValue > 100) return "Melebihi Laba";
      if (rawValue >= 20 && rawValue <= 85) return "Sehat Berkelanjutan";
      if (rawValue > 85) return "Payout Agresif";
      return rawValue > 0 ? "Konservatif / Ekspansi" : "Tidak Bagi Dividen";
    case "div_streak":
      return rawValue >= 5 ? "Rutin Penuh" : rawValue >= 3 ? "Semi-Rutin" : "Terbatas";
    case "dist_ma20":
      return rawValue >= 0 ? "Di Atas MA20" : "Di Bawah MA20";
    case "dist_ma200":
      return rawValue >= 0 ? "Uptrend Utama" : "Downtrend";
    case "rsi_14":
      if (rawValue < 35) return "Oversold";
      return rawValue >= 70 ? "Overbought" : "Netral";
    case "atr_pct":
      return rawValue <= 1.5 ? "Tenang" : rawValue >= 2.2 ? "Volatil" : "Moderat";
    case "max_dd_1y":
      if (rawValue <= -25) return "Drawdown Dalam";
      return rawValue >= -12 ? "Defensif" : "Wajar BEI";
    default:
      return undefined;
  }
}

function evaluateLiveStockCell(
  column: MatrixColumnDescriptor,
  metric: MetricDefinition,
  rawEntry: RawMetricApiValue | undefined,
  anchor: QuarterlyAnchorData | undefined,
  snap: LiveTechnicalSnapshot | undefined,
  tickerAudits: Record<string, TripleCheckAudit> | undefined,
  isCrossSector: boolean,
  lastSyncedLabel: string
): EvaluatedCell {
  const isBank = column.accountingType === "banking";

  if ((isBank && metric.notApplicableForBanking) || rawEntry?.isNotApplicable) {
    const subLabel =
      metric.id === "gpm"
        ? "Bank pakai NIM"
        : metric.id === "zmijewski_x" || metric.id === "altman_z"
          ? "Non-Bank • Cek CAR/NPL"
          : "Struktur Neraca Bank";
    return {
      columnId: column.id,
      rawValue: null,
      formattedValue: "N/A (Bank)",
      subLabel,
      isNotApplicable: true,
      isWarning: false,
      isWinner: false,
      comparisonScore: null,
      audit: resolveLiveAudit(
        metric,
        tickerAudits,
        "N/A (Bank)",
        true,
        anchor,
        lastSyncedLabel
      ),
    };
  }

  const rawValue =
    rawEntry?.rawValue !== null &&
    rawEntry?.rawValue !== undefined &&
    Number.isFinite(rawEntry.rawValue)
      ? rawEntry.rawValue
      : null;

  const isWarning = Boolean(rawEntry?.isWarning);
  const rangePair =
    metric.id === "sr_range" &&
    rawEntry?.support1 != null &&
    rawEntry?.resistance1 != null
      ? { s1: rawEntry.support1, r1: rawEntry.resistance1 }
      : undefined;

  const formattedValue = formatMetricValue(metric, rawValue, rangePair);
  const subLabel = buildStockSubLabel(metric, rawValue, isBank, anchor, snap);

  let comparisonScore: number | null = rawValue;
  if (
    metric.id === "der" &&
    isCrossSector &&
    rawValue !== null &&
    rawValue >= 0 &&
    anchor?.sectorAvgDer &&
    anchor.sectorAvgDer > 0
  ) {
    comparisonScore = safeDivide(rawValue, anchor.sectorAvgDer);
  }

  return {
    columnId: column.id,
    rawValue,
    formattedValue,
    subLabel,
    isNotApplicable: false,
    isWarning,
    isWinner: false,
    comparisonScore,
    audit: resolveLiveAudit(
      metric,
      tickerAudits,
      formattedValue,
      false,
      anchor,
      lastSyncedLabel
    ),
  };
}

function evaluateLiveBenchmarkCell(
  column: MatrixColumnDescriptor,
  metric: MetricDefinition,
  benchmark: BenchmarkApiData | null | undefined,
  lastSyncedLabel: string
): EvaluatedCell {
  const isBank = column.accountingType === "banking";

  if (isBank && metric.notApplicableForBanking) {
    return {
      columnId: column.id,
      rawValue: null,
      formattedValue: "N/A (Bank)",
      subLabel: "Standar Bank",
      isNotApplicable: true,
      isWarning: false,
      isWinner: false,
      comparisonScore: null,
      audit: {
        tvValue: "N/A (Bank)",
        yfValue: "N/A (Bank)",
        gfValue: "N/A (Bank)",
        beiValue: "Standar OJK/PSAK Bank",
        spreadPct: 0,
        status: "bei_anchor",
        lastSynced: lastSyncedLabel,
        isSimulated: false,
      },
    };
  }

  let rawValue: number | null = null;
  if (benchmark) {
    switch (metric.id) {
      case "per_ttm":
        rawValue = benchmark.per ?? null;
        break;
      case "pbv_current":
        rawValue = benchmark.pbv ?? null;
        break;
      case "ev_ebitda":
        rawValue = benchmark.evEbitda ?? null;
        break;
      case "roe":
        rawValue = benchmark.roe ?? null;
        break;
      case "roa":
        rawValue = benchmark.roa ?? null;
        break;
      case "gpm":
        rawValue = benchmark.gpm ?? null;
        break;
      case "opm":
        rawValue = benchmark.opm ?? null;
        break;
      case "npm":
        rawValue = benchmark.npm ?? null;
        break;
      case "eps_growth":
        rawValue = benchmark.epsGrowthYoY ?? null;
        break;
      case "der":
        rawValue = benchmark.der ?? null;
        break;
      case "current_ratio":
        rawValue = benchmark.currentRatio ?? null;
        break;
      case "quick_ratio":
        rawValue = benchmark.quickRatio ?? null;
        break;
      case "interest_coverage":
        rawValue = benchmark.interestCoverage ?? null;
        break;
      case "altman_z":
        rawValue = benchmark.altmanZ ?? null;
        break;
      case "zmijewski_x":
        rawValue = benchmark.zmijewskiX ?? null;
        break;
      case "sgr":
        if (benchmark.roe != null && benchmark.dpr != null) {
          rawValue = Number((benchmark.roe * (1 - benchmark.dpr / 100)).toFixed(1));
        }
        break;
      case "div_yield":
        rawValue = benchmark.divYield ?? null;
        break;
      case "dpr":
        rawValue = benchmark.dpr ?? null;
        break;
      case "div_streak":
        rawValue = benchmark.dividendStreak5Y ?? null;
        break;
      default:
        rawValue = null;
    }
  }

  if (rawValue !== null && !Number.isFinite(rawValue)) {
    rawValue = null;
  }

  const formattedValue =
    metric.id === "sr_range" ? "—" : formatMetricValue(metric, rawValue);
  const subLabel =
    rawValue === null
      ? "—"
      : column.kind === "sector_avg"
        ? "Median Peer Likuid"
        : benchmark?.periodsSampled
          ? `Rata-rata ${benchmark.periodsSampled} Thn`
          : "Historis Multi-Thn";

  return {
    columnId: column.id,
    rawValue,
    formattedValue,
    subLabel,
    isNotApplicable: false,
    isWarning: false,
    isWinner: false,
    comparisonScore: rawValue,
    audit: {
      tvValue: null,
      yfValue: null,
      gfValue: null,
      beiValue: formattedValue !== "—" ? formattedValue : null,
      spreadPct: 0,
      status: "bei_anchor",
      lastSynced: lastSyncedLabel,
      isSimulated: false,
    },
  };
}

function pickRowWinners(
  metric: MetricDefinition,
  columns: MatrixColumnDescriptor[],
  cells: Record<string, EvaluatedCell>,
  isSingleStockMode: boolean
): string[] {
  if (metric.polarity === "neutral") return [];

  const validCandidates = columns
    .map((col) => ({ col, cell: cells[col.id] }))
    .filter(({ cell }) => {
      if (!cell || cell.isNotApplicable || cell.rawValue === null) return false;
      if (!Number.isFinite(cell.rawValue)) return false;
      return true;
    });

  if (validCandidates.length < 2) return [];

  const eligible = validCandidates.filter(({ cell }) => {
    const val = cell.rawValue as number;

    if (metric.polarity === "lower_positive_better") {
      return val > 0 && !cell.isWarning;
    }
    if (metric.polarity === "optimal_dpr") {
      return val >= 20 && val <= 85 && !cell.isWarning;
    }
    if (metric.id === "zmijewski_x") {
      return val < 0;
    }
    if (metric.id === "altman_z") {
      return val >= 1.81;
    }
    if (metric.requirePositiveToWin) {
      return val > 0;
    }
    return true;
  });

  if (eligible.length === 0) return [];

  const scored = eligible.map(({ col, cell }) => {
    const compareVal = cell.comparisonScore ?? (cell.rawValue as number);
    let rankScore: number;

    if (metric.polarity === "higher_better") {
      rankScore = compareVal;
    } else if (
      metric.polarity === "lower_positive_better" ||
      metric.polarity === "lower_better"
    ) {
      rankScore = -compareVal;
    } else if (metric.polarity === "optimal_dpr") {
      rankScore = -Math.abs(compareVal - 55);
    } else {
      rankScore = 0;
    }

    return { colId: col.id, rankScore };
  });

  const bestScore = Math.max(...scored.map((s) => s.rankScore));
  const winners = scored
    .filter((s) => Math.abs(s.rankScore - bestScore) <= 1e-4)
    .map((s) => s.colId);

  if (isSingleStockMode) {
    const stockColId = columns[0]?.id;
    return stockColId && winners.includes(stockColId) ? [stockColId] : [];
  }

  return winners;
}

/**
 * 100% Live Comparison Matrix Adapter consuming `/api/compare` (FastAPI + Supabase).
 * Zero mock prices, zero hardcoded anchors, zero fabricated benchmarks.
 */
export function evaluateLiveComparisonMatrix(
  compareData: CompareApiResponse | null,
  activeTickers: string[],
  hiddenMetricIds: string[]
): EvaluatedComparisonMatrix {
  const stockMap = new Map(
    (compareData?.stocks ?? []).map((item) => [item.ticker, item])
  );
  const orderedTickers =
    activeTickers.length > 0
      ? activeTickers
      : (compareData?.activeTickers ?? []);

  const isSingleStockMode = orderedTickers.length === 1;
  const sectors = new Set(
    orderedTickers.map((t) => stockMap.get(t)?.sector).filter(Boolean)
  );
  const isCrossSector = compareData?.isCrossSector ?? sectors.size > 1;
  const lastSyncedLabel = formatSyncTimestamp(compareData?.syncedAt);

  const columns: MatrixColumnDescriptor[] = [];

  for (const ticker of orderedTickers) {
    const stock = stockMap.get(ticker);
    const anchor = compareData?.quarterlyAnchors[ticker];
    const snap = compareData?.liveSnapshots[ticker];

    columns.push({
      id: ticker,
      kind: "stock",
      ticker,
      label: ticker,
      subLabel: stock?.sector ?? "Menunggu data BEI",
      sector: stock?.sector ?? "—",
      accountingType: stock?.accountingType ?? "general",
      livePrice: snap?.livePrice ?? stock?.price ?? null,
      changePercent: snap?.changePercent ?? stock?.changePercent ?? null,
      bankHealth: anchor?.bankHealth ?? null,
    });
  }

  // Strictly append Sector Peer & Multi-Year Historical benchmarks ONLY in Single-Stock Mode
  if (isSingleStockMode && orderedTickers[0]) {
    const primaryCol = columns[0];
    const sectorBench =
      compareData?.sectorBenchmark ??
      compareData?.sectorBenchmarksByTicker?.[orderedTickers[0]] ??
      null;
    const histBench =
      compareData?.historical5YBenchmark ??
      compareData?.historical5YBenchmarksByTicker?.[orderedTickers[0]] ??
      null;

    columns.push(
      {
        id: "__sector_avg__",
        kind: "sector_avg",
        ticker: "SEKTOR",
        label: "Rata-Rata Sektor",
        subLabel: sectorBench?.sector ?? primaryCol.sector,
        sector: primaryCol.sector,
        accountingType: primaryCol.accountingType,
        livePrice: null,
        changePercent: null,
        bankHealth: null,
      },
      {
        id: "__history_5y__",
        kind: "history_5y",
        ticker: "HIST 5Y",
        label: "Historis Multi-Thn",
        subLabel: histBench?.periodsSampled
          ? `Rata-rata ${orderedTickers[0]} (${histBench.periodsSampled}Y)`
          : `Historis ${orderedTickers[0]}`,
        sector: primaryCol.sector,
        accountingType: primaryCol.accountingType,
        livePrice: null,
        changePercent: null,
        bankHealth: null,
      }
    );
  }

  const hiddenSet = new Set(hiddenMetricIds);
  const singleTicker = orderedTickers[0];
  const singleSectorBench = singleTicker
    ? (compareData?.sectorBenchmark ??
        compareData?.sectorBenchmarksByTicker?.[singleTicker] ??
        null)
    : null;
  const singleHistBench = singleTicker
    ? (compareData?.historical5YBenchmark ??
        compareData?.historical5YBenchmarksByTicker?.[singleTicker] ??
        null)
    : null;

  const categories: EvaluatedCategoryGroup[] = CATEGORY_DEFINITIONS.map(
    (category) => {
      const categoryMetrics = METRIC_DEFINITIONS.filter(
        (m) => m.categoryId === category.id
      );
      const visibleCategoryMetrics = categoryMetrics.filter(
        (m) => !hiddenSet.has(m.id)
      );

      const winCounts: Record<string, number> = {};
      for (const col of columns) winCounts[col.id] = 0;

      const rows: EvaluatedMetricRow[] = visibleCategoryMetrics.map((metric) => {
        const cells: Record<string, EvaluatedCell> = {};

        for (const col of columns) {
          if (col.kind === "stock") {
            cells[col.id] = evaluateLiveStockCell(
              col,
              metric,
              compareData?.metrics?.[col.ticker]?.[metric.id],
              compareData?.quarterlyAnchors?.[col.ticker],
              compareData?.liveSnapshots?.[col.ticker],
              compareData?.audits?.[col.ticker],
              isCrossSector,
              lastSyncedLabel
            );
          } else if (col.kind === "sector_avg") {
            cells[col.id] = evaluateLiveBenchmarkCell(
              col,
              metric,
              singleSectorBench,
              lastSyncedLabel
            );
          } else {
            cells[col.id] = evaluateLiveBenchmarkCell(
              col,
              metric,
              singleHistBench,
              lastSyncedLabel
            );
          }
        }

        const winnerColumnIds = pickRowWinners(
          metric,
          columns,
          cells,
          isSingleStockMode
        );
        for (const winId of winnerColumnIds) {
          if (cells[winId]) {
            cells[winId].isWinner = true;
            winCounts[winId] = (winCounts[winId] ?? 0) + 1;
          }
        }

        const sectorBenchmarkNote =
          isCrossSector && metric.id === "der"
            ? "Normalized vs Sektor Masing-Masing"
            : metric.benchmarkHint;

        return {
          metric,
          cells,
          winnerColumnIds,
          sectorBenchmarkNote,
        };
      });

      const stockCols = columns.filter((c) => c.kind === "stock");
      let winnerColumnId: string | null = null;
      let winnerLabel: string | null = null;
      let winnerWinCount = 0;

      if (isSingleStockMode && stockCols[0]) {
        const colId = stockCols[0].id;
        const wins = winCounts[colId] ?? 0;
        if (wins > 0) {
          winnerColumnId = colId;
          winnerLabel = `${colId} (${wins} unggul vs benchmark)`;
          winnerWinCount = wins;
        }
      } else {
        const ranked = stockCols
          .map((c) => ({
            id: c.id,
            label: c.label,
            wins: winCounts[c.id] ?? 0,
            quantScore: stockMap.get(c.ticker)?.quantScore ?? 0,
          }))
          .filter((entry) => entry.wins > 0)
          .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.quantScore - a.quantScore;
          });

        if (ranked.length > 0) {
          const top = ranked[0];
          const second = ranked[1];
          if (second && second.wins === top.wins) {
            winnerColumnId = top.id;
            winnerLabel = `Imbang ${top.label}/${second.label}`;
            winnerWinCount = top.wins;
          } else {
            winnerColumnId = top.id;
            winnerLabel = top.label;
            winnerWinCount = top.wins;
          }
        }
      }

      return {
        category,
        rows,
        totalMetricCount: categoryMetrics.length,
        visibleMetricCount: visibleCategoryMetrics.length,
        winnerColumnId,
        winnerLabel,
        winnerWinCount,
        winCounts,
      };
    }
  );

  const visibleMetrics = categories.reduce(
    (sum, group) => sum + group.visibleMetricCount,
    0
  );

  const findCatWinner = (id: FundamentalCategoryId): string | null =>
    categories.find((c) => c.category.id === id)?.winnerLabel ?? null;

  const bankingColumns = columns.filter(
    (c) => c.kind === "stock" && c.accountingType === "banking"
  );

  return {
    isSingleStockMode,
    isCrossSector,
    columns,
    categories,
    totalMetrics: METRIC_DEFINITIONS.length,
    visibleMetrics,
    bankingColumns,
    overallSummary: {
      valuasiWinner: findCatWinner("valuasi"),
      profitabilitasWinner: findCatWinner("profitabilitas"),
      kesehatanWinner: findCatWinner("kesehatan"),
      dividenWinner: findCatWinner("dividen"),
    },
    generatedAt: lastSyncedLabel,
  };
}

/**
 * Generates an Excel-friendly UTF-8 BOM CSV export of the active live fundamental matrix.
 */
export function buildMatrixCsv(matrix: EvaluatedComparisonMatrix): string {
  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = [
    "Kategori",
    "Indikator",
    "Rumus",
    ...matrix.columns.map((c) =>
      c.livePrice !== null ? `${c.label} (${formatRupiah(c.livePrice)})` : c.label
    ),
    "Pemenang Baris",
  ];

  const lines: string[] = [header.map(escapeCsv).join(",")];

  for (const group of matrix.categories) {
    for (const row of group.rows) {
      const winners = row.winnerColumnIds.join(" / ") || "-";
      const cols = [
        `${group.category.numberLabel} ${group.category.title}`,
        row.metric.label,
        row.metric.formula,
        ...matrix.columns.map((c) => {
          const cell = row.cells[c.id];
          return cell ? cell.formattedValue : "-";
        }),
        winners,
      ];
      lines.push(cols.map(escapeCsv).join(","));
    }
  }

  return `\uFEFF${lines.join("\n")}`;
}
