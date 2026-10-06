"use client";

import type { Task } from "@/lib/types";
import { CARD_COLORS } from "@/lib/boardConfig";

export default function CardOverlay({ task }: { task: Task }) {
  const cardColor = CARD_COLORS.find((c) => c.key === task.color) || CARD_COLORS[0];
  return (
    <div
      className={`rounded-xl border-l-4 ${cardColor.border} overflow-hidden w-72 rotate-3 cursor-grabbing`}
      style={{
        background: "var(--surface-200)",
        boxShadow: "var(--shadow-float)",
        border: "2px solid var(--wine)",
      }}
    >
      <div className="px-3.5 pt-3 pb-2">
        <p className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: "var(--ink)" }}>{task.title}</p>
        {task.description && (
          <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--ink-muted)" }}>{task.description}</p>
        )}
      </div>
    </div>
  );
}
