# Game Design Document: Streamer Billboard (SBB)

## Overview

**Elevator Pitch**: "A live-streamer's interactive backdrop — viewers type commands in YouTube or Twitch chat to control what appears on a massive ultra-wide monitor behind the streamer in real time."

A Samsung Odyssey G9 (5120x1440, 32:9) is mounted behind the streamer and runs a full-screen HTML5 app in Chrome. Viewers interact by posting chat messages prefixed with `SBB`. The hosted app detects those messages, updates shared state, and the display reacts instantly — turning the monitor into a crowd-controlled billboard.

**Tech Stack**:

- Frontend: Next.js (React) with HTML5 Canvas / CSS for rendering
- Backend: Next.js API routes on Vercel
- Hosting / CI-CD: Vercel (auto-deploy from GitHub)
- Real-time State: Vercel KV (Redis-compatible storage)
- Chat Ingestion: YouTube Live Chat API, Twitch IRC (via TMI.js or EventSub)

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐
│  YouTube Live Chat  │      │   Twitch Chat (IRC)  │
│      (API poll)     │      │     (WebSocket)      │
└────────┬────────────┘      └──────────┬───────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────┐
│              Vercel — Next.js Backend               │
│                                                     │
│  ┌───────────────┐   ┌────────────────────────────┐ │
│  │ /api/ingest   │──▶│  Command Parser            │ │
│  │  (webhook /   │   │  • strip "SBB" prefix      │ │
│  │   poll loop)  │   │  • validate & sanitize     │ │
│  └───────────────┘   │  • map to state mutation   │ │
│                      └─────────────┬──────────────┘ │
│                                    ▼                │
│                      ┌────────────────────────────┐ │
│                      │  Vercel KV (shared state)  │ │
│                      └─────────────┬──────────────┘ │
│                                    │                │
│  ┌───────────────┐                 │                │
│  │ /api/state    │◀────────────────┘                │
│  │  (GET / SSE)  │                                  │
│  └───────┬───────┘                                  │
└──────────┼──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Samsung Odyssey G9 (Browser)   │
│  Full-screen Chrome — HTML5 App │
│  Polls /api/state or listens    │
│  via SSE for live updates       │
└──────────────────────────────────┘
```

### Data Flow

1. **Chat Ingestion** — A background process (Vercel cron or long-running serverless function) monitors YouTube Live Chat API and Twitch IRC for messages prefixed with `SBB`.
2. **Command Parsing** — The `SBB` prefix is stripped. The remainder is parsed as a command (e.g., `Red`, `Blue`, `#FF00FF`). Input is validated and sanitized.
3. **State Mutation** — Valid commands update shared state in Vercel KV. Each command type writes to a well-known key (e.g., `sbb:bgcolor`).
4. **Display Sync** — The billboard app (running full-screen on the Odyssey G9) polls `/api/state` on a short interval or subscribes via Server-Sent Events. When state changes, the UI re-renders.

## MVP — Background Color Control

The minimum viable product proves the entire pipeline end-to-end with the simplest possible visual effect: changing the background color of the billboard.

### MVP Command

```
SBB Red
SBB #FF6600
SBB rgb(100, 200, 50)
```

**Rules**:
- Command parsing is case-insensitive (`SBB red` = `SBB RED`).
- Accepts CSS named colors, hex codes, and `rgb()` values.
- Invalid colors are silently ignored (no error displayed on screen).
- The most recent valid color command wins.

### MVP State Shape

```json
{
  "bgcolor": "#ff0000",
  "lastUpdatedBy": "username",
  "lastUpdatedAt": "2026-03-08T12:00:00Z"
}
```

### MVP Display

- Full-screen page with the background set to the current `bgcolor`.
- Subtle overlay in the corner showing the current color name/hex and who set it (can be toggled off for clean streaming).
- Smooth CSS transition between colors (e.g., `transition: background-color 0.5s ease`).

## Chat Integration

### YouTube Live Chat API

- Use the YouTube Data API v3 `liveChatMessages.list` endpoint.
- Poll on a cadence dictated by the API's `pollingIntervalMillis` response field.
- Requires an active live broadcast with a known `liveChatId`.
- Auth via OAuth 2.0 or API key scoped to the streamer's channel.

### Twitch Chat

- Connect via IRC WebSocket (`wss://irc-ws.chat.twitch.tv`) using TMI.js or a lightweight custom client.
- Authenticate with a Twitch OAuth token.
- Listen for `PRIVMSG` events, filter for the `SBB` prefix.

### Unified Ingestion

Both chat sources feed into the same command parser. Messages carry metadata:

```json
{
  "platform": "youtube" | "twitch",
  "username": "viewer123",
  "message": "SBB Red",
  "timestamp": "2026-03-08T12:00:00Z"
}
```

## Command Parsing

The parser is a pipeline:

