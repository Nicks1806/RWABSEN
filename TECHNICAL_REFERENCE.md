# TECHNICAL_REFERENCE.md — Complete Code + SQL Documentation

> Full technical dump untuk RedWine Attendance. Semua SQL + key lib code di 1 file.
> Digenerate: 20 April 2026.
>
> Companion: `PROJECT_MASTER.md` (overview), `HANDOFF.md` (history), `MIGRATION_NOTES.md` (setup).

---

## 📋 Table of Contents

1. [Package Dependencies](#package-dependencies)
2. [TypeScript Interfaces (types.ts)](#typescript-interfaces)
3. [Supabase Client Setup](#supabase-client)
4. [Auth (localStorage-based)](#auth)
5. [Permission Helpers](#permission-helpers)
6. [Work Hours per Employee](#work-hours)
7. [GPS Distance Calculation](#gps-distance)
8. [Face Detection Wrapper](#face-detection)
9. [Push Notification Client](#push-client)
10. [Debounce Util](#debounce)
11. [Positions List](#positions)
12. [API Routes — Push Send](#api-push-send)
13. [API Routes — Attendance CSV](#api-attendance-csv)
14. [PDF Export Sanitizer](#pdf-export-sanitizer)
15. [Service Worker (public/sw.js)](#service-worker)
16. [Complete SQL Schema (all 14 files)](#complete-sql-schema)
17. [RLS Policies Summary](#rls-policies)
18. [Realtime Publications](#realtime-publications)
19. [Custom CSS Animations (globals.css)](#custom-animations)

---

## Package Dependencies

**File: `package.json`**

```json
{
  "name": "redwine-attendance",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@supabase/supabase-js": "^2.103.0",
    "@vladmandic/face-api": "^1.7.15",
    "date-fns": "^4.1.0",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "jsqr": "^1.4.0",
    "lucide-react": "^1.8.0",
    "next": "16.2.3",
    "qrcode": "^1.5.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.1",
    "web-push": "^3.6.7",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/web-push": "^3.6.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.3",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## TypeScript Interfaces

**File: `src/lib/types.ts`** — All shapes used across the app.

```ts
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
  by: string;      // employee id
  byName?: string;
  at: string;      // ISO timestamp
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
  allowed_roles?: string[] | null;   // positions/roles yang boleh akses (null = semua)
  created_by?: string | null;
  created_at: string;
}

export interface BoardMessage {
  id: string;
  board_id: string | null;           // null = general channel
  sender_id: string;
  sender_name?: string;
  text: string;
  image_url?: string | null;
  reply_to_id?: string | null;
  reply_to_text?: string | null;
  reply_to_sender?: string | null;
  created_at: string;
}

export interface BoardColumn {
  id: string;
  board_id?: string | null;
  key: string;                       // unique slug
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
  status: string;                    // dynamic — matches BoardColumn.key
  color: TaskLabel;                  // legacy single label
  labels?: TaskLabel[] | null;       // multi-label
  assignee_id?: string | null;       // legacy single assignee
  assignees?: string[] | null;       // multi-assign
  created_by?: string | null;
  due_date?: string | null;
  position?: number;
  checklist?: ChecklistItem[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  cover_url?: string | null;         // auto-set from first image attachment
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
```

---

## Supabase Client

**File: `src/lib/supabase.ts`** — Singleton dengan lazy init.

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not set");
  }
  _supabase = createClient(url, key);
  return _supabase;
}

// Backward compat — lazy init via Proxy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

---

## Auth

**File: `src/lib/auth.ts`** — localStorage session (bukan Supabase Auth).

```ts
import { Employee } from "./types";

const STORAGE_KEY = "redwine_employee";

export function getStoredEmployee(): Employee | null {
  if (typeof window === "undefined") return null;   // SSR guard
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function storeEmployee(employee: Employee): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

export function clearEmployee(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

---

## Permission Helpers

**File: `src/lib/permissions.ts`** — Role-based access.

```ts
import { Employee, Board } from "./types";

export function canAccessTasks(emp: Employee | null | undefined): boolean {
  return !!emp;   // Any logged-in employee can access /tasks
}

export function canAccessBoard(emp: Employee | null | undefined, board: Board): boolean {
  if (!emp) return false;
  if (emp.role === "admin") return true;             // admin sees all
  if (!board.allowed_roles || board.allowed_roles.length === 0) return true;  // public board

  const pos = (emp.position || "").toLowerCase();
  return board.allowed_roles.some((role) => {
    const r = role.toLowerCase();
    return pos.includes(r) || r.includes(pos);       // substring match both directions
  });
}

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
```

---

## Work Hours

**File: `src/lib/workHours.ts`** — Per-employee schedule dengan precedence.

Precedence (dari paling spesifik ke default):
1. `emp.schedule[dayKey]` (per-day override)
2. `emp.work_start` / `emp.work_end` (per-employee default)
3. `settings.work_start` / `settings.work_end` (workspace default)

Function `getEffectiveWorkHours(emp, settings)` returns `{ start: string, end: string, off: boolean }`. Dipakai di `/absen` (late detection), `/admin` (stats), `pdfExport.ts` (report header).

---

## GPS Distance

**File: `src/lib/geo.ts`** — Haversine + accuracy tolerance.

```ts
export function getDistanceFromLatLng(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;                                 // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser ini"));
      return;
    }
    // Try high accuracy first, fallback to low accuracy if fails
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0
    });
  });
}
```

**Kritis:** `effectiveDist = max(0, distance - accuracy)` untuk hindari false positive di radius edge.

---

## Face Detection

**File: `src/lib/faceDetection.ts`** — Lazy-loaded `@vladmandic/face-api`. **Fail-open** by design.

```ts
export async function hasFace(imageDataUrl: string): Promise<boolean> {
  try {
    await loadModels();  // Lazy load models dari CDN
    const img = await loadImage(imageDataUrl);
    const detections = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
    );
    return detections.length > 0;
  } catch (err) {
    console.error("Face detection error:", err);
    return true;  // ← FAIL OPEN — jangan block absen kalau model gagal load
  }
}

export function prewarmFaceModels() {
  loadModels().catch(() => {});
}
```

---

## Push Client

**File: `src/lib/push.ts`** — Web Push subscription helpers.

- `subscribeToPush(employeeId)` — request permission, subscribe, UPSERT ke `push_subscriptions`
- `unsubscribeFromPush(employeeId)` — unsubscribe + DELETE
- `getSubscriptionStatus(employeeId)` — check if subscribed
- Format: uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY` from env

---

## Debounce

**File: `src/lib/debounce.ts`** — Simple debounce util.

```ts
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
```

Dipakai untuk realtime channel callbacks (500ms typical).

---

## Positions

**File: `src/lib/positions.ts`** — Predefined positions + color coding.

```ts
export const POSITIONS = [
  "Founder", "CEO", "Direktur", "GM", "Manager",
  "Sales", "Kasir", "Marketing", "Content Creator",
  "Admin Gudang", "Cleaning Service", "Security", "Owner"
];

// getPositionColor() returns Tailwind class per role for badge coloring
```

---

## API Push Send

**File: `src/app/api/push/send/route.ts`** — Server endpoint kirim push.

**Request:**
```json
POST /api/push/send
{
  "employee_id": "uuid",              // OR employee_ids: []
  "title": "Judul",
  "body": "Pesan",
  "url": "/absen"                     // optional, default "/"
}
```

**Response:** `{ sent: number, failed: number, total: number }`

**Reliability pattern:**
```ts
const results = await Promise.allSettled(
  subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      return { ok: true };
    } catch (err) {
      // Auto-cleanup expired subs
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      return { ok: false };
    }
  })
);
```

**Env vars used:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Auto VAPID subject fix:** kalau env value tidak diawali `mailto:` atau `http`, auto-prepend `mailto:`.

---

## API Attendance CSV

**File: `src/app/api/attendance-csv/route.ts`** — Public CSV endpoint untuk Google Sheets.

**Request:**
```
GET /api/attendance-csv?month=2026-04&key=YOUR_CSV_EXPORT_KEY
```

**Auth:** Simple query param `key` must match `process.env.CSV_EXPORT_KEY`. Return 401 kalau tidak match.

**Usage di Google Sheets:**
```
=IMPORTDATA("https://absensiredwine.vercel.app/api/attendance-csv?month=2026-04&key=SECRET")
```

**Returns:** CSV dengan columns: Nama, Tanggal, Clock In, Clock Out, Status, Jam Kerja, Catatan

---

## PDF Export Sanitizer

**File: `src/lib/pdfExport.ts`** — Emoji sanitization untuk jsPDF (Latin-1 only).

```ts
function pdfSafe(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[☀-➿]/g, "")
    .replace(/[\u{1F300}-\u{1F6FF}]/gu, "")           // Misc Symbols & Pictographs
    .replace(/[\u{1F700}-\u{1F77F}]/gu, "")
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, "")
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")           // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
    .replace(/[\u{1F000}-\u{1F02F}]/gu, "")           // Mahjong
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, "")           // Cards
    .replace(/[\u{1F100}-\u{1F1FF}]/gu, "")           // Regional (flags)
    .replace(/[︀-️]/g, "")                            // Variation selectors
    .replace(/‍/g, "")                                // ZWJ
    .replace(/⃣/g, "")                                // Keycap
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")   // Surrogate pairs
    .replace(/[\uD800-\uDFFF]/g, "")                  // Lone surrogates
    .replace(/\s+/g, " ")
    .trim();
}
```

**Exports:**
- `exportMonthlyPDF({ month, employees, records, settings })` — all-employees summary
- `exportEmployeeMonthlyReport({ employee, records, leaves, reimbursements, settings, month })` — per-employee comprehensive report with cover, 4 stat cards, attendance table, leaves table, reimbursements table, footer

**Colors:** Primary `#8B1A1A` (bordeaux) + Gold `#D4AF37` accent.

---

## Service Worker

**File: `public/sw.js`** — PWA caching strategy.

```js
const CACHE_NAME = "redwine-v19";           // BUMP setiap major client change!

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.png",
  "/apple-icon.png",
  "/logo.png",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// Activate — cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip Supabase (always fresh)
  if (url.hostname.includes("supabase.co")) return;

  // Skip Next chunks (always fresh — avoid stale chunk errors)
  if (url.pathname.includes("/_next/static/chunks/")) return;
  if (url.pathname.includes("/_next/static/css/")) return;

  // Network-first for HTML navigation (bypass stale cache)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Push notification
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url || "/" },
    })
  );
});

// Notification click — open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
```

---

## Complete SQL Schema

### 1. `supabase-schema.sql` — Core tables (employees, attendance, settings)

```sql
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  clock_in_photo TEXT,
  clock_out_photo TEXT,
  clock_in_lat DOUBLE PRECISION,
  clock_in_lng DOUBLE PRECISION,
  clock_out_lat DOUBLE PRECISION,
  clock_out_lng DOUBLE PRECISION,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'late', 'early_leave', 'absent')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  office_lat DOUBLE PRECISION NOT NULL,
  office_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  work_start TIME NOT NULL DEFAULT '09:30',
  work_end TIME NOT NULL DEFAULT '18:30',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (office_lat, office_lng, radius_meters, work_start, work_end)
VALUES (-6.1947, 106.8164, 100, '09:30', '18:30');

INSERT INTO employees (name, pin, role)
VALUES ('Admin', '123456', 'admin');

INSERT INTO employees (name, pin, role) VALUES
  ('Aria', '000001', 'employee'),
  ('Grace', '000002', 'employee'),
  ('Norman', '000003', 'employee'),
  ('Surya', '000004', 'employee'),
  ('Amelia', '000005', 'employee'),
  ('Evri', '000006', 'employee'),
  ('Hellen', '000007', 'employee'),
  ('Tati', '000008', 'employee'),
  ('Agustina', '000009', 'employee'),
  ('Anselline', '000010', 'employee');

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_employees_pin ON employees(pin);
```

**⚠️ Manual step:** Buat Storage bucket `attendance-photos` (Public) via Supabase Dashboard.

### 2. `supabase-migration-v2.sql` — Profile columns + leaves table

```sql
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE;

CREATE TABLE IF NOT EXISTS leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('cuti', 'sakit', 'izin')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date);

ALTER PUBLICATION supabase_realtime ADD TABLE leaves;
```

### 3. `supabase-migration-work-hours.sql`

```sql
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME;
```

### 4. `supabase-migration-workdays.sql`

```sql
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["mon","tue","wed","thu","fri","sat"]'::jsonb;

UPDATE settings SET work_days = '["mon","tue","wed","thu","fri","sat"]'::jsonb WHERE work_days IS NULL;
```

### 5. `supabase-migration-schedule.sql`

```sql
-- Format schedule JSONB: { "mon": {start, end, off}, "tue": ..., ... }
ALTER TABLE employees ADD COLUMN IF NOT EXISTS schedule JSONB;
```

### 6. `supabase-migration-employee-schedules.sql` — Assign schedules to actual employees

```sql
UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'aria';

UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'norman';

UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"mon": {"off": true}}'::jsonb
WHERE LOWER(name) = 'evri';

UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"tue": {"off": true}}'::jsonb
WHERE LOWER(name) = 'tati';

UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"wed": {"off": true}}'::jsonb
WHERE LOWER(name) = 'hellen';

UPDATE employees SET
  work_start = '09:30:00', work_end = '18:30:00',
  schedule = '{"sat": {"off": true}}'::jsonb
WHERE LOWER(name) = 'surya';

UPDATE employees SET
  work_start = '09:30:00', work_end = '17:30:00',
  schedule = '{"sat": {"off": true}, "sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'grace';

-- Add TIWI (libur Jumat) + MOTY (libur Kamis) kalau belum ada
INSERT INTO employees (name, pin, role, work_start, work_end, schedule, is_active)
SELECT 'Tiwi', '000011', 'employee', '09:30:00', '18:30:00', '{"fri": {"off": true}}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE LOWER(name) = 'tiwi');

INSERT INTO employees (name, pin, role, work_start, work_end, schedule, is_active)
SELECT 'Moty', '000012', 'employee', '09:30:00', '18:30:00', '{"thu": {"off": true}}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE LOWER(name) = 'moty');

UPDATE settings SET
  work_days = '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb
WHERE id = (SELECT id FROM settings LIMIT 1);
```

### 7. `supabase-migration-announcements.sql`

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

### 8. `supabase-migration-reimbursements.sql`

```sql
CREATE TABLE IF NOT EXISTS reimbursements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'umum',
  transaction_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on reimbursements" ON reimbursements FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reimb_employee ON reimbursements(employee_id);
CREATE INDEX IF NOT EXISTS idx_reimb_status ON reimbursements(status);

ALTER PUBLICATION supabase_realtime ADD TABLE reimbursements;
```

### 9. `supabase-migration-tasks.sql`

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'brief' CHECK (status IN ('brief', 'today', 'done', 'history')),
  color TEXT DEFAULT 'red' CHECK (color IN ('red', 'yellow', 'green', 'blue', 'purple', 'gray')),
  assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
```

### 10. `supabase-migration-tasks-trello.sql` — Add checklist + comments

```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
```

**Note:** File ini original hanya add 2 kolom. Fitur board/board_columns/board_messages/multi-label/attachments/cover ditambah incremental via UI + auto-migration di code. Kolom-kolom yang diperlukan:
```sql
-- Kalau schema belum ada kolom-kolom ini, run:
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS board_id UUID,
  ADD COLUMN IF NOT EXISTS labels TEXT[],
  ADD COLUMN IF NOT EXISTS assignees TEXT[],
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  cover_url TEXT,
  allowed_roles TEXT[],
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on boards" ON boards FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS board_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'slate',
  position INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on board_columns" ON board_columns FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS board_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES employees(id),
  sender_name TEXT,
  text TEXT,
  image_url TEXT,
  reply_to_id UUID,
  reply_to_text TEXT,
  reply_to_sender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE board_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on board_messages" ON board_messages FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE board_messages;
```

### 11. `supabase-migration-push.sql`

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on push_subscriptions" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON push_subscriptions(employee_id);
```

### 12. `supabase-migration-qr.sql`

```sql
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on qr_tokens" ON qr_tokens FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);

ALTER TABLE settings ADD COLUMN IF NOT EXISTS qr_required BOOLEAN DEFAULT false;

ALTER PUBLICATION supabase_realtime ADD TABLE qr_tokens;
```

### 13. `supabase-migration-rls-hardening.sql` (OPTIONAL)

Tighter RLS untuk DB-level security. Sudah dibuat lengkap di file, jalankan kalau mau security lebih ketat. Highlights:
- `settings` read-only dari client
- `employees` no DELETE dari client
- `attendance` INSERT hanya `CURRENT_DATE`
- `leaves`/`reimbursements` DELETE hanya kalau `status='pending'`
- `board_messages` DELETE hanya <5 menit sejak dikirim

### 14. `supabase-migration-update-office-location.sql`

```sql
UPDATE settings SET
  office_lat = -6.195806,
  office_lng = 106.816667,
  updated_at = NOW()
WHERE id = (SELECT id FROM settings LIMIT 1);
```

**Koordinat:** 6°11'44.9"S 106°49'00.0"E (Thamrin City, Jakarta)

### Additional: bank_account column

```sql
-- Kalau column bank_account belum ada di employees:
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account TEXT;
```

---

## RLS Policies

**Status default (semua tabel):** RLS enabled, policy `USING (true) WITH CHECK (true)` (fully open).

**Alasan:** Auth PIN + localStorage tidak bisa carry JWT claims → server-level user scoping tidak mungkin tanpa refactor besar. Semua guard di client-side.

**Hardening opsional:** Run `supabase-migration-rls-hardening.sql` untuk restrict:
| Table | Restriction |
|---|---|
| `settings` | SELECT only from client |
| `employees` | No DELETE from client |
| `attendance` | INSERT only current date |
| `leaves` | DELETE only if status='pending' |
| `reimbursements` | DELETE only if status='pending' |
| `board_messages` | DELETE only within 5 min of creation |

---

## Realtime Publications

Tables yang harus enabled di **Supabase Dashboard → Database → Replication:**

- `announcements`
- `attendance`
- `leaves`
- `reimbursements`
- `tasks`
- `board_messages`
- `qr_tokens`

Kalau lupa enable → realtime updates tidak jalan (harus manual refresh).

---

## Custom Animations

**File: `src/app/globals.css`** — Custom keyframes.

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fade-in 0.25s ease-out; }

@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slide-up { animation: slide-up 0.3s ease-out; }

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }

@keyframes stagger-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-stagger { animation: stagger-up 0.3s ease-out backwards; }

@keyframes soft-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-soft-pulse { animation: soft-pulse 2s ease-in-out infinite; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes dash-flow {
  to { stroke-dashoffset: -32; }
}
.silhouette-dash {
  stroke-dasharray: 8 6;
  animation: dash-flow 3s linear infinite;
}

@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-sheet-up { animation: sheet-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

/* iOS/Android safe-area utilities */
.safe-top { padding-top: env(safe-area-inset-top, 0px); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
.safe-bottom-plus { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); }

/* Scrollbar hide */
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-slide-up, .animate-fade-in, .animate-scale-in,
  .animate-stagger, .animate-soft-pulse, .animate-shimmer {
    animation: none !important;
  }
}
```

---

## 📌 File Locations Summary

| Component | File Path | Lines |
|---|---|---|
| Types | `src/lib/types.ts` | 193 |
| Supabase client | `src/lib/supabase.ts` | 21 |
| Auth | `src/lib/auth.ts` | 22 |
| Permissions | `src/lib/permissions.ts` | 44 |
| Work hours | `src/lib/workHours.ts` | 84 |
| Geo | `src/lib/geo.ts` | 48 |
| Face detect | `src/lib/faceDetection.ts` | 54 |
| Push client | `src/lib/push.ts` | 95 |
| Debounce | `src/lib/debounce.ts` | 19 |
| Positions | `src/lib/positions.ts` | 29 |
| PDF export | `src/lib/pdfExport.ts` | 482 |
| API push send | `src/app/api/push/send/route.ts` | ~95 |
| API CSV | `src/app/api/attendance-csv/route.ts` | 108 |
| Service worker | `public/sw.js` | ~140 |
| All SQL migrations | `supabase-*.sql` | 630 |

**Total tracked code:** ~2,000 lines lib+API+SQL. Plus pages ~7,000 lines (absen 1311, admin 2874, tasks 2545, others ~300 each).

---

## 🔒 Security Notes

1. **Client auth = localStorage PIN** — server tidak bisa verify user
2. **Server operations pakai `SUPABASE_SERVICE_KEY`** — bypass RLS untuk push send + CSV export
3. **RLS default open** — apply hardening SQL kalau mau DB-level guard
4. **VAPID keys must match** — public di client subscribe, private di server sign
5. **Storage bucket public read** — foto attendance URL bisa diakses siapa saja yang tahu path (folder-based `{employee_id}/`)

---

_File ini adalah snapshot komplit teknis project. Update saat ada perubahan schema atau lib penting._
_Generated 20 April 2026 · Companion: PROJECT_MASTER.md, HANDOFF.md, MIGRATION_NOTES.md, NEW_CLAUDE_ONBOARDING.md_
