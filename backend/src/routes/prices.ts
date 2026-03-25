import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";

const prices = new Hono();

// Market data for a ticker — last 90 days
prices.get("/history/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("stock_prices")
    .select("*")
    .eq("ticker", ticker)
    .gte("date", ninetyDaysAgo)
    .order("date", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ prices: data || [] });
});

prices.get("/fundamentals/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const { data, error } = await supabase
    .from("company_fundamentals")
    .select("*")
    .eq("ticker", ticker)
    .single();

  if (error) return c.json({ error: "Fundamentals not found" }, 404);
  return c.json({ fundamentals: data });
});

export default prices;
