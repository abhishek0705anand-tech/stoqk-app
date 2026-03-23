import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";

const signals = new Hono();

// Feed — paginated, filterable
signals.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const eventType = c.req.query("event_type");
  const minScore = parseInt(c.req.query("min_score") || "0");
  const ticker = c.req.query("ticker");

  const offset = (page - 1) * limit;

  let query = supabase
    .from("signals")
    .select("*", { count: "exact" })
    .gte("significance_score", minScore)
    .order("detected_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventType) query = query.eq("event_type", eventType);
  if (ticker) query = query.eq("ticker", ticker.toUpperCase());

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ signals: data, total: count, page, limit });
});

// Signals for specific tickers (for portfolio tab)
signals.post("/for-tickers", async (c) => {
  const { tickers } = await c.req.json<{ tickers: string[] }>();

  if (!tickers?.length) return c.json({ signals: [] });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .in("ticker", tickers.map((t) => t.toUpperCase()))
    .gte("detected_at", since)
    .order("significance_score", { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ signals: data });
});

// Single signal
signals.get("/:id", async (c) => {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("id", c.req.param("id"))
    .single();

  if (error) return c.json({ error: "Signal not found" }, 404);
  return c.json({ signal: data });
});

export default signals;
