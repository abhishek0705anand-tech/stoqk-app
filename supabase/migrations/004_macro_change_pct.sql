-- Add daily change % columns to macro_indicators
ALTER TABLE public.macro_indicators
  ADD COLUMN IF NOT EXISTS nifty_change_pct  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sensex_change_pct DOUBLE PRECISION;
