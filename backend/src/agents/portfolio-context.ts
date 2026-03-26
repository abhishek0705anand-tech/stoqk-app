import { supabase } from "../lib/supabase.js";
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
  
  // Fetch sectors for these tickers
  const { data: fundData } = await supabase
    .from("company_fundamentals")
    .select("ticker, sector")
    .in("ticker", holdings.map(h => h.ticker));
  
  const sectorMap = Object.fromEntries((fundData || []).map(f => [f.ticker, f.sector]));

  let totalValue = 0;
  let totalCost = 0;
  let topGainer: { ticker: string; pnl_pct: number } | null = null;
  let topLoser: { ticker: string; pnl_pct: number } | null = null;
  const sectorValues: Record<string, number> = {};

  for (const h of holdings) {
    const price = priceMap[h.ticker]?.price || h.avg_buy_price;
    const currentVal = price * h.qty;
    const costBasis = h.avg_buy_price * h.qty;
    
    totalValue += currentVal;
    totalCost += costBasis;

    const pnlPct = ((price - h.avg_buy_price) / h.avg_buy_price) * 100;
    
    if (!topGainer || pnlPct > topGainer.pnl_pct) topGainer = { ticker: h.ticker, pnl_pct: pnlPct };
    if (!topLoser || pnlPct < topLoser.pnl_pct) topLoser = { ticker: h.ticker, pnl_pct: pnlPct };

    const sector = sectorMap[h.ticker] || "Other";
    sectorValues[sector] = (sectorValues[sector] || 0) + currentVal;
  }

  const sectorExposure: Record<string, number> = {};
  if (totalValue > 0) {
    for (const [sector, value] of Object.entries(sectorValues)) {
      sectorExposure[sector] = (value / totalValue) * 100;
    }
  }

  const activeSignalsOnHoldings = activeSignals
    .filter(s => holdings.some(h => h.ticker === s.ticker))
    .map(s => ({
      ticker: s.ticker,
      significance_score: s.significance_score,
      plain_summary: s.plain_summary,
      event_type: s.event_type
    }));

  return {
    total_current_value: Math.round(totalValue * 100) / 100,
    total_unrealised_pnl: Math.round((totalValue - totalCost) * 100) / 100,
    total_unrealised_pnl_pct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    top_gainer: topGainer,
    top_loser: topLoser,
    sector_exposure: sectorExposure,
    active_signals_on_holdings: activeSignalsOnHoldings
  };
}
