-- =========================================================================
-- EQUILENS IDX: OPTIONAL POSTGRES HARDENING (IDEMPOTENT / NON-BREAKING)
-- Mengacu pada supabase-postgres-best-practices:
-- 1. pg_trgm GIN index untuk pencarian cepat ~940+ emiten (ticker + nama)
-- 2. Autovacuum anti-bloat pada tabel high-churn UPSERT (Kamar 3 & Kamar 4)
-- 3. Explicit TO anon, authenticated pada kebijakan RLS SELECT
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_master_emiten_name_trgm
    ON public.master_emiten USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_master_emiten_ticker_trgm
    ON public.master_emiten USING gin (ticker gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_live_market_cap_desc
    ON public.live_market_cache (market_cap DESC NULLS LAST);

-- Anti-Bloat Autovacuum Tuning untuk tabel yang sering di-UPSERT
ALTER TABLE public.live_market_cache SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.audit_validasi SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

-- Eksplisitkan role SELECT ke anon & authenticated (zero write permission dari browser)
DROP POLICY IF EXISTS "Public read master_emiten" ON public.master_emiten;
CREATE POLICY "Public read master_emiten"
    ON public.master_emiten FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read fundamental_kuartal" ON public.fundamental_kuartal;
CREATE POLICY "Public read fundamental_kuartal"
    ON public.fundamental_kuartal FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read live_market_cache" ON public.live_market_cache;
CREATE POLICY "Public read live_market_cache"
    ON public.live_market_cache FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read audit_validasi" ON public.audit_validasi;
CREATE POLICY "Public read audit_validasi"
    ON public.audit_validasi FOR SELECT TO anon, authenticated USING (true);
