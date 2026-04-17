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
import { POSITIONS } from "@/lib/positions";
import type { BoardColumn, Board, BoardMessage } from "@/lib/types";
import { MessageCircle, Columns3, Send, Upload } from "lucide-react";

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

function MobileTaskCard({ task, columns, onClick, onMove, onRename }: {
  task: Task; columns: BoardColumn[]; onClick: () => void; onMove: (colKey: string) => void; onRename: (t: string) => void;
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
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative"
    >
      {/* Cover */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full h-32 object-cover rounded-t-2xl" onClick={onClick} />
      )}

      <div onClick={onClick} className="px-4 pt-2 pb-2.5">
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
              {/* Move to column */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pindah ke kolom</p>
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
  const [newBoardRoles, setNewBoardRoles] = useState<string[]>([]);
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
  // Bottom bar tab: "board" | "message"
  const [bottomTab, setBottomTab] = useState<"board" | "message">("board");
  const [chatMessages, setChatMessages] = useState<BoardMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatReplyTo, setChatReplyTo] = useState<BoardMessage | null>(null);
  const [chatUploading, setChatUploading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  // Task form advanced toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Inline quick add per column
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddAssignees, setQuickAddAssignees] = useState<string[]>([]);
  const [quickAddColor, setQuickAddColor] = useState<Task["color"]>("red");
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
      allowed_roles: newBoardRoles.length > 0 ? newBoardRoles : null,
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
    setNewBoardRoles([]);
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

  // ===== Chat =====
  async function fetchChat() {
    try {
      const boardId = activeBoard?.id || null;
      // Cleanup: delete messages older than 90 days (fire and forget, admin-only client trigger)
      if (user?.role === "admin") {
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        supabase.from("board_messages").delete().lt("created_at", cutoff).then(() => {});
      }
      let q = supabase.from("board_messages").select("*").order("created_at", { ascending: true }).limit(200);
      if (boardId) q = q.eq("board_id", boardId);
      else q = q.is("board_id", null);
      const { data } = await q;
      if (data) setChatMessages(data as BoardMessage[]);
    } catch { /* table may not exist */ }
  }

  async function sendChat(imageUrl?: string) {
    if ((!chatText.trim() && !imageUrl) || !user) return;
    const msg: Partial<BoardMessage> = {
      board_id: activeBoard?.id || null,
      sender_id: user.id,
      sender_name: user.name,
      text: chatText.trim() || (imageUrl ? "📷 Gambar" : ""),
      image_url: imageUrl || null,
      reply_to_id: chatReplyTo?.id || null,
      reply_to_text: chatReplyTo?.text?.slice(0, 80) || null,
      reply_to_sender: chatReplyTo?.sender_name || null,
    };
    setChatText("");
    setChatReplyTo(null);
    const { data } = await supabase.from("board_messages").insert(msg).select().single();
    if (data) setChatMessages((prev) => [...prev, data as BoardMessage]);
  }

  async function deleteChatMessage(id: string) {
    if (!confirm("Hapus pesan ini?")) return;
    await supabase.from("board_messages").delete().eq("id", id);
    setChatMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function sendChatImage(file: File) {
    if (!user || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5 MB"); return; }
    setChatUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `chat/${activeBoard?.id || "general"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attendance-photos").upload(filename, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
      await sendChat(urlData.publicUrl);
    } catch (e) {
      alert("Upload gagal: " + (e instanceof Error ? e.message : e));
    } finally {
      setChatUploading(false);
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
    }
  }

  // Fetch chat when switching to message tab or board
  useEffect(() => {
    if (bottomTab === "message") fetchChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTab, activeBoard]);

  // Chat realtime subscription — new messages from any device auto-appear
  useEffect(() => {
    if (bottomTab !== "message") return;
    const boardId = activeBoard?.id || null;
    const channel = supabase
      .channel(`chat-${boardId || "general"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_messages" },
        (payload) => {
          const msg = payload.new as BoardMessage;
          if ((msg.board_id || null) !== boardId) return;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "board_messages" },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) setChatMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTab, activeBoard]);

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

  async function quickAddTask(colKey: string, title: string) {
    if (!title.trim() || !user) return;
    const assignees = quickAddAssignees.length > 0 ? quickAddAssignees : [user.id];
    const { data } = await supabase.from("tasks").insert({
      title: title.trim(),
      status: colKey,
      color: quickAddColor,
      assignees,
      assignee_id: assignees[0],
      created_by: user.id,
      board_id: activeBoard?.id || null,
    }).select().single();
    if (data) {
      const empMap = new Map(employees.map((e) => [e.id, e]));
      const assigneeObjects = assignees.map((id) => empMap.get(id)).filter(Boolean) as Employee[];
      const newTask: Task = { ...data, assignees, assigneeObjects, assignee: assigneeObjects[0] };
      setTasks((prev) => [...prev, newTask]);
    }
    setQuickAddText("");
    // Keep assignees & color for continuous add of similar tasks
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

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    <div
      className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50 flex flex-col transition-[margin] duration-300 ease-out"
      style={{ marginLeft: !isMobile && bottomTab === "message" ? 360 : 0 }}
    >
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
            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition ${
                filterMine ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Filter size={13} /> {filterMine ? "Tugas Saya" : "Semua"}
            </button>
          </div>

          <div className={`${isMobile ? "hidden" : "grid"} grid-cols-3 gap-2`}>
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
          {isMobile && (
            <div className="overflow-x-auto -mx-4 scrollbar-hide">
            <div className="flex gap-2 pb-2 pt-1 px-4 w-max">
              {columns.map((col, idx) => {
                const count = filteredTasks.filter((t) => t.status === col.key).length;
                const isActive = mobileTab === idx;
                const topBarColor = COL_COLORS[col.color as ColColor] || "bg-gray-400";
                return (
                  <button
                    key={col.id}
                    onClick={() => setMobileTab(idx)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition snap-start ${
                      isActive
                        ? "bg-gray-900 text-white shadow-md"
                        : "bg-white text-gray-600 border border-gray-200 shadow-sm"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${topBarColor} ${isActive ? "ring-2 ring-white/30" : ""}`} />
                    {col.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
          )}
        </div>
      </header>

      {/* ====== MOBILE: Simple card list (no dnd-kit) ====== */}
      {isMobile && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-24">
          {(() => {
            const col = columns[mobileTab];
            if (!col) return null;
            const colTasks = filteredTasks
              .filter((t) => t.status === col.key)
              .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
            return (
              <>
                {colTasks.length === 0 && (
                  <div className="text-center py-12">
                    <div className={`w-14 h-14 ${COL_COLORS[col.color as ColColor] || "bg-gray-400"} opacity-20 rounded-full mx-auto mb-3`} />
                    <p className="text-sm text-gray-400 font-medium">Belum ada task</p>
                    <p className="text-xs text-gray-400 mt-1">Tap + untuk tambah</p>
                  </div>
                )}
                {colTasks.map((task) => (
                  <MobileTaskCard
                    key={task.id}
                    task={task}
                    columns={columns}
                    onClick={() => setDetailTask(task)}
                    onMove={(newStatus) => {
                      moveTaskToColumn(task.id, newStatus);
                      const targetIdx = columns.findIndex((c) => c.key === newStatus);
                      if (targetIdx >= 0) setTimeout(() => setMobileTab(targetIdx), 300);
                    }}
                    onRename={(t) => renameTaskInline(task.id, t)}
                  />
                ))}
                {/* Quick inline add — enhanced with assignee + color */}
                {quickAddCol === col.key ? (
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-primary/40 overflow-hidden">
                    {/* Title input */}
                    <input
                      type="text"
                      value={quickAddText}
                      onChange={(e) => setQuickAddText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && quickAddText.trim()) {
                          e.preventDefault();
                          quickAddTask(col.key, quickAddText);
                        } else if (e.key === "Escape") {
                          setQuickAddCol(null);
                          setQuickAddText("");
                        }
                      }}
                      placeholder="Apa yang mau dikerjakan?"
                      autoFocus
                      className="w-full px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal outline-none border-b border-gray-100"
                    />

                    {/* Color pills */}
                    <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                      {CARD_COLORS.map((c) => {
                        const active = quickAddColor === c.key;
                        return (
                          <button
                            key={c.key}
                            onClick={() => setQuickAddColor(c.key)}
                            className={`shrink-0 w-8 h-8 rounded-lg ${c.dot} transition-all shadow-sm ${
                              active ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : "opacity-40"
                            }`}
                            aria-label={c.key}
                          />
                        );
                      })}
                    </div>

                    {/* Assignees */}
                    <div className="px-3 pb-2.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <UserIcon size={10} /> Assign ke
                        {quickAddAssignees.length > 0 && <span className="bg-primary text-white px-1.5 py-0.5 rounded-full text-[9px] ml-1 normal-case tracking-normal">{quickAddAssignees.length}</span>}
                      </p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {employees.filter((e) => e.is_active).map((e) => {
                          const sel = quickAddAssignees.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              onClick={() => setQuickAddAssignees((prev) => sel ? prev.filter((x) => x !== e.id) : [...prev, e.id])}
                              className={`shrink-0 flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full border-2 transition ${
                                sel ? "bg-primary/10 border-primary" : "bg-gray-50 border-transparent"
                              }`}
                            >
                              <Avatar name={e.name} photoUrl={e.photo_url} size="xs" />
                              <span className={`text-xs font-medium ${sel ? "text-primary" : "text-gray-600"}`}>
                                {e.name.split(" ")[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-gray-100 p-2 flex gap-1.5 bg-gray-50/60">
                      <button
                        onClick={() => { setQuickAddCol(null); setQuickAddText(""); setQuickAddAssignees([]); }}
                        className="px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition"
                      >
                        Tutup
                      </button>
                      <button
                        onClick={() => {
                          setQuickAddCol(null);
                          setQuickAddText("");
                          openCreate(col.key);
                        }}
                        className="w-10 h-10 border border-gray-200 text-gray-600 rounded-xl text-xs font-medium hover:bg-white transition flex items-center justify-center"
                        title="Form lengkap (deadline, deskripsi, dll)"
                      >
                        ⚙
                      </button>
                      <button
                        onClick={() => quickAddText.trim() && quickAddTask(col.key, quickAddText)}
                        disabled={!quickAddText.trim()}
                        className="flex-1 px-3 py-2.5 bg-gradient-to-br from-primary to-primary-dark text-white rounded-xl text-sm font-bold disabled:opacity-40 shadow-md active:scale-95 transition inline-flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} strokeWidth={3} /> Tambah Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setQuickAddCol(col.key); setQuickAddText(""); }}
                    className="w-full py-3 rounded-xl text-sm text-gray-500 hover:text-primary bg-white hover:shadow-sm transition border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center gap-1.5 font-medium active:scale-[0.98]"
                  >
                    <Plus size={16} /> Tambah task
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ====== DESKTOP: Kanban with dnd-kit ====== */}
      {!isMobile && (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-hidden">
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
      )}

      {/* Task Bottom Bar — hidden when chat is open on mobile */}
      {!(isMobile && bottomTab === "message") && (
        <>
      <div className="h-24" />
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pointer-events-none" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-2xl border border-gray-200/60 rounded-2xl shadow-[0_10px_40px_rgba(139,26,26,0.12)] flex items-center gap-1 p-1.5">
            {[
              { key: "switch", label: "Switch", icon: LayoutGrid, active: showBoardSwitcher, onClick: () => setShowBoardSwitcher(!showBoardSwitcher) },
              { key: "board", label: "Board", icon: Columns3, active: bottomTab === "board" && !showBoardSwitcher, onClick: () => { setShowBoardSwitcher(false); setBottomTab("board"); } },
              { key: "message", label: "Chat", icon: MessageCircle, active: bottomTab === "message", onClick: () => setBottomTab(bottomTab === "message" ? "board" : "message") },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl transition-all duration-200 active:scale-90 ${
                    item.active
                      ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30"
                      : "text-gray-500 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <Icon size={20} strokeWidth={item.active ? 2.5 : 2} />
                  <span className={`text-[10px] ${item.active ? "font-bold" : "font-medium"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
        </>
      )}

      {/* Message Panel */}
      {bottomTab === "message" && (
        <>
        <div
          className="bg-white flex flex-col border-r border-gray-200 shadow-xl fixed z-30"
          style={isMobile ? { top: 0, left: 0, right: 0, bottom: 0 } : { top: 0, left: 0, bottom: 0, width: 360 }}
        >
          {/* Chat header */}
          {/* Header with search */}
          <div className="bg-white border-b border-gray-200 px-4 pt-3 pb-2 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setBottomTab("board")} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600">
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-gray-900 truncate">
                  💬 {activeBoard ? activeBoard.name : "General"} Chat
                </h3>
                <p className="text-[10px] text-gray-500">{chatMessages.length} pesan • auto-delete &gt;90 hari</p>
              </div>
            </div>
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="🔍 Cari pesan..."
                className="w-full px-3.5 py-2 bg-gray-100 border-0 rounded-full text-xs outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              />
              {chatSearch && (
                <button onClick={() => setChatSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs"><X size={12} /></button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-16">
                <MessageCircle size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Belum ada pesan</p>
                <p className="text-xs text-gray-400 mt-1">Mulai percakapan dengan tim</p>
              </div>
            )}
            {chatMessages
              .filter((m) => !chatSearch.trim() || m.text.toLowerCase().includes(chatSearch.toLowerCase()) || (m.sender_name || "").toLowerCase().includes(chatSearch.toLowerCase()))
              .map((m) => {
              const isMe = m.sender_id === user?.id;
              const emp = employees.find((e) => e.id === m.sender_id);
              const canDelete = isMe || user?.role === "admin";
              return (
                <div key={m.id} className={`flex gap-2.5 group ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && <Avatar name={emp?.name || m.sender_name || "?"} photoUrl={emp?.photo_url} size="sm" />}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && <p className="text-[10px] text-gray-500 font-semibold mb-0.5 px-1">{emp?.name || m.sender_name}</p>}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                    }`}>
                      {/* Reply preview */}
                      {m.reply_to_id && m.reply_to_text && (
                        <div className={`mb-1.5 px-2 py-1 rounded-lg border-l-2 ${
                          isMe ? "bg-white/15 border-white/60" : "bg-gray-50 border-primary/50"
                        }`}>
                          <p className={`text-[9px] font-bold ${isMe ? "text-white/80" : "text-primary"}`}>
                            ↩ {m.reply_to_sender}
                          </p>
                          <p className={`text-[11px] truncate ${isMe ? "text-white/70" : "text-gray-500"}`}>
                            {m.reply_to_text}
                          </p>
                        </div>
                      )}
                      {/* Image */}
                      {m.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="rounded-lg mb-1.5 max-w-[240px] cursor-pointer"
                          onClick={() => window.open(m.image_url!, "_blank")}
                        />
                      )}
                      {m.text && m.text !== "📷 Gambar" && (
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                      <p className="text-[9px] text-gray-400">
                        {format(new Date(m.created_at), "HH:mm", { locale: idLocale })}
                      </p>
                      <button
                        onClick={() => setChatReplyTo(m)}
                        className="text-[9px] text-gray-400 hover:text-primary font-medium"
                      >
                        ↩ Balas
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => deleteChatMessage(m.id)}
                          className="text-[9px] text-gray-400 hover:text-red-500 font-medium"
                        >
                          🗑 Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply preview bar */}
          {chatReplyTo && (
            <div className="bg-primary/5 border-t border-primary/20 px-4 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                <p className="text-[10px] font-bold text-primary">↩ Balas {chatReplyTo.sender_name}</p>
                <p className="text-xs text-gray-600 truncate">{chatReplyTo.text}</p>
              </div>
              <button onClick={() => setChatReplyTo(null)} className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex items-center gap-1.5" style={isMobile ? { paddingBottom: "max(10px, env(safe-area-inset-bottom))" } : undefined}>
            <button
              onClick={() => chatFileInputRef.current?.click()}
              disabled={chatUploading}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 disabled:opacity-40 transition active:scale-90"
              title="Kirim gambar"
            >
              {chatUploading ? <Upload size={16} className="animate-pulse" /> : <ImageIcon size={18} />}
            </button>
            <input
              ref={chatFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) sendChatImage(f); }}
            />
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder={chatReplyTo ? "Ketik balasan..." : "Ketik pesan..."}
              className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white transition min-w-0"
            />
            <button
              onClick={() => sendChat()}
              disabled={!chatText.trim()}
              className="w-10 h-10 rounded-full bg-primary hover:bg-primary-dark text-white flex items-center justify-center disabled:opacity-40 transition shadow-sm shrink-0 active:scale-90"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        </>
      )}

      {/* Board Switcher Modal */}
      {showBoardSwitcher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-12 md:pt-20 px-4" onClick={() => setShowBoardSwitcher(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl animate-slide-up border border-gray-200 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-primary-dark px-5 pt-5 pb-4 text-white relative sticky top-0 z-10">
              <button onClick={() => setShowBoardSwitcher(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"><X size={14} /></button>
              <LayoutGrid size={20} className="mb-1.5 opacity-80" />
              <h3 className="font-bold text-lg">Board Anda</h3>
              <p className="text-xs text-white/70 mt-0.5">Pilih atau buat board per divisi</p>
            </div>

            <div className="p-3 space-y-1.5">
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
              {boards.filter((b) => {
                // Filter by allowed_roles: null = everyone, array = check user position
                if (!b.allowed_roles || b.allowed_roles.length === 0) return true;
                const userPos = user?.position || "";
                const userRole = user?.role || "";
                return b.allowed_roles.some((r) => userPos.toLowerCase().includes(r.toLowerCase()) || userRole === "admin");
              }).map((b) => {
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
                        {b.allowed_roles && b.allowed_roles.length > 0 ? (
                          <p className="text-[10px] text-gray-500 truncate">{b.allowed_roles.join(", ")}</p>
                        ) : (
                          <p className="text-[10px] text-gray-500">Semua role</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">AKTIF</span>
                      )}
                      <button
                        onClick={() => deleteBoard(b)}
                        className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition active:scale-90"
                        title="Hapus board"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
                    <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Warna</p>
                    <div className="flex gap-2 flex-wrap">
                      {BOARD_COLORS.map((c) => (
                        <button key={c} onClick={() => setNewBoardColor(c)}
                          className={`w-8 h-8 rounded-lg ${c} transition-all shadow-sm ${
                            newBoardColor === c ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "opacity-50 hover:opacity-90"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Role access picker */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Akses Role</p>
                    <p className="text-[10px] text-gray-400 mb-2">Kosongkan = semua bisa akses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {POSITIONS.map((role) => {
                        const selected = newBoardRoles.includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => setNewBoardRoles(selected ? newBoardRoles.filter((r) => r !== role) : [...newBoardRoles, role])}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                              selected
                                ? "bg-primary text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {selected && "✓ "}{role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowCreateBoard(false); setNewBoardName(""); setNewBoardRoles([]); }} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition">Batal</button>
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
        let touchStartY = 0;
        let touchDeltaY = 0;
        return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
            onClick={() => !loading && setShowForm({ open: false, status: "brief" })}
          >
            <div
              className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl animate-slide-up overflow-hidden flex flex-col"
              style={{ maxHeight: "92dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Swipeable top area (handle + header together) */}
              <div
                className="md:hidden touch-pan-y"
                onTouchStart={(e) => { touchStartY = e.touches[0].clientY; touchDeltaY = 0; }}
                onTouchMove={(e) => { touchDeltaY = e.touches[0].clientY - touchStartY; }}
                onTouchEnd={() => {
                  if (touchDeltaY > 60 && !loading) setShowForm({ open: false, status: "brief" });
                  touchDeltaY = 0;
                }}
              >
                <div className="flex justify-center pt-2.5 pb-1">
                  <div className="w-14 h-1.5 bg-gray-300 rounded-full" />
                </div>
              </div>
              <div className={`${colBg} mx-4 mt-2 md:mt-4 rounded-xl px-4 py-3 text-white flex items-center justify-between`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base">{showForm.task ? "Edit Task" : "Task Baru"}</h3>
                  <p className="text-xs text-white/70 mt-0.5">{colInfo.label}{colInfo.description ? ` • ${colInfo.description}` : ""}</p>
                </div>
                <button
                  onClick={() => setShowForm({ open: false, status: "brief" })}
                  className="w-10 h-10 rounded-full bg-white/25 hover:bg-white/40 text-white flex items-center justify-center transition active:scale-90 shrink-0"
                  aria-label="Tutup"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <form onSubmit={saveTask} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Title — BIG and focused */}
                <div>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Apa yang mau dikerjakan?"
                    className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 focus:border-primary focus:bg-white rounded-2xl text-lg font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 placeholder:font-normal"
                    required
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && form.title.trim() && !e.shiftKey) {
                        e.preventDefault();
                        saveTask(e as unknown as React.FormEvent);
                      }
                    }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5 px-1">💡 Tekan <b>Enter</b> untuk buat task langsung</p>
                </div>

                {/* Quick label selection — compact pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {CARD_COLORS.map((c) => {
                    const active = form.color === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setForm({ ...form, color: c.key })}
                        className={`shrink-0 w-10 h-10 rounded-xl ${c.dot} transition-all shadow-sm ${
                          active ? "ring-[3px] ring-offset-2 ring-gray-900 scale-110" : "opacity-40"
                        }`}
                        aria-label={c.key}
                      />
                    );
                  })}
                  <div className="w-px h-8 bg-gray-200 mx-1" />
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`shrink-0 px-3 h-10 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                      showAdvanced
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {showAdvanced ? "▲ Tutup" : "▼ Detail"}
                  </button>
                </div>

                {/* Advanced options (collapsible) */}
                {showAdvanced && (
                <div className="space-y-4 pt-2 border-t border-gray-100 animate-fade-in">

                {/* Description */}
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Deskripsi / catatan (opsional)..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:border-primary focus:bg-white rounded-xl text-sm text-gray-700 outline-none transition resize-none placeholder:text-gray-400"
                />

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
                </div>
                )}
              </form>

              {/* Footer — sticky, keyboard-aware */}
              <div className="p-3 border-t border-gray-100 bg-white/95 backdrop-blur-md flex gap-2 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
                <button
                  type="button"
                  onClick={() => setShowForm({ open: false, status: "brief" })}
                  disabled={loading}
                  className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={saveTask}
                  disabled={loading || !form.title.trim()}
                  className={`flex-[2] py-3.5 ${colBg} text-white rounded-2xl text-sm font-bold disabled:opacity-50 transition shadow-lg active:scale-95 hover:opacity-90`}
                >
                  {loading ? "Menyimpan..." : showForm.task ? "✓ Simpan" : "+ Buat Task"}
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
