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
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  AlertTriangle,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Memuat data karyawan...</p>
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

  const statusBadge: Record<string, { text: string; color: string }> = {
    present: { text: "Hadir", color: "bg-green-100 text-green-700" },
    late: { text: "Terlambat", color: "bg-red-100 text-red-700" },
    early_leave: { text: "Pulang Awal", color: "bg-yellow-100 text-yellow-700" },
    absent: { text: "Tidak Hadir", color: "bg-gray-100 text-gray-700" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-4 pb-16 text-white relative">
        <div className="max-w-3xl mx-auto px-4">
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-center font-bold text-lg mb-4">Detail Karyawan</h1>
          <div className="flex flex-col items-center">
            <Avatar name={employee.name} photoUrl={employee.photo_url} size="lg" className="ring-4 ring-white/30" />
            <p className="text-xl font-bold mt-3">{employee.name}</p>
            <p className="text-sm text-white/80">
              {employee.role === "admin" ? "Admin" : employee.position || "Karyawan"}
            </p>
            <div className="flex gap-2 mt-3">
              {employee.phone && (
                <a
                  href={`tel:${employee.phone}`}
                  className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs transition"
                >
                  <Phone size={12} /> Call
                </a>
              )}
              {employee.phone && (
                <a
                  href={`https://wa.me/${employee.phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs transition"
                >
                  WA
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-10 pb-8">
        {/* Stats Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalHours} jam</p>
          <p className="text-xs text-gray-500 mt-1">Total Jam Kerja Bulan Ini</p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white rounded-2xl shadow-sm p-1 mb-4 grid grid-cols-4 gap-0.5">
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
                className={`py-2 rounded-xl text-xs font-semibold transition flex flex-col items-center gap-0.5 ${
                  active ? "bg-primary text-white shadow-sm" : "text-gray-500"
                }`}
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
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-500">{attendance.length} hari data</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "info" && (
          <div className="space-y-4">
            {/* Contact */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Informasi Kontak</h2>
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
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Informasi Kerja</h2>
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
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
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
                    <div key={day} className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-700">{DAY_LABELS[day]}</span>
                      {isOff ? (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                          Libur
                        </span>
                      ) : hasCustom ? (
                        <span className="text-sm text-primary font-semibold">
                          {s.start} - {s.end}
                        </span>
                      ) : defaultStart && defaultEnd ? (
                        <span className="text-sm text-gray-700">
                          {defaultStart} - {defaultEnd}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Default</span>
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
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                Belum ada data absensi bulan ini
              </div>
            ) : (
              attendance.map((a) => {
                const eff = getEffectiveWorkHours(employee, null, new Date(a.date));
                return (
                  <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {format(new Date(a.date), "EEEE", { locale: idLocale })}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {format(new Date(a.date), "dd MMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                          statusBadge[a.status]?.color || ""
                        }`}
                      >
                        {statusBadge[a.status]?.text || a.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-[10px] text-green-600 uppercase font-medium">Clock In</p>
                        <p className="font-bold text-green-700">
                          {a.clock_in ? format(new Date(a.clock_in), "HH:mm") : "-"}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2">
                        <p className="text-[10px] text-orange-600 uppercase font-medium">Clock Out</p>
                        <p className="font-bold text-orange-700">
                          {a.clock_out ? format(new Date(a.clock_out), "HH:mm") : "-"}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-500 uppercase font-medium">Jadwal</p>
                        <p className="font-bold text-gray-700">
                          {eff.off ? "Libur" : `${eff.start.slice(0, 5)}-${eff.end.slice(0, 5)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {a.clock_in_photo && (
                        <button
                          onClick={() => setPhotoModal(a.clock_in_photo!)}
                          className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-lg"
                        >
                          <ImageIcon size={12} /> Foto In
                        </button>
                      )}
                      {a.clock_out_photo && (
                        <button
                          onClick={() => setPhotoModal(a.clock_out_photo!)}
                          className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-1 rounded-lg"
                        >
                          <ImageIcon size={12} /> Foto Out
                        </button>
                      )}
                      {a.clock_in_lat && (
                        <a
                          href={`https://www.google.com/maps?q=${a.clock_in_lat},${a.clock_in_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded-lg"
                        >
                          <MapPin size={12} /> Lokasi
                        </a>
                      )}
                    </div>
                    {a.notes && <p className="text-xs text-gray-500 mt-2 italic">Ket: {a.notes}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "cuti" && (
          <div className="space-y-2">
            {leaves.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                Belum ada pengajuan cuti/izin
              </div>
            ) : (
              leaves.map((l) => {
                const typeInfo = {
                  izin: { emoji: "📝", label: "Izin" },
                  cuti: { emoji: "🏖️", label: "Cuti" },
                  sakit: { emoji: "🏥", label: "Sakit" },
                }[l.leave_type];
                const statusInfo = {
                  pending: { label: "Menunggu", color: "bg-yellow-50 text-yellow-700" },
                  approved: { label: "Disetujui", color: "bg-green-50 text-green-700" },
                  rejected: { label: "Ditolak", color: "bg-red-50 text-red-700" },
                }[l.status];
                return (
                  <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeInfo.emoji}</span>
                        <div>
                          <p className="font-semibold text-sm">{typeInfo.label}</p>
                          <p className="text-[10px] text-gray-400">
                            {format(new Date(l.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 mb-2">
                      <p className="text-[10px] text-gray-500">Periode</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(l.start_date), "dd MMM", { locale: idLocale })}
                        {l.start_date !== l.end_date &&
                          ` - ${format(new Date(l.end_date), "dd MMM yyyy", { locale: idLocale })}`}
                      </p>
                    </div>
                    <p className="text-xs text-gray-700">{l.reason}</p>
                    {l.admin_notes && (
                      <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t">
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
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                Belum ada pengajuan reimburse
              </div>
            ) : (
              reimbs.map((r) => {
                const catEmoji = {
                  umum: "📦",
                  transport: "🚗",
                  makanan: "🍱",
                  medis: "💊",
                  lainnya: "📋",
                }[r.category] || "📋";
                const statusInfo = {
                  pending: { label: "Menunggu", color: "bg-yellow-50 text-yellow-700" },
                  approved: { label: "Disetujui", color: "bg-green-50 text-green-700" },
                  rejected: { label: "Ditolak", color: "bg-red-50 text-red-700" },
                }[r.status];
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{catEmoji}</span>
                        <div>
                          <p className="font-semibold text-sm capitalize">{r.category}</p>
                          <p className="text-[10px] text-gray-400">
                            {format(new Date(r.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      Rp {Number(r.amount).toLocaleString("id-ID")}
                    </p>
                    {r.description && (
                      <p className="text-xs text-gray-600 mt-1">{r.description}</p>
                    )}
                    {r.bank_account && (
                      <p className="text-[11px] text-gray-500 font-mono mt-1">
                        Rek: {r.bank_account}
                      </p>
                    )}
                    {r.attachment_url && (
                      <a
                        href={r.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1"
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
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <img src={photoModal} alt="foto" className="max-w-full max-h-full rounded-2xl" />
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
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</p>
        <p className={`text-sm text-gray-700 break-words ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
