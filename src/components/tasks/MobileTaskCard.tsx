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
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative"
    >
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="w-full h-32 object-cover rounded-t-2xl" onClick={onClick} />
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
            className="w-full font-bold text-base text-gray-900 bg-white border-b-2 border-primary outline-none"
            autoFocus
          />
        ) : (
          <p className="font-bold text-base text-gray-900 leading-snug" onDoubleClick={(e) => { e.stopPropagation(); setTitleDraft(task.title); setEditTitle(true); }}>{task.title}</p>
        )}
        {task.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>}
      </div>

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

      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
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

        <button
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition text-sm ${
            showActions ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 active:bg-gray-200"
          }`}
        >
          ···
        </button>
      </div>

      {showActions && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={(e) => { e.stopPropagation(); setShowActions(false); }} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 animate-slide-up safe-bottom">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

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
