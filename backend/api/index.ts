import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Convert Vercel request to Fetch API Request for Hono
  const url = `https://${req.headers.host || "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  let body: Uint8Array | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
    if (buf.length > 0) body = new Uint8Array(buf);
  }

  const fetchReq = new Request(url, {
    method: req.method,
    headers,
    body,
  });

  const honoRes = await app.fetch(fetchReq);

  res.status(honoRes.status);
  honoRes.headers.forEach((value, key) => res.setHeader(key, value));
  const responseBody = await honoRes.arrayBuffer();
  res.end(Buffer.from(responseBody));
}
