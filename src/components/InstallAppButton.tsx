"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as Window & { MSStream?: unknown }).MSStream
    );

    // Check if already installed (running as PWA)
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
      // No native prompt (iOS or already installed)
      setShowInstructions(true);
    }
  }

  if (installed) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
        <Smartphone size={12} /> App terpasang
      </div>
    );
  }

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
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={20} className="text-primary" />
              <h3 className="font-bold text-gray-800">Pasang di HP</h3>
            </div>
            {isIOS ? (
              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-semibold">📱 iPhone / iPad (Safari):</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Tap tombol <strong>Share</strong> (kotak dengan panah ke atas)</li>
                  <li>Scroll bawah, tap <strong>&quot;Add to Home Screen&quot;</strong></li>
                  <li>Tap <strong>Add</strong></li>
                  <li>Icon RedWine muncul di homescreen</li>
                </ol>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-semibold">📱 Android (Chrome):</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Tap tombol menu <strong>(⋮)</strong> di pojok kanan atas</li>
                  <li>Pilih <strong>&quot;Install app&quot;</strong> atau <strong>&quot;Add to Home screen&quot;</strong></li>
                  <li>Tap <strong>Install</strong></li>
                  <li>Icon RedWine muncul di homescreen</li>
                </ol>
                <p className="text-xs text-gray-500 mt-3">
                  💡 Jika tidak muncul opsi, pastikan buka via <strong>Chrome</strong> dan refresh halaman.
                </p>
              </div>
            )}
            <button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
