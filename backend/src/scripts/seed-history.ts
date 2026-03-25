import { supabase } from "../lib/supabase.js";
import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance();

async function main() {
  console.log("📊 Seeding Historical Prices (Top 50 Stocks for Charts)...");
  
  // Get top 50 tickers by market cap (to be high value)
  const { data: tickers } = await supabase
    .from("company_fundamentals")
    .select("ticker")
    .order("market_cap_cr", { ascending: false })
    .limit(50);

  if (!tickers || !tickers.length) {
    console.log("❌ No fundamentals found. Run nse-all seeder first.");
    return;
  }

  for (const { ticker } of tickers) {
    process.stdout.write(`  Fetching ${ticker}... `);
    try {
      const yahooTicker = ticker.endsWith(".NS") ? ticker : `${ticker}.NS`;
      const period1 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const period2 = new Date().toISOString().slice(0, 10);
      
      const chartResult = await yahoo.chart(yahooTicker, {
        period1,
        period2,
        interval: "1d"
      });

      const result = chartResult.quotes;
      if (!result || !result.length) {
        console.log("Empty.");
        continue;
      }

      const rows = result.map(q => ({
        ticker,
        date: new Date(q.date).toISOString().slice(0, 10),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
      }));

      const { error } = await supabase.from("stock_prices").upsert(rows);
      if (error) console.log(`❌ ERROR: ${error.message}`);
      else console.log(`✅ ${rows.length} days added.`);
    } catch (e: any) {
      console.log(`❌ FAILED (${e.message})`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main().catch(console.error);
