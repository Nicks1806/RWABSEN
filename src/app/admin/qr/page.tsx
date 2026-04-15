"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import QRCode from "qrcode";
import { ArrowLeft, RefreshCw, QrCode } from "lucide-react";
import Logo from "@/components/Logo";

export default function QRCodePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);

  async function generateToken() {
    // Generate a random token
    const tokenValue = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 30_000).toISOString();

    // Delete expired tokens
    await supabase.from("qr_tokens").delete().lt("expires_at", new Date().toISOString());

    // Insert new token
    const { error } = await supabase
      .from("qr_tokens")
      .insert({ token: tokenValue, expires_at: expiresAt });

    if (!error) {
      setToken(tokenValue);
      setTimeLeft(30);
    }
  }

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role !== "admin") {
      router.push("/");
      return;
    }
    generateToken();
  }, [router]);

  // Auto-regenerate every 30s
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Render QR to canvas
  useEffect(() => {
    if (!token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, `REDWINE-ABSEN-${token}`, {
      width: 320,
      margin: 2,
      color: { dark: "#8B1A1A", light: "#ffffff" },
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-white">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-primary"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-gray-800 flex items-center gap-2">
              <QrCode size={18} /> QR Code Absensi
            </h1>
          </div>
          <Logo size="sm" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800">Scan untuk Clock In</h2>
          <p className="text-sm text-gray-500 mt-2">
            Tampilkan layar ini. Karyawan scan pakai HP masing-masing saat absen.
          </p>

          <div className="mt-6 flex justify-center">
            <div className="p-6 bg-white rounded-3xl border-4 border-primary/20">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* Countdown */}
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-full text-sm font-medium">
              <RefreshCw
                size={14}
                className={timeLeft <= 5 ? "animate-spin" : ""}
              />
              QR berubah dalam <span className="font-bold">{timeLeft}s</span>
            </div>
          </div>

          <button
            onClick={generateToken}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Refresh sekarang
          </button>

          <div className="mt-8 text-left bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">📋 Cara Pakai:</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Buka halaman ini di TV/laptop di kantor</li>
              <li>Karyawan buka app RedWine di HP</li>
              <li>Saat Clock In, klik tombol &ldquo;Scan QR&rdquo;</li>
              <li>Arahkan kamera HP ke QR di layar ini</li>
              <li>Clock In otomatis berhasil tanpa perlu foto manual</li>
            </ol>
            <p className="text-[10px] text-gray-400 mt-3">
              💡 Tips: QR berubah setiap 30 detik untuk mencegah screenshot dipakai ulang.
              Aktifkan di <strong>Pengaturan → QR Required</strong> agar clock-in wajib scan.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
