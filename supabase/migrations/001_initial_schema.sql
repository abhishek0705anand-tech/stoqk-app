-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- MARKET DATA TABLES (created first — referenced by user tables)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.signals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker              TEXT NOT NULL,
  event_type          TEXT NOT NULL CHECK (event_type IN (
                        'bulk_deal','insider_buy','insider_sell',
                        'pledge_increase','pledge_reduction','promoter_buy',
                        'block_deal','qip'
                      )),
  significance_score  INTEGER NOT NULL CHECK (significance_score BETWEEN 0 AND 100),
  plain_summary       TEXT NOT NULL,
  historical_context  TEXT,
  raw_data            JSONB NOT NULL DEFAULT '{}',
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_ticker ON public.signals(ticker);
CREATE INDEX idx_signals_score ON public.signals(significance_score DESC);
CREATE INDEX idx_signals_detected_at ON public.signals(detected_at DESC);
CREATE INDEX idx_signals_event_type ON public.signals(event_type);

CREATE TABLE public.chart_patterns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker                TEXT NOT NULL,
  pattern_name          TEXT NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plain_explanation     TEXT NOT NULL,
  what_to_watch         TEXT NOT NULL,
  historical_win_rate   NUMERIC(5,2),
  avg_move_pct          NUMERIC(8,4),
  horizon_note          TEXT
);

CREATE INDEX idx_chart_patterns_ticker ON public.chart_patterns(ticker);
CREATE INDEX idx_chart_patterns_detected_at ON public.chart_patterns(detected_at DESC);

CREATE TABLE public.stock_prices (
  ticker    TEXT NOT NULL,
  date      DATE NOT NULL,
  open      NUMERIC(18,4),
  high      NUMERIC(18,4),
  low       NUMERIC(18,4),
  close     NUMERIC(18,4),
  volume    BIGINT,
  PRIMARY KEY (ticker, date)
);

CREATE INDEX idx_stock_prices_ticker_date ON public.stock_prices(ticker, date DESC);

CREATE TABLE public.company_fundamentals (
  ticker                TEXT PRIMARY KEY,
  pe                    NUMERIC(10,2),
  roe                   NUMERIC(10,4),
  debt_equity           NUMERIC(10,4),
  revenue_growth_pct    NUMERIC(10,4),
  promoter_holding_pct  NUMERIC(10,4),
  pledge_pct            NUMERIC(10,4),
  market_cap_cr         NUMERIC(18,2),
  sector                TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.macro_indicators (
  date          DATE PRIMARY KEY,
  nifty_close   NUMERIC(12,2),
  sensex_close  NUMERIC(12,2),
  fii_net_cr    NUMERIC(14,2),
  dii_net_cr    NUMERIC(14,2),
  repo_rate     NUMERIC(6,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USER TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level      TEXT NOT NULL CHECK (experience_level IN ('beginner','intermediate','advanced','trader')),
  primary_goal          TEXT NOT NULL CHECK (primary_goal IN ('wealth_building','inflation_beat','income','aggressive_growth')),
  risk_tolerance        TEXT NOT NULL CHECK (risk_tolerance IN ('low','medium','high')),
  investment_horizon    TEXT NOT NULL CHECK (investment_horizon IN ('short','medium','long','very_long')),
  preferred_sectors     TEXT[]        NOT NULL DEFAULT '{}',
  portfolio_size_bucket TEXT          NOT NULL DEFAULT 'under_1L' CHECK (portfolio_size_bucket IN ('under_1L','1L_to_10L','above_10L')),
  top_holdings          TEXT[]        NOT NULL DEFAULT '{}',
  sector_concentration  JSONB         NOT NULL DEFAULT '{}',
  profile_block         TEXT          NOT NULL DEFAULT '',
  onboarding_completed  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_holdings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ticker          TEXT NOT NULL,
  qty             NUMERIC(18,4) NOT NULL CHECK (qty > 0),
  avg_buy_price   NUMERIC(18,4) NOT NULL CHECK (avg_buy_price > 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

CREATE TABLE public.user_watchlist (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ticker    TEXT NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

CREATE TABLE public.user_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  signal_id   UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  push_copy   TEXT NOT NULL,
  urgency     TEXT NOT NULL CHECK (urgency IN ('high','medium','low')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.daily_briefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  brief_json  JSONB NOT NULL,
  viewed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_daily_briefs_user_date ON public.daily_briefs(user_id, date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_holdings_updated_at
  BEFORE UPDATE ON public.user_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_indicators ENABLE ROW LEVEL SECURITY;

-- User can only access their own data
CREATE POLICY "user_profiles_self" ON public.user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "user_holdings_self" ON public.user_holdings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_watchlist_self" ON public.user_watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_notifications_self" ON public.user_notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "daily_briefs_self" ON public.daily_briefs FOR ALL USING (auth.uid() = user_id);

-- Market data: anyone can read
CREATE POLICY "signals_public_read" ON public.signals FOR SELECT USING (true);
CREATE POLICY "chart_patterns_public_read" ON public.chart_patterns FOR SELECT USING (true);
CREATE POLICY "stock_prices_public_read" ON public.stock_prices FOR SELECT USING (true);
CREATE POLICY "fundamentals_public_read" ON public.company_fundamentals FOR SELECT USING (true);
CREATE POLICY "macro_public_read" ON public.macro_indicators FOR SELECT USING (true);
