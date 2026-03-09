import { NextRequest, NextResponse } from "next/server";
import { parseCommand, type ChatMessage } from "@/lib/parser";
import { getState, setState } from "@/lib/store";
import { applyCounter } from "@/lib/commands/counter";
import { applyTicTacToeMove } from "@/lib/commands/tictactoe";

export async function POST(request: NextRequest) {
  let body: ChatMessage;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message || !body.username) {
    return NextResponse.json(
      { error: "Missing required fields: message, username" },
      { status: 400 }
    );
  }

  const command = parseCommand(body.message);
  if (!command) {
    return NextResponse.json({ status: "ignored" });
  }

  const timestamp = body.timestamp ?? new Date().toISOString();
  const meta = { lastUpdatedBy: body.username, lastUpdatedAt: timestamp };

  switch (command.type) {
    case "color": {
      const newState = await setState({ bgcolor: command.value, ...meta });
      return NextResponse.json({ status: "ok", state: newState });
    }
    case "text": {
      const newState = await setState({ text: command.value, ...meta });
      return NextResponse.json({ status: "ok", state: newState });
    }
    case "count": {
      const current = await getState();
      const newState = await setState({
        counter: applyCounter(current.counter, command.action),
        ...meta,
      }, current);
      return NextResponse.json({ status: "ok", state: newState });
    }
    case "ttt": {
      const current = await getState();
      const tttState = {
        board: current.tttBoard,
        currentTurn: current.tttCurrentTurn,
        winner: current.tttWinner,
      };
      const result = applyTicTacToeMove(tttState, command.move);
      if (!result) {
        return NextResponse.json({ status: "invalid_move" });
      }
      const newState = await setState({
        tttBoard: result.board,
        tttCurrentTurn: result.currentTurn,
        tttWinner: result.winner,
        ...meta,
      }, current);
      return NextResponse.json({ status: "ok", state: newState });
    }
  }

  return NextResponse.json({ status: "ignored" });
}
