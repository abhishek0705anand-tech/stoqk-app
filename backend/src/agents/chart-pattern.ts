import { runAgent, FAST_MODEL } from "../lib/anthropic.js";
import type { UserProfile } from "../types/index.js";

interface ChartPatternOutput {
  pattern_name: string;
  plain_explanation: string;
  what_to_watch: string;
  historical_performance: string;
  horizon_note: string;
}

const SYSTEM_PROMPT = `You are a technical analyst explaining chart patterns to Indian retail investors.

Given a detected pattern and historical price data, produce JSON with exactly these keys:
1. pattern_name — confirmed name of the pattern
2. plain_explanation — what this pattern means. Calibrate to experience_level:
   - beginner: use an analogy, no technical terms, maximum 2 sentences
   - intermediate: explain the psychology behind the pattern
   - advanced / trader: include volume confirmation criteria and RSI context
3. what_to_watch — the specific price level that confirms or invalidates this pattern. One sentence.
4. historical_performance — "This pattern appeared X times in [TICKER] over 5 years. It worked Y% of the time, with an average move of Z% over the following 30 days."
5. horizon_note — if investment_horizon is short, note the 1–2 week price target only. If long, note that short-term patterns are less relevant to long-term investors.

Never use the words "buy" or "sell". Output JSON only. No markdown.`;

export async function analyzePattern(
  ticker: string,
  patternName: string,
  ohlcvData: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>,
  profile: UserProfile
): Promise<ChartPatternOutput> {
  const recentData = ohlcvData.slice(-30);
  const userContent = `USER_PROFILE:\n${profile.profile_block}\n\nTICKER: ${ticker}\nDETECTED_PATTERN: ${patternName}\nRECENT_OHLCV (last 30 sessions):\n${JSON.stringify(recentData)}`;
  return runAgent<ChartPatternOutput>(SYSTEM_PROMPT, userContent, FAST_MODEL);
}
