import { parseColor } from "@/lib/commands/color";
import { parseCounter, type CounterAction } from "@/lib/commands/counter";
import { parseText } from "@/lib/commands/text";
import { parseTicTacToe, type TicTacToeMove } from "@/lib/commands/tictactoe";
import { parseGameLaunch, parseBPK, parseNote, parseCasa, type BPKCommand, type CasaCommand } from "@/lib/commands/game";

export interface ChatMessage {
  platform: "youtube" | "twitch";
  username: string;
  message: string;
  timestamp: string;
}

export interface ParsedColorCommand   { type: "color";  value: string }
export interface ParsedTextCommand    { type: "text";   value: string }
export interface ParsedTTTCommand     { type: "ttt";    move: TicTacToeMove }
export interface ParsedCounterCommand { type: "count";  action: CounterAction }
export interface ParsedGameCommand    { type: "game";   game: string; arg: string }
export interface ParsedBPKCommand     { type: "bpk";    player: BPKCommand["player"]; action: string }
export interface ParsedNoteCommand    { type: "note";   note: string }
export type ParsedCasaCommand = { type: "casa" } & CasaCommand

export type AnyParsedCommand =
  | ParsedColorCommand
  | ParsedTextCommand
  | ParsedTTTCommand
  | ParsedCounterCommand
  | ParsedGameCommand
  | ParsedBPKCommand
  | ParsedNoteCommand
  | ParsedCasaCommand;

const PREFIX       = "SBB";
const TEXT_PREFIX  = "TEXT";
const TTT_PREFIX   = "TTT";
const COUNT_PREFIX = "COUNT";
const GAME_PREFIX  = "GAME";
const BPK_PREFIX   = "BPK";
const NOTE_PREFIX  = "NOTE";
const PIANO_PREFIX = "PIANO";  // alias for NOTE
const CASA_PREFIX  = "CASA";

export function parseCommand(message: string): AnyParsedCommand | null {
  const trimmed = message.trim();

  if (!trimmed.toUpperCase().startsWith(PREFIX)) return null;

  const body = trimmed.slice(PREFIX.length).trim();
  if (!body) return null;
  const bodyUp = body.toUpperCase();

  // SBB game <name> [arg]  |  SBB game off
  if (bodyUp.startsWith(GAME_PREFIX)) {
    const result = parseGameLaunch(body.slice(GAME_PREFIX.length).trim());
    if (result) return { type: "game", game: result.game, arg: result.arg };
    return null;
  }

  // SBB bpk p1 punch  |  SBB bpk 2 kick
  if (bodyUp.startsWith(BPK_PREFIX)) {
    const result = parseBPK(body.slice(BPK_PREFIX.length).trim());
    if (result) return { type: "bpk", player: result.player, action: result.action };
    return null;
  }

  // SBB note C4  |  SBB piano D#3
  if (bodyUp.startsWith(NOTE_PREFIX) || bodyUp.startsWith(PIANO_PREFIX)) {
    const offset = bodyUp.startsWith(PIANO_PREFIX) ? PIANO_PREFIX.length : NOTE_PREFIX.length;
    const note = parseNote(body.slice(offset).trim());
    if (note) return { type: "note", note };
    return null;
  }

  // SBB casa <username|ring|water|lights on|lights off>
  if (bodyUp.startsWith(CASA_PREFIX)) {
    const result = parseCasa(body.slice(CASA_PREFIX.length).trim());
    if (result) return { type: "casa", ...result };
    return null;
  }

  // SBB text <message>
  if (bodyUp.startsWith(TEXT_PREFIX)) {
    const text = parseText(body.slice(TEXT_PREFIX.length).trim());
    if (text) return { type: "text", value: text };
    return null;
  }

  // SBB count up / down / reset
  if (bodyUp.startsWith(COUNT_PREFIX)) {
    const action = parseCounter(body.slice(COUNT_PREFIX.length).trim());
    if (action) return { type: "count", action };
    return null;
  }

  // SBB ttt <move>
  if (bodyUp.startsWith(TTT_PREFIX)) {
    const move = parseTicTacToe(body.slice(TTT_PREFIX.length).trim());
    if (move) return { type: "ttt", move };
    return null;
  }

  // SBB <color>
  const color = parseColor(body);
  if (color) return { type: "color", value: color };

  return null;
}
