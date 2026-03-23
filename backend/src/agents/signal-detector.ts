import { runAgent, FAST_MODEL } from "../lib/anthropic.js";
import type { NSERawEvent, EventType, UserProfile } from "../types/index.js";

interface SignalDetectorOutput {
  event_type: EventType;
  significance_score: number;
  plain_summary: string;
  historical_context: string | null;
  relevance_reason: string;
}

const SYSTEM_PROMPT = `You are a SEBI-compliant signal analyst for Indian equity markets. You will receive a raw market event and a user profile.

Your task — output JSON with exactly these keys:
1. event_type — one of: bulk_deal, insider_buy, insider_sell, pledge_increase, pledge_reduction, promoter_buy, block_deal, qip
2. significance_score — integer 0 to 100. Base score on: amount in crores, percentage of total float, deviation from 6-month average volume. Adjust:
   - If event is in user's preferred_sectors or top_holdings → add 15
   - If event is aggressive type (short squeeze, block deal) and risk_tolerance is low → subtract 10
3. plain_summary — exactly 2 sentences. Calibrate language to experience_level:
   - beginner: no jargon, explain what the event means in plain terms
   - intermediate: clear factual language, brief context
   - advanced: include price, volume data
   - trader: include price, volume, float percentage
4. historical_context — did this pattern precede a price move in this stock in the last 3 years? One sentence if yes, null if no data.
5. relevance_reason — one sentence explaining why this matters to this specific user.

Output JSON only. No preamble. No markdown.`;

export async function detectSignal(
  rawEvent: NSERawEvent,
  profile: UserProfile
): Promise<SignalDetectorOutput> {
  const userContent = `USER_PROFILE:\n${profile.profile_block}\n\nRAW_EVENT:\n${JSON.stringify(rawEvent, null, 2)}`;
  return runAgent<SignalDetectorOutput>(SYSTEM_PROMPT, userContent, FAST_MODEL);
}

export function classifyRawEvent(raw: NSERawEvent): EventType {
  const type = (raw.typeOfTransaction || "").toLowerCase();
  if (type.includes("buy") && type.includes("insider")) return "insider_buy";
  if (type.includes("sell") && type.includes("insider")) return "insider_sell";
  if (type.includes("bulk")) return "bulk_deal";
  if (type.includes("block")) return "block_deal";
  if (type.includes("pledge") && type.includes("creat")) return "pledge_increase";
  if (type.includes("pledge") && type.includes("invok")) return "pledge_reduction";
  if (type.includes("promoter")) return "promoter_buy";
  if (type.includes("qip")) return "qip";
  return "bulk_deal";
}
