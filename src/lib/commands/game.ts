export const GAME_NAMES = new Set([
  "bpk", "piano", "casa", "epoch", "gopit", "godig", "block", "determined",
]);

export const GAME_URLS: Record<string, string> = {
  bpk:        "https://block-punch-kick.vercel.app",
  piano:      "https://baby-piano-eight.vercel.app",
  casa:       "https://mi-casa-es-su-casa.vercel.app",
  epoch:      "https://epoch-theta.vercel.app",
  gopit:      "https://go-pit.vercel.app",
  godig:      "https://go-dig.vercel.app",
  block:      "https://block-you.vercel.app",
  determined: "https://determined-khaki.vercel.app",
};

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

export type CasaCommand =
  | { subtype: "navigate"; username: string }
  | { subtype: "ring" }
  | { subtype: "water" }
  | { subtype: "lights"; turnOn: boolean };

// Reserved words that cannot be usernames
const CASA_RESERVED = new Set(["ring", "water", "lights"]);

/**
 * SBB casa <username>        — navigate to a viewer's house
 * SBB casa ring              — ring the doorbell
 * SBB casa water             — water the plant
 * SBB casa lights on/off     — toggle the lights
 */
export function parseCasa(input: string): CasaCommand | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed === "ring")  return { subtype: "ring" };
  if (trimmed === "water") return { subtype: "water" };
  if (trimmed === "lights on"  || trimmed === "lights 1") return { subtype: "lights", turnOn: true };
  if (trimmed === "lights off" || trimmed === "lights 0") return { subtype: "lights", turnOn: false };

  // Navigate: must be a valid username and not a reserved word
  if (CASA_RESERVED.has(trimmed)) return null;
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return null;
  return { subtype: "navigate", username: trimmed };
}
