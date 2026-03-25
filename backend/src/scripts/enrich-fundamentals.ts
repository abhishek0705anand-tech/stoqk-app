/**
 * One-time script to enrich company_fundamentals for all tickers.
 * Uses the scrapers in lib/fundamentals.ts.
 * Run with: ts-node src/scripts/enrich-fundamentals.ts
 */
import { supabase } from "../lib/supabase.js";
import { fetchFundamentalsFromYahoo } from "../lib/fundamentals.js";

async function main() {
  console.log("🚀 Starting fundamental enrichment...");

  console.log("🔍 Fetching all tickers from stock_prices...");
  const { data: pricesRaw } = await supabase
    .from("stock_prices")
    .select("ticker");
  
  // Use a Set to get unique tickers and sort them
  let tickers = [...new Set((pricesRaw || []).map((r: any) => r.ticker))].sort();

  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : null;
  if (limit) {
    tickers = tickers.slice(0, limit);
    console.log(`⚡ Limiting to ${limit} tickers.`);
  }

  if (!tickers.length) {
    console.log("❌ No tickers found in DB. Please run seeder first.");
    return;
  }

  console.log(`🔍 Found ${tickers.length} tickers to process.`);

  let successCount = 0;
  let failCount = 0;

  for (const ticker of tickers) {
    process.stdout.write(`  Processing ${ticker}... `);
    try {
      const data = await fetchFundamentalsFromYahoo(ticker);
      if (!data) {
        console.log("FAILED (no data from Yahoo Finance)");
        failCount++;
        continue;
      }

      const { error } = await supabase.from("company_fundamentals").upsert({
        ticker,
        ...data,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.log(`ERROR (${error.message})`);
        failCount++;
      } else {
        console.log("✅ DONE");
        successCount++;
      }
    } catch (err: any) {
      console.log(`CRASHED (${err.message})`);
      failCount++;
    }

    // Polite delay
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`\n🎉 Enrichment complete.`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed/Skipped: ${failCount}`);
}

main().catch(console.error);
