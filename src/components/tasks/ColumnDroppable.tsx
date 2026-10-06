"use client";

import { useDroppable } from "@dnd-kit/core";

export default function ColumnDroppable({
  colKey,
  children,
  isOver,
}: {
  colKey: string;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${colKey}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto px-3 py-3 space-y-2.5 transition-all ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {children}
    </div>
  );
}
