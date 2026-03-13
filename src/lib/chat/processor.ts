import { parseCommand, type ChatMessage } from "@/lib/parser";
import { getState, setState } from "@/lib/store";
import { applyCounter } from "@/lib/commands/counter";
import { applyTicTacToeMove } from "@/lib/commands/tictactoe";

/** Increment gameCmdSeq and store a new game command payload. */
async function sendGameCmd(
  payload: Record<string, unknown>,
  meta: Record<string, string>,
  extra?: Partial<{ activeGame: string; gameArg: string }>,
): Promise<void> {
  const current = await getState();
  await setState({
    gameCmd: JSON.stringify(payload),
    gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
    ...extra,
    ...meta,
  }, current);
}

/**
 * Process a single chat message through the command pipeline.
 * Shared between the ingest API route and the cron/eventsub handlers.
 */
export async function processChatMessage(msg: ChatMessage): Promise<void> {
  const command = parseCommand(msg.message);
  if (!command) return;

  const timestamp = msg.timestamp || new Date().toISOString();
  const meta = { lastUpdatedBy: msg.username, lastUpdatedAt: timestamp };

  switch (command.type) {
    case "color": {
      await setState({ bgcolor: command.value, ...meta });
      break;
    }
    case "text": {
      await setState({ text: command.value, ...meta });
      break;
    }
    case "count": {
      const current = await getState();
      await setState(
        { counter: applyCounter(current.counter, command.action), ...meta },
        current
      );
      break;
    }
    case "ttt": {
      const current = await getState();
      const tttState = {
        board: current.tttBoard,
        currentTurn: current.tttCurrentTurn,
        winner: current.tttWinner,
      };
      const result = applyTicTacToeMove(tttState, command.move);
      if (result) {
        await setState(
          {
            tttBoard: result.board,
            tttCurrentTurn: result.currentTurn,
            tttWinner: result.winner,
            ...meta,
          },
          current
        );
      }
      break;
    }
    case "game": {
      if (command.game === "off") {
        await setState({ activeGame: "", gameArg: "", gameCmd: "", ...meta });
      } else {
        await setState({ activeGame: command.game, gameArg: command.arg, gameCmd: "", ...meta });
      }
      break;
    }
    case "bpk": {
      await sendGameCmd({ type: "bpk", player: command.player, action: command.action }, meta);
      break;
    }
    case "note": {
      await sendGameCmd({ type: "note", note: command.note }, meta);
      break;
    }
    case "casa": {
      if (command.subtype === "navigate") {
        await sendGameCmd(
          { type: "casa", action: "navigate", username: command.username },
          meta,
          { activeGame: "casa", gameArg: command.username },
        );
      } else if (command.subtype === "ring") {
        await sendGameCmd({ type: "casa", action: "ringDoorbell" }, meta);
      } else if (command.subtype === "water") {
        await sendGameCmd({ type: "casa", action: "waterPlant" }, meta);
      } else if (command.subtype === "lights") {
        await sendGameCmd({ type: "casa", action: command.turnOn ? "lightsOn" : "lightsOff" }, meta);
      }
      break;
    }
  }
}
