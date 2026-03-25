import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createDemoUser() {
  const email = "demo@stoqk.app";
  const password = "password123";

  console.log(`🚀 Creating demo user: ${email}...`);

  // 1. Create User in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already registered")) {
        console.log("  ℹ️ User already exists in Auth. Updating...");
        const { data: userData } = await supabase.auth.admin.listUsers();
        const existingUser = userData.users.find(u => u.email === email);
        if (!existingUser) throw new Error("Could not find existing user");
        userId = existingUser.id;
    } else {
        throw authError;
    }
  } else {
    userId = authData.user.id;
    console.log(`  ✅ Auth user created: ${userId}`);
  }

  // 2. Create User Profile
  console.log("  👤 Setting up profile...");
  const { error: profileError } = await supabase.from("user_profiles").upsert({
    id: userId,
    experience_level: "advanced",
    primary_goal: "wealth_building",
    risk_tolerance: "medium",
    investment_horizon: "long",
    preferred_sectors: ["Technology", "Banking", "Energy"],
    portfolio_size_bucket: "above_10L",
    profile_block: "Strategic investor focused on blue-chip growth and institutional signals.",
    onboarding_completed: true
  });

  if (profileError) throw profileError;

  // 3. Seed Holdings (Copying standard set)
  console.log("  💰 Seeding holdings...");
  const holdings = [
    { user_id: userId, ticker: "RELIANCE", qty: 45, avg_buy_price: 2450.50 },
    { user_id: userId, ticker: "HDFCBANK", qty: 120, avg_buy_price: 1520.00 },
    { user_id: userId, ticker: "TCS", qty: 25, avg_buy_price: 3600.00 },
    { user_id: userId, ticker: "INFY", qty: 85, avg_buy_price: 1450.40 },
    { user_id: userId, ticker: "TATAMOTORS", qty: 200, avg_buy_price: 910.25 },
    { user_id: userId, ticker: "SBIN", qty: 150, avg_buy_price: 640.80 },
  ];
  await supabase.from("user_holdings").upsert(holdings, { onConflict: "user_id,ticker" });

  // 4. Seed Watchlist
  console.log("  👀 Seeding watchlist...");
  const watchlist = ["ZOMATO", "ADANIPORTS", "ITC", "BHARTIARTL", "BAJFINANCE"];
  for (const t of watchlist) {
    await supabase.from("user_watchlist").upsert({ user_id: userId, ticker: t }, { onConflict: "user_id,ticker" });
  }

  console.log("\n✨ DEMO ACCOUNT READY!");
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
}

createDemoUser().catch(e => {
    console.error("❌ FAILED:", e.message);
    process.exit(1);
});
