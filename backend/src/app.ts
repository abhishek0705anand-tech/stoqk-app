import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import profileRoutes from "./routes/profile.js";
import holdingsRoutes from "./routes/holdings.js";
import signalsRoutes from "./routes/signals.js";
import chatRoutes from "./routes/chat.js";
import watchlistRoutes from "./routes/watchlist.js";
import briefsRoutes from "./routes/briefs.js";
import patternsRoutes from "./routes/patterns.js";
import internalRoutes from "./routes/internal.js";
import newsRoutes from "./routes/news.js";
// Inngest mounted only outside Vercel (local dev via src/index.ts)
// On Vercel, jobs are triggered via inngest.send() events from routes
const isVercel = !!process.env.VERCEL;
let mountInngest: ((app: ReturnType<typeof import("hono").Hono>) => void) | null = null;
if (!isVercel) {
  const jobsModule = await import("./jobs/index.js");
  mountInngest = jobsModule.mountInngest;
}

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3001",
      "capacitor://localhost",
      "ionic://localhost",
    ],
    credentials: true,
  })
);

// Health
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// API v1
const api = new Hono();
api.route("/profile", profileRoutes);
api.route("/holdings", holdingsRoutes);
api.route("/signals", signalsRoutes);
api.route("/chat", chatRoutes);
api.route("/watchlist", watchlistRoutes);
api.route("/briefs", briefsRoutes);
api.route("/patterns", patternsRoutes);
api.route("/internal", internalRoutes);
api.route("/news", newsRoutes);

app.route("/api/v1", api);

// Inngest webhook (local dev only)
if (mountInngest) mountInngest(app);

export default app;
