import { supabase } from "../lib/supabase.js";
import { syncMacroIndicators } from "../jobs/macro-sync.js";
import { syncHistoricalPrices } from "../jobs/price-sync.js";
import { generateTodayBriefs } from "../jobs/daily-brief.js";
import { syncBatchFundamentals } from "../lib/fundamentals.js";

const BIG_TICKERS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", 
  "TATAMOTORS", "ADANIPORTS", "ITC", "BHARTIARTL", "SBIN",
  "AXISBANK", "LT", "BAJFINANCE", "MARUTI", "TITAN", 
  "SUNPHARMA", "ULTRACEMCO", "WIPRO", "HINDALCO", "GRASIM"
];

async function main() {
  console.log("🌟 Starting FULL SYSTEM REFRESH...\n");

  // 1. Sync Macro Indicators (Fixed Yahoo/Sensex logic)
  console.log("--- Syncing Macro Indicators ---");
  await syncMacroIndicators();
  console.log("✅ Macro Sync Complete.\n");

  // 2. Add Top Stocks to Demo User
  console.log("--- Enriching Demo User Portfolio ---");
  const { data: user } = await supabase.from("user_profiles").select("id").eq("email", "demo@stoqk.app").single();
  if (user) {
    for (const ticker of BIG_TICKERS) {
      // Add if not exists
      const { data: existing } = await supabase.from("user_holdings").select("id").eq("user_id", user.id).eq("ticker", ticker).single();
      if (!existing) {
        await supabase.from("user_holdings").insert({
          user_id: user.id,
          ticker,
          qty: Math.floor(Math.random() * 50) + 10,
          avg_buy_price: 1000 + Math.random() * 2000,
        });
        console.log(`+ Added ${ticker} to portfolio`);
      }
    }
  }
  console.log("✅ Portfolio Enriched.\n");

  // 3. Sync Price History (90d) for all tickers
  console.log("--- Syncing Price History (90d) ---");
  for (const ticker of BIG_TICKERS) {
    process.stdout.write(`Syncing ${ticker}... `);
    await syncHistoricalPrices(ticker);
    console.log("Done");
  }
  console.log("✅ Price History Synced.\n");

  // 4. Sync Fundamentals & Sectors
  console.log("--- Syncing Fundamentals & Sectors ---");
  await syncBatchFundamentals(BIG_TICKERS);
  console.log("✅ Fundamentals Synced.\n");

  // 5. Generate Daily Briefs
  console.log("--- Generating Daily Briefings ---");
  await generateTodayBriefs();
  console.log("✅ Daily Briefs Created.\n");

  console.log("🚀 FULL REFRESH COMPLETE. Demo user is now fully loaded!");
}

main().catch(console.error);
