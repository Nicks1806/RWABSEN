"use client";

import type { ReactNode } from "react";

export default function AdminStatCard({
  icon,
  label,
  value,
  liveBadge,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  gradient?: string;
  bg?: string;
  textColor?: string;
  liveBadge?: string;
}) {
  return (
    <div className="rw-stat group relative hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="flex items-start justify-between mb-2.5">
        <div
          className="w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--wine)",
            color: "var(--on-wine)",
          }}
        >
          {icon}
        </div>
        {liveBadge && (
          <span className="rw-badge--success inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5">
            <span
              className="w-1.5 h-1.5 animate-pulse"
              style={{ borderRadius: "var(--radius-full)", background: "var(--success)" }}
            />
            {liveBadge}
          </span>
        )}
      </div>
      <p className="rw-micro mb-0.5">{label}</p>
      <p className="rw-stat__value leading-none tabular-nums">{value}</p>
    </div>
  );
}
