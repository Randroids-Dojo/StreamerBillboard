import { getTwitchAppToken } from "./twitch-auth";

const HELIX_BASE = "https://api.twitch.tv/helix";

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
}

export interface TwitchStream {
  id: string;
  userId: string;
  userLogin: string;
  userName: string;
  title: string;
  gameName: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
}

async function helixGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("TWITCH_CLIENT_ID is not set");

  const token = await getTwitchAppToken();
  const url = new URL(`${HELIX_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Helix ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** Look up a Twitch user by login name. Returns null if not found. */
export async function getTwitchUser(login: string): Promise<TwitchUser | null> {
  const data = await helixGet<{ data: Array<Record<string, string>> }>(
    "/users",
    { login }
  );
  const u = data.data[0];
  if (!u) return null;
  return {
    id: u.id,
    login: u.login,
    displayName: u.display_name,
    profileImageUrl: u.profile_image_url,
  };
}

/** Get live stream info for a channel. Returns null if the channel is offline. */
export async function getTwitchStream(
  userLogin: string
): Promise<TwitchStream | null> {
  const data = await helixGet<{ data: Array<Record<string, string | number>> }>(
    "/streams",
    { user_login: userLogin }
  );
  const s = data.data[0];
  if (!s) return null;
  return {
    id: s.id as string,
    userId: s.user_id as string,
    userLogin: s.user_login as string,
    userName: s.user_name as string,
    title: s.title as string,
    gameName: s.game_name as string,
    viewerCount: s.viewer_count as number,
    startedAt: s.started_at as string,
    thumbnailUrl: (s.thumbnail_url as string)
      .replace("{width}", "320")
      .replace("{height}", "180"),
  };
}
