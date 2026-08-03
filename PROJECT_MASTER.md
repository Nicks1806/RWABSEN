# PROJECT_MASTER.md — RedWine Attendance Complete Recap

> **Baca file ini pertama kali kamu (Claude Code baru) diberi akses ke project.**
> Setelah baca ini, kamu punya konteks setara dengan Claude yang sudah kerja di project ini berminggu-minggu.
>
> **Companion files** (baca urut):
> 1. `PROJECT_MASTER.md` ← kamu di sini (bacaan utama)
> 2. `AGENTS.md` ← peringatan Next.js 16 (3 baris, wajib)
> 3. `CLAUDE.md` ← detailed reference
> 4. `HANDOFF.md` ← extended history + decision log
> 5. `MIGRATION_NOTES.md` ← setup checklist untuk env baru

Tanggal: 20 April 2026 · Live URL: https://absensiredwine.vercel.app · Repo: https://github.com/Nicks1806/RWABSEN

---

## 🎯 1. TL;DR — Apa Ini?

**RedWine Attendance** — PWA absensi karyawan untuk **RedWine Shoes & Bags** (boutique premium sepatu & tas di Thamrin City, Jakarta).

**Pengguna:** ~10-15 karyawan (pakai HP), 1-2 admin (pakai desktop untuk approve + analytics).

**Fitur inti:**
1. **Clock in/out** dengan selfie + GPS radius kantor + face detection + QR scan optional
2. **Cuti / Izin / Sakit** — pengajuan karyawan + approval bulk admin
3. **Reimbursement** — pengajuan biaya + approval bulk admin
4. **Task Board Kanban** — multi-board, drag-and-drop (manager only), chat per-board realtime
5. **Pengumuman** — admin push message dengan priority + expiry
6. **Push Notification** (Web Push VAPID) — clock-out reminder, task assign, approval
7. **Admin Analytics** — statistik kehadiran, top rajin/telat, per-employee PDF download
8. **PWA** — installable ke home screen Android/iOS, offline capability

**Tech stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + Supabase (Postgres/Storage/Realtime) + Vercel (auto-deploy). Auth **custom PIN-based** via `localStorage`, bukan Supabase Auth.

**Brand:** Primary `#8B1A1A` (Bordeaux wine red), tagline "Matched in Elegance", UI Bahasa Indonesia.

---

## 🔑 2. AKSES YANG PERLU DISIAPKAN

Owner (Nicks1806) harus share 3 hal ke developer baru:

### A. Env vars (7 keys) — untuk `.env.local` dan Vercel
```env
NEXT_PUBLIC_SUPABASE_URL=[SECRET]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[SECRET]
SUPABASE_SERVICE_KEY=[SECRET - server only]
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[SECRET]
VAPID_PRIVATE_KEY=[SECRET - server only]
VAPID_SUBJECT=mailto:admin@redwineshoes.id
CSV_EXPORT_KEY=[SECRET - buat password bebas]
```

**Sumber tiap env var:**
- Supabase URL/keys → Supabase Dashboard → Settings → API
- VAPID keys → generate sekali via `npx web-push generate-vapid-keys` (atau ambil dari Vercel existing env)
- `VAPID_SUBJECT` → manual, format `mailto:...`
- `CSV_EXPORT_KEY` → bebas, contoh `rw_csv_9x8y7z`

### B. Repo/Platform access
- **GitHub:** invite ke `Nicks1806/RWABSEN` sebagai Collaborator
- **Vercel:** invite ke Team → Members
- **Supabase:** invite ke Organization → project RedWine

### C. Info tambahan
- Supabase project ref (bagian sebelum `.supabase.co`)
- Existing admin PIN (untuk test login tanpa buat admin baru)
- Domain registrar login (kalau mau setup `absensi.redwineshoes.id`)

---

## 🧭 3. GUARDRAILS — Wajib Baca

### ⚠️ 3.1 Ini Next.js 16 (bukan 14/15)
- File struktur + API + convention BERBEDA dari training data lama
- `viewport` config: `export const viewport: Viewport = {...}` (bukan di metadata)
- `force-dynamic` layout dipakai di `/tasks` untuk bypass Vercel edge cache
- Baca `node_modules/next/dist/docs/` kalau ragu

### ⚠️ 3.2 Hooks Rule (HARD RULE — melanggar = crash)
Semua `useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`/`useTransition` **HARUS** di atas early return:

```tsx
// ❌ SALAH — crash React Error #310
export default function Page() {
  const [user, setUser] = useState<Employee | null>(null);
  useEffect(() => { setUser(getStoredEmployee()); }, []);
  if (!user) return null;
  const [foo, setFoo] = useState(0);  // ← ILLEGAL
  ...
}

// ✅ BENAR
export default function Page() {
  const [user, setUser] = useState<Employee | null>(null);
  const [foo, setFoo] = useState(0);   // ← declared BEFORE return
  useEffect(() => { setUser(getStoredEmployee()); }, []);
  if (!user) return null;
  ...
}
```

### ⚠️ 3.3 Heavy libs HARUS lazy-loaded
Jangan import di top-level:
- `jspdf` + `jspdf-autotable` (~500KB)
- `xlsx`
- `recharts` (~400KB) — pakai `next/dynamic`
- `@vladmandic/face-api`

Pattern lazy-load:
```ts
async function exportPDF() {
  const { exportMonthlyPDF } = await import("@/lib/pdfExport");
  exportMonthlyPDF(...);
}
```

### ⚠️ 3.4 Mobile-first, Bahasa Indonesia
- Test minimum 375px width (iPhone SE)
- SEMUA UI text dalam Bahasa Indonesia
- Comments/commits/code boleh Inggris

