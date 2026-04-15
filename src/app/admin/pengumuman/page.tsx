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
import Logo from "@/components/Logo";

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
    setForm({ title: "", body: "", priority: "normal", is_active: true, sendNotif: true });
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin")} className="text-gray-500 hover:text-primary">
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-gray-800 flex items-center gap-2">
              <Megaphone size={18} /> Pengumuman
            </h1>
          </div>
          <Logo size="sm" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Create button */}
        <button
          onClick={openCreate}
          className="w-full py-3 bg-primary text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary-dark transition"
        >
          <Plus size={18} /> Buat Pengumuman Baru
        </button>

        {/* List */}
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <Megaphone size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada pengumuman</p>
              <p className="text-xs text-gray-400 mt-1">Klik tombol di atas untuk buat pengumuman pertama</p>
            </div>
          ) : (
            items.map((a) => {
              const colors = {
                normal: "border-l-blue-400 bg-white",
                important: "border-l-amber-500 bg-amber-50",
                urgent: "border-l-red-500 bg-red-50",
              }[a.priority];
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl shadow-sm border-l-4 p-4 ${colors} ${
                    !a.is_active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-800">{a.title}</p>
                      {a.priority === "urgent" && (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                          PENTING
                        </span>
                      )}
                      {a.priority === "important" && (
                        <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                          INFO
                        </span>
                      )}
                      {!a.is_active && (
                        <span className="text-[10px] bg-gray-300 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                          NONAKTIF
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{a.body}</p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {format(new Date(a.created_at), "dd MMM yyyy • HH:mm", { locale: idLocale })}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openEdit(a)}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center justify-center gap-1 font-medium"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(a)}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-medium ${
                        a.is_active
                          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => deleteItem(a.id)}
                      className="text-xs py-1.5 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center gap-1 font-medium"
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

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowForm(false)}
        >
          <div
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto"
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
                  <Megaphone size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {editing ? "Edit Pengumuman" : "Pengumuman Baru"}
                  </h3>
                  <p className="text-xs text-white/80">Kirim ke semua karyawan</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitForm} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Judul</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Libur Idul Fitri"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Isi Pengumuman</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  placeholder="Tulis detail pengumuman..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Prioritas</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "normal", label: "Biasa", color: "border-blue-400 text-blue-700" },
                    { key: "important", label: "Info", color: "border-amber-500 text-amber-700" },
                    { key: "urgent", label: "Penting", color: "border-red-500 text-red-700" },
                  ] as const).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p.key })}
                      className={`py-2 rounded-xl text-xs font-semibold border-l-4 bg-gray-50 transition ${
                        form.priority === p.key
                          ? `${p.color} bg-white shadow-md scale-105`
                          : "border-gray-300 text-gray-500"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center justify-between bg-gray-50 rounded-xl p-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Tampilkan ke Karyawan</p>
                  <p className="text-[11px] text-gray-500">Nonaktifkan untuk sembunyikan</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all relative"></div>
              </label>

              {/* Send Notif */}
              {!editing && (
                <label className="flex items-center justify-between bg-amber-50 rounded-xl p-3 cursor-pointer border border-amber-200">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Send size={12} /> Kirim Push Notifikasi
                    </p>
                    <p className="text-[11px] text-amber-700">Notif ke HP semua karyawan</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.sendNotif}
                    onChange={(e) => setForm({ ...form, sendNotif: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all relative"></div>
                </label>
              )}

              {msg && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {msg.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{msg.text}</span>
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
