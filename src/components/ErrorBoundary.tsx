"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--surface-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          className="rw-card"
          style={{ maxWidth: 384, width: "100%", textAlign: "center", padding: 32 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-full)",
              background: "var(--danger-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <AlertTriangle size={28} style={{ color: "var(--danger)" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            Terjadi Kesalahan
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-muted)", marginBottom: 16 }}>
            {this.props.fallbackMessage || "Halaman mengalami error. Coba muat ulang."}
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre
              style={{
                fontSize: 12,
                textAlign: "left",
                background: "var(--surface-200)",
                borderRadius: "var(--radius-md)",
                padding: 12,
                overflow: "auto",
                maxHeight: 128,
                color: "var(--danger)",
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingTop: 8 }}>
            <button onClick={this.handleRetry} className="rw-btn rw-btn--primary" style={{ gap: 8 }}>
              <RefreshCw size={16} /> Coba Lagi
            </button>
            <button
              onClick={() => (window.location.href = "/home")}
              className="rw-btn rw-btn--outline"
            >
              Ke Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
