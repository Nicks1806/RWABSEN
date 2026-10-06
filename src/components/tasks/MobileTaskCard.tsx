"use client";

import { useState } from "react";
import type { Task, BoardColumn } from "@/lib/types";
import { format, isPast, isToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Paperclip, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { CARD_COLORS, COL_COLORS, type ColColor } from "@/lib/boardConfig";

export default function MobileTaskCard({ task, columns, onClick, onMove, onRename }: {
  task: Task; columns: BoardColumn[]; onClick: () => void; onMove: (colKey: string) => void; onRename: (t: string) => void;
}) {
  void onRename;
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
      className="overflow-visible relative"
      style={{
        background: "var(--surface-200)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full h-32 object-cover" style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }} onClick={onClick} />
      )}

      <div onClick={onClick} className="px-4 pt-2 pb-2.5">
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
            className="w-full font-bold text-base bg-transparent outline-none"
            style={{ color: "var(--ink)", borderBottom: "2px solid var(--wine)" }}
            autoFocus
          />
        ) : (
          <p className="font-bold text-base leading-snug" style={{ color: "var(--ink)" }} onDoubleClick={(e) => { e.stopPropagation(); setTitleDraft(task.title); setEditTitle(true); }}>{task.title}</p>
        )}
        {task.description && <p className="text-sm mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--ink-muted)" }}>{task.description}</p>}
      </div>

      {(task.due_date || clTotal > 0 || commentCount > 0 || attachCount > 0) && (
        <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap" onClick={onClick}>
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 font-semibold ${
              isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                ? ""
                : isToday(new Date(task.due_date))
                ? ""
                : ""
            }`}
            style={{
              borderRadius: "var(--radius-sm)",
              ...(isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                ? { background: "var(--danger-tint)", color: "var(--danger)", border: "1px solid var(--danger-tint)" }
                : isToday(new Date(task.due_date))
                ? { background: "var(--warning-tint)", color: "var(--warning)", border: "1px solid var(--warning-tint)" }
                : { background: "var(--surface-300)", color: "var(--ink-muted)", border: "1px solid var(--line)" }),
            }}
            >
              <CalendarIcon size={11} />
              {format(new Date(task.due_date), "dd MMM", { locale: idLocale })}
            </span>
          )}
          {clTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 font-semibold"
              style={{
                borderRadius: "var(--radius-sm)",
                ...(clDone === clTotal
                  ? { background: "var(--success-tint)", color: "var(--success)", border: "1px solid var(--success-tint)" }
                  : { background: "var(--surface-300)", color: "var(--ink-muted)", border: "1px solid var(--line)" }),
              }}
            >
              <CheckCircle2 size={11} /> {clDone}/{clTotal}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 font-semibold"
              style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-300)", color: "var(--ink-muted)", border: "1px solid var(--line)" }}
            >
              💬 {commentCount}
            </span>
          )}
          {attachCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 font-semibold"
              style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-300)", color: "var(--ink-muted)", border: "1px solid var(--line)" }}
            >
              <Paperclip size={11} /> {attachCount}
            </span>
          )}
        </div>
      )}

      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 min-w-0" onClick={onClick}>
          {task.assigneeObjects && task.assigneeObjects.length > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {task.assigneeObjects.slice(0, 4).map((emp) => (
                  <div key={emp.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--surface-200)" }}>
                    <Avatar name={emp.name} photoUrl={emp.photo_url} size="xs" />
                  </div>
                ))}
              </div>
              {task.assigneeObjects.length <= 2 && (
                <span className="text-xs font-medium truncate" style={{ color: "var(--ink-muted)" }}>
                  {task.assigneeObjects.map((e) => e.name.split(" ")[0]).join(", ")}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs italic" style={{ color: "var(--ink-muted)" }}>Belum di-assign</span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition text-sm"
          style={showActions
            ? { background: "var(--ink)", color: "var(--surface-100)" }
            : { background: "var(--surface-300)", color: "var(--ink-muted)" }
          }
        >
          ···
        </button>
      </div>

      {showActions && (
        <>
          <div className="rw-overlay fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowActions(false); }} />
          <div className="rw-sheet fixed bottom-0 left-0 right-0 z-50 animate-slide-up safe-bottom">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "var(--line-strong)" }} /></div>

            <div className="px-5 pt-2 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className={`w-1.5 h-10 rounded-full ${cardColor.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: "var(--ink)" }}>{task.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
                  {task.assigneeObjects?.map((e) => e.name.split(" ")[0]).join(", ") || "Belum di-assign"}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowActions(false); }} className="ico-circ" style={{ background: "var(--surface-300)", color: "var(--ink-muted)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="rw-micro mb-2">Pindah ke kolom</p>
                <div className="space-y-1.5">
                  {columns.filter((c) => c.key !== task.status).map((c) => {
                    const topColor = COL_COLORS[c.color as ColColor] || "bg-gray-400";
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); onMove(c.key); setShowActions(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium active:scale-[0.98] transition"
                        style={{ background: "var(--surface-300)", color: "var(--ink)", borderRadius: "var(--radius-lg)" }}
                      >
                        <span className={`w-4 h-4 rounded-lg ${topColor} shadow-sm`} />
                        <span className="flex-1 text-left">{c.label}</span>
                        <span style={{ color: "var(--ink-muted)" }} className="text-xs">&rarr;</span>
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
