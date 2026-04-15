"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import QRCode from "qrcode";
import { ArrowLeft, RefreshCw, QrCode, Printer, Download } from "lucide-react";
import Logo from "@/components/Logo";

// QR valid for 10 years - effectively permanent for physical print
const QR_VALIDITY_YEARS = 10;

export default function QRCodePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);

  // Fetch existing permanent token or create one
  const fetchOrCreateToken = useCallback(async () => {
    setLoading(true);

    // Look for any valid token (expires more than 1 year away = permanent)
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("qr_tokens")
      .select("*")
      .gte("expires_at", oneYearFromNow)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setToken(existing.token);
      setLoading(false);
      return;
    }

    // No permanent token exists, create one
    await createPermanentToken();
    setLoading(false);
  }, []);

  async function createPermanentToken() {
    const tokenValue =
      Math.random().toString(36).substring(2) +
      Math.random().toString(36).substring(2) +
      Date.now().toString(36);
    const expiresAt = new Date(
      Date.now() + QR_VALIDITY_YEARS * 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error } = await supabase
      .from("qr_tokens")
      .insert({ token: tokenValue, expires_at: expiresAt });

    if (!error) {
      setToken(tokenValue);
    }
  }

  async function regenerateToken() {
    const confirmed = window.confirm(
      "Ganti QR Code?\n\nQR lama akan tidak valid lagi. Semua QR yang sudah di-print harus diganti dengan yang baru."
    );
    if (!confirmed) return;
    setRegenLoading(true);

    // Delete all existing permanent tokens
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("qr_tokens").delete().gte("expires_at", oneYearFromNow);

    // Create new one
    await createPermanentToken();
    setRegenLoading(false);
  }

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role !== "admin") {
      router.push("/");
      return;
    }
    fetchOrCreateToken();
  }, [router, fetchOrCreateToken]);

  // Render QR to canvas
  useEffect(() => {
    if (!token || !canvasRef.current) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://absensiredwine.vercel.app";
    const qrData = `${origin}/absen?qr=${token}`;
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 400,
      margin: 2,
      color: { dark: "#8B1A1A", light: "#ffffff" },
    });
  }, [token]);

  function downloadQR() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `RedWine-QR-Absen.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  function printQR() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-white print:bg-white">
      <header className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
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

      <main className="max-w-2xl mx-auto px-4 py-8 print:py-0 print:px-0">
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center print:shadow-none print:rounded-none print:p-4">
          {/* Print-only header */}
          <div className="hidden print:block mb-4">
            <Logo size="xl" />
          </div>

          <h2 className="text-2xl font-bold text-gray-800 print:text-3xl">Scan untuk Absen</h2>
          <p className="text-sm text-gray-500 mt-2 print:text-base">
            Scan QR pakai kamera HP untuk clock in / clock out
          </p>

          {loading ? (
            <div className="mt-6 flex justify-center">
              <div className="w-[400px] h-[400px] bg-gray-100 rounded-3xl animate-pulse" />
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <div className="p-6 bg-white rounded-3xl border-4 border-primary/20 print:border-primary print:border-8">
                <canvas ref={canvasRef} />
              </div>
            </div>
          )}

          {/* Permanent label */}
          <div className="mt-4 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-xs font-medium print:hidden">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            QR Permanen - Siap Dicetak
          </div>

          {/* Print-only footer */}
          <div className="hidden print:block mt-6">
            <p className="text-sm font-semibold text-gray-700">RedWine Shoes & Bags</p>
            <p className="text-xs text-gray-500">Scan untuk absen masuk/pulang</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center mt-6 print:hidden">
            <button
              onClick={downloadQR}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition"
            >
              <Download size={16} /> Download PNG
            </button>
            <button
              onClick={printQR}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition"
            >
              <Printer size={16} /> Print QR
            </button>
            <button
              onClick={regenerateToken}
              disabled={regenLoading}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={regenLoading ? "animate-spin" : ""} />
              {regenLoading ? "Memproses..." : "Ganti QR"}
            </button>
          </div>

          <div className="mt-8 text-left bg-gray-50 rounded-2xl p-4 print:hidden">
            <p className="text-xs font-semibold text-gray-600 mb-2">📋 Cara Pakai:</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>
                <strong>Download</strong> atau <strong>Print</strong> QR ini
              </li>
              <li>Tempel di dinding kantor / tempat strategis</li>
              <li>Karyawan scan pakai kamera HP (bukan Google app)</li>
              <li>Link auto-terbuka → app RedWine → QR ter-verify</li>
              <li>Lanjut foto selfie → Clock In berhasil</li>
            </ol>
            <p className="text-[10px] text-amber-700 mt-3 bg-amber-50 p-2 rounded">
              ⚠️ <strong>QR permanen</strong> - bisa di-print dan pakai jangka panjang. Klik
              &ldquo;Ganti QR&rdquo; hanya kalau QR lama bocor/dipakai orang lain (QR lama akan
              langsung tidak valid).
            </p>
            <p className="text-[10px] text-gray-400 mt-2">
              💡 Kombinasikan dengan radius GPS agar absen wajib dari lokasi fisik kantor.
              Aktifkan di <strong>Pengaturan → Wajib Scan QR</strong>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