### ⚠️ 3.5 PWA cache invalidation
Setelah client-side code change signifikan, bump `CACHE_NAME` di `public/sw.js`:
```js
const CACHE_NAME = "redwine-v16";  // → bump ke v17
```
Otherwise mobile PWA users lihat blank screen karena chunk lama sudah tidak ada di server.

### ⚠️ 3.6 Vercel free tier
100 deploys/day limit. Plan commits, jangan spam push.

### ⚠️ 3.7 Auth = PIN + localStorage (BUKAN Supabase Auth)
- **JANGAN** pakai `supabase.auth.*`
- Session disimpan di localStorage key `redwine_employee`
- Server tidak bisa verify user dari request → semua guard di client-side
- Untuk DB-level hardening → apply `supabase-migration-rls-hardening.sql`

---

## 📁 4. STRUKTUR PROJECT

```
redwine-attendance/
├── src/
│   ├── app/                          Next.js App Router (routes)
│   │   ├── page.tsx                  # / Login (PIN)
│   │   ├── layout.tsx                # Root layout + viewport meta
│   │   ├── globals.css               # Tailwind + custom animations
│   │   ├── absen/page.tsx            # /absen Clock in/out (1311 lines)
│   │   ├── admin/
│   │   │   ├── page.tsx              # /admin Dashboard 5 tabs (2874 lines)
│   │   │   ├── karyawan/[id]/page.tsx
│   │   │   ├── pengumuman/page.tsx
│   │   │   └── qr/page.tsx
│   │   ├── api/
│   │   │   ├── push/send/route.ts    # POST kirim web push
│   │   │   └── attendance-csv/route.ts # GET CSV untuk Google Sheets
│   │   ├── home/page.tsx             # /home Employee dashboard
│   │   ├── inbox/page.tsx            # /inbox Notif history
│   │   ├── pegawai/page.tsx          # /pegawai Directory
│   │   ├── pengajuan/page.tsx        # /pengajuan Leave+reimburse form
│   │   ├── profile/page.tsx          # /profile PIN change, bank account
│   │   ├── riwayat/page.tsx          # /riwayat Attendance history
│   │   └── tasks/
│   │       ├── layout.tsx            # force-dynamic
│   │       └── page.tsx              # /tasks Kanban (2545 lines)
│   ├── components/
│   │   ├── Avatar.tsx                # loading=lazy + initial fallback
│   │   ├── BottomNav.tsx             # Mobile bottom nav (5 tabs)
│   │   ├── InstallAppButton.tsx      # PWA install prompt
│   │   ├── Logo.tsx
│   │   ├── NotifToggle.tsx           # Push permission toggle
│   │   ├── PWARegister.tsx           # Service worker registration
│   │   ├── Skeleton.tsx              # Loading skeletons library
│   │   └── TaskDetailModal.tsx       # Task detail dialog
│   └── lib/
│       ├── auth.ts                   # localStorage session (22 lines)
│       ├── debounce.ts               # Debounce util (19 lines)
│       ├── faceDetection.ts          # Lazy face-api wrapper (54 lines)
│       ├── geo.ts                    # GPS distance calc (48 lines)
│       ├── pdfExport.ts              # jsPDF exporters (482 lines)
│       ├── permissions.ts            # canAccessBoard, canManageBoards (44 lines)
│       ├── positions.ts              # POSITIONS list + colors (29 lines)
│       ├── push.ts                   # Client subscription (95 lines)
│       ├── supabase.ts               # Client singleton (21 lines)
│       ├── types.ts                  # ALL TypeScript interfaces (193 lines)
│       └── workHours.ts              # Per-employee work hours (84 lines)
├── public/
│   ├── sw.js                         # Service worker v16
│   ├── manifest.json                 # PWA manifest
│   ├── icon.png / apple-icon.png
│   ├── logo.png
│   └── design-preview.html           # Static design mockup
├── supabase-schema.sql               # Main schema
├── supabase-migration-*.sql          # 14 migration files
├── PROJECT_MASTER.md                 # ← File ini
├── CLAUDE.md                         # Detailed reference (~640 lines)
├── HANDOFF.md                        # Extended history (~420 lines)
├── MIGRATION_NOTES.md                # Setup guide (~230 lines)
├── AGENTS.md                         # Next.js 16 warning (3 lines)
├── README.md
├── package.json
├── tsconfig.json                     # Path alias @/* → ./src/*
├── next.config.ts                    # Empty config
└── eslint.config.mjs                 # Flat config
```

---

## 📦 5. DEPENDENCIES

### Runtime
```json
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
```

### Dev
```json
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
```

### Scripts
```bash
npm run dev        # Development (Turbopack, port 3000)
npm run build      # Production build
npm run start      # Production server (setelah build)
npm run lint       # ESLint

# Manual (tidak ada script):
npx tsc --noEmit -p .           # Type check
npx web-push generate-vapid-keys # Generate VAPID keys
```

---

## 🗄️ 6. DATABASE SCHEMA (12 tables)

Semua di Supabase Postgres. RLS enabled, default policy `USING (true)` (fully open — hardening opsional via `supabase-migration-rls-hardening.sql`).

### `employees` — Karyawan
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
pin text NOT NULL                 -- 4-6 digit
role text DEFAULT 'employee'      -- 'employee' | 'admin'
is_active boolean DEFAULT true
work_start text                   -- '09:00' format
work_end text                     -- '18:00' format
schedule jsonb                    -- {mon: {start, end, off}, ...}
phone text
email text
address text
position text                     -- 'Sales', 'Kasir', 'GM', dll
photo_url text
join_date date
bank_account text                 -- 'BCA 1234567890 a/n Nama'
created_at timestamptz DEFAULT now()
```

### `attendance` — Log absensi harian
```sql
id uuid PRIMARY KEY
employee_id uuid REFERENCES employees(id)
date date NOT NULL
clock_in / clock_out timestamptz
clock_in_photo / clock_out_photo text
clock_in_lat / clock_in_lng float
clock_out_lat / clock_out_lng float
status text                       -- 'present'|'late'|'early_leave'|'absent'
notes text
created_at timestamptz DEFAULT now()

