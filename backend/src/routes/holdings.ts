import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { updateDerivedFields } from "../lib/profile.js";
import { fetchLivePrices } from "../lib/nse.js";

const holdings = new Hono();

// List holdings with live prices
holdings.get("/", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { data: userHoldings, error } = await supabase
    .from("user_holdings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  const tickers = (userHoldings || []).map((h) => h.ticker);
  const prices = tickers.length ? await fetchLivePrices(tickers) : [];
  const priceMap = Object.fromEntries(prices.map((p) => [p.ticker, p]));

  const enriched = (userHoldings || []).map((h) => {
    const live = priceMap[h.ticker];
    const currentPrice = live?.price || h.avg_buy_price;
    const currentValue = currentPrice * h.qty;
    const costBasis = h.avg_buy_price * h.qty;
    return {
      ...h,
      current_price: currentPrice,
      current_value: currentValue,
      cost_basis: costBasis,
      unrealised_pnl: currentValue - costBasis,
      unrealised_pnl_pct: ((currentValue - costBasis) / costBasis) * 100,
      change_pct_today: live?.change_pct || 0,
    };
  });

  return c.json({ holdings: enriched });
});

// Add / update holding
holdings.put("/", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { ticker, qty, avg_buy_price } = await c.req.json<{
    ticker: string;
    qty: number;
    avg_buy_price: number;
  }>();

  if (!ticker || !qty || !avg_buy_price) {
    return c.json({ error: "ticker, qty, avg_buy_price required" }, 400);
  }

  const { data, error } = await supabase
    .from("user_holdings")
    .upsert({ user_id: userId, ticker: ticker.toUpperCase(), qty, avg_buy_price })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Update derived fields async
  updateDerivedFields(userId).catch(console.error);

  return c.json({ holding: data });
});

// Delete holding
holdings.delete("/:ticker", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const ticker = c.req.param("ticker").toUpperCase();

  const { error } = await supabase
    .from("user_holdings")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker);

  if (error) return c.json({ error: error.message }, 500);

  updateDerivedFields(userId).catch(console.error);

  return c.json({ success: true });
});

// Bulk replace holdings
holdings.post("/bulk", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { holdings: newHoldings } = await c.req.json<{
    holdings: Array<{ ticker: string; qty: number; avg_buy_price: number }>;
  }>();

  // Delete existing and insert fresh
  await supabase.from("user_holdings").delete().eq("user_id", userId);

  if (newHoldings.length) {
    const rows = newHoldings.map((h) => ({
      user_id: userId,
      ticker: h.ticker.toUpperCase(),
      qty: h.qty,
      avg_buy_price: h.avg_buy_price,
    }));

    const { error } = await supabase.from("user_holdings").insert(rows);
    if (error) return c.json({ error: error.message }, 500);
  }

  await updateDerivedFields(userId);
  return c.json({ success: true, count: newHoldings.length });
});

export default holdings;
