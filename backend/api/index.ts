import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { maxDuration: 60 };

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
