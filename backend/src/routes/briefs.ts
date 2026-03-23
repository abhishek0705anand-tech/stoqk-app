import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";

const briefs = new Hono();

// Today's brief for the user
briefs.get("/today", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (error || !data) {
    return c.json({ brief: null, date: today });
  }

  // Mark as viewed
  if (!data.viewed_at) {
    supabase
      .from("daily_briefs")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(() => {});
  }

  return c.json({ brief: data.brief_json, date: today });
});

// Macro snapshot (Nifty, Sensex, FII/DII)
briefs.get("/macro", async (c) => {
  const { data } = await supabase
    .from("macro_indicators")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  return c.json({ macro: data || null });
});

// Historical briefs
briefs.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { data } = await supabase
    .from("daily_briefs")
    .select("id, date, brief_json, viewed_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(14);

  return c.json({ briefs: data || [] });
});

export default briefs;
