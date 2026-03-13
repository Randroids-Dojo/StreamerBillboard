import { parseCommand, type ChatMessage } from "@/lib/parser";
import { getState, setState } from "@/lib/store";
import { applyCounter } from "@/lib/commands/counter";
import { applyTicTacToeMove } from "@/lib/commands/tictactoe";

// Serialise a game command payload to store in state
function encodeGameCmd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
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
      const current = await getState();
      await setState({
        gameCmd: encodeGameCmd({ type: "bpk", player: command.player, action: command.action }),
        gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
        ...meta,
      }, current);
      break;
    }
    case "note": {
      const current = await getState();
      await setState({
        gameCmd: encodeGameCmd({ type: "note", note: command.note }),
        gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
        ...meta,
      }, current);
      break;
    }
    case "casa": {
      const current = await getState();
      if (command.subtype === "navigate") {
        await setState({
          activeGame: "casa",
          gameArg: command.username,
          gameCmd: encodeGameCmd({ type: "casa", action: "navigate", username: command.username }),
          gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
          ...meta,
        }, current);
      } else if (command.subtype === "ring") {
        await setState({
          gameCmd: encodeGameCmd({ type: "casa", action: "ringDoorbell" }),
          gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
          ...meta,
        }, current);
      } else if (command.subtype === "water") {
        await setState({
          gameCmd: encodeGameCmd({ type: "casa", action: "waterPlant" }),
          gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
          ...meta,
        }, current);
      } else if (command.subtype === "lights") {
        await setState({
          gameCmd: encodeGameCmd({ type: "casa", action: command.turnOn ? "lightsOn" : "lightsOff" }),
          gameCmdSeq: (current.gameCmdSeq ?? 0) + 1,
          ...meta,
        }, current);
      }
      break;
    }
  }
}
