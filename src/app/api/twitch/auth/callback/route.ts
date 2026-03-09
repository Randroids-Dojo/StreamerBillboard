import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { storeTwitchTokens } from "@/lib/chat/twitch-auth";

const KV_OAUTH_STATE = "sbb:twitch:oauth_state";

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

/**
 * GET /api/twitch/auth/callback — exchange OAuth code for tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `Twitch OAuth error: ${error}` },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return NextResponse.json(
      { error: "Missing required environment variables" },
      { status: 500 }
    );
  }

  // Verify CSRF state
  const redis = getRedis();
  const storedState = await redis.get<string>(KV_OAUTH_STATE);
  if (!storedState || storedState !== state) {
    return NextResponse.json(
      { error: "Invalid or expired state parameter" },
      { status: 400 }
    );
  }

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/twitch/auth/callback`;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Token exchange failed: ${res.status} ${text}` },
      { status: 500 }
    );
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Validate token and get user info + actual scopes granted
  const validateRes = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${data.access_token}` },
  });
  if (!validateRes.ok) {
    return NextResponse.json({ error: "Token validation failed" }, { status: 500 });
  }
  const validated = await validateRes.json() as {
    user_id: string;
    login: string;
    scopes: string[];
  };
  console.log("[SBB Twitch] OAuth granted scopes:", validated.scopes, "user:", validated.login, "id:", validated.user_id);

  // Store tokens + user ID, clean up state
  await storeTwitchTokens(data.access_token, data.refresh_token, data.expires_in);
  await redis.set("sbb:twitch:user_id", String(validated.user_id));
  await redis.del(KV_OAUTH_STATE);

  return NextResponse.redirect(`${appUrl}/?twitch_auth=success&user=${validated.login}&scopes=${validated.scopes.join(",")}`);
}
