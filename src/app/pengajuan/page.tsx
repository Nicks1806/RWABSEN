"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Leave, Reimbursement } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  X,
  AlertTriangle,
  Wallet,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

type TopTab = "izin" | "reimburse";

export default function PengajuanPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [topTab, setTopTab] = useState<TopTab>("izin");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [reimbs, setReimbs] = useState<Reimbursement[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "izin" as "cuti" | "sakit" | "izin",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  // Reimburse form
  const [showReimbForm, setShowReimbForm] = useState(false);
  const [reimbForm, setReimbForm] = useState({
    category: "umum" as "umum" | "transport" | "makanan" | "medis" | "lainnya",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    description: "",
    bank_account: "",
  });
  const [reimbFile, setReimbFile] = useState<File | null>(null);
  const reimbFileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async (empId: string) => {
    const [lRes, rRes] = await Promise.all([
      supabase.from("leaves").select("*").eq("employee_id", empId).order("created_at", { ascending: false }),
      supabase.from("reimbursements").select("*").eq("employee_id", empId).order("created_at", { ascending: false }),
    ]);
    setLeaves(lRes.data || []);
    setReimbs(rRes.data || []);
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role === "admin") {
      router.push("/");
      return;
    }
    setEmployee(emp);
    fetchData(emp.id);
  }, [router, fetchData]);

  // Realtime
  useEffect(() => {
    if (!employee) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchData(employee.id), 500);
    };

    const channel = supabase
      .channel("pengajuan-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves", filter: `employee_id=eq.${employee.id}` }, triggerRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements", filter: `employee_id=eq.${employee.id}` }, triggerRefetch)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [employee, fetchData]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setMsg(null);
    if (!leaveForm.reason.trim()) {
      setMsg({ type: "error", text: "Alasan wajib diisi" });
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      setMsg({ type: "error", text: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leaves").insert({
      employee_id: employee.id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason.trim(),
      status: "pending",
    });
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: "Gagal: " + error.message });
      return;
    }
    setMsg({ type: "success", text: "Pengajuan terkirim!" });

    try {
      const { data: admins } = await supabase.from("employees").select("id").eq("role", "admin");
      if (admins && admins.length > 0) {
        const typeName = leaveForm.leave_type === "cuti" ? "Cuti" : leaveForm.leave_type === "sakit" ? "Sakit" : "Izin";
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
      setShowLeaveForm(false);
      setLeaveForm({
        leave_type: "izin",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      setMsg(null);
    }, 1500);
  }

  async function submitReimb(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setMsg(null);
    const amount = parseFloat(reimbForm.amount.replace(/[^\d]/g, ""));
    if (!amount || amount <= 0) {
      setMsg({ type: "error", text: "Jumlah harus lebih dari 0" });
      return;
    }
    setLoading(true);

    // Upload attachment if exists
    let attachmentUrl: string | null = null;
    if (reimbFile) {
      try {
        const ext = reimbFile.name.split(".").pop() || "jpg";
        const filename = `reimburse/${employee.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("attendance-photos")
          .upload(filename, reimbFile, { upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
        attachmentUrl = data.publicUrl;
      } catch (err) {
        setLoading(false);
        setMsg({ type: "error", text: "Gagal upload bukti: " + (err instanceof Error ? err.message : "err") });
        return;
      }
    }

    const bankAcct = reimbForm.bank_account.trim() || null;

    const { error } = await supabase.from("reimbursements").insert({
      employee_id: employee.id,
      category: reimbForm.category,
      transaction_date: reimbForm.transaction_date,
      amount,
      description: reimbForm.description.trim() || null,
      attachment_url: attachmentUrl,
      bank_account: bankAcct,
      status: "pending",
    });

    // Save bank_account to employee profile if changed (for next time)
    if (bankAcct && bankAcct !== employee.bank_account) {
      await supabase.from("employees").update({ bank_account: bankAcct }).eq("id", employee.id);
    }
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: "Gagal: " + error.message });
      return;
    }
    setMsg({ type: "success", text: "Reimburse terkirim!" });

    // Notify admin
    try {
      const { data: admins } = await supabase.from("employees").select("id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_ids: admins.map((a) => a.id),
            title: "Pengajuan Reimburse Baru",
            body: `${employee.name} mengajukan reimburse Rp ${amount.toLocaleString("id-ID")} — butuh approval.`,
            url: "/admin",
          }),
        });
      }
    } catch (err) {
      console.error(err);
    }

    setTimeout(() => {
      setShowReimbForm(false);
      setReimbForm({
        category: "umum",
        transaction_date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        description: "",
        bank_account: "",
      });
      setReimbFile(null);
      setMsg(null);
    }, 1500);
  }

  const list = topTab === "izin" ? leaves : reimbs;
  const filtered = list.filter((l) => filter === "all" || l.status === filter);

  const stats = {
    pending: list.filter((l) => l.status === "pending").length,
    approved: list.filter((l) => l.status === "approved").length,
    rejected: list.filter((l) => l.status === "rejected").length,
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-primary to-primary-dark text-white pt-6 pb-14 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-center font-bold text-lg">Pengajuan Saya</h1>
          <p className="text-center text-xs text-white/80 mt-1">
            {topTab === "izin" ? "Cuti, Izin, Sakit" : "Reimburse biaya"}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-8 pb-8 space-y-4">
        {/* Top Tab Switcher */}
        <div className="bg-white rounded-2xl shadow-sm p-1 grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              setTopTab("izin");
              setFilter("all");
            }}
            className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              topTab === "izin" ? "bg-primary text-white shadow-sm" : "text-gray-500"
            }`}
          >
            <FileText size={16} /> Izin/Cuti
          </button>
          <button
            onClick={() => {
              setTopTab("reimburse");
              setFilter("all");
            }}
            className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              topTab === "reimburse" ? "bg-primary text-white shadow-sm" : "text-gray-500"
            }`}
          >
            <Wallet size={16} /> Reimburse
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Menunggu" value={stats.pending} color="yellow" />
          <StatCard label="Disetujui" value={stats.approved} color="green" />
          <StatCard label="Ditolak" value={stats.rejected} color="red" />
        </div>

        {/* Submit Button */}
        <button
          onClick={() => {
            if (topTab === "izin") {
              setShowLeaveForm(true);
            } else {
              // Prefill bank_account from profile
              setReimbForm((prev) => ({ ...prev, bank_account: employee?.bank_account || "" }));
              setShowReimbForm(true);
            }
          }}
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
              {topTab === "izin" ? (
                <FileText size={32} className="text-gray-300 mx-auto mb-2" />
              ) : (
                <Wallet size={32} className="text-gray-300 mx-auto mb-2" />
              )}
              <p className="text-sm text-gray-400">Belum ada pengajuan</p>
            </div>
          ) : topTab === "izin" ? (
            (filtered as Leave[]).map((leave) => <LeaveCard key={leave.id} leave={leave} />)
          ) : (
            (filtered as Reimbursement[]).map((r) => <ReimbCard key={r.id} reimb={r} />)
          )}
        </div>
      </main>

      {/* Leave Form Modal */}
      {showLeaveForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowLeaveForm(false)}
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
                onClick={() => !loading && setShowLeaveForm(false)}
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
                    const active = leaveForm.leave_type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setLeaveForm({ ...leaveForm, leave_type: t.key })}
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
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <label className="block text-[10px] text-gray-500 font-medium mb-1">SAMPAI</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Alasan</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
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
                  onClick={() => setShowLeaveForm(false)}
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

      {/* Reimburse Form Modal */}
      {showReimbForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowReimbForm(false)}
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
                onClick={() => !loading && setShowReimbForm(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Wallet size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pengajuan Reimburse</h3>
                  <p className="text-xs text-white/80">Klaim pengeluaran</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitReimb} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Kategori</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "umum", label: "Umum", emoji: "📦" },
                    { key: "transport", label: "Transport", emoji: "🚗" },
                    { key: "makanan", label: "Makanan", emoji: "🍱" },
                    { key: "medis", label: "Medis", emoji: "💊" },
                    { key: "lainnya", label: "Lainnya", emoji: "📋" },
                  ] as const).map((t) => {
                    const active = reimbForm.category === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setReimbForm({ ...reimbForm, category: t.key })}
                        className={`py-2.5 rounded-xl text-center transition-all ${
                          active
                            ? "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/20"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className="text-xl">{t.emoji}</div>
                        <div className="text-[10px] font-semibold mt-0.5">{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={reimbForm.transaction_date}
                  onChange={(e) => setReimbForm({ ...reimbForm, transaction_date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Jumlah (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={reimbForm.amount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const formatted = raw ? parseInt(raw).toLocaleString("id-ID") : "";
                      setReimbForm({ ...reimbForm, amount: formatted });
                    }}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">No. Rekening</label>
                <input
                  type="text"
                  value={reimbForm.bank_account}
                  onChange={(e) => setReimbForm({ ...reimbForm, bank_account: e.target.value })}
                  placeholder="Contoh: BCA 1234567890 a/n Anselline"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Rekening untuk transfer penggantian. Otomatis tersimpan di profil untuk pengajuan berikutnya.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Bukti (Opsional)</label>
                <input
                  ref={reimbFileRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReimbFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => reimbFileRef.current?.click()}
                  className={`w-full py-3 border-2 border-dashed rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition ${
                    reimbFile
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-gray-300 text-gray-500 hover:border-primary hover:text-primary"
                  }`}
                >
                  {reimbFile ? (
                    <>
                      <ImageIcon size={16} />
                      <span className="truncate max-w-[200px]">{reimbFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Upload struk/bukti
                    </>
                  )}
                </button>
                {reimbFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setReimbFile(null);
                      if (reimbFileRef.current) reimbFileRef.current.value = "";
                    }}
                    className="text-xs text-red-600 mt-1 underline"
                  >
                    Hapus file
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Deskripsi</label>
                <textarea
                  value={reimbForm.description}
                  onChange={(e) => setReimbForm({ ...reimbForm, description: e.target.value })}
                  rows={3}
                  placeholder="Detail pengeluaran..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
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
                  onClick={() => setShowReimbForm(false)}
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
                  {loading ? "Mengirim..." : "Kirim Reimburse"}
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

function statusInfo(status: "pending" | "approved" | "rejected") {
  return {
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
  }[status];
}

function LeaveCard({ leave }: { leave: Leave }) {
  const typeInfo = {
    izin: { emoji: "📝", label: "Izin" },
    cuti: { emoji: "🏖️", label: "Cuti" },
    sakit: { emoji: "🏥", label: "Sakit" },
  }[leave.leave_type];

  const s = statusInfo(leave.status);

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
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium ${s.color}`}>
          {s.icon} {s.label}
        </span>
      </div>
      <div className="bg-gray-50 rounded-xl p-2.5 mb-2">
        <p className="text-[11px] text-gray-500 mb-0.5">Periode</p>
        <p className="text-sm font-semibold text-gray-700">
          {format(new Date(leave.start_date), "dd MMM", { locale: idLocale })}
          {leave.start_date !== leave.end_date &&
            ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
          {leave.start_date === leave.end_date && ` ${format(new Date(leave.end_date), "yyyy", { locale: idLocale })}`}
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

function ReimbCard({ reimb }: { reimb: Reimbursement }) {
  const catInfo = {
    umum: { emoji: "📦", label: "Umum" },
    transport: { emoji: "🚗", label: "Transport" },
    makanan: { emoji: "🍱", label: "Makanan" },
    medis: { emoji: "💊", label: "Medis" },
    lainnya: { emoji: "📋", label: "Lainnya" },
  }[reimb.category] || { emoji: "📋", label: reimb.category };

  const s = statusInfo(reimb.status);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{catInfo.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{catInfo.label}</p>
            <p className="text-[10px] text-gray-400">
              {format(new Date(reimb.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium ${s.color}`}>
          {s.icon} {s.label}
        </span>
      </div>
      <div className="bg-primary/5 rounded-xl p-3 mb-2">
        <p className="text-[11px] text-gray-500 mb-0.5">Jumlah</p>
        <p className="text-xl font-bold text-primary">
          Rp {reimb.amount.toLocaleString("id-ID")}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          Transaksi: {format(new Date(reimb.transaction_date), "dd MMM yyyy", { locale: idLocale })}
        </p>
      </div>
      {reimb.description && <p className="text-xs text-gray-600">{reimb.description}</p>}
      {reimb.bank_account && (
        <p className="text-xs text-gray-500 mt-1.5">
          <span className="text-gray-400">Rek: </span>
          <span className="font-mono">{reimb.bank_account}</span>
        </p>
      )}
      {reimb.attachment_url && (
        <a
          href={reimb.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ImageIcon size={12} /> Lihat bukti
        </a>
      )}
      {reimb.admin_notes && (
        <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t">
          Catatan admin: {reimb.admin_notes}
        </p>
      )}
    </div>
  );
}
