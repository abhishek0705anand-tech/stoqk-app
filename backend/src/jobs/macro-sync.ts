import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { fetchMacroData, fetchFIIDIIFlows } from "../lib/nse.js";

export async function syncMacroIndicators() {
  const [macro, fiidii] = await Promise.all([fetchMacroData(), fetchFIIDIIFlows()]);
  const today = new Date().toISOString().slice(0, 10);
  
  await supabase.from("macro_indicators").upsert({
    date: today,
    ...macro,
    ...fiidii,
  });
  
  return { date: macro.date };
}

export const macroSyncJob = inngest.createFunction(
  { id: "macro-sync", name: "Sync macro indicators" },
  { cron: "30 12 * * 1-5" }, // 6pm IST (12:30 UTC)
  async ({ step }) => {
    return await step.run("sync-macro", async () => {
      return syncMacroIndicators();
    });
  }
);
