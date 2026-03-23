import { compileProfileBlock } from "../lib/profile.js";
import type { OnboardingAnswers, UserProfile } from "../types/index.js";

interface ProfileBuilderOutput {
  profile_record: Omit<UserProfile, "id" | "top_holdings" | "sector_concentration" | "portfolio_size_bucket" | "profile_block" | "created_at" | "updated_at">;
  profile_block: string;
}

export async function buildProfile(answers: OnboardingAnswers): Promise<ProfileBuilderOutput> {
  const profile_record = {
    experience_level: answers.experience_level,
    primary_goal: answers.primary_goal,
    risk_tolerance: answers.risk_tolerance,
    investment_horizon: answers.investment_horizon,
    preferred_sectors: answers.preferred_sectors ?? [],
    onboarding_completed: true,
  };

  const partialProfile = {
    ...profile_record,
    top_holdings: [],
    sector_concentration: {},
    portfolio_size_bucket: "under_1L" as const,
    profile_block: "",
    id: "",
    created_at: "",
    updated_at: "",
  } as UserProfile;

  const profile_block = compileProfileBlock(partialProfile);
  return { profile_record, profile_block };
}