1. **Prefix Check** — Message must start with `SBB` (case-insensitive). Strip the prefix.
2. **Trim & Normalize** — Trim whitespace, normalize casing.
3. **Command Routing** — Match the remainder against registered command handlers. MVP has one handler: `ColorCommand`.
4. **Validation** — Each handler validates its input (e.g., is this a real CSS color?).
5. **State Write** — Valid commands write to Vercel KV.

This pipeline is designed to be extended: new command handlers are registered without changing the parser itself.

## Display App (Billboard)

### Target Hardware

- **Monitor**: Samsung Odyssey G9 — 5120x1440, 32:9 aspect ratio.
- **Browser**: Chrome in full-screen (kiosk) mode (`--kiosk --app=<url>`).

### Rendering

- The billboard is a single Next.js page (`/billboard`).
- It connects to the backend for state and re-renders reactively.
- MVP renders a full-screen `<div>` with a dynamic `background-color`.
- Future features will layer additional visual elements on top.

### State Synchronization

Two strategies, with SSE preferred:

1. **Polling** — `GET /api/state` every 1–2 seconds. Simple, works everywhere.
2. **Server-Sent Events (SSE)** — `/api/state/stream` pushes updates as they happen. Lower latency, lower overhead.

The client falls back to polling if SSE connection drops.

## Future Features (Post-MVP Roadmap)

These features extend the `SBB` command vocabulary. Each is an independent module registered with the command parser.

| Feature | Command Example | Description |
|---|---|---|
| **Text Display** | `SBB text Hello World!` | Renders large text on the billboard. |
| **Tic-Tac-Toe** | `SBB ttt 5` (place in cell 5) | Viewers play tic-tac-toe on the billboard. Turn-based, crowd vs. crowd or crowd vs. streamer. |
| **Animations** | `SBB anim fireworks` | Triggers a predefined CSS/Canvas animation. |
| **Counter** | `SBB count up` / `SBB count reset` | Increments, decrements, or resets a visible counter. |
| **Website Embed** | `SBB web https://example.com` | Displays a whitelisted website in an iframe. |
| **Sound Effects** | `SBB sfx airhorn` | Plays a sound from a curated library on the billboard machine. |
| **Text-to-Speech** | `SBB tts Check this out!` | Converts text to speech and plays it aloud. |

### Future Considerations

- **Rate Limiting** — Per-user cooldowns to prevent spam.
- **Moderation** — Blocklist for inappropriate text/TTS content. Streamer override commands (e.g., `SBB clear`, `SBB lock`).
- **Streamer Controls** — A separate `/dashboard` page for the streamer to enable/disable features, set cooldowns, view command history, and manually override state.
- **Multi-Monitor** — Support for multiple billboard displays with independent or synchronized state.
- **Persistent History** — Log all commands for replay, analytics, or highlight reels.

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/ingest` | POST | Receives chat messages from ingestion workers. Parses and applies commands. |
| `/api/state` | GET | Returns the current billboard state as JSON. |
| `/api/state/stream` | GET | SSE endpoint for real-time state updates. |
| `/api/admin/config` | GET/POST | Streamer dashboard configuration (future). |

## Project Structure

```
StreamerBillboard/
├── Docs/
│   └── GDD.md
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing / info page
│   │   ├── billboard/
│   │   │   └── page.tsx          # Full-screen billboard display
│   │   └── dashboard/
│   │       └── page.tsx          # Streamer control panel (future)
│   ├── api/
│   │   ├── ingest/
│   │   │   └── route.ts          # Chat message ingestion
│   │   ├── state/
│   │   │   ├── route.ts          # GET current state
│   │   │   └── stream/
│   │   │       └── route.ts      # SSE endpoint
│   │   └── admin/
│   │       └── config/
│   │           └── route.ts      # Dashboard config (future)
│   ├── lib/
│   │   ├── parser.ts             # Command parser pipeline
│   │   ├── commands/
│   │   │   └── color.ts          # MVP color command handler
│   │   ├── chat/
│   │   │   ├── youtube.ts        # YouTube Live Chat poller
│   │   │   └── twitch.ts         # Twitch IRC client
│   │   └── store.ts              # Vercel KV state read/write
│   └── components/
│       └── Billboard.tsx         # Billboard renderer component
├── public/
│   └── sounds/                   # Sound effect files (future)
├── next.config.ts
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Deployment

- **Platform**: Vercel, auto-deployed from the `main` branch on GitHub.
- **Environment Variables**:
  - `YOUTUBE_API_KEY` — YouTube Data API v3 key.
  - `TWITCH_OAUTH_TOKEN` — Twitch chat OAuth token.
  - `TWITCH_CHANNEL` — Twitch channel name to monitor.
  - `KV_REST_API_URL` — Vercel KV connection URL.
  - `KV_REST_API_TOKEN` — Vercel KV auth token.
- **Domain**: Assigned by Vercel (custom domain optional).
