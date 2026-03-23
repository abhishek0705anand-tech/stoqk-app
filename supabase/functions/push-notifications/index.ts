import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase edge function: send APNs push notifications
// Called after a user_notification row is inserted

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface PushPayload {
  user_id: string;
  notification_id: string;
  push_copy: string;
  urgency: "high" | "medium" | "low";
  signal_id?: string;
}

serve(async (req) => {
  const payload: PushPayload = await req.json();

  // Get device token for user
  const { data: device } = await supabase
    .from("user_devices")
    .select("apns_token")
    .eq("user_id", payload.user_id)
    .single();

  if (!device?.apns_token) {
    return new Response(JSON.stringify({ ok: false, reason: "no device token" }), { status: 200 });
  }

  // Build APNs payload
  const apnsPayload = {
    aps: {
      alert: {
        body: payload.push_copy,
      },
      sound: "default",
      badge: 1,
      "interruption-level": payload.urgency === "high" ? "time-sensitive" : "active",
    },
    signal_id: payload.signal_id,
    notification_id: payload.notification_id,
  };

  // Send via APNs HTTP/2 (using fetch with HTTP2)
  const apnsKey = Deno.env.get("APNS_AUTH_KEY")!;
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "com.stoqk.app";
  const isProd = Deno.env.get("APNS_ENV") === "production";

  const apnsUrl = `https://${isProd ? "api" : "api.sandbox"}.push.apple.com/3/device/${device.apns_token}`;

  // Build JWT for APNs auth
  const jwt = await buildAPNsJWT(apnsKey, keyId, teamId);

  const apnsRes = await fetch(apnsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": payload.urgency === "high" ? "10" : "5",
    },
    body: JSON.stringify(apnsPayload),
  });

  if (!apnsRes.ok) {
    const err = await apnsRes.text();
    console.error("APNs error:", apnsRes.status, err);
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

async function buildAPNsJWT(privateKey: string, keyId: string, teamId: string): Promise<string> {
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const keyBuffer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    enc.encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${signatureB64}`;
}
