import { parseColor } from "@/lib/commands/color";
import { parseText } from "@/lib/commands/text";
import { parseTicTacToe, type TicTacToeMove } from "@/lib/commands/tictactoe";

export interface ChatMessage {
  platform: "youtube" | "twitch";
  username: string;
  message: string;
  timestamp: string;
}

export interface ParsedCommand {
  type: string;
  value: string;
}

export interface ParsedTTTCommand {
  type: "ttt";
  move: TicTacToeMove;
}

export type AnyParsedCommand = ParsedCommand | ParsedTTTCommand;

const PREFIX = "SBB";
const TEXT_PREFIX = "TEXT";
const TTT_PREFIX = "TTT";

export function parseCommand(message: string): AnyParsedCommand | null {
  const trimmed = message.trim();

  // Check for SBB prefix (case-insensitive)
  if (!trimmed.toUpperCase().startsWith(PREFIX)) {
    return null;
  }

  const body = trimmed.slice(PREFIX.length).trim();
  if (!body) return null;

  // Try text command (SBB text Hello World!)
  if (body.toUpperCase().startsWith(TEXT_PREFIX)) {
    const textBody = body.slice(TEXT_PREFIX.length).trim();
    const text = parseText(textBody);
    if (text) {
      return { type: "text", value: text };
    }
    return null;
  }

  // Try tic-tac-toe command (SBB ttt 5 / SBB ttt reset)
  if (body.toUpperCase().startsWith(TTT_PREFIX)) {
    const tttBody = body.slice(TTT_PREFIX.length).trim();
    const move = parseTicTacToe(tttBody);
    if (move) {
      return { type: "ttt", move };
    }
    return null;
  }

  // Try color command
  const color = parseColor(body);
  if (color) {
    return { type: "color", value: color };
  }

  return null;
}
