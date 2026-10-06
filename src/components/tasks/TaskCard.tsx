"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { format, isPast, isToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Paperclip } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Avatar from "@/components/Avatar";
import { CARD_COLORS } from "@/lib/boardConfig";

export default function TaskCard({ task, onClick, onRename }: { task: Task; onClick: () => void; onRename: (newTitle: string) => void }) {
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
  const coverUrl =
    task.cover_url ||
    task.attachments?.find((a) => a.type === "image")?.url ||
    null;
  const labelSet = new Set<string>(task.labels || []);
  if (task.color) labelSet.add(task.color);
  const labels: string[] = Array.from(labelSet);
  const checklist = task.checklist || [];
  const doneCount = checklist.filter((i) => i.done).length;
  const totalCount = checklist.length;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isDragging ? 0.4 : 1,
        background: "var(--surface-200)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
      }}
      className={`group hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden touch-none ${isDragging ? "z-50 shadow-xl" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="w-full h-28 object-cover"
            style={{ background: "var(--surface-300)" }}
            draggable={false}
          />
        )}
        {labels.length > 0 && (
          <div className="px-3.5 pt-2.5 pb-1 flex gap-1 flex-wrap">
            {labels.slice(0, 3).map((l) => {
              const lc = CARD_COLORS.find((c) => c.key === l) || CARD_COLORS[0];
              return (
                <span
                  key={l}
                  className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider ${lc.pillBg || "bg-gray-100"} ${lc.pillText || "text-gray-700"} px-1.5 py-0.5 rounded`}
                  title={l}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${lc.dot}`} />
                  {l}
                </span>
              );
            })}
            {labels.length > 3 && (
              <span className="text-[9px] font-bold px-1 py-0.5" style={{ color: "var(--ink-muted)" }}>+{labels.length - 3}</span>
            )}
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
              className="w-full font-semibold text-sm bg-transparent outline-none px-0.5 py-0.5"
              style={{ color: "var(--ink)", borderBottom: "2px solid var(--wine)" }}
              autoFocus
            />
          ) : (
            <p
              className="font-semibold text-sm leading-snug line-clamp-2"
              style={{ color: "var(--ink)" }}
              onDoubleClick={(e) => { e.stopPropagation(); setDraft(task.title); setEditing(true); }}
            >
              {task.title}
            </p>
          )}
          {task.description && (
            <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--ink-muted)" }}>{task.description}</p>
          )}
        </div>

        <div className="px-3.5 pb-2 flex items-center gap-1.5 flex-wrap">
          {totalCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold ${
                doneCount === totalCount
                  ? "bg-emerald-500 text-white"
                  : ""
              }`}
              style={doneCount !== totalCount ? { background: "var(--surface-300)", color: "var(--ink-muted)" } : undefined}
            >
              <CheckCircle2 size={11} />
              {doneCount}/{totalCount}
            </span>
          )}
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold ${
                overdue
                  ? "bg-red-500 text-white"
                  : todayDue
                  ? "bg-amber-400 text-white"
                  : doneCount === totalCount && totalCount > 0
                  ? "bg-emerald-500 text-white"
                  : ""
              }`}
              style={!overdue && !todayDue && !(doneCount === totalCount && totalCount > 0) ? { background: "var(--surface-300)", color: "var(--ink-muted)" } : undefined}
            >
              <CalendarIcon size={11} />
              {format(new Date(task.due_date), "MMM dd", { locale: idLocale })}
            </span>
          )}
          {attachCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold"
              style={{ background: "var(--surface-300)", color: "var(--ink-muted)" }}
            >
              <Paperclip size={11} /> {attachCount}
            </span>
          )}
          {(task.comments?.length || 0) > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold"
              style={{ background: "var(--surface-300)", color: "var(--ink-muted)" }}
            >
              💬 {task.comments!.length}
            </span>
          )}
        </div>

        <div className="px-3.5 py-2 flex items-center justify-end gap-1.5">
          {task.assigneeObjects && task.assigneeObjects.length > 0 ? (
            <div className="flex -space-x-1.5 ml-auto">
              {task.assigneeObjects.slice(0, 4).map((emp) => (
                <div key={emp.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--surface-200)" }} title={emp.name}>
                  <Avatar name={emp.name} photoUrl={emp.photo_url} size="xs" />
                </div>
              ))}
              {task.assigneeObjects.length > 4 && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: "var(--surface-300)", color: "var(--ink-muted)", boxShadow: "0 0 0 2px var(--surface-200)" }}
                >
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
