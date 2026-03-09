import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processChatMessage } from "@/lib/chat/processor";
import type { ChatMessage } from "@/lib/parser";

/**
 * POST /api/twitch/eventsub — Twitch EventSub webhook handler.
 *
 * Verifies the HMAC-SHA256 signature and handles:
 *   - webhook_callback_verification: responds with the challenge
 *   - notification: processes chat messages
 *   - revocation: logs and acknowledges
 */
export async function POST(request: NextRequest) {
  // Read raw body first — required for signature verification
  const rawBody = await request.text();

  const messageId = request.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const messageTimestamp = request.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const messageSignature = request.headers.get("Twitch-Eventsub-Message-Signature") ?? "";
  const messageType = request.headers.get("Twitch-Eventsub-Message-Type") ?? "";

  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) {
    console.error("[SBB EventSub] TWITCH_EVENTSUB_SECRET is not set");
    return new NextResponse("Server misconfiguration", { status: 500 });
  }

  // Verify HMAC-SHA256 signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(messageId + messageTimestamp + rawBody);
  const expectedSignature = "sha256=" + hmac.digest("hex");

  if (
    expectedSignature.length !== messageSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(messageSignature)
    )
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Handle challenge verification
  if (messageType === "webhook_callback_verification") {
    const challenge = payload.challenge as string;
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Handle revocation
  if (messageType === "revocation") {
    console.log("[SBB EventSub] Subscription revoked:", JSON.stringify(payload.subscription));
    return new NextResponse("OK", { status: 200 });
  }

  // Handle notification
  if (messageType === "notification") {
    const event = payload.event as Record<string, unknown> | undefined;
    if (event) {
      const messageObj = event.message as Record<string, unknown> | undefined;
      const text = messageObj?.text as string | undefined;
      const chatterUserName = event.chatter_user_name as string | undefined;

      if (text && chatterUserName) {
        const msg: ChatMessage = {
          platform: "twitch",
          username: chatterUserName,
          message: text,
          timestamp: new Date().toISOString(),
        };
        try {
          await processChatMessage(msg);
        } catch (err) {
          console.error("[SBB EventSub] processChatMessage error:", err);
        }
      }
    }
    return new NextResponse("OK", { status: 200 });
  }

  return new NextResponse("OK", { status: 200 });
}
