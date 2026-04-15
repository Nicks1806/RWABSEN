"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Employee, Task } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  X,
  CheckCircle2,
  Trash2,
  User as UserIcon,
  Calendar as CalendarIcon,
  AlignLeft,
  Check,
} from "lucide-react";
import Avatar from "@/components/Avatar";

const CARD_COLORS: { key: Task["color"]; bg: string; border: string; dot: string; label: string }[] = [
  { key: "red", bg: "bg-rose-50", border: "border-l-rose-500", dot: "bg-rose-500", label: "Merah" },
  { key: "yellow", bg: "bg-amber-50", border: "border-l-amber-500", dot: "bg-amber-500", label: "Kuning" },
  { key: "green", bg: "bg-emerald-50", border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Hijau" },
  { key: "blue", bg: "bg-blue-50", border: "border-l-blue-500", dot: "bg-blue-500", label: "Biru" },
  { key: "purple", bg: "bg-purple-50", border: "border-l-purple-500", dot: "bg-purple-500", label: "Ungu" },
  { key: "gray", bg: "bg-gray-50", border: "border-l-gray-400", dot: "bg-gray-400", label: "Abu" },
];

interface Props {
  task: Task;
  currentUser: Employee;
  employees: Employee[];
  onClose: () => void;
}

export default function TaskDetailModal({ task, employees, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [color, setColor] = useState<Task["color"]>(task.color);
  const initialAssignees: string[] = (() => {
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) return [task.assignee_id, ...arr];
    return arr;
  })();
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssignees);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setColor(task.color);
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) setAssigneeIds([task.assignee_id, ...arr]);
    else setAssigneeIds(arr);
    setDueDate(task.due_date || "");
  }, [task]);

  async function saveAll() {
    if (!title.trim()) {
      alert("Judul wajib diisi");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        color,
        assignees: assigneeIds,
        assignee_id: assigneeIds[0] || null,
        due_date: dueDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    setSaving(false);
    if (error) {
      alert("Gagal menyimpan: " + error.message);
      return;
    }
    onClose();
  }

  async function deleteTask() {
    if (!confirm("Hapus task ini?")) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    onClose();
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const currentColor = CARD_COLORS.find((c) => c.key === color) || CARD_COLORS[0];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start md:items-center justify-center md:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-lg md:rounded-3xl shadow-2xl my-0 md:my-4 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color bar */}
        <div className={`h-2 ${currentColor.dot}`} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Detail Task</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Judul
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              placeholder="Judul task"
              maxLength={200}
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <AlignLeft size={12} /> Catatan
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white resize-none"
              placeholder="Catatan, detail, atau to-do list..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <CalendarIcon size={12} /> Deadline
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              />
              {dueDate && (
                <button
                  onClick={() => setDueDate("")}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs text-gray-600"
                >
                  Hapus
                </button>
              )}
            </div>
            {dueDate && (
              <p className="text-[11px] text-gray-500 mt-1">
                {format(new Date(dueDate), "EEEE, dd MMMM yyyy", { locale: idLocale })}
              </p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Warna Label
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  className={`w-10 h-10 rounded-xl ${c.bg} border-l-4 ${c.border} transition-all ${
                    color === c.key
                      ? "ring-2 ring-offset-2 ring-gray-800 scale-105 shadow-md"
                      : "hover:scale-105"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <UserIcon size={12} /> Di-assign ke ({assigneeIds.length})
            </label>
            <div className="space-y-1 max-h-56 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
              {employees
                .filter((e) => e.is_active)
                .map((e) => {
                  const selected = assigneeIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleAssignee(e.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                        selected
                          ? "bg-white shadow-sm ring-2 ring-primary/30 font-semibold"
                          : "hover:bg-white/60"
                      }`}
                    >
                      <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm truncate">{e.name}</p>
                        {e.position && (
                          <p className="text-[10px] text-gray-500 truncate">{e.position}</p>
                        )}
                      </div>
                      {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
          <button
            onClick={deleteTask}
            className="px-3 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium inline-flex items-center gap-1"
          >
            <Trash2 size={14} /> Hapus
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex-1 px-3 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Check size={14} /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
