import { supabase } from "../lib/supabase.js";

async function seedUserPortfolio() {
  const userId = "34844c3c-ee5e-420e-a0b0-b5ddabe0a14a";
  console.log(`👤 Seeding portfolio for User: ${userId}`);

  const holdings = [
    { user_id: userId, ticker: "RELIANCE", qty: 45, avg_buy_price: 2450.50 },
    { user_id: userId, ticker: "HDFCBANK", qty: 120, avg_buy_price: 1520.00 },
    { user_id: userId, ticker: "TCS", qty: 25, avg_buy_price: 3600.00 },
    { user_id: userId, ticker: "INFY", qty: 85, avg_buy_price: 1450.40 },
    { user_id: userId, ticker: "TATAMOTORS", qty: 200, avg_buy_price: 910.25 },
    { user_id: userId, ticker: "SBIN", qty: 150, avg_buy_price: 640.80 },
  ];

  for (const h of holdings) {
    const { error } = await supabase.from("user_holdings").upsert(h, { onConflict: "user_id,ticker" });
    if (error) console.log(`  ❌ Failed to seed holding ${h.ticker}: ${error.message}`);
    else console.log(`  ✅ Seeded ${h.ticker}`);
  }

  const watchlist = ["ZOMATO", "ADANIPORTS", "ITC", "BHARTIARTL", "BAJFINANCE"];
  for (const ticker of watchlist) {
    await supabase.from("user_watchlist").upsert({ user_id: userId, ticker }, { onConflict: "user_id,ticker" });
  }
  console.log(`✅ Watchlist seeded with ${watchlist.length} companies.`);
}

seedUserPortfolio().catch(console.error);
