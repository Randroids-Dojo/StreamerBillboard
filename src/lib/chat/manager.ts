import { hasRedis, getRedis } from "@/lib/redis";
import { getLiveChatId } from "./youtube";
import { getTwitchAppToken, getTwitchUserToken } from "./twitch-auth";
import { getTwitchUser, getTwitchStream, type TwitchStream } from "./twitch-helix";

// ---------------------------------------------------------------------------
// KV keys
// ---------------------------------------------------------------------------

const KV_YOUTUBE_LIVE_CHAT_ID = "sbb:youtube:live_chat_id";
const KV_YOUTUBE_PAGE_TOKEN = "sbb:youtube:page_token";
const KV_TWITCH_EVENTSUB_ID = "sbb:twitch:eventsub_id";
const KV_TWITCH_CHANNEL = "sbb:twitch:channel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface TwitchStatus {
  connected: boolean;
  channel?: string;
  stream?: TwitchStream | null;
}

// ---------------------------------------------------------------------------
// ChatManager — serverless-compatible, all state stored in KV
// ---------------------------------------------------------------------------

class ChatManager {
  // -------------------------------------------------------------------------
  // YouTube
  // -------------------------------------------------------------------------

  async startYouTube(videoId: string): Promise<void> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY env var is not set");

    const liveChatId = await getLiveChatId(videoId, apiKey);

    if (!hasRedis()) {
      throw new Error("KV store is required to run YouTube chat ingestion");
    }

    const redis = getRedis();
    await Promise.all([
      redis.set(KV_YOUTUBE_LIVE_CHAT_ID, liveChatId),
      redis.del(KV_YOUTUBE_PAGE_TOKEN),
    ]);
  }

  async stopYouTube(): Promise<void> {
    if (!hasRedis()) return;
    const redis = getRedis();
    await Promise.all([
      redis.del(KV_YOUTUBE_LIVE_CHAT_ID),
      redis.del(KV_YOUTUBE_PAGE_TOKEN),
    ]);
  }

  // -------------------------------------------------------------------------
  // Twitch
  // -------------------------------------------------------------------------

  async startTwitch(channel: string): Promise<void> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const appUrl = process.env.APP_URL;
    const eventsubSecret = process.env.TWITCH_EVENTSUB_SECRET;

    if (!clientId) throw new Error("TWITCH_CLIENT_ID is not set");
    if (!appUrl) throw new Error("APP_URL is not set");
    if (!eventsubSecret) throw new Error("TWITCH_EVENTSUB_SECRET is not set");

    // Verify user has authorized and get their stored Twitch user ID
    await getTwitchUserToken();

    const redis = getRedis();
    const [user, appToken, storedUserId] = await Promise.all([
      getTwitchUser(channel),
      getTwitchAppToken(),
      redis.get<string>("sbb:twitch:user_id"),
    ]);
    if (!user) throw new Error(`Twitch channel "${channel}" not found`);

    const broadcasterUserId = user.id;
    // Use the user ID stored during OAuth — guarantees it matches the authorized account
    const chatUserId = storedUserId ?? broadcasterUserId;
    console.log(`[SBB Twitch] broadcaster_user_id=${broadcasterUserId} user_id=${chatUserId} stored=${storedUserId ?? "none"}`);

    if (!hasRedis()) {
      throw new Error("KV store is required to run Twitch chat ingestion");
    }

    // Delete existing subscription if any
    const existingSubId = await redis.get<string>(KV_TWITCH_EVENTSUB_ID);
    if (existingSubId) {
      await deleteEventSubSubscription(existingSubId, appToken, clientId);
    }

    // Register new EventSub subscription (webhooks require app access token)
    const subId = await createEventSubSubscription({
      broadcasterUserId,
      chatUserId,
      appToken,
      clientId,
      appUrl,
      eventsubSecret,
    });

    await Promise.all([
      redis.set(KV_TWITCH_EVENTSUB_ID, subId),
      redis.set(KV_TWITCH_CHANNEL, channel),
    ]);
  }

  async stopTwitch(): Promise<void> {
    if (!hasRedis()) return;

    const redis = getRedis();
    const [subId] = await Promise.all([
      redis.get<string>(KV_TWITCH_EVENTSUB_ID),
    ]);

    if (subId) {
      const clientId = process.env.TWITCH_CLIENT_ID ?? "";
      try {
        const appToken = await getTwitchAppToken();
        await deleteEventSubSubscription(subId, appToken, clientId);
      } catch (err) {
        console.error("[SBB Twitch] Error deleting EventSub subscription:", err);
      }
    }

    await Promise.all([
      redis.del(KV_TWITCH_EVENTSUB_ID),
      redis.del(KV_TWITCH_CHANNEL),
    ]);
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  async status(): Promise<{ youtube: boolean; twitch: boolean; twitchChannel?: string }> {
    if (!hasRedis()) {
      return { youtube: false, twitch: false };
    }

    const redis = getRedis();
    const [liveChatId, twitchChannel] = await Promise.all([
      redis.get<string>(KV_YOUTUBE_LIVE_CHAT_ID),
      redis.get<string>(KV_TWITCH_CHANNEL),
    ]);

    return {
      youtube: !!liveChatId,
      twitch: !!twitchChannel,
      ...(twitchChannel ? { twitchChannel } : {}),
    };
  }

  async twitchStatus(): Promise<TwitchStatus> {
    if (!hasRedis()) return { connected: false };

    const redis = getRedis();
    const channel = await redis.get<string>(KV_TWITCH_CHANNEL);
    if (!channel) return { connected: false };

    let stream: TwitchStream | null = null;
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      try {
        stream = await getTwitchStream(channel);
      } catch {
        // Non-fatal — return connected status without stream info
      }
    }

    return { connected: true, channel, stream };
  }

  async stopAll(): Promise<void> {
    await Promise.all([this.stopYouTube(), this.stopTwitch()]);
  }
}

// ---------------------------------------------------------------------------
// EventSub Helix helpers
// ---------------------------------------------------------------------------

async function deleteEventSubSubscription(
  subId: string,
  userToken: string,
  clientId: string
): Promise<void> {
  const url = new URL("https://api.twitch.tv/helix/eventsub/subscriptions");
  url.searchParams.set("id", subId);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${userToken}`,
    },
  });

  // 204 No Content is expected; 404 means already deleted — both are fine
  if (!res.ok && res.status !== 404) {
    console.error(
      `[SBB Twitch] Failed to delete EventSub subscription ${subId}: ${res.status} ${res.statusText}`
    );
  }
}

async function createEventSubSubscription(opts: {
  broadcasterUserId: string;
  chatUserId: string;
  appToken: string;
  clientId: string;
  appUrl: string;
  eventsubSecret: string;
}): Promise<string> {
  const { broadcasterUserId, chatUserId, appToken, clientId, appUrl, eventsubSecret } = opts;

  const body = {
    type: "channel.chat.message",
    version: "1",
    condition: {
      broadcaster_user_id: String(broadcasterUserId),
      user_id: String(chatUserId),
    },
    transport: {
      method: "webhook",
      callback: `${appUrl}/api/twitch/eventsub`,
      secret: eventsubSecret,
    },
  };
  console.log("[SBB Twitch] EventSub subscription body:", JSON.stringify({ ...body, transport: { ...body.transport, secret: "[redacted]" } }));

  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to create EventSub subscription: ${res.status} ${text}`
    );
  }

  const data = await res.json() as { data: Array<{ id: string }> };
  const subId = data.data?.[0]?.id;
  if (!subId) {
    throw new Error("EventSub subscription response missing ID");
  }
  return subId;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const chatManager = new ChatManager();
