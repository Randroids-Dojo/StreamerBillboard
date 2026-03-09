/** Twitch token management — app credentials and user OAuth tokens. */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// App token (Client Credentials flow) — in-memory cache
// ---------------------------------------------------------------------------

interface AppToken {
  accessToken: string;
  expiresAt: number; // ms since epoch
}

let cachedToken: AppToken | null = null;

/**
 * Returns a valid Twitch app access token, fetching or refreshing as needed.
 * Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars.
 */
export async function getTwitchAppToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set");
  }

  // Refresh 60s before expiry
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

// ---------------------------------------------------------------------------
// User token (OAuth Authorization Code flow) — stored in KV
// ---------------------------------------------------------------------------

const KV_ACCESS_TOKEN = "sbb:twitch:user_access_token";
const KV_REFRESH_TOKEN = "sbb:twitch:user_refresh_token";
const KV_EXPIRES_AT = "sbb:twitch:token_expires_at";

function hasRedis(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

/**
 * Store Twitch user OAuth tokens in KV.
 */
export async function storeTwitchTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  if (!hasRedis()) {
    throw new Error("KV not configured — cannot store Twitch tokens");
  }
  const redis = getRedis();
  const expiresAt = Date.now() + expiresIn * 1000;
  await Promise.all([
    redis.set(KV_ACCESS_TOKEN, accessToken),
    redis.set(KV_REFRESH_TOKEN, refreshToken),
    redis.set(KV_EXPIRES_AT, String(expiresAt)),
  ]);
}

/**
 * Returns a valid Twitch user access token.
 * Reads from KV, refreshes automatically if expired.
 * Throws a descriptive error if no token is stored.
 */
export async function getTwitchUserToken(): Promise<string> {
  if (!hasRedis()) {
    throw new Error(
      "KV not configured — cannot retrieve Twitch user token. Visit /api/twitch/auth to connect your account."
    );
  }

  const redis = getRedis();
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    redis.get<string>(KV_ACCESS_TOKEN),
    redis.get<string>(KV_REFRESH_TOKEN),
    redis.get<string>(KV_EXPIRES_AT),
  ]);

  if (!accessToken || !refreshToken) {
    throw new Error(
      "Twitch not authorized. Visit /api/twitch/auth to connect your account."
    );
  }

  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
  // Token is still valid (with 60s buffer)
  if (Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  // Token expired — refresh it
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set to refresh user token");
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Twitch token refresh failed: ${res.status} ${res.statusText}. Visit /api/twitch/auth to reconnect.`
    );
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await storeTwitchTokens(data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}
