"use client";

import { useEffect, useRef, useState } from "react";
import type { TicTacToeMark } from "@/lib/commands/tictactoe";
import { DEFAULT_STATE, type BillboardState } from "@/lib/store";
import { GAME_URLS } from "@/lib/commands/game";

function getGameUrl(game: string, arg: string): string {
  const base = GAME_URLS[game];
  if (!base) return "";
  if (game === "casa" && arg) return `${base}/${encodeURIComponent(arg)}`;
  return base;
}

function isTTTActive(state: BillboardState): boolean {
  return state.tttBoard.some((cell) => cell !== "") || state.tttWinner !== "";
}

function TicTacToeBoard({
  board,
  currentTurn,
  winner,
}: {
  board: TicTacToeMark[];
  currentTurn: "X" | "O";
  winner: "" | "X" | "O" | "draw";
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="grid grid-cols-3 gap-2"
        style={{ width: "min(80vh, 50vw)", height: "min(80vh, 50vw)" }}
      >
        {board.map((cell, i) => (
          <div
            key={i}
            className="flex items-center justify-center bg-white/10 border-2 border-white/30 rounded-lg"
            style={{ fontSize: "min(20vh, 12vw)" }}
          >
            <span
              className={`font-bold ${
                cell === "X" ? "text-cyan-400" : cell === "O" ? "text-pink-400" : ""
              }`}
            >
              {cell}
            </span>
          </div>
        ))}
      </div>
      <div className="text-white text-2xl font-bold font-mono">
        {winner === "draw"
          ? "Draw!"
          : winner
            ? `${winner} wins!`
            : `Turn: ${currentTurn}`}
      </div>
    </div>
  );
}

export function Billboard() {
  const [state, setState] = useState<BillboardState>(DEFAULT_STATE);
  const [showOverlay, setShowOverlay] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastCmdSeq = useRef(0);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      eventSource = new EventSource("/api/state/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as BillboardState;
          setState({ ...DEFAULT_STATE, ...data });
        } catch {
          // ignore malformed messages
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        // Fall back to polling
        startPolling();
      };
    }

    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/state");
          if (res.ok) {
            const data = (await res.json()) as BillboardState;
            setState({ ...DEFAULT_STATE, ...data });
          }
        } catch {
          // retry next interval
        }
      }, 1500);
    }

    connectSSE();

    return () => {
      eventSource?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Forward game commands to the iframe via postMessage
  useEffect(() => {
    if (!state.gameCmd || state.gameCmdSeq === lastCmdSeq.current) return;
    lastCmdSeq.current = state.gameCmdSeq;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ source: "sbb", ...JSON.parse(state.gameCmd) }, "*");
    } catch { /* malformed gameCmd */ }
  }, [state.gameCmdSeq, state.gameCmd]);

  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win || !state.activeGame) return;
    win.postMessage({ source: "sbb", type: "init", game: state.activeGame }, "*");
    // Re-post the latest command in case it arrived before the iframe mounted
    if (state.gameCmd) {
      try {
        win.postMessage({ source: "sbb", ...JSON.parse(state.gameCmd) }, "*");
      } catch { /* malformed gameCmd */ }
    }
  }

  const tttActive = isTTTActive(state);
  const gameUrl = state.activeGame ? getGameUrl(state.activeGame, state.gameArg) : "";

  return (
    <div
      className="fixed inset-0 transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: state.bgcolor }}
      onClick={() => setShowOverlay((prev) => !prev)}
    >
      {/* Game mode — full-screen iframe, covers all other billboard content */}
      {gameUrl && (
        <iframe
          ref={iframeRef}
          key={gameUrl}
          src={gameUrl}
          onLoad={handleIframeLoad}
          style={{
            position: "fixed", inset: 0,
            width: "100%", height: "100%",
            border: "none", zIndex: 10,
          }}
          allow="autoplay; fullscreen"
        />
      )}

      {!gameUrl && tttActive ? (
        <div className="flex items-center justify-center w-full h-full">
          <TicTacToeBoard
            board={state.tttBoard}
            currentTurn={state.tttCurrentTurn}
            winner={state.tttWinner}
          />
        </div>
      ) : !gameUrl && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-8">
          {state.counter !== 0 && (
            <span
              className="font-mono font-bold text-white tabular-nums transition-all duration-300"
              style={{ fontSize: "clamp(4rem, 20vw, 24rem)" }}
            >
              {state.counter}
            </span>
          )}
          {state.text && (
            <p
              className="text-center font-bold px-8 transition-opacity duration-500"
              style={{
                color: state.textColor,
                fontSize: "clamp(2rem, 8vw, 10rem)",
                wordBreak: "break-word",
              }}
            >
              {state.text}
            </p>
          )}
        </div>
      )}
      {showOverlay && state.lastUpdatedBy && (
        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg text-sm font-mono backdrop-blur-sm" style={{ zIndex: 20 }}>
          <div>
            {gameUrl
              ? `Game: ${state.activeGame}${state.gameArg ? ` (${state.gameArg})` : ""}`
              : tttActive
                ? `TTT: ${state.tttWinner === "draw" ? "Draw" : state.tttWinner ? `${state.tttWinner} wins` : `${state.tttCurrentTurn}'s turn`}`
                : [
                    state.counter !== 0 && `Counter: ${state.counter}`,
                    state.text && `Text: "${state.text}"`,
                    !state.counter && !state.text && state.bgcolor,
                  ].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-300">by {state.lastUpdatedBy}</div>
        </div>
      )}
    </div>
  );
}
