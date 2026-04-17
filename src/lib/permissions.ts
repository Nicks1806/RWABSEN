import { Employee, Board } from "./types";

/**
 * Task Board page access: All employees can access the page.
 * Per-board access is controlled via Board.allowed_roles.
 */
export function canAccessTasks(emp: Employee | null | undefined): boolean {
  return !!emp; // any logged-in employee can access /tasks page
}

/**
 * Check if an employee can see/access a specific board.
 * - allowed_roles = null/empty → everyone can access
 * - allowed_roles has values → check if emp.position or emp.role matches
 * - Admin always has access to all boards
 */
export function canAccessBoard(emp: Employee | null | undefined, board: Board): boolean {
  if (!emp) return false;
  if (emp.role === "admin") return true; // admin always sees all
  if (!board.allowed_roles || board.allowed_roles.length === 0) return true; // public board

  const pos = (emp.position || "").toLowerCase();
  return board.allowed_roles.some((role) => {
    const r = role.toLowerCase();
    return pos.includes(r) || r.includes(pos);
  });
}

/**
 * Only Founder, CEO/Direktur, GM can manage boards (create/edit roles/delete).
 * Admin (role field) always can.
 */
export function canManageBoards(emp: Employee | null | undefined): boolean {
  if (!emp) return false;
  if (emp.role === "admin") return true;
  const pos = (emp.position || "").toLowerCase();
  return (
    pos.includes("founder") ||
    pos.includes("ceo") ||
    pos.includes("direktur") ||
    pos.includes("gm") ||
    pos.includes("general manager")
  );
}
