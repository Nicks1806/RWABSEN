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
    if (!name.trim() || !pin.trim()) return;
    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("employees")
      .select("*")
      .ilike("name", name.trim())
      .eq("pin", pin)
      .eq("is_active", true)
      .maybeSingle();

    if (dbError || !data) {
      setError("Nama atau PIN salah. Coba lagi.");
      setLoading(false);
      return;
    }

    storeEmployee(data);

    try {
      if (await isPushSupported()) {
        const perm = await getPushPermissionStatus();
        if (perm === "default" || perm === "granted") {
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 box-border animate-fade-in"
      style={{ background: "var(--surface-100)" }}
    >
      {/* Logo */}
      <div className="mb-10">
        <Logo size="md" />
      </div>

      {/* Form card */}
      <div className="rw-card w-full max-w-sm" style={{ padding: "var(--space-5)" }}>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-name"
              style={{ fontWeight: 600, fontSize: 14, color: "var(--wine)" }}
            >
              Nama
            </label>
            <input
              id="login-name"
              type="text"
              className="rw-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="Masukkan nama"
              autoComplete="name"
              autoFocus
              required
            />
          </div>

          {/* PIN */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-pin"
              style={{ fontWeight: 600, fontSize: 14, color: "var(--wine)" }}
            >
              PIN
            </label>
            <input
              id="login-pin"
              type="password"
              className="rw-input"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              placeholder="Masukkan PIN"
              inputMode="numeric"
              autoComplete="current-password"
              required
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="rw-btn rw-btn--primary rw-btn--block"
            disabled={!name.trim() || !pin.trim() || loading}
            style={{ marginTop: 4 }}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>

      {/* Install */}
      <div className="text-center mt-8">
        <InstallAppButton />
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-muted)",
            marginTop: 8,
          }}
        >
          Pasang aplikasi di HP untuk akses lebih cepat
        </p>
      </div>
    </div>
  );
}
