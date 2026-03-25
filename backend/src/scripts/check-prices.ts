import { supabase } from "../lib/supabase.js";

async function main() {
  const { data, count, error } = await supabase
    .from("company_fundamentals")
    .select("*", { count: "exact" })
    .limit(10);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("Total Fundamentals Profiles:", count);
  if (data?.length) {
    console.log("Samples:", data.slice(0, 3));
  } else {
    console.log("No fundamentals found.");
  }
}

main().catch(console.error);
