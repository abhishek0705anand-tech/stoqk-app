/**
 * Internal routes — called by the Python pattern scanner and other services.
 * Protected by a simple internal API key, not user auth.
 */
import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { analyzePattern } from "../agents/chart-pattern.js";
import type { UserProfile } from "../types/index.js";

const internal = new Hono();

// Auth middleware
internal.use("*", async (c, next) => {
  const key = c.req.header("x-internal-key");
  if (key !== (process.env.INTERNAL_API_KEY || "dev")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Called by pattern scanner after TA-Lib detects a pattern
internal.post("/analyze-pattern", async (c) => {
  const { ticker, pattern_name, ohlcv } = await c.req.json<{
    ticker: string;
    pattern_name: string;
    ohlcv: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  }>();

  // Use a representative profile (intermediate level) for the agent
  const representativeProfile: UserProfile = {
    id: "system",
    experience_level: "intermediate",
    primary_goal: "wealth_building",
    risk_tolerance: "medium",
    investment_horizon: "long",
    preferred_sectors: [],
    portfolio_size_bucket: "1L_to_10L",
    top_holdings: [],
    sector_concentration: {},
    profile_block: `USER_PROFILE:\nExperience: Intermediate investor.\nGoal: Long-term wealth building.\nRisk tolerance: Medium.\nInvestment horizon: Long-term (5–10 years).\nLanguage: Balanced language. Explain complex terms briefly.`,
    onboarding_completed: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const analysis = await analyzePattern(ticker, pattern_name, ohlcv, representativeProfile);

  // Find the most recent pattern row id, then update it
  const { data: existing } = await supabase
    .from("chart_patterns")
    .select("id")
    .eq("ticker", ticker)
    .eq("pattern_name", pattern_name)
    .order("detected_at", { ascending: false })
    .limit(1)
    .single();

  if (existing?.id) {
    await supabase
      .from("chart_patterns")
      .update({
        plain_explanation: analysis.plain_explanation,
        what_to_watch: analysis.what_to_watch,
        horizon_note: analysis.horizon_note,
      })
      .eq("id", existing.id);
  }

  return c.json({ analysis });
});

// Register device token for push notifications
internal.post("/devices", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { apns_token, platform } = await c.req.json<{ apns_token: string; platform?: string }>();

  const { error } = await supabase
    .from("user_devices")
    .upsert({ user_id: userId, apns_token, platform: platform || "ios" });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

export default internal;
