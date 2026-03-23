import type { UserProfile } from "../types/index.js";
import { supabase } from "./supabase.js";

const SECTOR_MAP: Record<string, string[]> = {
  "IT / Tech": ["INFY", "TCS", "WIPRO", "HCLTECH", "TECHM", "LTIM", "MPHASIS"],
  "Banking and Finance": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "BAJFINANCE"],
  Pharma: ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "BIOCON"],
  Auto: ["TATAMOTORS", "MARUTI", "M&M", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT"],
  FMCG: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR"],
  Energy: ["RELIANCE", "ONGC", "BPCL", "IOC", "NTPC", "POWERGRID"],
  Infrastructure: ["LT", "ADANIPORTS", "ADANIENT", "GMRINFRA", "IRB"],
  Metals: ["TATASTEEL", "HINDALCO", "JSWSTEEL", "SAIL", "VEDL"],
};

export function getTickerSector(ticker: string): string {
  for (const [sector, tickers] of Object.entries(SECTOR_MAP)) {
    if (tickers.includes(ticker)) return sector;
  }
  return "Other";
}

export function compileProfileBlock(profile: UserProfile): string {
  const experienceMap: Record<string, string> = {
    beginner: "Beginner investor, new to markets.",
    intermediate: "Intermediate investor, knows the basics.",
    advanced: "Experienced investor, comfortable with market dynamics.",
    trader: "Active trader, comfortable with technical analysis.",
  };

  const goalMap: Record<string, string> = {
    wealth_building: "Long-term wealth building through compounding.",
    inflation_beat: "Beat FD returns and inflation.",
    income: "Generate regular monthly income.",
    aggressive_growth: "Aggressive growth, willing to take higher risk.",
  };

  const riskMap: Record<string, string> = {
    low: "Low — prefers capital protection, avoids volatility.",
    medium: "Medium — will hold through volatility but not take aggressive bets.",
    high: "High — comfortable with drawdowns, seeks high-return opportunities.",
  };

  const horizonMap: Record<string, string> = {
    short: "Short-term (under 1 year).",
    medium: "Medium-term (1–5 years).",
    long: "Long-term (5–10 years).",
    very_long: "Very long-term (10+ years).",
  };

  const bucketMap: Record<string, string> = {
    under_1L: "Under ₹1 lakh",
    "1L_to_10L": "₹1–10 lakh range",
    above_10L: "Above ₹10 lakh",
  };

  const langMap: Record<string, string> = {
    beginner: "Use simple English. Avoid jargon. Explain terms when used.",
    intermediate: "Balanced language. Explain complex terms briefly.",
    advanced: "Technical language acceptable. No need to explain basics.",
    trader: "Direct and technical. Include price levels, volume, float data.",
  };

  const topHoldings = profile.top_holdings?.length
    ? profile.top_holdings.join(", ")
    : "Not specified";

  const sectorConc = profile.sector_concentration
    ? Object.entries(profile.sector_concentration)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([s, p]) => `${s} ${Math.round(p)}%`)
        .join(", ")
    : "Not specified";

  return `USER_PROFILE:
Experience: ${experienceMap[profile.experience_level] || profile.experience_level}
Goal: ${goalMap[profile.primary_goal] || profile.primary_goal}
Risk tolerance: ${riskMap[profile.risk_tolerance] || profile.risk_tolerance}
Investment horizon: ${horizonMap[profile.investment_horizon] || profile.investment_horizon}
Preferred sectors: ${profile.preferred_sectors?.join(", ") || "Not specified"}.
Portfolio: ${bucketMap[profile.portfolio_size_bucket] || "Unknown"}. Top holdings are ${topHoldings}.
Sector concentration: ${sectorConc}.
Language: ${langMap[profile.experience_level] || "Clear and informative."}`;
}

export async function getProfileWithBlock(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data as UserProfile | null;
}

export async function updateDerivedFields(userId: string): Promise<void> {
  const { data: holdings } = await supabase
    .from("user_holdings")
    .select("*")
    .eq("user_id", userId);

  if (!holdings?.length) return;

  const values = holdings.map((h) => h.qty * h.avg_buy_price);
  const total = values.reduce((s, v) => s + v, 0);

  const portfolio_size_bucket =
    total < 100000 ? "under_1L" : total < 1000000 ? "1L_to_10L" : "above_10L";

  const sorted = [...holdings].sort(
    (a, b) => b.qty * b.avg_buy_price - a.qty * a.avg_buy_price
  );
  const top_holdings = sorted.slice(0, 3).map((h) => h.ticker);

  const sectorMap: Record<string, number> = {};
  for (const h of holdings) {
    const sector = getTickerSector(h.ticker);
    sectorMap[sector] = (sectorMap[sector] || 0) + (h.qty * h.avg_buy_price) / total;
  }
  const sector_concentration = Object.fromEntries(
    Object.entries(sectorMap).map(([k, v]) => [k, Math.round(v * 100)])
  );

  const { data: profile } = await supabase
    .from("user_profiles")
    .update({ portfolio_size_bucket, top_holdings, sector_concentration, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (profile) {
    const profile_block = compileProfileBlock(profile as UserProfile);
    await supabase
      .from("user_profiles")
      .update({ profile_block })
      .eq("id", userId);
  }
}
