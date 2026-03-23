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
import { authMiddleware } from "./middleware/auth.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { mountInngest } = await import("./jobs/index.js") as any;

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
api.use("*", authMiddleware);
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

// Inngest webhook (serves both local dev and Vercel production)
mountInngest(app);

export default app;