UNIQUE(employee_id, date)         -- 1 record per orang per hari
```

### `settings` — Konfigurasi global (single row)
```sql
id uuid PRIMARY KEY
office_lat float                  -- Thamrin City: -6.195806
office_lng float                  -- Thamrin City: 106.816667
radius_meters int DEFAULT 100
work_start text                   -- Default '09:00'
work_end text                     -- Default '18:00'
work_days text[]                  -- ['mon','tue','wed','thu','fri','sat']
qr_required boolean DEFAULT false
updated_at timestamptz
```

### `leaves` — Cuti/Izin/Sakit
```sql
id uuid PK
employee_id uuid FK
leave_type text                   -- 'cuti'|'sakit'|'izin'
start_date, end_date date
reason text
attachment_url text
status text DEFAULT 'pending'     -- 'pending'|'approved'|'rejected'
admin_notes text
reviewed_by uuid FK               -- employee (admin) yang approve
reviewed_at timestamptz
created_at timestamptz
```

### `reimbursements` — Klaim reimburse
```sql
id uuid PK
employee_id uuid FK
category text                     -- 'umum'|'transport'|'makanan'|'medis'|'lainnya'
transaction_date date
amount int                        -- Rupiah, integer
description text
attachment_url text
bank_account text
status text DEFAULT 'pending'
admin_notes text
reviewed_by uuid FK, reviewed_at timestamptz
created_at timestamptz
```

### `announcements` — Pengumuman
```sql
id uuid PK
title text
body text
priority text                     -- 'normal'|'important'|'urgent'
is_active boolean DEFAULT true
start_date, end_date date         -- Periode tayang (nullable)
created_by uuid FK
created_at, updated_at timestamptz
```

### `tasks` — Kanban cards
```sql
id uuid PK
board_id uuid FK NULLABLE         -- null = default board
title text NOT NULL
description text
status text                       -- kolom key (brief/today/done/history)
color text                        -- legacy single label
labels text[]                     -- multi-label array
assignee_id uuid FK (legacy)
assignees text[]                  -- multi-assign array (uuid string)
created_by uuid FK
due_date date
position int
checklist jsonb[]                 -- [{id, text, done}]
comments jsonb[]                  -- [{id, text, by, at}]
attachments jsonb[]               -- [{id, type, url, name}]
cover_url text
created_at, updated_at timestamptz
```

### `boards` — Multi-board container
```sql
id uuid PK
name text
description text
color text                        -- Tailwind class
cover_url text
allowed_roles text[]              -- ['Sales', 'Marketing'] atau null=semua
created_by uuid FK
created_at timestamptz
```

### `board_columns` — Kolom dinamis per board
```sql
id uuid PK
board_id uuid FK NULLABLE         -- null = default columns
key text                          -- slug ('brief', 'today', dll)
label text                        -- display name
description text
color text                        -- rose|amber|emerald|blue|purple|slate|pink|indigo|teal
position int
is_default boolean
created_at timestamptz
```

### `board_messages` — Chat per-board realtime
```sql
id uuid PK
board_id uuid FK NULLABLE         -- null = general channel
sender_id uuid FK
sender_name text                  -- cached
text text
image_url text
reply_to_id uuid                  -- reply threading
reply_to_text text                -- cached
reply_to_sender text              -- cached
created_at timestamptz
```

### `push_subscriptions` — Web Push endpoints
```sql
id uuid PK
employee_id uuid FK
endpoint text UNIQUE
p256dh text
auth text
created_at timestamptz
```

### `qr_tokens` — Permanent QR untuk clock-in
```sql
id uuid PK
token text UNIQUE
created_at timestamptz
expires_at timestamptz            -- +10 tahun = praktis permanen
```

### Storage Bucket
- **`attendance-photos`** — public read. Dipakai untuk foto selfie clock-in/out + task attachments + reimbursement receipts (folder-based per employee_id).

### Migration files (run order):
1. `supabase-schema.sql`
2. `supabase-migration-v2.sql`
3. `supabase-migration-work-hours.sql`
4. `supabase-migration-workdays.sql`
5. `supabase-migration-schedule.sql`
6. `supabase-migration-employee-schedules.sql`
7. `supabase-migration-announcements.sql`
8. `supabase-migration-reimbursements.sql`
9. `supabase-migration-tasks.sql`
10. `supabase-migration-tasks-trello.sql`
11. `supabase-migration-push.sql`
12. `supabase-migration-qr.sql`
13. `supabase-migration-rls-hardening.sql` (OPSIONAL — DB-level security)
14. `supabase-migration-update-office-location.sql` (Thamrin City coords)

### Enable Realtime pada:
- `board_messages` (chat)
- `announcements` (live update)
- `attendance` (admin monitoring)
- `tasks` (kanban realtime)
- `leaves` (approval notif)

---

## 🔐 7. AUTH FLOW LENGKAP

**Bukan Supabase Auth.** Custom PIN + localStorage.

### 7.1 Kode auth core (`src/lib/auth.ts`)
```ts
const STORAGE_KEY = "redwine_employee";

