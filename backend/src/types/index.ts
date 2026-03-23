export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "trader";
export type PrimaryGoal = "wealth_building" | "inflation_beat" | "income" | "aggressive_growth";
export type RiskTolerance = "low" | "medium" | "high";
export type InvestmentHorizon = "short" | "medium" | "long" | "very_long";
export type PortfolioSizeBucket = "under_1L" | "1L_to_10L" | "above_10L";
export type EventType =
  | "bulk_deal"
  | "insider_buy"
  | "insider_sell"
  | "pledge_increase"
  | "pledge_reduction"
  | "promoter_buy"
  | "block_deal"
  | "qip";
export type Urgency = "high" | "medium" | "low";

export interface UserProfile {
  id: string;
  experience_level: ExperienceLevel;
  primary_goal: PrimaryGoal;
  risk_tolerance: RiskTolerance;
  investment_horizon: InvestmentHorizon;
  preferred_sectors: string[];
  portfolio_size_bucket: PortfolioSizeBucket;
  top_holdings: string[];
  sector_concentration: Record<string, number>;
  profile_block: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserHolding {
  id: string;
  user_id: string;
  ticker: string;
  qty: number;
  avg_buy_price: number;
  updated_at: string;
}

export interface Signal {
  id: string;
  ticker: string;
  event_type: EventType;
  significance_score: number;
  plain_summary: string;
  historical_context: string | null;
  raw_data: Record<string, unknown>;
  detected_at: string;
}

export interface ChartPattern {
  id: string;
  ticker: string;
  pattern_name: string;
  detected_at: string;
  plain_explanation: string;
  what_to_watch: string;
  historical_win_rate: number;
  avg_move_pct: number;
  horizon_note: string;
}

export interface MacroIndicator {
  date: string;
  nifty_close: number;
  sensex_close: number;
  nifty_change_pct: number;
  sensex_change_pct: number;
  fii_net_cr: number;
  dii_net_cr: number;
  repo_rate: number;
}

export interface DailyBrief {
  id: string;
  user_id: string;
  date: string;
  brief_json: {
    opening: string;
    market_snapshot: string;
    fii_dii: string;
    top_signal: string;
    portfolio_update: string | null;
    watch_today: string;
  };
  viewed_at: string | null;
}

export interface OnboardingAnswers {
  experience_level: ExperienceLevel;
  primary_goal: PrimaryGoal;
  risk_tolerance: RiskTolerance;
  investment_horizon: InvestmentHorizon;
  preferred_sectors: string[];
}

export interface LivePrice {
  ticker: string;
  price: number;
  change_pct: number;
  volume: number;
  timestamp: string;
}

export interface PortfolioContext {
  total_current_value: number;
  total_unrealised_pnl: number;
  total_unrealised_pnl_pct: number;
  top_gainer: { ticker: string; pnl_pct: number } | null;
  top_loser: { ticker: string; pnl_pct: number } | null;
  sector_exposure: Record<string, number>;
  active_signals_on_holdings: Array<{
    ticker: string;
    significance_score: number;
    plain_summary: string;
    event_type: EventType;
  }>;
}

export interface AlertDecision {
  should_notify: boolean;
  push_copy: string;
  urgency: Urgency;
  reason: string;
}

export interface NSERawEvent {
  symbol: string;
  company: string;
  date: string;
  acquirerName?: string;
  noOfSharesBought?: number;
  noOfSharesSold?: number;
  buyValue?: number;
  sellValue?: number;
  buyPercent?: number;
  sellPercent?: number;
  typeOfTransaction?: string;
  [key: string]: unknown;
}
