"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Employee, Task, ChecklistItem, TaskComment } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  X,
  CheckSquare,
  MessageSquare,
  CheckCircle2,
  Circle,
  Trash2,
  Send,
  User as UserIcon,
  Calendar as CalendarIcon,
  Tag,
  AlignLeft,
  Plus,
} from "lucide-react";
import Avatar from "@/components/Avatar";

const CARD_COLORS: { key: Task["color"]; bg: string; border: string; dot: string }[] = [
  { key: "red", bg: "bg-rose-50", border: "border-l-rose-500", dot: "bg-rose-500" },
  { key: "yellow", bg: "bg-amber-50", border: "border-l-amber-500", dot: "bg-amber-500" },
  { key: "green", bg: "bg-emerald-50", border: "border-l-emerald-500", dot: "bg-emerald-500" },
  { key: "blue", bg: "bg-blue-50", border: "border-l-blue-500", dot: "bg-blue-500" },
  { key: "purple", bg: "bg-purple-50", border: "border-l-purple-500", dot: "bg-purple-500" },
  { key: "gray", bg: "bg-gray-50", border: "border-l-gray-400", dot: "bg-gray-400" },
];

interface Props {
  task: Task;
  currentUser: Employee;
  employees: Employee[];
  onClose: () => void;
}

