import { parseColor } from "@/lib/commands/color";

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

const PREFIX = "SBB";

export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();

  // Check for SBB prefix (case-insensitive)
  if (!trimmed.toUpperCase().startsWith(PREFIX)) {
    return null;
  }

  const body = trimmed.slice(PREFIX.length).trim();
  if (!body) return null;

  // Try color command
  const color = parseColor(body);
  if (color) {
    return { type: "color", value: color };
  }

  return null;
}
