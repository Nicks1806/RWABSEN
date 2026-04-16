"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Employee, Task, TaskAttachment, TaskLabel, ChecklistItem, TaskComment } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  X, CheckCircle2, Trash2, User as UserIcon, Calendar as CalendarIcon,
  AlignLeft, Check, Image as ImageIcon, Link as LinkIcon, Paperclip,
  Upload, ExternalLink, ListChecks, Plus, Tag, Square, MessageSquare,
  Send, CreditCard,
} from "lucide-react";
import Avatar from "@/components/Avatar";

const CARD_COLORS: { key: Task["color"]; dot: string; label: string }[] = [
  { key: "red", dot: "bg-rose-500", label: "Merah" },
  { key: "yellow", dot: "bg-amber-400", label: "Kuning" },
  { key: "green", dot: "bg-emerald-500", label: "Hijau" },
  { key: "blue", dot: "bg-blue-500", label: "Biru" },
  { key: "purple", dot: "bg-purple-500", label: "Ungu" },
  { key: "gray", dot: "bg-gray-400", label: "Abu" },
];

interface Props {
  task: Task;
  currentUser: Employee;
  employees: Employee[];
  onClose: () => void;
}

export default function TaskDetailModal({ task, currentUser, employees, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [editingDesc, setEditingDesc] = useState(false);
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
  const [comments, setComments] = useState<TaskComment[]>(task.comments || []);
  const [newCommentText, setNewCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
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
    setComments(task.comments || []);
  }, [task]);

  // ===== Persistence helpers =====
  async function saveAll() {
    if (!title.trim()) { alert("Judul wajib diisi"); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks").update({
      title: title.trim(), description: description.trim() || null,
      color: labels[0] || "gray", labels, assignees: assigneeIds,
      assignee_id: assigneeIds[0] || null, due_date: dueDate || null,
      attachments, checklist, comments, updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    setSaving(false);
    if (error) { alert("Gagal: " + error.message); return; }
    onClose();
  }
  async function quickUpdate(patch: Record<string, unknown>) {
    await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", task.id);
  }
  async function deleteTask() {
    if (!confirm("Hapus task ini?")) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    onClose();
  }
  function toggleAssignee(id: string) { setAssigneeIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }
  function toggleLabel(l: TaskLabel) { setLabels((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]); }

  // Checklist
  async function persistChecklist(u: ChecklistItem[]) { setChecklist(u); await quickUpdate({ checklist: u }); }
  async function addChecklistItem() {
    if (!newChecklistText.trim()) return;
    setNewChecklistText("");
    await persistChecklist([...checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }]);
  }
  async function toggleChecklistItem(id: string) { await persistChecklist(checklist.map((i) => i.id === id ? { ...i, done: !i.done } : i)); }
  async function removeChecklistItem(id: string) { await persistChecklist(checklist.filter((i) => i.id !== id)); }

  // Comments
  async function addComment() {
    if (!newCommentText.trim()) return;
    const c: TaskComment = { id: crypto.randomUUID(), text: newCommentText.trim(), by: currentUser.id, byName: currentUser.name, at: new Date().toISOString() };
    const u = [c, ...comments]; setComments(u); setNewCommentText(""); await quickUpdate({ comments: u });
  }
  async function deleteComment(id: string) { const u = comments.filter((c) => c.id !== id); setComments(u); await quickUpdate({ comments: u }); }

  // Attachments
  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { alert("Hanya file gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Max 5 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `tasks/${task.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attendance-photos").upload(filename, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
      const a: TaskAttachment = { id: crypto.randomUUID(), type: "image", url: data.publicUrl, name: file.name, added_at: new Date().toISOString() };
      const u = [...attachments, a]; setAttachments(u); await quickUpdate({ attachments: u });
    } catch (e) { alert("Upload gagal: " + (e instanceof Error ? e.message : e)); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }
  async function addLink() {
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const a: TaskAttachment = { id: crypto.randomUUID(), type: "link", url, name: linkName.trim() || url.replace(/^https?:\/\//, "").split("/")[0], added_at: new Date().toISOString() };
    const u = [...attachments, a]; setAttachments(u); setLinkUrl(""); setLinkName(""); setShowLinkForm(false); await quickUpdate({ attachments: u });
  }
  async function removeAttachment(id: string) {
    if (!confirm("Hapus?")) return;
    const u = attachments.filter((a) => a.id !== id); setAttachments(u); await quickUpdate({ attachments: u });
  }

  const coverUrl = task.cover_url || attachments.find((a) => a.type === "image")?.url;
  const clDone = checklist.filter((i) => i.done).length;
  const clPct = checklist.length > 0 ? Math.round((clDone / checklist.length) * 100) : 0;
  const primaryColor = CARD_COLORS.find((c) => c.key === (labels[0] || task.color)) || CARD_COLORS[0];
  const selectedEmps = employees.filter((e) => assigneeIds.includes(e.id));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto pt-8 md:pt-16 pb-8 px-2" onClick={onClose}>
      <div className="bg-gray-100 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>

        {/* Cover image */}
        {coverUrl ? (
          <div className="relative h-36 md:h-48 bg-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        ) : (
          <div className={`h-2 ${primaryColor.dot}`} />
        )}

        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center z-10">
          <X size={16} />
        </button>

        {/* Title */}
        <div className="px-5 md:px-8 pt-4 pb-2 flex items-start gap-3">
          <CreditCard size={20} className="text-gray-500 mt-0.5 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-lg font-bold text-gray-900 bg-transparent outline-none border-b-2 border-transparent focus:border-primary transition px-1 py-0.5"
          />
        </div>

        {/* Info chips row (Trello-style) */}
        <div className="px-5 md:px-8 pb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
          {/* Members */}
          {selectedEmps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Members</p>
              <div className="flex -space-x-1.5">
                {selectedEmps.slice(0, 5).map((e) => (
                  <div key={e.id} className="ring-2 ring-gray-100 rounded-full" title={e.name}>
                    <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                  </div>
                ))}
                {selectedEmps.length > 5 && <span className="w-7 h-7 rounded-full bg-gray-300 ring-2 ring-gray-100 flex items-center justify-center text-[9px] font-bold">+{selectedEmps.length - 5}</span>}
              </div>
            </div>
          )}
          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Labels</p>
              <div className="flex gap-1">
                {labels.map((l) => { const lc = CARD_COLORS.find((c) => c.key === l) || CARD_COLORS[0]; return <span key={l} className={`h-6 w-12 rounded-md ${lc.dot}`} title={lc.label} />; })}
              </div>
            </div>
          )}
          {/* Due date */}
          {dueDate && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Due date</p>
              <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs font-medium">
                <CalendarIcon size={12} /> {format(new Date(dueDate), "dd MMM yyyy", { locale: idLocale })}
              </span>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-0 md:gap-4 px-5 md:px-8 pb-5">

          {/* ====== LEFT: Main content ====== */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* Description */}
            <section>
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <AlignLeft size={16} /> Deskripsi
              </h4>
              {editingDesc ? (
                <div>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 bg-primary text-white text-xs rounded-md font-semibold">Simpan</button>
                    <button onClick={() => { setDescription(task.description || ""); setEditingDesc(false); }} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-md">Batal</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingDesc(true)} className="min-h-[60px] bg-white rounded-lg p-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 border border-gray-200 transition whitespace-pre-wrap">
                  {description || <span className="text-gray-400 italic">Tambahkan deskripsi yang lebih detail...</span>}
                </div>
              )}
            </section>

            {/* Checklist */}
            <section>
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} /> Checklist
                {checklist.length > 0 && <span className="text-[10px] text-gray-500 font-normal ml-auto">{clDone}/{checklist.length}</span>}
              </h4>
              {checklist.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-6 text-right">{clPct}%</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 rounded-full ${clPct === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${clPct}%` }} />
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-0.5 mb-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 py-1.5 px-1 rounded group hover:bg-white transition">
                    <button onClick={() => toggleChecklistItem(item.id)}
                      className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${item.done ? "bg-primary border-primary" : "bg-white border-gray-300"}`}>
                      {item.done && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? "text-gray-400 line-through" : "text-gray-700"}`}>{item.text}</span>
                    <button onClick={() => removeChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="text" value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder="Tambah item..."
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={addChecklistItem} disabled={!newChecklistText.trim()} className="px-2.5 py-1.5 bg-primary text-white rounded-md text-xs font-semibold disabled:opacity-40"><Plus size={14} /></button>
              </div>
            </section>

            {/* Attachments */}
            <section>
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <Paperclip size={16} /> Attachment
              </h4>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-200 group hover:shadow-sm transition">
                      {a.type === "image" ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="w-20 h-14 rounded-md overflow-hidden bg-gray-100 shrink-0 hover:opacity-80">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <div className="w-20 h-14 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                          <LinkIcon size={20} className="text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-800 hover:underline truncate block">
                          {a.name || (a.type === "image" ? "Gambar" : a.url)} <ExternalLink size={10} className="inline" />
                        </a>
                        <p className="text-[10px] text-gray-400">{format(new Date(a.added_at), "dd MMM yyyy • HH:mm", { locale: idLocale })}</p>
                      </div>
                      <button onClick={() => removeAttachment(a.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-1"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              {showLinkForm && (
                <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2 mb-3">
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary" autoFocus />
                  <input type="text" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nama (opsional)" className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2">
                    <button onClick={addLink} disabled={!linkUrl.trim()} className="px-3 py-1.5 bg-primary text-white text-xs rounded-md font-semibold disabled:opacity-40">Tambah</button>
                    <button onClick={() => { setShowLinkForm(false); setLinkUrl(""); setLinkName(""); }} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">Batal</button>
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            </section>

            {/* Activity / Comments */}
            <section>
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <MessageSquare size={16} /> Komentar & Activity
              </h4>
              <div className="flex gap-2 mb-4">
                <Avatar name={currentUser.name} photoUrl={currentUser.photo_url} size="sm" />
                <div className="flex-1 flex gap-1.5">
                  <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }}
                    placeholder="Tulis komentar..."
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button onClick={addComment} disabled={!newCommentText.trim()} className="px-2.5 py-2 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0"><Send size={14} /></button>
                </div>
              </div>
              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((c) => {
                    const emp = employees.find((e) => e.id === c.by);
                    return (
                      <div key={c.id} className="flex gap-2 group">
                        <Avatar name={emp?.name || c.byName || "?"} photoUrl={emp?.photo_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800">{emp?.name || c.byName}</span>
                            <span className="text-[10px] text-gray-400">{format(new Date(c.at), "dd MMM HH:mm", { locale: idLocale })}</span>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 mt-1 border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap break-words">{c.text}</div>
                        </div>
                        {c.by === currentUser.id && (
                          <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition mt-1"><X size={12} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ====== RIGHT: Sidebar ====== */}
          <div className="w-full md:w-44 shrink-0 pt-5 md:pt-0 space-y-1.5 border-t md:border-t-0 md:border-l border-gray-200 md:pl-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tambah ke card</p>

            <SidebarBtn icon={<UserIcon size={14} />} label="Members" onClick={() => setShowMembers(!showMembers)} />
            {showMembers && (
              <div className="bg-white rounded-lg border border-gray-200 p-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                {employees.filter((e) => e.is_active).map((e) => {
                  const sel = assigneeIds.includes(e.id);
                  return (
                    <button key={e.id} onClick={() => toggleAssignee(e.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition ${sel ? "bg-primary/10 font-semibold" : "hover:bg-gray-50"}`}>
                      <Avatar name={e.name} photoUrl={e.photo_url} size="xs" />
                      <span className="flex-1 text-left truncate">{e.name}</span>
                      {sel && <Check size={12} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}

            <SidebarBtn icon={<Tag size={14} />} label="Labels" onClick={() => setShowLabels(!showLabels)} />
            {showLabels && (
              <div className="bg-white rounded-lg border border-gray-200 p-2 space-y-1">
                {CARD_COLORS.map((c) => {
                  const sel = labels.includes(c.key);
                  return (
                    <button key={c.key} onClick={() => toggleLabel(c.key)} className={`w-full h-7 rounded ${c.dot} flex items-center justify-between px-2 transition ${sel ? "ring-2 ring-offset-1 ring-gray-800" : "opacity-60 hover:opacity-100"}`}>
                      <span className="text-white text-[10px] font-bold">{c.label}</span>
                      {sel && <Check size={12} className="text-white" />}
                    </button>
                  );
                })}
              </div>
            )}

            <SidebarBtn icon={<ListChecks size={14} />} label="Checklist" onClick={() => document.getElementById("cl-input")?.focus()} />

            <SidebarBtn icon={<CalendarIcon size={14} />} label="Deadline" onClick={() => {
              const el = document.getElementById("due-input") as HTMLInputElement | null;
              if (el) el.showPicker?.();
            }} />
            <input id="due-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sr-only" />

            <SidebarBtn icon={<ImageIcon size={14} />} label={uploading ? "Uploading..." : "Gambar"} onClick={() => fileInputRef.current?.click()} />
            <SidebarBtn icon={<LinkIcon size={14} />} label="Link" onClick={() => setShowLinkForm(!showLinkForm)} />

            <div className="pt-3 mt-3 border-t border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Aksi</p>
              <SidebarBtn icon={<Trash2 size={14} />} label="Hapus" onClick={deleteTask} danger />
            </div>

            {/* Save button */}
            <button onClick={saveAll} disabled={saving}
              className="w-full mt-3 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"}`}>
      {icon} {label}
    </button>
  );
}
