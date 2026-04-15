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

    // Detect browser
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

    // Check if already installed
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
      // Fallback: show prompt with link
      window.prompt("Salin link ini lalu buka di Safari:", "https://absensiredwine.vercel.app");
    }
  }

  if (installed) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
        <Smartphone size={12} /> App sudah terpasang
      </div>
    );
  }

  const needsSafariWarning =
    isIOS && (browserKind === "chrome-ios" || browserKind === "firefox-ios" || browserKind === "in-app");
  const isInAppBrowser = browserKind === "in-app";

  return (
    <>
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition shadow-sm"
      >
        <Download size={16} /> Download App
      </button>

      {showInstructions && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up overflow-hidden max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="bg-gradient-to-br from-primary to-primary-dark px-5 pt-4 pb-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pasang Aplikasi di HP</h3>
                  <p className="text-xs text-white/80">
                    {isIOS ? "Ikuti 3 langkah ini" : "Panduan install"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Warning banner */}
              {needsSafariWarning && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold">
                      {isInAppBrowser ? "Tidak bisa install di browser ini" : "Pakai Safari bukan Chrome"}
                    </p>
                    <p className="text-xs mt-1">
                      {isInAppBrowser
                        ? "Salin link di bawah, lalu paste di browser Safari."
                        : "Install hanya work di Safari. Salin link dan buka di Safari."}
                    </p>
                  </div>
                </div>
              )}

              {/* iOS Steps */}
              {isIOS && !isInAppBrowser && (
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-gray-800">Tap tombol Share</p>
                        {/* iOS Share icon */}
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="text-primary"
                        >
                          <path
                            d="M8 12V6a4 4 0 118 0v6M12 2v14M5 11l7-7 7 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="4"
                            y="14"
                            width="16"
                            height="8"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                          />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-600">
                        Di <strong>toolbar paling bawah Safari</strong>, cari icon kotak dengan panah ke atas ↑
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-gray-800">Add to Home Screen</p>
                        {/* Add to home icon */}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="4"
                            stroke="#8B1A1A"
                            strokeWidth="2"
                            fill="none"
                          />
                          <path
                            d="M12 8v8M8 12h8"
                            stroke="#8B1A1A"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-600">
                        Setelah share menu muncul, <strong>scroll ke bawah</strong> → pilih <strong>&ldquo;Add to Home Screen&rdquo;</strong> atau <strong>&ldquo;Ke Layar Awal&rdquo;</strong>
                      </p>
                      <p className="text-[10px] text-amber-700 mt-1.5 bg-amber-50 rounded px-2 py-1">
                        💡 Tidak kelihatan? Geser menu ke atas/bawah lebih jauh
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-800 mb-1">Tap &ldquo;Add&rdquo; / &ldquo;Tambah&rdquo;</p>
                      <p className="text-xs text-gray-600">
                        Pojok kanan atas. Icon <strong>RedWine</strong> akan muncul di homescreen HP.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Android Steps (non-iOS) */}
              {!isIOS && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-800 mb-1">Tap menu ⋮ di Chrome</p>
                      <p className="text-xs text-gray-600">Pojok kanan atas Chrome</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-800 mb-1">Pilih &ldquo;Install app&rdquo;</p>
                      <p className="text-xs text-gray-600">
                        Atau <strong>&ldquo;Add to Home screen&rdquo;</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-800 mb-1">Tap &ldquo;Install&rdquo;</p>
                      <p className="text-xs text-gray-600">Icon RedWine muncul di homescreen</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Copy Link Button */}
              <button
                onClick={copyLink}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-green-600" />
                    <span className="text-green-700">Link tersalin!</span>
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
                  className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 py-2"
                >
                  <span>Masih tidak bisa?</span>
                  <ChevronDown
                    size={14}
                    className={`transition ${showTroubleshoot ? "rotate-180" : ""}`}
                  />
                </button>
                {showTroubleshoot && (
                  <div className="text-xs text-gray-600 space-y-1.5 bg-gray-50 rounded-xl p-3 mt-1">
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

              <button
                onClick={() => setShowInstructions(false)}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
