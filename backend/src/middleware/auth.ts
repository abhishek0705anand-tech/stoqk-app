import { createMiddleware } from "hono/factory";
import { supabaseAnon } from "../lib/supabase.js";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", user.id);
  await next();
});
