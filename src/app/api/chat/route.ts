import { NextRequest, NextResponse } from "next/server";
import { chatManager } from "@/lib/chat/manager";

/**
 * GET /api/chat — returns connection status for YouTube and Twitch.
 * When Twitch is connected and TWITCH_CLIENT_ID/SECRET are set, includes live stream info.
 */
export async function GET() {
  const [base, twitch] = await Promise.all([
    chatManager.status(),
    chatManager.twitchStatus(),
  ]);
  return NextResponse.json({ youtube: base.youtube, twitch });
}

/**
 * POST /api/chat — start or stop a chat listener.
 *
 * Body: { action: "start" | "stop", platform: "youtube" | "twitch", videoId?: string, channel?: string }
 */
export async function POST(request: NextRequest) {
  let body: {
    action: "start" | "stop";
    platform: "youtube" | "twitch";
    videoId?: string;
    channel?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, platform } = body;

  if (!action || !platform) {
    return NextResponse.json(
      { error: "Missing required fields: action, platform" },
      { status: 400 }
    );
  }

  if (action === "stop") {
    if (platform === "youtube") {
      chatManager.stopYouTube();
    } else if (platform === "twitch") {
      await chatManager.stopTwitch();
    }
    return NextResponse.json({ status: "stopped", ...chatManager.status() });
  }

  if (action === "start") {
    try {
      if (platform === "youtube") {
        if (!body.videoId) {
          return NextResponse.json(
            { error: "videoId is required to start YouTube chat" },
            { status: 400 }
          );
        }
        await chatManager.startYouTube(body.videoId);
      } else if (platform === "twitch") {
        if (!body.channel) {
          return NextResponse.json(
            { error: "channel is required to start Twitch chat" },
            { status: 400 }
          );
        }
        await chatManager.startTwitch(body.channel);
      }
      return NextResponse.json({ status: "started", ...chatManager.status() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: 'action must be "start" or "stop"' },
    { status: 400 }
  );
}
