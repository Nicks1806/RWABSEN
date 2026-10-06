"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee, storeEmployee } from "@/lib/auth";
import { getCurrentPosition, getDistanceFromLatLng } from "@/lib/geo";
import { getEffectiveWorkHours } from "@/lib/workHours";
import { Employee, Attendance, Settings } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Camera,
  MapPin,
  Clock,
  LogOut,
  History,
  CheckCircle,
  AlertTriangle,
  Key,
  X,
  FileText,
  QrCode as QrCodeIcon,
  User as UserIcon,
  RefreshCw,
} from "lucide-react";
import type JsQR from "jsqr";
import { hasFace } from "@/lib/faceDetection";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";

export default function AbsenPage() {
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsQRRef = useRef<typeof JsQR | null>(null);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [isOutsideRadius, setIsOutsideRadius] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mode, setMode] = useState<"clock_in" | "clock_out">("clock_in");

  // Change PIN modal
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // GPS permission state
  const [gpsDenied, setGpsDenied] = useState(false);
  const [gpsRetrying, setGpsRetrying] = useState(false);

  // Override off-day (for overtime / emergency)
  const [overrideOffDay, setOverrideOffDay] = useState(false);

  // QR scanner
  const [scanningQR, setScanningQR] = useState(false);
  const [qrVerified, setQrVerified] = useState(false);
  const qrScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Leave request
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "izin" as "cuti" | "sakit" | "izin",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTodayRecord = useCallback(async (empId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", empId)
      .eq("date", today)
      .maybeSingle();
    setTodayRecord(data || null);
    // Mode: if already clocked in (but not out), go to clock_out; otherwise clock_in
    if (data && data.clock_in && !data.clock_out) {
      setMode("clock_out");
    } else {
      setMode("clock_in");
    }
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role === "admin") {
      router.push("/");
      return;
    }
    setEmployee(emp);
    fetchTodayRecord(emp.id);

    // Fetch FRESH employee data (in case admin updated work_hours/schedule)
    supabase
      .from("employees")
      .select("*")
      .eq("id", emp.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmployee(data);
          storeEmployee(data); // update localStorage
          if (!data.is_active) {
            toast("Akun Anda sudah dinonaktifkan. Hubungi admin.", "error");
            clearEmployee();
            router.push("/");
          }
        }
      });

    supabase.from("settings").select("*").single().then(({ data }) => {
      if (data) setSettings(data);
    });

    // Only check permission state silently - DO NOT auto-prompt
    // User will be prompted only when clicking 'Ambil Foto' button (explicit action)

    // Face detection models now lazy-loaded at submit time (not at mount)
    // - saves ~200KB download per page visit

    // Auto-verify QR token if present in URL (user scanned QR from phone camera)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qrFromUrl = params.get("qr");
      if (qrFromUrl) {
        verifyQRToken(qrFromUrl).then(() => {
          // Clear URL param after verify
          router.replace("/absen");
        });
      }
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      // Clean up camera + QR scanner on unmount
      if (qrScanIntervalRef.current) {
        clearInterval(qrScanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, fetchTodayRecord]);

  async function startCamera() {
    setMessage(null);

    // 1. Activate camera UI first so <video> element is mounted
    setCameraActive(true);
    setCapturedPhoto(null);

    // 2. Get camera stream
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }
      streamRef.current = stream;

      // Wait a tick for video element to mount
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Force play for mobile browsers
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Video play error:", playErr);
        }
      }
    } catch (err) {
      setCameraActive(false);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessage({
        type: "error",
        text: `Gagal mengakses kamera: ${msg}. Berikan izin kamera di pengaturan browser.`,
      });
      return;
    }

    // 3. Get location
    await tryGetLocation();
  }

  // Evaluate radius in an effect so it still runs when settings arrive AFTER
  // GPS (slow connection) — previously the check was silently skipped and
  // isOutsideRadius stayed false, letting off-site clock-ins skip the
  // mandatory notes
  useEffect(() => {
    if (!location || !settings || Number.isNaN(location.lat)) return;
    const dist = getDistanceFromLatLng(location.lat, location.lng, settings.office_lat, settings.office_lng);
    // Consider GPS accuracy: effective distance = dist - accuracy margin
    // If GPS is imprecise (e.g., accuracy 80m), give benefit of doubt
    const effectiveDist = Math.max(0, dist - gpsAccuracy);
    setDistance(Math.round(dist));
    setIsOutsideRadius(effectiveDist > settings.radius_meters);
  }, [location, gpsAccuracy, settings]);

  async function tryGetLocation() {
    setGpsRetrying(true);
    setGpsDenied(false);
    try {
      const pos = await getCurrentPosition();
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGpsAccuracy(pos.coords.accuracy || 0);
      setMessage(null);
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      if (geoErr?.code === 1) {
        setGpsDenied(true);
      } else {
        let text = "Gagal mendapatkan lokasi. ";
        if (geoErr?.code === 2) text += "GPS tidak tersedia - coba di luar ruangan.";
        else if (geoErr?.code === 3) text += "Timeout - sinyal GPS lemah, coba lagi.";
        else text += "Aktifkan GPS.";
        setMessage({ type: "error", text });
      }
    } finally {
      setGpsRetrying(false);
    }
  }

  // Submit without GPS (marked as outside radius, coords saved as null)
  function submitWithoutGps() {
    if (!settings) return;
    // Use sentinel NaN to mark as "no GPS" - will be converted to null before save
    setLocation({ lat: NaN, lng: NaN });
    setDistance(99999);
    setIsOutsideRadius(true);
    setGpsDenied(false);
    setMessage(null);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    // Guard: re-encode at lower quality if file too large (>500KB)
    if (dataUrl.length > 700_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }
    if (dataUrl.length > 1_500_000) {
      setMessage({ type: "error", text: "Foto terlalu besar. Coba ulang dengan pencahayaan lebih baik." });
      return;
    }
    setCapturedPhoto(dataUrl);
    stopCamera();
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function retakePhoto() {
    setCapturedPhoto(null);
    startCamera();
  }

  async function handleSubmit() {
    if (!employee || !capturedPhoto || !location) return;
    if (!settings) {
      setMessage({ type: "error", text: "Pengaturan kantor belum termuat. Tunggu sebentar lalu coba lagi." });
      return;
    }
    if (isOutsideRadius && !notes.trim()) {
      setMessage({ type: "error", text: "Anda di luar radius kantor. Wajib isi keterangan." });
      return;
    }
    // Guard: only 1x per day
    if (mode === "clock_in" && todayRecord?.clock_in) {
      setMessage({ type: "error", text: "Anda sudah clock in hari ini." });
      return;
    }
    if (mode === "clock_out" && todayRecord?.clock_out) {
      setMessage({ type: "error", text: "Anda sudah clock out hari ini." });
      return;
    }

    setLoading(true);
    setMessage(null);

    // Face detection check - ensure photo contains a human face
    setMessage({ type: "success", text: "Memverifikasi foto..." });
    const faceOk = await hasFace(capturedPhoto);
    if (!faceOk) {
      setMessage({
        type: "error",
        text: "Wajah tidak terdeteksi di foto. Pastikan wajah terlihat jelas dan ambil ulang.",
      });
      setLoading(false);
      return;
    }
    setMessage(null);

    try {
      // Upload photo to Supabase Storage
      const fileName = `${employee.id}/${Date.now()}.jpg`;
      const base64 = capturedPhoto.split(",")[1] || capturedPhoto;
      if (!base64) {
        toast("Foto tidak valid. Coba ambil ulang.", "error");
        setLoading(false);
        return;
      }
      const byteCharacters = atob(base64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);

      const photoUrl = urlData.publicUrl;
      const now = new Date().toISOString();
      const today = format(new Date(), "yyyy-MM-dd");

      // Determine status using employee-specific hours (fallback to settings)
      const { start: workStartStr, end: workEndStr } = getEffectiveWorkHours(employee, settings);

      let status = "present";
      if (mode === "clock_in") {
        const [h, m] = (workStartStr || "09:00").split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          const workStart = new Date();
          workStart.setHours(h, m, 0, 0);
          if (new Date() > workStart) status = "late";
        }
      }

      // Convert NaN coords to null (when submitted without GPS)
      const safeLat = Number.isFinite(location.lat) ? location.lat : null;
      const safeLng = Number.isFinite(location.lng) ? location.lng : null;

      if (mode === "clock_in") {
        const { error: insertError } = await supabase.from("attendance").insert({
          employee_id: employee.id,
          date: today,
          clock_in: now,
          clock_in_photo: photoUrl,
          clock_in_lat: safeLat,
          clock_in_lng: safeLng,
          status,
          notes: notes.trim() || null,
        });
        if (insertError) throw insertError;
        setMessage({ type: "success", text: "Clock In berhasil!" });
      } else {
        // Determine early leave
        const [h, m] = (workEndStr || "17:00").split(":").map(Number);
        const workEnd = new Date();
        if (Number.isFinite(h) && Number.isFinite(m)) {
          workEnd.setHours(h, m, 0, 0);
        } else {
          workEnd.setHours(17, 0, 0, 0);
        }
        if (new Date() < workEnd && todayRecord?.status !== "late") {
          status = "early_leave";
        } else if (todayRecord?.status === "late") {
          status = "late";
        }

        const { error: updateError } = await supabase
          .from("attendance")
          .update({
            clock_out: now,
            clock_out_photo: photoUrl,
            clock_out_lat: safeLat,
            clock_out_lng: safeLng,
            status,
            notes: todayRecord?.notes
              ? `${todayRecord.notes} | ${notes.trim()}`
              : notes.trim() || null,
          })
          .eq("id", todayRecord!.id);
        if (updateError) throw updateError;
        setMessage({ type: "success", text: "Clock Out berhasil!" });
      }

      setCapturedPhoto(null);
      setNotes("");
      fetchTodayRecord(employee.id);
      // Stop camera + smooth transition to home
      stopCamera();
      setTransitioning(true);
      // Prefetch home so navigation is instant
      router.prefetch("/home");
      setTimeout(() => {
        router.replace("/home");
      }, 700);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    stopCamera();
    clearEmployee();
    router.push("/");
  }

  // Extract token from QR data (supports URL format or legacy plain text)
  function extractQRToken(data: string): string | null {
    // URL format: https://.../absen?qr=TOKEN
    try {
      const url = new URL(data);
      const qrParam = url.searchParams.get("qr");
      if (qrParam) return qrParam;
    } catch {
      // Not a URL, continue to legacy check
    }
    // Legacy format: REDWINE-ABSEN-TOKEN
    if (data.startsWith("REDWINE-ABSEN-")) {
      return data.replace("REDWINE-ABSEN-", "");
    }
    return null;
  }

  async function startQRScan() {
    setScanningQR(true);
    setMessage(null);
    try {
      if (!jsQRRef.current) {
        const mod = await import("jsqr");
        jsQRRef.current = mod.default;
      }
      const jsQRFn = jsQRRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      await new Promise((r) => setTimeout(r, 100));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      qrScanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQRFn(imageData.data, imageData.width, imageData.height);
        if (code) {
          const extracted = extractQRToken(code.data);
          if (extracted) {
            await verifyQRToken(extracted);
          }
        }
      }, 500);
    } catch {
      setScanningQR(false);
      setMessage({ type: "error", text: "Gagal akses kamera belakang" });
    }
  }

  async function verifyQRToken(token: string) {
    const { data } = await supabase
      .from("qr_tokens")
      .select("*")
      .eq("token", token)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data) {
      // Valid!
      stopQRScan();
      setQrVerified(true);
      setMessage({ type: "success", text: "QR valid! Lanjutkan dengan foto selfie." });
    }
    // If invalid, keep scanning
  }

  function stopQRScan() {
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanningQR(false);
  }

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setLeaveMsg(null);
    if (!leaveForm.reason.trim()) {
      setLeaveMsg({ type: "error", text: "Alasan wajib diisi" });
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveMsg({ type: "error", text: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
      return;
    }
    setLeaveLoading(true);
    const { error } = await supabase.from("leaves").insert({
      employee_id: employee.id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason.trim(),
      status: "pending",
    });
    if (error) {
      setLeaveLoading(false);
      setLeaveMsg({ type: "error", text: "Gagal mengirim: " + error.message });
      return;
    }
    setLeaveMsg({ type: "success", text: "Pengajuan berhasil dikirim! Menunggu approval admin." });

    // Notify admin(s) via push
    try {
      const { data: admins } = await supabase
        .from("employees")
        .select("id")
        .eq("role", "admin");
      if (admins && admins.length > 0) {
        const typeName = leaveForm.leave_type === "cuti" ? "Cuti" : leaveForm.leave_type === "sakit" ? "Sakit" : "Izin";
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_ids: admins.map((a) => a.id),
            title: `Pengajuan ${typeName} Baru`,
            body: `${employee.name} mengajukan ${typeName.toLowerCase()} — butuh approval.`,
            url: "/admin",
          }),
        });
      }
    } catch (err) {
      console.error("Notify admin failed:", err);
    }
    setTimeout(() => {
      setShowLeaveForm(false);
      setLeaveForm({
        leave_type: "izin",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      setLeaveMsg(null);
      setLeaveLoading(false);
    }, 1500);
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setPinMsg(null);

    if (oldPin !== employee.pin) {
      setPinMsg({ type: "error", text: "PIN lama salah" });
      return;
    }
    if (newPin.length < 4) {
      setPinMsg({ type: "error", text: "PIN baru minimal 4 karakter" });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: "error", text: "Konfirmasi PIN tidak cocok" });
      return;
    }
    if (newPin === oldPin) {
      setPinMsg({ type: "error", text: "PIN baru harus berbeda dari PIN lama" });
      return;
    }

    setPinLoading(true);
    const { error } = await supabase
      .from("employees")
      .update({ pin: newPin })
      .eq("id", employee.id);

    if (error) {
      setPinMsg({ type: "error", text: "Gagal mengubah PIN" });
      setPinLoading(false);
      return;
    }

    // Update localStorage
    const updated = { ...employee, pin: newPin };
    setEmployee(updated);
    storeEmployee(updated);

    setPinMsg({ type: "success", text: "PIN berhasil diubah!" });
    setPinLoading(false);

    setTimeout(() => {
      setShowChangePin(false);
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      setPinMsg(null);
    }, 1500);
  }

  if (!employee) return null;

  // Check if today is an off day for this employee
  const todayWorkHours = employee && settings ? getEffectiveWorkHours(employee, settings) : null;
  const isOffDay = todayWorkHours?.off === true;

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10" style={{ background: "var(--surface-100)" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/home")}
            className="ico-circ"
            aria-label="Kembali"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="rw-micro" style={{ color: "var(--ink-muted)", letterSpacing: "0.08em" }}>ABSENSI</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push("/riwayat")}
              className="ico-circ"
              title="Riwayat"
            >
              <History size={18} />
            </button>
            <button
              onClick={() => setShowLeaveForm(true)}
              className="ico-circ"
              title="Ajukan Izin"
            >
              <FileText size={18} />
            </button>
            <button
              onClick={() => setShowChangePin(true)}
              className="ico-circ"
              title="Ganti PIN"
            >
              <Key size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="ico-circ"
              title="Keluar"
              style={{ color: "var(--danger)" }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-6 space-y-4">
        {/* Time hero */}
        <div className="text-center py-2">
          <p className="rw-display-xl" style={{ color: "var(--wine)", fontSize: "3rem", lineHeight: 1 }}>
            {format(currentTime, "HH:mm")}
          </p>
          <p className="rw-micro mt-2" style={{ color: "var(--ink-muted)" }}>
            {format(currentTime, "EEEE, dd MMMM yyyy", { locale: idLocale }).toUpperCase()}
          </p>
        </div>

        {/* Today Status */}
        {todayRecord && (
          <div className="rw-card" style={{ padding: "var(--space-4)" }}>
            <p className="rw-micro" style={{ color: "var(--ink-muted)", marginBottom: 8 }}>STATUS HARI INI</p>
            <div className="grid grid-cols-2 gap-3">
              <div style={{ background: "var(--success-tint, #e8f5ed)", borderRadius: "var(--radius-lg)", padding: "12px" }}>
                <p className="rw-micro" style={{ color: "var(--success)" }}>CLOCK IN</p>
                <p style={{ fontWeight: 700, fontSize: 18, color: "var(--success)", marginTop: 2 }}>
                  {todayRecord.clock_in
                    ? format(new Date(todayRecord.clock_in), "HH:mm")
                    : "-"}
                </p>
              </div>
              <div style={{ background: "var(--warning-tint, #fef3e0)", borderRadius: "var(--radius-lg)", padding: "12px" }}>
                <p className="rw-micro" style={{ color: "var(--warning)" }}>CLOCK OUT</p>
                <p style={{ fontWeight: 700, fontSize: 18, color: "var(--warning)", marginTop: 2 }}>
                  {todayRecord.clock_out
                    ? format(new Date(todayRecord.clock_out), "HH:mm")
                    : "-"}
                </p>
              </div>
            </div>
            {todayRecord.status === "late" && (
              <div className="rw-badge rw-badge--danger" style={{ marginTop: 8 }}>
                <AlertTriangle size={12} /> Terlambat
              </div>
            )}
          </div>
        )}

        {/* Attendance Action */}
        {todayRecord?.clock_in && todayRecord?.clock_out ? (
          <div className="rw-card text-center" style={{ padding: "var(--space-6)", border: "2px solid var(--success-tint, #d4edda)" }}>
            <div
              className="mx-auto mb-3"
              style={{
                width: 64, height: 64, borderRadius: "var(--radius-full)",
                background: "var(--success-tint, #e8f5ed)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <CheckCircle size={32} style={{ color: "var(--success)" }} />
            </div>
            <p className="rw-heading" style={{ color: "var(--success)" }}>Absensi Selesai</p>
            <p style={{ fontSize: 14, color: "var(--ink-muted)", marginTop: 4 }}>
              Clock in & clock out hari ini sudah tercatat
            </p>
            <p className="rw-micro" style={{ color: "var(--ink-muted)", marginTop: 8 }}>Sampai jumpa besok!</p>
          </div>
        ) : isOffDay && !todayRecord && !overrideOffDay ? (
          <div className="rw-card text-center" style={{ padding: "var(--space-6)", border: "2px solid var(--wine-tint)" }}>
            <div
              className="mx-auto mb-3"
              style={{
                width: 64, height: 64, borderRadius: "var(--radius-full)",
                background: "var(--wine-tint)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Clock size={32} style={{ color: "var(--wine)" }} />
            </div>
            <p className="rw-heading" style={{ color: "var(--wine)" }}>Hari Libur</p>
            <p style={{ fontSize: 14, color: "var(--ink-muted)", marginTop: 4 }}>
              Hari ini bukan jadwal kerja Anda
            </p>
            <p className="rw-micro" style={{ color: "var(--ink-muted)", marginTop: 8, marginBottom: 16 }}>Selamat beristirahat!</p>
            <button
              onClick={() => setOverrideOffDay(true)}
              className="rw-btn rw-btn--outline"
              style={{ fontSize: 12 }}
            >
              Tetap Absen (Lembur)
            </button>
          </div>
        ) : (
          <div className="rw-card space-y-4" style={{ padding: "var(--space-4)" }}>
            <div className="flex items-center justify-between gap-3">
              <p className="rw-heading" style={{ color: "var(--ink)" }}>
                {mode === "clock_in" ? "Clock In" : "Clock Out"}
              </p>
              {settings && (() => {
                const eff = getEffectiveWorkHours(employee, settings);
                if (eff.off || !eff.start || !eff.end) return null;
                return (
                  <span className="rw-badge rw-badge--wine">
                    <Clock size={10} />
                    {eff.start} – {eff.end}
                  </span>
                );
              })()}
            </div>

            {/* QR Scanner or Camera */}
            {scanningQR && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-8 border-4 rounded-2xl pointer-events-none" style={{ borderColor: "var(--wine)" }}></div>
                  <div className="absolute bottom-3 left-0 right-0 text-center text-white text-xs drop-shadow">
                    Arahkan ke QR Code di kantor
                  </div>
                </div>
                <button
                  onClick={stopQRScan}
                  className="rw-btn rw-btn--outline rw-btn--block"
                >
                  Batal Scan
                </button>
              </div>
            )}

            {qrVerified && !capturedPhoto && (
              <div className="flex items-center gap-2 text-sm" style={{ background: "var(--success-tint, #e8f5ed)", color: "var(--success)", borderRadius: "var(--radius-lg)", padding: 12 }}>
                <CheckCircle size={18} /> QR terverifikasi - lanjutkan foto selfie
              </div>
            )}

            {/* Camera */}
            {!capturedPhoto && !cameraActive && !scanningQR && (
              <div className="space-y-2">
                {settings?.qr_required && !qrVerified && (
                  <button
                    onClick={startQRScan}
                    className="w-full py-12 border-2 border-dashed flex flex-col items-center gap-2 transition"
                    style={{ borderColor: "var(--wine)", color: "var(--wine)", borderRadius: "var(--radius-xl)" }}
                  >
                    <QrCodeIcon size={32} />
                    <span className="font-semibold">Scan QR Code Kantor</span>
                    <span className="rw-micro">Wajib scan QR sebelum foto</span>
                  </button>
                )}
                {(!settings?.qr_required || qrVerified) && (
                  <button
                    onClick={startCamera}
                    className="group w-full py-10 border-2 border-dashed flex flex-col items-center gap-2.5 transition active:scale-[0.99]"
                    style={{ borderColor: "var(--sand)", color: "var(--ink-muted)", borderRadius: "var(--radius-xl)" }}
                  >
                    <div
                      className="flex items-center justify-center transition"
                      style={{ width: 56, height: 56, borderRadius: "var(--radius-full)", background: "var(--wine-tint)" }}
                    >
                      <Camera size={26} style={{ color: "var(--wine)" }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Ambil Foto Selfie</span>
                    <span className="rw-micro">PASTIKAN WAJAH TERLIHAT JELAS</span>
                  </button>
                )}
              </div>
            )}

            {cameraActive && (
              <div>
                <div className="relative overflow-hidden bg-black aspect-[3/4]" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)" }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover camera-mirror"
                  />
                  {/* Dashed silhouette outline */}
                  <div className="absolute inset-0 pointer-events-none">
                    <svg viewBox="0 0 400 600" className="w-full h-full opacity-95 drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                      <path
                        d="M200 60
                           C 140 60, 105 115, 105 180
                           C 105 225, 124 258, 148 274
                           L 148 296
                           C 130 306, 70 320, 30 360
                           L 30 600
                           L 370 600
                           L 370 360
                           C 330 320, 270 306, 252 296
                           L 252 274
                           C 276 258, 295 225, 295 180
                           C 295 115, 260 60, 200 60 Z"
                        stroke="white"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        className="silhouette-dash"
                      />
                    </svg>
                  </div>
                  {/* Hint pill above button */}
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-black/55 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
                    <UserIcon size={12} />
                    Posisikan wajah dalam outline
                  </div>
                  {/* Capture button */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                    <button
                      onClick={capturePhoto}
                      className="rw-btn rw-btn--primary rw-btn--block"
                      style={{ gap: 8 }}
                    >
                      <Camera size={16} /> Ambil Foto
                    </button>
                  </div>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div className="space-y-3">
                <div className="relative overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "2px solid var(--surface-200)", boxShadow: "var(--shadow-md)", background: "var(--surface-300)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedPhoto}
                    alt="Foto"
                    className="w-full"
                  />
                  {/* Verified badge top-right */}
                  <div className="absolute top-3 right-3 rw-badge rw-badge--success" style={{ boxShadow: "var(--shadow-md)" }}>
                    <CheckCircle size={12} />
                    Foto siap
                  </div>
                  {/* Retake floating button */}
                  <button
                    onClick={retakePhoto}
                    className="ico-circ absolute bottom-3 right-3"
                    style={{ width: 40, height: 40, background: "rgba(255,255,255,0.9)", boxShadow: "var(--shadow-md)", backdropFilter: "blur(8px)" }}
                    title="Ulangi foto"
                    aria-label="Ulangi foto"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* GPS Denied - Instructions */}
            {gpsDenied && !location && (
              <div style={{ background: "var(--warning-tint, #fef3e0)", border: "1px solid var(--warning)", borderRadius: "var(--radius-lg)", padding: 12 }} className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} style={{ color: "var(--warning)" }} className="shrink-0 mt-0.5" />
                  <div className="text-sm" style={{ color: "var(--ink)" }}>
                    <p className="font-semibold mb-1">Izin lokasi diperlukan</p>
                    <p className="text-xs">
                      Untuk mengaktifkan:
                    </p>
                    <ol className="text-xs list-decimal list-inside mt-1 space-y-0.5">
                      <li>Klik ikon <strong>gembok/info</strong> di address bar</li>
                      <li>Pilih <strong>Lokasi</strong> / <strong>Location</strong></li>
                      <li>Pilih <strong>Izinkan</strong> / <strong>Allow</strong></li>
                      <li>Refresh halaman ini</li>
                    </ol>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={tryGetLocation}
                    disabled={gpsRetrying}
                    className="rw-btn rw-btn--warning flex-1"
                    style={{ fontSize: 12, padding: "8px 12px" }}
                  >
                    {gpsRetrying ? "Mencoba..." : "Coba Lagi"}
                  </button>
                  <button
                    type="button"
                    onClick={submitWithoutGps}
                    className="rw-btn rw-btn--outline flex-1"
                    style={{ fontSize: 12, padding: "8px 12px" }}
                  >
                    Lanjutkan tanpa GPS
                  </button>
                </div>
              </div>
            )}

            {/* Location Info */}
            {location && (
              <div
                className="flex items-center gap-2 text-sm"
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-lg)",
                  background: isOutsideRadius ? "var(--danger-tint, #fde8e8)" : "var(--success-tint, #e8f5ed)",
                  color: isOutsideRadius ? "var(--danger)" : "var(--success)",
                }}
              >
                <MapPin size={16} />
                {isOutsideRadius ? (
                  <span>
                    {distance && distance < 99999
                      ? `Di luar radius kantor (${distance}m dari kantor)`
                      : "Tanpa GPS - wajib isi keterangan"}
                  </span>
                ) : (
                  <span>
                    Dalam radius kantor ({distance}m dari kantor)
                  </span>
                )}
              </div>
            )}

            {/* Notes (required if outside radius) */}
            {isOutsideRadius && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--danger)" }}>
                  Keterangan (Wajib - di luar radius kantor)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Meeting di luar kantor, WFH, dll."
                  rows={2}
                  className="rw-input"
                  style={{ borderColor: "var(--danger)" }}
                  required
                />
              </div>
            )}

            {!isOutsideRadius && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-muted)" }}>
                  Keterangan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambah catatan..."
                  rows={2}
                  className="rw-input"
                />
              </div>
            )}

            {/* Submit */}
            {capturedPhoto && location && (
              <button
                onClick={handleSubmit}
                disabled={loading || transitioning}
                className="rw-btn rw-btn--primary rw-btn--block"
              >
                {loading
                  ? "Memproses..."
                  : mode === "clock_in"
                  ? "Clock In"
                  : "Clock Out"}
              </button>
            )}
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-lg)",
              fontSize: 14,
              fontWeight: 500,
              background: message.type === "success" ? "var(--success-tint, #e8f5ed)" : "var(--danger-tint, #fde8e8)",
              color: message.type === "success" ? "var(--success)" : "var(--danger)",
            }}
          >
            {message.text}
          </div>
        )}
      </main>
      <BottomNav />

      {/* Leave Request Modal */}
      {showLeaveForm && (
        <div
          className="rw-overlay flex items-end md:items-center justify-center md:p-4"
          onClick={() => !leaveLoading && setShowLeaveForm(false)}
        >
          <div
            className="rw-sheet animate-slide-up overflow-hidden"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div style={{ width: 40, height: 4, borderRadius: "var(--radius-full)", background: "var(--surface-300)" }} />
            </div>

            {/* Header */}
            <div style={{ background: "var(--wine)", padding: "20px 20px 24px" }} className="text-white relative">
              <button
                onClick={() => !leaveLoading && setShowLeaveForm(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)" }}>
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="rw-heading" style={{ color: "#fff" }}>Pengajuan Izin</h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Pilih jenis dan isi detail</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={submitLeave} className="p-5 space-y-4">
              {/* Jenis - visual card selector */}
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 8 }}>
                  JENIS PENGAJUAN
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "izin", label: "Izin", emoji: "📝" },
                    { key: "cuti", label: "Cuti", emoji: "🏖️" },
                    { key: "sakit", label: "Sakit", emoji: "🏥" },
                  ] as const).map((t) => {
                    const isActive = leaveForm.leave_type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setLeaveForm({ ...leaveForm, leave_type: t.key })}
                        className="text-center transition-all"
                        style={{
                          padding: 12,
                          borderRadius: "var(--radius-lg)",
                          background: isActive ? "var(--wine)" : "var(--surface-100)",
                          color: isActive ? "#fff" : "var(--ink-muted)",
                          fontWeight: 600,
                          transform: isActive ? "scale(1.05)" : undefined,
                          boxShadow: isActive ? "var(--shadow-md)" : undefined,
                        }}
                      >
                        <div className="text-2xl">{t.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 8 }}>
                  PERIODE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div style={{ background: "var(--surface-100)", borderRadius: "var(--radius-lg)", padding: 12 }}>
                    <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>DARI</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      style={{ color: "var(--ink)" }}
                      required
                    />
                  </div>
                  <div style={{ background: "var(--surface-100)", borderRadius: "var(--radius-lg)", padding: 12 }}>
                    <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>SAMPAI</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      style={{ color: "var(--ink)" }}
                      required
                    />
                  </div>
                </div>
                {leaveForm.start_date && leaveForm.end_date && (() => {
                  const days = Math.round(
                    (new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  ) + 1;
                  return (
                    <p style={{ fontSize: 11, color: "var(--wine)", fontWeight: 500, marginTop: 6, textAlign: "right" }}>
                      Total: {days} hari
                    </p>
                  );
                })()}
              </div>

              {/* Alasan */}
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 8 }}>
                  ALASAN
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Contoh: Acara keluarga, sakit flu, keperluan mendesak..."
                  className="rw-input"
                  style={{ resize: "none" }}
                  required
                />
              </div>

              {/* Message */}
              {leaveMsg && (
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{
                    padding: 12,
                    borderRadius: "var(--radius-lg)",
                    background: leaveMsg.type === "success" ? "var(--success-tint, #e8f5ed)" : "var(--danger-tint, #fde8e8)",
                    color: leaveMsg.type === "success" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {leaveMsg.type === "success" ? (
                    <CheckCircle size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <span className="flex-1">{leaveMsg.text}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  disabled={leaveLoading}
                  className="rw-btn rw-btn--outline flex-1"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={leaveLoading}
                  className="rw-btn rw-btn--primary"
                  style={{ flex: 2 }}
                >
                  {leaveLoading ? "Mengirim..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePin && (
        <div
          className="rw-overlay flex items-center justify-center p-4"
          onClick={() => !pinLoading && setShowChangePin(false)}
        >
          <div
            className="rw-card w-full max-w-sm"
            style={{ padding: "var(--space-5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="rw-heading flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <Key size={18} /> Ganti PIN
              </h3>
              <button
                onClick={() => !pinLoading && setShowChangePin(false)}
                className="ico-circ"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>PIN LAMA</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  className="rw-input"
                  inputMode="numeric"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>PIN BARU</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="rw-input"
                  inputMode="numeric"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>KONFIRMASI PIN BARU</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="rw-input"
                  inputMode="numeric"
                  required
                />
              </div>
              {pinMsg && (
                <p style={{ fontSize: 14, color: pinMsg.type === "success" ? "var(--success)" : "var(--danger)" }}>
                  {pinMsg.text}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePin(false)}
                  disabled={pinLoading}
                  className="rw-btn rw-btn--outline flex-1"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="rw-btn rw-btn--primary flex-1"
                >
                  {pinLoading ? "Memproses..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smooth transition overlay after successful clock in/out */}
      {transitioning && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto animate-fade-in"
          style={{
            background: "linear-gradient(135deg, var(--wine) 0%, var(--wine-deep) 100%)",
          }}
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center animate-scale-in">
              <CheckCircle size={44} className="text-white" />
            </div>
            <p className="rw-display" style={{ color: "#fff" }}>Berhasil!</p>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 4 }}>Mengarahkan ke beranda...</p>
          </div>
        </div>
      )}
    </div>
  );
}
