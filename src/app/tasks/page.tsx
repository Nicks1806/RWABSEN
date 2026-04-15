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
  Filter,
  Inbox,
  Zap,
  CheckCircle2,
  Archive,
  Clock as ClockIcon,
  AlertCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Paperclip,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import TaskDetailModal from "@/components/TaskDetailModal";
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
  { key: "brief", label: "Brief", desc: "Belum dikerjakan", bg: "bg-rose-50/60", headerBg: "bg-rose-500", icon: Inbox, iconColor: "text-rose-500" },
  { key: "today", label: "Today", desc: "Hari ini", bg: "bg-amber-50/60", headerBg: "bg-amber-500", icon: Zap, iconColor: "text-amber-500" },
  { key: "done", label: "Done", desc: "Selesai", bg: "bg-emerald-50/60", headerBg: "bg-emerald-500", icon: CheckCircle2, iconColor: "text-emerald-500" },
  { key: "history", label: "History", desc: "Arsip", bg: "bg-slate-100/60", headerBg: "bg-slate-500", icon: Archive, iconColor: "text-slate-500" },
];

const CARD_COLORS: { key: Task["color"]; bg: string; border: string }[] = [
  { key: "red", bg: "bg-rose-50", border: "border-l-rose-500" },
  { key: "yellow", bg: "bg-amber-50", border: "border-l-amber-500" },
  { key: "green", bg: "bg-emerald-50", border: "border-l-emerald-500" },
  { key: "blue", bg: "bg-blue-50", border: "border-l-blue-500" },
  { key: "purple", bg: "bg-purple-50", border: "border-l-purple-500" },
  { key: "gray", bg: "bg-gray-50", border: "border-l-gray-400" },
];

