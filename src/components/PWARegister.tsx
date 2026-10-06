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

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration!.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
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

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const checkForUpdate = () => {
      registration?.update().catch(() => {});
    };

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });

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
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 50,
        maxWidth: 384,
        marginLeft: "auto",
      }}
    >
      <div
        className="animate-slide-up"
        style={{
          background: "linear-gradient(135deg, var(--wine), var(--wine-deep))",
          color: "var(--on-wine)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: "rgba(255,255,255,0.18)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <RefreshCw size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Update tersedia</p>
          <p style={{ fontSize: 12, opacity: 0.8 }}>Tap untuk pakai versi terbaru</p>
        </div>
        <button
          onClick={applyUpdate}
          style={{
            background: "#fff",
            color: "var(--wine)",
            fontWeight: 600,
            fontSize: 12,
            padding: "8px 16px",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Update
        </button>
      </div>
    </div>
  );
}
