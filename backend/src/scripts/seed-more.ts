import { supabase } from "../lib/supabase.js";

async function main() {
  const userId = "34844c3c-ee5e-420e-a0b0-b5ddabe0a14a";
  console.log("🌟 Seeding Final Hackathon Polish Data...");

  // 1. Seed Macro Indicators (Last 30 Days)
  console.log("📈 Seeding Macro Indicators...");
  const macroRows = [];
  const baseNifty = 22105.40;
  const baseSensex = 72831.90;

  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Skip weekends for macro usually, but for demo we can just have daily points
    macroRows.push({
      date: d.toISOString().slice(0, 10),
      nifty_close: baseNifty + (Math.random() * 500 - 250),
      sensex_close: baseSensex + (Math.random() * 1000 - 500),
      fii_net_cr: (Math.random() * 4000 - 2000).toFixed(2),
      dii_net_cr: (Math.random() * 4000 - 2000).toFixed(2),
      repo_rate: 6.50
    });
  }
  await supabase.from("macro_indicators").upsert(macroRows);
  console.log(`  ✅ ${macroRows.length} macro rows added.`);

  // 2. Seed Daily Briefs for our user
  console.log("📰 Seeding Historical Daily Briefs...");
  const briefHistory = [
    {
      opening: "Nifty hits fresh all-time high amidst strong global cues.",
      market_snapshot: "Nifty 50 gained 0.8% today, closing at 22,105. This marks a significant breakout above previous resistance levels.",
      fii_dii: "FIIs were net buyers of ₹1,240 Cr, while DIIs bought ₹850 Cr. Strong institutional support is visible.",
      top_signal: "Promoter buying detected in RELIANCE. Mukesh Ambani's entity increased stake by 0.2%, a high-confidence signal.",
      portfolio_update: "Your portfolio is up 1.2% today. Best performer: HDFCBANK (+2.4%). Total P&L: +₹12,450.",
      watch_today: "Watch the IT sector today as NASDAQ closed 2% higher. In particular, INFY might see a gap-up opening."
    },
    {
       opening: "Market consolidates after 3-day rally; eyes on US Fed meet.",
       market_snapshot: "Sensex flat today (+0.05%). Consolidation is healthy after the recent move towards 73k.",
       fii_dii: "Institutional activity remained muted (FII: -₹200 Cr, DII: +₹150 Cr) ahead of global macro events.",
       top_signal: "Block deal in ZOMATO: 1.5% equity changed hands at ₹145/share. Likely institutional churn.",
       portfolio_update: "Portfolio flat (+0.1%). RELIANCE saw some profit booking (-0.5%).",
       watch_today: "Monitor the Auto sector as monthly sales data is expected tomorrow. Keep an eye on TATAMOTORS."
    }
  ];

  for (let i = 0; i < briefHistory.length; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    await supabase.from("daily_briefs").upsert({
      user_id: userId,
      date: d.toISOString().slice(0, 10),
      brief_json: briefHistory[i]
    });
  }
  console.log(`  ✅ ${briefHistory.length} daily briefs added.`);

  // 3. Seed additional "Personas" for the demo
  console.log("👥 Seeding Demo Personas...");
  const personas = [
    {
      id: "77777777-7777-7777-7777-777777777777", // Semi-fake but needs a real UUID if using auth
      experience_level: "advanced",
      primary_goal: "aggressive_growth",
      risk_tolerance: "high",
      investment_horizon: "medium",
      onboarding_completed: true,
      profile_block: "Active trader with 10+ years experience. Focuses on small-cap breakouts and momentum plays."
    }
  ];
  // Since we can't seed auth.users easily here without more tricks, 
  // we'll stick to the one active user we found.
  
  console.log("\n🎉 HACKATHON DATA SEEDING COMPLETE.");
}

main().catch(console.error);
