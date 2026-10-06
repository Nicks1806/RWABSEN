"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, AlertCircle } from "lucide-react";
import {
  isPushSupported,
  getPushPermissionStatus,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

interface Props {
  employeeId: string;
  compact?: boolean;
}

export default function NotifToggle({ employeeId, compact = false }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ok = await isPushSupported();
      setSupported(ok);
      if (!ok) return;
      setPermission(await getPushPermissionStatus());
      const sub = await getExistingSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  async function toggle() {
    setLoading(true);
    setMsg("");
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        setMsg("Notifikasi dimatikan");
      } else {
        await subscribeToPush(employeeId);
        setSubscribed(true);
        setPermission("granted");
        setMsg("Notifikasi aktif!");
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  if (!supported) {
    return compact ? null : (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--warning)",
          background: "var(--warning-tint)",
          borderRadius: "var(--radius-md)",
          padding: 8,
        }}
      >
        <AlertCircle size={14} />
        <span>Browser tidak support notifikasi. Install app dulu.</span>
      </div>
    );
  }

  if (permission === "denied") {
    return compact ? null : (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--danger)",
          background: "var(--danger-tint)",
          borderRadius: "var(--radius-md)",
          padding: 8,
        }}
      >
        <AlertCircle size={14} />
        <span>Notifikasi diblokir. Aktifkan di pengaturan browser.</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        style={{
          padding: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "color 0.15s ease",
          color: subscribed ? "var(--wine)" : "var(--ink-muted)",
        }}
        title={subscribed ? "Matikan notifikasi" : "Aktifkan notifikasi"}
      >
        {subscribed ? <Bell size={20} /> : <BellOff size={20} />}
      </button>
    );
  }

  return (
    <div className="rw-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: subscribed ? "var(--wine-tint)" : "var(--surface-300)",
              color: subscribed ? "var(--wine)" : "var(--ink-muted)",
            }}
          >
            {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Notifikasi Push</p>
            <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
              {subscribed
                ? "Aktif - Anda akan dapat notif saat pengajuan disetujui/ditolak"
                : "Aktifkan untuk dapat notif langsung di HP"}
            </p>
            {msg && (
              <p
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  color: msg.includes("Gagal") || msg.includes("ditolak") ? "var(--danger)" : "var(--success)",
                }}
              >
                {msg}
              </p>
            )}
          </div>
        </div>
        <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={subscribed}
            onChange={toggle}
            disabled={loading}
            className="sr-only peer"
          />
          <div
            style={{
              width: 44,
              height: 24,
              borderRadius: "var(--radius-full)",
              background: subscribed ? "var(--wine)" : "var(--surface-300)",
              position: "relative",
              transition: "background 0.2s ease",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: subscribed ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "var(--radius-full)",
                background: "#fff",
                transition: "left 0.2s ease",
              }}
            />
          </div>
        </label>
      </div>
    </div>
  );
}
