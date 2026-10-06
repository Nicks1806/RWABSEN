"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Attendance, Leave, Reimbursement } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  CreditCard,
  Clock,
  FileText,
  Wallet,
  User as UserIcon,
  Image as ImageIcon,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { getEffectiveWorkHours, DAY_LABELS, DAY_ORDER } from "@/lib/workHours";

type Tab = "info" | "absensi" | "cuti" | "reimburse";

export default function KaryawanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: empId } = use(params);
  const router = useRouter();
  const [admin, setAdmin] = useState<Employee | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [reimbs, setReimbs] = useState<Reimbursement[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const date = new Date(month + "-01");
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");

    const [empRes, attRes, leaveRes, reimbRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", empId).single(),
      supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", empId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false }),
      supabase
        .from("leaves")
        .select("*")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false }),
      supabase
        .from("reimbursements")
        .select("*")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false }),
    ]);

    if (empRes.data) setEmployee(empRes.data);
    setAttendance(attRes.data || []);
    setLeaves(leaveRes.data || []);
    setReimbs(reimbRes.data || []);
    setLoading(false);
  }, [empId, month]);

  useEffect(() => {
    const a = getStoredEmployee();
    if (!a || a.role !== "admin") {
      router.push("/");
      return;
    }
    setAdmin(a);
    fetchData();
  }, [router, fetchData]);

  // Realtime
  useEffect(() => {
    if (!admin) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchData(), 500);
    };
    const channel = supabase
      .channel(`karyawan-detail-${empId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `employee_id=eq.${empId}` }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves", filter: `employee_id=eq.${empId}` }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements", filter: `employee_id=eq.${empId}` }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `id=eq.${empId}` }, triggerRefetch)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [admin, empId, fetchData]);

  if (!admin || loading || !employee) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--surface-100)" }}
      >
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Memuat data karyawan...</p>
      </div>
    );
  }

  // Calculate stats
  let totalMins = 0;
  let lateCount = 0;
  for (const r of attendance) {
    if (r.status === "late") lateCount++;
    if (r.clock_in && r.clock_out) {
      totalMins += (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000;
    }
  }
  const totalHours = Math.round((totalMins / 60) * 10) / 10;
  const presentDays = attendance.filter((a) => a.clock_in).length;

  const statusBadge: Record<string, { text: string; bg: string; color: string }> = {
    present: { text: "Hadir", bg: "var(--success-tint)", color: "var(--success)" },
    late: { text: "Terlambat", bg: "var(--danger-tint)", color: "var(--danger)" },
    early_leave: { text: "Pulang Awal", bg: "var(--warning-tint)", color: "var(--warning)" },
    absent: { text: "Tidak Hadir", bg: "var(--surface-300)", color: "var(--ink-muted)" },
  };

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Profile Header */}
      <div
        className="pt-4 pb-20 relative"
        style={{
          background: "linear-gradient(135deg, var(--wine), var(--wine-deep))",
          color: "var(--on-wine)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4">
          <button
            onClick={() => router.back()}
            className="ico-circ absolute top-4 left-4"
            style={{
              background: "rgba(255,255,255,0.18)",
              color: "var(--on-wine)",
              border: "none",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <p className="rw-micro text-center" style={{ color: "rgba(250,246,236,0.7)", letterSpacing: "0.08em" }}>
            DETAIL KARYAWAN
          </p>
          <div className="flex flex-col items-center mt-2">
            <Avatar
              name={employee.name}
              photoUrl={employee.photo_url}
              size="lg"
              className="ring-4"
              style={{ "--tw-ring-color": "rgba(255,255,255,0.25)" } as React.CSSProperties}
            />
            <p className="text-xl font-bold mt-3">{employee.name}</p>
            <p className="text-sm" style={{ color: "rgba(250,246,236,0.75)" }}>
              {employee.role === "admin" ? "Admin" : employee.position || "Karyawan"}
            </p>
            <div className="flex gap-2 mt-3">
              {employee.phone && (
                <a
                  href={`tel:${employee.phone}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    color: "var(--on-wine)",
                  }}
                >
                  <Phone size={12} /> Call
                </a>
              )}
              {employee.phone && (
                <a
                  href={`https://wa.me/${employee.phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    color: "var(--on-wine)",
                  }}
                >
                  WA
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-12 pb-8 relative z-10">
        {/* Stats Summary */}
        <div
          className="rw-card grid grid-cols-3 mb-4"
          style={{ padding: "16px 20px" }}
        >
          <div className="text-center" style={{ borderRight: "1px solid var(--line)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--success)" }}>{presentDays}</p>
            <p className="rw-micro" style={{ fontSize: 10 }}>Hari Hadir</p>
          </div>
          <div className="text-center" style={{ borderRight: "1px solid var(--line)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--danger)" }}>{lateCount}</p>
            <p className="rw-micro" style={{ fontSize: 10 }}>Terlambat</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold" style={{ color: "var(--wine)" }}>{totalHours}</p>
            <p className="rw-micro" style={{ fontSize: 10 }}>Jam Kerja</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          className="rw-card grid grid-cols-4 gap-1 mb-4"
          style={{ padding: "4px" }}
        >
          {[
            { key: "info" as Tab, label: "Info", icon: UserIcon },
            { key: "absensi" as Tab, label: "Absensi", icon: Clock },
            { key: "cuti" as Tab, label: "Cuti", icon: FileText },
            { key: "reimburse" as Tab, label: "Reimburse", icon: Wallet },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="py-2 text-xs font-semibold transition flex flex-col items-center gap-0.5"
                style={{
                  borderRadius: "var(--radius-md)",
                  background: active ? "var(--wine)" : "transparent",
                  color: active ? "var(--on-wine)" : "var(--ink-muted)",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Month selector - only for absensi tab */}
        {activeTab === "absensi" && (
          <div className="mb-4 flex items-center justify-between">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rw-input text-sm"
              style={{ width: "auto" }}
            />
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{attendance.length} hari data</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "info" && (
          <div className="space-y-4">
            {/* Contact */}
            <div className="rw-card">
              <h2 className="rw-heading" style={{ marginBottom: 12 }}>Informasi Kontak</h2>
              <div className="space-y-3">
                <InfoRow icon={<Phone size={16} />} label="Nomor HP" value={employee.phone || "-"} />
                <InfoRow icon={<Mail size={16} />} label="Email" value={employee.email || "-"} />
                <InfoRow icon={<MapPin size={16} />} label="Alamat" value={employee.address || "-"} />
                <InfoRow
                  icon={<CreditCard size={16} />}
                  label="No. Rekening"
                  value={employee.bank_account || "-"}
                  mono
                />
              </div>
            </div>

            {/* Work Info */}
            <div className="rw-card">
              <h2 className="rw-heading" style={{ marginBottom: 12 }}>Informasi Kerja</h2>
              <div className="space-y-3">
                <InfoRow icon={<Briefcase size={16} />} label="Posisi" value={employee.position || "-"} />
                <InfoRow
                  icon={<Calendar size={16} />}
                  label="Tanggal Bergabung"
                  value={
                    employee.join_date
                      ? format(new Date(employee.join_date), "dd MMM yyyy", { locale: idLocale })
                      : "-"
                  }
                />
                <InfoRow
                  icon={<UserIcon size={16} />}
                  label="Role"
                  value={employee.role === "admin" ? "Admin" : "Karyawan"}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="rw-card">
              <h2 className="rw-heading flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Clock size={16} /> Jadwal Kerja
              </h2>
              <div className="space-y-1.5">
                {DAY_ORDER.map((day) => {
                  const s = employee.schedule?.[day];
                  const isOff = s?.off;
                  const hasCustom = s?.start && s?.end;
                  const defaultStart = employee.work_start?.slice(0, 5);
                  const defaultEnd = employee.work_end?.slice(0, 5);

                  return (
                    <div
                      key={day}
                      className="flex justify-between items-center py-1.5 px-3 rounded-lg transition"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                      {isOff ? (
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
                        >
                          Libur
                        </span>
                      ) : hasCustom ? (
                        <span className="text-sm font-semibold" style={{ color: "var(--wine)" }}>
                          {s.start} - {s.end}
                        </span>
                      ) : defaultStart && defaultEnd ? (
                        <span className="text-sm" style={{ color: "var(--ink)" }}>
                          {defaultStart} - {defaultEnd}
                        </span>
                      ) : (
                        <span className="text-xs italic" style={{ color: "var(--ink-muted)" }}>Default</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "absensi" && (
          <div className="space-y-2">
            {attendance.length === 0 ? (
              <div className="rw-card text-center" style={{ padding: 32, color: "var(--ink-muted)" }}>
                Belum ada data absensi bulan ini
              </div>
            ) : (
              attendance.map((a) => {
                const eff = getEffectiveWorkHours(employee, null, new Date(a.date));
                const badge = statusBadge[a.status];
                return (
                  <div key={a.id} className="rw-card">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                          {format(new Date(a.date), "EEEE", { locale: idLocale })}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                          {format(new Date(a.date), "dd MMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: badge?.bg || "var(--surface-300)",
                          color: badge?.color || "var(--ink-muted)",
                        }}
                      >
                        {badge?.text || a.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div
                        className="rounded-lg p-2"
                        style={{ background: "var(--success-tint)" }}
                      >
                        <p
                          className="uppercase font-medium"
                          style={{ fontSize: 10, color: "var(--success)" }}
                        >
                          Clock In
                        </p>
                        <p className="font-bold" style={{ color: "var(--success)" }}>
                          {a.clock_in ? format(new Date(a.clock_in), "HH:mm") : "-"}
                        </p>
                      </div>
                      <div
                        className="rounded-lg p-2"
                        style={{ background: "var(--warning-tint)" }}
                      >
                        <p
                          className="uppercase font-medium"
                          style={{ fontSize: 10, color: "var(--warning)" }}
                        >
                          Clock Out
                        </p>
                        <p className="font-bold" style={{ color: "var(--warning)" }}>
                          {a.clock_out ? format(new Date(a.clock_out), "HH:mm") : "-"}
                        </p>
                      </div>
                      <div
                        className="rounded-lg p-2"
                        style={{ background: "var(--surface-300)" }}
                      >
                        <p
                          className="uppercase font-medium"
                          style={{ fontSize: 10, color: "var(--ink-muted)" }}
                        >
                          Jadwal
                        </p>
                        <p className="font-bold" style={{ color: "var(--ink)" }}>
                          {eff.off ? "Libur" : `${eff.start.slice(0, 5)}-${eff.end.slice(0, 5)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {a.clock_in_photo && (
                        <button
                          onClick={() => setPhotoModal(a.clock_in_photo!)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ color: "var(--success)", background: "var(--success-tint)" }}
                        >
                          <ImageIcon size={12} /> Foto In
                        </button>
                      )}
                      {a.clock_out_photo && (
                        <button
                          onClick={() => setPhotoModal(a.clock_out_photo!)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ color: "var(--warning)", background: "var(--warning-tint)" }}
                        >
                          <ImageIcon size={12} /> Foto Out
                        </button>
                      )}
                      {a.clock_in_lat && (
                        <a
                          href={`https://www.google.com/maps?q=${a.clock_in_lat},${a.clock_in_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ color: "var(--wine)", background: "var(--wine-tint)" }}
                        >
                          <MapPin size={12} /> Lokasi
                        </a>
                      )}
                    </div>
                    {a.notes && (
                      <p className="text-xs mt-2 italic" style={{ color: "var(--ink-muted)" }}>
                        Ket: {a.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "cuti" && (
          <div className="space-y-2">
            {leaves.length === 0 ? (
              <div className="rw-card text-center" style={{ padding: 32, color: "var(--ink-muted)" }}>
                Belum ada pengajuan cuti/izin
              </div>
            ) : (
              leaves.map((l) => {
                const typeInfo = {
                  izin: { emoji: "\u{1F4DD}", label: "Izin" },
                  cuti: { emoji: "\u{1F3D6}️", label: "Cuti" },
                  sakit: { emoji: "\u{1F3E5}", label: "Sakit" },
                }[l.leave_type];
                const statusInfo: Record<string, { label: string; bg: string; color: string }> = {
                  pending: { label: "Menunggu", bg: "var(--warning-tint)", color: "var(--warning)" },
                  approved: { label: "Disetujui", bg: "var(--success-tint)", color: "var(--success)" },
                  rejected: { label: "Ditolak", bg: "var(--danger-tint)", color: "var(--danger)" },
                };
                const si = statusInfo[l.status];
                return (
                  <div key={l.id} className="rw-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeInfo.emoji}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                            {typeInfo.label}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                            {format(new Date(l.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                        style={{ background: si?.bg, color: si?.color }}
                      >
                        {si?.label || l.status}
                      </span>
                    </div>
                    <div
                      className="rounded-lg p-2 mb-2"
                      style={{ background: "var(--surface-300)" }}
                    >
                      <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>Periode</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {format(new Date(l.start_date), "dd MMM", { locale: idLocale })}
                        {l.start_date !== l.end_date &&
                          ` - ${format(new Date(l.end_date), "dd MMM yyyy", { locale: idLocale })}`}
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: "var(--ink)" }}>{l.reason}</p>
                    {l.admin_notes && (
                      <p
                        className="text-xs italic mt-2 pt-2"
                        style={{ color: "var(--ink-muted)", borderTop: "1px solid var(--line)" }}
                      >
                        Catatan: {l.admin_notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "reimburse" && (
          <div className="space-y-2">
            {reimbs.length === 0 ? (
              <div className="rw-card text-center" style={{ padding: 32, color: "var(--ink-muted)" }}>
                Belum ada pengajuan reimburse
              </div>
            ) : (
              reimbs.map((r) => {
                const catEmoji = {
                  umum: "\u{1F4E6}",
                  transport: "\u{1F697}",
                  makanan: "\u{1F371}",
                  medis: "\u{1F48A}",
                  lainnya: "\u{1F4CB}",
                }[r.category] || "\u{1F4CB}";
                const statusInfo: Record<string, { label: string; bg: string; color: string }> = {
                  pending: { label: "Menunggu", bg: "var(--warning-tint)", color: "var(--warning)" },
                  approved: { label: "Disetujui", bg: "var(--success-tint)", color: "var(--success)" },
                  rejected: { label: "Ditolak", bg: "var(--danger-tint)", color: "var(--danger)" },
                };
                const si = statusInfo[r.status];
                return (
                  <div key={r.id} className="rw-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{catEmoji}</span>
                        <div>
                          <p className="font-semibold text-sm capitalize" style={{ color: "var(--ink)" }}>
                            {r.category}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                            {format(new Date(r.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                        style={{ background: si?.bg, color: si?.color }}
                      >
                        {si?.label || r.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: "var(--wine)" }}>
                      Rp {Number(r.amount).toLocaleString("id-ID")}
                    </p>
                    {r.description && (
                      <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>{r.description}</p>
                    )}
                    {r.bank_account && (
                      <p className="font-mono mt-1" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                        Rek: {r.bank_account}
                      </p>
                    )}
                    {r.attachment_url && (
                      <a
                        href={r.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs mt-1"
                        style={{ color: "var(--wine)" }}
                      >
                        <ImageIcon size={12} /> Lihat bukti
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Photo Modal */}
      {photoModal && (
        <div
          className="rw-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <img
            src={photoModal}
            alt="foto"
            className="max-w-full max-h-full"
            style={{ borderRadius: "var(--radius-lg)" }}
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--surface-300)", color: "var(--ink-muted)" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium mb-0.5" style={{ fontSize: 11, color: "var(--ink-muted)" }}>{label}</p>
        <p className={`text-sm break-words ${mono ? "font-mono" : ""}`} style={{ color: "var(--ink)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
