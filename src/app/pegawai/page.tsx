"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee } from "@/lib/types";
import { format } from "date-fns";
import { Search, Phone, Mail, MessageCircle, UserPlus, X, CheckCircle, AlertTriangle, Shield, UserCircle2, Settings2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";

export default function PegawaiPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [absentToday, setAbsentToday] = useState<Employee[]>([]);

  // Admin add employee
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", pin: "", phone: "", email: "", position: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Admin change role
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);

  const fetchData = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [empRes, attRes] = await Promise.all([
      supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("attendance")
        .select("employee_id, clock_in")
        .eq("date", today),
    ]);

    const emps = empRes.data || [];
    setEmployees(emps);

    // Figure out who hasn't clocked in today (employee role only, not admin)
    const clockedInIds = new Set(
      (attRes.data || []).filter((a) => a.clock_in).map((a) => a.employee_id)
    );
    const absent = emps.filter((e) => e.role === "employee" && !clockedInIds.has(e.id));
    setAbsentToday(absent);
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) {
      router.push("/");
      return;
    }
    setCurrentUser(emp);
    fetchData();

    // Realtime with debounce (coalesce rapid events)
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchData(), 500);
    };

    const channel = supabase
      .channel("pegawai-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, triggerRefetch)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? employees.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.position && e.position.toLowerCase().includes(q)) ||
            (e.phone && e.phone.includes(q))
        )
      : employees;
    // Sort admin first, then by name
    return [...base].sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [employees, search]);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    if (!addForm.name.trim() || !addForm.pin.trim()) {
      setAddMsg({ type: "error", text: "Nama & PIN wajib" });
      return;
    }
    setAddLoading(true);
    const { error } = await supabase.from("employees").insert({
      name: addForm.name.trim(),
      pin: addForm.pin.trim(),
      role: "employee",
      phone: addForm.phone || null,
      email: addForm.email || null,
      position: addForm.position || null,
      is_active: true,
    });
    setAddLoading(false);
    if (error) {
      setAddMsg({ type: "error", text: error.message });
      return;
    }
    setAddMsg({ type: "success", text: "Karyawan ditambahkan!" });
    setTimeout(() => {
      setShowAdd(false);
      setAddForm({ name: "", pin: "", phone: "", email: "", position: "" });
      setAddMsg(null);
      fetchData();
    }, 1000);
  }

  async function changeRole(emp: Employee, newRole: "admin" | "employee") {
    await supabase.from("employees").update({ role: newRole }).eq("id", emp.id);
    setRoleTarget(null);
    fetchData();
  }

  function cleanPhone(p: string): string {
    let phone = p.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    else if (!phone.startsWith("62")) phone = "62" + phone;
    return phone;
  }

  const isAdmin = currentUser?.role === "admin";

  if (!currentUser) return null;

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10" style={{ background: "var(--surface-100)" }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-center relative">
          <h1 className="rw-heading" style={{ color: "var(--ink)" }}>
            Karyawan <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>{employees.length}</span>
          </h1>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="absolute right-4 flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: "var(--radius-full)",
                background: "var(--wine)", color: "var(--on-wine)",
                boxShadow: "var(--shadow-md)",
              }}
              title="Tambah Karyawan"
            >
              <UserPlus size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari karyawan"
            className="rw-input"
            style={{ paddingLeft: 40, borderRadius: "var(--radius-full)" }}
          />
        </div>

        {/* Tidak Hadir Hari Ini */}
        {absentToday.length > 0 && (
          <div className="rw-card" style={{ padding: "var(--space-4)" }}>
            <p className="rw-heading" style={{ color: "var(--ink)", marginBottom: 12 }}>Tidak Hadir Hari ini</p>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
              {absentToday.map((emp) => (
                <div key={emp.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                  <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                  <p className="text-center truncate w-full" style={{ fontSize: 10, color: "var(--ink)" }}>{emp.name.split(" ")[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee List */}
        <div className="rw-card" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: "var(--ink-muted)", fontSize: 14 }}>
              {search ? "Tidak ada yang cocok" : "Belum ada karyawan"}
            </div>
          ) : (
            filtered.map((emp, i) => (
              <div
                key={emp.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{emp.name}</p>
                  {emp.position && (
                    <p className="truncate" style={{ fontSize: 11, color: "var(--ink-muted)" }}>{emp.position}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {emp.phone ? (
                    <a
                      href={`tel:${emp.phone}`}
                      className="ico-circ"
                      style={{ width: 36, height: 36, border: "1px solid var(--line)" }}
                      title="Telepon"
                    >
                      <Phone size={16} />
                    </a>
                  ) : (
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: "var(--radius-lg)", border: "1px solid var(--surface-300)", color: "var(--line)" }}
                    >
                      <Phone size={16} />
                    </div>
                  )}
                  {emp.phone ? (
                    <a
                      href={`https://wa.me/${cleanPhone(emp.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ico-circ"
                      style={{ width: 36, height: 36, border: "1px solid var(--line)" }}
                      title="WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </a>
                  ) : (
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: "var(--radius-lg)", border: "1px solid var(--surface-300)", color: "var(--line)" }}
                    >
                      <MessageCircle size={16} />
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setRoleTarget(emp)}
                      className="flex items-center justify-center transition"
                      style={{
                        width: 36, height: 36, borderRadius: "var(--radius-lg)",
                        background: "var(--wine-tint)", color: "var(--wine)",
                      }}
                      title="Ubah Role"
                    >
                      <Settings2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Change Role Modal (Admin only) */}
      {roleTarget && isAdmin && (
        <div
          className="rw-overlay flex items-center justify-center p-4"
          onClick={() => setRoleTarget(null)}
        >
          <div
            className="rw-card w-full max-w-sm animate-slide-up"
            style={{ padding: "var(--space-5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar name={roleTarget.name} photoUrl={roleTarget.photo_url} size="md" />
                <div>
                  <p style={{ fontWeight: 700, color: "var(--ink)" }}>{roleTarget.name}</p>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>Ubah Role / Hak Akses</p>
                </div>
              </div>
              <button onClick={() => setRoleTarget(null)} className="ico-circ">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => changeRole(roleTarget, "employee")}
                className="w-full px-4 py-3 text-left transition"
                style={{
                  borderRadius: "var(--radius-lg)",
                  border: `2px solid ${roleTarget.role === "employee" ? "var(--wine)" : "var(--line)"}`,
                  background: roleTarget.role === "employee" ? "var(--wine-tint)" : "transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-300)" }}>
                    <UserCircle2 size={18} style={{ color: "var(--ink-muted)" }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Karyawan</p>
                    <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>Clock in/out, pengajuan cuti</p>
                  </div>
                  {roleTarget.role === "employee" && (
                    <CheckCircle size={18} style={{ color: "var(--wine)" }} />
                  )}
                </div>
              </button>

              <button
                onClick={() => changeRole(roleTarget, "admin")}
                className="w-full px-4 py-3 text-left transition"
                style={{
                  borderRadius: "var(--radius-lg)",
                  border: `2px solid ${roleTarget.role === "admin" ? "var(--wine)" : "var(--line)"}`,
                  background: roleTarget.role === "admin" ? "var(--wine-tint)" : "transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--wine-tint)" }}>
                    <Shield size={18} style={{ color: "var(--wine)" }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Admin</p>
                    <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                      Kelola karyawan, approve pengajuan, dashboard
                    </p>
                  </div>
                  {roleTarget.role === "admin" && (
                    <CheckCircle size={18} style={{ color: "var(--wine)" }} />
                  )}
                </div>
              </button>
            </div>

            <div style={{ fontSize: 10, color: "var(--warning)", background: "var(--warning-tint)", borderRadius: "var(--radius-sm)", padding: 8, marginTop: 12 }}>
              Admin punya akses penuh ke semua data karyawan, jam kerja, absensi, dll.
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal (Admin only) */}
      {showAdd && isAdmin && (
        <div
          className="rw-overlay flex items-end md:items-center justify-center md:p-4"
          onClick={() => !addLoading && setShowAdd(false)}
        >
          <div
            className="rw-sheet animate-slide-up max-h-[92vh] overflow-y-auto"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 z-10" style={{ background: "var(--surface-200)" }}>
              <div style={{ width: 40, height: 4, borderRadius: "var(--radius-full)", background: "var(--surface-300)" }} />
            </div>
            <div style={{ background: "var(--wine)", padding: "16px 20px 20px" }} className="text-white relative">
              <button
                onClick={() => !addLoading && setShowAdd(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)" }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="rw-heading" style={{ color: "#fff" }}>Tambah Karyawan</h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Buat akun karyawan baru</p>
                </div>
              </div>
            </div>

            <form onSubmit={addEmployee} className="p-5 space-y-3">
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>NAMA *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Nama karyawan" className="rw-input" required />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>PIN *</label>
                <input type="text" value={addForm.pin} onChange={(e) => setAddForm({ ...addForm, pin: e.target.value })} placeholder="6 digit angka" className="rw-input font-mono" required />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>POSISI</label>
                <input type="text" value={addForm.position} onChange={(e) => setAddForm({ ...addForm, position: e.target.value })} placeholder="Contoh: Sales, Kasir" className="rw-input" />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>NOMOR HP</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="+62..." className="rw-input" />
              </div>
              <div>
                <label className="rw-micro" style={{ display: "block", color: "var(--ink-muted)", marginBottom: 4 }}>EMAIL</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@..." className="rw-input" />
              </div>

              {addMsg && (
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{
                    padding: 12,
                    borderRadius: "var(--radius-lg)",
                    background: addMsg.type === "success" ? "var(--success-tint)" : "var(--danger-tint)",
                    color: addMsg.type === "success" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {addMsg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{addMsg.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} disabled={addLoading} className="rw-btn rw-btn--outline flex-1">
                  Batal
                </button>
                <button type="submit" disabled={addLoading} className="rw-btn rw-btn--primary" style={{ flex: 2 }}>
                  {addLoading ? "Menyimpan..." : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
