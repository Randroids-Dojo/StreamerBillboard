"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TwitchStream {
  title: string;
  gameName: string;
  viewerCount: number;
  startedAt: string;
}

interface DashboardStatus {
  youtube: {
    active: boolean;
    disabled: boolean;
    liveChatId: string | null;
    autoDetect: boolean;
  };
  twitch: {
    active: boolean;
    authorized: boolean;
    channel: string | null;
    subscriptionId: string | null;
    stream: TwitchStream | null;
  };
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

function StatusDot({ active, pulse }: { active: boolean; pulse?: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      backgroundColor: active ? "#22D45F" : "#2e2e2e",
      boxShadow: active ? "0 0 6px #22D45F88" : "none",
      animation: active && pulse ? "pulse-green 2s ease-in-out infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid #161616" }}>
      <span style={{ color: "#404040", minWidth: 120, fontSize: 11, letterSpacing: "0.15em", paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ color: "#B0B0B0", fontSize: 12, letterSpacing: "0.05em", wordBreak: "break-all" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function truncate(str: string | null, len = 24): string {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twitchChannel, setTwitchChannel] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/status");
      if (res.status === 401) { router.push("/dashboard/login"); return; }
      if (!res.ok) return;
      const data = await res.json() as DashboardStatus;
      setStatus(data);
      setLastRefresh(Date.now());
    } catch { /* retry */ }
  }, [router]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function control(action: string, platform: string, channel?: string) {
    const key = `${platform}-${action}`;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, platform, channel }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Action failed"); }
      else { await fetchStatus(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/dashboard/login");
  }

  const secondsAgo = lastRefresh ? Math.floor((Date.now() - lastRefresh) / 1000) : null;

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#070707",
      fontFamily: "var(--font-mono), monospace",
      color: "#F0F0F0",
    }}>
      <style>{`
        @keyframes pulse-green { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes pulse-amber { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        .ctrl-btn { cursor:pointer; border:none; transition:all 0.15s; font-family:var(--font-mono),monospace; letter-spacing:0.1em; font-size:11px; padding:8px 20px; }
        .ctrl-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .ctrl-btn-stop { background:#1a0a0a; color:#EF4444; border:1px solid #3a1010; }
        .ctrl-btn-stop:hover:not(:disabled) { background:#2a1010; border-color:#EF4444; }
        .ctrl-btn-start { background:#0a1a0f; color:#22D45F; border:1px solid #103a20; }
        .ctrl-btn-start:hover:not(:disabled) { background:#102a18; border-color:#22D45F; }
        .ctrl-btn-amber { background:#1a0f05; color:#E07B39; border:1px solid #3a2010; }
        .ctrl-btn-amber:hover:not(:disabled) { background:#2a1808; border-color:#E07B39; }
        .ctrl-btn-muted { background:#111; color:#606060; border:1px solid #222; }
        .ctrl-btn-muted:hover:not(:disabled) { background:#181818; }
        .channel-input { background:#0f0f0f; border:1px solid #2a2a2a; color:#F0F0F0; padding:8px 12px; font-family:var(--font-mono),monospace; font-size:12px; letter-spacing:0.05em; outline:none; width:160px; }
        .channel-input:focus { border-color:#E07B39; }
        .channel-input::placeholder { color:#303030; }
        .card { background:#0c0c0c; border:1px solid #1c1c1c; position:relative; overflow:hidden; }
        .card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
        .card-active::before { background:#22D45F; box-shadow:0 0 8px #22D45F44; }
        .card-idle::before { background:#1c1c1c; }
        .card-warn::before { background:#E07B39; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1a1a1a", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E07B39", animation: "pulse-amber 3s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 22, letterSpacing: "0.2em", color: "#F0F0F0" }}>
            SBB CONTROL ROOM
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontSize: 13, letterSpacing: "0.1em", color: "#404040" }}>
            <Clock />
          </span>
          <button
            onClick={logout}
            style={{
              background: "transparent", border: "1px solid #2a2a2a", color: "#505050",
              padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-mono), monospace",
              fontSize: 10, letterSpacing: "0.2em", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "#505050"; (e.target as HTMLElement).style.color = "#808080"; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "#2a2a2a"; (e.target as HTMLElement).style.color = "#505050"; }}
          >
            DISCONNECT
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: "#1a0808", borderBottom: "1px solid #3a1010", padding: "10px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#EF4444", letterSpacing: "0.1em" }}>✗ {error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1000 }}>

        {/* YouTube Card */}
        <div className={`card ${!status ? "card-idle" : status.youtube.disabled ? "card-idle" : status.youtube.active ? "card-active" : "card-warn"}`}>
          <div style={{ padding: "20px 24px" }}>
            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 20, letterSpacing: "0.2em", color: "#F0F0F0" }}>
                  YOUTUBE
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot active={!!status?.youtube.active} pulse />
                <span style={{
                  fontSize: 10, letterSpacing: "0.2em",
                  color: !status ? "#303030" : status.youtube.disabled ? "#404040" : status.youtube.active ? "#22D45F" : "#E07B39",
                }}>
                  {!status ? "—" : status.youtube.disabled ? "DISABLED" : status.youtube.active ? "ACTIVE" : "MONITORING"}
                </span>
              </div>
            </div>

            {/* Data */}
            <div style={{ marginBottom: 20 }}>
              <DataRow label="MODE" value={
                status?.youtube.autoDetect
                  ? <span style={{ color: "#E07B39" }}>AUTO-DETECT</span>
                  : "MANUAL"
              } />
              <DataRow label="LIVE CHAT ID" value={
                status?.youtube.liveChatId
                  ? <span style={{ color: "#B0B0B0", fontSize: 11 }}>{truncate(status.youtube.liveChatId, 28)}</span>
                  : null
              } />
              <DataRow label="STATUS" value={
                status?.youtube.disabled
                  ? <span style={{ color: "#404040" }}>Polling suspended</span>
                  : status?.youtube.active
                    ? <span style={{ color: "#22D45F" }}>Receiving chat</span>
                    : status?.youtube.autoDetect
                      ? <span style={{ color: "#E07B39" }}>Awaiting live stream</span>
                      : <span style={{ color: "#404040" }}>Idle</span>
              } />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {status?.youtube.disabled ? (
                <button
                  className="ctrl-btn ctrl-btn-start"
                  onClick={() => control("enable", "youtube")}
                  disabled={busy === "youtube-enable"}
                >
                  {busy === "youtube-enable" ? "ENABLING..." : "▶ ENABLE"}
                </button>
              ) : (
                <button
                  className="ctrl-btn ctrl-btn-stop"
                  onClick={() => control("disable", "youtube")}
                  disabled={busy === "youtube-disable"}
                >
                  {busy === "youtube-disable" ? "DISABLING..." : "■ DISABLE"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Twitch Card */}
        <div className={`card ${!status ? "card-idle" : status.twitch.active ? "card-active" : "card-idle"}`}>
          <div style={{ padding: "20px 24px" }}>
            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 20, letterSpacing: "0.2em", color: "#F0F0F0" }}>
                  TWITCH
                </span>
                {status && !status.twitch.authorized && (
                  <a
                    href="/api/twitch/auth/redirect"
                    style={{ fontSize: 9, color: "#E07B39", letterSpacing: "0.15em", textDecoration: "none", border: "1px solid #3a2010", padding: "2px 8px" }}
                  >
                    OAUTH REQUIRED ↗
                  </a>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot active={!!status?.twitch.active} pulse />
                <span style={{
                  fontSize: 10, letterSpacing: "0.2em",
                  color: status?.twitch.active ? "#22D45F" : "#404040",
                }}>
                  {!status ? "—" : status.twitch.active ? "CONNECTED" : "IDLE"}
                </span>
              </div>
            </div>

            {/* Data */}
            <div style={{ marginBottom: 20 }}>
              <DataRow label="CHANNEL" value={status?.twitch.channel} />
              <DataRow label="SUB ID" value={
                status?.twitch.subscriptionId
                  ? <span style={{ fontSize: 11 }}>{truncate(status.twitch.subscriptionId, 28)}</span>
                  : null
              } />
              <DataRow label="STREAM" value={
                status?.twitch.stream
                  ? <span style={{ color: "#22D45F" }}>{status.twitch.stream.title} · {status.twitch.stream.viewerCount.toLocaleString()} viewers</span>
                  : status?.twitch.active
                    ? <span style={{ color: "#606060" }}>Offline</span>
                    : null
              } />
            </div>

            {/* Actions */}
            {status?.twitch.active ? (
              <button
                className="ctrl-btn ctrl-btn-stop"
                onClick={() => control("stop", "twitch")}
                disabled={busy === "twitch-stop"}
              >
                {busy === "twitch-stop" ? "STOPPING..." : "■ DISCONNECT"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="channel-input"
                  placeholder="channel name"
                  value={twitchChannel}
                  onChange={e => setTwitchChannel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && twitchChannel) control("start", "twitch", twitchChannel); }}
                />
                <button
                  className="ctrl-btn ctrl-btn-start"
                  onClick={() => control("start", "twitch", twitchChannel)}
                  disabled={!twitchChannel || busy === "twitch-start"}
                >
                  {busy === "twitch-start" ? "CONNECTING..." : "▶ CONNECT"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0 32px 24px", display: "flex", gap: 24, alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "#2a2a2a" }}>
          {secondsAgo !== null ? `REFRESHED ${secondsAgo}s AGO` : "LOADING..."}
        </span>
        <button
          onClick={fetchStatus}
          style={{
            background: "none", border: "none", color: "#333", cursor: "pointer",
            fontFamily: "var(--font-mono), monospace", fontSize: 10, letterSpacing: "0.15em",
            padding: 0, transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.target as HTMLElement).style.color = "#606060"}
          onMouseLeave={e => (e.target as HTMLElement).style.color = "#333"}
        >
          ↺ REFRESH
        </button>
      </div>
    </div>
  );
}
