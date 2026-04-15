// Predefined position/job titles for RedWine
// Used in admin profile edit dropdown + display in Role column

export const POSITIONS = [
  "Founder",
  "CEO / Direktur",
  "GM / General Manager",
  "Personal Assistant",
  "Customer Service",
  "Sales Senior",
  "Sales Junior",
  "Karyawan",
] as const;

export type Position = typeof POSITIONS[number];

// Color coding by position type
export function getPositionColor(position?: string | null): string {
  if (!position) return "bg-gray-100 text-gray-600";
  const p = position.toLowerCase();
  if (p.includes("founder")) return "bg-purple-100 text-purple-700";
  if (p.includes("ceo") || p.includes("direktur")) return "bg-indigo-100 text-indigo-700";
  if (p.includes("gm") || p.includes("manager")) return "bg-blue-100 text-blue-700";
  if (p.includes("personal assistant")) return "bg-cyan-100 text-cyan-700";
  if (p.includes("customer service")) return "bg-pink-100 text-pink-700";
  if (p.includes("sales senior")) return "bg-amber-100 text-amber-700";
  if (p.includes("sales")) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}
