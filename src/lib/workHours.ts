import { Employee, Settings } from "./types";

export function getEffectiveWorkHours(
  employee: Pick<Employee, "work_start" | "work_end"> | null | undefined,
  settings: Pick<Settings, "work_start" | "work_end"> | null | undefined
): { start: string; end: string } {
  return {
    start: employee?.work_start || settings?.work_start || "09:30",
    end: employee?.work_end || settings?.work_end || "18:30",
  };
}
