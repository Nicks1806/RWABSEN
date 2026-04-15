"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { storeEmployee } from "@/lib/auth";
import Logo from "@/components/Logo";
import InstallAppButton from "@/components/InstallAppButton";
import { isPushSupported, getPushPermissionStatus, subscribeToPush } from "@/lib/push";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("employees")
      .select("*")
      .ilike("name", name.trim())
      .eq("pin", pin)
      .eq("is_active", true)
      .single();

    if (dbError || !data) {
      setError("Nama atau PIN salah");
      setLoading(false);
      return;
    }

    storeEmployee(data);

    // Auto-subscribe push notifications (user gesture from clicking Masuk)
    // Only prompt if permission not yet asked (state="default")
    // If denied previously, skip silently
    try {
      if (await isPushSupported()) {
        const perm = await getPushPermissionStatus();
        if (perm === "default") {
          // First time - browser will show permission prompt
          await subscribeToPush(data.id);
        } else if (perm === "granted") {
          // Permission granted but may not have subscription yet (e.g., new device)
          await subscribeToPush(data.id);
        }
      }
    } catch (err) {
      console.warn("Push auto-subscribe skipped:", err);
    }

    if (data.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/home");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="xl" />
          <p className="text-gray-600 mt-4 text-sm">Sistem Absensi Karyawan</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN"
              inputMode="numeric"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {/* Install App */}
        <div className="mt-6 text-center">
          <InstallAppButton />
          <p className="text-[11px] text-gray-400 mt-2">
            Pasang aplikasi di HP untuk akses lebih cepat
          </p>
        </div>
      </div>
    </div>
  );
}
