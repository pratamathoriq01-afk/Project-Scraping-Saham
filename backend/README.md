# EquiLens Backend (Python / uv)

Kerangka backend untuk pipeline scraping data emiten BEI (IDX), quantitative scoring engine, dan sinkronisasi database Supabase.

## Struktur Direktori
- `scrapers/` — Worker penarik data harga EOD, fundamental laporan keuangan, dan benchmark sektor (Fase 1).
- `quant_engine/` — Kalkulasi rasio finansial, normalisasi persentil sektor (Bank vs Non-Bank), dan scoring model (Fase 2–3).
- `database/` — Skema SQL, utilitas upsert ke Supabase, dan log freshness data.

> Dependensi Python akan diinisialisasi menggunakan `uv` pada Fase 1.
