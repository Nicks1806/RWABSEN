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
} from "lucide-react";
import jsQR from "jsqr";
import { hasFace, prewarmFaceModels } from "@/lib/faceDetection";
import Logo from "@/components/Logo";
import NotifToggle from "@/components/NotifToggle";

export default function AbsenPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isOutsideRadius, setIsOutsideRadius] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (data && data.clock_in && !data.clock_out) {
      setMode("clock_out");
    } else if (data && data.clock_out) {
      setMode("clock_in"); // already done for today
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
            alert("Akun Anda sudah dinonaktifkan. Hubungi admin.");
            clearEmployee();
            router.push("/");
          }
        }
      });

    supabase.from("settings").select("*").single().then(({ data }) => {
      if (data) setSettings(data);
    });

    // Auto-request permissions if not yet granted
    requestPermissionsIfNeeded();

    // Pre-warm face detection models in background
    prewarmFaceModels();

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

  async function requestPermissionsIfNeeded() {
    // Check camera permission
    let cameraState: PermissionState = "prompt";
    let geoState: PermissionState = "prompt";

    try {
      if (navigator.permissions) {
        const camPerm = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        cameraState = camPerm.state;

        const geoPerm = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        geoState = geoPerm.state;
      }
    } catch {
      // Permissions API not supported - skip silently
      return;
    }

    // If camera not granted yet, trigger permission prompt
    if (cameraState !== "granted") {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach((t) => t.stop());
      } catch {
        // User denied - will need to enable manually
      }
    }

    // If geo not granted yet, trigger permission prompt
    if (geoState !== "granted") {
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
          });
        });
      } catch {
        // User denied or timeout
      }
    }
  }

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

  async function tryGetLocation() {
    setGpsRetrying(true);
    setGpsDenied(false);
    try {
      const pos = await getCurrentPosition();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(loc);
      if (settings) {
        const dist = getDistanceFromLatLng(loc.lat, loc.lng, settings.office_lat, settings.office_lng);
        setDistance(Math.round(dist));
        setIsOutsideRadius(dist > settings.radius_meters);
      }
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
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
    if (isOutsideRadius && !notes.trim()) {
      setMessage({ type: "error", text: "Anda di luar radius kantor. Wajib isi keterangan." });
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
      const base64 = capturedPhoto.split(",")[1];
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
        const [h, m] = workStartStr.split(":").map(Number);
        const workStart = new Date();
        workStart.setHours(h, m, 0, 0);
        if (new Date() > workStart) status = "late";
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
        const [h, m] = workEndStr.split(":").map(Number);
        const workEnd = new Date();
        workEnd.setHours(h, m, 0, 0);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      await new Promise((r) => setTimeout(r, 100));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start scanning loop
      qrScanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
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
    setLeaveLoading(false);
    if (error) {
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

  const alreadyDone = todayRecord?.clock_in && todayRecord?.clock_out;

  // Check if today is an off day for this employee
  const todayWorkHours = employee && settings ? getEffectiveWorkHours(employee, settings) : null;
  const isOffDay = todayWorkHours?.off === true;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push("/riwayat")}
              className="p-2 text-gray-500 hover:text-primary transition"
              title="Riwayat"
            >
              <History size={20} />
            </button>
            <button
              onClick={() => setShowLeaveForm(true)}
              className="p-2 text-gray-500 hover:text-primary transition"
              title="Ajukan Izin"
            >
              <FileText size={20} />
            </button>
            <button
              onClick={() => setShowChangePin(true)}
              className="p-2 text-gray-500 hover:text-primary transition"
              title="Ganti PIN"
            >
              <Key size={20} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-500 transition"
              title="Keluar"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Greeting & Time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-sm">Halo,</p>
          <p className="text-xl font-bold text-gray-800">{employee.name}</p>
          <div className="mt-3 flex items-center gap-2 text-gray-600">
            <Clock size={16} />
            <span className="text-2xl font-mono font-bold text-primary">
              {format(currentTime, "HH:mm:ss")}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {format(currentTime, "EEEE, dd MMMM yyyy", { locale: idLocale })}
          </p>
        </div>

        {/* Push Notif Toggle */}
        {employee && <NotifToggle employeeId={employee.id} />}

        {/* Today Status */}
        {todayRecord && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-2">Status Hari Ini</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600">Clock In</p>
                <p className="font-bold text-green-700">
                  {todayRecord.clock_in
                    ? format(new Date(todayRecord.clock_in), "HH:mm")
                    : "-"}
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs text-orange-600">Clock Out</p>
                <p className="font-bold text-orange-700">
                  {todayRecord.clock_out
                    ? format(new Date(todayRecord.clock_out), "HH:mm")
                    : "-"}
                </p>
              </div>
            </div>
            {todayRecord.status === "late" && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Terlambat
              </p>
            )}
          </div>
        )}

        {/* Attendance Action */}
        {isOffDay && !todayRecord && !overrideOffDay ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center border-2 border-purple-100">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock size={32} className="text-purple-600" />
            </div>
            <p className="font-bold text-purple-700 text-lg">Hari Libur</p>
            <p className="text-sm text-gray-500 mt-1">
              Hari ini bukan jadwal kerja Anda
            </p>
            <p className="text-xs text-gray-400 mt-2 mb-4">Selamat beristirahat!</p>
            <button
              onClick={() => setOverrideOffDay(true)}
              className="text-xs px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
            >
              Tetap Absen (Lembur)
            </button>
          </div>
        ) : alreadyDone ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">
              Absensi hari ini sudah lengkap
            </p>
            <p className="text-sm text-gray-400 mt-1">Sampai jumpa besok!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-700">
              {mode === "clock_in" ? "Clock In" : "Clock Out"}
            </h3>

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
                  <div className="absolute inset-8 border-4 border-primary rounded-2xl pointer-events-none"></div>
                  <div className="absolute bottom-3 left-0 right-0 text-center text-white text-xs drop-shadow">
                    Arahkan ke QR Code di kantor
                  </div>
                </div>
                <button
                  onClick={stopQRScan}
                  className="w-full py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
                >
                  Batal Scan
                </button>
              </div>
            )}

            {qrVerified && !capturedPhoto && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700">
                <CheckCircle size={18} /> QR terverifikasi - lanjutkan foto selfie
              </div>
            )}

            {/* Camera */}
            {!capturedPhoto && !cameraActive && !scanningQR && (
              <div className="space-y-2">
                {settings?.qr_required && !qrVerified && (
                  <button
                    onClick={startQRScan}
                    className="w-full py-12 border-2 border-dashed border-primary rounded-xl flex flex-col items-center gap-2 text-primary hover:bg-primary/5 transition"
                  >
                    <QrCodeIcon size={32} />
                    <span className="font-semibold">Scan QR Code Kantor</span>
                    <span className="text-xs">Wajib scan QR sebelum foto</span>
                  </button>
                )}
                {(!settings?.qr_required || qrVerified) && (
                  <button
                    onClick={startCamera}
                    className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 text-gray-500 hover:border-primary hover:text-primary transition"
                  >
                    <Camera size={32} />
                    <span>Ambil Foto Selfie</span>
                  </button>
                )}
              </div>
            )}

            {cameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full camera-mirror"
                  />
                </div>
                <button
                  onClick={capturePhoto}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition"
                >
                  Ambil Foto
                </button>
              </div>
            )}

            {capturedPhoto && (
              <div className="space-y-3">
                <img
                  src={capturedPhoto}
                  alt="Foto"
                  className="w-full rounded-xl"
                />
                <button
                  onClick={retakePhoto}
                  className="text-sm text-primary underline"
                >
                  Ulangi Foto
                </button>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* GPS Denied - Instructions */}
            {gpsDenied && !location && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
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
                    className="flex-1 py-2 px-3 text-xs bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    {gpsRetrying ? "Mencoba..." : "Coba Lagi"}
                  </button>
                  <button
                    type="button"
                    onClick={submitWithoutGps}
                    className="flex-1 py-2 px-3 text-xs bg-white border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50"
                  >
                    Lanjutkan tanpa GPS
                  </button>
                </div>
              </div>
            )}

            {/* Location Info */}
            {location && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                  isOutsideRadius
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-600"
                }`}
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
                <label className="block text-sm font-medium text-red-600 mb-1">
                  Keterangan (Wajib - di luar radius kantor)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Meeting di luar kantor, WFH, dll."
                  rows={2}
                  className="w-full px-4 py-3 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-400 outline-none transition text-sm"
                  required
                />
              </div>
            )}

            {!isOutsideRadius && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Keterangan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambah catatan..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                />
              </div>
            )}

            {/* Submit */}
            {capturedPhoto && location && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition disabled:opacity-50"
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
            className={`p-4 rounded-xl text-sm font-medium ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}
      </main>

      {/* Leave Request Modal */}
      {showLeaveForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !leaveLoading && setShowLeaveForm(false)}
        >
          <div
            className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle for mobile */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary to-primary-dark px-5 pt-5 pb-6 text-white relative">
              <button
                onClick={() => !leaveLoading && setShowLeaveForm(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pengajuan Izin</h3>
                  <p className="text-xs text-white/80">Pilih jenis dan isi detail</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={submitLeave} className="p-5 space-y-4">
              {/* Jenis - visual card selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Jenis Pengajuan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "izin", label: "Izin", emoji: "📝", color: "purple" },
                    { key: "cuti", label: "Cuti", emoji: "🏖️", color: "blue" },
                    { key: "sakit", label: "Sakit", emoji: "🏥", color: "orange" },
                  ] as const).map((t) => {
                    const active = leaveForm.leave_type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setLeaveForm({ ...leaveForm, leave_type: t.key })}
                        className={`py-3 rounded-xl text-center transition-all ${
                          active
                            ? "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/20"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <div className="text-2xl">{t.emoji}</div>
                        <div className="text-xs font-semibold mt-0.5">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Periode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">DARI</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">SAMPAI</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
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
                    <p className="text-[11px] text-primary font-medium mt-1.5 text-right">
                      Total: {days} hari
                    </p>
                  );
                })()}
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Alasan
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Contoh: Acara keluarga, sakit flu, keperluan mendesak..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition resize-none"
                  required
                />
              </div>

              {/* Message */}
              {leaveMsg && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    leaveMsg.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
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
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={leaveLoading}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition"
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
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !pinLoading && setShowChangePin(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Key size={18} /> Ganti PIN
              </h3>
              <button
                onClick={() => !pinLoading && setShowChangePin(false)}
                className="text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">PIN Lama</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  inputMode="numeric"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">PIN Baru</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  inputMode="numeric"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Konfirmasi PIN Baru</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  inputMode="numeric"
                  required
                />
              </div>
              {pinMsg && (
                <p
                  className={`text-sm ${
                    pinMsg.type === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {pinMsg.text}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePin(false)}
                  disabled={pinLoading}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {pinLoading ? "Memproses..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
