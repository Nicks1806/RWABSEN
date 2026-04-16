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
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  position?: string | null;
  photo_url?: string | null;
  join_date?: string | null;
  bank_account?: string | null;
  created_at: string;
}

export interface Leave {
  id: string;
  employee_id: string;
  leave_type: "cuti" | "sakit" | "izin";
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  employees?: Employee;
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
  qr_required?: boolean;
  updated_at: string;
}

export interface QRToken {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  by: string; // employee id
  byName?: string;
  at: string; // ISO timestamp
}

export interface TaskAttachment {
  id: string;
  type: "image" | "link";
  url: string;
  name?: string;
  added_at: string;
}

export type TaskLabel = "red" | "yellow" | "green" | "blue" | "purple" | "gray";

export interface Board {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  cover_url?: string | null;
  allowed_roles?: string[] | null; // positions/roles that can access (null = everyone)
  created_by?: string | null;
  created_at: string;
}

export interface BoardMessage {
  id: string;
  board_id: string | null; // null = general channel
  sender_id: string;
  sender_name?: string;
  text: string;
  created_at: string;
}

export interface BoardColumn {
  id: string;
  board_id?: string | null;
  key: string; // unique slug
  label: string;
  description?: string | null;
  color: "rose" | "amber" | "emerald" | "blue" | "purple" | "slate" | "pink" | "indigo" | "teal";
  position: number;
  is_default?: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string; // dynamic — matches BoardColumn.key (brief/today/done/history are defaults but custom allowed)
  color: TaskLabel; // primary/legacy single color (kept for backward compat)
  labels?: TaskLabel[] | null; // array of label colors (multi-label)
  assignee_id?: string | null; // legacy single assignee (kept for backward compat)
  assignees?: string[] | null; // array of employee IDs (multi-assign)
  created_by?: string | null;
  due_date?: string | null;
  position?: number;
  checklist?: ChecklistItem[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  cover_url?: string | null; // optional cover image URL (auto-set from first image attachment)
  created_at: string;
  updated_at: string;
  assignee?: Employee;
  assigneeObjects?: Employee[];
}

export interface Reimbursement {
  id: string;
  employee_id: string;
  category: string;
  transaction_date: string;
  amount: number;
  description?: string | null;
  attachment_url?: string | null;
  bank_account?: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  employees?: Employee;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important" | "urgent";
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
