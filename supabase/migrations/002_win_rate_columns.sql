-- Migration to add win-rate tracking columns to signals
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS entry_price NUMERIC(18,4);
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS perf_1d NUMERIC(8,4);
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS perf_7d NUMERIC(8,4);
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS perf_30d NUMERIC(8,4);
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS outcome_profitable BOOLEAN;

COMMENT ON COLUMN public.signals.entry_price IS 'Stock price at the time the signal was detected';
COMMENT ON COLUMN public.signals.perf_30d IS 'Percentage return after 30 days';
