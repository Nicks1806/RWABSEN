"use client";

import { useEffect } from "react";

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Tasks page error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div className="rw-card" style={{ maxWidth: 448, width: "100%", textAlign: "center", padding: 32 }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: "var(--danger-tint)",
            borderRadius: "var(--radius-full)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <span style={{ fontSize: 32 }}>&#9888;&#65039;</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
          Ada kendala
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-muted)", marginBottom: 16 }}>
          Task Board sedang error. Coba muat ulang atau kembali ke beranda.
        </p>
        {error.message && (
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-muted)",
              marginBottom: 16,
              wordBreak: "break-word",
              fontFamily: "monospace",
              background: "var(--surface-200)",
              padding: 8,
              borderRadius: "var(--radius-md)",
            }}
          >
            {error.message.slice(0, 200)}
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reset} className="rw-btn rw-btn--primary rw-btn--block">
            Coba Lagi
          </button>
          <a href="/home" className="rw-btn rw-btn--outline rw-btn--block" style={{ textDecoration: "none" }}>
            Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
