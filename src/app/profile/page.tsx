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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");

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
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Profile Header */}
      <div
        style={{
          background: "var(--wine)",
          paddingTop: "var(--space-6)",
          paddingBottom: 64,
          color: "var(--on-wine)",
        }}
      >
        <div className="max-w-lg mx-auto px-4">
          <p className="rw-micro text-center" style={{ color: "var(--on-wine)", opacity: 0.7, marginBottom: "var(--space-4)" }}>Profil</p>
          <div className="flex flex-col items-center">
            <div style={{ position: "relative" }}>
              <Avatar
                name={employee.name}
                photoUrl={employee.photo_url}
                size="lg"
                className="ring-4 ring-white/30"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-200)",
                  color: "var(--wine)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-md)",
                  border: "none",
                  cursor: "pointer",
                }}
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
              <p style={{
                fontSize: 12,
                marginTop: "var(--space-2)",
                color: photoMsg.includes("Gagal") || photoMsg.includes("Max") || photoMsg.includes("Harus")
                  ? "var(--danger-tint)"
                  : "var(--success-tint)",
              }}>
                {photoMsg}
              </p>
            )}
            <p style={{ fontSize: 20, fontWeight: 700, marginTop: "var(--space-3)" }}>{employee.name}</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>{employee.position || "Karyawan"}</p>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 pb-28" style={{ marginTop: -40, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Contact info card */}
        <div className="rw-card">
          <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
            <h2 className="rw-heading" style={{ color: "var(--ink)" }}>Informasi Kontak</h2>
            {editing ? (
              <button onClick={() => setEditing(false)} style={{ color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--wine)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <InfoRow icon={<Phone size={16} />} label="Nomor HP">
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+62..."
                  className="rw-input"
                  style={{ minHeight: 36, padding: "6px 12px", fontSize: 14 }}
                />
              ) : (
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{employee.phone || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<Mail size={16} />} label="Email">
              {editing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@..."
                  className="rw-input"
                  style={{ minHeight: 36, padding: "6px 12px", fontSize: 14 }}
                />
              ) : (
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{employee.email || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<MapPin size={16} />} label="Alamat">
              {editing ? (
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="rw-input"
                  style={{ minHeight: "auto", padding: "6px 12px", fontSize: 14, resize: "none" }}
                />
              ) : (
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{employee.address || "-"}</span>
              )}
            </InfoRow>
            <InfoRow icon={<CreditCard size={16} />} label="Nomor Rekening">
              {editing ? (
                <div>
                  <input
                    type="text"
                    value={form.bank_account}
                    onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    placeholder="Contoh: BCA 1234567890 a/n Nama Lengkap"
                    className="rw-input"
                    style={{ minHeight: 36, padding: "6px 12px", fontSize: 14 }}
                  />
                  <p style={{ fontSize: 10, color: "var(--ink-muted)", fontStyle: "italic", marginTop: 4 }}>
                    Dipakai otomatis saat pengajuan reimburse
                  </p>
                </div>
              ) : (
                <span style={{ fontSize: 14, color: "var(--ink)", fontFamily: "var(--font-geist-mono, monospace)" }}>
                  {employee.bank_account || "-"}
                </span>
              )}
            </InfoRow>
          </div>
          {editing && (
            <button
              onClick={saveProfile}
              disabled={saving}
              className="rw-btn rw-btn--primary rw-btn--block rw-btn--sm"
              style={{ marginTop: "var(--space-3)" }}
            >
              <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          )}
          {msg && (
            <p style={{
              fontSize: 12,
              marginTop: "var(--space-2)",
              color: msg === "Tersimpan!" ? "var(--success)" : "var(--danger)",
            }}>
              {msg}
            </p>
          )}
        </div>

        {/* Work info */}
        <div className="rw-card">
          <h2 className="rw-heading" style={{ color: "var(--ink)", marginBottom: "var(--space-3)" }}>Informasi Kerja</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <InfoRow icon={<Briefcase size={16} />} label="Posisi">
              <span style={{ fontSize: 14, color: "var(--ink)" }}>{employee.position || "-"}</span>
            </InfoRow>
            <InfoRow icon={<Calendar size={16} />} label="Bergabung">
              <span style={{ fontSize: 14, color: "var(--ink)" }}>
                {employee.join_date
                  ? format(new Date(employee.join_date), "dd MMM yyyy", { locale: idLocale })
                  : "-"}
              </span>
            </InfoRow>
          </div>
          {/* Schedule */}
          {employee.schedule && Object.keys(employee.schedule).length > 0 ? (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--line)" }}>
              <p className="rw-micro" style={{ marginBottom: "var(--space-2)" }}>Jadwal Minggu Ini</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {DAY_ORDER.map((day) => {
                  const s = employee.schedule?.[day];
                  const isOff = s?.off;
                  const hasCustom = s?.start && s?.end;
                  return (
                    <div key={day} className="flex justify-between" style={{ fontSize: 13 }}>
                      <span style={{ color: "var(--ink-muted)" }}>{DAY_LABELS[day]}</span>
                      <span style={{ color: isOff ? "var(--wine)" : "var(--ink)", fontWeight: isOff ? 500 : 400 }}>
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
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Jam kerja:{" "}
                <span style={{ fontWeight: 600, color: "var(--wine)" }}>
                  {employee.work_start.slice(0, 5)} - {employee.work_end?.slice(0, 5)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Notifications */}
        <NotifToggle employeeId={employee.id} />

        {/* Settings */}
        <div className="rw-card" style={{ padding: 0, overflow: "hidden" }}>
          <button
            onClick={() => setShowPin(true)}
            style={{
              width: "100%",
              padding: "var(--space-4) var(--space-5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--line)",
              background: "none",
              border: "none",
              borderBottomWidth: 1,
              borderBottomStyle: "solid",
              borderBottomColor: "var(--line)",
              cursor: "pointer",
            }}
          >
            <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "var(--wine-tint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--wine)",
                }}
              >
                <Key size={16} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Ganti PIN</span>
            </div>
            <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} />
          </button>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "var(--space-4) var(--space-5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger-tint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--danger)",
                }}
              >
                <LogOut size={16} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--danger)" }}>Keluar</span>
            </div>
            <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} />
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--ink-muted)", paddingTop: "var(--space-2)" }}>
          RedWine Attendance • v1.0
        </p>
      </main>

      {/* Change PIN Modal */}
      {showPin && (
        <div
          className="rw-overlay"
          onClick={() => !pinLoading && setShowPin(false)}
        >
          <div
            className="rw-card animate-slide-up"
            style={{
              width: "100%",
              maxWidth: 384,
              margin: "0 var(--space-4)",
              padding: "var(--space-5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
              <h3 className="rw-heading flex items-center" style={{ gap: 8, color: "var(--ink)" }}>
                <Key size={18} /> Ganti PIN
              </h3>
              <button
                onClick={() => setShowPin(false)}
                className="ico-circ"
                style={{ width: 32, height: 32, color: "var(--ink-muted)", background: "var(--surface-100)", border: "none" }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleChangePin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <InputField label="PIN Lama" value={oldPin} onChange={setOldPin} />
              <InputField label="PIN Baru" value={newPin} onChange={setNewPin} />
              <InputField label="Konfirmasi PIN" value={confirmPin} onChange={setConfirmPin} />
              {pinMsg && (
                <p style={{
                  fontSize: 13,
                  color: pinMsg.type === "success" ? "var(--success)" : "var(--danger)",
                }}>
                  {pinMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pinLoading}
                className="rw-btn rw-btn--primary rw-btn--block"
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
    <div className="flex items-start" style={{ gap: "var(--space-3)" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-muted)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="rw-micro" style={{ marginBottom: 2 }}>{label}</p>
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
      <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-1)" }}>{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        required
        className="rw-input"
        style={{ minHeight: 40, fontSize: 14 }}
      />
    </div>
  );
}
