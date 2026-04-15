"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Employee, Task, TaskAttachment, TaskLabel, ChecklistItem } from "@/lib/types";
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
  Image as ImageIcon,
  Link as LinkIcon,
  Paperclip,
  Upload,
  ExternalLink,
  ListChecks,
  Plus,
  Tag,
  Square,
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
  // Labels: union of `labels[]` + legacy `color`
  const initialLabels: TaskLabel[] = (() => {
    const set = new Set<TaskLabel>(task.labels || []);
    if (task.color) set.add(task.color);
    return Array.from(set);
  })();
  const [labels, setLabels] = useState<TaskLabel[]>(initialLabels);
  const initialAssignees: string[] = (() => {
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) return [task.assignee_id, ...arr];
    return arr;
  })();
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssignees);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    const set = new Set<TaskLabel>(task.labels || []);
    if (task.color) set.add(task.color);
    setLabels(Array.from(set));
    const arr = task.assignees || [];
    if (task.assignee_id && !arr.includes(task.assignee_id)) setAssigneeIds([task.assignee_id, ...arr]);
    else setAssigneeIds(arr);
    setDueDate(task.due_date || "");
    setAttachments(task.attachments || []);
    setChecklist(task.checklist || []);
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
        color: labels[0] || "gray", // primary color = first label
        labels,
        assignees: assigneeIds,
        assignee_id: assigneeIds[0] || null,
        due_date: dueDate || null,
        attachments,
        checklist,
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

  function toggleLabel(l: TaskLabel) {
    setLabels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  // Checklist (auto-save individual mutations)
  async function persistChecklist(updated: ChecklistItem[]) {
    setChecklist(updated);
    await supabase
      .from("tasks")
      .update({ checklist: updated, updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }
  async function addChecklistItem() {
    if (!newChecklistText.trim()) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistText.trim(),
      done: false,
    };
    setNewChecklistText("");
    await persistChecklist([...checklist, item]);
  }
  async function toggleChecklistItem(id: string) {
    const updated = checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    await persistChecklist(updated);
  }
  async function removeChecklistItem(id: string) {
    await persistChecklist(checklist.filter((i) => i.id !== id));
  }

  // ===== Attachments =====
  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Hanya file gambar yang didukung");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran maksimal 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `tasks/${task.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("attendance-photos")
        .upload(filename, file, { contentType: file.type, cacheControl: "3600" });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
      const newAttachment: TaskAttachment = {
        id: crypto.randomUUID(),
        type: "image",
        url: urlData.publicUrl,
        name: file.name,
        added_at: new Date().toISOString(),
      };
      const updated = [...attachments, newAttachment];
      setAttachments(updated);
      // Auto-save attachments immediately
      await supabase
        .from("tasks")
        .update({ attachments: updated, updated_at: new Date().toISOString() })
        .eq("id", task.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Upload gagal: " + msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const newAttachment: TaskAttachment = {
      id: crypto.randomUUID(),
      type: "link",
      url,
      name: linkName.trim() || url.replace(/^https?:\/\//, "").split("/")[0],
      added_at: new Date().toISOString(),
    };
    const updated = [...attachments, newAttachment];
    setAttachments(updated);
    setLinkUrl("");
    setLinkName("");
    setShowLinkForm(false);
    await supabase
      .from("tasks")
      .update({ attachments: updated, updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  async function removeAttachment(id: string) {
    if (!confirm("Hapus attachment ini?")) return;
    const target = attachments.find((a) => a.id === id);
    const updated = attachments.filter((a) => a.id !== id);
    setAttachments(updated);
    // Best-effort delete from storage
    if (target?.type === "image" && target.url.includes("attendance-photos/")) {
      try {
        const path = target.url.split("/attendance-photos/")[1]?.split("?")[0];
        if (path) await supabase.storage.from("attendance-photos").remove([path]);
      } catch {
        /* ignore */
      }
    }
    await supabase
      .from("tasks")
      .update({ attachments: updated, updated_at: new Date().toISOString() })
      .eq("id", task.id);
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

  const primaryLabel = labels[0] || task.color;
  const currentColor = CARD_COLORS.find((c) => c.key === primaryLabel) || CARD_COLORS[0];

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

          {/* Labels (multi-select) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Tag size={12} /> Label ({labels.length})
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((c) => {
                const active = labels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleLabel(c.key)}
                    className={`h-9 px-3 rounded-lg ${c.dot} text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                      active ? "ring-2 ring-offset-2 ring-gray-800 scale-105" : "opacity-60 hover:opacity-100"
                    }`}
                    title={c.label}
                  >
                    {active && <Check size={12} />}
                    {c.label}
                  </button>
                );
              })}
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

          {/* Checklist (Trello-style) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <ListChecks size={12} /> Checklist
              {checklist.length > 0 && (
                <span className="ml-auto text-[10px] text-gray-500 normal-case tracking-normal">
                  {checklist.filter((i) => i.done).length} / {checklist.length} selesai
                </span>
              )}
            </label>

            {/* Progress bar */}
            {checklist.length > 0 && (() => {
              const done = checklist.filter((i) => i.done).length;
              const pct = Math.round((done / checklist.length) * 100);
              return (
                <div className="mb-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        pct === 100 ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">{pct}%</p>
                </div>
              );
            })()}

            {/* Items */}
            {checklist.length > 0 && (
              <div className="space-y-1 mb-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 p-2 rounded-lg group transition ${
                      item.done ? "bg-emerald-50/60" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <button
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                        item.done
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-gray-300 hover:border-primary"
                      }`}
                    >
                      {item.done ? (
                        <Check size={12} className="text-white" strokeWidth={3} />
                      ) : (
                        <Square size={12} className="text-transparent" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        item.done ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeChecklistItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center"
                      title="Hapus"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new item */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Tambah item checklist & Enter..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              />
              <button
                onClick={addChecklistItem}
                disabled={!newChecklistText.trim()}
                className="px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Paperclip size={12} /> Attachment ({attachments.length})
            </label>

            {/* Existing attachments */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map((a) =>
                  a.type === "image" ? (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl group"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 rounded-md overflow-hidden bg-white border border-gray-200 shrink-0 hover:opacity-80"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name || ""} className="w-full h-full object-cover" />
                      </a>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{a.name || "Gambar"}</p>
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(a.added_at), "dd MMM • HH:mm", { locale: idLocale })}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAttachment(a.id)}
                        className="w-7 h-7 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center"
                        title="Hapus"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-xl group"
                    >
                      <div className="w-10 h-10 rounded-md bg-white border border-blue-200 flex items-center justify-center shrink-0">
                        <LinkIcon size={16} className="text-blue-600" />
                      </div>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 hover:underline"
                      >
                        <p className="text-xs font-medium text-blue-700 truncate inline-flex items-center gap-1">
                          {a.name || a.url}
                          <ExternalLink size={10} className="shrink-0" />
                        </p>
                        <p className="text-[10px] text-blue-500/80 truncate">{a.url}</p>
                      </a>
                      <button
                        onClick={() => removeAttachment(a.id)}
                        className="w-7 h-7 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center"
                        title="Hapus"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Add buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Upload size={14} className="animate-pulse" /> Upload...
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} /> Tambah Gambar
                  </>
                )}
              </button>
              <button
                onClick={() => setShowLinkForm(!showLinkForm)}
                className={`px-3 py-2.5 border rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 transition ${
                  showLinkForm
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
                }`}
              >
                <LinkIcon size={14} /> Tambah Link
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
              }}
            />

            {/* Link form */}
            {showLinkForm && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Nama (opsional)"
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowLinkForm(false);
                      setLinkUrl("");
                      setLinkName("");
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={addLink}
                    disabled={!linkUrl.trim()}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            )}
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
