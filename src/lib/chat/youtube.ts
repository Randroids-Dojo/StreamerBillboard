import type { ChatMessage } from "@/lib/parser";

interface YouTubeChatMessageItem {
  snippet: {
    displayMessage: string;
    authorChannelId: string;
    publishedAt: string;
  };
  authorDetails: {
    displayName: string;
  };
}

interface YouTubeLiveChatResponse {
  items: YouTubeChatMessageItem[];
  nextPageToken: string;
  pollingIntervalMillis: number;
}

export interface YouTubePollerOptions {
  apiKey: string;
  liveChatId: string;
  onMessages: (messages: ChatMessage[]) => void;
  onError?: (error: Error) => void;
}

export class YouTubeChatPoller {
  private apiKey: string;
  private liveChatId: string;
  private onMessages: (messages: ChatMessage[]) => void;
  private onError: (error: Error) => void;
  private pageToken: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(options: YouTubePollerOptions) {
    this.apiKey = options.apiKey;
    this.liveChatId = options.liveChatId;
    this.onMessages = options.onMessages;
    this.onError = options.onError ?? (() => {});
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    let pollingInterval = 5000; // default 5s

    try {
      const url = new URL(
        "https://www.googleapis.com/youtube/v3/liveChat/messages"
      );
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "snippet,authorDetails");
      url.searchParams.set("key", this.apiKey);
      if (this.pageToken) {
        url.searchParams.set("pageToken", this.pageToken);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
      }

      const data: YouTubeLiveChatResponse = await res.json();
      this.pageToken = data.nextPageToken;
      pollingInterval = data.pollingIntervalMillis || 5000;

      if (data.items.length > 0) {
        const messages: ChatMessage[] = data.items.map((item) => ({
          platform: "youtube" as const,
          username: item.authorDetails.displayName,
          message: item.snippet.displayMessage,
          timestamp: item.snippet.publishedAt,
        }));
        this.onMessages(messages);
      }
    } catch (err) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }

    if (this.running) {
      this.timer = setTimeout(() => this.poll(), pollingInterval);
    }
  }
}

/**
 * Fetches the liveChatId for a given YouTube video ID.
 */
export async function getLiveChatId(
  videoId: string,
  apiKey: string
): Promise<string> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "liveStreamingDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const chatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!chatId) {
    throw new Error(
      `No active live chat found for video ${videoId}. Is the stream live?`
    );
  }
  return chatId;
}

/**
 * Finds the active liveChatId for a YouTube channel, if currently live.
 * Returns null if the channel is not live or has no active chat.
 */
export async function findActiveLiveChatId(
  channelId: string,
  apiKey: string
): Promise<string | null> {
  // Step 1: find the live video ID for this channel
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("eventType", "live");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json() as { items?: Array<{ id: { videoId: string } }> };
  const videoId = searchData.items?.[0]?.id?.videoId;
  if (!videoId) return null;

  // Step 2: get the liveChatId from the video details
  try {
    return await getLiveChatId(videoId, apiKey);
  } catch {
    return null;
  }
}
