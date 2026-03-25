import { supabase } from "../lib/supabase.js";
import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance();

async function checkWinRate() {
  console.log("🏆 Checking Win Rate Performance...");

  // 1. Fetch signals missing performance data
  const { data: signals, error } = await supabase
    .from("signals")
    .select("id, ticker, detected_at, entry_price, perf_1d, perf_7d, perf_30d")
    .order("detected_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching signals:", error);
    return;
  }

  if (!signals || !signals.length) {
    console.log("No signals to evaluate.");
    return;
  }

  console.log(`Evaluating ${signals.length} signals...`);

  for (const signal of signals) {
    const detectionDate = new Date(signal.detected_at);
    console.log(`\nAnalyzing ${signal.ticker} (Detected: ${detectionDate.toISOString().slice(0, 10)})`);

    const yahooTicker = signal.ticker.endsWith(".NS") ? signal.ticker : `${signal.ticker}.NS`;

    // Fetch historical data around the detection date and after
    // We fetch a 40-day window to be safe
    const endDate = new Date();
    const startDate = new Date(detectionDate);
    startDate.setDate(detectionDate.getDate() - 2); // 2 days before for baseline

    try {
      // Use chart instead of historical for more reliability
      const chartResult = await yahoo.chart(yahooTicker, {
        period1: startDate.toISOString().slice(0, 10),
        period2: endDate.toISOString().slice(0, 10),
        interval: "1d",
      });

      const historical = chartResult.quotes;
      if (!historical || !historical.length) {
        console.log(`  ⚠️ No data found for ${signal.ticker}`);
        continue;
      }

      // Helper to strip time from Date for robust comparison
      const toDateStr = (d: any) => new Date(d).toISOString().slice(0, 10);
      const detectionDateStr = toDateStr(detectionDate);

      // Find entry price (closest to or after detection date)
      const entryPriceRow = historical.find(h => toDateStr(h.date) >= detectionDateStr);
      // Entry price should ideally be the OPEN of the first trading day after/on detection
      const entryPrice = signal.entry_price || (entryPriceRow ? (entryPriceRow.open || entryPriceRow.close) : null);
      
      if (!entryPrice) {
        console.log("  ⚠️ Could not determine entry price.");
        continue;
      }

      const updates: any = { entry_price: entryPrice };

      // Helper to find price at T + X days
      const getPriceAtOffset = (days: number) => {
        const targetDate = new Date(detectionDate);
        targetDate.setDate(detectionDate.getDate() + days);
        const targetDateStr = toDateStr(targetDate);

        // Find first price on or after targetDateStr
        const row = historical.find(h => toDateStr(h.date) >= targetDateStr);
        return row ? (row.close || row.adjclose || row.open) : null;
      };

      const day1Price = getPriceAtOffset(1);
      const day7Price = getPriceAtOffset(7);
      const day30Price = getPriceAtOffset(30);

      if (day1Price) updates.perf_1d = ((day1Price - entryPrice) / entryPrice) * 100;
      if (day7Price) updates.perf_7d = ((day7Price - entryPrice) / entryPrice) * 100;
      if (day30Price) updates.perf_30d = ((day30Price - entryPrice) / entryPrice) * 100;

      // Mark outcome as profitable if 30d or 7d (fallback) or 1d (fallback) is positive
      const lastAvailablePerf = updates.perf_30d ?? updates.perf_7d ?? updates.perf_1d;
      if (lastAvailablePerf !== undefined) {
        updates.outcome_profitable = lastAvailablePerf > 0;
      }

      const { error: updateError } = await supabase
        .from("signals")
        .update(updates)
        .eq("id", signal.id);

      if (updateError) {
        console.log(`  ❌ Error updating signal: ${updateError.message}`);
      } else {
        console.log(`  ✅ Evaluated: 1d=${updates.perf_1d?.toFixed(2)}%, 7d=${updates.perf_7d?.toFixed(2)}%, 30d=${updates.perf_30d?.toFixed(2)}%`);
      }

    } catch (err: any) {
      console.log(`  ❌ Yahoo API Error: ${err.message}`);
    }
  }

  console.log("\n✅ Win rate evaluation complete.");
}

checkWinRate().catch(console.error);
