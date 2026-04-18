"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee, storeEmployee } from "@/lib/auth";
import { Employee } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Phone,
  Mail,
  Briefcase,
  MapPin,
  Calendar,
  Key,
  LogOut,
  ChevronRight,
  Edit3,
  Save,
  X,
  Camera,
  Loader2,
  CreditCard,
} from "lucide-react";
import { useRef } from "react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import NotifToggle from "@/components/NotifToggle";
import { getEffectiveWorkHours, DAY_LABELS, DAY_ORDER } from "@/lib/workHours";

export default function ProfilePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: "", email: "", address: "", bank_account: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");

  // Change PIN
  const [showPin, setShowPin] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) {
      router.push("/");
      return;
    }
    if (emp.role === "admin") {
      router.push("/admin");
      return;
    }

    // Fetch fresh data
    supabase
      .from("employees")
      .select("*")
      .eq("id", emp.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmployee(data);
          storeEmployee(data);
          setForm({
            phone: data.phone || "",
            email: data.email || "",
            address: data.address || "",
            bank_account: data.bank_account || "",
          });
        }
      });
  }, [router]);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    if (!file.type.startsWith("image/")) {
      setPhotoMsg("Harus gambar!");
      setTimeout(() => setPhotoMsg(""), 2000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg("Max 5MB");
      setTimeout(() => setPhotoMsg(""), 2000);
      return;
    }

    setUploadingPhoto(true);
    setPhotoMsg("");

    try {
      const compressedBlob = await compressImage(file, 400);
      const filename = `profile/${employee.id}-${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("attendance-photos")
        .upload(filename, compressedBlob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
      const photoUrl = urlData.publicUrl;
      await supabase.from("employees").update({ photo_url: photoUrl }).eq("id", employee.id);

      const updated = { ...employee, photo_url: photoUrl };
      setEmployee(updated);
      storeEmployee(updated);
      setPhotoMsg("Foto diupdate!");
    } catch (err) {
      console.error(err);
      setPhotoMsg("Gagal: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setUploadingPhoto(false);
      setTimeout(() => setPhotoMsg(""), 2500);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function compressImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas error");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject("Blob error")), "image/jpeg", 0.85);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function saveProfile() {
    if (!employee) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("employees")
      .update({
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        bank_account: form.bank_account || null,
      })
      .eq("id", employee.id);
    if (error) {
      setMsg("Gagal menyimpan");
    } else {
      setMsg("Tersimpan!");
      const updated = { ...employee, ...form };
      setEmployee(updated);
      storeEmployee(updated);
      setEditing(false);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 2000);
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
    setPinLoading(true);
    const { error } = await supabase.from("employees").update({ pin: newPin }).eq("id", employee.id);
    if (error) {
      setPinMsg({ type: "error", text: "Gagal" });
      setPinLoading(false);
      return;
    }
    const updated = { ...employee, pin: newPin };
    setEmployee(updated);
    storeEmployee(updated);
    setPinMsg({ type: "success", text: "PIN berhasil diubah!" });
    setPinLoading(false);
    setTimeout(() => {
      setShowPin(false);
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      setPinMsg(null);
    }, 1200);
  }

  function handleLogout() {
    if (!confirm("Yakin keluar?")) return;
    clearEmployee();
    router.push("/");
  }

  if (!employee) return null;

  const eff = getEffectiveWorkHours(employee, null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-16 text-white">
        <div className="max-w-lg mx-auto px-4">
          <h1 className="text-center font-bold text-lg mb-4">Akun Saya</h1>
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar
                name={employee.name}
                photoUrl={employee.photo_url}
                size="lg"
                className="ring-4 ring-white/30"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shadow-lg hover:bg-gray-50 disabled:opacity-50"
                title="Ubah foto"
              >
                {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={uploadPhoto}
                className="hidden"
              />
            </div>
            {photoMsg && (
              <p
                className={`text-xs mt-2 ${
                  photoMsg.includes("Gagal") || photoMsg.includes("Max") || photoMsg.includes("Harus")
                    ? "text-red-200"
                    : "text-green-200"
                }`}
              >
                {photoMsg}
              </p>
            )}
            <p className="text-xl font-bold mt-3">{employee.name}</p>
            <p className="text-sm text-white/80">{employee.position || "Karyawan"}</p>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 -mt-10 space-y-4">
        {/* Contact info card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Informasi Kontak</h2>
            {editing ? (
              <button onClick={() => setEditing(false)} className="text-gray-400">
                <X size={18} />
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-primary font-medium"
              >
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>
          <div className="space-y-3">
            <InfoRow icon={<Phone size={16} />} label="Nomor HP">
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+62..."
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <span className="text-sm text-gray-700">{employee.phone || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<Mail size={16} />} label="Email">
              {editing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@..."
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <span className="text-sm text-gray-700">{employee.email || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<MapPin size={16} />} label="Alamat">
              {editing ? (
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <span className="text-sm text-gray-700">{employee.address || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<CreditCard size={16} />} label="Nomor Rekening">
              {editing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={form.bank_account}
                    onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    placeholder="Contoh: BCA 1234567890 a/n Nama Lengkap"
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[10px] text-gray-400 italic">Dipakai otomatis saat pengajuan reimburse</p>
                </div>
              ) : (
                <span className="text-sm text-gray-700 font-mono">{employee.bank_account || "-"}</span>
              )}
            </InfoRow>
          </div>
          {editing && (
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full mt-3 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-dark inline-flex items-center justify-center gap-1"
            >
              <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          )}
          {msg && (
            <p className={`text-xs mt-2 ${msg === "Tersimpan!" ? "text-green-600" : "text-red-600"}`}>{msg}</p>
          )}
        </div>

        {/* Work info */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Informasi Kerja</h2>
          <div className="space-y-3">
            <InfoRow icon={<Briefcase size={16} />} label="Posisi">
              <span className="text-sm text-gray-700">{employee.position || "-"}</span>
            </InfoRow>
            <InfoRow icon={<Calendar size={16} />} label="Bergabung">
              <span className="text-sm text-gray-700">
                {employee.join_date
                  ? format(new Date(employee.join_date), "dd MMM yyyy", { locale: idLocale })
                  : "-"}
              </span>
            </InfoRow>
          </div>
          {/* Schedule */}
          {employee.schedule && Object.keys(employee.schedule).length > 0 ? (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-semibold text-gray-700 mb-2">Jadwal Minggu Ini</p>
              <div className="space-y-1">
                {DAY_ORDER.map((day) => {
                  const s = employee.schedule?.[day];
                  const isOff = s?.off;
                  const hasCustom = s?.start && s?.end;
                  return (
                    <div key={day} className="flex justify-between text-xs">
                      <span className="text-gray-500">{DAY_LABELS[day]}</span>
                      <span className={isOff ? "text-purple-600 font-medium" : "text-gray-700"}>
                        {isOff
                          ? "Libur"
                          : hasCustom
                          ? `${s.start} - ${s.end}`
                          : employee.work_start && employee.work_end
                          ? `${employee.work_start.slice(0, 5)} - ${employee.work_end.slice(0, 5)}`
                          : "Default"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : employee.work_start ? (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-gray-500">
                Jam kerja:{" "}
                <span className="font-semibold text-primary">
                  {employee.work_start.slice(0, 5)} - {employee.work_end?.slice(0, 5)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Notifications */}
        <NotifToggle employeeId={employee.id} />

        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowPin(true)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 border-b"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <Key size={16} className="text-blue-600" />
              </div>
              <span className="text-sm font-medium">Ganti PIN</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                <LogOut size={16} className="text-red-600" />
              </div>
              <span className="text-sm font-medium text-red-600">Keluar</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-400 pt-2">
          RedWine Attendance • v1.0
        </p>
      </main>

      {/* Change PIN Modal */}
      {showPin && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => !pinLoading && setShowPin(false)}
        >
          <div
            className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Key size={18} /> Ganti PIN
              </h3>
              <button onClick={() => setShowPin(false)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePin} className="space-y-3">
              <InputField label="PIN Lama" value={oldPin} onChange={setOldPin} />
              <InputField label="PIN Baru" value={newPin} onChange={setNewPin} />
              <InputField label="Konfirmasi PIN" value={confirmPin} onChange={setConfirmPin} />
              {pinMsg && (
                <p className={`text-sm ${pinMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {pinMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pinLoading}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {pinLoading ? "Memproses..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
