import apn from "apn";

let provider: apn.Provider | null = null;

function getProvider(): apn.Provider | null {
  if (provider) return provider;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n"); // handle escaped newlines in env

  if (!keyId || !teamId || !key) {
    console.warn("[apns] Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_PRIVATE_KEY — push disabled");
    return null;
  }

  provider = new apn.Provider({
    token: { key, keyId, teamId },
    production: process.env.NODE_ENV === "production",
  });

  return provider;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPush(deviceToken: string, payload: PushPayload): Promise<boolean> {
  const p = getProvider();
  if (!p) return false;

  const note = new apn.Notification();
  note.alert = { title: payload.title, body: payload.body };
  note.sound = "default";
  note.topic = process.env.APNS_BUNDLE_ID || "com.stoqk.app";
  note.payload = payload.data || {};
  note.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL

  try {
    const result = await p.send(note, deviceToken);
    if (result.failed.length > 0) {
      console.error("[apns] Push failed:", result.failed[0].response);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[apns] Send error:", err);
    return false;
  }
}

export async function sendPushToMany(
  tokens: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const p = getProvider();
  if (!p || !tokens.length) return { sent: 0, failed: 0 };

  const note = new apn.Notification();
  note.alert = { title: payload.title, body: payload.body };
  note.sound = "default";
  note.topic = process.env.APNS_BUNDLE_ID || "com.stoqk.app";
  note.payload = payload.data || {};
  note.expiry = Math.floor(Date.now() / 1000) + 3600;

  try {
    const result = await p.send(note, tokens);
    return { sent: result.sent.length, failed: result.failed.length };
  } catch (err) {
    console.error("[apns] Batch send error:", err);
    return { sent: 0, failed: tokens.length };
  }
}
