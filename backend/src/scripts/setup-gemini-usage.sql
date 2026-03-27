-- Run this once in the Supabase SQL editor to enable daily Gemini call rate limiting.

-- Table: one row per day, tracks total Gemini calls
CREATE TABLE IF NOT EXISTS gemini_usage (
  date       DATE    PRIMARY KEY DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL    DEFAULT 0,
  updated_at TIMESTAMPTZ         DEFAULT now()
);

-- Atomic increment function — increments today's counter and returns the new value.
-- Using a function ensures the increment + read is a single atomic operation,
-- safe across parallel Vercel function invocations.
CREATE OR REPLACE FUNCTION increment_gemini_usage(usage_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO gemini_usage (date, call_count, updated_at)
    VALUES (usage_date, 1, now())
  ON CONFLICT (date) DO UPDATE
    SET call_count = gemini_usage.call_count + 1,
        updated_at = now()
  RETURNING call_count INTO new_count;

  RETURN new_count;
END;
$$;
