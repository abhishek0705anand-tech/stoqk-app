import { supabase } from "../lib/supabase.js";

async function main() {
  const ticker = "RELIANCE";
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log("90 Days Ago:", ninetyDaysAgo);

  const { data, error } = await supabase
    .from("stock_prices")
    .select("*")
    .eq("ticker", ticker)
    .gte("date", ninetyDaysAgo)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log(`Prices for ${ticker}:`, data?.length);
  if (data?.length) {
    console.log("First:", data[0].date);
    console.log("Last:", data[data.length - 1].date);
  }
}

main().catch(console.error);
