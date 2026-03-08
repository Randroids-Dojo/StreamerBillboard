import { NextRequest, NextResponse } from "next/server";
import { parseCommand, type ChatMessage, type ParsedTTTCommand, type ParsedCounterCommand } from "@/lib/parser";
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

  if (command.type === "color" && "value" in command) {
    const newState = await setState({
      bgcolor: command.value,
      lastUpdatedBy: body.username,
      lastUpdatedAt: timestamp,
    });
    return NextResponse.json({ status: "ok", state: newState });
  }

  if (command.type === "text" && "value" in command) {
    const newState = await setState({
      text: command.value,
      lastUpdatedBy: body.username,
      lastUpdatedAt: timestamp,
    });
    return NextResponse.json({ status: "ok", state: newState });
  }

  if (command.type === "count") {
    const countCommand = command as ParsedCounterCommand;
    const current = await getState();
    const newCounter = applyCounter(current.counter, countCommand.action);
    const newState = await setState({
      counter: newCounter,
      lastUpdatedBy: body.username,
      lastUpdatedAt: timestamp,
    });
    return NextResponse.json({ status: "ok", state: newState });
  }

  if (command.type === "ttt") {
    const tttCommand = command as ParsedTTTCommand;
    const current = await getState();
    const tttState = {
      board: current.tttBoard,
      currentTurn: current.tttCurrentTurn,
      winner: current.tttWinner,
    };
    const result = applyTicTacToeMove(tttState, tttCommand.move);
    if (!result) {
      return NextResponse.json({ status: "invalid_move" });
    }
    const newState = await setState({
      tttBoard: result.board,
      tttCurrentTurn: result.currentTurn,
      tttWinner: result.winner,
      lastUpdatedBy: body.username,
      lastUpdatedAt: timestamp,
    });
    return NextResponse.json({ status: "ok", state: newState });
  }

  return NextResponse.json({ status: "ignored" });
}
