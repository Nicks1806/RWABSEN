import { Employee, Settings, DayKey } from "./types";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Senin",
  tue: "Selasa",
  wed: "Rabu",
  thu: "Kamis",
  fri: "Jumat",
  sat: "Sabtu",
  sun: "Minggu",
};

export const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function getDayKey(date: Date): DayKey {
  return DAY_KEYS[date.getDay()];
}

/**
 * Returns effective work hours for an employee on a given date.
 * Priority:
 * 1. employee.schedule[dayKey] (if defined)
 * 2. employee.work_start/work_end (global default for employee)
 * 3. settings.work_start/work_end (company default)
 *
 * Returns { off: true } if employee has that day marked as off.
 */
export function getEffectiveWorkHours(
  employee:
    | Pick<Employee, "work_start" | "work_end" | "schedule">
    | null
    | undefined,
  settings: Pick<Settings, "work_start" | "work_end"> | null | undefined,
  date?: Date
): { start: string; end: string; off: boolean; source: "schedule" | "employee" | "default" } {
  const dayKey = getDayKey(date || new Date());
  const daySchedule = employee?.schedule?.[dayKey];

  if (daySchedule?.off) {
    return { start: "", end: "", off: true, source: "schedule" };
  }

  if (daySchedule?.start && daySchedule?.end) {
    return {
      start: daySchedule.start,
      end: daySchedule.end,
      off: false,
      source: "schedule",
    };
  }

  if (employee?.work_start && employee?.work_end) {
    return {
      start: employee.work_start,
      end: employee.work_end,
      off: false,
      source: "employee",
    };
  }

  return {
    start: settings?.work_start || "09:30",
    end: settings?.work_end || "18:30",
    off: false,
    source: "default",
  };
}
