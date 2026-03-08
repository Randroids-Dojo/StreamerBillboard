import { NextRequest, NextResponse } from "next/server";
import { parseCommand, type ChatMessage } from "@/lib/parser";
import { setState } from "@/lib/store";

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

  if (command.type === "color") {
    const newState = await setState({
      bgcolor: command.value,
      lastUpdatedBy: body.username,
      lastUpdatedAt: body.timestamp ?? new Date().toISOString(),
    });
    return NextResponse.json({ status: "ok", state: newState });
  }

  return NextResponse.json({ status: "ignored" });
}
