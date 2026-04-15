import { Employee } from "./types";

/**
 * Task Board access: Admin, Founder, GM/General Manager, Personal Assistant.
 */
export function canAccessTasks(emp: Employee | null | undefined): boolean {
  if (!emp) return false;
  if (emp.role === "admin") return true;
  const pos = (emp.position || "").toLowerCase();
  return (
    pos.includes("founder") ||
    pos.includes("gm") ||
    pos.includes("general manager") ||
    pos.includes("personal assistant")
  );
}
