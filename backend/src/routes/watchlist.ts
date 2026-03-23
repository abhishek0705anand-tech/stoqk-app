import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { fetchLivePrices } from "../lib/nse.js";

const watchlist = new Hono();

watchlist.get("/", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { data: items, error } = await supabase
    .from("user_watchlist")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  const tickers = (items || []).map((i) => i.ticker);
  const prices = tickers.length ? await fetchLivePrices(tickers) : [];
  const priceMap = Object.fromEntries(prices.map((p) => [p.ticker, p]));

  // Fetch recent patterns for watchlist stocks
  const patterns = tickers.length
    ? await supabase
        .from("chart_patterns")
        .select("*")
        .in("ticker", tickers)
        .order("detected_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const patternMap: Record<string, unknown[]> = {};
  for (const p of patterns.data || []) {
    if (!patternMap[p.ticker]) patternMap[p.ticker] = [];
    patternMap[p.ticker].push(p);
  }

  const enriched = (items || []).map((i) => ({
    ...i,
    price: priceMap[i.ticker],
    patterns: patternMap[i.ticker] || [],
  }));

  return c.json({ watchlist: enriched });
});

watchlist.post("/", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { ticker } = await c.req.json<{ ticker: string }>();
  if (!ticker) return c.json({ error: "ticker required" }, 400);

  const { data, error } = await supabase
    .from("user_watchlist")
    .upsert({ user_id: userId, ticker: ticker.toUpperCase() })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ item: data }, 201);
});

watchlist.delete("/:ticker", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { error } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", c.req.param("ticker").toUpperCase());

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

export default watchlist;
