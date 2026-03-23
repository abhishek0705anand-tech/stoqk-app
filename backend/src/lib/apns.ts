export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function getProvider() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!keyId || !teamId || !key) {
    console.warn("[apns] Missing APNS credentials — push disabled");
    return null;
  }

  // Dynamic import so the native module doesn't load at Lambda startup
  const apn = (await import("apn")).default;
  return new apn.Provider({
    token: { key, keyId, teamId },
    production: process.env.NODE_ENV === "production",
  });
}

export async function sendPush(deviceToken: string, payload: PushPayload): Promise<boolean> {
  const provider = await getProvider();
  if (!provider) return false;

  const apn = (await import("apn")).default;
  const note = new apn.Notification();
  note.alert = { title: payload.title, body: payload.body };
  note.sound = "default";
  note.topic = process.env.APNS_BUNDLE_ID || "com.stoqk.app";
  note.payload = payload.data || {};
  note.expiry = Math.floor(Date.now() / 1000) + 3600;

  try {
    const result = await provider.send(note, deviceToken);
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

export async function sendPushToMany(tokens: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const provider = await getProvider();
  if (!provider || !tokens.length) return { sent: 0, failed: 0 };

  const apn = (await import("apn")).default;
  const note = new apn.Notification();
  note.alert = { title: payload.title, body: payload.body };
  note.sound = "default";
  note.topic = process.env.APNS_BUNDLE_ID || "com.stoqk.app";
  note.payload = payload.data || {};
  note.expiry = Math.floor(Date.now() / 1000) + 3600;

  try {
    const result = await provider.send(note, tokens);
    return { sent: result.sent.length, failed: result.failed.length };
  } catch (err) {
    console.error("[apns] Batch send error:", err);
    return { sent: 0, failed: tokens.length };
  }
}
