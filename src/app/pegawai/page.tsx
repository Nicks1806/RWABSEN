"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee } from "@/lib/types";
import { format } from "date-fns";
import { Search, Phone, Mail, MessageCircle, UserPlus, X, CheckCircle, AlertTriangle } from "lucide-react";
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

  const fetchData = useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [empRes, attRes] = await Promise.all([
      supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .eq("role", "employee")
        .order("name"),
      supabase
        .from("attendance")
        .select("employee_id, clock_in")
        .eq("date", today),
    ]);

    const emps = empRes.data || [];
    setEmployees(emps);

    // Figure out who hasn't clocked in today
    const clockedInIds = new Set(
      (attRes.data || []).filter((a) => a.clock_in).map((a) => a.employee_id)
    );
    const absent = emps.filter((e) => !clockedInIds.has(e.id));
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

    // Realtime
    const channel = supabase
      .channel("pegawai-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.position && e.position.toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q))
    );
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

  function cleanPhone(p: string): string {
    let phone = p.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    else if (!phone.startsWith("62")) phone = "62" + phone;
    return phone;
  }

  const isAdmin = currentUser?.role === "admin";

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-center relative">
          <h1 className="font-bold text-lg">
            Pegawai <span className="text-gray-400 font-medium">{employees.length}</span>
          </h1>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="absolute right-4 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-dark"
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
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari karyawan"
            className="w-full pl-10 pr-4 py-3 rounded-full bg-white border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Tidak Hadir Hari Ini */}
        {absentToday.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">Tidak Hadir Hari ini</h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
              {absentToday.map((emp) => (
                <div key={emp.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                  <Avatar name={emp.name} size="md" />
                  <p className="text-[10px] text-center truncate w-full">{emp.name.split(" ")[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee List */}
        <div className="bg-white rounded-2xl shadow-sm divide-y">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {search ? "Tidak ada yang cocok" : "Belum ada karyawan"}
            </div>
          ) : (
            filtered.map((emp) => (
              <div key={emp.id} className="px-4 py-3 flex items-center gap-3">
                <Avatar name={emp.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{emp.name}</p>
                  {emp.position && (
                    <p className="text-[11px] text-gray-500 truncate">{emp.position}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {emp.phone ? (
                    <a
                      href={`tel:${emp.phone}`}
                      className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50 hover:text-primary transition"
                      title="Telepon"
                    >
                      <Phone size={16} />
                    </a>
                  ) : (
                    <div className="w-9 h-9 rounded-xl border border-gray-100 text-gray-300 flex items-center justify-center">
                      <Phone size={16} />
                    </div>
                  )}
                  {emp.email ? (
                    <a
                      href={`mailto:${emp.email}`}
                      className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50 hover:text-primary transition"
                      title="Email"
                    >
                      <Mail size={16} />
                    </a>
                  ) : (
                    <div className="w-9 h-9 rounded-xl border border-gray-100 text-gray-300 flex items-center justify-center">
                      <Mail size={16} />
                    </div>
                  )}
                  {emp.phone ? (
                    <a
                      href={`https://wa.me/${cleanPhone(emp.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition"
                      title="WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </a>
                  ) : (
                    <div className="w-9 h-9 rounded-xl border border-gray-100 text-gray-300 flex items-center justify-center">
                      <MessageCircle size={16} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add Employee Modal (Admin only) */}
      {showAdd && isAdmin && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !addLoading && setShowAdd(false)}
        >
          <div
            className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="bg-gradient-to-br from-primary to-primary-dark px-5 pt-4 pb-5 text-white relative">
              <button
                onClick={() => !addLoading && setShowAdd(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Tambah Karyawan</h3>
                  <p className="text-xs text-white/80">Buat akun karyawan baru</p>
                </div>
              </div>
            </div>

            <form onSubmit={addEmployee} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Nama karyawan"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PIN *</label>
                <input
                  type="text"
                  value={addForm.pin}
                  onChange={(e) => setAddForm({ ...addForm, pin: e.target.value })}
                  placeholder="6 digit angka"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Posisi</label>
                <input
                  type="text"
                  value={addForm.position}
                  onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
                  placeholder="Contoh: Sales, Kasir"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor HP</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+62..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="email@..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                />
              </div>

              {addMsg && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    addMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {addMsg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{addMsg.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={addLoading}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
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
