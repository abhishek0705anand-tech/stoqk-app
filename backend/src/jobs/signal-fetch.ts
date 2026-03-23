import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { fetchBulkDeals, fetchInsiderTrades, fetchBlockDeals } from "../lib/nse.js";
import { detectSignal, classifyRawEvent } from "../agents/signal-detector.js";
import { filterAlert } from "../agents/alert-priority.js";
import { sendPushToMany } from "../lib/apns.js";
import type { UserProfile, UserHolding, NSERawEvent } from "../types/index.js";

export const signalFetchJob = inngest.createFunction(
  {
    id: "signal-fetch",
    name: "Fetch and score market signals",
    concurrency: { limit: 1 },
  },
  { cron: "*/15 * * * 1-5" }, // every 15 min, weekdays
  async ({ step }) => {
    // 1. Fetch raw events
    const rawEvents = await step.run(
      "fetch-raw-events",
      async () => {
        const [b, i, bl] = await Promise.all([
          fetchBulkDeals(),
          fetchInsiderTrades(),
          fetchBlockDeals(),
        ]);
        return { bulkDeals: b, insiderTrades: i, blockDeals: bl };
      }
    );

    const allEvents: NSERawEvent[] = [
      ...rawEvents.bulkDeals,
      ...rawEvents.insiderTrades,
      ...rawEvents.blockDeals,
    ];

    if (!allEvents.length) {
      return { processed: 0, notified: 0 };
    }

    // 2. Load all active users with profiles
    const profilesResult = await step.run("load-profiles", async () => {
      return supabase
        .from("user_profiles")
        .select("*")
        .eq("onboarding_completed", true)
        .limit(1000);
    });

    if (!profilesResult?.data?.length) return { processed: 0, notified: 0 };

    const users = profilesResult.data as UserProfile[];

    // 3. Process each unique event — detect signal with first user's profile (most common profile)
    // Then score relevance per-user during alert filtering
    const primaryProfile = users[0];
    let processedCount = 0;
    let notifiedCount = 0;

    for (const event of allEvents.slice(0, 50)) {
      // Rate limit
      await step.run(`process-event-${event.symbol}-${Date.now()}`, async () => {
        try {
          const signalOutput = await detectSignal(event, primaryProfile);

          // Write signal to DB
          const { data: savedSignal } = await supabase
            .from("signals")
            .insert({
              ticker: event.symbol?.toUpperCase(),
              event_type: signalOutput.event_type || classifyRawEvent(event),
              significance_score: signalOutput.significance_score,
              plain_summary: signalOutput.plain_summary,
              historical_context: signalOutput.historical_context,
              raw_data: event,
            })
            .select()
            .single();

          if (!savedSignal) return;
          processedCount++;

          // 4. Alert filter — check each user
          for (const user of users) {
            const { data: holdingsData } = await supabase
              .from("user_holdings")
              .select("ticker")
              .eq("user_id", user.id);

            const { data: watchlistData } = await supabase
              .from("user_watchlist")
              .select("ticker")
              .eq("user_id", user.id);

            const holdingTickers = (holdingsData || []).map((h: { ticker: string }) => h.ticker);
            const watchlistTickers = (watchlistData || []).map((w: { ticker: string }) => w.ticker);

            const alertDecision = await filterAlert(
              savedSignal,
              user,
              holdingTickers,
              watchlistTickers
            );

            if (alertDecision.should_notify) {
              await supabase.from("user_notifications").insert({
                user_id: user.id,
                signal_id: savedSignal.id,
                push_copy: alertDecision.push_copy,
                urgency: alertDecision.urgency,
              });
              notifiedCount++;

              // Send APNs push to all registered devices for this user
              const { data: devices } = await supabase
                .from("user_devices")
                .select("apns_token")
                .eq("user_id", user.id);

              const tokens = (devices || []).map((d: { apns_token: string }) => d.apns_token).filter(Boolean);
              if (tokens.length > 0) {
                const [title, ...rest] = alertDecision.push_copy.split(". ");
                await sendPushToMany(tokens, {
                  title: title || "Market Signal",
                  body: rest.join(". ") || alertDecision.push_copy,
                  data: { signal_id: savedSignal.id, ticker: savedSignal.ticker },
                });
              }
            }
          }
        } catch (err) {
          console.error("Error processing event:", event.symbol, err);
        }
      });
    }

    return { processed: processedCount, notified: notifiedCount };
  }
);