// ============= Sub-components for dnd-kit =============

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const todayDue = task.due_date && isToday(new Date(task.due_date));
  const attachCount = task.attachments?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      className={`bg-white rounded-xl shadow-sm border border-gray-200/60 border-l-4 ${cardColor.border} transition-shadow hover:shadow-md overflow-hidden touch-none`}
    >
      {/* Drag handle area (top + middle) */}
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        <div className="px-3.5 pt-3 pb-2">
          <p className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* Attachments preview */}
        {attachCount > 0 && (
          <div className="px-3.5 pb-2 flex gap-1.5 flex-wrap">
            {task.attachments?.slice(0, 3).map((a) =>
              a.type === "image" ? (
                <div
                  key={a.id}
                  className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium max-w-[140px] truncate"
                >
                  <LinkIcon size={10} />
                  {a.name || a.url.replace(/^https?:\/\//, "").slice(0, 18)}
                </span>
              )
            )}
            {attachCount > 3 && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                +{attachCount - 3}
              </span>
            )}
          </div>
        )}

        {/* Meta row */}
        {task.due_date && (
          <div className="px-3.5 pb-2">
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
          </div>
        )}

        {/* Footer: assignees */}
        <div className="px-3.5 py-2 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between gap-2">
          {task.assigneeObjects && task.assigneeObjects.length > 0 ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex -space-x-1.5">
                {task.assigneeObjects.slice(0, 3).map((emp) => (
                  <div key={emp.id} className="ring-2 ring-white rounded-full" title={emp.name}>
                    <Avatar name={emp.name} photoUrl={emp.photo_url} size="xs" />
                  </div>
                ))}
                {task.assigneeObjects.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-gray-300 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-gray-700">
                    +{task.assigneeObjects.length - 3}
                  </div>
                )}
              </div>
              {task.assigneeObjects.length === 1 && (
                <span className="text-[11px] text-gray-700 font-medium truncate">
                  {task.assigneeObjects[0].name.split(" ")[0]}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 italic">Belum di-assign</span>
          )}
          {attachCount > 0 && (
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-0.5">
              <Paperclip size={10} /> {attachCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ColumnDroppable({
  colKey,
  children,
  isOver,
}: {
  colKey: ColKey;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${colKey}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto px-3 py-3 space-y-2.5 transition-all ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {children}
    </div>
  );
}

function CardOverlay({ task }: { task: Task }) {
  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  return (
    <div
      className={`bg-white rounded-xl shadow-2xl border border-gray-200/60 border-l-4 ${cardColor.border} overflow-hidden w-72 rotate-3 cursor-grabbing`}
    >
      <div className="px-3.5 pt-3 pb-2">
        <p className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">{task.title}</p>
        {task.description && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
        )}
      </div>
    </div>
  );
}

// ============= Main page =============

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
    assignee_ids: [] as string[],
    due_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColKey, setOverColKey] = useState<ColKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const fetchData = useCallback(async () => {
    const [tRes, eRes] = await Promise.all([
      supabase.from("tasks").select("*").order("position", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("is_active", true).order("name"),
    ]);
    const empMap = new Map((eRes.data || []).map((e) => [e.id, e]));
    const tasksWithAssignee = (tRes.data || []).map((t) => {
      const ids: string[] = Array.isArray(t.assignees) ? [...t.assignees] : [];
      if (t.assignee_id && !ids.includes(t.assignee_id)) ids.unshift(t.assignee_id);
      const assigneeObjects = ids.map((id) => empMap.get(id)).filter(Boolean) as Employee[];
      return {
        ...t,
        assignees: ids,
        assigneeObjects,
        assignee: assigneeObjects[0],
      };
    });
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
    setForm({
      title: "",
      description: "",
      color: "red",
      assignee_ids: user ? [user.id] : [],
      due_date: "",
    });
    setShowForm({ open: true, status });
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setLoading(true);
    const primaryAssignee = form.assignee_ids[0] || null;
    if (showForm.task) {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          color: form.color,
          assignees: form.assignee_ids,
          assignee_id: primaryAssignee,
          due_date: form.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", showForm.task.id);
      if (error) alert("Gagal: " + error.message);
    } else {
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        color: form.color,
        status: showForm.status,
        assignees: form.assignee_ids,
        assignee_id: primaryAssignee,
        due_date: form.due_date || null,
        created_by: user.id,
      });
      if (error) alert("Gagal: " + error.message);
    }
    setLoading(false);
    setShowForm({ open: false, status: "brief" });
  }

  async function moveTaskToColumn(taskId: string, newStatus: ColKey) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    await supabase
      .from("tasks")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: { over: { id: string | number } | null }) {
    const overId = e.over?.id ? String(e.over.id) : null;
    if (overId?.startsWith("col-")) {
      setOverColKey(overId.replace("col-", "") as ColKey);
    } else if (overId) {
      // Hovering over another card — find its column
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) setOverColKey(overTask.status);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const activeIdStr = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    setOverColKey(null);
    if (!overId) return;

    let targetCol: ColKey | null = null;
    if (overId.startsWith("col-")) {
      targetCol = overId.replace("col-", "") as ColKey;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetCol = overTask.status;
    }
    if (targetCol) moveTaskToColumn(activeIdStr, targetCol);
  }

  const isMine = (t: Task) =>
    t.assignee_id === user?.id || (Array.isArray(t.assignees) && t.assignees.includes(user?.id || ""));
  const filteredTasks = filterMine && user ? tasks.filter(isMine) : tasks;

  if (!user) return null;

  const myCount = user ? tasks.filter(isMine).length : 0;
  const overdueCount = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "history" &&
      t.due_date &&
      isPast(new Date(t.due_date)) &&
      !isToday(new Date(t.due_date))
  ).length;
  const todayTasksCount = tasks.filter((t) => t.status === "today").length;
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 flex flex-col">
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
                <p className="text-xs text-gray-500">Drag card untuk pindah kolom • Tap untuk edit</p>
              </div>
            </div>
            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition ${
                filterMine ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Filter size={13} /> {filterMine ? "Tugas Saya" : "Semua"}
            </button>
          </div>

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto px-3 md:px-6 py-5 flex gap-4 snap-x snap-mandatory">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.key);
              const Icon = col.icon;
              const isOverThis = overColKey === col.key && activeId !== null;
              return (
                <div
                  key={col.key}
                  className={`shrink-0 w-72 md:w-80 ${col.bg} rounded-2xl flex flex-col snap-start max-h-full border shadow-sm transition-all ${
                    isOverThis ? "border-primary border-2 ring-4 ring-primary/20" : "border-gray-200/80"
                  }`}
                >
                  <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-200/60 sticky top-0 z-10 bg-white/60 backdrop-blur-sm rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg ${col.headerBg} flex items-center justify-center text-white shadow-sm`}
                      >
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

                  <ColumnDroppable colKey={col.key} isOver={isOverThis}>
                    {colTasks.length === 0 && (
                      <div className="text-center py-8 px-4 pointer-events-none">
                        <Icon size={32} className={`${col.iconColor} mx-auto mb-2 opacity-40`} />
                        <p className="text-xs text-gray-400 font-medium">Belum ada task</p>
                        <p className="text-[10px] text-gray-400 mt-1">Drag card ke sini atau tap +</p>
                      </div>
                    )}
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={() => setDetailTask(task)} />
                    ))}
                    <button
                      onClick={() => openCreate(col.key)}
                      className="w-full py-2.5 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-primary hover:shadow-sm transition-all border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center gap-1 font-medium mt-1"
                    >
                      <Plus size={14} /> Tambah task
                    </button>
                  </ColumnDroppable>
                </div>
              );
            })}
          </div>
        </main>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? <CardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <BottomNav />

      {detailTask && user && (
        <TaskDetailModal
          task={tasks.find((t) => t.id === detailTask.id) || detailTask}
          currentUser={user}
          employees={employees}
          onClose={() => setDetailTask(null)}
        />
      )}

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

            {(() => {
              const colInfo = COLUMNS.find((c) => c.key === showForm.status)!;
              const ColIcon = colInfo.icon;
              return (
                <div className={`${colInfo.headerBg} px-5 pt-5 pb-6 text-white relative`}>
                  <button
                    onClick={() => setShowForm({ open: false, status: "brief" })}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                  >
                    <X size={18} />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <ColIcon size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{showForm.task ? "Edit Task" : "Task Baru"}</h3>
                      <p className="text-xs text-white/80">
                        {colInfo.label} • {colInfo.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={saveTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Judul *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="misal: Follow up client A"
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition font-medium"
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
                  placeholder="Detail tugas..."
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition resize-none"
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
                          active ? "ring-2 ring-offset-2 ring-gray-800 scale-105 shadow-md" : "hover:scale-105"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <UserIcon size={12} /> Di-assign ({form.assignee_ids.length})
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
                  {form.assignee_ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, assignee_ids: [] })}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-white/60 italic"
                    >
                      <X size={14} /> Hapus semua
                    </button>
                  )}
                  {employees
                    .filter((e) => e.is_active)
                    .map((e) => {
                      const active = form.assignee_ids.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              assignee_ids: active
                                ? form.assignee_ids.filter((x) => x !== e.id)
                                : [...form.assignee_ids, e.id],
                            })
                          }
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                            active ? "bg-white shadow-sm ring-2 ring-primary/30 font-semibold" : "hover:bg-white/60"
                          }`}
                        >
                          <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                            {e.position && <p className="text-[10px] text-gray-500 truncate">{e.position}</p>}
                          </div>
                          {active && <CheckCircle2 size={16} className="text-primary shrink-0" />}
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
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                />
              </div>

              <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                <ImageIcon size={11} /> Attach gambar/link bisa ditambah setelah task dibuat
              </p>

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
                  disabled={loading || !form.title.trim()}
                  className="flex-[2] py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
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
  const colorMap = {
    primary: "bg-primary/10 text-primary border-primary/20",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colorMap[color]}`}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
