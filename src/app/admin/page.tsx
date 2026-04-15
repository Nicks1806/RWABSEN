"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee } from "@/lib/auth";
import { Employee, Attendance, Settings } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  LogOut,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  Settings as SettingsIcon,
  MapPin,
  Image as ImageIcon,
  X,
  Trash2,
  Key,
  Filter,
  Bell,
  Eye,
  EyeOff,
  Clock3,
} from "lucide-react";
import * as XLSX from "xlsx";
import Logo from "@/components/Logo";
import { getEffectiveWorkHours } from "@/lib/workHours";

type Tab = "dashboard" | "karyawan" | "settings";

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    office_lat: "",
    office_lng: "",
    radius_meters: "",
    work_start: "",
    work_end: "",
  });
  const [settingsMsg, setSettingsMsg] = useState("");

  // Employee form
  const [newEmployee, setNewEmployee] = useState({ name: "", pin: "" });
  const [empMsg, setEmpMsg] = useState("");

  // Reset PIN modal
  const [resetPinEmp, setResetPinEmp] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState("");
  const [resetPinMsg, setResetPinMsg] = useState("");
  const [showPins, setShowPins] = useState(false);

  // Edit work hours modal
  const [editHoursEmp, setEditHoursEmp] = useState<Employee | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editHoursMsg, setEditHoursMsg] = useState("");

  // Filters for Detail Absensi
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const date = new Date(month + "-01");
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");

    const [empRes, attRes, setRes] = await Promise.all([
      supabase.from("employees").select("*").eq("is_active", true).order("name"),
      supabase
        .from("attendance")
        .select("*, employees(name)")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false }),
      supabase.from("settings").select("*").single(),
    ]);

    setEmployees(empRes.data || []);
    setRecords(attRes.data || []);
    if (setRes.data) {
      setSettings(setRes.data);
      setSettingsForm({
        office_lat: String(setRes.data.office_lat),
        office_lng: String(setRes.data.office_lng),
        radius_meters: String(setRes.data.radius_meters),
        work_start: setRes.data.work_start,
        work_end: setRes.data.work_end,
      });
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role !== "admin") {
      router.push("/");
      return;
    }
    setAdmin(emp);
  }, [router]);

  useEffect(() => {
    if (admin) fetchData();
  }, [admin, fetchData]);

  // Realtime subscription for attendance
  useEffect(() => {
    if (!admin) return;
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin, fetchData]);

  // Auto-refresh every 30s as fallback
  useEffect(() => {
    if (!admin) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [admin, fetchData]);

  // Stats
  const today = format(new Date(), "yyyy-MM-dd");
  const todayRecords = records.filter((r) => r.date === today);
  const totalEmployees = employees.filter((e) => e.role === "employee").length;
  const presentToday = todayRecords.filter((r) => r.clock_in).length;
  const lateToday = todayRecords.filter((r) => r.status === "late").length;

  // Per-employee monthly hours
  function getMonthlyHours(empId: string): number {
    let total = 0;
    for (const r of records) {
      if (r.employee_id === empId && r.clock_in && r.clock_out) {
        const diff = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
        total += diff / (1000 * 60 * 60);
      }
    }
    return Math.round(total * 10) / 10;
  }

  // Export Excel
  function exportExcel() {
    const data = records.map((r) => ({
      Tanggal: format(new Date(r.date), "dd/MM/yyyy"),
      Nama: (r as Attendance & { employees?: { name: string } }).employees?.name || "-",
      "Clock In": r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-",
      "Clock Out": r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-",
      Status:
        r.status === "present"
          ? "Hadir"
          : r.status === "late"
          ? "Terlambat"
          : r.status === "early_leave"
          ? "Pulang Awal"
          : "Tidak Hadir",
      Keterangan: r.notes || "-",
      "Lat Masuk": r.clock_in_lat || "-",
      "Lng Masuk": r.clock_in_lng || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Absensi_RedWine_${month}.xlsx`);
  }

  // Save settings
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const { error } = await supabase
      .from("settings")
      .update({
        office_lat: parseFloat(settingsForm.office_lat),
        office_lng: parseFloat(settingsForm.office_lng),
        radius_meters: parseInt(settingsForm.radius_meters),
        work_start: settingsForm.work_start,
        work_end: settingsForm.work_end,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSettingsMsg(error ? "Gagal menyimpan" : "Tersimpan!");
    if (!error) fetchData();
    setTimeout(() => setSettingsMsg(""), 3000);
  }

  // Add employee
  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmployee.name.trim() || !newEmployee.pin.trim()) return;
    const { error } = await supabase.from("employees").insert({
      name: newEmployee.name.trim(),
      pin: newEmployee.pin.trim(),
      role: "employee",
    });
    setEmpMsg(error ? "Gagal menambah karyawan" : "Karyawan ditambahkan!");
    if (!error) {
      setNewEmployee({ name: "", pin: "" });
      fetchData();
    }
    setTimeout(() => setEmpMsg(""), 3000);
  }

  // Toggle employee active
  async function toggleEmployee(id: string, isActive: boolean) {
    await supabase.from("employees").update({ is_active: !isActive }).eq("id", id);
    fetchData();
  }

  // Delete attendance record
  async function deleteAttendance(id: string) {
    if (!confirm("Yakin ingin menghapus data absensi ini?")) return;
    await supabase.from("attendance").delete().eq("id", id);
    fetchData();
  }

  // Reset PIN
  async function resetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPinEmp || !newPin.trim()) return;
    const { error } = await supabase
      .from("employees")
      .update({ pin: newPin.trim() })
      .eq("id", resetPinEmp.id);
    setResetPinMsg(error ? "Gagal mengubah PIN" : "PIN berhasil diubah!");
    if (!error) {
      setTimeout(() => {
        setResetPinEmp(null);
        setNewPin("");
        setResetPinMsg("");
        fetchData();
      }, 1200);
    }
  }

  // Save work hours per employee
  async function saveWorkHours(e: React.FormEvent) {
    e.preventDefault();
    if (!editHoursEmp) return;
    const { error } = await supabase
      .from("employees")
      .update({
        work_start: editStart || null,
        work_end: editEnd || null,
      })
      .eq("id", editHoursEmp.id);
    setEditHoursMsg(error ? "Gagal menyimpan" : "Jam kerja tersimpan!");
    if (!error) {
      setTimeout(() => {
        setEditHoursEmp(null);
        setEditHoursMsg("");
        fetchData();
      }, 1200);
    }
  }

  // Filtered records for Detail Absensi
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterEmployee !== "all" && r.employee_id !== filterEmployee) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterEmployee, filterStatus]);

  // Late clock-in notification: employees who should have clocked in but haven't (per-employee hours)
  const lateClockIn = useMemo(() => {
    if (!settings) return [];
    const now = new Date();
    const clockedInIds = new Set(todayRecords.filter((r) => r.clock_in).map((r) => r.employee_id));

    return employees.filter((emp) => {
      if (emp.role !== "employee") return false;
      if (clockedInIds.has(emp.id)) return false;

      const { start, end } = getEffectiveWorkHours(emp, settings);
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const workStart = new Date();
      workStart.setHours(sh, sm, 0, 0);
      const workEnd = new Date();
      workEnd.setHours(eh, em, 0, 0);

      return now >= workStart && now <= workEnd;
    });
  }, [settings, employees, todayRecords]);

  function handleLogout() {
    clearEmployee();
    router.push("/");
  }

  if (!admin) return null;

  const statusBadge: Record<string, { text: string; color: string }> = {
    present: { text: "Hadir", color: "bg-green-100 text-green-700" },
    late: { text: "Terlambat", color: "bg-red-100 text-red-700" },
    early_leave: { text: "Pulang Awal", color: "bg-yellow-100 text-yellow-700" },
    absent: { text: "Tidak Hadir", color: "bg-gray-100 text-gray-700" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2">Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[52px] z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {[
            { key: "dashboard" as Tab, label: "Dashboard", icon: <Clock size={16} /> },
            { key: "karyawan" as Tab, label: "Karyawan", icon: <Users size={16} /> },
            { key: "settings" as Tab, label: "Pengaturan", icon: <SettingsIcon size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat data...</div>
        ) : (
          <>
            {/* DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Late Clock-In Notification */}
                {lateClockIn.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-red-700 mb-2">
                      <Bell size={18} />
                      <h3 className="font-semibold">
                        Belum Clock In ({lateClockIn.length})
                      </h3>
                    </div>
                    <p className="text-xs text-red-600 mb-2">
                      Karyawan yang belum absen hari ini setelah jam kerja dimulai
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lateClockIn.map((emp) => (
                        <span
                          key={emp.id}
                          className="bg-white text-red-700 text-xs px-3 py-1 rounded-full border border-red-300"
                        >
                          {emp.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Users size={18} />
                      <span className="text-xs font-medium">Total Karyawan</span>
                    </div>
                    <p className="text-2xl font-bold">{totalEmployees}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <CheckCircle size={18} />
                      <span className="text-xs font-medium">Hadir Hari Ini</span>
                    </div>
                    <p className="text-2xl font-bold">{presentToday}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <AlertTriangle size={18} />
                      <span className="text-xs font-medium">Terlambat</span>
                    </div>
                    <p className="text-2xl font-bold">{lateToday}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Clock size={18} />
                      <span className="text-xs font-medium">Belum Hadir</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {totalEmployees - presentToday}
                    </p>
                  </div>
                </div>

                {/* Month Selector + Export */}
                <div className="flex items-center justify-between">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={exportExcel}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                  >
                    <Download size={16} /> Export Excel
                  </button>
                </div>

                {/* Monthly Hours Summary */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-700">
                      Jam Kerja Bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
                    </h3>
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Hadir</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Terlambat</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Total Jam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {employees
                          .filter((e) => e.role === "employee")
                          .map((emp) => {
                            const empRecords = records.filter((r) => r.employee_id === emp.id);
                            const presentCount = empRecords.filter((r) => r.clock_in).length;
                            const lateCount = empRecords.filter((r) => r.status === "late").length;
                            return (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{emp.name}</td>
                                <td className="px-4 py-3 text-center">{presentCount}</td>
                                <td className="px-4 py-3 text-center text-red-600">{lateCount}</td>
                                <td className="px-4 py-3 text-center font-semibold text-primary">
                                  {getMonthlyHours(emp.id)} jam
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Cards for Monthly Hours */}
                  <div className="md:hidden divide-y">
                    {employees
                      .filter((e) => e.role === "employee")
                      .map((emp) => {
                        const empRecords = records.filter((r) => r.employee_id === emp.id);
                        const presentCount = empRecords.filter((r) => r.clock_in).length;
                        const lateCount = empRecords.filter((r) => r.status === "late").length;
                        return (
                          <div key={emp.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{emp.name}</p>
                              <p className="text-xs text-gray-500">
                                Hadir: {presentCount} •{" "}
                                <span className="text-red-600">Terlambat: {lateCount}</span>
                              </p>
                            </div>
                            <p className="font-bold text-primary">
                              {getMonthlyHours(emp.id)} jam
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Attendance Table */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Filter size={16} /> Detail Absensi
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="all">Semua Karyawan</option>
                        {employees
                          .filter((e) => e.role === "employee")
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                      </select>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="all">Semua Status</option>
                        <option value="present">Hadir</option>
                        <option value="late">Terlambat</option>
                        <option value="early_leave">Pulang Awal</option>
                      </select>
                    </div>
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Masuk</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Keluar</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Foto</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Lokasi</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Ket</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {format(new Date(r.date), "dd/MM")}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {(r as Attendance & { employees?: { name: string } }).employees?.name || "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-green-600">
                              {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-orange-600">
                              {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  statusBadge[r.status]?.color || ""
                                }`}
                              >
                                {statusBadge[r.status]?.text || r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.clock_in_photo && (
                                <button
                                  onClick={() => setPhotoModal(r.clock_in_photo!)}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Lihat foto"
                                >
                                  <ImageIcon size={16} />
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.clock_in_lat && (
                                <a
                                  href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Lihat lokasi"
                                >
                                  <MapPin size={16} className="inline" />
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                              {r.notes || "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => deleteAttendance(r.id)}
                                className="text-red-400 hover:text-red-600 transition"
                                title="Hapus"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Cards for Detail Absensi */}
                  <div className="md:hidden divide-y">
                    {filteredRecords.map((r) => {
                      const rec = r as Attendance & { employees?: { name: string } };
                      return (
                        <div key={r.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{rec.employees?.name || "-"}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(r.date), "EEE, dd MMM", { locale: idLocale })}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                statusBadge[r.status]?.color || ""
                              }`}
                            >
                              {statusBadge[r.status]?.text || r.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-green-50 rounded-lg px-2 py-1 text-green-700">
                              Masuk: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                            </div>
                            <div className="bg-orange-50 rounded-lg px-2 py-1 text-orange-700">
                              Keluar: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                            </div>
                          </div>
                          {r.notes && (
                            <p className="text-xs text-gray-500">Ket: {r.notes}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs pt-1">
                            {r.clock_in_photo && (
                              <button
                                onClick={() => setPhotoModal(r.clock_in_photo!)}
                                className="flex items-center gap-1 text-blue-600"
                              >
                                <ImageIcon size={14} /> Foto
                              </button>
                            )}
                            {r.clock_in_lat && (
                              <a
                                href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600"
                              >
                                <MapPin size={14} /> Lokasi
                              </a>
                            )}
                            <button
                              onClick={() => deleteAttendance(r.id)}
                              className="flex items-center gap-1 text-red-500 ml-auto"
                            >
                              <Trash2 size={14} /> Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredRecords.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      {records.length === 0 ? "Belum ada data" : "Tidak ada data sesuai filter"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* KARYAWAN TAB */}
            {activeTab === "karyawan" && (
              <div className="space-y-6">
                {/* Add Employee */}
                <form onSubmit={addEmployee} className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="font-semibold text-gray-700">Tambah Karyawan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nama"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                      required
                    />
                    <input
                      type="text"
                      placeholder="PIN"
                      value={newEmployee.pin}
                      onChange={(e) => setNewEmployee({ ...newEmployee, pin: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                      required
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition text-sm"
                    >
                      Tambah
                    </button>
                  </div>
                  {empMsg && <p className="text-sm text-green-600">{empMsg}</p>}
                </form>

                {/* Employee List */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">Daftar Karyawan</h3>
                    <button
                      onClick={() => setShowPins(!showPins)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary"
                    >
                      {showPins ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showPins ? "Sembunyikan PIN" : "Tampilkan PIN"}
                    </button>
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">PIN</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Jam Kerja</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {employees.map((emp) => {
                          const effHours = getEffectiveWorkHours(emp, settings);
                          const isDefault = !emp.work_start && !emp.work_end;
                          return (
                          <tr key={emp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                            <td className="px-4 py-3 text-center font-mono">
                              {showPins ? emp.pin : "••••••"}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              <span className={isDefault ? "text-gray-400" : "text-primary font-medium"}>
                                {effHours.start} - {effHours.end}
                              </span>
                              {isDefault && <span className="text-gray-400 block text-[10px]">(default)</span>}
                            </td>
                            <td className="px-4 py-3 text-center capitalize">{emp.role}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  emp.is_active
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {emp.is_active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setResetPinEmp(emp);
                                    setNewPin("");
                                    setResetPinMsg("");
                                  }}
                                  className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition flex items-center gap-1"
                                  title="Reset PIN"
                                >
                                  <Key size={12} /> PIN
                                </button>
                                {emp.role !== "admin" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditHoursEmp(emp);
                                        setEditStart(emp.work_start || "");
                                        setEditEnd(emp.work_end || "");
                                        setEditHoursMsg("");
                                      }}
                                      className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition flex items-center gap-1"
                                      title="Jam Kerja"
                                    >
                                      <Clock3 size={12} /> Jam
                                    </button>
                                    <button
                                      onClick={() => toggleEmployee(emp.id, emp.is_active)}
                                      className={`text-xs px-2 py-1 rounded-lg transition ${
                                        emp.is_active
                                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                                          : "bg-green-50 text-green-600 hover:bg-green-100"
                                      }`}
                                    >
                                      {emp.is_active ? "Nonaktifkan" : "Aktifkan"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {employees.map((emp) => {
                      const effHours = getEffectiveWorkHours(emp, settings);
                      const isDefault = !emp.work_start && !emp.work_end;
                      return (
                        <div key={emp.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold">{emp.name}</p>
                              <p className="text-xs text-gray-500 capitalize">
                                {emp.role} • PIN: {showPins ? emp.pin : "••••••"}
                              </p>
                              <p className="text-xs mt-0.5">
                                Jam: <span className={isDefault ? "text-gray-400" : "text-primary font-medium"}>
                                  {effHours.start} - {effHours.end}
                                </span>
                                {isDefault && <span className="text-gray-400"> (default)</span>}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                emp.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {emp.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <button
                              onClick={() => {
                                setResetPinEmp(emp);
                                setNewPin("");
                                setResetPinMsg("");
                              }}
                              className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center gap-1"
                            >
                              <Key size={12} /> PIN
                            </button>
                            {emp.role !== "admin" && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditHoursEmp(emp);
                                    setEditStart(emp.work_start || "");
                                    setEditEnd(emp.work_end || "");
                                    setEditHoursMsg("");
                                  }}
                                  className="text-xs px-3 py-2 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center gap-1"
                                >
                                  <Clock3 size={12} /> Jam
                                </button>
                                <button
                                  onClick={() => toggleEmployee(emp.id, emp.is_active)}
                                  className={`col-span-2 text-xs px-3 py-2 rounded-lg ${
                                    emp.is_active
                                      ? "bg-red-50 text-red-600"
                                      : "bg-green-50 text-green-600"
                                  }`}
                                >
                                  {emp.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === "settings" && (
              <form onSubmit={saveSettings} className="bg-white rounded-2xl p-5 shadow-sm space-y-4 max-w-lg">
                <h3 className="font-semibold text-gray-700">Pengaturan Absensi</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Latitude Kantor</label>
                    <input
                      type="text"
                      value={settingsForm.office_lat}
                      onChange={(e) => setSettingsForm({ ...settingsForm, office_lat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Longitude Kantor</label>
                    <input
                      type="text"
                      value={settingsForm.office_lng}
                      onChange={(e) => setSettingsForm({ ...settingsForm, office_lng: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Radius (meter)</label>
                  <input
                    type="number"
                    value={settingsForm.radius_meters}
                    onChange={(e) => setSettingsForm({ ...settingsForm, radius_meters: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jam Masuk</label>
                    <input
                      type="time"
                      value={settingsForm.work_start}
                      onChange={(e) => setSettingsForm({ ...settingsForm, work_start: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jam Pulang</label>
                    <input
                      type="time"
                      value={settingsForm.work_end}
                      onChange={(e) => setSettingsForm({ ...settingsForm, work_end: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition text-sm"
                >
                  Simpan Pengaturan
                </button>
                {settingsMsg && (
                  <p className="text-sm text-green-600">{settingsMsg}</p>
                )}
              </form>
            )}
          </>
        )}
      </main>

      {/* Reset PIN Modal */}
      {resetPinEmp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setResetPinEmp(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Reset PIN</h3>
              <button onClick={() => setResetPinEmp(null)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={resetPin} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Karyawan</label>
                <p className="font-semibold">{resetPinEmp.name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">PIN Sekarang</label>
                <p className="font-mono text-sm">{resetPinEmp.pin}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">PIN Baru</label>
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Masukkan PIN baru"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
              </div>
              {resetPinMsg && (
                <p
                  className={`text-sm ${
                    resetPinMsg.includes("Gagal") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {resetPinMsg}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPinEmp(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Work Hours Modal */}
      {editHoursEmp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditHoursEmp(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock3 size={18} /> Jam Kerja
              </h3>
              <button onClick={() => setEditHoursEmp(null)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveWorkHours} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Karyawan</label>
                <p className="font-semibold">{editHoursEmp.name}</p>
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                Kosongkan kedua input untuk pakai jam kerja default:{" "}
                <strong>
                  {settings?.work_start} - {settings?.work_end}
                </strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Jam Pulang</label>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {editHoursMsg && (
                <p
                  className={`text-sm ${
                    editHoursMsg.includes("Gagal") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {editHoursMsg}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditStart("");
                    setEditEnd("");
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  title="Pakai default"
                >
                  Pakai Default
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {photoModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPhotoModal(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg"
            >
              <X size={20} />
            </button>
            <img
              src={photoModal}
              alt="Foto Absensi"
              className="w-full rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
