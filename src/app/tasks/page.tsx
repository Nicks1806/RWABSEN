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
  CheckCircle2,
  Clock as ClockIcon,
  AlertCircle,
  LayoutGrid,
  Image as ImageIcon,
  Link as LinkIcon,
  Paperclip,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import TaskDetailModal from "@/components/TaskDetailModal";
import { canAccessTasks } from "@/lib/permissions";
import type { BoardColumn, Board } from "@/lib/types";

// Color palette for board columns (top bar accent)
const COL_COLORS = {
  rose: "bg-rose-500",
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  slate: "bg-slate-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
} as const;
type ColColor = keyof typeof COL_COLORS;
const COL_COLOR_KEYS: ColColor[] = ["rose", "amber", "emerald", "blue", "purple", "slate", "pink", "indigo", "teal"];

const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: "default-brief", key: "brief", label: "Brief", description: "Belum dikerjakan", color: "rose", position: 0, is_default: true },
  { id: "default-today", key: "today", label: "Today", description: "Hari ini", color: "amber", position: 1, is_default: true },
  { id: "default-done", key: "done", label: "Done", description: "Selesai", color: "emerald", position: 2, is_default: true },
  { id: "default-history", key: "history", label: "History", description: "Arsip", color: "slate", position: 3, is_default: true },
];

const CARD_COLORS: { key: Task["color"]; dot: string; border: string }[] = [
  { key: "red", dot: "bg-rose-500", border: "border-l-rose-500" },
  { key: "yellow", dot: "bg-amber-400", border: "border-l-amber-400" },
  { key: "green", dot: "bg-emerald-500", border: "border-l-emerald-500" },
  { key: "blue", dot: "bg-blue-500", border: "border-l-blue-500" },
  { key: "purple", dot: "bg-purple-500", border: "border-l-purple-500" },
  { key: "gray", dot: "bg-gray-400", border: "border-l-gray-400" },
];

const BOARD_COLORS = ["bg-primary", "bg-blue-600", "bg-emerald-600", "bg-amber-500", "bg-purple-600", "bg-pink-600", "bg-indigo-600", "bg-teal-600", "bg-slate-700"];

// ============= Sub-components for dnd-kit =============

function TaskCard({ task, onClick, onRename }: { task: Task; onClick: () => void; onRename: (newTitle: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const todayDue = task.due_date && isToday(new Date(task.due_date));
  const attachCount = task.attachments?.length || 0;
  // Auto-cover: explicit cover_url OR first image attachment
  const coverUrl =
    task.cover_url ||
    task.attachments?.find((a) => a.type === "image")?.url ||
    null;
  // Labels: union of `labels[]` array + legacy `color` (dedupe)
  const labelSet = new Set<string>(task.labels || []);
  if (task.color) labelSet.add(task.color);
  const labels: string[] = Array.from(labelSet);
  // Checklist progress
  const checklist = task.checklist || [];
  const doneCount = checklist.filter((i) => i.done).length;
  const totalCount = checklist.length;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
      className={`bg-white rounded-xl shadow-sm border border-gray-200/80 border-l-4 ${cardColor.border} transition-shadow hover:shadow-md hover:border-gray-300 overflow-hidden touch-none ${isDragging ? "z-50 shadow-xl" : ""}`}
    >
      {/* Drag handle area (top + middle) */}
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        {/* Cover image (Trello-style) */}
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="w-full h-28 object-cover bg-gray-100"
            draggable={false}
          />
        )}
        {/* Multi-label color chips */}
        {labels.length > 0 && (
          <div className="px-3.5 pt-2.5 pb-1 flex gap-1 flex-wrap">
            {labels.map((l) => {
              const lc = CARD_COLORS.find((c) => c.key === l) || CARD_COLORS[0];
              return (
                <span
                  key={l}
                  className={`h-1.5 w-10 rounded-full ${lc.dot}`}
                  title={l}
                />
              );
            })}
          </div>
        )}
        <div className="px-3.5 pt-2 pb-2">
          {editing ? (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { onRename(draft); setEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRename(draft); setEditing(false); }
                if (e.key === "Escape") { setDraft(task.title); setEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full font-semibold text-sm text-gray-900 bg-white border-b-2 border-primary outline-none px-0.5 py-0.5"
              autoFocus
            />
          ) : (
            <p
              className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2"
              onDoubleClick={(e) => { e.stopPropagation(); setDraft(task.title); setEditing(true); }}
            >
              {task.title}
            </p>
          )}
          {task.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* Trello-style badges bar */}
        <div className="px-3.5 pb-2 flex items-center gap-1.5 flex-wrap">
          {/* Checklist done button (green when complete) */}
          {totalCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold ${
                doneCount === totalCount
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <CheckCircle2 size={11} />
              {doneCount}/{totalCount}
            </span>
          )}
          {/* Due date */}
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold ${
                overdue
                  ? "bg-red-500 text-white"
                  : todayDue
                  ? "bg-amber-400 text-white"
                  : doneCount === totalCount && totalCount > 0
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <CalendarIcon size={11} />
              {format(new Date(task.due_date), "MMM dd", { locale: idLocale })}
            </span>
          )}
          {/* Attachment count */}
          {attachCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-600 font-bold">
              <Paperclip size={11} /> {attachCount}
            </span>
          )}
          {/* Comment count */}
          {(task.comments?.length || 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-600 font-bold">
              💬 {task.comments!.length}
            </span>
          )}
        </div>

        {/* Footer: assignees */}
        <div className="px-3.5 py-2 flex items-center justify-end gap-1.5">
          {task.assigneeObjects && task.assigneeObjects.length > 0 ? (
            <div className="flex -space-x-1.5 ml-auto">
              {task.assigneeObjects.slice(0, 4).map((emp) => (
                <div key={emp.id} className="ring-2 ring-white rounded-full" title={emp.name}>
                  <Avatar name={emp.name} photoUrl={emp.photo_url} size="xs" />
                </div>
              ))}
              {task.assigneeObjects.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-gray-300 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-gray-700">
                  +{task.assigneeObjects.length - 4}
                </div>
              )}
            </div>
          ) : null}
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
  colKey: string;
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

