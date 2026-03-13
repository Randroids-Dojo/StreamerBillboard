import { Redis } from "@upstash/redis";
import { type TicTacToeMark } from "@/lib/commands/tictactoe";

export interface BillboardState {
  bgcolor: string;
  text: string;
  textColor: string;
  tttBoard: TicTacToeMark[];
  tttCurrentTurn: "X" | "O";
  tttWinner: "" | "X" | "O" | "draw";
  counter: number;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  // Game mode
  activeGame: string;   // "" = none, "bpk" | "piano" | "casa" | "epoch" | ...
  gameArg: string;      // game-specific argument (e.g. casa username)
  gameCmd: string;      // JSON-serialised latest game command
  gameCmdSeq: number;   // increments on every new gameCmd
}

const STATE_KEY = "sbb:state";

const DEFAULT_STATE: BillboardState = {
  bgcolor: "#000000",
  text: "",
  textColor: "#ffffff",
  tttBoard: ["", "", "", "", "", "", "", "", ""],
  tttCurrentTurn: "X",
  tttWinner: "",
  counter: 0,
  lastUpdatedBy: "",
  lastUpdatedAt: "",
  activeGame: "",
  gameArg: "",
  gameCmd: "",
  gameCmdSeq: 0,
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
  update: Partial<BillboardState>,
  current?: BillboardState
): Promise<BillboardState> {
  const base = current ?? (await getState());
  const next: BillboardState = { ...base, ...update };

  if (!hasRedis()) {
    memoryState = next;
    return next;
  }

  const redis = getRedis();
  await redis.set(STATE_KEY, next);
  return next;
}
