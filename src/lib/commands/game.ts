export const GAME_NAMES = new Set([
  "bpk", "piano", "casa", "epoch", "gopit", "godig", "block", "determined",
]);

const BPK_ACTIONS = new Set(["punch", "kick", "block", "left", "right", "jump"]);

/** SBB game <name> [arg]  or  SBB game off */
export function parseGameLaunch(
  input: string
): { game: string; arg: string } | null {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return null;
  const game = parts[0].toLowerCase();
  if (game !== "off" && !GAME_NAMES.has(game)) return null;
  const arg = parts.slice(1).join(" ").toLowerCase();
  return { game, arg };
}

export interface BPKCommand {
  player: 1 | 2;
  action: string;
}

/** SBB bpk p1 punch  /  SBB bpk 2 kick */
export function parseBPK(input: string): BPKCommand | null {
  const parts = input.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const playerStr = parts[0];
  const action = parts[1];
  if (!BPK_ACTIONS.has(action)) return null;
  const player =
    playerStr === "p1" || playerStr === "1" ? 1
    : playerStr === "p2" || playerStr === "2" ? 2
    : null;
  if (!player) return null;
  return { player, action };
}

/** SBB note C4  /  SBB note D#  /  SBB piano G3 */
export function parseNote(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;
  const match = trimmed.match(/^([A-G])([#B]?)(\d?)$/);
  if (!match) return null;
  const note = match[1];
  const accidental = match[2] === "B" ? "b" : match[2]; // normalise flat
  const octave = match[3] || "4";
  return `${note}${accidental}${octave}`;
}

/** SBB casa <username> */
export function parseCasa(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}
