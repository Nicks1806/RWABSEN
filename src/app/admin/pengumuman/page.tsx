"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Announcement, Employee } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Trash2,
  Edit3,
  X,
  CheckCircle,
  AlertTriangle,
  Send,
} from "lucide-react";

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Employee | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal" as "normal" | "important" | "urgent",
    is_active: true,
    sendNotif: true,
    start_date: "",
    end_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data || []);
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role !== "admin") {
      router.push("/");
      return;
    }
    setAdmin(emp);
    fetchItems();

    // Realtime
    const channel = supabase
      .channel("admin-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () =>
        fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, fetchItems]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      body: "",
      priority: "normal",
      is_active: true,
      sendNotif: true,
      start_date: "",
      end_date: "",
    });
    setShowForm(true);
    setMsg(null);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority,
      is_active: a.is_active,
      sendNotif: false,
      start_date: a.start_date || "",
      end_date: a.end_date || "",
    });
    setShowForm(true);
    setMsg(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setMsg(null);
    if (!form.title.trim() || !form.body.trim()) {
      setMsg({ type: "error", text: "Judul dan isi wajib diisi" });
      return;
    }
    setLoading(true);

    if (editing) {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: form.title.trim(),
          body: form.body.trim(),
          priority: form.priority,
          is_active: form.is_active,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) {
        setMsg({ type: "error", text: "Gagal: " + error.message });
        setLoading(false);
        return;
      }
      setMsg({ type: "success", text: "Pengumuman diperbarui!" });
    } else {
      const { data: inserted, error } = await supabase
        .from("announcements")
        .insert({
          title: form.title.trim(),
          body: form.body.trim(),
          priority: form.priority,
          is_active: form.is_active,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          created_by: admin.id,
        })
        .select()
        .single();
      if (error) {
        setMsg({ type: "error", text: "Gagal: " + error.message });
        setLoading(false);
        return;
      }
      setMsg({ type: "success", text: "Pengumuman dipublish!" });

      // Send push notif to all employees if enabled
      if (form.sendNotif && inserted) {
        const { data: employees } = await supabase
          .from("employees")
          .select("id")
          .eq("role", "employee")
          .eq("is_active", true);
        if (employees && employees.length > 0) {
          const prefix = form.priority === "urgent" ? "🚨 " : form.priority === "important" ? "📢 " : "📣 ";
          fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employee_ids: employees.map((e) => e.id),
              title: prefix + form.title.trim(),
              body: form.body.trim().slice(0, 120),
              url: "/home",
            }),
          }).catch((err) => console.error(err));
        }
      }
    }

    setLoading(false);
    setTimeout(() => {
      setShowForm(false);
      setMsg(null);
      fetchItems();
    }, 1200);
  }

  async function deleteItem(id: string) {
    if (!confirm("Hapus pengumuman ini?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    fetchItems();
  }

  async function toggleActive(a: Announcement) {
    await supabase
      .from("announcements")
      .update({ is_active: !a.is_active, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    fetchItems();
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "var(--surface-100)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="ico-circ"
              style={{ color: "var(--ink-muted)" }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="rw-micro">ADMIN</p>
              <h1 className="rw-heading flex items-center gap-2">
                <Megaphone size={18} style={{ color: "var(--wine)" }} /> Pengumuman
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Create button */}
        <button
          onClick={openCreate}
          className="rw-btn rw-btn--primary rw-btn--block"
          style={{ borderRadius: "var(--radius-xl)", fontWeight: 600 }}
        >
          <Plus size={18} /> Buat Pengumuman Baru
        </button>

        {/* List */}
        <div className="space-y-3">
          {items.length === 0 ? (
            <div
              className="rw-card"
              style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}
            >
              <Megaphone
                size={32}
                style={{ color: "var(--line-strong)", margin: "0 auto var(--space-2)" }}
              />
              <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>Belum ada pengumuman</p>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: "var(--space-1)", opacity: 0.7 }}>
                Klik tombol di atas untuk buat pengumuman pertama
              </p>
            </div>
          ) : (
            items.map((a) => {
              const borderColor =
                a.priority === "urgent"
                  ? "var(--danger)"
                  : a.priority === "important"
                  ? "var(--warning)"
                  : "var(--sand)";
              const cardBg =
                a.priority === "urgent"
                  ? "var(--danger-tint)"
                  : a.priority === "important"
                  ? "var(--warning-tint)"
                  : "var(--surface-200)";
              return (
                <div
                  key={a.id}
                  className="rw-card"
                  style={{
                    borderLeft: `4px solid ${borderColor}`,
                    background: cardBg,
                    opacity: !a.is_active ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2" style={{ marginBottom: "var(--space-1)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{a.title}</p>
                      {a.priority === "urgent" && (
                        <span className="rw-badge--danger">PENTING</span>
                      )}
                      {a.priority === "important" && (
                        <span className="rw-badge--warning">INFO</span>
                      )}
                      {!a.is_active && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "var(--surface-300)",
                            color: "var(--ink-muted)",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            fontWeight: 500,
                          }}
                        >
                          NONAKTIF
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}>{a.body}</p>
                  <p className="rw-micro" style={{ marginTop: "var(--space-2)" }}>
                    {format(new Date(a.created_at), "dd MMM yyyy • HH:mm", { locale: idLocale })}
                  </p>
                  <div className="flex gap-2" style={{ marginTop: "var(--space-3)" }}>
                    <button
                      onClick={() => openEdit(a)}
                      className="rw-btn rw-btn--outline rw-btn--sm"
                      style={{
                        flex: 1,
                        borderColor: "var(--wine-tint)",
                        color: "var(--wine)",
                        background: "var(--wine-tint)",
                      }}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(a)}
                      className="rw-btn rw-btn--outline rw-btn--sm"
                      style={{
                        flex: 1,
                        borderColor: a.is_active ? "var(--line)" : "var(--success-tint)",
                        color: a.is_active ? "var(--ink-muted)" : "var(--success)",
                        background: a.is_active ? "var(--surface-300)" : "var(--success-tint)",
                      }}
                    >
                      {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => deleteItem(a.id)}
                      className="rw-btn rw-btn--sm"
                      style={{
                        background: "var(--danger-tint)",
                        color: "var(--danger)",
                        border: "1px solid var(--danger-tint)",
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Form Modal ── */}
      {showForm && (
        <div
          className="rw-overlay flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowForm(false)}
        >
          <div
            className="rw-sheet animate-slide-up"
            style={{ maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 z-10" style={{ background: "var(--surface-200)" }}>
              <div style={{ width: 40, height: 4, background: "var(--line)", borderRadius: "var(--radius-full)" }} />
            </div>

            {/* Modal header */}
            <div
              style={{
                background: "linear-gradient(135deg, var(--wine), var(--wine-deep))",
                padding: "var(--space-4) var(--space-5) var(--space-5)",
                color: "var(--on-wine)",
                position: "relative",
              }}
            >
              <button
                onClick={() => !loading && setShowForm(false)}
                className="ico-circ"
                style={{
                  position: "absolute",
                  top: "var(--space-4)",
                  right: "var(--space-4)",
                  background: "rgba(255,255,255,0.2)",
                  color: "var(--on-wine)",
                }}
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "var(--radius-lg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Megaphone size={22} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 18 }}>
                    {editing ? "Edit Pengumuman" : "Pengumuman Baru"}
                  </h3>
                  <p style={{ fontSize: 12, opacity: 0.8 }}>Kirim ke semua karyawan</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submitForm} style={{ padding: "var(--space-5)" }} className="space-y-4">
              {/* Judul */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>
                  JUDUL
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Libur Idul Fitri"
                  className="rw-input"
                  style={{ width: "100%" }}
                  required
                  maxLength={100}
                />
              </div>

              {/* Isi */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>
                  ISI PENGUMUMAN
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  placeholder="Tulis detail pengumuman..."
                  className="rw-input"
                  style={{ width: "100%", resize: "none" }}
                  required
                />
              </div>

              {/* Prioritas */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>
                  PRIORITAS
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "normal", label: "Biasa", borderClr: "var(--sand)", textClr: "var(--ink)" },
                    { key: "important", label: "Info", borderClr: "var(--warning)", textClr: "var(--warning)" },
                    { key: "urgent", label: "Penting", borderClr: "var(--danger)", textClr: "var(--danger)" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p.key })}
                      style={{
                        padding: "var(--space-2)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                        fontWeight: 600,
                        borderLeft: `4px solid ${form.priority === p.key ? p.borderClr : "var(--line)"}`,
                        background: form.priority === p.key ? "var(--surface-200)" : "var(--surface-300)",
                        color: form.priority === p.key ? p.textClr : "var(--ink-muted)",
                        boxShadow: form.priority === p.key ? "var(--shadow-sm)" : "none",
                        transform: form.priority === p.key ? "scale(1.05)" : "scale(1)",
                        transition: "all 0.15s ease",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period / Jadwal tampil */}
              <div>
                <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-2)" }}>
                  PERIODE TAYANG (OPSIONAL)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    style={{
                      background: "var(--surface-300)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-2) var(--space-3)",
                    }}
                  >
                    <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                      DARI TANGGAL
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      style={{
                        width: "100%",
                        background: "transparent",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ink)",
                        outline: "none",
                        border: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      background: "var(--surface-300)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-2) var(--space-3)",
                    }}
                  >
                    <label className="rw-micro" style={{ display: "block", marginBottom: "var(--space-1)" }}>
                      SAMPAI TANGGAL
                    </label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      style={{
                        width: "100%",
                        background: "transparent",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ink)",
                        outline: "none",
                        border: "none",
                      }}
                    />
                  </div>
                </div>
                <p className="rw-micro" style={{ marginTop: "var(--space-1)", opacity: 0.7 }}>
                  Kosongkan untuk tampil selamanya. Contoh: promo 10-20 April atau libur 1-7 Mei.
                </p>
              </div>

              {/* Active toggle */}
              <label
                className="flex items-center justify-between cursor-pointer"
                style={{
                  background: "var(--surface-300)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Tampilkan ke Karyawan</p>
                  <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>Nonaktifkan untuk sembunyikan</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div
                  className="peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all relative"
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: "var(--radius-full)",
                    background: form.is_active ? "var(--wine)" : "var(--line-strong)",
                    flexShrink: 0,
                  }}
                />
              </label>

              {/* Send Notif */}
              {!editing && (
                <label
                  className="flex items-center justify-between cursor-pointer"
                  style={{
                    background: "var(--warning-tint)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    border: "1px solid var(--warning)",
                    borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
                  }}
                >
                  <div>
                    <p className="flex items-center gap-1" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                      <Send size={12} /> Kirim Push Notifikasi
                    </p>
                    <p style={{ fontSize: 11, color: "var(--warning)" }}>Notif ke HP semua karyawan</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.sendNotif}
                    onChange={(e) => setForm({ ...form, sendNotif: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div
                    className="peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all relative"
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: "var(--radius-full)",
                      background: form.sendNotif ? "var(--wine)" : "var(--line-strong)",
                      flexShrink: 0,
                    }}
                  />
                </label>
              )}

              {/* Message */}
              {msg && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 14,
                    background: msg.type === "success" ? "var(--success-tint)" : "var(--danger-tint)",
                    color: msg.type === "success" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {msg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2" style={{ paddingTop: "var(--space-1)" }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                  className="rw-btn rw-btn--outline"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rw-btn rw-btn--primary"
                  style={{ flex: 2 }}
                >
                  {loading ? "Mengirim..." : editing ? "Simpan" : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
