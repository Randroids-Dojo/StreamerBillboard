import { Redis } from "@upstash/redis";

export interface BillboardState {
  bgcolor: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const STATE_KEY = "sbb:state";

const DEFAULT_STATE: BillboardState = {
  bgcolor: "#000000",
  lastUpdatedBy: "",
  lastUpdatedAt: "",
};

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export async function getState(): Promise<BillboardState> {
  const redis = getRedis();
  const state = await redis.get<BillboardState>(STATE_KEY);
  return state ?? DEFAULT_STATE;
}

export async function setState(
  update: Partial<BillboardState>
): Promise<BillboardState> {
  const redis = getRedis();
  const current = await getState();
  const next: BillboardState = { ...current, ...update };
  await redis.set(STATE_KEY, next);
  return next;
}
