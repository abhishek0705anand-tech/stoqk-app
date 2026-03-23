import { streamAgent } from "../lib/anthropic.js";
import type { UserProfile, PortfolioContext, Signal } from "../types/index.js";

const SYSTEM_PROMPT_TEMPLATE = (
  profileBlock: string,
  portfolioBlock: string,
  signalsBlock: string,
  searchResults: string
) => `You are a sharp, honest market analyst advising a specific investor. You have full context about who they are and what they own.

${profileBlock}

PORTFOLIO_CONTEXT:
${portfolioBlock}

ACTIVE_SIGNALS_ON_HOLDINGS:
${signalsBlock}

WEB_SEARCH_RESULTS:
${searchResults || "No recent search results available."}

Rules:
1. Always answer in two layers separated by the exact marker "---DIG_DEEPER---":
   - Layer 1 (before the marker): A 1–2 sentence plain answer the user can act on immediately
   - Layer 2 (after the marker): Data, context, nuance, source citations
2. If the user's own portfolio is relevant, mention their specific holdings by name
3. Frame answers through the lens of primary_goal:
   - inflation_beat → compare to FD returns where relevant
   - income → highlight dividend angle
   - aggressive_growth → highlight momentum and upside
   - wealth_building → highlight long-term compounding angle
4. If risk_tolerance is low → mention capital protection and downside scenario first
5. If experience_level is beginner → explain any term you use in brackets the first time
6. Every factual claim must cite a source inline
7. Never give a direct buy or sell recommendation
8. If you do not know, say so clearly

Output plain text with the two layers separated by "---DIG_DEEPER---".`;

export async function* chatWithAnalyst(
  userMessage: string,
  profile: UserProfile,
  portfolioContext: PortfolioContext,
  activeSignals: Signal[],
  searchResults: string
): AsyncGenerator<string> {
  const portfolioBlock = JSON.stringify(portfolioContext, null, 2);
  const signalsBlock = activeSignals
    .map((s) => `${s.ticker}: ${s.plain_summary} (score: ${s.significance_score})`)
    .join("\n") || "No active signals on holdings.";

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(
    profile.profile_block,
    portfolioBlock,
    signalsBlock,
    searchResults
  );

  yield* streamAgent(systemPrompt, userMessage);
}

export function parseChatResponse(fullText: string): { plain: string; deeper: string } {
  const marker = "---DIG_DEEPER---";
  const idx = fullText.indexOf(marker);
  if (idx === -1) return { plain: fullText.trim(), deeper: "" };
  return {
    plain: fullText.slice(0, idx).trim(),
    deeper: fullText.slice(idx + marker.length).trim(),
  };
}
