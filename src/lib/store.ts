import { type TicTacToeMark } from "@/lib/commands/tictactoe";
import { hasRedis, getRedis } from "@/lib/redis";

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

export const DEFAULT_STATE: BillboardState = {
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
