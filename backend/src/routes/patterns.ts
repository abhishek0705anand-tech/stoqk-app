import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";

const patterns = new Hono();

patterns.get("/", async (c) => {
  const ticker = c.req.query("ticker");
  const limit = parseInt(c.req.query("limit") || "20");

  let query = supabase
    .from("chart_patterns")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (ticker) query = query.eq("ticker", ticker.toUpperCase());

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ patterns: data });
});

// Patterns for a list of tickers (portfolio)
patterns.post("/for-tickers", async (c) => {
  const { tickers } = await c.req.json<{ tickers: string[] }>();
  if (!tickers?.length) return c.json({ patterns: [] });

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("chart_patterns")
    .select("*")
    .in("ticker", tickers.map((t) => t.toUpperCase()))
    .gte("detected_at", since)
    .order("detected_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ patterns: data });
});

export default patterns;
