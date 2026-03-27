import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { fetchBulkDeals, fetchInsiderTrades, fetchBlockDeals } from "../lib/nse.js";
import { detectSignal, classifyRawEvent } from "../agents/signal-detector.js";
import { filterAlert } from "../agents/alert-priority.js";
import { sendPushToMany } from "../lib/apns.js";
import type { UserProfile, UserHolding, NSERawEvent } from "../types/index.js";

export async function fetchAndExtractSignals() {
  const [b, i, bl] = await Promise.all([
    fetchBulkDeals(),
    fetchInsiderTrades(),
    fetchBlockDeals(),
  ]);

  const allEvents: NSERawEvent[] = [...b, ...i, ...bl];
  if (!allEvents.length) return { processed: 0, notified: 0 };

  const profilesResult = await supabase
    .from("user_profiles")
    .select("*")
    .eq("onboarding_completed", true)
    .limit(1000);

  if (!profilesResult?.data?.length) return { processed: 0, notified: 0 };
  const users = profilesResult.data as UserProfile[];
  const primaryProfile = users[0];

  let processedCount = 0;
  let notifiedCount = 0;

  for (const event of allEvents.slice(0, 50)) {
    try {
      const signalOutput = await detectSignal(event, primaryProfile);
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

      if (!savedSignal) continue;
      processedCount++;

      for (const user of users) {
        const [hRes, wRes] = await Promise.all([
          supabase.from("user_holdings").select("ticker").eq("user_id", user.id),
          supabase.from("user_watchlist").select("ticker").eq("user_id", user.id),
        ]);

        const holdingTickers = (hRes.data || []).map((h) => h.ticker);
        const watchlistTickers = (wRes.data || []).map((w) => w.ticker);

        const alertDecision = await filterAlert(savedSignal, user, holdingTickers, watchlistTickers);

        if (alertDecision.should_notify) {
          await supabase.from("user_notifications").insert({
            user_id: user.id,
            signal_id: savedSignal.id,
            push_copy: alertDecision.push_copy,
            urgency: alertDecision.urgency,
          });
          notifiedCount++;

          const { data: devices } = await supabase.from("user_devices").select("apns_token").eq("user_id", user.id);
          const tokens = (devices || []).map((d) => d.apns_token).filter(Boolean);
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
  }

  return { processed: processedCount, notified: notifiedCount };
}

export const signalFetchJob = inngest.createFunction(
  { id: "signal-fetch", name: "Fetch and score market signals", concurrency: { limit: 1 } },
  { cron: "*/15 * * * 1-5" }, // every 15 min, weekdays
  async ({ step }) => {
    const allEvents = await step.run("fetch-all-deals", async () => {
      const [b, i, bl] = await Promise.all([
        fetchBulkDeals().catch(() => []),
        fetchInsiderTrades().catch(() => []),
        fetchBlockDeals().catch(() => []),
      ]);
      return [...b, ...i, ...bl];
    });

    if (!allEvents.length) return { processed: 0 };

    // Process only top 20 to stay safe, one by one as individual steps
    for (const event of allEvents.slice(0, 20)) {
      await step.run(`process-signal-${event.symbol}-${Date.now()}`, async () => {
        // 5-second pacing delay to avoid 429s
        await new Promise(r => setTimeout(r, 5000));

        const profilesResult = await supabase
          .from("user_profiles")
          .select("id, profile_block")
          .eq("onboarding_completed", true);
        
        if (!profilesResult.data?.length) return;
        const users = profilesResult.data;

        // 1. De-duplicate — skip if we already processed this event today
        const ticker = event.symbol?.toUpperCase();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .eq("ticker", ticker)
          .eq("event_type", classifyRawEvent(event))
          .gte("detected_at", todayStart.toISOString())
          .maybeSingle();

        if (existing) return; // already processed today — skip AI call

        // 2. Detect signal with primary AI pass
        const signalOutput = await detectSignal(event, users[0] as any);
        const { data: savedSignal } = await supabase
          .from("signals")
          .insert({
            ticker,
            event_type: signalOutput.event_type || classifyRawEvent(event),
            significance_score: signalOutput.significance_score,
            plain_summary: signalOutput.plain_summary,
            historical_context: signalOutput.historical_context,
            raw_data: event,
          })
          .select()
          .single();

        if (!savedSignal) return;

        // 2. Alert users — but ONLY those who hold/watch this ticker
        const relevantUsersRes = await supabase
          .from("user_holdings")
          .select("user_id")
          .eq("ticker", savedSignal.ticker);
        
        const watchlistUsersRes = await supabase
          .from("user_watchlist")
          .select("user_id")
          .eq("ticker", savedSignal.ticker);

        const relevantUserIds = new Set([
          ...(relevantUsersRes.data || []).map(u => u.user_id),
          ...(watchlistUsersRes.data || []).map(u => u.user_id)
        ]);

        for (const userId of relevantUserIds) {
          const user = users.find(u => u.id === userId);
          if (!user) continue;

          // Re-fetch context for this user specifically for the alert
          const [hRes, wRes] = await Promise.all([
            supabase.from("user_holdings").select("ticker").eq("user_id", userId),
            supabase.from("user_watchlist").select("ticker").eq("user_id", userId),
          ]);
          
          const alertDecision = await filterAlert(
            savedSignal, 
            user as any, 
            (hRes.data || []).map(h => h.ticker), 
            (wRes.data || []).map(w => w.ticker)
          );

          if (alertDecision.should_notify) {
            await supabase.from("user_notifications").insert({
              user_id: userId,
              signal_id: savedSignal.id,
              push_copy: alertDecision.push_copy,
              urgency: alertDecision.urgency,
            });

            // Push notification logic...
            const { data: devices } = await supabase.from("user_devices").select("apns_token").eq("user_id", userId);
            const tokens = (devices || []).map((d) => d.apns_token).filter(Boolean);
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
      });
    }

    return { processed: allEvents.length };
  }
);
