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
  Inbox,
  Zap,
  CheckCircle2,
  Archive,
  Clock as ClockIcon,
  AlertCircle,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import { canAccessTasks } from "@/lib/permissions";

type ColKey = "brief" | "today" | "done" | "history";

const COLUMNS: {
  key: ColKey;
  label: string;
  desc: string;
  bg: string;
  headerBg: string;
  icon: typeof Inbox;
  iconColor: string;
}[] = [
  {
    key: "brief",
    label: "Brief",
    desc: "Belum dikerjakan",
    bg: "bg-rose-50/60",
    headerBg: "bg-rose-500",
    icon: Inbox,
    iconColor: "text-rose-500",
  },
  {
    key: "today",
    label: "Today",
    desc: "Hari ini",
    bg: "bg-amber-50/60",
    headerBg: "bg-amber-500",
    icon: Zap,
    iconColor: "text-amber-500",
  },
  {
    key: "done",
    label: "Done",
    desc: "Selesai",
    bg: "bg-emerald-50/60",
    headerBg: "bg-emerald-500",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  {
    key: "history",
    label: "History",
    desc: "Arsip",
    bg: "bg-slate-100/60",
    headerBg: "bg-slate-500",
    icon: Archive,
    iconColor: "text-slate-500",
  },
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
    // Fetch fresh profile to get latest position/role
    supabase
      .from("employees")
      .select("*")
      .eq("id", u.id)
      .single()
      .then(({ data }) => {
        const fresh = data || u;
        if (!canAccessTasks(fresh)) {
          alert("Akses Task Board khusus Admin, Founder, dan GM.");
          router.push(fresh.role === "admin" ? "/admin" : "/home");
          return;
        }
        setUser(fresh);
        fetchData();
      });
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

  // Calc stats
  const myCount = user ? tasks.filter((t) => t.assignee_id === user.id).length : 0;
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.status !== "history" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
  ).length;
  const todayTasksCount = tasks.filter((t) => t.status === "today").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 flex flex-col">
      {/* Header - professional */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center transition"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-lg text-gray-900">Task Board</h1>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                    {tasks.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Schedule & track task bersama tim
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition ${
                filterMine
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Filter size={13} /> {filterMine ? "Tugas Saya" : "Semua Tugas"}
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill icon={<UserIcon size={12} />} label="Tugas Saya" value={myCount} color="primary" />
            <StatPill icon={<ClockIcon size={12} />} label="Today" value={todayTasksCount} color="amber" />
            <StatPill
              icon={<AlertCircle size={12} />}
              label="Overdue"
              value={overdueCount}
              color={overdueCount > 0 ? "red" : "gray"}
            />
          </div>
        </div>
      </header>

      {/* Kanban */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={colsRef}
          className="h-full overflow-x-auto px-3 md:px-6 py-5 flex gap-4 snap-x snap-mandatory"
        >
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.key);
            const Icon = col.icon;
            return (
              <div
                key={col.key}
                className={`shrink-0 w-72 md:w-80 ${col.bg} rounded-2xl flex flex-col snap-start max-h-full border border-gray-200/80 shadow-sm`}
              >
                {/* Column header - premium */}
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-200/60 sticky top-0 z-10 bg-white/60 backdrop-blur-sm rounded-t-2xl">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${col.headerBg} flex items-center justify-center text-white shadow-sm`}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-gray-800">{col.label}</h3>
                        <span className="text-[10px] bg-gray-900/10 text-gray-700 px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                          {colTasks.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight">{col.desc}</p>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <Icon size={32} className={`${col.iconColor} mx-auto mb-2 opacity-40`} />
                      <p className="text-xs text-gray-400 font-medium">
                        Belum ada task
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Tap + di bawah untuk buat
                      </p>
                    </div>
                  )}
                  {colTasks.map((task) => {
                    const cardColor =
                      CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
                    const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                    const todayDue = task.due_date && isToday(new Date(task.due_date));

                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-xl shadow-sm border border-gray-200/60 border-l-4 ${cardColor.border} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden`}
                      >
                        <button
                          onClick={() => openEdit(task)}
                          className="w-full text-left px-3.5 pt-3 pb-2"
                        >
                          <p className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </button>

                        {/* Meta row */}
                        {(task.assignee || task.due_date) && (
                          <div className="px-3.5 pb-2 flex items-center gap-1.5 flex-wrap">
                            {task.due_date && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                  overdue
                                    ? "bg-red-100 text-red-700"
                                    : todayDue
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <CalendarIcon size={10} />
                                {format(new Date(task.due_date), "dd MMM", { locale: idLocale })}
                                {overdue && " • Lewat"}
                                {todayDue && " • Hari ini"}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Footer: assignee + actions */}
                        <div className="px-3.5 py-2 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between gap-2">
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Avatar
                                name={task.assignee.name}
                                photoUrl={task.assignee.photo_url}
                                size="xs"
                              />
                              <span className="text-[11px] text-gray-700 font-medium truncate">
                                {task.assignee.name.split(" ")[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Belum di-assign</span>
                          )}

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => moveTask(task, "left")}
                              className="w-6 h-6 rounded-md hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                              title="Pindah kiri"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              onClick={() => moveTask(task, "right")}
                              className="w-6 h-6 rounded-md hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                              title="Pindah kanan"
                            >
                              <ChevronRight size={14} />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="w-6 h-6 rounded-md hover:bg-red-100 hover:text-red-600 text-gray-400 flex items-center justify-center transition"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add card button - premium */}
                  <button
                    onClick={() => openCreate(col.key)}
                    className="w-full py-2.5 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-primary hover:shadow-sm transition-all border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center gap-1 font-medium"
                  >
                    <Plus size={14} /> Tambah task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />

      {/* Form Modal - Professional */}
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

            {/* Gradient Header */}
            {(() => {
              const colInfo = COLUMNS.find((c) => c.key === showForm.status)!;
              const ColIcon = colInfo.icon;
              return (
                <div className={`${colInfo.headerBg} px-5 pt-5 pb-6 text-white relative`}>
                  <button
                    onClick={() => setShowForm({ open: false, status: "brief" })}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
                  >
                    <X size={18} />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <ColIcon size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        {showForm.task ? "Edit Task" : "Task Baru"}
                      </h3>
                      <p className="text-xs text-white/80">
                        Kolom: {colInfo.label} • {colInfo.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={saveTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Judul <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="misal: Follow up client A"
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white focus:border-primary transition font-medium"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Deskripsi
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Detail tugas, context, atau checklist..."
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white focus:border-primary transition resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Warna Label
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CARD_COLORS.map((c) => {
                    const active = form.color === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setForm({ ...form, color: c.key })}
                        className={`w-10 h-10 rounded-xl border-l-4 ${c.border} ${c.bg} transition-all ${
                          active
                            ? "ring-2 ring-offset-2 ring-gray-800 scale-105 shadow-md"
                            : "hover:scale-105"
                        }`}
                        title={c.key}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Assignee - custom picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <UserIcon size={12} /> Di-assign ke
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, assignee_id: "" })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                      !form.assignee_id
                        ? "bg-white shadow-sm ring-2 ring-primary/30 text-primary font-semibold"
                        : "text-gray-500 hover:bg-white/60"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon size={14} className="text-gray-400" />
                    </div>
                    <span className="text-left flex-1">Tidak di-assign</span>
                  </button>
                  {employees
                    .filter((e) => e.is_active)
                    .map((e) => {
                      const active = form.assignee_id === e.id;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setForm({ ...form, assignee_id: e.id })}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                            active
                              ? "bg-white shadow-sm ring-2 ring-primary/30 font-semibold"
                              : "hover:bg-white/60"
                          }`}
                        >
                          <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                            {e.position && (
                              <p className="text-[10px] text-gray-500 truncate">{e.position}</p>
                            )}
                          </div>
                          {active && (
                            <CheckCircle2 size={16} className="text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <CalendarIcon size={12} /> Deadline
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white focus:border-primary transition"
                />
                <p className="text-[10px] text-gray-400 mt-1">Kosongkan jika tidak ada deadline</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm({ open: false, status: "brief" })}
                  disabled={loading}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition"
                >
                  {loading ? "Menyimpan..." : showForm.task ? "Simpan Perubahan" : "Buat Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "primary" | "amber" | "red" | "gray";
}) {
  const colors = {
    primary: "bg-primary/5 text-primary border-primary/20",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[color]}`}>
      <div className="flex items-center gap-1 opacity-80">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold mt-0.5 leading-tight">{value}</p>
    </div>
  );
}
