import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { fetchOHLCV } from "../lib/nse.js";

// All NSE 500 index stocks — subset for now, expandable
const NSE_TICKERS = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN","BAJFINANCE",
  "BHARTIARTL","KOTAKBANK","AXISBANK","LT","ASIANPAINT","HCLTECH","MARUTI",
  "WIPRO","SUNPHARMA","ULTRACEMCO","TATAMOTORS","NTPC","POWERGRID","ADANIPORTS",
  "TATASTEEL","ONGC","TECHM","HINDALCO","DRREDDY","DIVISLAB","BAJAJ-AUTO","M&M",
  "CIPLA","NESTLEIND","BRITANNIA","ITC","HEROMOTOCO","JSWSTEEL","BPCL","IOC",
  "TITAN","EICHERMOT","VEDL","SAIL","TATACONSUM","BAJAJFINSV","ADANIENT",
  "HDFCLIFE","SBILIFE","COALINDIA","GRASIM","INDUSINDBK",
];

export const priceSyncJob = inngest.createFunction(
  { id: "price-sync", name: "Sync EOD stock prices" },
  { cron: "0 16 * * 1-5" }, // 4pm IST weekdays (10:30 UTC)
  async ({ step }) => {
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    let synced = 0;

    for (const ticker of NSE_TICKERS) {
      await step.run(`sync-prices-${ticker}`, async () => {
        const ohlcv = await fetchOHLCV(ticker, sixMonthsAgo, today);
        if (!ohlcv.length) return;

        const rows = ohlcv.map((d) => ({
          ticker,
          date: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        }));

        await supabase
          .from("stock_prices")
          .upsert(rows, { onConflict: "ticker,date" });

        synced++;
      });
    }

    return { synced };
  }
);
