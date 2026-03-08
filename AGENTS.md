# StreamerBillboard — Agent Guidelines

## Project Overview

Streamer Billboard (SBB) — a live-streamer's interactive backdrop. Viewers type `SBB` commands in YouTube/Twitch chat to control what appears on a Samsung Odyssey G9 (5120x1440, 32:9) behind the streamer.

## Tech Stack

- **Frontend**: Next.js (React 19) with Tailwind CSS v4
- **Backend**: Next.js API routes on Vercel
- **State**: Vercel KV (Upstash Redis) — falls back to in-memory for local dev
- **Chat**: YouTube Live Chat API (polling), Twitch IRC (WebSocket via TMI.js)
- **Language**: TypeScript (strict mode)

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm test         # Run tests (when added)
```

## Architecture

```
src/
  app/
    page.tsx                  # Landing page
    billboard/page.tsx        # Full-screen display (runs on the monitor)
    api/ingest/route.ts       # POST — receives chat messages, parses commands
    api/state/route.ts        # GET — returns current billboard state
    api/state/stream/route.ts # GET — SSE endpoint for real-time updates
    api/chat/route.ts         # GET/POST — start/stop chat listeners, view status
  components/
    Billboard.tsx             # Billboard renderer (client component)
  lib/
    parser.ts                 # Command parser pipeline (SBB prefix → handler)
    store.ts                  # Vercel KV state read/write
    commands/
      color.ts                # Color command handler (MVP)
      text.ts                 # Text display command handler
    chat/
      youtube.ts              # YouTube Live Chat API poller
      twitch.ts               # Twitch IRC client (via tmi.js)
      manager.ts              # Singleton chat manager — coordinates connections
```

## Conventions

- All chat commands are prefixed with `SBB` (case-insensitive).
- Command handlers are registered in `parser.ts`. Add new commands by creating a handler in `lib/commands/` and wiring it into `parseCommand()`.
- The Billboard component uses SSE with polling fallback.
- Keep the display app lightweight — it runs full-screen in Chrome kiosk mode.
- Use Tailwind for styling. No CSS modules.
- Prefer simple, flat file structure within each directory.

## Key Design Decisions

- **State shape** is flat JSON stored in a single Redis key (`sbb:state`).
- **Color validation** accepts CSS named colors, hex (`#RGB`/`#RRGGBB`), and `rgb()`. Invalid input is silently ignored.
- **Text display** renders large text on the billboard via `SBB text <message>`. Max 200 chars, HTML tags stripped.
- **SSE stream** has a 5-minute max lifetime and polls KV every 1s server-side.
- The ingest API is platform-agnostic — it accepts a `ChatMessage` JSON body regardless of source (YouTube, Twitch, or manual test).
- **Chat ingestion** uses a singleton `ChatManager` in `lib/chat/manager.ts`. Start/stop listeners via `POST /api/chat` with `{ action, platform, videoId?, channel? }`. YouTube polls the Live Chat API; Twitch connects via tmi.js WebSocket. Both feed messages through the same command pipeline as the ingest API.
- **Environment variables** for chat: `YOUTUBE_API_KEY`, `TWITCH_OAUTH_TOKEN` (optional — anonymous read if omitted), `TWITCH_BOT_USERNAME` (optional).
