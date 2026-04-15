"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import * as XLSX from "xlsx";

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
          <div>
            <h1 className="text-lg font-bold">
              <span className="text-primary">Red</span>
              <span className="text-gray-800">Wine</span>
              <span className="text-xs text-gray-400 ml-2">Admin</span>
            </h1>
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
                  <div className="overflow-x-auto">
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
                </div>

                {/* Attendance Table */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-700">Detail Absensi</h3>
                  </div>
                  <div className="overflow-x-auto">
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
                        {records.map((r) => (
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
                  {records.length === 0 && (
                    <div className="text-center py-8 text-gray-400">Belum ada data</div>
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
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-700">Daftar Karyawan</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">PIN</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                            <td className="px-4 py-3 text-center font-mono">{emp.pin}</td>
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
                              {emp.role !== "admin" && (
                                <button
                                  onClick={() => toggleEmployee(emp.id, emp.is_active)}
                                  className={`text-xs px-3 py-1 rounded-lg transition ${
                                    emp.is_active
                                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                                      : "bg-green-50 text-green-600 hover:bg-green-100"
                                  }`}
                                >
                                  {emp.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
