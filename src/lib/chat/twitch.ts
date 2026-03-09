import tmi from "tmi.js";
import type { ChatMessage } from "@/lib/parser";

export interface TwitchClientOptions {
  channel: string;
  onMessages: (messages: ChatMessage[]) => void;
  onError?: (error: Error) => void;
}

export class TwitchChatClient {
  private client: tmi.Client;
  private onMessages: (messages: ChatMessage[]) => void;
  private onError: (error: Error) => void;
  private connected = false;

  constructor(options: TwitchClientOptions) {
    this.onMessages = options.onMessages;
    this.onError = options.onError ?? (() => {});

    // Anonymous read-only connection — no OAuth token required.
    // Twitch officially supports this via the "justinfan" username scheme.
    this.client = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      channels: [options.channel],
    });

    this.client.on(
      "message",
      (_channel: string, tags: tmi.ChatUserstate, message: string) => {
        const chatMsg: ChatMessage = {
          platform: "twitch",
          username: tags["display-name"] ?? tags.username ?? "anonymous",
          message,
          timestamp: new Date().toISOString(),
        };
        this.onMessages([chatMsg]);
      }
    );

    this.client.on("disconnected", () => {
      this.connected = false;
    });
  }

  async start(): Promise<void> {
    if (this.connected) return;
    try {
      await this.client.connect();
      this.connected = true;
    } catch (err) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async stop(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.disconnect();
    } catch {
      // ignore disconnect errors
    }
    this.connected = false;
  }

  isRunning(): boolean {
    return this.connected;
  }
}
