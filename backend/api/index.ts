import { handle } from "hono/vercel";
import app from "../src/app.js";

// maxDuration requires Vercel Pro plan (10s on Hobby, 300s on Pro)
export const config = { maxDuration: 60 };

export default handle(app);
