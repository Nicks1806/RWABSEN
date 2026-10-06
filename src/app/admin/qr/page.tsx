"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import QRCode from "qrcode";
import { ArrowLeft, RefreshCw, QrCode, Printer, Download } from "lucide-react";

// QR valid for 10 years - effectively permanent for physical print
const QR_VALIDITY_YEARS = 10;

export default function QRCodePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);

  const createPermanentToken = useCallback(async () => {
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
  }, []);

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
  }, [createPermanentToken]);

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
    <div
      className="min-h-screen animate-fade-in print:bg-white"
      style={{ background: "var(--surface-100)" }}
    >
      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-10 print:hidden"
        style={{
          background: "var(--surface-100)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="ico-circ"
            style={{ color: "var(--ink-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="rw-micro" style={{ color: "var(--ink-muted)" }}>
              ADMIN
            </p>
            <h1 className="rw-heading flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <QrCode size={18} /> QR Code Absensi
            </h1>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 print:py-0 print:px-0">
        <div className="rw-card text-center print:shadow-none print:rounded-none print:border-0 print:p-4">
          {/* Print-only header */}
          <div className="hidden print:block mb-4">
            <p style={{ color: "var(--wine)", fontWeight: 700, fontSize: 20 }}>
              RedWine Shoes &amp; Bags
            </p>
          </div>

          <h2
            className="text-xl font-bold print:text-3xl"
            style={{ color: "var(--ink)" }}
          >
            Scan untuk Absen
          </h2>
          <p
            className="text-sm mt-2 print:text-base"
            style={{ color: "var(--ink-muted)" }}
          >
            Scan QR pakai kamera HP untuk clock in / clock out
          </p>

          {loading ? (
            <div className="mt-6 flex justify-center">
              <div
                className="w-[400px] h-[400px] animate-pulse"
                style={{
                  background: "var(--surface-300)",
                  borderRadius: "var(--radius-lg)",
                }}
              />
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <div
                className="p-6 print:border-8"
                style={{
                  background: "#ffffff",
                  borderRadius: "var(--radius-lg)",
                  border: "3px solid var(--wine-tint)",
                }}
              >
                <canvas ref={canvasRef} />
              </div>
            </div>
          )}

          {/* Permanent label */}
          <div
            className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium print:hidden"
            style={{
              background: "var(--success-tint)",
              color: "var(--success)",
              borderRadius: "var(--radius-full)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--success)" }}
            ></span>
            QR Permanen - Siap Dicetak
          </div>

          {/* Print-only footer */}
          <div className="hidden print:block mt-6">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              RedWine Shoes &amp; Bags
            </p>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Scan untuk absen masuk/pulang
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center mt-6 print:hidden">
            <button
              onClick={downloadQR}
              className="rw-btn rw-btn--primary rw-btn--sm gap-1.5"
            >
              <Download size={16} /> Download PNG
            </button>
            <button
              onClick={printQR}
              className="rw-btn rw-btn--outline rw-btn--sm gap-1.5"
            >
              <Printer size={16} /> Print QR
            </button>
            <button
              onClick={regenerateToken}
              disabled={regenLoading}
              className="rw-btn rw-btn--sm gap-1.5"
              style={{
                background: "var(--warning-tint)",
                color: "var(--warning)",
                border: "1px solid var(--warning)",
              }}
            >
              <RefreshCw size={16} className={regenLoading ? "animate-spin" : ""} />
              {regenLoading ? "Memproses..." : "Ganti QR"}
            </button>
          </div>

          {/* Instructions card */}
          <div
            className="mt-8 text-left p-4 print:hidden"
            style={{
              background: "var(--surface-300)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "var(--ink)" }}
            >
              Cara Pakai:
            </p>
            <ol
              className="text-xs space-y-1 list-decimal list-inside"
              style={{ color: "var(--ink-muted)" }}
            >
              <li>
                <strong>Download</strong> atau <strong>Print</strong> QR ini
              </li>
              <li>Tempel di dinding kantor / tempat strategis</li>
              <li>Karyawan scan pakai kamera HP (bukan Google app)</li>
              <li>Link auto-terbuka &rarr; app RedWine &rarr; QR ter-verify</li>
              <li>Lanjut foto selfie &rarr; Clock In berhasil</li>
            </ol>
            <p
              className="text-[10px] mt-3 p-2"
              style={{
                color: "var(--warning)",
                background: "var(--warning-tint)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <strong>QR permanen</strong> - bisa di-print dan pakai jangka panjang. Klik
              &ldquo;Ganti QR&rdquo; hanya kalau QR lama bocor/dipakai orang lain (QR lama akan
              langsung tidak valid).
            </p>
            <p
              className="text-[10px] mt-2"
              style={{ color: "var(--ink-muted)" }}
            >
              Kombinasikan dengan radius GPS agar absen wajib dari lokasi fisik kantor.
              Aktifkan di <strong>Pengaturan &rarr; Wajib Scan QR</strong>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
