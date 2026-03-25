import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { chatWithAnalyst } from "../agents/market-analyst-chat.js";
import { buildPortfolioContext } from "../agents/portfolio-context.js";
import { fetchLivePrices } from "../lib/nse.js";
import { fetchNewsHeadlines, fetchNSEAnnouncements, getCompanyName } from "../lib/news.js";
import type { UserProfile, UserHolding, Signal } from "../types/index.js";

export const chatProcessJob = inngest.createFunction(
  { id: "chat-process", name: "Process chat message with AI", concurrency: { limit: 5 } },
  { event: "app/chat.message" },
  async ({ event }) => {
    const { job_id, user_id, message } = event.data as {
      job_id: string;
      user_id: string;
      message: string;
    };

    try {
      // Load profile + holdings in parallel
      const [profileRes, holdingsRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user_id).single(),
        supabase.from("user_holdings").select("*").eq("user_id", user_id),
      ]);

      const profile = profileRes.data as UserProfile | null;
      if (!profile) {
        await markError(job_id, "Profile not found");
        return;
      }

      const holdings = (holdingsRes.data || []) as UserHolding[];
      const tickers = holdings.map((h) => h.ticker);

      // Live prices + signals
      const [livePrices, signalsRes] = await Promise.all([
        tickers.length ? fetchLivePrices(tickers) : Promise.resolve([]),
        tickers.length
          ? supabase
              .from("signals")
              .select("*")
              .in("ticker", tickers)
              .gte("detected_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order("significance_score", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
      ]);

      const activeSignals = (signalsRes.data || []) as Signal[];
      const portfolioContext = await buildPortfolioContext(profile, holdings, livePrices, activeSignals);

      // News for tickers mentioned in message
      const mentionedTickers = tickers
        .filter((t) => message.toUpperCase().includes(t))
        .slice(0, 3);

      const newsResults = await Promise.all(
        mentionedTickers.map(async (t) => {
          const [ann, headlines] = await Promise.all([
            fetchNSEAnnouncements(t),
            fetchNewsHeadlines(t, getCompanyName(t)),
          ]);
          return [...ann, ...headlines].slice(0, 2);
        })
      );
      const searchResults = newsResults
        .flat()
        .map((n) => `[${n.source}] ${n.headline} (${n.published_at.slice(0, 10)})${n.summary ? ": " + n.summary : ""}`)
        .join("\n");

      // Call AI — collect all chunks into full text (with retry for 429s)
      let fullText = "";
      let attempt = 0;
      while (attempt < 2) {
        try {
          fullText = "";
          const generator = chatWithAnalyst(message, profile, portfolioContext, activeSignals, searchResults);
          for await (const chunk of generator) {
            fullText += chunk;
          }
          if (fullText.length > 0) break;
        } catch (err: any) {
          if ((err?.message?.includes("429") || err?.message?.toLowerCase().includes("quota")) && attempt < 1) {
            attempt++;
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw err;
        }
        attempt++;
      }

      // Parse the DIG_DEEPER marker
      const marker = "---DIG_DEEPER---";
      const idx = fullText.indexOf(marker);
      const plain = idx === -1 ? fullText.trim() : fullText.slice(0, idx).trim();
      const deeper = idx === -1 ? "" : fullText.slice(idx + marker.length).trim();

      // Save result
      await supabase
        .from("chat_messages")
        .update({ plain, deeper, status: "done", completed_at: new Date().toISOString() })
        .eq("id", job_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      const userMsg = isQuota
        ? "The AI service is temporarily unavailable (rate limit reached). Please try again in a minute."
        : "Something went wrong. Please try again.";
      console.error("[chat-process] error:", msg);
      await markError(job_id, userMsg);
    }
  }
);

async function markError(job_id: string, plain: string) {
  await supabase
    .from("chat_messages")
    .update({ plain, deeper: "", status: "error", completed_at: new Date().toISOString() })
    .eq("id", job_id);
}
