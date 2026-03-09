"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Authentication failed");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#070707",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-mono), monospace",
    }}>
      <style>{`
        @keyframes pulse-amber {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .login-input::placeholder { color: #3a3a3a; letter-spacing: 0.15em; }
        .login-input:focus { border-bottom-color: #E07B39 !important; }
        .enter-btn:hover:not(:disabled) { background: #F08B49 !important; }
        .corner-tl { position: absolute; top: -28px; left: -28px; width: 22px; height: 22px; border-top: 1.5px solid #E07B39; border-left: 1.5px solid #E07B39; }
        .corner-tr { position: absolute; top: -28px; right: -28px; width: 22px; height: 22px; border-top: 1.5px solid #E07B39; border-right: 1.5px solid #E07B39; }
        .corner-bl { position: absolute; bottom: -28px; left: -28px; width: 22px; height: 22px; border-bottom: 1.5px solid #E07B39; border-left: 1.5px solid #E07B39; }
        .corner-br { position: absolute; bottom: -28px; right: -28px; width: 22px; height: 22px; border-bottom: 1.5px solid #E07B39; border-right: 1.5px solid #E07B39; }
      `}</style>

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(224,123,57,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(224,123,57,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {/* Corner brackets */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <div className="corner-tl" /><div className="corner-tr" />
          <div className="corner-bl" /><div className="corner-br" />

          <div style={{ padding: "56px 72px" }}>
            {/* Indicator */}
            <div style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E07B39", animation: "pulse-amber 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, letterSpacing: "0.4em", color: "#4a4a4a" }}>STREAMER BILLBOARD</span>
            </div>

            {/* Title */}
            <div style={{
              fontFamily: "var(--font-bebas), sans-serif",
              fontSize: 80, letterSpacing: "0.08em",
              color: "#F0F0F0", lineHeight: 0.9, marginBottom: 6,
            }}>
              CONTROL
            </div>
            <div style={{
              fontFamily: "var(--font-bebas), sans-serif",
              fontSize: 80, letterSpacing: "0.08em",
              color: "#E07B39", lineHeight: 0.9, marginBottom: 40,
            }}>
              ROOM
            </div>

            <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "#3a3a3a", marginBottom: 48 }}>
              ◆ RESTRICTED ACCESS ◆
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 8 }}>
                <input
                  className="login-input"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="ENTER PASSPHRASE"
                  autoFocus
                  required
                  style={{
                    width: 280, background: "transparent", border: "none",
                    borderBottom: `1.5px solid ${error ? "#EF4444" : "#2a2a2a"}`,
                    color: "#F0F0F0", fontFamily: "var(--font-mono), monospace",
                    fontSize: 13, letterSpacing: "0.2em", padding: "14px 0",
                    outline: "none", textAlign: "center", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                />
              </div>

              <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
                {error && (
                  <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#EF4444" }}>
                    ✗ {error.toUpperCase()}
                  </span>
                )}
              </div>

              <button
                className="enter-btn"
                type="submit"
                disabled={loading}
                style={{
                  background: "#E07B39", color: "#070707", border: "none",
                  padding: "14px 56px", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-bebas), sans-serif",
                  fontSize: 22, letterSpacing: "0.25em",
                  opacity: loading ? 0.6 : 1, transition: "all 0.15s",
                }}
              >
                {loading ? "VERIFYING..." : "ENTER"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
