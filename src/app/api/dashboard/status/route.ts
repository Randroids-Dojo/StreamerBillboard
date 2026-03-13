import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getTwitchStream } from "@/lib/chat/twitch-helix";

const KV_YOUTUBE_LIVE_CHAT_ID = "sbb:youtube:live_chat_id";
const KV_YOUTUBE_DISABLED = "sbb:youtube:disabled";
const KV_TWITCH_EVENTSUB_ID = "sbb:twitch:eventsub_id";
const KV_TWITCH_CHANNEL = "sbb:twitch:channel";
const KV_TWITCH_USER_TOKEN = "sbb:twitch:user_access_token";

export async function GET() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "KV not configured" }, { status: 500 });
  }

  const redis = getRedis();
  const [liveChatId, youtubeDisabled, eventsubId, twitchChannel, twitchUserToken] =
    await Promise.all([
      redis.get<string>(KV_YOUTUBE_LIVE_CHAT_ID),
      redis.get<string>(KV_YOUTUBE_DISABLED),
      redis.get<string>(KV_TWITCH_EVENTSUB_ID),
      redis.get<string>(KV_TWITCH_CHANNEL),
      redis.get<string>(KV_TWITCH_USER_TOKEN),
    ]);

  let twitchStream = null;
  if (twitchChannel && process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    try {
      twitchStream = await getTwitchStream(twitchChannel);
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({
    youtube: {
      active: !!liveChatId,
      disabled: youtubeDisabled === "1",
      liveChatId: liveChatId ?? null,
      autoDetect: !!process.env.YOUTUBE_CHANNEL_ID,
    },
    twitch: {
      active: !!twitchChannel,
      authorized: !!twitchUserToken,
      channel: twitchChannel ?? null,
      subscriptionId: eventsubId ?? null,
      stream: twitchStream,
    },
  });
}
