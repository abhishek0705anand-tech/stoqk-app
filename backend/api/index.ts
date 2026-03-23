import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));

export const config = { maxDuration: 60 };
export default handle(app);
