import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { processChatMessage } from "@/lib/chat/processor";
import type { ChatMessage } from "@/lib/parser";

const KV_YOUTUBE_LIVE_CHAT_ID = "sbb:youtube:live_chat_id";
const KV_YOUTUBE_PAGE_TOKEN = "sbb:youtube:page_token";

interface YouTubeChatMessageItem {
  snippet: {
    displayMessage: string;
    authorChannelId: string;
    publishedAt: string;
  };
  authorDetails: {
    displayName: string;
  };
}

interface YouTubeLiveChatResponse {
  items: YouTubeChatMessageItem[];
  nextPageToken: string;
  pollingIntervalMillis: number;
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

/**
 * GET /api/cron/youtube — Vercel Cron handler (runs every minute).
 * Polls the YouTube Live Chat API and processes new messages.
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "KV not configured" }, { status: 500 });
  }

  const redis = getRedis();

  // Check if YouTube is active
  const liveChatId = await redis.get<string>(KV_YOUTUBE_LIVE_CHAT_ID);
  if (!liveChatId) {
    return NextResponse.json({ status: "idle" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY is not set" }, { status: 500 });
  }

  const pageToken = await redis.get<string>(KV_YOUTUBE_PAGE_TOKEN);

  // Build request URL
  const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
  url.searchParams.set("liveChatId", liveChatId);
  url.searchParams.set("part", "snippet,authorDetails");
  url.searchParams.set("key", apiKey);
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  let data: YouTubeLiveChatResponse;
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
    }
    data = await res.json() as YouTubeLiveChatResponse;
  } catch (err) {
    console.error("[SBB Cron YouTube] Fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Process messages
  const messages: ChatMessage[] = (data.items ?? []).map((item) => ({
    platform: "youtube" as const,
    username: item.authorDetails.displayName,
    message: item.snippet.displayMessage,
    timestamp: item.snippet.publishedAt,
  }));

  for (const msg of messages) {
    try {
      await processChatMessage(msg);
    } catch (err) {
      console.error("[SBB Cron YouTube] processChatMessage error:", err);
    }
  }

  // Store next page token
  if (data.nextPageToken) {
    await redis.set(KV_YOUTUBE_PAGE_TOKEN, data.nextPageToken);
  }

  return NextResponse.json({
    status: "ok",
    processed: messages.length,
    nextPageToken: data.nextPageToken ?? null,
  });
}
