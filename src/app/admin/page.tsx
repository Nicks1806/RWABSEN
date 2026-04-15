"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee } from "@/lib/auth";
import { Employee, Attendance, Settings, DayKey, Schedule, Leave, Reimbursement } from "@/lib/types";
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
  TrendingUp,
  Award,
  Timer,
  Shield,
  UserCircle2,
  Plus,
  UserPlus,
  FileText as FileTextIcon,
  Search,
  FileCheck,
  FileX,
  Phone,
  Mail,
  Briefcase,
  QrCode,
  Megaphone,
} from "lucide-react";
import Logo from "@/components/Logo";
import Avatar from "@/components/Avatar";
import { getEffectiveWorkHours, DAY_ORDER, DAY_LABELS } from "@/lib/workHours";
import dynamic from "next/dynamic";

// Lazy-load recharts only when analytics tab is viewed (~400KB bundle)
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

type Tab = "dashboard" | "analytics" | "leaves" | "karyawan" | "settings";

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
  const [workDays, setWorkDays] = useState<DayKey[]>([]);
  const [qrRequired, setQrRequired] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  // Employee form
  const [newEmployee, setNewEmployee] = useState({ name: "", pin: "" });
  const [empMsg, setEmpMsg] = useState("");

  // Reset PIN modal
  const [resetPinEmp, setResetPinEmp] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState("");
  const [resetPinMsg, setResetPinMsg] = useState("");
  const [showPins, setShowPins] = useState(false);

  // Delete employee confirmation
  const [deleteEmpTarget, setDeleteEmpTarget] = useState<Employee | null>(null);

  // Leaves (Izin/Cuti/Sakit)
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leaveFilter, setLeaveFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [leavesSubTab, setLeavesSubTab] = useState<"izin" | "reimburse">("izin");
  const [reimbs, setReimbs] = useState<Reimbursement[]>([]);

  // Global search
  const [globalSearch, setGlobalSearch] = useState("");

  // Edit profile modal
  const [editProfileEmp, setEditProfileEmp] = useState<Employee | null>(null);
  const [profileForm, setProfileForm] = useState({
    phone: "",
    email: "",
    position: "",
    address: "",
    join_date: "",
  });
  const [profileMsg, setProfileMsg] = useState("");

  // Edit work hours modal
  const [editHoursEmp, setEditHoursEmp] = useState<Employee | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editHoursMsg, setEditHoursMsg] = useState("");
  const [editSchedule, setEditSchedule] = useState<Schedule>({});
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);

  // Filters for Detail Absensi
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const date = new Date(month + "-01");
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");

    const [empRes, attRes, setRes, leavesRes, reimbRes] = await Promise.all([
      supabase.from("employees").select("*").eq("is_active", true).order("name"),
      supabase
        .from("attendance")
        .select("*, employees(name)")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false }),
      supabase.from("settings").select("*").single(),
      supabase
        .from("leaves")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (leavesRes.error) console.error("Leaves fetch error:", leavesRes.error);

    setEmployees(empRes.data || []);
    setRecords(attRes.data || []);

    // Manually attach employee name (more robust than FK auto-join)
    const empMap = new Map((empRes.data || []).map((e) => [e.id, e]));
    const leavesWithEmp = (leavesRes.data || []).map((l) => ({
      ...l,
      employees: empMap.get(l.employee_id) || null,
    }));
    setLeaves(leavesWithEmp);

    const reimbsWithEmp = (reimbRes.data || []).map((r) => ({
      ...r,
      employees: empMap.get(r.employee_id) || null,
    }));
    setReimbs(reimbsWithEmp);
    if (setRes.data) {
      setSettings(setRes.data);
      setSettingsForm({
        office_lat: String(setRes.data.office_lat),
        office_lng: String(setRes.data.office_lng),
        radius_meters: String(setRes.data.radius_meters),
        work_start: setRes.data.work_start,
        work_end: setRes.data.work_end,
      });
      setWorkDays(setRes.data.work_days || ["mon", "tue", "wed", "thu", "fri", "sat"]);
      setQrRequired(!!setRes.data.qr_required);
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

  // Keep fetchData in ref so subscription doesn't re-mount on deps change
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    if (admin) fetchDataRef.current();
  }, [admin, month]);

  // Realtime subscription - mounts ONCE when admin loads
  // Uses fetchDataRef to always call latest version without re-subscribing
  useEffect(() => {
    if (!admin) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchDataRef.current(), 500);
    };

    const channel = supabase
      .channel("attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves" }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements" }, triggerRefetch)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [admin, fetchData]);

  // Fallback refresh only when tab regains focus (more efficient than 30s polling)
  useEffect(() => {
    if (!admin) return;
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [admin, fetchData]);

  // Stats - memoized to avoid recompute on every render
  const today = format(new Date(), "yyyy-MM-dd");

  const todayRecords = useMemo(
    () => records.filter((r) => r.date === today),
    [records, today]
  );

  const totalEmployees = useMemo(
    () => employees.filter((e) => e.role === "employee").length,
    [employees]
  );

  const presentToday = useMemo(
    () => todayRecords.filter((r) => r.clock_in).length,
    [todayRecords]
  );

  const lateToday = useMemo(
    () => todayRecords.filter((r) => r.status === "late").length,
    [todayRecords]
  );

  // Per-employee stats (present count + late count) - single pass O(n)
  const empStatsMap = useMemo(() => {
    const map = new Map<string, { present: number; late: number }>();
    for (const r of records) {
      if (!r.employee_id) continue;
      const cur = map.get(r.employee_id) || { present: 0, late: 0 };
      if (r.clock_in) cur.present++;
      if (r.status === "late") cur.late++;
      map.set(r.employee_id, cur);
    }
    return map;
  }, [records]);

  // Per-employee monthly hours (memoized map for O(1) lookup instead of O(n) per call)
  const monthlyHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      if (!r.employee_id || !r.clock_in || !r.clock_out) continue;
      const diff = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
      const hours = diff / (1000 * 60 * 60);
      map.set(r.employee_id, (map.get(r.employee_id) || 0) + hours);
    }
    // Round values
    for (const [k, v] of map) map.set(k, Math.round(v * 10) / 10);
    return map;
  }, [records]);

  function getMonthlyHours(empId: string): number {
    return monthlyHoursMap.get(empId) || 0;
  }

  // Export Excel
  async function exportExcel() {
    // Lazy load xlsx (~1MB) only when export clicked
    const XLSX = await import("xlsx");

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
        work_days: workDays,
        qr_required: qrRequired,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSettingsMsg(error ? `Gagal menyimpan: ${error.message}` : "Tersimpan!");
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

  // Delete employee permanently
  async function deleteEmployee(id: string) {
    await supabase.from("employees").delete().eq("id", id);
    setDeleteEmpTarget(null);
    fetchData();
  }

  // Save employee profile
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editProfileEmp) return;
    const { error } = await supabase
      .from("employees")
      .update({
        phone: profileForm.phone || null,
        email: profileForm.email || null,
        position: profileForm.position || null,
        address: profileForm.address || null,
        join_date: profileForm.join_date || null,
      })
      .eq("id", editProfileEmp.id);
    setProfileMsg(error ? "Gagal menyimpan" : "Profile tersimpan!");
    if (!error) {
      setTimeout(() => {
        setEditProfileEmp(null);
        setProfileMsg("");
        fetchData();
      }, 1000);
    }
  }

  // Approve / Reject leave
  async function sendTestNotif(empId: string, empName: string) {
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: empId,
          title: "🔔 Test Notifikasi RedWine",
          body: `Halo ${empName}! Notifikasi berhasil terkirim 🎉`,
          url: "/absen",
        }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        alert(`✅ Test notif terkirim ke ${empName}!\n\nKalau tidak muncul di HP, cek:\n1. App sudah install (Add to Home Screen)\n2. Notifikasi tidak di-silence\n3. Service worker aktif`);
      } else {
        alert(`❌ Gagal kirim.\n\n${data.reason || data.error || "Unknown"}\n\nCek:\n- VAPID env di Vercel\n- Karyawan sudah toggle notif ON`);
      }
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  async function reviewLeave(id: string, status: "approved" | "rejected", notes: string = "") {
    const reviewerId = admin?.id || null;
    // Get leave for notification
    const leave = leaves.find((l) => l.id === id);
    await supabase
      .from("leaves")
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Send push notification to employee
    if (leave?.employee_id) {
      const typeName = leave.leave_type === "cuti" ? "Cuti" : leave.leave_type === "sakit" ? "Sakit" : "Izin";
      const statusText = status === "approved" ? "Disetujui ✅" : "Ditolak ❌";
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: leave.employee_id,
          title: `Pengajuan ${typeName} ${statusText}`,
          body: status === "approved"
            ? `Pengajuan ${typeName} Anda telah disetujui oleh admin.`
            : `Pengajuan ${typeName} Anda ditolak.${notes ? ` Catatan: ${notes}` : ""}`,
          url: "/absen",
        }),
      }).catch((err) => console.error("Push notification failed:", err));
    }

    fetchData();
  }

  // Approve/Reject reimbursement
  async function reviewReimb(id: string, status: "approved" | "rejected", notes: string = "") {
    const reviewerId = admin?.id || null;
    const reimb = reimbs.find((r) => r.id === id);
    await supabase
      .from("reimbursements")
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (reimb?.employee_id) {
      const statusText = status === "approved" ? "Disetujui ✅" : "Ditolak ❌";
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: reimb.employee_id,
          title: `Reimburse ${statusText}`,
          body:
            status === "approved"
              ? `Reimburse Rp ${Number(reimb.amount).toLocaleString("id-ID")} disetujui.`
              : `Reimburse ditolak.${notes ? ` ${notes}` : ""}`,
          url: "/pengajuan",
        }),
      }).catch((err) => console.error(err));
    }

    fetchData();
  }

  // PDF export - lazy load jspdf (~500KB) only when clicked
  async function exportPDF() {
    const { exportMonthlyPDF } = await import("@/lib/pdfExport");
    exportMonthlyPDF({ month, employees, records, settings });
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

    const payload: Record<string, unknown> = {
      work_start: editStart || null,
      work_end: editEnd || null,
    };

    if (useCustomSchedule) {
      // Only save non-empty day entries
      const cleaned: Schedule = {};
      Object.entries(editSchedule).forEach(([k, v]) => {
        if (v && (v.off || (v.start && v.end))) {
          cleaned[k as DayKey] = v;
        }
      });
      payload.schedule = Object.keys(cleaned).length > 0 ? cleaned : null;
    } else {
      payload.schedule = null;
    }

    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", editHoursEmp.id);
    setEditHoursMsg(error ? "Gagal menyimpan" : "Tersimpan!");
    if (!error) {
      setTimeout(() => {
        setEditHoursEmp(null);
        setEditHoursMsg("");
        fetchData();
      }, 1200);
    }
  }

  function updateDaySchedule(day: DayKey, field: "start" | "end" | "off", value: string | boolean) {
    setEditSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  // Filtered records for Detail Absensi
  const filteredRecords = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();
    return records.filter((r) => {
      if (filterEmployee !== "all" && r.employee_id !== filterEmployee) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (search) {
        const name = (r as Attendance & { employees?: { name: string } }).employees?.name || "";
        if (!name.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [records, filterEmployee, filterStatus, globalSearch]);

  // Late clock-in notification: employees who should have clocked in but haven't (per-employee hours)
  const lateClockIn = useMemo(() => {
    if (!settings) return [];
    const now = new Date();
    const clockedInIds = new Set(todayRecords.filter((r) => r.clock_in).map((r) => r.employee_id));

    return employees.filter((emp) => {
      if (emp.role !== "employee") return false;
      // Skip if already clocked in today
      if (clockedInIds.has(emp.id)) return false;

      const eff = getEffectiveWorkHours(emp, settings);
      // Skip if today is their off day (schedule-based)
      if (eff.off) return false;
      // Skip if work hours not properly set
      if (!eff.start || !eff.end) return false;

      const [sh, sm] = eff.start.split(":").map(Number);
      const [eh, em] = eff.end.split(":").map(Number);
      if (isNaN(sh) || isNaN(eh)) return false;

      const workStart = new Date();
      workStart.setHours(sh, sm, 0, 0);
      const workEnd = new Date();
      workEnd.setHours(eh, em, 0, 0);

      // Only show during their work hours
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
        <div className="max-w-5xl mx-auto px-3 md:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/pengumuman")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition"
              title="Pengumuman"
            >
              <Megaphone size={16} />
              <span className="hidden sm:inline">Pengumuman</span>
            </button>
            <button
              onClick={() => router.push("/admin/qr")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition"
              title="QR Code Absensi"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline">QR</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[52px] z-10">
        <div className="max-w-5xl mx-auto px-2 md:px-4 flex gap-0.5 md:gap-1 overflow-x-auto scrollbar-hide">
          {[
            { key: "dashboard" as Tab, label: "Dashboard", icon: <Clock size={16} /> },
            { key: "analytics" as Tab, label: "Analitik", icon: <TrendingUp size={16} /> },
            {
              key: "leaves" as Tab,
              label: "Izin",
              icon: <FileTextIcon size={16} />,
              badge: leaves.filter((l) => l.status === "pending").length,
            },
            { key: "karyawan" as Tab, label: "Karyawan", icon: <Users size={16} /> },
            { key: "settings" as Tab, label: "Pengaturan", icon: <SettingsIcon size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition relative whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon} {tab.label}
              {"badge" in tab && tab.badge && tab.badge > 0 ? (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-6 overflow-x-hidden">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

                {/* Month Selector + Export + Search */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:justify-between">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex-1 relative md:max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama karyawan..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportPDF}
                      className="flex-1 md:flex-none flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition"
                    >
                      <FileTextIcon size={16} /> PDF
                    </button>
                    <button
                      onClick={exportExcel}
                      className="flex-1 md:flex-none flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                    >
                      <Download size={16} /> Excel
                    </button>
                  </div>
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
                            const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
                            return (
                              <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{emp.name}</td>
                                <td className="px-4 py-3 text-center">{stats.present}</td>
                                <td className="px-4 py-3 text-center text-red-600">{stats.late}</td>
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
                        const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
                        return (
                          <div key={emp.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{emp.name}</p>
                              <p className="text-xs text-gray-500">
                                Hadir: {stats.present} •{" "}
                                <span className="text-red-600">Terlambat: {stats.late}</span>
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
                              <div className="inline-flex items-center gap-1">
                                {r.clock_in_photo && (
                                  <button
                                    onClick={() => setPhotoModal(r.clock_in_photo!)}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-lg"
                                    title="Foto Clock In"
                                  >
                                    <ImageIcon size={12} /> In
                                  </button>
                                )}
                                {r.clock_out_photo && (
                                  <button
                                    onClick={() => setPhotoModal(r.clock_out_photo!)}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 hover:text-orange-800 bg-orange-50 px-2 py-1 rounded-lg"
                                    title="Foto Clock Out"
                                  >
                                    <ImageIcon size={12} /> Out
                                  </button>
                                )}
                              </div>
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

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {records.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                    <TrendingUp size={32} className="text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-amber-800">Belum ada data absensi</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Grafik akan muncul setelah karyawan mulai absen. Pilih bulan lain di Dashboard jika perlu.
                    </p>
                  </div>
                )}
                {/* Ranking Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(() => {
                    const empStats = employees
                      .filter((e) => e.role === "employee")
                      .map((emp) => {
                        const empRecs = records.filter((r) => r.employee_id === emp.id);
                        const lateCount = empRecs.filter((r) => r.status === "late").length;
                        const presentCount = empRecs.filter((r) => r.clock_in).length;
                        const hours = getMonthlyHours(emp.id);
                        return { name: emp.name, lateCount, presentCount, hours };
                      });

                    const mostLate = [...empStats].sort((a, b) => b.lateCount - a.lateCount)[0];
                    const mostPresent = [...empStats].sort((a, b) => b.presentCount - a.presentCount)[0];
                    const longestHours = [...empStats].sort((a, b) => b.hours - a.hours)[0];

                    return (
                      <>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
                          <div className="flex items-center gap-2 text-red-600 mb-2">
                            <AlertTriangle size={18} />
                            <p className="text-xs font-semibold">Paling Sering Terlambat</p>
                          </div>
                          <p className="text-lg font-bold">{mostLate?.name || "-"}</p>
                          <p className="text-xs text-gray-500">
                            {mostLate?.lateCount || 0}x terlambat bulan ini
                          </p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-green-500">
                          <div className="flex items-center gap-2 text-green-600 mb-2">
                            <Award size={18} />
                            <p className="text-xs font-semibold">Paling Rajin</p>
                          </div>
                          <p className="text-lg font-bold">{mostPresent?.name || "-"}</p>
                          <p className="text-xs text-gray-500">
                            {mostPresent?.presentCount || 0} hari hadir
                          </p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500">
                          <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <Timer size={18} />
                            <p className="text-xs font-semibold">Paling Lama di Kantor</p>
                          </div>
                          <p className="text-lg font-bold">{longestHours?.name || "-"}</p>
                          <p className="text-xs text-gray-500">
                            {longestHours?.hours || 0} jam total
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Chart: Monthly Hours per Employee */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    Total Jam Kerja per Karyawan
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={employees
                        .filter((e) => e.role === "employee")
                        .map((emp) => ({
                          name: emp.name,
                          jam: getMonthlyHours(emp.id),
                        }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="jam" fill="#8B1A1A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart: Hadir vs Terlambat */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    Kehadiran vs Keterlambatan
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={employees
                        .filter((e) => e.role === "employee")
                        .map((emp) => {
                          const empRecs = records.filter((r) => r.employee_id === emp.id);
                          return {
                            name: emp.name,
                            Hadir: empRecs.filter((r) => r.clock_in).length,
                            Terlambat: empRecs.filter((r) => r.status === "late").length,
                          };
                        })}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Hadir" fill="#22c55e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Terlambat" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart: Line chart daily attendance trend */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-4">
                    Tren Kehadiran Harian
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={(() => {
                        // Group by date
                        const dateMap = new Map<string, { hadir: number; terlambat: number }>();
                        records.forEach((r) => {
                          const cur = dateMap.get(r.date) || { hadir: 0, terlambat: 0 };
                          if (r.clock_in) cur.hadir += 1;
                          if (r.status === "late") cur.terlambat += 1;
                          dateMap.set(r.date, cur);
                        });
                        return Array.from(dateMap.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([date, v]) => ({
                            date: format(new Date(date), "dd/MM"),
                            Hadir: v.hadir,
                            Terlambat: v.terlambat,
                          }));
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Hadir" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="Terlambat" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Ranking Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Late Ranking */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-500" /> Ranking Keterlambatan
                    </h3>
                    <div className="space-y-2">
                      {employees
                        .filter((e) => e.role === "employee")
                        .map((emp) => ({
                          name: emp.name,
                          lateCount: records.filter((r) => r.employee_id === emp.id && r.status === "late").length,
                        }))
                        .sort((a, b) => b.lateCount - a.lateCount)
                        .map((s, i) => (
                          <div key={s.name} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                              {s.name}
                            </span>
                            <span className={`font-semibold ${s.lateCount > 0 ? "text-red-600" : "text-gray-400"}`}>
                              {s.lateCount}x
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Hours Ranking */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Timer size={16} className="text-blue-500" /> Ranking Jam Kerja
                    </h3>
                    <div className="space-y-2">
                      {employees
                        .filter((e) => e.role === "employee")
                        .map((emp) => ({ name: emp.name, hours: getMonthlyHours(emp.id) }))
                        .sort((a, b) => b.hours - a.hours)
                        .map((s, i) => (
                          <div key={s.name} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                              {s.name}
                            </span>
                            <span className="font-semibold text-primary">{s.hours} jam</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Data bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
                </p>
              </div>
            )}

            {/* LEAVES (IZIN/CUTI/SAKIT) + REIMBURSE TAB */}
            {activeTab === "leaves" && (
              <div className="space-y-4">
                {/* Sub-tab: Izin vs Reimburse */}
                <div className="bg-white rounded-2xl shadow-sm p-1 grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      setLeavesSubTab("izin");
                      setLeaveFilter("all");
                    }}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
                      leavesSubTab === "izin" ? "bg-primary text-white shadow-sm" : "text-gray-500"
                    }`}
                  >
                    <FileTextIcon size={16} /> Izin/Cuti ({leaves.filter((l) => l.status === "pending").length})
                  </button>
                  <button
                    onClick={() => {
                      setLeavesSubTab("reimburse");
                      setLeaveFilter("all");
                    }}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
                      leavesSubTab === "reimburse" ? "bg-primary text-white shadow-sm" : "text-gray-500"
                    }`}
                  >
                    💰 Reimburse ({reimbs.filter((r) => r.status === "pending").length})
                  </button>
                </div>

                {leavesSubTab === "izin" ? (
                <>
                {/* Filter */}
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all" as const, label: "Semua", count: leaves.length },
                    { key: "pending" as const, label: "Menunggu", count: leaves.filter((l) => l.status === "pending").length },
                    { key: "approved" as const, label: "Disetujui", count: leaves.filter((l) => l.status === "approved").length },
                    { key: "rejected" as const, label: "Ditolak", count: leaves.filter((l) => l.status === "rejected").length },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setLeaveFilter(f.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        leaveFilter === f.key
                          ? "bg-primary text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50 border"
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                {/* Leave List */}
                <div className="space-y-3">
                  {leaves
                    .filter((l) => leaveFilter === "all" || l.status === leaveFilter)
                    .filter((l) => {
                      const search = globalSearch.trim().toLowerCase();
                      if (!search) return true;
                      return (
                        (l as Leave & { employees?: { name: string } }).employees?.name
                          ?.toLowerCase()
                          .includes(search) || false
                      );
                    })
                    .map((leave) => {
                      const emp = (leave as Leave & { employees?: { name: string } }).employees;
                      const typeColor = {
                        cuti: "bg-blue-50 text-blue-700",
                        sakit: "bg-orange-50 text-orange-700",
                        izin: "bg-purple-50 text-purple-700",
                      }[leave.leave_type];
                      const statusColor = {
                        pending: "bg-yellow-50 text-yellow-700",
                        approved: "bg-green-50 text-green-700",
                        rejected: "bg-red-50 text-red-700",
                      }[leave.status];
                      const statusLabel = {
                        pending: "Menunggu",
                        approved: "Disetujui",
                        rejected: "Ditolak",
                      }[leave.status];

                      return (
                        <div key={leave.id} className="bg-white rounded-2xl p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar name={emp?.name || "?"} size="md" />
                              <div className="min-w-0">
                                <p className="font-semibold">{emp?.name || "-"}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${typeColor}`}>
                                    {leave.leave_type}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">
                                  {format(new Date(leave.start_date), "dd MMM yyyy", { locale: idLocale })}
                                  {leave.start_date !== leave.end_date &&
                                    ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
                                </p>
                                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{leave.reason}</p>
                                {leave.attachment_url && (
                                  <a
                                    href={leave.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                                  >
                                    <FileTextIcon size={12} /> Lihat lampiran
                                  </a>
                                )}
                                {leave.admin_notes && (
                                  <p className="text-xs text-gray-500 mt-2 italic">
                                    Catatan admin: {leave.admin_notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            {leave.status === "pending" && (
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <button
                                  onClick={() => reviewLeave(leave.id, "approved")}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                                >
                                  <FileCheck size={14} /> Setujui
                                </button>
                                <button
                                  onClick={() => {
                                    const notes = prompt("Alasan penolakan (opsional):") || "";
                                    reviewLeave(leave.id, "rejected", notes);
                                  }}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                                >
                                  <FileX size={14} /> Tolak
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {leaves.filter((l) => leaveFilter === "all" || l.status === leaveFilter).length ===
                    0 && (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                      Belum ada pengajuan izin
                    </div>
                  )}
                </div>
                </>
                ) : (
                  /* REIMBURSE SECTION */
                  <>
                    <div className="flex gap-2 overflow-x-auto">
                      {[
                        { key: "all" as const, label: "Semua", count: reimbs.length },
                        { key: "pending" as const, label: "Menunggu", count: reimbs.filter((r) => r.status === "pending").length },
                        { key: "approved" as const, label: "Disetujui", count: reimbs.filter((r) => r.status === "approved").length },
                        { key: "rejected" as const, label: "Ditolak", count: reimbs.filter((r) => r.status === "rejected").length },
                      ].map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setLeaveFilter(f.key)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                            leaveFilter === f.key
                              ? "bg-primary text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50 border"
                          }`}
                        >
                          {f.label} ({f.count})
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {reimbs
                        .filter((r) => leaveFilter === "all" || r.status === leaveFilter)
                        .filter((r) => {
                          const search = globalSearch.trim().toLowerCase();
                          if (!search) return true;
                          return (
                            (r as Reimbursement & { employees?: { name: string } }).employees?.name
                              ?.toLowerCase()
                              .includes(search) || false
                          );
                        })
                        .map((reimb) => {
                          const emp = (reimb as Reimbursement & { employees?: { name: string } }).employees;
                          const statusColor = {
                            pending: "bg-yellow-50 text-yellow-700",
                            approved: "bg-green-50 text-green-700",
                            rejected: "bg-red-50 text-red-700",
                          }[reimb.status];
                          const catEmoji = {
                            umum: "📦",
                            transport: "🚗",
                            makanan: "🍱",
                            medis: "💊",
                            lainnya: "📋",
                          }[reimb.category] || "📋";

                          return (
                            <div key={reimb.id} className="bg-white rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                                    {catEmoji}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{emp?.name || "-"}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700 capitalize">
                                        {reimb.category}
                                      </span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                        {reimb.status === "pending" ? "Menunggu" : reimb.status === "approved" ? "Disetujui" : "Ditolak"}
                                      </span>
                                    </div>
                                    <p className="text-lg font-bold text-primary mt-2">
                                      Rp {Number(reimb.amount).toLocaleString("id-ID")}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {format(new Date(reimb.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                                    </p>
                                    {reimb.description && (
                                      <p className="text-sm text-gray-700 mt-2">{reimb.description}</p>
                                    )}
                                    {reimb.bank_account && (
                                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                                          Rekening Transfer
                                        </p>
                                        <p className="text-sm text-blue-900 font-mono font-semibold">
                                          {reimb.bank_account}
                                        </p>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(reimb.bank_account || "");
                                          }}
                                          className="text-[10px] text-blue-600 hover:underline mt-0.5"
                                        >
                                          Salin
                                        </button>
                                      </div>
                                    )}
                                    {reimb.attachment_url && (
                                      <a
                                        href={reimb.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                                      >
                                        <FileTextIcon size={12} /> Lihat bukti
                                      </a>
                                    )}
                                    {reimb.admin_notes && (
                                      <p className="text-xs text-gray-500 mt-2 italic">
                                        Catatan admin: {reimb.admin_notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {reimb.status === "pending" && (
                                  <div className="flex flex-col gap-1.5 shrink-0">
                                    <button
                                      onClick={() => reviewReimb(reimb.id, "approved")}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                                    >
                                      <FileCheck size={14} /> Setujui
                                    </button>
                                    <button
                                      onClick={() => {
                                        const notes = prompt("Alasan penolakan (opsional):") || "";
                                        reviewReimb(reimb.id, "rejected", notes);
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                                    >
                                      <FileX size={14} /> Tolak
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {reimbs.filter((r) => leaveFilter === "all" || r.status === leaveFilter).length === 0 && (
                        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                          Belum ada pengajuan reimburse
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* KARYAWAN TAB */}
            {activeTab === "karyawan" && (
              <div className="space-y-6">
                {/* Add Employee */}
                <form onSubmit={addEmployee} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Tambah Karyawan Baru</h3>
                      <p className="text-xs text-gray-400">Karyawan bisa langsung login dengan nama & PIN</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                    <input
                      type="text"
                      placeholder="Nama karyawan"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      required
                    />
                    <input
                      type="text"
                      placeholder="PIN (min 4 digit)"
                      value={newEmployee.pin}
                      onChange={(e) => setNewEmployee({ ...newEmployee, pin: e.target.value })}
                      className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
                      required
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition text-sm inline-flex items-center gap-1.5 justify-center"
                    >
                      <Plus size={16} /> Tambah
                    </button>
                  </div>
                  {empMsg && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle size={14} /> {empMsg}
                    </p>
                  )}
                </form>

                {/* Employee List */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-gray-500" />
                      <h3 className="font-semibold text-gray-800">Daftar Karyawan</h3>
                      <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border">
                        {employees.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPins(!showPins)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary bg-white px-3 py-1.5 rounded-lg border hover:border-primary transition"
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
                          const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
                          const hasCustomHours = !!emp.work_start && !!emp.work_end;
                          const isDefault = !hasSchedule && !hasCustomHours;
                          const eff = getEffectiveWorkHours(emp, settings);
                          return (
                          <tr key={emp.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/admin/karyawan/${emp.id}`)}
                                className="flex items-center gap-3 hover:opacity-80 text-left w-full"
                              >
                                <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                                <div>
                                  <p className="font-semibold text-gray-800 hover:text-primary">{emp.name}</p>
                                  <p className="text-[10px] text-gray-400 capitalize">{emp.role}</p>
                                </div>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-sm tracking-wider text-gray-600">
                              {showPins ? emp.pin : "••••••"}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              {emp.role === "admin" ? (
                                <span className="text-gray-300">-</span>
                              ) : eff.off ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium text-[11px]">
                                  Libur Hari Ini
                                </span>
                              ) : (
                                <>
                                  <span className={isDefault ? "text-gray-700" : "text-primary font-semibold"}>
                                    {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                                  </span>
                                  {isDefault && (
                                    <span className="text-gray-400 block text-[10px]">(default)</span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {emp.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                                  <Shield size={11} /> Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                  <UserCircle2 size={11} /> Employee
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${
                                  emp.is_active
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${emp.is_active ? "bg-green-500" : "bg-red-500"}`}></span>
                                {emp.is_active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setResetPinEmp(emp);
                                    setNewPin("");
                                    setResetPinMsg("");
                                  }}
                                  className="group w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center"
                                  title="Reset PIN"
                                >
                                  <Key size={14} />
                                </button>
                                {emp.role !== "admin" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditProfileEmp(emp);
                                        setProfileForm({
                                          phone: emp.phone || "",
                                          email: emp.email || "",
                                          position: emp.position || "",
                                          address: emp.address || "",
                                          join_date: emp.join_date || "",
                                        });
                                        setProfileMsg("");
                                      }}
                                      className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white transition flex items-center justify-center"
                                      title="Profile"
                                    >
                                      <UserCircle2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditHoursEmp(emp);
                                        setEditStart(emp.work_start || "");
                                        setEditEnd(emp.work_end || "");
                                        setEditSchedule(emp.schedule || {});
                                        setUseCustomSchedule(!!emp.schedule);
                                        setEditHoursMsg("");
                                      }}
                                      className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white transition flex items-center justify-center"
                                      title="Atur Jam Kerja"
                                    >
                                      <Clock3 size={14} />
                                    </button>
                                    <button
                                      onClick={() => sendTestNotif(emp.id, emp.name)}
                                      className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition flex items-center justify-center"
                                      title="Test Notifikasi"
                                    >
                                      <Bell size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteEmpTarget(emp)}
                                      className="w-8 h-8 rounded-lg transition flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                                      title="Hapus Karyawan"
                                    >
                                      <Trash2 size={14} />
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
                      const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
                      const hasCustomHours = !!emp.work_start && !!emp.work_end;
                      const isDefault = !hasSchedule && !hasCustomHours;
                      const eff = getEffectiveWorkHours(emp, settings);
                      return (
                        <div key={emp.id} className="p-4">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <button
                              onClick={() => router.push(`/admin/karyawan/${emp.id}`)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                              <div className="min-w-0">
                                <p className="font-semibold">{emp.name}</p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {emp.role} • PIN: {showPins ? emp.pin : "••••••"}
                                </p>
                                {emp.role !== "admin" && (
                                  <p className="text-xs mt-0.5">
                                    {eff.off ? (
                                      <span className="text-gray-400 italic">Libur Hari Ini</span>
                                    ) : (
                                      <>
                                        Jam:{" "}
                                        <span className={isDefault ? "text-gray-600" : "text-primary font-medium"}>
                                          {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                                        </span>
                                        {isDefault && <span className="text-gray-400"> (default)</span>}
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            </button>
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
                                  onClick={() => setDeleteEmpTarget(emp)}
                                  className="col-span-2 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 flex items-center justify-center gap-1"
                                >
                                  <Trash2 size={12} /> Hapus
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

                {/* Default Work Days */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Hari Kerja Default
                  </label>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Hari yang tidak dicentang = hari libur (karyawan tidak perlu absen)
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_ORDER.map((day) => {
                      const active = workDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setWorkDays((prev) =>
                              active ? prev.filter((d) => d !== day) : [...prev, day]
                            );
                          }}
                          className={`py-2 rounded-lg text-xs font-medium transition ${
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {DAY_LABELS[day].slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* QR Code Required */}
                <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-amber-50 rounded-xl p-3 border border-amber-200">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <QrCode size={14} /> Wajib Scan QR Code
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Karyawan harus scan QR di kantor sebelum bisa clock-in
                    </p>
                    <p className="text-[10px] text-primary mt-1">
                      Tampilkan QR di <strong>Menu QR Code</strong> (pojok kanan atas)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={qrRequired}
                      onChange={(e) => setQrRequired(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
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

            {/* Google Sheets Sync - inside settings */}
            {activeTab === "settings" && (
              <div className="bg-white rounded-2xl p-5 shadow-sm mt-4 max-w-lg">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileTextIcon size={16} /> Google Sheets Live Sync
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Sinkronkan data absensi ke Google Sheets pakai formula <code className="bg-gray-100 px-1 rounded text-[10px]">=IMPORTDATA()</code>.
                  Data auto-update setiap 1 jam.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Langkah:</p>
                  <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                    <li>Set env <code className="bg-white px-1 rounded">CSV_EXPORT_KEY</code> di Vercel (nilai bebas, jadikan password)</li>
                    <li>Di Google Sheets, cell A1 ketik formula:</li>
                  </ol>
                  <div className="bg-gray-900 text-green-400 text-[10px] p-2 rounded font-mono break-all">
                    =IMPORTDATA(&quot;https://absensiredwine.vercel.app/api/attendance-csv?month={month}&amp;key=YOUR_SECRET&quot;)
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Ganti YOUR_SECRET dengan nilai env, dan {"{month}"} dengan format yyyy-MM (misal: 2026-04)
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit Profile Modal */}
      {editProfileEmp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditProfileEmp(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-md my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Avatar name={editProfileEmp.name} size="md" />
                <div>
                  <h3 className="font-bold text-gray-800">{editProfileEmp.name}</h3>
                  <p className="text-xs text-gray-500">Profile Karyawan</p>
                </div>
              </div>
              <button onClick={() => setEditProfileEmp(null)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveProfile} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Briefcase size={12} /> Posisi / Jabatan
                </label>
                <input
                  type="text"
                  value={profileForm.position}
                  onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                  placeholder="misal: Sales, Kasir, Stock"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Phone size={12} /> Nomor HP
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+62..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Mail size={12} /> Email
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Alamat</label>
                <textarea
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tanggal Bergabung</label>
                <input
                  type="date"
                  value={profileForm.join_date}
                  onChange={(e) => setProfileForm({ ...profileForm, join_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg.includes("Gagal") ? "text-red-600" : "text-green-600"}`}>
                  {profileMsg}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProfileEmp(null)}
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

      {/* Delete Employee Confirmation Modal */}
      {deleteEmpTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteEmpTarget(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Hapus Karyawan?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Yakin ingin menghapus <strong className="text-gray-800">{deleteEmpTarget.name}</strong>?
              </p>
              <p className="text-xs text-red-500 mt-2">
                ⚠️ Semua data absensi karyawan ini akan ikut terhapus dan tidak bisa dikembalikan.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteEmpTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => deleteEmployee(deleteEmpTarget.id)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Hours Modal */}
      {editHoursEmp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditHoursEmp(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-md my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock3 size={18} /> Jam Kerja - {editHoursEmp.name}
              </h3>
              <button onClick={() => setEditHoursEmp(null)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveWorkHours} className="space-y-4">
              {/* Toggle custom schedule */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Jadwal Per Hari</p>
                  <p className="text-xs text-gray-500">
                    Atur jam masuk berbeda setiap hari & hari libur
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomSchedule}
                    onChange={(e) => setUseCustomSchedule(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {!useCustomSchedule ? (
                <>
                  <p className="text-xs text-gray-500 bg-amber-50 rounded-lg p-2">
                    Jam kerja tunggal berlaku semua hari. Default:{" "}
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
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Centang libur untuk hari tidak masuk. Kosong = pakai default.
                  </p>
                  {DAY_ORDER.map((day) => {
                    const ds = editSchedule[day] || {};
                    return (
                      <div key={day} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2 items-center text-sm">
                        <span className="font-medium">{DAY_LABELS[day]}</span>
                        <input
                          type="time"
                          value={ds.start || ""}
                          disabled={ds.off}
                          onChange={(e) => updateDaySchedule(day, "start", e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                        />
                        <input
                          type="time"
                          value={ds.end || ""}
                          disabled={ds.off}
                          onChange={(e) => updateDaySchedule(day, "end", e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                        />
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!ds.off}
                            onChange={(e) => updateDaySchedule(day, "off", e.target.checked)}
                            className="accent-red-500"
                          />
                          Libur
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

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
                    setEditSchedule({});
                    setUseCustomSchedule(false);
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  title="Pakai default"
                >
                  Reset Default
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
