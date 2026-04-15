"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee } from "@/lib/auth";
import { getCurrentPosition, getDistanceFromLatLng } from "@/lib/geo";
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
} from "lucide-react";

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

  const fetchTodayRecord = useCallback(async (empId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", empId)
      .eq("date", today)
      .single();
    setTodayRecord(data || null);
    if (data && data.clock_in && !data.clock_out) {
      setMode("clock_out");
    } else if (data && data.clock_out) {
      setMode("clock_in"); // already done for today
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

    supabase.from("settings").select("*").single().then(({ data }) => {
      if (data) setSettings(data);
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
    try {
      const pos = await getCurrentPosition();
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(loc);
      if (settings) {
        const dist = getDistanceFromLatLng(loc.lat, loc.lng, settings.office_lat, settings.office_lng);
        setDistance(Math.round(dist));
        setIsOutsideRadius(dist > settings.radius_meters);
      }
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      let text = "Gagal mendapatkan lokasi. ";
      if (geoErr?.code === 1) text += "Izin lokasi ditolak - aktifkan di pengaturan browser.";
      else if (geoErr?.code === 2) text += "GPS tidak tersedia - aktifkan GPS & coba di luar ruangan.";
      else if (geoErr?.code === 3) text += "Timeout - sinyal GPS lemah, coba lagi.";
      else text += "Aktifkan GPS dan berikan izin lokasi.";
      setMessage({ type: "error", text });
    }
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

      // Determine status
      let status = "present";
      if (settings && mode === "clock_in") {
        const [h, m] = settings.work_start.split(":").map(Number);
        const workStart = new Date();
        workStart.setHours(h, m, 0, 0);
        if (new Date() > workStart) status = "late";
      }

      if (mode === "clock_in") {
        const { error: insertError } = await supabase.from("attendance").insert({
          employee_id: employee.id,
          date: today,
          clock_in: now,
          clock_in_photo: photoUrl,
          clock_in_lat: location.lat,
          clock_in_lng: location.lng,
          status,
          notes: notes.trim() || null,
        });
        if (insertError) throw insertError;
        setMessage({ type: "success", text: "Clock In berhasil!" });
      } else {
        // Determine early leave
        if (settings) {
          const [h, m] = settings.work_end.split(":").map(Number);
          const workEnd = new Date();
          workEnd.setHours(h, m, 0, 0);
          if (new Date() < workEnd && todayRecord?.status !== "late") {
            status = "early_leave";
          } else if (todayRecord?.status === "late") {
            status = "late";
          }
        }

        const { error: updateError } = await supabase
          .from("attendance")
          .update({
            clock_out: now,
            clock_out_photo: photoUrl,
            clock_out_lat: location.lat,
            clock_out_lng: location.lng,
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

  if (!employee) return null;

  const alreadyDone = todayRecord?.clock_in && todayRecord?.clock_out;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">
              <span className="text-primary">Red</span>
              <span className="text-gray-800">Wine</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/riwayat")}
              className="p-2 text-gray-500 hover:text-primary transition"
              title="Riwayat"
            >
              <History size={20} />
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
        {alreadyDone ? (
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

            {/* Camera */}
            {!capturedPhoto && !cameraActive && (
              <button
                onClick={startCamera}
                className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 text-gray-500 hover:border-primary hover:text-primary transition"
              >
                <Camera size={32} />
                <span>Ambil Foto</span>
              </button>
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
                    Di luar radius kantor ({distance}m dari kantor)
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
    </div>
  );
}
