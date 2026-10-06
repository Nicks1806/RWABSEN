"use client";

import type { Task } from "@/lib/types";
import { CARD_COLORS } from "@/lib/boardConfig";

export default function CardOverlay({ task }: { task: Task }) {
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
