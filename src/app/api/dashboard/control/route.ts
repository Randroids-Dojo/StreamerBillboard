import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { chatManager } from "@/lib/chat/manager";

const KV_YOUTUBE_LIVE_CHAT_ID = "sbb:youtube:live_chat_id";
const KV_YOUTUBE_PAGE_TOKEN = "sbb:youtube:page_token";
const KV_YOUTUBE_DISABLED = "sbb:youtube:disabled";

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action: "enable" | "disable" | "start" | "stop";
    platform: "youtube" | "twitch";
    channel?: string;
  };

  const { action, platform } = body;
  const redis = getRedis();

  if (platform === "youtube") {
    if (action === "disable") {
      await Promise.all([
        redis.set(KV_YOUTUBE_DISABLED, "1"),
        redis.del(KV_YOUTUBE_LIVE_CHAT_ID),
        redis.del(KV_YOUTUBE_PAGE_TOKEN),
      ]);
      return NextResponse.json({ ok: true, youtube: "disabled" });
    }
    if (action === "enable") {
      await redis.del(KV_YOUTUBE_DISABLED);
      return NextResponse.json({ ok: true, youtube: "enabled" });
    }
  }

  if (platform === "twitch") {
    if (action === "stop") {
      await chatManager.stopTwitch();
      return NextResponse.json({ ok: true, twitch: "stopped" });
    }
    if (action === "start") {
      if (!body.channel) {
        return NextResponse.json({ error: "channel is required" }, { status: 400 });
      }
      try {
        await chatManager.startTwitch(body.channel);
        return NextResponse.json({ ok: true, twitch: "started" });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ error: "Invalid action/platform" }, { status: 400 });
}
