import { GoogleGenerativeAI } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const FAST_MODEL = "gemini-2.0-flash";   // high-volume agents: signal scoring, alert filter, brief
export const SMART_MODEL = "gemini-2.0-flash";  // chat agent: reasoning + citations

export async function runAgent<T>(
  systemPrompt: string,
  userContent: string,
  model: string = FAST_MODEL
): Promise<T> {
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
