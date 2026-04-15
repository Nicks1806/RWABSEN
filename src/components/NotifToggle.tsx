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
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
        <AlertCircle size={14} />
        <span>Browser tidak support notifikasi. Install app dulu.</span>
      </div>
    );
  }

  if (permission === "denied") {
    return compact ? null : (
      <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-2">
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
        className={`p-2 transition ${
          subscribed ? "text-primary hover:text-primary-dark" : "text-gray-500 hover:text-primary"
        }`}
        title={subscribed ? "Matikan notifikasi" : "Aktifkan notifikasi"}
      >
        {subscribed ? <Bell size={20} /> : <BellOff size={20} />}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              subscribed ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"
            }`}
          >
            {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800">Notifikasi Push</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {subscribed
                ? "Aktif - Anda akan dapat notif saat pengajuan disetujui/ditolak"
                : "Aktifkan untuk dapat notif langsung di HP"}
            </p>
            {msg && (
              <p
                className={`text-xs mt-1 ${
                  msg.includes("Gagal") || msg.includes("ditolak") ? "text-red-600" : "text-green-600"
                }`}
              >
                {msg}
              </p>
            )}
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={subscribed}
            onChange={toggle}
            disabled={loading}
            className="sr-only peer"
          />
          <div
            className={`w-11 h-6 rounded-full peer-checked:bg-primary bg-gray-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${
              loading ? "opacity-50" : ""
            }`}
          ></div>
        </label>
      </div>
    </div>
  );
}
