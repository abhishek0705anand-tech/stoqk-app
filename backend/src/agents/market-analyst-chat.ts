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
1. You MUST ALWAYS answer in two distinct layers separated by the exact marker "---DIG_DEEPER---".
2. Layer 1 (Summary): A 1–2 sentence sharp, actionable answer the user can read in 5 seconds.
3. Layer 2 (Analysis): The "meat" of the answer. Include data, context, nuance, and cite specific search results where relevant.
4. If the user's own portfolio is relevant, mention their specific holdings by name.
5. Never give direct buy/sell advice.
6. If we don't have enough data, be honest and explain why.

Example Output:
Reliance looks strong today as its retail arm shows growth. Better to hold than buy at these peak levels.
---DIG_DEEPER---
Our news scan shows a 15% jump in retail footfall. Compared to your goal of wealth building, this adds to your long-term compounding story. However, with a high PE of 28x, the valuation is stretched.

Output plain text WITH the "---DIG_DEEPER---" marker separating the two sections.`;

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
