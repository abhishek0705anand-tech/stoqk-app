import { runAgent, FAST_MODEL } from "../lib/anthropic.js";
import type { UserProfile, Signal, AlertDecision } from "../types/index.js";

const SYSTEM_PROMPT = `You are deciding whether to send a push notification to a specific user about a market signal.

Rules:
1. Always notify (should_notify: true) if signal ticker is in user's top_holdings regardless of score
2. Always notify if signal ticker is in user_watchlist and significance_score > 50
3. For all other signals, notify only if significance_score > 70
4. Write push_copy calibrated to experience_level:
   - beginner: plain English, explain the event simply, mention if they own the stock. Example: "A large fund just bought ₹320Cr of your Tata Motors. Usually a positive sign."
   - intermediate: factual, brief context
   - advanced / trader: ticker, share count, price, buyer, score. Example: "Block deal: TATAMOTORS 1.2Cr shares @ ₹267. HDFC MF. Score: 74."
5. Max 80 characters for push_copy
6. urgency: "high" if score > 80, "medium" if 60–80, "low" below 60

Output JSON with keys: should_notify (boolean), push_copy (string), urgency (string), reason (string). No markdown.`;

export async function filterAlert(
  signal: Signal,
  profile: UserProfile,
  holdings: string[],
  watchlist: string[]
): Promise<AlertDecision> {
  const userContent = `USER_PROFILE:\n${profile.profile_block}\n\nSIGNAL:\n${JSON.stringify(signal)}\n\nUSER_HOLDINGS_TICKERS: ${JSON.stringify(holdings)}\nUSER_WATCHLIST_TICKERS: ${JSON.stringify(watchlist)}`;

  return runAgent<AlertDecision>(SYSTEM_PROMPT, userContent, FAST_MODEL);
}
