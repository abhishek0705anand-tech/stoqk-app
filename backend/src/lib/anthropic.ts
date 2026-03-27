import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabase.js";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const FAST_MODEL = "gemini-2.0-flash";   // high-volume agents: signal scoring, alert filter, brief
export const SMART_MODEL = "gemini-2.0-flash";  // chat agent: reasoning + citations

const DAILY_LIMIT = 1000;

/**
 * Atomically increments today's Gemini call counter in the gemini_usage table
 * and throws if the daily limit has been reached.
 *
 * Uses an upsert so the row is created automatically on the first call of the day.
 * The increment + read is a single round-trip, so there's no race condition across
 * parallel Vercel function invocations.
 *
 * Required table (run once in Supabase SQL editor):
 *   CREATE TABLE gemini_usage (
 *     date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
 *     call_count INTEGER NOT NULL DEFAULT 0
 *   );
 */
async function checkAndIncrementLimit(): Promise<void> {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data, error } = await supabase.rpc("increment_gemini_usage", {
    usage_date: today,
  });

  if (error) {
    // If the RPC doesn't exist yet, fail open so the app keeps working
    console.warn("gemini_usage RPC error (failing open):", error.message);
    return;
  }

  if (data > DAILY_LIMIT) {
    throw new Error(
      `Daily Gemini limit reached (${DAILY_LIMIT} calls). Resets at midnight UTC.`
    );
  }
}

export async function runAgent<T>(
  systemPrompt: string,
  userContent: string,
  model: string = FAST_MODEL
): Promise<T> {
  await checkAndIncrementLimit();

  const geminiModel = genai.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { maxOutputTokens: 1024 },
  });

  const text = result.response.text();

  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Agent returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

export async function* streamAgent(
  systemPrompt: string,
  userContent: string
): AsyncGenerator<string> {
  await checkAndIncrementLimit();

  const geminiModel = genai.getGenerativeModel({
    model: SMART_MODEL,
    systemInstruction: systemPrompt,
  });

  const stream = await geminiModel.generateContentStream({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { maxOutputTokens: 2048 },
  });

  for await (const chunk of stream.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
