import type { Task, BoardColumn } from "@/lib/types";

export const COL_COLORS = {
  rose: "bg-rose-500",
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  slate: "bg-slate-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
} as const;
export type ColColor = keyof typeof COL_COLORS;
export const COL_COLOR_KEYS: ColColor[] = ["rose", "amber", "emerald", "blue", "purple", "slate", "pink", "indigo", "teal"];

export const COL_BG: Record<ColColor, string> = {
  rose: "bg-gradient-to-b from-rose-50 to-white border-rose-200/40",
  amber: "bg-gradient-to-b from-amber-50 to-white border-amber-200/40",
  emerald: "bg-gradient-to-b from-emerald-50 to-white border-emerald-200/40",
  blue: "bg-gradient-to-b from-blue-50 to-white border-blue-200/40",
  purple: "bg-gradient-to-b from-purple-50 to-white border-purple-200/40",
  slate: "bg-gradient-to-b from-slate-50 to-white border-slate-200/40",
  pink: "bg-gradient-to-b from-pink-50 to-white border-pink-200/40",
  indigo: "bg-gradient-to-b from-indigo-50 to-white border-indigo-200/40",
  teal: "bg-gradient-to-b from-teal-50 to-white border-teal-200/40",
};

export const COL_HEADER_BORDER: Record<ColColor, string> = {
  rose: "border-rose-100/60",
  amber: "border-amber-100/60",
  emerald: "border-emerald-100/60",
  blue: "border-blue-100/60",
  purple: "border-purple-100/60",
  slate: "border-slate-100/60",
  pink: "border-pink-100/60",
  indigo: "border-indigo-100/60",
  teal: "border-teal-100/60",
};

export function getColumnMeta(key: string): { icon: "Inbox" | "Clock" | "CheckCircle2" | "Archive" | "Columns3"; emptyTitle: string; emptySub: string; emptyIcon: "Inbox" | "Coffee" | "CheckCircle2" | "Archive" } {
  const k = key.toLowerCase();
  if (k === "brief") return { icon: "Inbox", emptyTitle: "Brief kosong", emptySub: "Tambah task baru untuk dimulai", emptyIcon: "Inbox" };
  if (k === "today") return { icon: "Clock", emptyTitle: "Santai dulu ✨", emptySub: "Tidak ada task hari ini", emptyIcon: "Coffee" };
  if (k === "done") return { icon: "CheckCircle2", emptyTitle: "Belum ada yang selesai", emptySub: "Selesaikan task untuk mulai streak", emptyIcon: "CheckCircle2" };
  if (k === "history") return { icon: "Archive", emptyTitle: "Arsip kosong", emptySub: "Task archived muncul di sini", emptyIcon: "Archive" };
  return { icon: "Columns3", emptyTitle: "Kolom kosong", emptySub: "Tambah task pertama di sini", emptyIcon: "Inbox" };
}

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: "default-brief", key: "brief", label: "Brief", description: "Belum dikerjakan", color: "rose", position: 0, is_default: true },
  { id: "default-today", key: "today", label: "Today", description: "Hari ini", color: "amber", position: 1, is_default: true },
  { id: "default-done", key: "done", label: "Done", description: "Selesai", color: "emerald", position: 2, is_default: true },
  { id: "default-history", key: "history", label: "History", description: "Arsip", color: "slate", position: 3, is_default: true },
];

export const CARD_COLORS: { key: Task["color"]; dot: string; border: string; pillBg: string; pillText: string }[] = [
  { key: "red", dot: "bg-rose-500", border: "border-l-rose-500", pillBg: "bg-rose-100", pillText: "text-rose-700" },
  { key: "yellow", dot: "bg-amber-400", border: "border-l-amber-400", pillBg: "bg-amber-100", pillText: "text-amber-700" },
  { key: "green", dot: "bg-emerald-500", border: "border-l-emerald-500", pillBg: "bg-emerald-100", pillText: "text-emerald-700" },
  { key: "blue", dot: "bg-blue-500", border: "border-l-blue-500", pillBg: "bg-blue-100", pillText: "text-blue-700" },
  { key: "purple", dot: "bg-purple-500", border: "border-l-purple-500", pillBg: "bg-purple-100", pillText: "text-purple-700" },
  { key: "gray", dot: "bg-gray-400", border: "border-l-gray-400", pillBg: "bg-gray-100", pillText: "text-gray-700" },
];

export const BOARD_COLORS = ["bg-primary", "bg-blue-600", "bg-emerald-600", "bg-amber-500", "bg-purple-600", "bg-pink-600", "bg-indigo-600", "bg-teal-600", "bg-slate-700"];