export default function TaskDetailModal({ task, currentUser, employees, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(task.description || "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newItemText, setNewItemText] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>(task.comments || []);
  const [newComment, setNewComment] = useState("");
  const [color, setColor] = useState<Task["color"]>(task.color);
  // Multi-assign: union of assignees array + legacy assignee_id for backward compat
  const initialAssignees: string[] = (() => {
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) {
      return [task.assignee_id, ...arr];
    }
    return arr;
  })();
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssignees);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [showAssignee, setShowAssignee] = useState(false);

  // Live sync task updates
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setChecklist(task.checklist || []);
    setComments(task.comments || []);
    setColor(task.color);
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) {
      setAssigneeIds([task.assignee_id, ...arr]);
    } else {
      setAssigneeIds(arr);
    }
    setDueDate(task.due_date || "");
  }, [task]);

  async function update(patch: Partial<Task>) {
    await supabase
      .from("tasks")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  async function saveTitle() {
    if (!title.trim()) {
      setTitle(task.title);
      setEditingTitle(false);
      return;
    }
    await update({ title: title.trim() });
    setEditingTitle(false);
  }

  async function saveDesc() {
    await update({ description: description.trim() || null });
    setEditingDesc(false);
  }

  async function saveColor(c: Task["color"]) {
    setColor(c);
    await update({ color: c });
  }

  async function toggleAssignee(id: string) {
    const isSelected = assigneeIds.includes(id);
    const updated = isSelected ? assigneeIds.filter((x) => x !== id) : [...assigneeIds, id];
    setAssigneeIds(updated);
    // Also set legacy assignee_id to first one for backward compat
    await update({
      assignees: updated,
      assignee_id: updated[0] || null,
    } as Partial<Task>);
  }

  async function clearAssignees() {
    setAssigneeIds([]);
    await update({ assignees: [], assignee_id: null } as Partial<Task>);
  }

  async function saveDueDate(d: string) {
    setDueDate(d);
    await update({ due_date: d || null });
  }

  // Checklist
  async function addChecklistItem() {
    if (!newItemText.trim()) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      done: false,
    };
    const updated = [...checklist, item];
    setChecklist(updated);
    setNewItemText("");
    setAddingItem(false);
    await update({ checklist: updated });
  }

  async function toggleItem(id: string) {
    const updated = checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    setChecklist(updated);
    await update({ checklist: updated });
  }

  async function deleteItem(id: string) {
    const updated = checklist.filter((i) => i.id !== id);
    setChecklist(updated);
    await update({ checklist: updated });
  }

  // Comments
  async function addComment() {
    if (!newComment.trim()) return;
    const comment: TaskComment = {
      id: crypto.randomUUID(),
      text: newComment.trim(),
      by: currentUser.id,
      byName: currentUser.name,
      at: new Date().toISOString(),
    };
    const updated = [...comments, comment];
    setComments(updated);
    setNewComment("");
    await update({ comments: updated });
  }

  async function deleteTask() {
    if (!confirm("Hapus task ini?")) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    onClose();
  }

  const doneCount = checklist.filter((i) => i.done).length;
  const progress = checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0;
  const currentColor = CARD_COLORS.find((c) => c.key === color) || CARD_COLORS[0];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start md:items-center justify-center md:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-3xl shadow-2xl my-0 md:my-4 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color header bar */}
        <div className={`h-2 ${currentColor.dot}`} />

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${currentColor.bg} border-l-4 ${currentColor.border} flex items-center justify-center`}>
            <CheckSquare size={18} className="text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full text-lg font-bold text-gray-900 outline-none border-b-2 border-primary pb-0.5"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-lg font-bold text-gray-900 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded"
              >
                {title}
              </h2>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
              Di kolom: {task.status === "brief" ? "Brief" : task.status === "today" ? "Today" : task.status === "done" ? "Done" : "History"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Main content */}
          <div className="p-5 space-y-5">
            {/* Labels & Due date badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => saveColor(c.key)}
                  className={`w-10 h-6 rounded-md transition ${c.dot} ${
                    color === c.key ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : "hover:scale-105 opacity-70"
                  }`}
                  title={c.key}
                />
              ))}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft size={16} className="text-gray-500" />
                <h3 className="font-semibold text-sm text-gray-800">Deskripsi</h3>
              </div>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Tambah detail, context, atau instruksi..."
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveDesc}
                      className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => {
                        setDescription(task.description || "");
                        setEditingDesc(false);
                      }}
                      className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : description ? (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:bg-gray-100 transition"
                >
                  {description}
                </div>
              ) : (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="w-full text-left text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition"
                >
                  Klik untuk tambah deskripsi...
                </button>
              )}
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-gray-500" />
                  <h3 className="font-semibold text-sm text-gray-800">Checklist</h3>
                  {checklist.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {doneCount}/{checklist.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {checklist.length > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-semibold w-8">
                    {Math.round(progress)}%
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        progress === 100 ? "bg-green-500" : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-1">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group py-1">
                    <button onClick={() => toggleItem(item.id)} className="shrink-0">
                      {item.done ? (
                        <CheckCircle2 size={18} className="text-green-600" />
                      ) : (
                        <Circle size={18} className="text-gray-400 hover:text-primary" />
                      )}
                    </button>
                    <p
                      className={`flex-1 text-sm ${
                        item.done ? "line-through text-gray-400" : "text-gray-700"
                      }`}
                    >
                      {item.text}
                    </p>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {addingItem ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addChecklistItem();
                      if (e.key === "Escape") {
                        setNewItemText("");
                        setAddingItem(false);
                      }
                    }}
                    placeholder="Tambah item..."
                    autoFocus
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addChecklistItem}
                      className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold"
                    >
                      Tambah
                    </button>
                    <button
                      onClick={() => {
                        setNewItemText("");
                        setAddingItem(false);
                      }}
                      className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="mt-2 text-xs text-gray-500 hover:text-primary inline-flex items-center gap-1 font-medium"
                >
                  <Plus size={12} /> Tambah item
                </button>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-gray-500" />
                <h3 className="font-semibold text-sm text-gray-800">Komentar & Aktivitas</h3>
              </div>

              <div className="flex gap-2 mb-3">
                <Avatar name={currentUser.name} photoUrl={currentUser.photo_url} size="sm" />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                    placeholder="Tulis komentar..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                  />
                  <button
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-30"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Belum ada komentar</p>
                ) : (
                  [...comments].reverse().map((c) => {
                    const emp = employees.find((e) => e.id === c.by);
                    return (
                      <div key={c.id} className="flex gap-2">
                        <Avatar name={c.byName || emp?.name || "?"} photoUrl={emp?.photo_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2">
                            <p className="text-xs font-semibold text-gray-800">
                              {c.byName || emp?.name || "Unknown"}
                            </p>
                            <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 ml-3">
                            {format(new Date(c.at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="p-5 border-t md:border-t-0 md:border-l border-gray-100 bg-gray-50/50 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              Tambahkan ke Card
            </p>

            {/* Members */}
            <div>
              <button
                onClick={() => setShowAssignee(!showAssignee)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-100 rounded-lg text-sm text-gray-700 border transition"
              >
                <UserIcon size={14} /> Members
              </button>
              {showAssignee && (
                <div className="mt-1.5 space-y-1 max-h-60 overflow-y-auto bg-white p-1.5 rounded-lg border">
                  {assigneeIds.length > 0 && (
                    <button
                      onClick={clearAssignees}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition hover:bg-gray-50 text-gray-500"
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                        <X size={12} className="text-gray-400" />
                      </div>
                      <span className="flex-1 text-left italic">Hapus semua</span>
                    </button>
                  )}
                  {employees
                    .filter((e) => e.is_active)
                    .map((e) => {
                      const selected = assigneeIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => toggleAssignee(e.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                            selected ? "bg-primary/10 font-semibold ring-1 ring-primary/30" : "hover:bg-gray-50"
                          }`}
                        >
                          <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm truncate">{e.name}</p>
                            {e.position && <p className="text-[10px] text-gray-500 truncate">{e.position}</p>}
                          </div>
                          {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              )}
              {assigneeIds.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {assigneeIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    if (!emp) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border group"
                      >
                        <Avatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{emp.name}</p>
                          {emp.position && (
                            <p className="text-[10px] text-gray-500 truncate">{emp.position}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleAssignee(id)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          title="Hapus"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Due Date */}
            <div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm text-gray-700 border">
                <CalendarIcon size={14} />
                <span>Deadline</span>
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => saveDueDate(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Label */}
            <div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm text-gray-700 border mb-1.5">
                <Tag size={14} />
                <span>Label</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {CARD_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => saveColor(c.key)}
                    className={`h-7 rounded-md transition ${c.dot} ${
                      color === c.key ? "ring-2 ring-offset-1 ring-gray-800" : "opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="pt-3 border-t">
              <button
                onClick={deleteTask}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition"
              >
                <Trash2 size={14} /> Hapus Task
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
