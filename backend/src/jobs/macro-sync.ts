import { inngest } from "./client.js";
import { supabase } from "../lib/supabase.js";
import { fetchMacroData, fetchFIIDIIFlows } from "../lib/nse.js";

export const macroSyncJob = inngest.createFunction(
  { id: "macro-sync", name: "Sync macro indicators" },
  { cron: "30 12 * * 1-5" }, // 6pm IST (12:30 UTC)
  async ({ step }) => {
    const [macro, fiidii] = await step.run("fetch-macro", async () => {
      return Promise.all([fetchMacroData(), fetchFIIDIIFlows()]);
    });

    await step.run("save-macro", async () => {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("macro_indicators").upsert({
        date: today,
        ...macro,
        ...fiidii,
      });
    });

    return { date: macro.date };
  }
);
