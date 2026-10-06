"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Employee, Attendance, Settings, DayKey, Schedule, Leave, Reimbursement } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  LogOut,
  Users,
  Clock,
  Settings as SettingsIcon,
  X,
  TrendingUp,
  FileText as FileTextIcon,
  QrCode,
  Megaphone,
  ClipboardList,
} from "lucide-react";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import SettingsTab from "@/components/admin/SettingsTab";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import DashboardTab from "@/components/admin/DashboardTab";
import LeavesTab from "@/components/admin/LeavesTab";
import KaryawanTab from "@/components/admin/KaryawanTab";
import EditProfileModal from "@/components/admin/EditProfileModal";
import ResetPinModal from "@/components/admin/ResetPinModal";
import DeleteEmployeeModal from "@/components/admin/DeleteEmployeeModal";
import EditWorkHoursModal from "@/components/admin/EditWorkHoursModal";
import { getEffectiveWorkHours } from "@/lib/workHours";

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

  // Today's attendance, independent of the selected month
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([]);
  const settingsFormInitRef = useRef(false);

  // Guards against stale responses: switching month quickly could let a slow
  // older response arrive last and overwrite the newer month's data
  const fetchSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    const date = new Date(month + "-01");
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const [empRes, attRes, todayRes, setRes, leavesRes, reimbRes] = await Promise.all([
      supabase.from("employees").select("*").eq("is_active", true).order("name"),
      supabase
        .from("attendance")
        .select("*, employees(name)")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false }),
      // Today's rows fetched separately so "Hari Ini" stats stay correct
      // even when the admin is viewing a different month
      supabase.from("attendance").select("*, employees(name)").eq("date", todayStr),
      supabase.from("settings").select("*").single(),
      // Month-scoped history + ALL pending (a request for next month must
      // still show up for approval). Previously fetched every row ever.
      supabase
        .from("leaves")
        .select("*")
        .or(`status.eq.pending,and(start_date.lte.${end},end_date.gte.${start})`)
        .order("created_at", { ascending: false }),
      supabase
        .from("reimbursements")
        .select("*")
        .or(`status.eq.pending,and(transaction_date.gte.${start},transaction_date.lte.${end})`)
        .order("created_at", { ascending: false }),
    ]);

    if (leavesRes.error) console.error("Leaves fetch error:", leavesRes.error);

    if (seq !== fetchSeqRef.current) return; // a newer fetch finished first

    setEmployees(empRes.data || []);
    setRecords(attRes.data || []);
    setTodayRecords(todayRes.data || []);

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
      // Populate the settings form only once — refetches (window focus,
      // realtime) must not wipe values the admin is still typing
      if (!settingsFormInitRef.current) {
        settingsFormInitRef.current = true;
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
    const { error } = await supabase
      .from("reimbursements")
      .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast("Gagal update reimburse: " + error.message, "error");
      return;
    }
    setSelectedReimbIds(new Set());
    fetchData();
  }

  async function reviewLeave(id: string, status: "approved" | "rejected", notes: string = "") {
    const reviewerId = admin?.id || null;
    // Get leave for notification
    const leave = leaves.find((l) => l.id === id);
    const { error } = await supabase
      .from("leaves")
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast("Gagal update pengajuan: " + error.message, "error");
      return;
    }

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
    const { error } = await supabase
      .from("reimbursements")
      .update({
        status,
        admin_notes: notes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast("Gagal update reimburse: " + error.message, "error");
      return;
    }

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
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart)
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

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{ background: "var(--surface-200)", boxShadow: "var(--shadow-sm)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rw-heading" style={{ color: "var(--wine)" }}>RedWine</span>
            <span
              className="text-xs pl-2"
              style={{ color: "var(--ink-muted)", borderLeft: "1px solid var(--line)" }}
            >Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/tasks")}
              className="flex items-center gap-1 text-sm transition"
              style={{ color: "var(--ink-muted)" }}
              title="Task Board"
            >
              <ClipboardList size={16} />
              <span className="hidden sm:inline">Tasks</span>
            </button>
            <button
              onClick={() => router.push("/admin/pengumuman")}
              className="flex items-center gap-1 text-sm transition"
              style={{ color: "var(--ink-muted)" }}
              title="Pengumuman"
            >
              <Megaphone size={16} />
              <span className="hidden sm:inline">Pengumuman</span>
            </button>
            <button
              onClick={() => router.push("/admin/qr")}
              className="flex items-center gap-1 text-sm transition"
              style={{ color: "var(--ink-muted)" }}
              title="QR Code Absensi"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline">QR</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm transition"
              style={{ color: "var(--ink-muted)" }}
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div
        className="sticky top-[52px] z-10"
        style={{ background: "var(--surface-200)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="max-w-7xl mx-auto px-2 md:px-4 flex gap-0.5 md:gap-1 overflow-x-auto scrollbar-hide">
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
              className={`shrink-0 flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium transition relative whitespace-nowrap ${isTabPending && activeTab === tab.key ? "opacity-60" : ""}`}
              style={{
                borderRadius: activeTab === tab.key ? "var(--radius-md) var(--radius-md) 0 0" : undefined,
                background: activeTab === tab.key ? "var(--wine)" : "transparent",
                color: activeTab === tab.key ? "var(--on-wine)" : "var(--ink-muted)",
              }}
            >
              {tab.icon} {tab.label}
              {"badge" in tab && tab.badge && tab.badge > 0 ? (
                <span
                  className="ml-1 text-[10px] font-bold px-1.5 py-0.5 min-w-[16px] text-center"
                  style={{
                    borderRadius: "var(--radius-full)",
                    background: activeTab === tab.key ? "var(--on-wine)" : "var(--crimson)",
                    color: activeTab === tab.key ? "var(--wine)" : "var(--on-wine)",
                  }}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6 overflow-x-hidden">
        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--ink-muted)" }}>Memuat data...</div>
        ) : (
          <>
            {/* DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <DashboardTab
                lateClockIn={lateClockIn}
                missingClockOut={missingClockOut}
                totalEmployees={totalEmployees}
                presentToday={presentToday}
                lateToday={lateToday}
                reminderMsg={reminderMsg}
                reminderSending={reminderSending}
                onSendClockOutReminder={sendClockOutReminder}
                topRajin={topRajin}
                topTelat={topTelat}
                month={month}
                setMonth={setMonth}
                globalSearch={globalSearch}
                setGlobalSearch={setGlobalSearch}
                onExportPDF={exportPDF}
                onExportExcel={exportExcel}
                employees={employees}
                empStatsMap={empStatsMap}
                getMonthlyHours={getMonthlyHours}
                filterEmployee={filterEmployee}
                setFilterEmployee={setFilterEmployee}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filteredRecords={filteredRecords}
                recordsEmpty={records.length === 0}
                setPhotoModal={setPhotoModal}
                onDeleteAttendance={deleteAttendance}
              />
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
              <LeavesTab
                leaves={leaves}
                reimbs={reimbs}
                leavesSubTab={leavesSubTab}
                setLeavesSubTab={setLeavesSubTab}
                leaveFilter={leaveFilter}
                setLeaveFilter={setLeaveFilter}
                selectedLeaveIds={selectedLeaveIds}
                setSelectedLeaveIds={setSelectedLeaveIds}
                selectedReimbIds={selectedReimbIds}
                setSelectedReimbIds={setSelectedReimbIds}
                onBulkReviewLeaves={bulkReviewLeaves}
                onBulkReviewReimbs={bulkReviewReimbs}
                onReviewLeave={reviewLeave}
                onReviewReimb={reviewReimb}
                globalSearch={globalSearch}
              />
            )}

            {/* KARYAWAN TAB */}
            {activeTab === "karyawan" && (
              <KaryawanTab
                employees={employees}
                settings={settings}
                effHoursMap={effHoursMap}
                month={month}
                showPins={showPins}
                setShowPins={setShowPins}
                newEmployee={newEmployee}
                setNewEmployee={setNewEmployee}
                empMsg={empMsg}
                onAddEmployee={addEmployee}
                reportLoadingId={reportLoadingId}
                onExportEmployeeReport={exportEmployeeReport}
                onOpenEmployee={(id) => router.push(`/admin/karyawan/${id}`)}
                onOpenResetPin={(emp) => {
                  setResetPinEmp(emp);
                  setNewPin("");
                  setResetPinMsg("");
                }}
                onOpenEditProfile={(emp) => {
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
                onOpenEditHours={(emp) => {
                  setEditHoursEmp(emp);
                  setEditStart(emp.work_start || "");
                  setEditEnd(emp.work_end || "");
                  // Always load the existing per-day schedule — saving with the
                  // toggle off nulls `schedule`, so opening without loading it
                  // (old mobile path) silently wiped custom schedules
                  setEditSchedule(emp.schedule || {});
                  setUseCustomSchedule(!!emp.schedule && Object.keys(emp.schedule).length > 0);
                  setEditHoursMsg("");
                }}
                onTestNotif={sendTestNotif}
                onDeleteEmployee={setDeleteEmpTarget}
              />
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
          className="rw-overlay flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPhotoModal(null)}
              className="absolute -top-3 -right-3 p-1"
              style={{
                background: "var(--surface-200)",
                borderRadius: "var(--radius-full)",
                boxShadow: "var(--shadow-md)",
                color: "var(--ink)",
              }}
            >
              <X size={20} />
            </button>
            <img
              src={photoModal}
              alt="Foto Absensi"
              className="w-full"
              style={{ borderRadius: "var(--radius-lg)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

