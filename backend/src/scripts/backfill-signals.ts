import { supabase } from "../lib/supabase.js";

async function backfillSignals() {
  console.log("🔍 Backfilling Historical Signals (Detection Emulation)...");

  // Get Top 20 stocks with price data
  const { data: tickers } = await supabase
    .from("company_fundamentals")
    .select("ticker")
    .order("market_cap_cr", { ascending: false })
    .limit(20);

  if (!tickers || !tickers.length) {
    console.log("❌ No fundamentals found. Run seed-history.ts first.");
    return;
  }

  for (const { ticker } of tickers) {
    process.stdout.write(`  Analyzing ${ticker}... `);
    
    // Fetch last 60 days of history
    const { data: prices } = await supabase
      .from("stock_prices")
      .select("*")
      .eq("ticker", ticker)
      .order("date", { ascending: true });

    if (!prices || prices.length < 10) {
      console.log("Not enough history.");
      continue;
    }

    let detectedSignalsCnt = 0;
    
    // Detect abnormal events
    for (let i = 5; i < prices.length - 2; i++) {
      const prevRows = prices.slice(i - 5, i);
      const avgVol = prevRows.reduce((sum, r) => sum + Number(r.volume || 0), 0) / prevRows.length;
      const curRow = prices[i];
      const curVol = Number(curRow.volume || 0);
      const curClose = Number(curRow.close || 0);
      const prevClose = Number(prices[i-1].close || 0);
      const priceChange = ((curClose - prevClose) / prevClose) * 100;

      let type = null;
      let summary = null;
      let score = 0;

      // Rule 1: Volume Spike (> 3x)
      if (curVol > avgVol * 3) {
        type = "bulk_deal";
        summary = `Simulated bulk deal detected on ${curRow.date}. Abnormal volume spike of ${(curVol / avgVol).toFixed(1)}x compared to 5-day average.`;
        score = 75;
      } 
      // Rule 2: Strong Momentum (> 5%)
      else if (priceChange > 5) {
        type = "qip";
        summary = `Simulated breakout detected on ${curRow.date}. Strong positive momentum of ${priceChange.toFixed(1)}% on rising liquidity.`;
        score = 82;
      }

      if (type) {
        await supabase.from("signals").insert({
          ticker,
          event_type: type,
          significance_score: score,
          plain_summary: summary,
          detected_at: new Date(curRow.date).toISOString(), // Key: historical date
          raw_data: curRow
        });
        detectedSignalsCnt++;
      }
    }
    console.log(`✅ Detected ${detectedSignalsCnt} signals.`);
  }
}

backfillSignals().catch(console.error);
