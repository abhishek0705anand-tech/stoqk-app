import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { inngest } from "../jobs/client.js";

const chat = new Hono();

// POST /chat — enqueue a chat job, return job_id immediately
chat.post("/", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { message } = await c.req.json<{ message: string }>();
  if (!message?.trim()) return c.json({ error: "message required" }, 400);

  // Create a pending row — its ID is the job_id
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ user_id: userId, message: message.trim(), status: "pending" })
    .select("id")
    .single();

  if (error || !data) return c.json({ error: "Failed to create job" }, 500);

  // Fire Inngest event — AI processing happens in the background
  await inngest.send({
    name: "app/chat.message",
    data: { job_id: data.id, user_id: userId, message: message.trim() },
  });

  return c.json({ job_id: data.id });
});

// GET /chat/result/:job_id — poll for result
chat.get("/result/:job_id", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const jobId = c.req.param("job_id");

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, status, plain, deeper, created_at, completed_at")
    .eq("id", jobId)
    .eq("user_id", userId)   // prevent cross-user access
    .single();

  if (error || !data) return c.json({ error: "Job not found" }, 404);

  return c.json(data);
});

// GET /chat/suggestions — suggested questions based on profile + holdings
chat.get("/suggestions", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const [profileRes, holdingsRes, signalsRes] = await Promise.all([
    supabase.from("user_profiles").select("experience_level,primary_goal,preferred_sectors").eq("id", userId).single(),
    supabase.from("user_holdings").select("ticker").eq("user_id", userId).limit(5),
    supabase
      .from("signals")
      .select("ticker,plain_summary")
      .order("significance_score", { ascending: false })
      .limit(3),
  ]);

  const profile = profileRes.data;
  const tickers = (holdingsRes.data || []).map((h) => h.ticker);
  const topSignalTicker = signalsRes.data?.[0]?.ticker;

  const questions = [
    `What's happening with ${tickers[0] || "Nifty 50"} right now?`,
    topSignalTicker
      ? `Should I be worried about the recent activity in ${topSignalTicker}?`
      : "What are FII/DII flows telling us about the market?",
    profile?.primary_goal === "income"
      ? "Which stocks in my portfolio pay the best dividends?"
      : profile?.primary_goal === "inflation_beat"
      ? "How is my portfolio performing against FD returns?"
      : "Is my portfolio too concentrated in any sector?",
    "What's the outlook for the Indian market this week?",
    tickers.length >= 2
      ? `Compare ${tickers[0]} and ${tickers[1]} — which looks stronger right now?`
      : "What sectors are looking strong right now?",
  ];

  return c.json({ suggestions: questions });
});

export default chat;
