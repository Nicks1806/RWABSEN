"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Task } from "@/lib/types";
import { format, isToday, isPast } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  X,
  Calendar as CalendarIcon,
  User as UserIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";

type ColKey = "brief" | "today" | "done" | "history";

const COLUMNS: { key: ColKey; label: string; bg: string; ring: string }[] = [
  { key: "brief", label: "Brief", bg: "bg-rose-100", ring: "ring-rose-200" },
  { key: "today", label: "Today", bg: "bg-amber-100", ring: "ring-amber-200" },
  { key: "done", label: "Done", bg: "bg-emerald-100", ring: "ring-emerald-200" },
  { key: "history", label: "History", bg: "bg-blue-100", ring: "ring-blue-200" },
];

const CARD_COLORS: { key: Task["color"]; bg: string; border: string }[] = [
  { key: "red", bg: "bg-rose-50", border: "border-l-rose-500" },
  { key: "yellow", bg: "bg-amber-50", border: "border-l-amber-500" },
  { key: "green", bg: "bg-emerald-50", border: "border-l-emerald-500" },
  { key: "blue", bg: "bg-blue-50", border: "border-l-blue-500" },
  { key: "purple", bg: "bg-purple-50", border: "border-l-purple-500" },
  { key: "gray", bg: "bg-gray-50", border: "border-l-gray-400" },
];

export default function TasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterMine, setFilterMine] = useState(false);
  const [showForm, setShowForm] = useState<{ open: boolean; status: ColKey; task?: Task }>({
    open: false,
    status: "brief",
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    color: "red" as Task["color"],
    assignee_id: "",
    due_date: "",
  });
  const [loading, setLoading] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [tRes, eRes] = await Promise.all([
      supabase.from("tasks").select("*").order("position", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("is_active", true).order("name"),
    ]);
    const empMap = new Map((eRes.data || []).map((e) => [e.id, e]));
    const tasksWithAssignee = (tRes.data || []).map((t) => ({
      ...t,
      assignee: t.assignee_id ? empMap.get(t.assignee_id) || undefined : undefined,
    }));
    setTasks(tasksWithAssignee);
    setEmployees(eRes.data || []);
  }, []);

  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  useEffect(() => {
    const u = getStoredEmployee();
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);
    fetchData();
  }, [router, fetchData]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchRef.current(), 500);
    };
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, trigger)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);

  function openCreate(status: ColKey) {
    setForm({ title: "", description: "", color: "red", assignee_id: user?.id || "", due_date: "" });
    setShowForm({ open: true, status });
  }

  function openEdit(task: Task) {
    setForm({
      title: task.title,
      description: task.description || "",
      color: task.color,
      assignee_id: task.assignee_id || "",
      due_date: task.due_date || "",
    });
    setShowForm({ open: true, status: task.status, task });
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) return;

    setLoading(true);
    if (showForm.task) {
      // Update
      await supabase
        .from("tasks")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          color: form.color,
          assignee_id: form.assignee_id || null,
          due_date: form.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", showForm.task.id);
    } else {
      // Insert
      await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        color: form.color,
        status: showForm.status,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        created_by: user.id,
      });
    }
    setLoading(false);
    setShowForm({ open: false, status: "brief" });
  }

  async function moveTask(task: Task, direction: "left" | "right") {
    const order: ColKey[] = ["brief", "today", "done", "history"];
    const idx = order.indexOf(task.status);
    const newIdx = direction === "left" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= order.length) return;
    await supabase.from("tasks").update({ status: order[newIdx], updated_at: new Date().toISOString() }).eq("id", task.id);
  }

  async function deleteTask(id: string) {
    if (!confirm("Hapus task ini?")) return;
    await supabase.from("tasks").delete().eq("id", id);
  }

  const filteredTasks = filterMine && user ? tasks.filter((t) => t.assignee_id === user.id) : tasks;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-primary">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-bold text-gray-800 truncate">Task Board</h1>
              <p className="text-[10px] text-gray-400">{tasks.length} tasks</p>
            </div>
          </div>
          <button
            onClick={() => setFilterMine(!filterMine)}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
              filterMine
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Filter size={12} /> {filterMine ? "Tugas Saya" : "Semua"}
          </button>
        </div>
      </header>

      {/* Kanban */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={colsRef}
          className="h-full overflow-x-auto px-3 py-4 flex gap-3 snap-x snap-mandatory"
        >
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className={`shrink-0 w-72 ${col.bg} rounded-2xl flex flex-col snap-start max-h-full`}
              >
                {/* Column header */}
                <div className="px-3 py-3 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-gray-800">{col.label}</h3>
                    <span className="text-[10px] bg-white/60 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {colTasks.map((task) => {
                    const cardColor =
                      CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
                    const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                    const todayDue = task.due_date && isToday(new Date(task.due_date));

                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-xl shadow-sm border-l-4 ${cardColor.border} p-3 hover:shadow-md transition group`}
                      >
                        <button
                          onClick={() => openEdit(task)}
                          className="w-full text-left"
                        >
                          <p className="font-semibold text-sm text-gray-800 line-clamp-2">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </button>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {task.assignee && (
                              <div className="flex items-center gap-1">
                                <Avatar
                                  name={task.assignee.name}
                                  photoUrl={task.assignee.photo_url}
                                  size="xs"
                                />
                                <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                                  {task.assignee.name.split(" ")[0]}
                                </span>
                              </div>
                            )}
                            {task.due_date && (
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  overdue
                                    ? "bg-red-100 text-red-700"
                                    : todayDue
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <CalendarIcon size={9} />
                                {format(new Date(task.due_date), "dd MMM", { locale: idLocale })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => moveTask(task, "left")}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              title="Pindah kiri"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              onClick={() => moveTask(task, "right")}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              title="Pindah kanan"
                            >
                              <ChevronRight size={14} />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1 hover:bg-red-100 rounded text-red-500"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Quick move buttons (mobile - always visible) */}
                        <div className="flex items-center gap-0.5 mt-2 md:hidden">
                          <button
                            onClick={() => moveTask(task, "left")}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={() => moveTask(task, "right")}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-400 ml-auto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add card button */}
                  <button
                    onClick={() => openCreate(col.key)}
                    className="w-full py-2 rounded-xl text-xs text-gray-500 hover:bg-white/60 hover:text-primary transition flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Add a card
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />

      {/* Form Modal */}
      {showForm.open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={() => !loading && setShowForm({ open: false, status: "brief" })}
        >
          <div
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">
                  {showForm.task ? "Edit Task" : "Buat Task Baru"}
                </h3>
                <button onClick={() => setShowForm({ open: false, status: "brief" })}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Kolom: {COLUMNS.find((c) => c.key === showForm.status)?.label}</p>
            </div>

            <form onSubmit={saveTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Judul *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="misal: Follow up client A"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Detail tugas..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Warna Label</label>
                <div className="flex gap-2 flex-wrap">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.key })}
                      className={`w-8 h-8 rounded-lg border-l-4 ${c.border} ${c.bg} ${
                        form.color === c.key ? "ring-2 ring-primary scale-110" : ""
                      } transition`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <UserIcon size={12} /> Assign ke
                </label>
                <select
                  value={form.assignee_id}
                  onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                >
                  <option value="">— Tidak di-assign —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.position ? `(${e.position})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <CalendarIcon size={12} /> Deadline (Opsional)
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm({ open: false, status: "brief" })}
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
                  {loading ? "Menyimpan..." : showForm.task ? "Simpan" : "Buat Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
