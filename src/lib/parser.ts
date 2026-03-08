import { parseColor } from "@/lib/commands/color";
import { parseText } from "@/lib/commands/text";

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
const TEXT_PREFIX = "TEXT";

export function parseCommand(message: string): ParsedCommand | null {
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

  // Try color command
  const color = parseColor(body);
  if (color) {
    return { type: "color", value: color };
  }

  return null;
}
