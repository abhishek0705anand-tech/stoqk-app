import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { buildProfile } from "../agents/profile-builder.js";
import { updateDerivedFields } from "../lib/profile.js";
import type { OnboardingAnswers } from "../types/index.js";

const profile = new Hono();

// Complete onboarding — creates profile
profile.post("/onboarding", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const answers = await c.req.json<OnboardingAnswers>();

  const result = await buildProfile(answers);

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({
      id: userId,
      ...result.profile_record,
      profile_block: result.profile_block,
      portfolio_size_bucket: "under_1L",
      top_holdings: [],
      sector_concentration: {},
      onboarding_completed: true,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
});

// Get own profile
profile.get("/me", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return c.json({ error: "Profile not found" }, 404);
  return c.json({ profile: data });
});

// Update profile fields
profile.patch("/me", async (c) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const updates = await c.req.json();
  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Recompile profile block
  await updateDerivedFields(userId);

  return c.json({ profile: data });
});

export default profile;
