"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Leave } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, FileText, CheckCircle, XCircle, Clock, X, AlertTriangle } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function PengajuanPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leave_type: "izin" as "cuti" | "sakit" | "izin",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchLeaves = useCallback(async (empId: string) => {
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false });
    setLeaves(data || []);
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role === "admin") {
      router.push("/");
      return;
    }
    setEmployee(emp);
    fetchLeaves(emp.id);
  }, [router, fetchLeaves]);

  // Realtime
  useEffect(() => {
    if (!employee) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchLeaves(employee.id), 500);
    };

    const channel = supabase
      .channel("pengajuan-leaves")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leaves",
          filter: `employee_id=eq.${employee.id}`,
        },
        triggerRefetch
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [employee, fetchLeaves]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setMsg(null);
    if (!form.reason.trim()) {
      setMsg({ type: "error", text: "Alasan wajib diisi" });
      return;
    }
    if (form.end_date < form.start_date) {
      setMsg({ type: "error", text: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leaves").insert({
      employee_id: employee.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      status: "pending",
    });
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: "Gagal: " + error.message });
      return;
    }
    setMsg({ type: "success", text: "Pengajuan terkirim! Menunggu approval." });

    // Notify admin
    try {
      const { data: admins } = await supabase.from("employees").select("id").eq("role", "admin");
      if (admins && admins.length > 0) {
        const typeName = form.leave_type === "cuti" ? "Cuti" : form.leave_type === "sakit" ? "Sakit" : "Izin";
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_ids: admins.map((a) => a.id),
            title: `Pengajuan ${typeName} Baru`,
            body: `${employee.name} mengajukan ${typeName.toLowerCase()} — butuh approval.`,
            url: "/admin",
          }),
        });
      }
    } catch (err) {
      console.error(err);
    }

    setTimeout(() => {
      setShowForm(false);
      setForm({
        leave_type: "izin",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      setMsg(null);
      fetchLeaves(employee.id);
    }, 1500);
  }

  const filtered = leaves.filter((l) => filter === "all" || l.status === filter);

  const stats = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary-dark text-white pt-6 pb-14 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-center font-bold text-lg">Pengajuan Saya</h1>
          <p className="text-center text-xs text-white/80 mt-1">Cuti, Izin, Sakit</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-8 pb-8 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Menunggu" value={stats.pending} color="yellow" />
          <StatCard label="Disetujui" value={stats.approved} color="green" />
          <StatCard label="Ditolak" value={stats.rejected} color="red" />
        </div>

        {/* Submit Button */}
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 bg-primary text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary-dark transition"
        >
          <Plus size={18} /> Ajukan Baru
        </button>

        {/* Filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {[
            { key: "all" as const, label: "Semua" },
            { key: "pending" as const, label: "Menunggu" },
            { key: "approved" as const, label: "Disetujui" },
            { key: "rejected" as const, label: "Ditolak" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                filter === f.key
                  ? "bg-primary text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <FileText size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada pengajuan</p>
            </div>
          ) : (
            filtered.map((leave) => (
              <LeaveCard key={leave.id} leave={leave} />
            ))
          )}
        </div>
      </main>

      {/* Leave Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowForm(false)}
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
                onClick={() => !loading && setShowForm(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pengajuan Baru</h3>
                  <p className="text-xs text-white/80">Izin / Cuti / Sakit</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitLeave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Jenis</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "izin", label: "Izin", emoji: "📝" },
                    { key: "cuti", label: "Cuti", emoji: "🏖️" },
                    { key: "sakit", label: "Sakit", emoji: "🏥" },
                  ] as const).map((t) => {
                    const active = form.leave_type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm({ ...form, leave_type: t.key })}
                        className={`py-3 rounded-xl text-center transition-all ${
                          active
                            ? "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/20"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className="text-2xl">{t.emoji}</div>
                        <div className="text-xs font-semibold mt-0.5">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Periode</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">DARI</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">SAMPAI</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
                      required
                    />
                  </div>
                </div>
                {form.start_date && form.end_date && (() => {
                  const days =
                    Math.round(
                      (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1;
                  return (
                    <p className="text-[11px] text-primary font-medium mt-1.5 text-right">
                      Total: {days} hari
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Alasan</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  placeholder="Contoh: Acara keluarga, sakit flu..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
                  required
                />
              </div>

              {msg && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {msg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span className="flex-1">{msg.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? "Mengirim..." : "Kirim Pengajuan"}
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

function StatCard({ label, value, color }: { label: string; value: number; color: "yellow" | "green" | "red" }) {
  const colors = {
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-2xl p-3 text-center shadow-sm ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] font-medium">{label}</p>
    </div>
  );
}

function LeaveCard({ leave }: { leave: Leave }) {
  const typeInfo = {
    izin: { emoji: "📝", label: "Izin", color: "bg-purple-50 text-purple-700" },
    cuti: { emoji: "🏖️", label: "Cuti", color: "bg-blue-50 text-blue-700" },
    sakit: { emoji: "🏥", label: "Sakit", color: "bg-orange-50 text-orange-700" },
  }[leave.leave_type];

  const statusInfo = {
    pending: {
      icon: <Clock size={14} />,
      label: "Menunggu",
      color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    approved: {
      icon: <CheckCircle size={14} />,
      label: "Disetujui",
      color: "bg-green-50 text-green-700 border-green-200",
    },
    rejected: {
      icon: <XCircle size={14} />,
      label: "Ditolak",
      color: "bg-red-50 text-red-700 border-red-200",
    },
  }[leave.status];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeInfo.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{typeInfo.label}</p>
            <p className="text-[10px] text-gray-400">
              {format(new Date(leave.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium ${statusInfo.color}`}
        >
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>
      <div className="bg-gray-50 rounded-xl p-2.5 mb-2">
        <p className="text-[11px] text-gray-500 mb-0.5">Periode</p>
        <p className="text-sm font-semibold text-gray-700">
          {format(new Date(leave.start_date), "dd MMM", { locale: idLocale })}
          {leave.start_date !== leave.end_date &&
            ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
          {leave.start_date === leave.end_date &&
            ` ${format(new Date(leave.end_date), "yyyy", { locale: idLocale })}`}
        </p>
      </div>
      <p className="text-xs text-gray-600">{leave.reason}</p>
      {leave.admin_notes && (
        <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t">
          Catatan admin: {leave.admin_notes}
        </p>
      )}
    </div>
  );
}
