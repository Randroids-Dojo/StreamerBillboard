#!/usr/bin/env node
/**
 * Local chat ingestion script.
 * Connects to Twitch IRC and/or polls YouTube Live Chat, forwarding
 * all messages to the SBB ingest API.
 *
 * Usage:
 *   node scripts/ingest.mjs [--twitch <channel>] [--youtube <videoId>] [--target <url>]
 *
 * Defaults:
 *   --target  http://localhost:3000  (use https://streamer-billboard.vercel.app for prod)
 *
 * Reads env vars from .env.local if present.
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);

// Load .env.local
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // .env.local not present — rely on real env vars
}

// Parse args
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const twitchChannel = get("--twitch");
const youtubeVideoId = get("--youtube");
const target = get("--target") ?? "http://localhost:3000";

if (!twitchChannel && !youtubeVideoId) {
  console.error("Usage: node scripts/ingest.mjs [--twitch <channel>] [--youtube <videoId>] [--target <url>]");
  process.exit(1);
}

const ingestUrl = `${target}/api/ingest`;
console.log(`[SBB] Posting to: ${ingestUrl}`);

// Post a message to the ingest API
async function ingest(platform, username, message, timestamp) {
  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, username, message, timestamp }),
    });
    if (!res.ok) {
      console.warn(`[SBB:${platform}] Ingest failed (${res.status}): ${message}`);
    } else {
      console.log(`[SBB:${platform}] ${username}: ${message}`);
    }
  } catch (err) {
    console.error(`[SBB:${platform}] Ingest error: ${err.message}`);
  }
}

// ── Twitch ────────────────────────────────────────────────────────────────────

async function startTwitch(channel) {
  // Validate channel via Helix if credentials available
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    try {
      const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      });
      const { access_token } = await tokenRes.json();
      const userRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${channel}`,
        { headers: { "Client-Id": clientId, Authorization: `Bearer ${access_token}` } }
      );
      const userData = await userRes.json();
      if (!userData.data?.[0]) {
        console.error(`[SBB:twitch] Channel "${channel}" not found`);
        process.exit(1);
      }
      console.log(`[SBB:twitch] Channel verified: ${userData.data[0].display_name}`);
    } catch (err) {
      console.warn(`[SBB:twitch] Helix validation skipped: ${err.message}`);
    }
  }

  const tmi = require("tmi.js");
  const client = new tmi.Client({
    connection: { reconnect: true, secure: true },
    channels: [channel],
  });

  client.on("message", (_ch, tags, message) => {
    ingest(
      "twitch",
      tags["display-name"] ?? tags.username ?? "anonymous",
      message,
      new Date().toISOString()
    );
  });

  client.on("connected", () => console.log(`[SBB:twitch] Connected to #${channel}`));
  client.on("disconnected", (reason) => console.log(`[SBB:twitch] Disconnected: ${reason}`));

  await client.connect();
}

// ── YouTube ───────────────────────────────────────────────────────────────────

async function startYouTube(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[SBB:youtube] YOUTUBE_API_KEY is not set");
    process.exit(1);
  }

  // Fetch liveChatId
  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`
  );
  const videoData = await videoRes.json();
  const liveChatId = videoData.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!liveChatId) {
    console.error(`[SBB:youtube] No active live chat for video ${videoId}. Is the stream live?`);
    process.exit(1);
  }
  console.log(`[SBB:youtube] Live chat found for video ${videoId}`);

  let pageToken = null;

  async function poll() {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      url.searchParams.set("liveChatId", liveChatId);
      url.searchParams.set("part", "snippet,authorDetails");
      url.searchParams.set("key", apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`YouTube API ${res.status}: ${res.statusText}`);

      const data = await res.json();
      pageToken = data.nextPageToken;
      const interval = data.pollingIntervalMillis ?? 5000;

      for (const item of data.items ?? []) {
        ingest(
          "youtube",
          item.authorDetails.displayName,
          item.snippet.displayMessage,
          item.snippet.publishedAt
        );
      }

      setTimeout(poll, interval);
    } catch (err) {
      console.error(`[SBB:youtube] Poll error: ${err.message}`);
      setTimeout(poll, 10000); // retry after 10s on error
    }
  }

  poll();
}

// ── Start ─────────────────────────────────────────────────────────────────────

if (twitchChannel) await startTwitch(twitchChannel);
if (youtubeVideoId) await startYouTube(youtubeVideoId);
