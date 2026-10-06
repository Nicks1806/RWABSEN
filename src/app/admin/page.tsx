"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee } from "@/lib/auth";
import { useToast } from "@/components/Toast";
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
  Loader2,
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
  Shield,
  UserCircle2,
  Plus,
  UserPlus,
  FileText as FileTextIcon,
  Search,
  FileCheck,
  FileX,
  QrCode,
  Megaphone,
  ClipboardList,
} from "lucide-react";
import Logo from "@/components/Logo";
import Avatar from "@/components/Avatar";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import SettingsTab from "@/components/admin/SettingsTab";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import EditProfileModal from "@/components/admin/EditProfileModal";
import ResetPinModal from "@/components/admin/ResetPinModal";
import DeleteEmployeeModal from "@/components/admin/DeleteEmployeeModal";
import EditWorkHoursModal from "@/components/admin/EditWorkHoursModal";
import { getEffectiveWorkHours } from "@/lib/workHours";
import { getPositionColor } from "@/lib/positions";

type Tab = "dashboard" | "analytics" | "leaves" | "karyawan" | "settings";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [admin, setAdmin] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isTabPending, startTabTransition] = useTransition();
  const switchTab = useCallback((tab: Tab) => {
    // Non-blocking tab switch — UI updates immediately,
    // heavy content renders in background without blocking input
    startTabTransition(() => setActiveTab(tab));
  }, []);
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
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<Set<string>>(new Set());
  const [selectedReimbIds, setSelectedReimbIds] = useState<Set<string>>(new Set());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]); // fetchData intentionally excluded - uses fetchDataRef

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

  // Effective work hours per employee (memoized so we don't recompute each render)
  const effHoursMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEffectiveWorkHours>>();
    if (!settings) return map;
    for (const emp of employees) {
      map.set(emp.id, getEffectiveWorkHours(emp, settings));
    }
    return map;
  }, [employees, settings]);

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

  // Delete employee permanently
  async function deleteEmployee(id: string) {
    await supabase.from("employees").delete().eq("id", id);
    setDeleteEmpTarget(null);
    fetchData();
  }

  // Soft delete: nonaktifkan karyawan (data history tetap aman)
  async function toggleEmployeeActive(emp: Employee) {
    await supabase.from("employees")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id);
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
        toast(`Test notif terkirim ke ${empName}!\n\nKalau tidak muncul di HP, cek:\n1. App sudah install (Add to Home Screen)\n2. Notifikasi tidak di-silence\n3. Service worker aktif`, "success", 6000);
      } else {
        toast(`Gagal kirim.\n\n${data.reason || data.error || "Unknown"}\n\nCek:\n- VAPID env di Vercel\n- Karyawan sudah toggle notif ON`, "error", 6000);
      }
    } catch (err) {
      toast(`Error: ${err}`, "error");
    }
  }

  async function bulkReviewLeaves(ids: string[], status: "approved" | "rejected") {
    if (ids.length === 0) return;
    const label = status === "approved" ? "menyetujui" : "menolak";
    if (!confirm(`Yakin ${label} ${ids.length} pengajuan sekaligus?`)) return;
    for (const id of ids) {
      await reviewLeave(id, status);
    }
    setSelectedLeaveIds(new Set());
  }

  async function bulkReviewReimbs(ids: string[], status: "approved" | "rejected") {
    if (ids.length === 0) return;
    const label = status === "approved" ? "menyetujui" : "menolak";
    if (!confirm(`Yakin ${label} ${ids.length} reimbursement sekaligus?`)) return;
    const reviewerId = admin?.id || null;
    await supabase
      .from("reimbursements")
      .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .in("id", ids);
    setSelectedReimbIds(new Set());
    fetchData();
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

  // Per-employee monthly report (attendance + leaves + reimbursements)
  const [reportLoadingId, setReportLoadingId] = useState<string | null>(null);
  async function exportEmployeeReport(emp: Employee) {
    setReportLoadingId(emp.id);
    try {
      // Filter month range for queries
      const monthStart = `${month}-01`;
      const monthEnd = format(endOfMonth(new Date(monthStart)), "yyyy-MM-dd");

      // Fetch leaves & reimbursements specific to employee + month (server-side)
      const [leavesRes, reimbsRes] = await Promise.all([
        supabase
          .from("leaves")
          .select("*")
          .eq("employee_id", emp.id)
          .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`)
          .order("start_date", { ascending: false }),
        supabase
          .from("reimbursements")
          .select("*")
          .eq("employee_id", emp.id)
          .gte("transaction_date", monthStart)
          .lte("transaction_date", monthEnd)
          .order("transaction_date", { ascending: false }),
      ]);

      const empRecords = records.filter((r) => r.employee_id === emp.id);

      const { exportEmployeeMonthlyReport } = await import("@/lib/pdfExport");
      exportEmployeeMonthlyReport({
        month,
        employee: emp,
        records: empRecords,
        leaves: leavesRes.data || [],
        reimbursements: reimbsRes.data || [],
        settings,
      });
    } catch (err) {
      console.error(err);
      toast("Gagal generate laporan PDF", "error");
    } finally {
      setReportLoadingId(null);
    }
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

  // Employees who clocked in but haven't clocked out yet
  const missingClockOut = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const pendingIds = new Set(
      todayRecords
        .filter((r) => r.date === today && r.clock_in && !r.clock_out)
        .map((r) => r.employee_id)
    );
    return employees.filter((e) => pendingIds.has(e.id));
  }, [todayRecords, employees]);

  // Top 3 rajin (most present this month) + Top 3 paling sering telat
  const topRajin = useMemo(() => {
    return employees
      .filter((e) => e.role === "employee")
      .map((e) => ({ emp: e, ...((empStatsMap.get(e.id)) || { present: 0, late: 0 }) }))
      .sort((a, b) => b.present - a.present)
      .slice(0, 3);
  }, [employees, empStatsMap]);

  const topTelat = useMemo(() => {
    return employees
      .filter((e) => e.role === "employee")
      .map((e) => ({ emp: e, ...((empStatsMap.get(e.id)) || { present: 0, late: 0 }) }))
      .filter((r) => r.late > 0)
      .sort((a, b) => b.late - a.late)
      .slice(0, 3);
  }, [employees, empStatsMap]);

  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");

  async function sendClockOutReminder() {
    if (missingClockOut.length === 0) {
      setReminderMsg("Semua karyawan sudah clock-out ✓");
      setTimeout(() => setReminderMsg(""), 3000);
      return;
    }
    if (!confirm(`Kirim reminder clock-out ke ${missingClockOut.length} karyawan?`)) return;
    setReminderSending(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_ids: missingClockOut.map((e) => e.id),
          title: "⏰ Jangan lupa Clock Out!",
          body: "Kamu belum clock-out hari ini. Yuk absen pulang sebelum sistem menandai early leave.",
          url: "/absen",
        }),
      });
      const data = await res.json();
      setReminderMsg(`Reminder terkirim ke ${data.sent || 0} karyawan ✓`);
    } catch {
      setReminderMsg("Gagal kirim reminder");
    } finally {
      setReminderSending(false);
      setTimeout(() => setReminderMsg(""), 4000);
    }
  }

  function handleLogout() {
    clearEmployee();
    router.push("/");
  }

  if (!admin) return <AdminSkeleton />;

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
              onClick={() => router.push("/tasks")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition"
              title="Task Board"
            >
              <ClipboardList size={16} />
              <span className="hidden sm:inline">Tasks</span>
            </button>
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
              onClick={() => switchTab(tab.key)}
              className={`shrink-0 flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition relative whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              } ${isTabPending && activeTab === tab.key ? "opacity-60" : ""}`}
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
                  <AdminStatCard
                    icon={<Users size={18} />}
                    label="Total Karyawan"
                    value={totalEmployees}
                    gradient="from-blue-500 to-indigo-500"
                    bg="from-blue-50 via-white to-indigo-50"
                    textColor="text-blue-700"
                  />
                  <AdminStatCard
                    icon={<CheckCircle size={18} />}
                    label="Hadir Hari Ini"
                    value={presentToday}
                    gradient="from-emerald-500 to-green-500"
                    bg="from-emerald-50 via-white to-green-50"
                    textColor="text-emerald-700"
                    liveBadge={`${totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0}%`}
                  />
                  <AdminStatCard
                    icon={<AlertTriangle size={18} />}
                    label="Terlambat"
                    value={lateToday}
                    gradient="from-amber-500 to-orange-500"
                    bg="from-amber-50 via-white to-orange-50"
                    textColor="text-amber-700"
                  />
                  <AdminStatCard
                    icon={<Clock size={18} />}
                    label="Belum Hadir"
                    value={totalEmployees - presentToday}
                    gradient="from-rose-500 to-red-500"
                    bg="from-rose-50 via-white to-red-50"
                    textColor="text-rose-700"
                  />
                </div>

                {/* Clock-Out Reminder Banner */}
                {missingClockOut.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
                        <Clock3 size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 text-sm">{missingClockOut.length} karyawan belum clock-out</p>
                        <p className="text-xs text-amber-700">{missingClockOut.slice(0, 3).map((e) => e.name).join(", ")}{missingClockOut.length > 3 ? ` +${missingClockOut.length - 3} lainnya` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {reminderMsg && <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">{reminderMsg}</span>}
                      <button
                        onClick={sendClockOutReminder}
                        disabled={reminderSending}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition disabled:opacity-60"
                      >
                        <Bell size={14} />
                        {reminderSending ? "Mengirim..." : "Kirim Reminder"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Top Performer Ranking */}
                {(topRajin.length > 0 || topTelat.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-in">
                    {/* Top Rajin */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white flex items-center justify-center">
                          <Award size={14} />
                        </div>
                        <h3 className="font-bold text-sm text-emerald-900">Top Rajin Bulan Ini</h3>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {topRajin.map((r, idx) => (
                          <li key={r.emp.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" :
                              idx === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" :
                              "bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                            }`}>
                              {idx + 1}
                            </span>
                            <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{r.emp.name}</p>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tabular-nums">{r.present} hari</span>
                          </li>
                        ))}
                        {topRajin.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-400">Belum ada data</li>}
                      </ul>
                    </div>

                    {/* Top Telat */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-red-50 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white flex items-center justify-center">
                          <AlertTriangle size={14} />
                        </div>
                        <h3 className="font-bold text-sm text-rose-900">Paling Sering Terlambat</h3>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {topTelat.map((r, idx) => (
                          <li key={r.emp.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{r.emp.name}</p>
                            <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full tabular-nums">{r.late}x</span>
                          </li>
                        ))}
                        {topTelat.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-400">Tidak ada yang terlambat 🎉</li>}
                      </ul>
                    </div>
                  </div>
                )}

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
              <AnalyticsTab
                employees={employees}
                records={records}
                getMonthlyHours={getMonthlyHours}
                month={month}
              />
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

                {/* Bulk action bar for pending leaves */}
                {leaveFilter === "pending" && leaves.filter((l) => l.status === "pending").length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-2 flex-wrap animate-fade-in">
                    <button
                      onClick={() => {
                        const pendingIds = leaves.filter((l) => l.status === "pending").map((l) => l.id);
                        setSelectedLeaveIds(new Set(pendingIds.length === selectedLeaveIds.size ? [] : pendingIds));
                      }}
                      className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                    >
                      {selectedLeaveIds.size === leaves.filter((l) => l.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
                    </button>
                    {selectedLeaveIds.size > 0 && (
                      <>
                        <span className="text-xs text-gray-500">{selectedLeaveIds.size} dipilih</span>
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => bulkReviewLeaves(Array.from(selectedLeaveIds), "approved")}
                            className="px-3 py-1.5 bg-gradient-to-br from-emerald-500 to-green-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                          >
                            <CheckCircle size={13} /> Setujui semua
                          </button>
                          <button
                            onClick={() => bulkReviewLeaves(Array.from(selectedLeaveIds), "rejected")}
                            className="px-3 py-1.5 bg-gradient-to-br from-rose-500 to-red-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                          >
                            <X size={13} /> Tolak semua
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
                        <div key={leave.id} className={`bg-white rounded-2xl p-4 shadow-sm transition-all animate-stagger ${selectedLeaveIds.has(leave.id) ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {leave.status === "pending" && (
                                <input
                                  type="checkbox"
                                  checked={selectedLeaveIds.has(leave.id)}
                                  onChange={(e) => {
                                    const next = new Set(selectedLeaveIds);
                                    if (e.target.checked) next.add(leave.id); else next.delete(leave.id);
                                    setSelectedLeaveIds(next);
                                  }}
                                  className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Pilih untuk bulk action"
                                />
                              )}
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

                    {/* Bulk action bar for pending reimbursements */}
                    {leaveFilter === "pending" && reimbs.filter((r) => r.status === "pending").length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-2 flex-wrap animate-fade-in">
                        <button
                          onClick={() => {
                            const pendingIds = reimbs.filter((r) => r.status === "pending").map((r) => r.id);
                            setSelectedReimbIds(new Set(pendingIds.length === selectedReimbIds.size ? [] : pendingIds));
                          }}
                          className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                        >
                          {selectedReimbIds.size === reimbs.filter((r) => r.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
                        </button>
                        {selectedReimbIds.size > 0 && (
                          <>
                            <span className="text-xs text-gray-500">{selectedReimbIds.size} dipilih</span>
                            <div className="ml-auto flex gap-2">
                              <button
                                onClick={() => bulkReviewReimbs(Array.from(selectedReimbIds), "approved")}
                                className="px-3 py-1.5 bg-gradient-to-br from-emerald-500 to-green-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                              >
                                <CheckCircle size={13} /> Setujui semua
                              </button>
                              <button
                                onClick={() => bulkReviewReimbs(Array.from(selectedReimbIds), "rejected")}
                                className="px-3 py-1.5 bg-gradient-to-br from-rose-500 to-red-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                              >
                                <X size={13} /> Tolak semua
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

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
                            <div key={reimb.id} className={`bg-white rounded-2xl p-4 shadow-sm transition-all animate-stagger ${selectedReimbIds.has(reimb.id) ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {reimb.status === "pending" && (
                                    <input
                                      type="checkbox"
                                      checked={selectedReimbIds.has(reimb.id)}
                                      onChange={(e) => {
                                        const next = new Set(selectedReimbIds);
                                        if (e.target.checked) next.add(reimb.id); else next.delete(reimb.id);
                                        setSelectedReimbIds(next);
                                      }}
                                      className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label="Pilih untuk bulk action"
                                    />
                                  )}
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
                          const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
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
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${getPositionColor(emp.position)}`}>
                                  <UserCircle2 size={11} /> {emp.position || "Karyawan"}
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
                                  onClick={() => exportEmployeeReport(emp)}
                                  disabled={reportLoadingId === emp.id}
                                  className="group w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center disabled:opacity-50"
                                  title={`Download laporan bulanan ${format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}`}
                                >
                                  {reportLoadingId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                </button>
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
                      const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
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
                              onClick={() => exportEmployeeReport(emp)}
                              disabled={reportLoadingId === emp.id}
                              className="text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center gap-1 disabled:opacity-50 col-span-2"
                            >
                              {reportLoadingId === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              Download Laporan {format(new Date(month + "-01"), "MMM yyyy", { locale: idLocale })}
                            </button>
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
              <SettingsTab
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                workDays={workDays}
                setWorkDays={setWorkDays}
                qrRequired={qrRequired}
                setQrRequired={setQrRequired}
                onSave={saveSettings}
                settingsMsg={settingsMsg}
                month={month}
              />
            )}
          </>
        )}
      </main>

      {/* Edit Profile Modal */}
      {editProfileEmp && (
        <EditProfileModal
          employee={editProfileEmp}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          profileMsg={profileMsg}
          onSave={saveProfile}
          onClose={() => setEditProfileEmp(null)}
        />
      )}

      {/* Reset PIN Modal */}
      {resetPinEmp && (
        <ResetPinModal
          employee={resetPinEmp}
          newPin={newPin}
          setNewPin={setNewPin}
          resetPinMsg={resetPinMsg}
          onSave={resetPin}
          onClose={() => setResetPinEmp(null)}
        />
      )}

      {/* Delete/Deactivate Employee Modal */}
      {deleteEmpTarget && (
        <DeleteEmployeeModal
          employee={deleteEmpTarget}
          onToggleActive={toggleEmployeeActive}
          onDelete={deleteEmployee}
          onClose={() => setDeleteEmpTarget(null)}
        />
      )}

      {/* Edit Work Hours Modal */}
      {editHoursEmp && (
        <EditWorkHoursModal
          employee={editHoursEmp}
          editStart={editStart}
          setEditStart={setEditStart}
          editEnd={editEnd}
          setEditEnd={setEditEnd}
          editHoursMsg={editHoursMsg}
          useCustomSchedule={useCustomSchedule}
          setUseCustomSchedule={setUseCustomSchedule}
          editSchedule={editSchedule}
          updateDaySchedule={updateDaySchedule}
          setEditSchedule={setEditSchedule}
          settings={settings}
          onSave={saveWorkHours}
          onClose={() => setEditHoursEmp(null)}
        />
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