function MobileTaskCard({ task, columns, onClick, onMove, onReorder, onRename }: {
  task: Task; columns: BoardColumn[]; onClick: () => void; onMove: (status: string) => void; onReorder: (dir: "up" | "down") => void; onRename: (t: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  const coverUrl = task.cover_url || task.attachments?.find((a) => a.type === "image")?.url;
  const labelSet = new Set<string>(task.labels || []);
  if (task.color) labelSet.add(task.color);
  const clTotal = task.checklist?.length || 0;
  const clDone = task.checklist?.filter((i) => i.done).length || 0;
  const commentCount = task.comments?.length || 0;
  const attachCount = task.attachments?.length || 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform overflow-visible relative">
      {/* Cover */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full h-36 object-cover rounded-t-2xl" onClick={onClick} />
      )}

      <div onClick={onClick} className="px-4 pt-3 pb-2.5">
        {/* Labels */}
        {labelSet.size > 0 && (
          <div className="flex gap-1.5 mb-2">
            {Array.from(labelSet).map((l) => {
              const lc = CARD_COLORS.find((c) => c.key === l) || CARD_COLORS[0];
              return <span key={l} className={`h-2 w-10 rounded-full ${lc.dot}`} />;
            })}
          </div>
        )}
        {editTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { onRename(titleDraft); setEditTitle(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(titleDraft); setEditTitle(false); }
              if (e.key === "Escape") { setTitleDraft(task.title); setEditTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full font-bold text-base text-gray-900 bg-white border-b-2 border-primary outline-none"
            autoFocus
          />
        ) : (
          <p className="font-bold text-base text-gray-900 leading-snug" onDoubleClick={(e) => { e.stopPropagation(); setTitleDraft(task.title); setEditTitle(true); }}>{task.title}</p>
        )}
        {task.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>}
      </div>

      {/* Badges row */}
      {(task.due_date || clTotal > 0 || commentCount > 0 || attachCount > 0) && (
        <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap" onClick={onClick}>
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold ${
              isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                ? "bg-red-50 text-red-600 border border-red-100"
                : isToday(new Date(task.due_date))
                ? "bg-amber-50 text-amber-600 border border-amber-100"
                : "bg-gray-50 text-gray-600 border border-gray-100"
            }`}>
              <CalendarIcon size={11} />
              {format(new Date(task.due_date), "dd MMM", { locale: idLocale })}
            </span>
          )}
          {clTotal > 0 && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold ${
              clDone === clTotal ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-50 text-gray-600 border border-gray-100"
            }`}>
              <CheckCircle2 size={11} /> {clDone}/{clTotal}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100 font-semibold">
              💬 {commentCount}
            </span>
          )}
          {attachCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100 font-semibold">
              <Paperclip size={11} /> {attachCount}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
        {/* Assignees */}
        <div className="flex items-center gap-2 min-w-0" onClick={onClick}>
          {task.assigneeObjects && task.assigneeObjects.length > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {task.assigneeObjects.slice(0, 4).map((emp) => (
                  <div key={emp.id} className="ring-2 ring-white rounded-full">
                    <Avatar name={emp.name} photoUrl={emp.photo_url} size="xs" />
                  </div>
                ))}
              </div>
              {task.assigneeObjects.length <= 2 && (
                <span className="text-xs text-gray-600 font-medium truncate">
                  {task.assigneeObjects.map((e) => e.name.split(" ")[0]).join(", ")}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">Belum di-assign</span>
          )}
        </div>

        {/* Actions toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition text-sm ${
            showActions ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 active:bg-gray-200"
          }`}
        >
          ···
        </button>
      </div>

      {/* Action bottom sheet */}
      {showActions && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={(e) => { e.stopPropagation(); setShowActions(false); }} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 animate-slide-up safe-bottom">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

            {/* Task info header */}
            <div className="px-5 pt-2 pb-3 flex items-center gap-3 border-b border-gray-100">
              <div className={`w-1.5 h-10 rounded-full ${cardColor.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{task.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {task.assigneeObjects?.map((e) => e.name.split(" ")[0]).join(", ") || "Belum di-assign"}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowActions(false); }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Reorder */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Urutan</p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onReorder("up"); setShowActions(false); }}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 active:bg-gray-100 transition"
                  >
                    <span className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-base">↑</span>
                    Atas
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onReorder("down"); setShowActions(false); }}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 active:bg-gray-100 transition"
                  >
                    <span className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-base">↓</span>
                    Bawah
                  </button>
                </div>
              </div>

              {/* Move to column */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pindah ke</p>
                <div className="space-y-1.5">
                  {columns.filter((c) => c.key !== task.status).map((c) => {
                    const topColor = COL_COLORS[c.color as ColColor] || "bg-gray-400";
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); onMove(c.key); setShowActions(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50 text-sm font-medium text-gray-800 active:scale-[0.98] active:bg-gray-100 transition"
                      >
                        <span className={`w-4 h-4 rounded-lg ${topColor} shadow-sm`} />
                        <span className="flex-1 text-left">{c.label}</span>
                        <span className="text-gray-400 text-xs">→</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CardOverlay({ task }: { task: Task }) {
  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  return (
    <div
      className={`bg-white rounded-xl shadow-2xl ring-2 ring-primary/40 border-l-4 ${cardColor.border} overflow-hidden w-72 rotate-3 cursor-grabbing`}
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
  const [columns, setColumns] = useState<BoardColumn[]>(DEFAULT_COLUMNS);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Multi-board state
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardColor, setNewBoardColor] = useState("bg-primary");
  const [filterMine, setFilterMine] = useState(false);
  const [showForm, setShowForm] = useState<{ open: boolean; status: string; task?: Task }>({
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
  const [overColKey, setOverColKey] = useState<string | null>(null);
  // Mobile tab view
  const [mobileTab, setMobileTab] = useState(0);
  // Inline edit
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState("");
  // Column CRUD state
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColColor, setNewColColor] = useState<ColColor>("blue");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const fetchData = useCallback(async (boardId?: string | null) => {
    try {
      // Core queries (always work)
      const [tRes, eRes] = await Promise.all([
        supabase.from("tasks").select("*").order("position", { ascending: true }).order("created_at", { ascending: false }),
        supabase.from("employees").select("*").eq("is_active", true).order("name"),
      ]);

      // Optional queries (may fail if tables don't exist yet)
      let colsData: BoardColumn[] = [];
      let boardsData: Board[] = [];
      try {
        const cRes = await supabase.from("board_columns").select("*").order("position", { ascending: true });
        if (cRes.data) colsData = cRes.data as BoardColumn[];
      } catch { /* table may not exist */ }
      try {
        const bRes = await supabase.from("boards").select("*").order("created_at", { ascending: true });
        if (bRes.data) boardsData = bRes.data as Board[];
      } catch { /* table may not exist */ }

      // Filter tasks by board
      const allTasks = tRes.data || [];
      const filtered = boardId
        ? allTasks.filter((t) => t.board_id === boardId)
        : allTasks.filter((t) => !t.board_id);

      const empMap = new Map((eRes.data || []).map((e) => [e.id, e]));
      const tasksWithAssignee = filtered.map((t) => {
        const ids: string[] = Array.isArray(t.assignees) ? [...t.assignees] : [];
        if (t.assignee_id && !ids.includes(t.assignee_id)) ids.unshift(t.assignee_id);
        const assigneeObjects = ids.map((id) => empMap.get(id)).filter(Boolean) as Employee[];
        return { ...t, assignees: ids, assigneeObjects, assignee: assigneeObjects[0] };
      });
      setTasks(tasksWithAssignee);
      setEmployees(eRes.data || []);

      // Filter columns by board
      const boardCols = boardId
        ? colsData.filter((c) => c.board_id === boardId)
        : colsData.filter((c) => !c.board_id);
      if (boardCols.length > 0) setColumns(boardCols);
      else setColumns(DEFAULT_COLUMNS);

      setBoards(boardsData);
    } catch (err) {
      console.error("fetchData error:", err);
    }
  }, []);

  // ===== Board CRUD =====
  async function switchBoard(board: Board | null) {
    setActiveBoard(board);
    setShowBoardSwitcher(false);
    setColumns(DEFAULT_COLUMNS);
    await fetchData(board?.id || null);
  }

  async function createBoard() {
    if (!newBoardName.trim() || !user) return;
    const { data, error } = await supabase.from("boards").insert({
      name: newBoardName.trim(),
      color: newBoardColor,
      created_by: user.id,
    }).select().single();
    if (error) {
      alert("Gagal: " + error.message + "\n\nPastikan tabel 'boards' sudah dibuat di Supabase.");
      return;
    }
    // Create default columns for new board
    const defaultCols = DEFAULT_COLUMNS.map((c, i) => ({
      board_id: data.id,
      key: c.key,
      label: c.label,
      description: c.description,
      color: c.color,
      position: i,
    }));
    await supabase.from("board_columns").insert(defaultCols);
    setNewBoardName("");
    setShowCreateBoard(false);
    setBoards([...boards, data as Board]);
    switchBoard(data as Board);
  }

  async function deleteBoard(board: Board) {
    if (!confirm(`Hapus board "${board.name}" beserta semua task & kolom di dalamnya?`)) return;
    await supabase.from("tasks").delete().eq("board_id", board.id);
    await supabase.from("board_columns").delete().eq("board_id", board.id);
    await supabase.from("boards").delete().eq("id", board.id);
    setBoards((prev) => prev.filter((b) => b.id !== board.id));
    if (activeBoard?.id === board.id) switchBoard(null);
  }

  async function renameBoardInline(newName: string) {
    setEditingBoardName(false);
    if (!newName.trim() || !activeBoard) return;
    setBoards((prev) => prev.map((b) => b.id === activeBoard.id ? { ...b, name: newName.trim() } : b));
    setActiveBoard({ ...activeBoard, name: newName.trim() });
    await supabase.from("boards").update({ name: newName.trim() }).eq("id", activeBoard.id);
  }

  async function renameTaskInline(taskId: string, newTitle: string) {
    if (!newTitle.trim()) return;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, title: newTitle.trim() } : t));
    await supabase.from("tasks").update({ title: newTitle.trim(), updated_at: new Date().toISOString() }).eq("id", taskId);
  }

  // ===== Deadline notification =====
  useEffect(() => {
    if (!user || tasks.length === 0) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const sentKey = `deadline-notif-${today}`;
    if (localStorage.getItem(sentKey)) return; // only once per day

    const dueTodayTasks = tasks.filter(
      (t) => t.due_date === today && t.status !== "done" && t.status !== "history"
    );
    if (dueTodayTasks.length === 0) return;

    // Collect all unique assignee IDs from due-today tasks
    const assigneeSet = new Set<string>();
    dueTodayTasks.forEach((t) => {
      (t.assignees || []).forEach((id) => assigneeSet.add(id));
      if (t.assignee_id) assigneeSet.add(t.assignee_id);
    });
    if (assigneeSet.size === 0) return;

    // Send push notification
    const taskNames = dueTodayTasks.map((t) => t.title).slice(0, 3).join(", ");
    const extra = dueTodayTasks.length > 3 ? ` +${dueTodayTasks.length - 3} lainnya` : "";
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_ids: Array.from(assigneeSet),
        title: "⏰ Deadline Hari Ini!",
        body: `${taskNames}${extra}`,
        url: "/tasks",
      }),
    }).catch(() => {});
    localStorage.setItem(sentKey, "1");
  }, [user, tasks]);

  // ===== Column CRUD =====
  async function addColumn() {
    if (!newColLabel.trim()) return;
    const slug = newColLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `col-${Date.now()}`;
    const newCol = {
      key: slug,
      label: newColLabel.trim(),
      description: null,
      color: newColColor,
      position: columns.length,
      is_default: false,
      board_id: activeBoard?.id || null,
    };
    const { data, error } = await supabase.from("board_columns").insert(newCol).select().single();
    if (error) {
      alert("Gagal tambah kolom: " + error.message + "\n\nPastikan tabel board_columns sudah dibuat di Supabase.");
      return;
    }
    setColumns([...columns, data as BoardColumn]);
    setNewColLabel("");
    setShowAddCol(false);
  }

  async function renameColumn(id: string, newLabel: string) {
    if (!newLabel.trim()) {
      setEditingColId(null);
      return;
    }
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label: newLabel.trim() } : c)));
    setEditingColId(null);
    if (col.is_default) return; // default cols not in DB
    await supabase.from("board_columns").update({ label: newLabel.trim() }).eq("id", id);
  }

  async function deleteColumn(col: BoardColumn) {
    const tasksInCol = tasks.filter((t) => t.status === col.key).length;
    if (tasksInCol > 0) {
      if (!confirm(`Kolom "${col.label}" punya ${tasksInCol} task. Tetap hapus? (Task akan pindah ke kolom pertama)`)) return;
      // Move tasks to first column
      const firstCol = columns[0];
      if (firstCol && firstCol.key !== col.key) {
        await supabase.from("tasks").update({ status: firstCol.key }).eq("status", col.key);
      }
    } else {
      if (!confirm(`Hapus kolom "${col.label}"?`)) return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== col.id));
    if (!col.is_default) {
      await supabase.from("board_columns").delete().eq("id", col.id);
    }
    fetchRef.current();
  }

  function startEditCol(col: BoardColumn) {
    setEditingColId(col.id);
    setEditColLabel(col.label);
  }

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
        fetchData(null); // default board
      });
  }, [router, fetchData]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchRef.current(activeBoard?.id || null), 500);
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

  async function reorderTask(taskId: string, direction: "up" | "down") {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    // Get column tasks sorted — assign sequential positions if missing
    const colTasks = filteredTasks
      .filter((t) => t.status === task.status)
      .sort((a, b) => {
        const pa = a.position ?? 999;
        const pb = b.position ?? 999;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    const idx = colTasks.findIndex((t) => t.id === taskId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= colTasks.length) return;

    // Build new order: swap the two items
    const newOrder = [...colTasks];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    // Assign fresh sequential positions
    const updates: { id: string; position: number }[] = newOrder.map((t, i) => ({ id: t.id, position: i }));

    // Optimistic update
    setTasks((prev) => {
      const posMap = new Map(updates.map((u) => [u.id, u.position]));
      return prev.map((t) => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t);
    });

    // Persist all positions
    await Promise.all(
      updates.map((u) => supabase.from("tasks").update({ position: u.position }).eq("id", u.id))
    );
  }

  function openCreate(status: string) {
    setForm({
      title: "",
      description: "",
      color: "red",
      assignee_ids: user ? [user.id] : [],
      due_date: "",
    });
    setShowForm({ open: true, status });
  }

  async function saveTask(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
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
        board_id: activeBoard?.id || null,
      });
      if (error) alert("Gagal: " + error.message);
    }
    setLoading(false);
    setShowForm({ open: false, status: "brief" });
  }

  async function moveTaskToColumn(taskId: string, newStatus: string) {
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
      setOverColKey(overId.replace("col-", ""));
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

    const activeTask = tasks.find((t) => t.id === activeIdStr);
    if (!activeTask) return;

    // Dropped on a column droppable
    if (overId.startsWith("col-")) {
      const targetCol = overId.replace("col-", "");
      if (targetCol !== activeTask.status) moveTaskToColumn(activeIdStr, targetCol);
      return;
    }

    // Dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (activeTask.status !== overTask.status) {
      // Moving to different column
      moveTaskToColumn(activeIdStr, overTask.status);
    } else {
      // Reordering within same column
      const colTasks = filteredTasks
        .filter((t) => t.status === activeTask.status)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      const oldIdx = colTasks.findIndex((t) => t.id === activeIdStr);
      const newIdx = colTasks.findIndex((t) => t.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      const reordered = arrayMove(colTasks, oldIdx, newIdx);
      // Assign fresh positions
      const updates = reordered.map((t, i) => ({ id: t.id, position: i }));
      setTasks((prev) => {
        const posMap = new Map(updates.map((u) => [u.id, u.position]));
        return prev.map((t) => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t);
      });
      Promise.all(updates.map((u) => supabase.from("tasks").update({ position: u.position }).eq("id", u.id)));
    }
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-20 shadow-sm">
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
                  {editingBoardName ? (
                    <input
                      type="text"
                      value={boardNameDraft}
                      onChange={(e) => setBoardNameDraft(e.target.value)}
                      onBlur={() => {
                        if (activeBoard) renameBoardInline(boardNameDraft);
                        else { localStorage.setItem("default_board_name", boardNameDraft.trim() || "Task Board"); setEditingBoardName(false); }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (activeBoard) renameBoardInline(boardNameDraft);
                          else { localStorage.setItem("default_board_name", boardNameDraft.trim() || "Task Board"); setEditingBoardName(false); }
                        }
                        if (e.key === "Escape") setEditingBoardName(false);
                      }}
                      className="font-bold text-lg text-gray-900 bg-transparent border-b-2 border-primary outline-none px-1 min-w-[120px]"
                      autoFocus
                    />
                  ) : (
                    <h1
                      className="font-bold text-lg text-gray-900 cursor-pointer hover:text-primary transition"
                      onClick={() => {
                        const currentName = activeBoard ? activeBoard.name : (localStorage.getItem("default_board_name") || "Task Board");
                        setBoardNameDraft(currentName);
                        setEditingBoardName(true);
                      }}
                      title="Klik untuk rename"
                    >
                      {activeBoard ? activeBoard.name : (typeof window !== "undefined" ? localStorage.getItem("default_board_name") || "Task Board" : "Task Board")}
                    </h1>
                  )}
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                    {tasks.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Tap judul untuk rename • Tap card untuk edit</p>
              </div>
            </div>
            {/* Board switcher button */}
            <button
              onClick={() => setShowBoardSwitcher(!showBoardSwitcher)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition mr-1"
            >
              <LayoutGrid size={13} /> Switch
            </button>
            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition ${
                filterMine ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Filter size={13} /> {filterMine ? "Tugas Saya" : "Semua"}
            </button>
          </div>

          <div className="hidden md:grid grid-cols-3 gap-2">
            <StatPill icon={<UserIcon size={12} />} label="Tugas Saya" value={myCount} color="primary" />
            <StatPill icon={<ClockIcon size={12} />} label="Today" value={todayTasksCount} color="amber" />
            <StatPill
              icon={<AlertCircle size={12} />}
              label="Overdue"
              value={overdueCount}
              color={overdueCount > 0 ? "red" : "gray"}
            />
          </div>

          {/* Mobile: Column Tab Bar */}
          <div className="md:hidden flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 snap-x">
            {columns.map((col, idx) => {
              const count = filteredTasks.filter((t) => t.status === col.key).length;
              const isActive = mobileTab === idx;
              const topBarColor = COL_COLORS[col.color as ColColor] || "bg-gray-400";
              return (
                <button
                  key={col.id}
                  onClick={() => setMobileTab(idx)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition snap-start ${
                    isActive
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${topBarColor}`} />
                  {col.label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ====== MOBILE: Single column view ====== */}
      <div className="md:hidden flex-1 overflow-y-auto px-4 py-4 space-y-2.5 pb-20">
        {(() => {
          const col = columns[mobileTab];
          if (!col) return null;
          const colTasks = filteredTasks.filter((t) => t.status === col.key);
          return (
            <>
              {colTasks.length === 0 && (
                <div className="text-center py-12">
                  <div className={`w-14 h-14 ${COL_COLORS[col.color as ColColor] || "bg-gray-400"} opacity-20 rounded-full mx-auto mb-3`} />
                  <p className="text-sm text-gray-400 font-medium">Belum ada task</p>
                  <p className="text-xs text-gray-400 mt-1">Tap + untuk tambah</p>
                </div>
              )}
              {colTasks
                .sort((a, b) => (a.position || 0) - (b.position || 0))
                .map((task) => (
                <MobileTaskCard
                  key={task.id}
                  task={task}
                  columns={columns}
                  onClick={() => setDetailTask(task)}
                  onMove={(newStatus) => moveTaskToColumn(task.id, newStatus)}
                  onReorder={(dir) => reorderTask(task.id, dir)}
                  onRename={(t) => renameTaskInline(task.id, t)}
                />
              ))}
              <button
                onClick={() => openCreate(col.key)}
                className="w-full py-3 rounded-xl text-sm text-gray-500 hover:text-primary bg-white hover:shadow-sm transition border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center gap-1.5 font-medium"
              >
                <Plus size={16} /> Tambah task
              </button>
            </>
          );
        })()}
      </div>

      {/* ====== DESKTOP: Horizontal kanban ====== */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-hidden hidden md:block">
          <div className="h-full overflow-x-auto px-3 md:px-6 py-5 flex items-start gap-4 snap-x snap-mandatory">
            {columns.map((col) => {
              const colTasks = filteredTasks
                .filter((t) => t.status === col.key)
                .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
              const isOverThis = overColKey === col.key && activeId !== null;
              const topBarColor = COL_COLORS[col.color as ColColor] || "bg-gray-400";
              return (
                <div
                  key={col.id}
                  className={`shrink-0 w-72 md:w-80 bg-white/85 backdrop-blur-sm rounded-2xl flex flex-col snap-start max-h-[calc(100vh-220px)] overflow-hidden border shadow-md transition-all ${
                    isOverThis ? "border-primary ring-4 ring-primary/20 scale-[1.01]" : "border-gray-200/80"
                  }`}
                >
                  {/* Trello-style colored top bar */}
                  <div className={`h-1.5 ${topBarColor}`} />
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200/60 sticky top-0 z-10 bg-white/80 backdrop-blur-md group">
                    <div className="flex-1 min-w-0">
                      {editingColId === col.id ? (
                        <input
                          type="text"
                          value={editColLabel}
                          onChange={(e) => setEditColLabel(e.target.value)}
                          onBlur={() => renameColumn(col.id, editColLabel)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameColumn(col.id, editColLabel);
                            if (e.key === "Escape") setEditingColId(null);
                          }}
                          className="w-full px-2 py-1 bg-white border-2 border-primary rounded-md text-sm font-bold text-gray-900 outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => startEditCol(col)}
                          className="flex items-center gap-1.5 hover:bg-gray-100/60 -mx-1 px-1 py-0.5 rounded transition w-full text-left"
                          title="Klik untuk edit nama"
                        >
                          <h3 className="font-bold text-sm text-gray-800 truncate">{col.label}</h3>
                          <span className="text-[10px] bg-gray-900/10 text-gray-700 px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                            {colTasks.length}
                          </span>
                        </button>
                      )}
                      {col.description && editingColId !== col.id && (
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{col.description}</p>
                      )}
                    </div>
                    {!col.is_default && editingColId !== col.id && (
                      <button
                        onClick={() => deleteColumn(col)}
                        className="opacity-0 group-hover:opacity-100 transition w-7 h-7 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center"
                        title="Hapus kolom"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <ColumnDroppable colKey={col.key} isOver={isOverThis}>
                    <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {colTasks.length === 0 && (
                        <div className="text-center py-8 px-4 pointer-events-none">
                          <div className={`w-12 h-12 ${topBarColor} opacity-20 rounded-full mx-auto mb-2`} />
                          <p className="text-xs text-gray-400 font-medium">Belum ada task</p>
                          <p className="text-[10px] text-gray-400 mt-1">Drag card ke sini atau tap +</p>
                        </div>
                      )}
                      {colTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onClick={() => setDetailTask(task)} onRename={(t) => renameTaskInline(task.id, t)} />
                      ))}
                    </SortableContext>
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

            {/* Add another list (Trello-style) */}
            <div className="shrink-0 w-72 md:w-80 snap-start">
              {showAddCol ? (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-2 border-primary/30 shadow-md p-3 space-y-2">
                  <input
                    type="text"
                    value={newColLabel}
                    onChange={(e) => setNewColLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addColumn();
                      if (e.key === "Escape") {
                        setShowAddCol(false);
                        setNewColLabel("");
                      }
                    }}
                    placeholder="Nama kolom..."
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                    autoFocus
                  />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Warna</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {COL_COLOR_KEYS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColColor(c)}
                          className={`w-7 h-7 rounded-md ${COL_COLORS[c]} transition-all ${
                            newColColor === c ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "opacity-70 hover:opacity-100"
                          }`}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowAddCol(false);
                        setNewColLabel("");
                      }}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={addColumn}
                      disabled={!newColLabel.trim()}
                      className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold disabled:opacity-40"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCol(true)}
                  className="w-full py-3 rounded-2xl text-sm text-gray-600 hover:text-primary bg-white/40 hover:bg-white/80 backdrop-blur-sm border-2 border-dashed border-gray-300 hover:border-primary transition-all font-semibold inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={16} /> Tambah Kolom Baru
                </button>
              )}
            </div>
          </div>
        </main>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTask ? <CardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <BottomNav />

      {/* Board Switcher Modal */}
      {showBoardSwitcher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-12 md:pt-20 px-4" onClick={() => setShowBoardSwitcher(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-primary-dark px-5 pt-5 pb-4 text-white relative">
              <button onClick={() => setShowBoardSwitcher(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} /></button>
              <LayoutGrid size={20} className="mb-1.5 opacity-80" />
              <h3 className="font-bold text-lg">Board Anda</h3>
              <p className="text-xs text-white/70 mt-0.5">Pilih atau buat board per divisi</p>
            </div>

            <div className="p-3 max-h-[55vh] overflow-y-auto space-y-1.5">
              {/* Default board */}
              <button
                onClick={() => switchBoard(null)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition group ${
                  !activeBoard ? "bg-primary/5 ring-1 ring-primary/30" : "hover:bg-gray-50"
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                  RW
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">RedWine Board</p>
                  <p className="text-[10px] text-gray-500">Board utama • Semua divisi</p>
                </div>
                {!activeBoard && (
                  <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-bold shrink-0">AKTIF</span>
                )}
              </button>

              {boards.length > 0 && <div className="border-t border-gray-100 my-2" />}

              {/* User boards */}
              {boards.map((b) => {
                const isActive = activeBoard?.id === b.id;
                return (
                  <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl transition group ${
                    isActive ? "bg-primary/5 ring-1 ring-primary/30" : "hover:bg-gray-50"
                  }`}>
                    <button onClick={() => switchBoard(b)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                      <div className={`w-11 h-11 rounded-xl ${b.color} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0`}>
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                        {b.description && <p className="text-[10px] text-gray-500 truncate">{b.description}</p>}
                      </div>
                    </button>
                    {isActive ? (
                      <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-bold shrink-0">AKTIF</span>
                    ) : (
                      <button
                        onClick={() => deleteBoard(b)}
                        className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center shrink-0 transition"
                        title="Hapus board"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create new board - always visible at bottom */}
            <div className="border-t border-gray-100 p-3">
              {showCreateBoard ? (
                <div className="space-y-3">
                  <input
                    type="text" value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createBoard(); if (e.key === "Escape") setShowCreateBoard(false); }}
                    placeholder="Nama board — misal: Sales Team, CS, Design..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                    autoFocus
                  />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Pilih warna</p>
                    <div className="flex gap-2 flex-wrap">
                      {BOARD_COLORS.map((c) => (
                        <button key={c} onClick={() => setNewBoardColor(c)}
                          className={`w-9 h-9 rounded-xl ${c} transition-all shadow-sm ${
                            newBoardColor === c ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "opacity-50 hover:opacity-90 hover:scale-105"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowCreateBoard(false); setNewBoardName(""); }} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition">Batal</button>
                    <button onClick={createBoard} disabled={!newBoardName.trim()} className="flex-[2] py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition shadow-sm">Buat Board</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateBoard(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-primary hover:text-white bg-primary/5 hover:bg-primary border border-primary/20 hover:border-primary transition-all inline-flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Buat Board Baru
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {detailTask && user && (
        <TaskDetailModal
          task={tasks.find((t) => t.id === detailTask.id) || detailTask}
          currentUser={user}
          employees={employees}
          onClose={() => setDetailTask(null)}
        />
      )}

      {showForm.open && (() => {
        const colInfo = columns.find((c) => c.key === showForm.status) || columns[0];
        const colBg = COL_COLORS[colInfo.color as ColColor] || "bg-gray-500";
        const selectedEmps = employees.filter((e) => form.assignee_ids.includes(e.id));
        return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
            onClick={() => !loading && setShowForm({ open: false, status: "brief" })}
          >
            <div
              className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl animate-slide-up max-h-[92vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="md:hidden flex justify-center pt-2 pb-0"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
              <div className={`${colBg} mx-4 mt-3 md:mt-4 rounded-xl px-4 py-3 text-white flex items-center justify-between`}>
                <div>
                  <h3 className="font-bold text-base">{showForm.task ? "Edit Task" : "Task Baru"}</h3>
                  <p className="text-xs text-white/70 mt-0.5">{colInfo.label}{colInfo.description ? ` • ${colInfo.description}` : ""}</p>
                </div>
                <button
                  onClick={() => setShowForm({ open: false, status: "brief" })}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={saveTask} className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Title */}
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Nama task..."
                  className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-gray-200 focus:border-primary text-base font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 placeholder:font-normal"
                  required
                  autoFocus
                />

                {/* Description */}
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Deskripsi (opsional)..."
                  className="w-full px-0 py-2 bg-transparent border-0 border-b border-gray-100 focus:border-gray-300 text-sm text-gray-700 outline-none transition resize-none placeholder:text-gray-400"
                />

                {/* Color label */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Label</p>
                  <div className="flex gap-2">
                    {CARD_COLORS.map((c) => {
                      const active = form.color === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setForm({ ...form, color: c.key })}
                          className={`w-10 h-10 rounded-xl ${c.dot} transition-all shadow-sm ${
                            active ? "ring-[3px] ring-offset-2 ring-gray-900 scale-110" : "opacity-40 hover:opacity-70 hover:scale-105"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Assignees - compact */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-widest flex items-center gap-1">
                    <UserIcon size={11} /> Anggota
                    {selectedEmps.length > 0 && (
                      <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-bold normal-case tracking-normal">{selectedEmps.length}</span>
                    )}
                  </p>
                  {/* Selected chips */}
                  {selectedEmps.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {selectedEmps.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              assignee_ids: form.assignee_ids.filter((x) => x !== e.id),
                            })
                          }
                          className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-full pl-0.5 pr-2.5 py-0.5 group hover:bg-red-50 hover:border-red-200 transition"
                        >
                          <Avatar name={e.name} photoUrl={e.photo_url} size="xs" />
                          <span className="text-xs font-medium text-gray-700 group-hover:text-red-600">
                            {e.name.split(" ")[0]}
                          </span>
                          <X size={10} className="text-gray-400 group-hover:text-red-500" />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Picker */}
                  <div className="space-y-0.5 max-h-36 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-1">
                    {employees
                      .filter((e) => e.is_active && !form.assignee_ids.includes(e.id))
                      .map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              assignee_ids: [...form.assignee_ids, e.id],
                            })
                          }
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white transition"
                        >
                          <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{e.name}</p>
                            {e.position && <p className="text-[10px] text-gray-500 truncate">{e.position}</p>}
                          </div>
                          <Plus size={14} className="text-gray-400" />
                        </button>
                      ))}
                    {employees.filter((e) => e.is_active && !form.assignee_ids.includes(e.id)).length === 0 && (
                      <p className="text-[11px] text-gray-400 text-center py-2 italic">Semua sudah dipilih</p>
                    )}
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-widest flex items-center gap-1">
                    <CalendarIcon size={11} /> Deadline
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                    />
                    {form.due_date && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, due_date: "" })}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {form.due_date && (
                    <p className="text-xs text-primary font-medium mt-1.5 px-1">
                      {format(new Date(form.due_date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                    </p>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 italic flex items-center gap-1">
                  <Paperclip size={10} /> Gambar & link bisa ditambah setelah task dibuat
                </p>
              </form>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-white flex gap-3 safe-bottom">
                <button
                  type="button"
                  onClick={() => setShowForm({ open: false, status: "brief" })}
                  disabled={loading}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={saveTask}
                  disabled={loading || !form.title.trim()}
                  className={`flex-[2] py-3 ${colBg} hover:opacity-90 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition shadow-md`}
                >
                  {loading ? "Menyimpan..." : showForm.task ? "Simpan" : "Buat Task"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
