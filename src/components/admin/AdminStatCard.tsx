"use client";

import type { ReactNode } from "react";

export default function AdminStatCard({
  icon,
  label,
  value,
  gradient,
  bg,
  textColor,
  liveBadge,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  gradient: string;
  bg: string;
  textColor: string;
  liveBadge?: string;
}) {
  return (
    <div className={`group relative bg-gradient-to-br ${bg} rounded-2xl p-4 border border-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {liveBadge && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {liveBadge}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
      <p className={`text-2xl md:text-3xl font-extrabold tabular-nums ${textColor} leading-none`}>{value}</p>
    </div>
  );
}
