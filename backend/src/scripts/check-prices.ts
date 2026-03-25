import { supabase } from "../lib/supabase.js";

async function main() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("status, plain, deeper")
    .eq("status", "done")
    .limit(3);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("Successful jobs:", data.length);
  data.forEach((m, i) => {
    console.log(`Job ${i+1}: Plain ${m.plain?.length}, Deeper ${m.deeper?.length}`);
  });
}

main().catch(console.error);
