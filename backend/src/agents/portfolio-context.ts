import { runAgent, FAST_MODEL } from "../lib/anthropic.js";
import type { UserProfile, UserHolding, LivePrice, Signal, PortfolioContext } from "../types/index.js";

const SYSTEM_PROMPT = `You are building a compact portfolio context block for injection into another agent's prompt. Be precise, not verbose.

Given holdings, live prices, and active signals, compute and return JSON with exactly these keys:
1. total_current_value — sum of current value of all holdings in INR
2. total_unrealised_pnl — absolute P&L in INR (current value minus cost basis)
3. total_unrealised_pnl_pct — percentage P&L
4. top_gainer — { ticker, pnl_pct } or null
5. top_loser — { ticker, pnl_pct } or null
6. sector_exposure — object of sector → percentage at current prices
7. active_signals_on_holdings — array of { ticker, significance_score, plain_summary, event_type } for signals where ticker matches a holding

Keep output under 300 tokens. Output JSON only. No markdown.`;

export async function buildPortfolioContext(
  profile: UserProfile,
  holdings: UserHolding[],
  livePrices: LivePrice[],
  activeSignals: Signal[]
): Promise<PortfolioContext> {
  if (!holdings.length) {
    return {
      total_current_value: 0,
      total_unrealised_pnl: 0,
      total_unrealised_pnl_pct: 0,
      top_gainer: null,
      top_loser: null,
      sector_exposure: {},
      active_signals_on_holdings: [],
    };
  }

  const priceMap = Object.fromEntries(livePrices.map((p) => [p.ticker, p]));

  const userContent = `USER_PROFILE:\n${profile.profile_block}\n\nUSER_HOLDINGS:\n${JSON.stringify(holdings)}\n\nLIVE_PRICES:\n${JSON.stringify(priceMap)}\n\nACTIVE_SIGNALS:\n${JSON.stringify(activeSignals.slice(0, 20))}`;

  return runAgent<PortfolioContext>(SYSTEM_PROMPT, userContent, FAST_MODEL);
}
