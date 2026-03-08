import { Redis } from "@upstash/redis";
import { type TicTacToeMark } from "@/lib/commands/tictactoe";

export interface BillboardState {
  bgcolor: string;
  text: string;
  textColor: string;
  tttBoard: TicTacToeMark[];
  tttCurrentTurn: "X" | "O";
  tttWinner: "" | "X" | "O" | "draw";
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const STATE_KEY = "sbb:state";

const DEFAULT_STATE: BillboardState = {
  bgcolor: "#000000",
  text: "",
  textColor: "#ffffff",
  tttBoard: ["", "", "", "", "", "", "", "", ""],
  tttCurrentTurn: "X",
  tttWinner: "",
  lastUpdatedBy: "",
  lastUpdatedAt: "",
};

// In-memory fallback for local dev (when KV env vars are not set)
let memoryState: BillboardState = { ...DEFAULT_STATE };

function hasRedis(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export async function getState(): Promise<BillboardState> {
  if (!hasRedis()) {
    return { ...memoryState };
  }
  const redis = getRedis();
  const state = await redis.get<BillboardState>(STATE_KEY);
  return state ? { ...DEFAULT_STATE, ...state } : DEFAULT_STATE;
}

export async function setState(
  update: Partial<BillboardState>
): Promise<BillboardState> {
  const current = await getState();
  const next: BillboardState = { ...current, ...update };

  if (!hasRedis()) {
    memoryState = next;
    return next;
  }

  const redis = getRedis();
  await redis.set(STATE_KEY, next);
  return next;
}
