import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { syncBatchFundamentals } from "../lib/fundamentals.js";

/**
 * Fundamental Sync Job — Runs weekly on Sunday.
 * Enriches company_fundamentals table by fetching data for all tickers 
 * present in stock_prices or company_fundamentals.
 */
export const fundamentalSyncJob = inngest.createFunction(
  {
    id: "fundamental-sync",
    name: "Sync company fundamentals",
    concurrency: { limit: 1 },
  },
  { cron: "0 10 * * 0" }, // 10 AM every Sunday
  async ({ step }) => {
    // 1. Fetch distinct tickers to update
    const tickers = await step.run("get-tickers", async () => {
      const { data } = await supabase
        .from("company_fundamentals")
        .select("ticker")
        .order("ticker");
      return (data || []).map((row) => row.ticker);
    });

    if (!tickers.length) {
      return { status: "No tickers found to sync." };
    }

    // 2. Process in batches of 20 to avoid rate limits
    const batchSize = 20;
    let totalSynced = 0;

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const syncedCount = await step.run(`sync-batch-${i}`, async () => {
        return syncBatchFundamentals(batch);
      });
      totalSynced += syncedCount;
    }

    return {
      status: `Successfully synced fundamentals for ${totalSynced} tickers.`,
      totalTargeted: tickers.length,
    };
  }
);
