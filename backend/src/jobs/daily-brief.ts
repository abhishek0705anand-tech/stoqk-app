import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { composeDailyBrief } from "../agents/daily-brief.js";
import { buildPortfolioContext } from "../agents/portfolio-context.js";
import { fetchLivePrices } from "../lib/nse.js";
import type { UserProfile, UserHolding, Signal, MacroIndicator } from "../types/index.js";

export async function generateTodayBriefs() {
  const today = new Date().toISOString().slice(0, 10);

  const [macroRes, topSignalsRes, profilesRes] = await Promise.all([
    supabase.from("macro_indicators").select("*").order("date", { ascending: false }).limit(1).single(),
    supabase
      .from("signals")
      .select("*")
      .gte("detected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("significance_score", { ascending: false })
      .limit(5),
    supabase.from("user_profiles").select("*").eq("onboarding_completed", true).limit(500),
  ]);

  const macro = macroRes.data as MacroIndicator | null;
  const topSignals = (topSignalsRes.data || []) as Signal[];
  const users = (profilesRes.data || []) as UserProfile[];

  if (!macro || !users.length) return { composed: 0 };

  let composed = 0;
  for (const user of users) {
    const { data: holdingsData } = await supabase.from("user_holdings").select("*").eq("user_id", user.id);
    const holdings = (holdingsData || []) as UserHolding[];
    const tickers = holdings.map((h) => h.ticker);

    let portfolioContext = null;
    if (holdings.length) {
      const livePrices = await fetchLivePrices(tickers);
      const { data: signalsData } = await supabase
        .from("signals")
        .select("*")
        .in("ticker", tickers)
        .gte("detected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      portfolioContext = await buildPortfolioContext(user, holdings, livePrices, (signalsData || []) as Signal[]);
    }

    const brief = await composeDailyBrief(user, topSignals, macro, portfolioContext);
    await supabase.from("daily_briefs").upsert({
      user_id: user.id,
      date: today,
      brief_json: brief,
    });
    composed++;
  }

  return { composed, date: today };
}

export const dailyBriefJob = inngest.createFunction(
  { id: "daily-brief", name: "Compose personalised daily briefs" },
  { cron: "0 2 * * 1-5" }, // 7:30am IST (2:00 UTC)
  async ({ step }) => {
    return await step.run("generate-briefs", async () => {
      return generateTodayBriefs();
    });
  }
);