export function getStoredEmployee(): Employee | null {
  if (typeof window === "undefined") return null;   // SSR guard
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

export function storeEmployee(employee: Employee): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

export function clearEmployee(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

### 7.2 Login flow (`src/app/page.tsx`)
```tsx
async function handleLogin(name: string, pin: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .ilike("name", name.trim())
    .eq("pin", pin.trim())
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) { setError("Nama atau PIN salah"); return; }
  storeEmployee(data);
  router.push(data.role === "admin" ? "/admin" : "/home");
}
```

### 7.3 Protected page pattern (setiap page yang butuh login)
```tsx
export default function ProtectedPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  // ...other hooks

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) { router.push("/"); return; }
    // Untuk admin-only page:
    // if (emp.role !== "admin") { router.push("/"); return; }
    setEmployee(emp);
  }, [router]);

  if (!employee) return <Skeleton />;
  return <div>...</div>;
}
```

### 7.4 Permission helpers (`src/lib/permissions.ts`)
```ts
canAccessTasks(emp)      // Any logged-in
canAccessBoard(emp, board) {
  if (emp.role === "admin") return true;
  if (!board.allowed_roles?.length) return true;
  // Case-insensitive substring match position ↔ allowed_roles
  const pos = emp.position.toLowerCase();
  return board.allowed_roles.some(r => pos.includes(r.toLowerCase()) || r.toLowerCase().includes(pos));
}
canManageBoards(emp) {
  if (emp.role === "admin") return true;
  const pos = emp.position.toLowerCase();
  return ['founder','ceo','direktur','gm','general manager'].some(k => pos.includes(k));
}
```

### 7.5 Protected routes matrix
| Route | Guard | Redirect on fail |
|---|---|---|
| `/` | Public | — |
| `/home`, `/absen`, `/tasks`, `/pegawai`, `/pengajuan`, `/inbox`, `/profile`, `/riwayat` | Any logged-in | `/` |
| `/admin`, `/admin/karyawan/[id]`, `/admin/pengumuman`, `/admin/qr` | Admin role | `/` |

### 7.6 Server-side implications
- **Server tidak tahu siapa user** dari request headers (tidak ada JWT/cookie)
- Semua admin guard di **client** (useEffect check)
- Untuk hardening → apply RLS migration atau pakai `SUPABASE_SERVICE_KEY` di API routes untuk operasi sensitif

---

## 🛣️ 8. ROUTES + API ENDPOINTS LENGKAP

### 8.1 Page Routes
| Route | File | Deskripsi |
|---|---|---|
| `/` | `src/app/page.tsx` | Login PIN (name + pin) |
| `/home` | `src/app/home/page.tsx` | Karyawan dashboard (greeting, quick actions, monthly stats) |
| `/absen` | `src/app/absen/page.tsx` | Clock in/out (camera + GPS + face detect) |
| `/tasks` | `src/app/tasks/page.tsx` | Kanban board multi-board + chat per-board |
| `/pegawai` | `src/app/pegawai/page.tsx` | Employee directory (all karyawan card view) |
| `/pengajuan` | `src/app/pengajuan/page.tsx` | Submit leave/izin/sakit + reimbursement |
| `/inbox` | `src/app/inbox/page.tsx` | Notifikasi history |
| `/profile` | `src/app/profile/page.tsx` | Profile edit + PIN change + bank account + logout |
| `/riwayat` | `src/app/riwayat/page.tsx` | Attendance history + monthly hour stats |
| `/admin` | `src/app/admin/page.tsx` | 5 tabs: Dashboard, Analitik, Izin, Karyawan, Pengaturan |
| `/admin/karyawan/[id]` | `src/app/admin/karyawan/[id]/page.tsx` | Employee detail full history |
| `/admin/pengumuman` | `src/app/admin/pengumuman/page.tsx` | Announcement CRUD |
| `/admin/qr` | `src/app/admin/qr/page.tsx` | Generate permanent QR (10-year validity) |

### 8.2 API Endpoints
| Method | Endpoint | File | Fungsi |
|---|---|---|---|
| POST | `/api/push/send` | `src/app/api/push/send/route.ts` | Kirim web push ke 1 atau banyak karyawan; auto-prune 404/410 subs |
| GET | `/api/attendance-csv?month=YYYY-MM&key=SECRET` | `src/app/api/attendance-csv/route.ts` | CSV attendance untuk Google Sheets `IMPORTDATA` |

### 8.3 `/api/push/send` payload
```json
POST /api/push/send
{
  "employee_id": "uuid",              // OR
  "employee_ids": ["uuid1", "uuid2"], // multi-target
  "title": "Judul notif",
  "body": "Isi pesan",
  "url": "/absen"                     // optional, default "/"
}
```
Response: `{ sent: number, failed: number, total: number }`

### 8.4 CSV endpoint auth
```
GET /api/attendance-csv?month=2026-04&key=YOUR_CSV_EXPORT_KEY
```
Kalau `key` tidak match `process.env.CSV_EXPORT_KEY` → 401.
Bisa dipakai di Google Sheets: `=IMPORTDATA("https://.../api/attendance-csv?month=2026-04&key=SECRET")`

---

## 🔀 9. USER FLOWS LENGKAP

### Flow 1: Karyawan Clock In
```
1. Buka PWA di HP → / (login)
2. Input Nama + PIN → click Login
3. Client: query employees → localStorage.setItem("redwine_employee", data)
4. router.push("/home")
5. /home tampilkan greeting + waktu + quick actions
6. Klik card "Clock In" → /absen
7. useEffect di /absen: 
   - navigator.geolocation.getCurrentPosition() → set location
   - getDistanceFromLatLng(loc, settings.office_lat/lng)
   - effectiveDist = max(0, distance - accuracy)
   - isOutsideRadius = effectiveDist > settings.radius_meters
8. Kalau qr_required=true: startQRScan() → jsQR decode → cek expires_at
9. startCamera() → getUserMedia (facingMode: user, playsInline)
10. Silhouette SVG overlay di video (dashed white, 68% height)
11. Click "Ambil Foto" → capturePhoto():
    - canvas.drawImage(video, 640×480)
    - dataUrl = canvas.toDataURL("image/jpeg", 0.7)
    - Guard: if size > 700KB → re-encode 0.5
    - Guard: if still > 1.5MB → reject with message
    - stopCamera()
12. Preview foto + tombol "Kirim" (disabled saat loading || transitioning)
13. Klik Kirim → handleSubmit():
    - Face detection via face-api (fail-open kalau model gagal)
    - Upload ke Supabase Storage: attendance-photos/{employee_id}/{timestamp}.jpg
    - INSERT ke attendance:
      { employee_id, date: today, clock_in: now, clock_in_photo, clock_in_lat, clock_in_lng, 
        status: (now > workStart) ? 'late' : 'present', notes }
14. setTransitioning(true) → bordeaux fullscreen overlay dengan "Berhasil!" 
15. router.prefetch("/home") → setTimeout 700ms → router.replace("/home")
```

### Flow 2: Task Board — Create + Notify Members
```
1. Manager buka /tasks → canManageBoards(user) = true
2. Pilih board dari switcher (canAccessBoard check)
3. Inline quick-add di kolom manapun: title + desc + assignees + deadline + upload gambar
4. Submit:
   - INSERT tasks { title, status: colKey, board_id, assignees[], created_by, due_date }
   - Auto-color: random dari CARD_COLORS
5. notifyBoardMembers(title):
   - Fetch board.allowed_roles atau semua karyawan
   - POST /api/push/send { employee_ids, title: "Task baru di [board]", body: title }
6. Realtime channel update semua user yang buka board sama
```

### Flow 3: Admin Bulk Approve Leaves
```
1. Admin /admin → tab Izin
2. Filter status=pending → bulk action bar muncul
3. "Pilih semua" → checkbox all pending
4. "Setujui semua" → confirm
5. Loop (parallel Promise.all):
   - UPDATE leaves SET status='approved', reviewed_by, reviewed_at WHERE id=X
   - POST /api/push/send { employee_id: leave.employee_id, title: "Cuti disetujui", body: ... }
6. Reload leaves list
```

### Flow 4: Download Per-Employee PDF Report
```
1. Admin /admin → tab Karyawan
2. Pilih bulan di header (default: current)
3. Klik tombol download hijau di baris karyawan
4. exportEmployeeReport(emp):
   - Fetch leaves (start_date <= monthEnd AND end_date >= monthStart)
   - Fetch reimbursements (transaction_date in month)
   - Filter attendance records untuk karyawan+bulan
5. await import("@/lib/pdfExport") → exportEmployeeMonthlyReport({employee, records, leaves, reimbursements, settings, month})
6. PDF berisi:
   - Cover header bordeaux + gold divider + employee info
   - 4 stat cards (HADIR, TERLAMBAT, PULANG AWAL, TOTAL JAM)
   - Table 1: Log absensi harian (date, in, out, dur, status, notes)
   - Table 2: Riwayat izin/cuti/sakit
   - Table 3: Riwayat reimbursement + total disetujui
   - Footer tiap page
7. Auto-download: Laporan_<name>_YYYY-MM.pdf
```

### Flow 5: PWA Install + Push Subscribe
```
1. Buka https://absensiredwine.vercel.app di Chrome/Safari HP
2. Manifest.json terdeteksi → prompt "Add to Home Screen" (atau via InstallAppButton)
3. Install → icon RedWine di home screen
4. Buka PWA (standalone mode, no browser UI)
5. Service worker register:
   - CACHE_NAME=redwine-v16
   - Cache STATIC_ASSETS pada install
   - Skip cache untuk Supabase + Next chunks
   - Network-first HTML, cache-first static
6. NotifToggle klik ON:
   - Notification.requestPermission()
   - registration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })
   - UPSERT push_subscriptions { employee_id, endpoint, p256dh, auth }
7. Server kirim push → SW receive → self.registration.showNotification(title, {body, icon, badge, data})
8. User tap notif → SW clients.openWindow(data.url)
```

---

## 🧠 10. BUSINESS LOGIC KRITIS (dengan pointer file:line)

### `src/lib/workHours.ts` — Precedence per-employee schedule
```
Priority: schedule per-day > work_start/end custom > settings default

getEffectiveWorkHours(emp, settings): { start: string, end: string, off: boolean }
- Cek emp.schedule?.[dayKey] first (mon/tue/wed/thu/fri/sat/sun)
- Kalau ada dan .off=true → return { off: true }
- Fallback ke emp.work_start / emp.work_end
- Fallback lagi ke settings.work_start / settings.work_end
```
Dipakai di: `absen/page.tsx` (late detection), `admin/page.tsx` (stats), `pdfExport.ts` (report header).

### `src/lib/geo.ts` — GPS distance with accuracy tolerance
```
getDistanceFromLatLng(lat1, lng1, lat2, lng2) → meters (Haversine)
effectiveDist = max(0, distance - accuracy)  // tolerance
isOutsideRadius = effectiveDist > radius_meters
```
GPS accuracy bisa 10-100m tergantung HP. Tolerance mencegah false positive di sekitar radius edge.

### `src/lib/faceDetection.ts` — Fail-open pattern
```ts
export async function hasFace(dataUrl): Promise<boolean> {
  try {
    await loadModels();  // lazy load dari CDN
    // ... detect
    return detections.length > 0;
  } catch {
    console.error(...);
    return true;  // ← FAIL OPEN — jangan block kalau model gagal
  }
}
```
Deliberate choice: kalau CDN face-api model gagal load (koneksi buruk), tetap boleh submit. Trade-off reliability > strictness.

### `src/lib/pdfExport.ts:8` — Emoji sanitizer
```ts
function pdfSafe(s): string {
  // Strip emoji + pictograph + ZWJ + surrogates
  // jsPDF default font (Helvetica) hanya Latin-1
  // Tanpa ini → emoji render sebagai "Ø=Þ"
}
```
Applied ke semua user-input text (name, notes, reason, description).

### `src/app/tasks/page.tsx:889` — Column delete scope by board
```ts
// FIXED at commit 27f8914
if (firstCol && firstCol.key !== col.key) {
  let q = supabase.from("tasks").update({ status: firstCol.key }).eq("status", col.key);
  if (activeBoard?.id) q = q.eq("board_id", activeBoard.id);   // ← CRITICAL
  else q = q.is("board_id", null);
  await q;
}
```
Tanpa `.eq("board_id", ...)` — delete kolom "Today" di board A juga akan pindahin task "Today" di board B.

### `src/app/absen/page.tsx` — Submit guard
```tsx
<button disabled={loading || transitioning}>Kirim</button>
```
Tanpa `|| transitioning`, user bisa tap Kirim lagi selama 700ms overlay transition → duplicate attendance row.

### `src/app/absen/page.tsx:capturePhoto` — Photo size guard
```ts
let dataUrl = canvas.toDataURL("image/jpeg", 0.7);
if (dataUrl.length > 700_000) dataUrl = canvas.toDataURL("image/jpeg", 0.5);
if (dataUrl.length > 1_500_000) { setMessage({type:"error",text:"Foto terlalu besar..."}); return; }
```
Prevents Supabase storage quota exhaustion.

### `public/sw.js` — Cache strategy
```js
const CACHE_NAME = "redwine-v16";  // BUMP setiap major client change

// Skip Supabase + Next chunks:
if (url.hostname.includes("supabase.co")) return;
if (url.pathname.includes("/_next/static/chunks/")) { network-only; return; }

// Network-first HTML (bypass stale cache):
if (req.mode === "navigate") { networkFirst; return; }

// Cache-first static assets
```

### `src/app/api/push/send/route.ts` — Reliability
```ts
const results = await Promise.allSettled(subs.map(async (sub) => {
  try { await webpush.sendNotification(sub, payload); return { ok: true }; }
  catch (err) {
    if (err.statusCode === 404 || 410)  // Expired subscription
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    return { ok: false };
  }
}));
// Auto-cleanup invalid subs. Promise.allSettled biar 1 failure tidak gagalkan yang lain.
```

---

## 🎨 11. DESIGN SYSTEM

### Palette
```css
--primary: #8B1A1A;        /* Bordeaux (main brand) */
--primary-dark: #5A1010;   /* Darker bordeaux (hover, gradient bottom) */
```

Board bg gradient: `bg-gradient-to-br from-rose-50/40 via-white to-amber-50/20` (bordeaux-warm).

### Column colors (`COL_COLORS` in `tasks/page.tsx`)
`rose | amber | emerald | blue | purple | slate | pink | indigo | teal`

Setiap kolom punya:
- `bg-<color>-500` untuk badge + icon chip
- `from-<color>-50 to-white` untuk background tint
- `border-<color>-200/40` untuk border

### Task labels (`CARD_COLORS`)
`red (bg-rose-500) | yellow (bg-amber-400) | green (bg-emerald-500) | blue | purple | gray`

### Custom animations (`src/app/globals.css`)
```
animate-fade-in       (0.25s ease-out)
animate-slide-up      (0.3s ease-out, translateY 100% → 0)
animate-scale-in      (0.2s cubic-bezier, opacity + scale 0.96→1)
animate-stagger       (0.3s ease-out backwards)
animate-soft-pulse    (2s infinite, opacity)
animate-shimmer       (1.4s infinite, gradient bg-position)
animate-sheet-up      (0.3s cubic-bezier bottom sheet)
silhouette-dash       (3s linear infinite, stroke-dashoffset flow)
```

Semua respect `prefers-reduced-motion` (globals.css bawah).

### Typography
- Font family: Geist Sans (from Google, via `next/font`)
- UI bahasa Indonesia
- Weight: semibold untuk heading, bold untuk emphasis
- Tracking-tight untuk title, tracking-wider untuk uppercase caps

### iOS/Android PWA specific
```css
viewportFit: 'cover'                       /* layout.tsx — enable safe-area env() */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

---

## 🚀 12. DEPLOYMENT

### Vercel
- **Framework:** Next.js (auto-detect)
- **Build:** `next build` (default)
- **Node:** 20 (default)
- **Config:** ❌ No `vercel.json` — full defaults
- **Auto-deploy:** push ke `main` → Vercel webhook → build ~3-5 min

### Env vars (set semua 7 di Vercel Settings)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CSV_EXPORT_KEY
```

### Deploy flow
```
1. Local: git commit + git push origin main
2. GitHub webhook trigger Vercel
3. Vercel: git clone → npm install → next build → deploy
4. Live di https://absensiredwine.vercel.app dalam 3-5 menit
5. Kalau ada blank screen di HP → user perlu clear PWA cache
   → prevent dengan bump CACHE_NAME di public/sw.js
```

### Rollback
Vercel Dashboard → project → Deployments → pilih commit lama → **Promote to Production**

### Free tier limits
- 100 deploys/day
- 100 GB bandwidth/month
- Serverless function 10s max duration (Hobby)

---

## 📜 13. RECENT COMMIT HISTORY (rekap kronologis)

Baru → Lama:

| Commit | Perubahan |
|---|---|
| `cbef14a` | docs: full audit — CLAUDE.md + MIGRATION_NOTES.md |
| `79d6feb` | docs: HANDOFF.md untuk inter-session continuity |
| `256d663` | docs: SQL migration Thamrin City coords |
| `72c1f39` | fix(pdf): sanitize emoji + extended Unicode (`pdfSafe`) |
| `2cc99c9` | feat(admin): per-employee monthly PDF report |
| `3669ae2` | style(absen): wider shoulders silhouette + remove REC badge |
| `9e290ec` | feat(absen): full-frame silhouette + bordeaux transition |
| `27f8914` | fix: 3 audit findings (board scope, double-submit, photo size) |
| `12ca9a8` | feat(absen): selfie camera silhouette + premium flow |
| `714158b` | fix(sw): bump cache v9→v10 (mobile PWA blank screen) |
| `6a706f8` | fix: back button fallback ke /home kalau history empty |
| `96a7ed5` | perf(admin): useTransition + memoized work hours + lazy images |
| `7f5f7b6` | feat(tasks): full UI polish (6 preview sections) |
| `dbd0522` | feat(profile): editable bank account + auto-default reimburse |
| `a49580d` | feat(admin): bulk approve leaves + reimb + RLS hardening SQL |
| `e54b43f` | feat(admin): analytics + clock-out reminder push |
| `8c8ce4b` | feat(tasks): search + filter + skeleton loading |

Total ~60+ commits sepanjang project. Lihat `git log --oneline` untuk history lengkap.

---

## 🐛 14. KNOWN GOTCHAS + FIXES

| Symptom | Cause | Fix |
|---|---|---|
| Blank page setelah deploy | SW cache serve chunk JS lama | Bump `CACHE_NAME` di `public/sw.js` + user clear PWA cache |
| React Error #310 | Hook setelah early return | Pindahkan semua hooks ke atas `if (!user) return null` |
| Build gagal di Vercel tapi jalan lokal | TS strict di build lebih ketat | `npx tsc --noEmit -p .` lokal sebelum push |
| Realtime tidak update | Table belum enabled realtime | Supabase Dashboard → Database → Replication → toggle table |
| GPS selalu "di luar radius" | `office_lat/lng` di `settings` salah | `/admin` → Pengaturan → update, atau run `supabase-migration-update-office-location.sql` |
| Push notification tidak sampai | VAPID mismatch / permission denied / sub invalid / iOS not installed | Cek Vercel Function logs `/api/push/send` |
| PDF karakter aneh "Ø=Þ" | Emoji, jsPDF default font Latin-1 only | Sudah fix commit `72c1f39` — `pdfSafe()` |
| Duplicate attendance row | Double-tap submit selama transition | `disabled={loading \|\| transitioning}` |
| Board A delete kolom pengaruh board B | Missing `.eq('board_id', ...)` filter | Fix commit `27f8914` |
| Face detection tidak jalan | Model face-api gagal load dari CDN | Fail-open by design — user tetap boleh submit |

---

## 🎯 15. SETUP DARI NOL — STEP BY STEP

```bash
# 1. Clone
git clone https://github.com/Nicks1806/RWABSEN.git
cd RWABSEN/redwine-attendance

# 2. Install
npm install

# 3. Setup Supabase project
# Option A - New project:
#   Buat di https://supabase.com/dashboard/new
#   SQL Editor → paste semua migration files berurutan (schema → v2 → work-hours → ... → qr → update-office-location)
# Option B - Existing project:
#   Minta credentials dari owner

# 4. Storage bucket
# Supabase Dashboard → Storage → New Bucket:
#   Name: attendance-photos
#   Public: yes
#   File size limit: 5MB (optional)

# 5. Enable Realtime
# Dashboard → Database → Replication
# Toggle: board_messages, announcements, attendance, tasks, leaves

# 6. Generate VAPID keys (kalau belum ada)
npx web-push generate-vapid-keys

# 7. Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public>
VAPID_PRIVATE_KEY=<vapid private>
VAPID_SUBJECT=mailto:admin@redwineshoes.id
CSV_EXPORT_KEY=<any secret password>
EOF

# 8. Create admin user (via Supabase SQL Editor)
# INSERT INTO employees (name, pin, role, is_active, position)
# VALUES ('Admin', '1234', 'admin', true, 'Owner');

# 9. Dev server
npm run dev
# → http://localhost:3000

# 10. Test:
#     - Login pakai admin (nama + pin 1234)
#     - /admin → Pengaturan → set office lat/lng + radius
#     - /admin/qr → generate QR
#     - Test dari HP (butuh HTTPS, pakai Vercel preview atau ngrok)

# 11. Deploy ke Vercel
# vercel Dashboard → New Project → import from GitHub
# Set 7 env vars (step 7 di atas)
# Deploy
```

---

## 📌 16. YANG MASIH PENDING / NICE-TO-HAVE

- [ ] Custom domain `absensi.redwineshoes.id` (subdomain via CNAME → `cname.vercel-dns.com`)
- [ ] Calendar heatmap di `/riwayat`
- [ ] Dark mode toggle
- [ ] Toast notification system (replace `alert()`)
- [ ] Audit log table (siapa approve apa kapan)
- [ ] Keyboard shortcuts desktop (`N` new task, `/` search)
- [ ] Login page hero redesign
- [ ] Test suite (belum ada Jest/Vitest/Playwright)

---

## 💬 17. COMMUNICATION CONVENTIONS

- **User language:** Bahasa Indonesia (casual, friendly)
- **Code language:** English OK (comments, commit messages)
- **UI text:** ALWAYS Bahasa Indonesia
- **Commits:** conventional (`feat:`, `fix:`, `style:`, `perf:`, `docs:`, `chore:`)
- **Commit trailer:** `Co-Authored-By: Claude Opus X.X (1M context) <noreply@anthropic.com>` di-generate otomatis
- **Feedback "lag/berat"** → look for memoization + lazy load + useTransition opportunities
- **Feedback "perbagus ui nya"** → stay within existing design system, no big rebrand unless explicitly approved
- **Feedback "hilangkan X"** → straight up remove, no push-back needed
- **Feedback "tidak cocok"** → propose alternative, don't just retry

---

## 🚨 18. WHEN STUCK — DEBUGGING PLAYBOOK

1. **Cek `HANDOFF.md`** section Troubleshooting
2. **Vercel Function logs:** Dashboard → project → Deployments → latest → Function Logs
3. **Supabase logs:** Dashboard → Logs → filter by table/API
4. **PWA debugging:**
   - Desktop: Chrome DevTools → Application tab → Service Workers / Storage / Cache Storage
   - Mobile Android: `chrome://inspect#devices` USB debug
   - Mobile iOS: Safari → Develop menu → target device
5. **TypeScript errors:** `npx tsc --noEmit -p .`
6. **Cache issue:** Selalu `Ctrl+Shift+R` (hard reload) dulu sebelum debug
7. **Test push in production:** cek Function logs POST `/api/push/send` untuk lihat `sent`/`failed`

---

## 🎓 19. LEARNING PATH untuk Developer Baru

### Hari 1 (context)
- Baca file ini (`PROJECT_MASTER.md`) — 30 menit
- Baca `AGENTS.md` (3 baris)
- Skim `CLAUDE.md` bagian yang relevan
- Setup local dev + login berhasil

### Hari 2-3 (understand)
- Trace flow #1 (Clock In) di kode
- Baca semua `src/lib/*.ts` (11 files, total ~1000 baris)
- Baca `src/components/*.tsx`
- Understand `TaskDetailModal.tsx` + `Skeleton.tsx`

### Minggu 1 (contribute)
- Baca `src/app/absen/page.tsx` (1300 baris) — flow paling critical
- Baca `src/app/tasks/page.tsx` (2500 baris) — feature paling kompleks
- Baca `src/app/admin/page.tsx` (2900 baris) — biggest file, split candidate
- Pick 1 TODO ringan dari section 16 di atas

### Minggu 2+ (own)
- Deploy sendiri (dari feature branch)
- Monitor Vercel logs harian
- Update `PROJECT_MASTER.md` setiap architecture change

---

## 📖 20. CHEAT SHEET — Common Tasks

### Tambah field baru ke `employees`
1. Supabase SQL Editor: `ALTER TABLE employees ADD COLUMN new_field text;`
2. Update `src/lib/types.ts` interface `Employee`
3. Update UI di `/profile/page.tsx` (edit form)
4. Kalau perlu di admin: update `/admin/karyawan/[id]/page.tsx`
5. Kalau perlu di PDF: update `src/lib/pdfExport.ts`

### Tambah page baru
1. Buat `src/app/newpage/page.tsx`
2. Add ke BottomNav kalau perlu (`src/components/BottomNav.tsx`)
3. Protected: implement useEffect `getStoredEmployee` check
4. Kalau admin-only: check `emp.role === "admin"` sebelum render

### Tambah realtime channel
```tsx
useEffect(() => {
  if (!employee) return;
  const channel = supabase
    .channel(`my-channel-${employee.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "my_table" }, 
      (payload) => { /* debounced fetch */ })
    .subscribe();
  return () => { supabase.removeChannel(channel); };  // ← WAJIB cleanup
}, [employee]);
```

### Bump SW cache (setelah major change)
```js
// public/sw.js
const CACHE_NAME = "redwine-v16";  // → v17
```
Commit + push.

### Send push notification dari kode
```ts
await fetch("/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    employee_ids: [uuid1, uuid2],
    title: "Judul",
    body: "Pesan",
    url: "/absen"
  }),
});
```

### Add new column color ke Kanban
1. Add ke `COL_COLORS` object di `src/app/tasks/page.tsx`
2. Add ke `COL_BG` (background gradient) + `COL_HEADER_BORDER`
3. Add ke `COL_COLOR_KEYS` array

---

## ✅ 21. CHECKLIST HANDOFF SELESAI

Setelah developer/Claude baru selesai onboarding, harus bisa:

- [ ] Jalanin `npm run dev` tanpa error di local
- [ ] Login pakai admin, sampai `/admin`
- [ ] Test clock-in dari HP (perlu HTTPS — pakai Vercel preview)
- [ ] Test push notification di 1 device
- [ ] Trace 1 flow ujung-ke-ujung (misal Flow #1)
- [ ] Tahu di mana bump `CACHE_NAME` kalau ada blank screen
- [ ] Tahu bedanya `NEXT_PUBLIC_*` vs server-only env vars
- [ ] Tahu kenapa auth pakai PIN + localStorage (bukan Supabase Auth)
- [ ] Tahu 3 heavy libs yang harus lazy-loaded
- [ ] Tahu hooks-before-early-return rule

---

## 📞 22. CONTACT + LINKS

- **Repo:** https://github.com/Nicks1806/RWABSEN
- **Live:** https://absensiredwine.vercel.app
- **Owner GitHub:** `Nicks1806`
- **Brand:** RedWine Shoes & Bags, Thamrin City, Jakarta
- **Related SKU migration file:** `supabase-migration-update-office-location.sql` (coords: -6.195806, 106.816667)

---

_File ini adalah "single source of truth" untuk onboarding. Update setiap ada perubahan arsitektur major._

_Dibuat 20 April 2026 oleh Claude Code · Companion: `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `MIGRATION_NOTES.md`_
