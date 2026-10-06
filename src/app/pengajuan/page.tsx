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
    if (error) {
      setLoading(false);
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
      setLoading(false);
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

    if (bankAcct && bankAcct !== employee.bank_account) {
      await supabase.from("employees").update({ bank_account: bankAcct }).eq("id", employee.id);
    }
    if (error) {
      setLoading(false);
      setMsg({ type: "error", text: "Gagal: " + error.message });
      return;
    }
    setMsg({ type: "success", text: "Reimburse terkirim!" });

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
        bank_account: employee?.bank_account || "",
      });
      setReimbFile(null);
      setMsg(null);
      setLoading(false);
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
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-4 pt-4 pb-3"
        style={{ background: "var(--surface-100)" }}
      >
        <div className="max-w-lg mx-auto">
          <p className="rw-micro text-center" style={{ marginBottom: 4 }}>Pengajuan</p>
          <h1 className="rw-heading text-center" style={{ color: "var(--ink)" }}>
            {topTab === "izin" ? "Izin & Cuti" : "Reimburse"}
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-28" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Top Tab Switcher */}
        <div
          className="rw-card grid grid-cols-2"
          style={{ padding: "var(--space-1)", gap: "var(--space-1)" }}
        >
          <button
            onClick={() => { setTopTab("izin"); setFilter("all"); }}
            style={{
              padding: "var(--space-3) var(--space-2)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: topTab === "izin" ? "var(--wine)" : "transparent",
              color: topTab === "izin" ? "var(--on-wine)" : "var(--ink-muted)",
            }}
          >
            <FileText size={16} /> Izin/Cuti
          </button>
          <button
            onClick={() => { setTopTab("reimburse"); setFilter("all"); }}
            style={{
              padding: "var(--space-3) var(--space-2)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: topTab === "reimburse" ? "var(--wine)" : "transparent",
              color: topTab === "reimburse" ? "var(--on-wine)" : "var(--ink-muted)",
            }}
          >
            <Wallet size={16} /> Reimburse
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3" style={{ gap: "var(--space-2)" }}>
          <StatCard label="Menunggu" value={stats.pending} variant="warning" />
          <StatCard label="Disetujui" value={stats.approved} variant="success" />
          <StatCard label="Ditolak" value={stats.rejected} variant="danger" />
        </div>

        {/* Submit Button */}
        <button
          onClick={() => {
            if (topTab === "izin") {
              setShowLeaveForm(true);
            } else {
              setReimbForm((prev) => ({ ...prev, bank_account: employee?.bank_account || "" }));
              setShowReimbForm(true);
            }
          }}
          className="rw-btn rw-btn--primary rw-btn--block"
          style={{ borderRadius: "var(--radius-lg)" }}
        >
          <Plus size={18} /> Ajukan Baru
        </button>

        {/* Filter */}
        <div className="flex overflow-x-auto scrollbar-hide" style={{ gap: "var(--space-2)" }}>
          {[
            { key: "all" as const, label: "Semua" },
            { key: "pending" as const, label: "Menunggu" },
            { key: "approved" as const, label: "Disetujui" },
            { key: "rejected" as const, label: "Ditolak" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                border: filter === f.key ? "1px solid var(--wine)" : "1px solid var(--line)",
                background: filter === f.key ? "var(--wine-tint)" : "var(--surface-200)",
                color: filter === f.key ? "var(--wine)" : "var(--ink-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {filtered.length === 0 ? (
            <div className="rw-card" style={{ padding: "var(--space-8)", textAlign: "center" }}>
              {topTab === "izin" ? (
                <FileText size={32} style={{ color: "var(--ink-muted)", margin: "0 auto 8px", opacity: 0.4 }} />
              ) : (
                <Wallet size={32} style={{ color: "var(--ink-muted)", margin: "0 auto 8px", opacity: 0.4 }} />
              )}
              <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>Belum ada pengajuan</p>
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
          className="rw-overlay"
          onClick={() => !loading && setShowLeaveForm(false)}
        >
          <div
            className="rw-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 z-10" style={{ background: "var(--surface-200)" }}>
              <div style={{ width: 40, height: 4, borderRadius: "var(--radius-full)", background: "var(--line)" }} />
            </div>

            {/* Wine header */}
            <div
              style={{
                background: "var(--wine)",
                padding: "var(--space-4) var(--space-5) var(--space-5)",
                color: "var(--on-wine)",
                position: "relative",
              }}
            >
              <button
                onClick={() => !loading && setShowLeaveForm(false)}
                className="ico-circ"
                style={{
                  position: "absolute",
                  top: "var(--space-4)",
                  right: "var(--space-4)",
                  width: 32,
                  height: 32,
                  background: "rgba(255,255,255,0.15)",
                  color: "var(--on-wine)",
                  border: "none",
                }}
              >
                <X size={18} />
              </button>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="rw-heading" style={{ color: "var(--on-wine)" }}>Pengajuan Baru</h3>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>Izin / Cuti / Sakit</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitLeave} style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Leave type */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Jenis</label>
                <div className="grid grid-cols-3" style={{ gap: "var(--space-2)" }}>
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
                        style={{
                          padding: "var(--space-3)",
                          borderRadius: "var(--radius-md)",
                          textAlign: "center",
                          border: active ? "2px solid var(--wine)" : "1px solid var(--line)",
                          background: active ? "var(--wine-tint)" : "var(--surface-200)",
                          color: active ? "var(--wine)" : "var(--ink)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: 24 }}>{t.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Period */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Periode</label>
                <div className="grid grid-cols-2" style={{ gap: "var(--space-2)" }}>
                  <div style={{ background: "var(--surface-100)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-1)" }}>Dari</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      style={{ width: "100%", background: "transparent", fontSize: 14, fontWeight: 600, color: "var(--ink)", border: "none", outline: "none" }}
                      required
                    />
                  </div>
                  <div style={{ background: "var(--surface-100)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-1)" }}>Sampai</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      style={{ width: "100%", background: "transparent", fontSize: 14, fontWeight: 600, color: "var(--ink)", border: "none", outline: "none" }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Alasan</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Contoh: Acara keluarga, sakit flu..."
                  className="rw-input"
                  style={{ resize: "none", minHeight: "auto", paddingTop: 10, paddingBottom: 10 }}
                  required
                />
              </div>

              {msg && (
                <div
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: msg.type === "success" ? "var(--success-tint)" : "var(--danger-tint)",
                    color: msg.type === "success" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {msg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span style={{ flex: 1 }}>{msg.text}</span>
                </div>
              )}

              <div className="flex" style={{ gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  disabled={loading}
                  className="rw-btn rw-btn--outline rw-btn--sm"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rw-btn rw-btn--primary rw-btn--sm"
                  style={{ flex: 2 }}
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
          className="rw-overlay"
          onClick={() => !loading && setShowReimbForm(false)}
        >
          <div
            className="rw-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 z-10" style={{ background: "var(--surface-200)" }}>
              <div style={{ width: 40, height: 4, borderRadius: "var(--radius-full)", background: "var(--line)" }} />
            </div>

            {/* Wine header */}
            <div
              style={{
                background: "var(--wine)",
                padding: "var(--space-4) var(--space-5) var(--space-5)",
                color: "var(--on-wine)",
                position: "relative",
              }}
            >
              <button
                onClick={() => !loading && setShowReimbForm(false)}
                className="ico-circ"
                style={{
                  position: "absolute",
                  top: "var(--space-4)",
                  right: "var(--space-4)",
                  width: 32,
                  height: 32,
                  background: "rgba(255,255,255,0.15)",
                  color: "var(--on-wine)",
                  border: "none",
                }}
              >
                <X size={18} />
              </button>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Wallet size={22} />
                </div>
                <div>
                  <h3 className="rw-heading" style={{ color: "var(--on-wine)" }}>Pengajuan Reimburse</h3>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>Klaim pengeluaran</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitReimb} style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Category */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Kategori</label>
                <div className="grid grid-cols-3" style={{ gap: "var(--space-2)" }}>
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
                        style={{
                          padding: "var(--space-2) var(--space-1)",
                          borderRadius: "var(--radius-md)",
                          textAlign: "center",
                          border: active ? "2px solid var(--wine)" : "1px solid var(--line)",
                          background: active ? "var(--wine-tint)" : "var(--surface-200)",
                          color: active ? "var(--wine)" : "var(--ink)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: 20 }}>{t.emoji}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transaction date */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Tanggal Transaksi</label>
                <input
                  type="date"
                  value={reimbForm.transaction_date}
                  onChange={(e) => setReimbForm({ ...reimbForm, transaction_date: e.target.value })}
                  className="rw-input"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Jumlah (Rp)</label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--ink-muted)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Rp
                  </span>
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
                    className="rw-input"
                    style={{ paddingLeft: 40, fontWeight: 600 }}
                    required
                  />
                </div>
              </div>

              {/* Bank account */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
                  <label className="rw-micro">No. Rekening</label>
                  {employee?.bank_account && reimbForm.bank_account === employee.bank_account && (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      fontSize: 10,
                      fontWeight: 600,
                      background: "var(--success-tint)",
                      color: "var(--success)",
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--success)" }} /> Dari profil
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={reimbForm.bank_account}
                  onChange={(e) => setReimbForm({ ...reimbForm, bank_account: e.target.value })}
                  placeholder="Contoh: BCA 1234567890 a/n Anselline"
                  className="rw-input"
                  required
                />
                <p style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
                  Rekening untuk transfer penggantian. Ubah sekali → otomatis tersimpan di profil.
                </p>
              </div>

              {/* File upload */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Bukti (Opsional)</label>
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
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    border: reimbFile ? "2px dashed var(--success)" : "2px dashed var(--line)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer",
                    background: reimbFile ? "var(--success-tint)" : "transparent",
                    color: reimbFile ? "var(--success)" : "var(--ink-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {reimbFile ? (
                    <>
                      <ImageIcon size={16} />
                      <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reimbFile.name}</span>
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
                    style={{ fontSize: 12, color: "var(--danger)", marginTop: "var(--space-1)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Hapus file
                  </button>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>Deskripsi</label>
                <textarea
                  value={reimbForm.description}
                  onChange={(e) => setReimbForm({ ...reimbForm, description: e.target.value })}
                  rows={3}
                  placeholder="Detail pengeluaran..."
                  className="rw-input"
                  style={{ resize: "none", minHeight: "auto", paddingTop: 10, paddingBottom: 10 }}
                />
              </div>

              {msg && (
                <div
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: msg.type === "success" ? "var(--success-tint)" : "var(--danger-tint)",
                    color: msg.type === "success" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {msg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span style={{ flex: 1 }}>{msg.text}</span>
                </div>
              )}

              <div className="flex" style={{ gap: "var(--space-2)", paddingTop: "var(--space-1)" }}>
                <button
                  type="button"
                  onClick={() => setShowReimbForm(false)}
                  disabled={loading}
                  className="rw-btn rw-btn--outline rw-btn--sm"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rw-btn rw-btn--primary rw-btn--sm"
                  style={{ flex: 2 }}
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

function StatCard({ label, value, variant }: { label: string; value: number; variant: "warning" | "success" | "danger" }) {
  const styles = {
    warning: { bg: "var(--warning-tint)", color: "var(--warning)" },
    success: { bg: "var(--success-tint)", color: "var(--success)" },
    danger: { bg: "var(--danger-tint)", color: "var(--danger)" },
  }[variant];

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-3)",
        textAlign: "center",
        background: styles.bg,
        border: "1px solid var(--line)",
      }}
    >
      <p style={{ fontSize: 24, fontWeight: 700, color: styles.color, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="rw-micro" style={{ color: styles.color }}>{label}</p>
    </div>
  );
}

function statusInfo(status: "pending" | "approved" | "rejected") {
  return {
    pending: {
      icon: <Clock size={14} />,
      label: "Menunggu",
      bg: "var(--warning-tint)",
      color: "var(--warning)",
    },
    approved: {
      icon: <CheckCircle size={14} />,
      label: "Disetujui",
      bg: "var(--success-tint)",
      color: "var(--success)",
    },
    rejected: {
      icon: <XCircle size={14} />,
      label: "Ditolak",
      bg: "var(--danger-tint)",
      color: "var(--danger)",
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
    <div className="rw-card">
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <span style={{ fontSize: 24 }}>{typeInfo.emoji}</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{typeInfo.label}</p>
            <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
              {format(new Date(leave.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
            </p>
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: s.bg,
            color: s.color,
          }}
        >
          {s.icon} {s.label}
        </span>
      </div>

      <div
        style={{
          background: "var(--surface-100)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-2) var(--space-3)",
          marginBottom: "var(--space-2)",
        }}
      >
        <p className="rw-micro" style={{ marginBottom: 2 }}>Periode</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
          {format(new Date(leave.start_date), "dd MMM", { locale: idLocale })}
          {leave.start_date !== leave.end_date &&
            ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
          {leave.start_date === leave.end_date && ` ${format(new Date(leave.end_date), "yyyy", { locale: idLocale })}`}
        </p>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>{leave.reason}</p>

      {leave.admin_notes && (
        <p style={{ fontSize: 12, color: "var(--ink-muted)", fontStyle: "italic", marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--line)" }}>
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
    <div className="rw-card">
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
          <span style={{ fontSize: 24 }}>{catInfo.emoji}</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{catInfo.label}</p>
            <p style={{ fontSize: 10, color: "var(--ink-muted)" }}>
              {format(new Date(reimb.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
            </p>
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            background: s.bg,
            color: s.color,
          }}
        >
          {s.icon} {s.label}
        </span>
      </div>

      <div
        style={{
          background: "var(--wine-tint)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          marginBottom: "var(--space-2)",
        }}
      >
        <p className="rw-micro" style={{ marginBottom: 2 }}>Jumlah</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--wine)", fontVariantNumeric: "tabular-nums" }}>
          Rp {reimb.amount.toLocaleString("id-ID")}
        </p>
        <p style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
          Transaksi: {format(new Date(reimb.transaction_date), "dd MMM yyyy", { locale: idLocale })}
        </p>
      </div>

      {reimb.description && <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>{reimb.description}</p>}

      {reimb.bank_account && (
        <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>
          <span style={{ opacity: 0.7 }}>Rek: </span>
          <span style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>{reimb.bank_account}</span>
        </p>
      )}

      {reimb.attachment_url && (
        <a
          href={reimb.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "var(--space-2)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--wine)",
          }}
        >
          <ImageIcon size={12} /> Lihat bukti
        </a>
      )}

      {reimb.admin_notes && (
        <p style={{ fontSize: 12, color: "var(--ink-muted)", fontStyle: "italic", marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--line)" }}>
          Catatan admin: {reimb.admin_notes}
        </p>
      )}
    </div>
  );
}
