"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Copy, AlertTriangle, Check, ChevronDown } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type BrowserKind = "safari" | "chrome-ios" | "firefox-ios" | "in-app" | "android" | "desktop" | "unknown";

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [browserKind, setBrowserKind] = useState<BrowserKind>("unknown");
  const [copied, setCopied] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS =
      /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    let kind: BrowserKind = "unknown";
    if (/Instagram|FBAN|FBAV|WhatsApp|Line|Messenger|Twitter|TikTok/.test(ua)) {
      kind = "in-app";
    } else if (iOS && /CriOS/.test(ua)) {
      kind = "chrome-ios";
    } else if (iOS && /FxiOS/.test(ua)) {
      kind = "firefox-ios";
    } else if (iOS) {
      kind = "safari";
    } else if (/Android/.test(ua)) {
      kind = "android";
    } else {
      kind = "desktop";
    }
    setBrowserKind(kind);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstalled(true);
        setInstallPrompt(null);
      }
    } else {
      setShowInstructions(true);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText("https://absensiredwine.vercel.app");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin link ini lalu buka di Safari:", "https://absensiredwine.vercel.app");
    }
  }

  if (installed) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--success)",
          background: "var(--success-tint)",
          padding: "6px 12px",
          borderRadius: "var(--radius-full)",
        }}
      >
        <Smartphone size={12} /> App sudah terpasang
      </div>
    );
  }

  const needsSafariWarning =
    isIOS && (browserKind === "chrome-ios" || browserKind === "firefox-ios" || browserKind === "in-app");
  const isInAppBrowser = browserKind === "in-app";

  return (
    <>
      <button onClick={handleInstall} className="rw-btn rw-btn--primary rw-btn--sm" style={{ gap: 6 }}>
        <Download size={16} /> Download App
      </button>

      {showInstructions && (
        <div
          className="rw-overlay"
          onClick={() => setShowInstructions(false)}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            className="rw-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "92vh", overflowY: "auto" }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: "var(--radius-full)", background: "var(--surface-300)" }} />
            </div>

            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, var(--wine), var(--wine-deep))",
                padding: "16px 20px 20px",
                color: "var(--on-wine)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: "rgba(255,255,255,0.18)",
                    borderRadius: "var(--radius-xl)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18 }}>Pasang Aplikasi di HP</h3>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>
                    {isIOS ? "Ikuti 3 langkah ini" : "Panduan install"}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Warning banner */}
              {needsSafariWarning && (
                <div
                  style={{
                    background: "var(--danger-tint)",
                    border: "1px solid var(--danger)",
                    borderRadius: "var(--radius-lg)",
                    padding: 12,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 14, color: "var(--danger)" }}>
                    <p style={{ fontWeight: 600 }}>
                      {isInAppBrowser ? "Tidak bisa install di browser ini" : "Pakai Safari bukan Chrome"}
                    </p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      {isInAppBrowser
                        ? "Salin link di bawah, lalu paste di browser Safari."
                        : "Install hanya work di Safari. Salin link dan buka di Safari."}
                    </p>
                  </div>
                </div>
              )}

              {/* iOS Steps */}
              {isIOS && !isInAppBrowser && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <StepItem num={1} title="Tap tombol Share">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: "var(--wine)" }}>
                        <path d="M8 12V6a4 4 0 118 0v6M12 2v14M5 11l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="4" y="14" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Di <strong>toolbar paling bawah Safari</strong>, cari icon kotak dengan panah ke atas
                    </p>
                  </StepItem>

                  <StepItem num={2} title="Add to Home Screen">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="var(--wine)" strokeWidth="2" fill="none" />
                        <path d="M12 8v8M8 12h8" stroke="var(--wine)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Setelah share menu muncul, <strong>scroll ke bawah</strong> → pilih <strong>&ldquo;Add to Home Screen&rdquo;</strong> atau <strong>&ldquo;Ke Layar Awal&rdquo;</strong>
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "var(--warning)",
                        marginTop: 6,
                        background: "var(--warning-tint)",
                        borderRadius: "var(--radius-sm)",
                        padding: "4px 8px",
                      }}
                    >
                      Tidak kelihatan? Geser menu ke atas/bawah lebih jauh
                    </p>
                  </StepItem>

                  <StepItem num={3} title='Tap "Add" / "Tambah"'>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Pojok kanan atas. Icon <strong>RedWine</strong> akan muncul di homescreen HP.
                    </p>
                  </StepItem>
                </div>
              )}

              {/* Android Steps */}
              {!isIOS && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <StepItem num={1} title="Tap menu ⋮ di Chrome">
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>Pojok kanan atas Chrome</p>
                  </StepItem>
                  <StepItem num={2} title='Pilih "Install app"'>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Atau <strong>&ldquo;Add to Home screen&rdquo;</strong>
                    </p>
                  </StepItem>
                  <StepItem num={3} title='Tap "Install"'>
                    <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>Icon RedWine muncul di homescreen</p>
                  </StepItem>
                </div>
              )}

              {/* Copy Link */}
              <button
                onClick={copyLink}
                className="rw-btn rw-btn--outline rw-btn--block"
                style={{ gap: 8 }}
              >
                {copied ? (
                  <>
                    <Check size={16} style={{ color: "var(--success)" }} />
                    <span style={{ color: "var(--success)" }}>Link tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Salin Link App</span>
                  </>
                )}
              </button>

              {/* Troubleshooting */}
              <div>
                <button
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    padding: "8px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span>Masih tidak bisa?</span>
                  <ChevronDown
                    size={14}
                    style={{ transition: "transform 0.2s ease", transform: showTroubleshoot ? "rotate(180deg)" : "none" }}
                  />
                </button>
                {showTroubleshoot && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-muted)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      background: "var(--surface-200)",
                      borderRadius: "var(--radius-lg)",
                      padding: 12,
                      marginTop: 4,
                    }}
                  >
                    {isIOS && (
                      <>
                        <p>• Pastikan buka pakai <strong>Safari</strong> (bukan Chrome atau dari link WhatsApp)</p>
                        <p>• Update iOS ke versi terbaru lewat Settings</p>
                        <p>• Tutup Safari full lalu buka lagi</p>
                        <p>• Kalau share menu tidak muncul, scroll halaman ini dulu</p>
                      </>
                    )}
                    {!isIOS && (
                      <>
                        <p>• Pastikan pakai <strong>Chrome</strong> bukan browser lain</p>
                        <p>• Update Chrome ke versi terbaru</p>
                        <p>• Refresh halaman (pull down) lalu tap Download App lagi</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setShowInstructions(false)} className="rw-btn rw-btn--primary rw-btn--block">
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StepItem({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-full)",
          background: "var(--wine)",
          color: "var(--on-wine)",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 14,
        }}
      >
        {num}
      </div>
      <div
        style={{
          flex: 1,
          background: "var(--surface-200)",
          borderRadius: "var(--radius-lg)",
          padding: 12,
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{title}</p>
        {children}
      </div>
    </div>
  );
}
