import { syncMacroIndicators } from "../jobs/macro-sync.js";
import { fetchAndExtractSignals } from "../jobs/signal-fetch.js";
import { generateTodayBriefs } from "../jobs/daily-brief.js";
import { syncHistoricalPrices } from "../jobs/price-sync.js";
import { syncBatchFundamentals } from "../lib/fundamentals.js";

async function main() {
  console.log("🚀 Starting Full Demo Seed with Paid Gemini Key...");

  // 1. Macro Indicators (Nifty/Sensex/FII/DII)
  console.log("\n--- Syncing Macro Indicators ---");
  await syncMacroIndicators();

  // 2. Tickers to focus on for Demo
  const tickers = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATAMOTORS", "ADANIPORTS", "ITC", "BHARTIARTL", "SBIN"];

  // 3. Price History
  console.log("\n--- Syncing Price History for top tickers ---");
  for (const t of tickers) {
    try {
      console.log(`Syncing prices for ${t}...`);
      await syncHistoricalPrices(t);
    } catch (e) { console.error(`Failed ${t}:`, e); }
  }

  // 4. Fundamentals
  console.log("\n--- Syncing Company Fundamentals ---");
  try {
    console.log(`Syncing batch fundamentals for: ${tickers.join(", ")}`);
    await syncBatchFundamentals(tickers);
  } catch (e) { console.error(`Failed fundamentals:`, e); }

  // 5. Signal Extraction (Agent 1)
  console.log("\n--- Extracting Latest Signals (Agent 1) ---");
  await fetchAndExtractSignals();

  // 6. Daily Briefs (Agent 3)
  console.log("\n--- Generating Daily Briefs for all users (Agent 3) ---");
  await generateTodayBriefs();

  console.log("\n✅ Demo Seed Complete. The app is now fully populated with fresh AI-analyzed data.");
}

main().catch(console.error);
