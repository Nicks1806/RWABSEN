"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function PWARegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    async function register() {
      try {
        registration = await navigator.serviceWorker.register("/sw.js");

        // Check immediately if there's a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration!.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New SW installed and there's an active controller => update available
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            }
          });
        });
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    }

    register();

    // Reload when new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Check for updates when app gains focus or becomes visible
    const checkForUpdate = () => {
      registration?.update().catch(() => {});
    };

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });

    // Also check periodically (every 5 minutes while app is open)
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", checkForUpdate);
      clearInterval(interval);
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    // Tell waiting SW to skip waiting → triggers controllerchange → reload
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <div className="bg-primary text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <RefreshCw size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Update tersedia</p>
          <p className="text-xs text-white/80">Tap untuk pakai versi terbaru</p>
        </div>
        <button
          onClick={applyUpdate}
          className="bg-white text-primary font-semibold text-xs px-4 py-2 rounded-xl hover:bg-gray-50 transition shrink-0"
        >
          Update
        </button>
      </div>
    </div>
  );
}
