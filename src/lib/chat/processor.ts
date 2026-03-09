import { parseCommand, type ChatMessage } from "@/lib/parser";
import { getState, setState } from "@/lib/store";
import { applyCounter } from "@/lib/commands/counter";
import { applyTicTacToeMove } from "@/lib/commands/tictactoe";

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
  }
}
