import { parseCommand, type ChatMessage, type ParsedTTTCommand } from "@/lib/parser";
import { getState, setState } from "@/lib/store";
import { applyTicTacToeMove } from "@/lib/commands/tictactoe";
import { YouTubeChatPoller, getLiveChatId } from "./youtube";
import { TwitchChatClient } from "./twitch";
import { getTwitchUser, getTwitchStream, type TwitchStream } from "./twitch-helix";

export interface TwitchStatus {
  connected: boolean;
  channel?: string;
  stream?: TwitchStream | null;
}

/** Singleton chat manager — coordinates YouTube and Twitch listeners. */
class ChatManager {
  private youtubePoller: YouTubeChatPoller | null = null;
  private twitchClient: TwitchChatClient | null = null;
  private twitchChannel: string | null = null;

  /** Process an array of chat messages through the command pipeline. */
  private async handleMessages(messages: ChatMessage[]): Promise<void> {
    for (const msg of messages) {
      const command = parseCommand(msg.message);
      if (!command) continue;

      const timestamp = msg.timestamp || new Date().toISOString();

      if (command.type === "color" && "value" in command) {
        await setState({
          bgcolor: command.value,
          lastUpdatedBy: msg.username,
          lastUpdatedAt: timestamp,
        });
      } else if (command.type === "text" && "value" in command) {
        await setState({
          text: command.value,
          lastUpdatedBy: msg.username,
          lastUpdatedAt: timestamp,
        });
      } else if (command.type === "ttt") {
        const tttCommand = command as ParsedTTTCommand;
        const current = await getState();
        const tttState = {
          board: current.tttBoard,
          currentTurn: current.tttCurrentTurn,
          winner: current.tttWinner,
        };
        const result = applyTicTacToeMove(tttState, tttCommand.move);
        if (result) {
          await setState({
            tttBoard: result.board,
            tttCurrentTurn: result.currentTurn,
            tttWinner: result.winner,
            lastUpdatedBy: msg.username,
            lastUpdatedAt: timestamp,
          });
        }
      }
    }
  }

  private logError(source: string, error: Error): void {
    console.error(`[SBB ${source}]`, error.message);
  }

  async startYouTube(videoId: string): Promise<void> {
    if (this.youtubePoller?.isRunning()) {
      this.youtubePoller.stop();
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY env var is not set");

    const liveChatId = await getLiveChatId(videoId, apiKey);

    this.youtubePoller = new YouTubeChatPoller({
      apiKey,
      liveChatId,
      onMessages: (msgs) => this.handleMessages(msgs),
      onError: (err) => this.logError("YouTube", err),
    });
    this.youtubePoller.start();
  }

  stopYouTube(): void {
    this.youtubePoller?.stop();
    this.youtubePoller = null;
  }

  async startTwitch(channel: string): Promise<void> {
    if (this.twitchClient?.isRunning()) {
      await this.twitchClient.stop();
    }

    // Validate channel exists via Helix API if credentials are available.
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      const user = await getTwitchUser(channel);
      if (!user) throw new Error(`Twitch channel "${channel}" not found`);
    }

    this.twitchChannel = channel;
    this.twitchClient = new TwitchChatClient({
      channel,
      onMessages: (msgs) => this.handleMessages(msgs),
      onError: (err) => this.logError("Twitch", err),
    });
    await this.twitchClient.start();
  }

  async stopTwitch(): Promise<void> {
    await this.twitchClient?.stop();
    this.twitchClient = null;
    this.twitchChannel = null;
  }

  async twitchStatus(): Promise<TwitchStatus> {
    const connected = this.twitchClient?.isRunning() ?? false;
    if (!connected || !this.twitchChannel) return { connected };

    let stream: TwitchStream | null = null;
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      try {
        stream = await getTwitchStream(this.twitchChannel);
      } catch {
        // Non-fatal — return connected status without stream info
      }
    }

    return { connected, channel: this.twitchChannel, stream };
  }

  status(): { youtube: boolean; twitch: boolean } {
    return {
      youtube: this.youtubePoller?.isRunning() ?? false,
      twitch: this.twitchClient?.isRunning() ?? false,
    };
  }

  async stopAll(): Promise<void> {
    this.stopYouTube();
    await this.stopTwitch();
  }
}

/** Module-level singleton so the manager survives across API calls. */
export const chatManager = new ChatManager();
