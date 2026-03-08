"use client";

import { useEffect, useState } from "react";

interface BillboardState {
  bgcolor: string;
  text: string;
  textColor: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

const DEFAULT_STATE: BillboardState = {
  bgcolor: "#000000",
  text: "",
  textColor: "#ffffff",
  lastUpdatedBy: "",
  lastUpdatedAt: "",
};

export function Billboard() {
  const [state, setState] = useState<BillboardState>(DEFAULT_STATE);
  const [showOverlay, setShowOverlay] = useState(true);

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

  return (
    <div
      className="fixed inset-0 transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: state.bgcolor }}
      onClick={() => setShowOverlay((prev) => !prev)}
    >
      {state.text && (
        <div className="flex items-center justify-center w-full h-full">
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
        </div>
      )}
      {showOverlay && state.lastUpdatedBy && (
        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg text-sm font-mono backdrop-blur-sm">
          <div>{state.text || state.bgcolor}</div>
          <div className="text-gray-300">by {state.lastUpdatedBy}</div>
        </div>
      )}
    </div>
  );
}
