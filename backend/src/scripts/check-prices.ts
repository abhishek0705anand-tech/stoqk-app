import { supabase } from "../lib/supabase.js";

async function main() {
  const { data } = await supabase.from("macro_indicators").select("*").order("date", { ascending: false }).limit(5);
  console.log("Recent Macro Data:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
