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
import { useToast } from "@/components/Toast";

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
  const { toast } = useToast();
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
    // Depend on task.id only: realtime refetches rebuild the task object,
    // and resetting here would wipe edits the user is still typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // ===== Persistence helpers =====
  async function saveAll() {
    if (!title.trim()) { toast("Judul wajib diisi", "warning"); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks").update({
      title: title.trim(), description: description.trim() || null,
      color: labels[0] || "gray", labels, assignees: assigneeIds,
      assignee_id: assigneeIds[0] || null, due_date: dueDate || null,
      attachments, checklist, comments, updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    setSaving(false);
    if (error) { toast("Gagal: " + error.message, "error"); return; }
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
    if (!file.type.startsWith("image/")) { toast("Hanya file gambar", "warning"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Max 5 MB", "warning"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `tasks/${task.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attendance-photos").upload(filename, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("attendance-photos").getPublicUrl(filename);
      const a: TaskAttachment = { id: crypto.randomUUID(), type: "image", url: data.publicUrl, name: file.name, added_at: new Date().toISOString() };
      const u = [...attachments, a]; setAttachments(u); await quickUpdate({ attachments: u });
    } catch (e) { toast("Upload gagal: " + (e instanceof Error ? e.message : e), "error"); }
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
    <div className="rw-overlay fixed inset-0 z-50 flex items-end md:items-start justify-center md:overflow-y-auto md:pt-16 md:pb-8 md:px-2" onClick={onClose}>
      <div className="w-full max-w-3xl md:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up max-h-[95vh] md:max-h-none overflow-y-auto" style={{ background: "var(--surface-100)", boxShadow: "var(--shadow-modal)", borderRadius: undefined }} onClick={(e) => e.stopPropagation()}>

        {/* Cover image */}
        {coverUrl ? (
          <div className="relative h-36 md:h-48" style={{ background: "var(--surface-300)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        ) : (
          <div className={`h-2 ${primaryColor.dot}`} />
        )}

        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.4)", color: "#ffffff" }}>
          <X size={16} />
        </button>

        {/* Title */}
        <div className="px-5 md:px-8 pt-4 pb-2 flex items-start gap-3">
          <CreditCard size={20} className="mt-0.5 shrink-0" style={{ color: "var(--ink-muted)" }} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-lg font-bold bg-transparent outline-none px-1 py-0.5 transition"
            style={{ color: "var(--ink)", borderBottom: "2px solid transparent" }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--wine)"; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
          />
        </div>

        {/* Info chips row (Trello-style) */}
        <div className="px-5 md:px-8 pb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          {/* Members */}
          {selectedEmps.length > 0 && (
            <div>
              <p className="rw-micro mb-1">Members</p>
              <div className="flex -space-x-1.5">
                {selectedEmps.slice(0, 5).map((e) => (
                  <div key={e.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--surface-100)" }} title={e.name}>
                    <Avatar name={e.name} photoUrl={e.photo_url} size="sm" />
                  </div>
                ))}
                {selectedEmps.length > 5 && <span className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "var(--surface-300)", color: "var(--ink-muted)", boxShadow: "0 0 0 2px var(--surface-100)" }}>+{selectedEmps.length - 5}</span>}
              </div>
            </div>
          )}
          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <p className="rw-micro mb-1">Labels</p>
              <div className="flex gap-1">
                {labels.map((l) => { const lc = CARD_COLORS.find((c) => c.key === l) || CARD_COLORS[0]; return <span key={l} className={`h-6 w-12 rounded-md ${lc.dot}`} title={lc.label} />; })}
              </div>
            </div>
          )}
          {/* Due date */}
          {dueDate && (
            <div>
              <p className="rw-micro mb-1">Due date</p>
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium" style={{ background: "var(--surface-200)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                <CalendarIcon size={12} /> {format(new Date(dueDate), "dd MMM yyyy", { locale: idLocale })}
              </span>
            </div>
          )}
        </div>

        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-1 pb-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--line-strong)" }} />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-0 md:gap-4 px-4 md:px-8 pb-5">

          {/* ====== LEFT: Main content ====== */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* Description */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--ink)" }}>
                <AlignLeft size={16} /> Deskripsi
                {!editingDesc && description && (
                  <button onClick={() => setEditingDesc(true)} className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded transition" style={{ color: "var(--ink-muted)", background: "var(--surface-300)" }}>
                    Edit
                  </button>
                )}
              </h4>
              {editingDesc ? (
                <div>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                    className="rw-input resize-none"
                    autoFocus placeholder="Tulis deskripsi task..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setEditingDesc(false)} className="rw-btn rw-btn--primary rw-btn--sm">Simpan</button>
                    <button onClick={() => { setDescription(task.description || ""); setEditingDesc(false); }} className="rw-btn rw-btn--ghost rw-btn--sm">Batal</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingDesc(true)} className="min-h-[56px] p-3.5 text-sm cursor-pointer transition whitespace-pre-wrap leading-relaxed" style={{ background: "var(--surface-200)", borderRadius: "var(--radius-md)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                  {description || <span style={{ color: "var(--ink-muted)" }} className="italic">Tambahkan deskripsi yang lebih detail...</span>}
                </div>
              )}
            </section>

            {/* Checklist */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--ink)" }}>
                <CheckCircle2 size={16} /> Checklist
                {checklist.length > 0 && (
                  <span className="text-[11px] font-semibold ml-auto px-2 py-0.5 rounded-full" style={clPct === 100 ? { background: "var(--success-tint)", color: "var(--success)" } : { background: "var(--surface-300)", color: "var(--ink-muted)" }}>
                    {clDone}/{checklist.length}
                  </span>
                )}
              </h4>
              {checklist.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] w-8 text-right font-medium" style={{ color: "var(--ink-muted)" }}>{clPct}%</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-300)" }}>
                      <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${clPct}%`, background: clPct === 100 ? "var(--success)" : "var(--wine)" }} />
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-1 mb-3">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className="flex items-center gap-3 py-2.5 px-3 group cursor-pointer transition"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      ...(item.done
                        ? { background: "var(--success-tint)" }
                        : { background: "var(--surface-200)", border: "1px solid var(--line)" }),
                    }}
                  >
                    <div className="shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition" style={item.done ? { background: "var(--success)", borderColor: "var(--success)" } : { background: "var(--surface-200)", borderColor: "var(--line-strong)" }}>
                      {item.done && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`flex-1 text-sm ${item.done ? "line-through" : ""}`} style={{ color: item.done ? "var(--ink-muted)" : "var(--ink)" }}>{item.text}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id); }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center transition"
                      style={{ color: "var(--danger)" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input id="cl-input" type="text" value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder="Tambah item checklist..."
                  className="rw-input"
                  style={{ minHeight: 40 }}
                />
                <button onClick={addChecklistItem} disabled={!newChecklistText.trim()} className="rw-btn rw-btn--primary rw-btn--sm">
                  <Plus size={14} /> Tambah
                </button>
              </div>
            </section>

            {/* Attachments */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--ink)" }}>
                <Paperclip size={16} /> Attachment
              </h4>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 group transition" style={{ background: "var(--surface-200)", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}>
                      {a.type === "image" ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="w-20 h-14 rounded-md overflow-hidden shrink-0 hover:opacity-80" style={{ background: "var(--surface-300)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <div className="w-20 h-14 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--wine-tint)", border: "1px solid var(--line)" }}>
                          <LinkIcon size={20} style={{ color: "var(--wine)" }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block" style={{ color: "var(--ink)" }}>
                          {a.name || (a.type === "image" ? "Gambar" : a.url)} <ExternalLink size={10} className="inline" />
                        </a>
                        <p className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{format(new Date(a.added_at), "dd MMM yyyy - HH:mm", { locale: idLocale })}</p>
                      </div>
                      <button onClick={() => removeAttachment(a.id)} className="opacity-0 group-hover:opacity-100 transition p-1" style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              {showLinkForm && (
                <div className="rw-card p-3 space-y-2 mb-3">
                  <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="rw-input" style={{ minHeight: 36 }} autoFocus />
                  <input type="text" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nama (opsional)" className="rw-input" style={{ minHeight: 36 }} />
                  <div className="flex gap-2">
                    <button onClick={addLink} disabled={!linkUrl.trim()} className="rw-btn rw-btn--primary rw-btn--sm">Tambah</button>
                    <button onClick={() => { setShowLinkForm(false); setLinkUrl(""); setLinkName(""); }} className="rw-btn rw-btn--ghost rw-btn--sm">Batal</button>
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            </section>

            {/* Activity / Comments */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--ink)" }}>
                <MessageSquare size={16} /> Komentar
                {comments.length > 0 && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full" style={{ color: "var(--ink-muted)", background: "var(--surface-300)" }}>{comments.length}</span>
                )}
              </h4>
              {/* Input */}
              <div className="flex gap-2.5 mb-4">
                <Avatar name={currentUser.name} photoUrl={currentUser.photo_url} size="sm" />
                <div className="flex-1 relative">
                  <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }}
                    placeholder="Tulis komentar..."
                    className="rw-input pr-11"
                    style={{ minHeight: 40 }}
                  />
                  <button onClick={addComment} disabled={!newCommentText.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition"
                    style={{ background: "var(--wine)", color: "var(--on-wine)" }}
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
              {/* Thread */}
              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((c) => {
                    const emp = employees.find((e) => e.id === c.by);
                    const isMe = c.by === currentUser.id;
                    return (
                      <div key={c.id} className="flex gap-2.5 group">
                        <Avatar name={emp?.name || c.byName || "?"} photoUrl={emp?.photo_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>{emp?.name || c.byName}</span>
                            <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{format(new Date(c.at), "dd MMM - HH:mm", { locale: idLocale })}</span>
                            {isMe && (
                              <button onClick={() => deleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 text-[10px] transition ml-auto"
                                style={{ color: "var(--danger)" }}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                          <div className="rounded-xl rounded-tl-sm p-3 text-sm whitespace-pre-wrap break-words leading-relaxed" style={{ background: "var(--surface-200)", border: "1px solid var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" }}>
                            {c.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ====== RIGHT: Sidebar ====== */}
          <div className="w-full md:w-48 shrink-0 pt-4 md:pt-0 space-y-1 md:pl-4" style={{ borderTop: undefined }}>
            <div className="md:hidden" style={{ borderTop: "1px solid var(--line)" }} />
            <div className="hidden md:block" style={{ borderLeft: "1px solid var(--line)", position: "absolute", top: 0, bottom: 0, width: 0 }} />
            <p className="rw-micro mb-2 hidden md:block">Tambah ke card</p>

            {/* Mobile: horizontal action chips */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              <MobileChip icon={<UserIcon size={12} />} label="Members" count={assigneeIds.length} active={showMembers} onClick={() => setShowMembers(!showMembers)} />
              <MobileChip icon={<Tag size={12} />} label="Labels" count={labels.length} active={showLabels} onClick={() => setShowLabels(!showLabels)} />
              <MobileChip icon={<ListChecks size={12} />} label="Checklist" count={checklist.length} onClick={() => document.getElementById("cl-input")?.focus()} />
              <MobileChip icon={<ImageIcon size={12} />} label="Gambar" onClick={() => fileInputRef.current?.click()} />
              <MobileChip icon={<LinkIcon size={12} />} label="Link" active={showLinkForm} onClick={() => setShowLinkForm(!showLinkForm)} />
            </div>

            <div className="hidden md:block"><SidebarBtn icon={<UserIcon size={14} />} label="Members" badge={assigneeIds.length || undefined} active={showMembers} onClick={() => setShowMembers(!showMembers)} /></div>
            {showMembers && (
              <div className="rw-card p-1.5 space-y-0.5 max-h-52 overflow-y-auto mb-1">
                {employees.filter((e) => e.is_active).map((e) => {
                  const sel = assigneeIds.includes(e.id);
                  return (
                    <button key={e.id} onClick={() => toggleAssignee(e.id)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition" style={sel ? { background: "var(--wine-tint)" } : undefined}>
                      <Avatar name={e.name} photoUrl={e.photo_url} size="xs" />
                      <span className="flex-1 text-left truncate" style={{ color: sel ? "var(--ink)" : "var(--ink-muted)", fontWeight: sel ? 600 : 400 }}>{e.name}</span>
                      {sel && <CheckCircle2 size={14} style={{ color: "var(--wine)" }} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="hidden md:block"><SidebarBtn icon={<Tag size={14} />} label="Labels" badge={labels.length || undefined} active={showLabels} onClick={() => setShowLabels(!showLabels)} /></div>
            {showLabels && (
              <div className="rw-card p-2 space-y-1.5 mb-1">
                {CARD_COLORS.map((c) => {
                  const sel = labels.includes(c.key);
                  return (
                    <button key={c.key} onClick={() => toggleLabel(c.key)} className={`w-full h-8 rounded-lg ${c.dot} flex items-center justify-between px-3 transition-all ${sel ? "ring-2 ring-offset-2 ring-gray-800 scale-[1.02]" : "opacity-50 hover:opacity-90"}`}>
                      <span className="text-white text-[11px] font-bold">{c.label}</span>
                      {sel && <Check size={13} className="text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="hidden md:block"><SidebarBtn icon={<ListChecks size={14} />} label="Checklist" badge={checklist.length || undefined} onClick={() => document.getElementById("cl-input")?.focus()} /></div>

            {/* Deadline inline */}
            <div className="rw-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <CalendarIcon size={14} style={{ color: "var(--ink-muted)" }} className="shrink-0" />
                <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>Deadline</span>
              </div>
              <div className="px-3 pb-3">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rw-input"
                  style={{ minHeight: 36, fontSize: 12 }}
                />
                {dueDate && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold" style={{ background: "var(--wine-tint)", color: "var(--wine)" }}>
                      {format(new Date(dueDate), "EEEE, dd MMM yyyy", { locale: idLocale })}
                    </span>
                    <button onClick={() => setDueDate("")} className="text-[10px] font-medium transition" style={{ color: "var(--danger)" }}>Hapus</button>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden md:block"><SidebarBtn icon={<ImageIcon size={14} />} label={uploading ? "Uploading..." : "Gambar"} badge={attachments.filter((a) => a.type === "image").length || undefined} onClick={() => fileInputRef.current?.click()} /></div>
            <div className="hidden md:block"><SidebarBtn icon={<LinkIcon size={14} />} label="Link" badge={attachments.filter((a) => a.type === "link").length || undefined} active={showLinkForm} onClick={() => setShowLinkForm(!showLinkForm)} /></div>

            <div className="pt-3 mt-2" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="rw-micro mb-2">Aksi</p>
              <SidebarBtn icon={<Trash2 size={14} />} label="Hapus Task" onClick={deleteTask} danger />
            </div>

            {/* Save button */}
            <button onClick={saveAll} disabled={saving}
              className="rw-btn rw-btn--primary rw-btn--block mt-3"
            >
              <Check size={15} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ icon, label, onClick, danger, badge, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; badge?: number; active?: boolean;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition"
      style={{
        borderRadius: "var(--radius-md)",
        ...(danger
          ? { background: "var(--danger-tint)", color: "var(--danger)", border: "1px solid var(--danger-tint)" }
          : active
          ? { background: "var(--wine-tint)", color: "var(--wine)", border: "1px solid var(--wine-tint)" }
          : { background: "var(--surface-200)", color: "var(--ink)", border: "1px solid var(--line)" }),
      }}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" style={danger ? { background: "var(--danger-tint)", color: "var(--danger)" } : { background: "var(--surface-300)", color: "var(--ink-muted)" }}>{badge}</span>
      )}
    </button>
  );
}

function MobileChip({ icon, label, count, active, onClick }: {
  icon: React.ReactNode; label: string; count?: number; active?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-medium transition snap-start"
      style={active
        ? { background: "var(--wine)", color: "var(--on-wine)" }
        : { background: "var(--surface-200)", color: "var(--ink)", border: "1px solid var(--line)" }
      }
    >
      {icon} {label}
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center" style={active ? { background: "rgba(255,255,255,0.3)", color: "var(--on-wine)" } : { background: "var(--surface-300)", color: "var(--ink-muted)" }}>{count}</span>
      )}
    </button>
  );
}
