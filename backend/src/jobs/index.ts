import { serve } from "inngest/hono";
import { Hono } from "hono";
import { inngest } from "./client.js";
import { signalFetchJob } from "./signal-fetch.js";
import { priceSyncJob } from "./price-sync.js";
import { macroSyncJob } from "./macro-sync.js";
import { dailyBriefJob } from "./daily-brief.js";
import { chatProcessJob } from "./chat-process.js";
import { fundamentalSyncJob } from "./fundamental-sync.js";

export { inngest };

// Build a Hono sub-app that handles Inngest webhook
export function mountInngest(app: Hono): void {
  const handler = serve({
    client: inngest,
    functions: [
      signalFetchJob,
      priceSyncJob,
      macroSyncJob,
      dailyBriefJob,
      chatProcessJob,
      fundamentalSyncJob,
    ],
  });
  // The serve() from inngest/hono returns a Hono handler — mount it directly
  app.use("/api/inngest/*", handler as Parameters<typeof app.use>[1]);
}
