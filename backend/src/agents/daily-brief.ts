import { runAgent, FAST_MODEL } from "../lib/anthropic.js";
import type { UserProfile, Signal, MacroIndicator, PortfolioContext } from "../types/index.js";

interface DailyBriefOutput {
  opening: string;
  market_snapshot: string;
  fii_dii: string;
  top_signal: string;
  portfolio_update: string | null;
  watch_today: string;
}

const SYSTEM_PROMPT = `You are writing a personalised morning market brief for an Indian investor. It will be displayed as cards in a mobile app — not spoken aloud.

Structure the brief in exactly this order:
1. opening — one striking market fact from today. Concise and punchy.
2. market_snapshot — Nifty and Sensex change. If experience_level is beginner, one sentence on what this means.
3. fii_dii — FII and DII net buy/sell figures in crores. If beginner, explain what FII/DII means in brackets.
4. top_signal — the highest scoring signal. Use the personalised plain_summary. Keep it concise.
5. portfolio_update — best performer, worst performer, total P&L today. null if no portfolio data.
6. watch_today — the single most important thing for this user to monitor today based on holdings and preferred sectors. One sentence.

Calibrate tone to experience_level:
- beginner: reassuring, no jargon, warm
- intermediate: factual and clear
- advanced / trader: direct, fast, data-first

Output JSON with keys: opening, market_snapshot, fii_dii, top_signal, portfolio_update, watch_today. No markdown.`;

export async function composeDailyBrief(
  profile: UserProfile,
  topSignals: Signal[],
  macro: MacroIndicator,
  portfolioContext: PortfolioContext | null
): Promise<DailyBriefOutput> {
  const userContent = `USER_PROFILE:\n${profile.profile_block}\n\nTOP_SIGNALS_TODAY:\n${JSON.stringify(topSignals.slice(0, 5))}\n\nMACRO_DATA:\n${JSON.stringify(macro)}\n\nPORTFOLIO_CONTEXT:\n${portfolioContext ? JSON.stringify(portfolioContext) : "No portfolio data."}`;

  return runAgent<DailyBriefOutput>(SYSTEM_PROMPT, userContent, FAST_MODEL);
}
