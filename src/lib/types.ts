export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DaySchedule {
  start?: string;
  end?: string;
  off?: boolean;
}

export type Schedule = Partial<Record<DayKey, DaySchedule>>;

export interface Employee {
  id: string;
  name: string;
  pin: string;
  role: "employee" | "admin";
  is_active: boolean;
  work_start?: string | null;
  work_end?: string | null;
  schedule?: Schedule | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_photo: string | null;
  clock_out_photo: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  status: "present" | "late" | "early_leave" | "absent";
  notes: string | null;
  created_at: string;
  employees?: Employee;
}

export interface Settings {
  id: string;
  office_lat: number;
  office_lng: number;
  radius_meters: number;
  work_start: string;
  work_end: string;
  work_days?: DayKey[] | null;
  updated_at: string;
}
