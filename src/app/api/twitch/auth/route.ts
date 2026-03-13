import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import crypto from "crypto";

const KV_OAUTH_STATE = "sbb:twitch:oauth_state";
const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * GET /api/twitch/auth?key=<AUTH_SECRET> — redirect to Twitch OAuth authorization page.
 */
export async function GET(request: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  if (authSecret && request.nextUrl.searchParams.get("key") !== authSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId) {
    return NextResponse.json({ error: "TWITCH_CLIENT_ID is not configured" }, { status: 500 });
  }
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL is not configured" }, { status: 500 });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "KV store is not configured" }, { status: 500 });
  }

  // Generate CSRF state token and store in KV with TTL
  const state = crypto.randomBytes(32).toString("hex");
  const redis = getRedis();
  await redis.set(KV_OAUTH_STATE, state, { ex: OAUTH_STATE_TTL_SECONDS });

  const redirectUri = `${appUrl}/api/twitch/auth/callback`;
  const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "user:read:chat user:bot channel:bot");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("force_verify", "true");

  return NextResponse.redirect(authUrl.toString());
}
