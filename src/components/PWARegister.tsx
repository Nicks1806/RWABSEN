"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if previously dismissed
    const wasDismissed = localStorage.getItem("pwa_install_dismissed");
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstallPrompt(null);
    } else {
      localStorage.setItem("pwa_install_dismissed", String(Date.now()));
      setDismissed(true);
    }
  }

  function handleDismiss() {
    localStorage.setItem("pwa_install_dismissed", String(Date.now()));
    setDismissed(true);
  }

  if (!installPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-white rounded-2xl shadow-lg border border-primary/20 p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <Download size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">Pasang Aplikasi</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Pasang RedWine Attendance di HP untuk akses lebih cepat
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 text-xs py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition"
            >
              Pasang
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 text-xs py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              Nanti
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 shrink-0">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
