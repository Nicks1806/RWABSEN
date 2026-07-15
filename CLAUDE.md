@AGENTS.md

# CLAUDE.md — Project Memory & Context

> File ini dibuat otomatis untuk keperluan migrasi Claude Code.
> Terakhir diperbarui: 20 April 2026
> Dibuat oleh: Claude Code (full project audit)
> Companion files: `HANDOFF.md` (extended notes), `MIGRATION_NOTES.md` (quick-start)

---

## 🎯 Project Overview

**Nama Project:** redwine-attendance
**Deskripsi:** Sistem absensi & manajemen karyawan **RedWine Shoes & Bags** (boutique premium di Thamrin City, Jakarta). PWA installable, dipakai harian oleh ~10-15 karyawan.
**Status:** Production (live at https://absensiredwine.vercel.app)
**Framework Utama:** Next.js 16.2.3 (App Router + Turbopack)
**Language:** TypeScript (strict mode)
**Node Version:** Compatible dengan Next.js 16 (Node 18.18+, recommended 20+)
**Primary Brand Color:** `#8B1A1A` (Bordeaux)

---

## 🏗️ Tech Stack Lengkap

### Frontend
- **Next.js 16.2.3** (App Router, Turbopack)
- **React 19.2.4** + React DOM
- **TypeScript** ^5 (strict)
- **Tailwind CSS v4** (+ @tailwindcss/postcss)
- **Lucide React** icons (^1.8.0)
- **date-fns** ^4.1.0 (dengan locale `id`)
- **@dnd-kit** (core, sortable, utilities) untuk Task Board drag & drop

### Backend / API
- **Next.js API Routes** (`src/app/api/`)
- **Supabase JS Client** ^2.103.0 (client + server)
- **web-push** ^3.6.7 (VAPID push notifications)

### Database & Storage
- **Supabase PostgreSQL** (12 tables, RLS enabled)
- **Supabase Storage** — bucket `attendance-photos` (selfies + task/reimbursement attachments)
- **Supabase Realtime** — channels untuk task board chat, announcements, attendance updates

### Deployment & Infrastructure
- **Vercel** (auto-deploy dari GitHub `main` branch)
- **PWA** — service worker (`public/sw.js`), manifest, VAPID push
- Free tier: 100 deploys/day limit

### Testing
- ❌ Belum ada test framework (no Jest/Vitest/Playwright)

### Key Libraries (heavy, lazy-loaded)
- `jspdf` ^4.2.1 + `jspdf-autotable` ^5.0.7 — PDF export (~500KB)
- `xlsx` ^0.18.5 — Excel export
- `jsqr` ^1.4.0 — QR scan saat clock-in
- `qrcode` ^1.5.4 — QR generation (admin)
- `recharts` ^3.8.1 — Charts di Admin Analytics (~400KB)
- `@vladmandic/face-api` ^1.7.15 — Face detection

---

## 📁 Struktur Folder Project

```
redwine-attendance/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # / Login (PIN)
│   │   ├── layout.tsx                  # Root layout + viewport
│   │   ├── globals.css                 # Tailwind + animations
│   │   ├── absen/page.tsx              # /absen Clock in/out
│   │   ├── admin/
│   │   │   ├── page.tsx                # /admin (5 tabs)
│   │   │   ├── karyawan/[id]/page.tsx  # /admin/karyawan/[id]
│   │   │   ├── pengumuman/page.tsx     # /admin/pengumuman
│   │   │   └── qr/page.tsx             # /admin/qr
│   │   ├── api/
│   │   │   ├── push/send/route.ts      # POST web push
│   │   │   └── attendance-csv/route.ts # GET CSV (Google Sheets)
│   │   ├── home/page.tsx               # /home
│   │   ├── inbox/page.tsx              # /inbox
│   │   ├── pegawai/page.tsx            # /pegawai
│   │   ├── pengajuan/page.tsx          # /pengajuan
│   │   ├── profile/page.tsx            # /profile
│   │   ├── riwayat/page.tsx            # /riwayat
│   │   └── tasks/
│   │       ├── layout.tsx              # force-dynamic
│   │       └── page.tsx                # /tasks Kanban
│   ├── components/
│   │   ├── Avatar.tsx                  # Lazy-load photo w/ initial
│   │   ├── BottomNav.tsx               # Mobile nav
│   │   ├── InstallAppButton.tsx        # PWA install prompt
│   │   ├── Logo.tsx
│   │   ├── NotifToggle.tsx
│   │   ├── PWARegister.tsx             # SW registration
│   │   ├── Skeleton.tsx                # Loading skeletons
│   │   └── TaskDetailModal.tsx         # Task detail modal
│   └── lib/
│       ├── auth.ts                     # localStorage session
│       ├── debounce.ts                 # Debounce util
│       ├── faceDetection.ts            # Lazy face-api wrapper
│       ├── geo.ts                      # GPS distance
│       ├── pdfExport.ts                # jsPDF exporters
│       ├── permissions.ts              # canAccessBoard, canManageBoards
│       ├── positions.ts                # Positions list + colors
│       ├── push.ts                     # Push subscription client
│       ├── supabase.ts                 # Supabase singleton
│       ├── types.ts                    # ALL TypeScript interfaces
│       └── workHours.ts                # Per-employee work hours
├── public/
│   ├── sw.js                           # Service worker (v16)
│   ├── manifest.json                   # PWA manifest
│   ├── icon.png / apple-icon.png       # PWA icons
│   ├── logo.png
│   └── design-preview.html             # Static design mockup
├── supabase-schema.sql                 # Main schema
├── supabase-migration-*.sql            # 14 migration files
├── AGENTS.md                           # Next.js 16 warning
├── CLAUDE.md                           # This file
├── HANDOFF.md                          # Extended handoff
├── MIGRATION_NOTES.md                  # Quick-start migration
├── README.md
├── package.json
├── tsconfig.json                       # Path alias @/* → ./src/*
├── next.config.ts                      # (empty config)
└── eslint.config.mjs                   # Flat config
```

---

## 🌍 Environment Variables

### Cara Setup
1. Buat file `.env.local` di root (gitignored)
2. Untuk Vercel: Settings → Environment Variables → paste values
3. Restart dev server setelah edit

### Semua Variables

```env
# ── SUPABASE ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=[SECRET - ISI MANUAL]
# Format: https://<project-ref>.supabase.co
# Dashboard → Settings → API → Project URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=[SECRET - ISI MANUAL]
# Dashboard → Settings → API → anon public

SUPABASE_SERVICE_KEY=[SECRET - ISI MANUAL]
# ⚠️ SERVER-ONLY, jangan pakai prefix NEXT_PUBLIC_
# Dashboard → Settings → API → service_role
# Dipakai untuk bypass RLS di /api/push/send, /api/attendance-csv

# ── WEB PUSH (VAPID) ──────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[SECRET - ISI MANUAL]
VAPID_PRIVATE_KEY=[SECRET - ISI MANUAL]
VAPID_SUBJECT=mailto:admin@redwineshoes.id
# Generate: npx web-push generate-vapid-keys

# ── CSV EXPORT ────────────────────────────
CSV_EXPORT_KEY=[SECRET - ISI MANUAL]
# Password bebas untuk endpoint /api/attendance-csv
# Contoh: rw_csv_9x8y7z2024
```

### Catatan per Variable

| Variable | Digunakan di | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts`, semua API routes | URL Supabase (publik) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | Public anon key untuk browser |
| `SUPABASE_SERVICE_KEY` | `api/push/send/route.ts`, `api/attendance-csv/route.ts` | Server-only, bypass RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `src/lib/push.ts`, `api/push/send/route.ts` | Publik untuk browser subscribe |
| `VAPID_PRIVATE_KEY` | `api/push/send/route.ts` | Server-only, sign push messages |
| `VAPID_SUBJECT` | `api/push/send/route.ts` | `mailto:` atau `https://` — kontak VAPID |
| `CSV_EXPORT_KEY` | `api/attendance-csv/route.ts` | Password endpoint CSV public |

---

## 🗄️ Database Schema (Supabase PostgreSQL)

### Overview Tables

| Nama Table | Deskripsi | Relasi Utama |
|---|---|---|
| `employees` | Karyawan (PIN, role, foto, jadwal, kontak) | Parent semua tabel lain |
| `attendance` | Log clock-in / clock-out harian | FK → employees |
| `leaves` | Cuti/sakit/izin | FK → employees, reviewed_by → employees |
| `reimbursements` | Reimbursement claims | FK → employees, reviewed_by → employees |
| `announcements` | Pengumuman dari admin | FK → employees (created_by) |
| `settings` | Config kantor (GPS, radius, jam kerja) | Single-row config |
| `tasks` | Kanban cards | FK → boards, employees (assignees[]) |
| `boards` | Multi-board Task Board | FK → employees (created_by) |
| `board_columns` | Kolom dinamis per board | FK → boards |
| `board_messages` | Chat per-board | FK → boards, employees (sender_id) |
| `push_subscriptions` | Web Push subscriptions | FK → employees |
| `qr_tokens` | QR permanen untuk clock-in | Standalone |

### Schema Detail (ringkas)

**Table: `employees`**
```sql
id uuid PK
name text
pin text                     -- 4-6 digit
role text                    -- 'employee' | 'admin'
is_active boolean DEFAULT true
work_start / work_end text   -- '09:00' format
schedule jsonb               -- {mon: {start, end, off}, tue: ...}
phone / email / address text
position text                -- 'Sales', 'Kasir', 'Direktur', dll
photo_url text
join_date date
bank_account text            -- 'BCA 1234567890 a/n Nama'
created_at timestamptz
```

**Table: `attendance`**
```sql
id uuid PK
employee_id uuid FK
date date                    -- UNIQUE(employee_id, date)
clock_in / clock_out timestamptz
clock_in_photo / clock_out_photo text
clock_in_lat/lng, clock_out_lat/lng float
status text                  -- 'present'|'late'|'early_leave'|'absent'
notes text
```

**Table: `settings`** (single-row)
```sql
id uuid PK
office_lat / office_lng float  -- Thamrin City: -6.195806, 106.816667
radius_meters int              -- Default 100
work_start / work_end text
work_days text[]               -- ['mon','tue',...]
qr_required boolean
updated_at timestamptz
```

**Table: `leaves`**
```sql
id uuid PK, employee_id uuid FK
leave_type text          -- 'cuti'|'sakit'|'izin'
start_date, end_date date
reason text, attachment_url text
status text              -- 'pending'|'approved'|'rejected'
admin_notes text
reviewed_by uuid FK, reviewed_at timestamptz
```

**Table: `reimbursements`**
```sql
id uuid PK, employee_id uuid FK
category text            -- 'umum'|'transport'|'makanan'|'medis'|'lainnya'
transaction_date date
amount int               -- Rupiah
description text, attachment_url text, bank_account text
status text, admin_notes text
reviewed_by uuid FK, reviewed_at timestamptz
```

**Table: `tasks`**
```sql
id uuid PK, board_id uuid FK (nullable)
title text, description text
status text                  -- kolom key (brief/today/done/history atau custom)
color text                   -- legacy single label
labels text[]                -- multi-label
assignee_id uuid FK (legacy), assignees text[]
created_by uuid FK
due_date date, position int
checklist jsonb[]            -- [{id, text, done}]
comments jsonb[]             -- [{id, text, by, at}]
attachments jsonb[]          -- [{id, type, url, name}]
cover_url text
created_at / updated_at timestamptz
```

**Table: `boards`**
```sql
id uuid PK
name text, description text, color text, cover_url text
allowed_roles text[]         -- ['Sales', ...] atau null=semua
created_by uuid FK
created_at timestamptz
```

**Table: `board_columns`**
```sql
id uuid PK, board_id uuid FK (nullable = default)
key text, label text, description text
color text                   -- COL_COLORS key
position int, is_default boolean
```

**Table: `board_messages`**
```sql
id uuid PK, board_id uuid FK (nullable = general)
sender_id uuid FK, sender_name text (cached)
text text, image_url text
reply_to_id/text/sender text (cached)
created_at timestamptz
```

**Table: `announcements`**
```sql
id uuid PK
title text, body text
priority text            -- 'normal'|'important'|'urgent'
is_active boolean
start_date, end_date date (nullable)
created_by uuid FK
created_at / updated_at timestamptz
```

**Table: `push_subscriptions`**
```sql
id uuid PK, employee_id uuid FK
endpoint text UNIQUE, p256dh text, auth text
```

**Table: `qr_tokens`**
```sql
id uuid PK
token text UNIQUE
created_at / expires_at timestamptz  -- +10y = praktis permanen
```

### RLS Policies

**Default:** Semua tabel RLS-enabled dengan policy `USING (true)` (fully open).

**Alasan:** Auth via PIN + localStorage tidak bisa carry JWT claims → server-level user scoping tidak mungkin tanpa refactor besar. Semua guard di client-side.

**Hardening (opsional):** Jalankan `supabase-migration-rls-hardening.sql`:
- `settings` read-only dari client
- `employees` no DELETE dari client
- `attendance` INSERT hanya `CURRENT_DATE`
- `leaves`/`reimbursements` DELETE hanya `status='pending'`
- `board_messages` DELETE hanya <5 menit sejak dikirim

### Storage Buckets

| Bucket | Public/Private | Digunakan untuk |
|---|---|---|
| `attendance-photos` | Public read | Foto selfie clock-in/out + task attachments + reimbursement receipts (folder-based) |

### Edge Functions

❌ Tidak ada Supabase Edge Functions. Semua server logic di Next.js API Routes.

### Migration Files (di root project)

1. `supabase-schema.sql` — main schema
2. `supabase-migration-v2.sql` — early additions
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
13. `supabase-migration-rls-hardening.sql` (OPTIONAL)
14. `supabase-migration-update-office-location.sql` (Thamrin City coords)

**Run order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → (opsional) 13 → 14

---

## 🔐 Authentication System

**Provider:** Custom PIN-based via localStorage. **BUKAN Supabase Auth.**

### Auth Flow

1. User buka `/` → input Name + PIN
2. Client query `employees` where `name` + `pin` + `is_active=true`
3. Match → `storeEmployee(data)` (localStorage key `redwine_employee`)
4. Protected page mount → `getStoredEmployee()` baca localStorage
5. Null/wrong role → `router.push("/")`

### Protected Routes

**Auth required:** `/home`, `/absen`, `/tasks`, `/pegawai`, `/pengajuan`, `/inbox`, `/profile`, `/riwayat`, `/admin`, `/admin/*`
**Admin-only:** `/admin`, `/admin/karyawan/[id]`, `/admin/pengumuman`, `/admin/qr`
**Public:** `/` (login)

**Board access:** `canAccessBoard(user, board)` — check `board.allowed_roles` vs `emp.position`. Case-insensitive substring match. Admin/Founder/CEO/GM/Direktur always allowed.
**Board management:** `canManageBoards(user)` — hanya Founder/CEO/Direktur/GM/Admin.

### Auth Files

- `src/lib/auth.ts` — `getStoredEmployee`, `storeEmployee`, `clearEmployee`
- `src/lib/permissions.ts` — permission helpers
- ❌ No `middleware.ts` (auth checks di masing-masing page useEffect)

**Implikasi:** Server tidak bisa verifikasi user dari request. Semua admin guard di client. Untuk DB-level hardening → apply `supabase-migration-rls-hardening.sql`.

---

## 🛣️ Semua Routes & API Endpoints

### Page Routes

| Route | File | Deskripsi | Auth |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Login PIN | Public |
| `/home` | `src/app/home/page.tsx` | Employee dashboard | Any |
| `/absen` | `src/app/absen/page.tsx` | Clock in/out (camera + GPS + face detect) | Any |
| `/tasks` | `src/app/tasks/page.tsx` | Kanban board multi-board | Any |
| `/pegawai` | `src/app/pegawai/page.tsx` | Employee directory | Any |
| `/pengajuan` | `src/app/pengajuan/page.tsx` | Leave + reimburse submit | Any |
| `/inbox` | `src/app/inbox/page.tsx` | Notifications | Any |
| `/profile` | `src/app/profile/page.tsx` | Profile + PIN change + bank | Any |
| `/riwayat` | `src/app/riwayat/page.tsx` | Attendance history + monthly stats | Any |
| `/admin` | `src/app/admin/page.tsx` | 5 tabs (Dashboard/Analitik/Izin/Karyawan/Pengaturan) | Admin |
| `/admin/karyawan/[id]` | `src/app/admin/karyawan/[id]/page.tsx` | Employee detail full history | Admin |
| `/admin/pengumuman` | `src/app/admin/pengumuman/page.tsx` | Announcement CRUD | Admin |
| `/admin/qr` | `src/app/admin/qr/page.tsx` | Permanent QR generator (10y validity) | Admin |

### API Endpoints

| Method | Endpoint | File | Fungsi | Auth |
|---|---|---|---|---|
| POST | `/api/push/send` | `src/app/api/push/send/route.ts` | Kirim web push ke 1 atau banyak karyawan; auto-prune 404/410 subs | Server VAPID |
| GET | `/api/attendance-csv?month=YYYY-MM&key=SECRET` | `src/app/api/attendance-csv/route.ts` | CSV attendance untuk Google Sheets IMPORTDATA | `CSV_EXPORT_KEY` |

---

## 🔌 Third-Party Integrations

### Supabase (Primary Backend)
- **Library:** `@supabase/supabase-js` ^2.103.0
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- **Config file:** `src/lib/supabase.ts`
- **Digunakan di:** semua page + API routes
- **Realtime:** channels di `/tasks` (board_messages), `/home` (announcements), `/admin` (attendance)

### Web Push (VAPID)
- **Library:** `web-push` ^3.6.7 (server) + native `PushSubscription` API (client)
- **Env vars:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- **Config:** `src/lib/push.ts` (client), `src/app/api/push/send/route.ts` (server)
- **Fungsi:** Notif clock-out reminder, task assignment, leave approval, announcement

### Face Detection
- **Library:** `@vladmandic/face-api` ^1.7.15
- **Env vars:** ❌ tidak butuh
- **Config:** `src/lib/faceDetection.ts` (lazy-loaded models dari CDN)
- **Fungsi:** Validasi ada wajah sebelum clock-in submit. **Fail-open** kalau model gagal load.

### QR (Scan + Generate)
- **Libraries:** `jsqr` ^1.4.0 (scan), `qrcode` ^1.5.4 (generate)
- **Digunakan di:** `/absen` (scan), `/admin/qr` (generate)

### PDF Export
- **Libraries:** `jspdf` + `jspdf-autotable`
- **Config:** `src/lib/pdfExport.ts` (lazy-loaded)
- **Fungsi:** `exportMonthlyPDF()` (all-employees) + `exportEmployeeMonthlyReport()` (per-employee komprehensif)

### Excel Export
- **Library:** `xlsx` ^0.18.5
- **Digunakan di:** `/admin` Dashboard tab

### Charts
- **Library:** `recharts` ^3.8.1
- **Digunakan di:** `/admin` Analytics tab (lazy-loaded)

### Drag & Drop
- **Library:** `@dnd-kit` (core, sortable, utilities)
- **Digunakan di:** `/tasks` desktop only
- **Kritis:** JANGAN dua `DndContext` bersamaan → hooks conflict crash

### Date Handling
- **Library:** `date-fns` ^4.1.0 + `date-fns/locale/id`

### Icons
- **Library:** `lucide-react` ^1.8.0

---

## ⚙️ Vercel Configuration

- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `next build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)
- **Node Version:** default Vercel (Node 20)
- **Config file:** ❌ **tidak ada** `vercel.json`

### Vercel Functions

| Endpoint | Runtime | Max Duration |
|---|---|---|
| `/api/push/send` | Serverless (Node) | 10s (Hobby default) |
| `/api/attendance-csv` | Serverless (Node) | 10s |

### Rewrites & Redirects

❌ Tidak ada custom rewrites (no `vercel.json`).

**Custom domain plan:** Subdomain (`absensi.redwineshoes.id`) via CNAME → `cname.vercel-dns.com`, tambah domain di Vercel Dashboard.

---

## 🔄 GitHub & Deployment Pipeline

- **Repository:** https://github.com/Nicks1806/RWABSEN
- **Default Branch:** `main`
- **Branch Strategy:** direct-to-main (small team). Feature besar bisa branch + PR.

### GitHub Actions

❌ **Belum ada** GitHub Actions. Deploy 100% via Vercel webhook.

### Deployment Flow

1. Push ke `main` → GitHub webhook → Vercel build
2. Vercel: `npm install` → `next build` → deploy
3. Build ~3-5 menit
4. Production URL: `https://absensiredwine.vercel.app`

### Rollback

Vercel Dashboard → Deployments → pilih deployment lama → **Promote to Production**

---

## 🧠 Business Logic Kritis

### Clock In/Out Flow (`src/app/absen/page.tsx`, ~1200 baris)
- Selfie + GPS radius check + face detection + optional QR + 1×/day cap
- Aspect ratio `3:4` camera dengan silhouette overlay
- Auto-redirect ke `/home` setelah submit (700ms bordeaux transition)
- Guard double-submit: `disabled={loading || transitioning}`
- GPS accuracy tolerance: `effectiveDist = max(0, distance - accuracy)`
- Photo size guard: re-encode quality 0.5 kalau >700KB, reject kalau >1.5MB
- Face detection **fail-open** (kalau CDN model gagal, tetap boleh submit)

### Work Hours per Employee (`src/lib/workHours.ts`)
- `getEffectiveWorkHours(emp, settings)` → `{start, end, off}`
- Precedence: schedule per-day > work_start/end custom > settings default
- `off: true` = hari libur karyawan itu

### Permission System (`src/lib/permissions.ts`)
- `canAccessBoard(user, board)` — position matching case-insensitive substring
- `canManageBoards(user)` — Founder/CEO/GM/Direktur/Admin only

### Task Board Delete Column (`src/app/tasks/page.tsx:889`)
- MUST scope by `board_id` — kalau tidak, tasks di board lain ikut ter-update
- Fixed at commit `27f8914`

### PDF Emoji Sanitization (`src/lib/pdfExport.ts`)
- `pdfSafe(text)` strip emoji + extended Unicode
- jsPDF default font hanya support Latin-1

### Service Worker Cache (`public/sw.js`)
- Network-first HTML, cache-first static, SKIP Supabase + Next chunks
- Bump `CACHE_NAME` setiap client code change signifikan (currently `redwine-v16`)

### Push Notification Reliability (`src/app/api/push/send/route.ts`)
- `Promise.allSettled` biar 1 failure tidak gagalkan yang lain
- Auto-DELETE subs yang return 404/410

---

## ⚠️ TODOs, FIXMEs & Catatan Penting

**Grep hasil (`TODO|FIXME|HACK|XXX`) di `src/`:** ❌ tidak ada comment eksplisit.

**Pending features (dari HANDOFF.md):**
- Custom domain mount (recommend subdomain)
- Calendar heatmap di `/riwayat`
- Dark mode toggle
- Toast notification (replace `alert()`)
- Audit log table
- Keyboard shortcuts desktop
- Login page hero redesign

**Pre-existing lint warnings (not blocking):**
- 7× `react-hooks/set-state-in-effect` di `setEmployee(emp)` pattern. Bisa refactor ke `useState(() => getStoredEmployee())` lazy initializer.

---

## 🚀 Setup Project dari Nol

```bash
# 1. Clone
git clone https://github.com/Nicks1806/RWABSEN.git
cd RWABSEN/redwine-attendance

# 2. Install
npm install

# 3. Env
# Buat .env.local, isi semua vars di section "Environment Variables"

# 4. Generate VAPID (kalau belum punya)
npx web-push generate-vapid-keys

# 5. Setup Supabase database
# Dashboard → SQL Editor → jalankan supabase-*.sql secara berurutan

# 6. Buat admin user pertama
# INSERT INTO employees (name, pin, role, is_active)
# VALUES ('Admin', '1234', 'admin', true);

# 7. Setup Storage Bucket
# Dashboard → Storage → New bucket "attendance-photos" (public read)

# 8. Enable Realtime
# Dashboard → Database → Replication → toggle:
# board_messages, announcements, attendance, leaves, tasks

# 9. Update office location
# /admin → Pengaturan (setelah login), atau
# jalankan supabase-migration-update-office-location.sql

# 10. Dev server
npm run dev
# http://localhost:3000

# 11. Test PWA + push (butuh HTTPS)
# Deploy ke Vercel atau ngrok
```

---

## 📝 Konvensi & Coding Style

### Naming
- **Components:** `PascalCase` (`TaskCard.tsx`)
- **Libs:** `camelCase` (`workHours.ts`)
- **Route folders:** `kebab-case` (`admin/karyawan/`)
- **Functions:** `camelCase` (`getEffectiveWorkHours`)
- **Constants:** `UPPER_SNAKE_CASE` (`CACHE_NAME`, `COL_COLORS`)
- **Database:** `snake_case` (`employee_id`, `clock_in_photo`)

### Language
- **Semua UI text dalam Bahasa Indonesia**
- Code comments + commit messages boleh Inggris
- User-facing errors dalam Bahasa Indonesia

### Component Structure
- Function component + `export default`
- Semua hooks di atas early return (`if (!user) return null`)
- State grouped by feature dengan comment separator

### Import Order (loose)
1. External libs (react, next, date-fns)
2. UI libs (lucide-react)
3. Local (`@/lib/*`, `@/components/*`)
4. Types (`@/lib/types`)

### State Management
- `useState` + `useMemo` + `useEffect` untuk local state
- `localStorage` untuk session
- Supabase Realtime untuk cross-user updates
- ❌ TIDAK pakai Zustand/Redux/Context

### Performance Rules
- Lazy-load heavy libs via `next/dynamic` atau `await import()`
- BottomNav pakai `<Link prefetch>` + `router.prefetch()` on mount
- Debounce realtime callbacks 500ms
- `useMemo` untuk expensive maps
- `useTransition` untuk tab switches yang mahal

---

## 🗺️ User Flow Utama

### Flow 1: Employee Clock In
1. Karyawan buka PWA → `/` login (Name + PIN)
2. `/home` → klik "Clock In" card → `/absen`
3. GPS auto-fetch → hitung jarak ke `office_lat/lng`
4. (Optional) Scan QR (kalau `settings.qr_required = true`)
5. Klik "Ambil Foto Selfie" → camera + silhouette overlay
6. Capture → face detection check
7. Isi catatan (wajib kalau di luar radius) → "Kirim"
8. Photo upload ke Supabase Storage `attendance-photos/{employee_id}/`
9. INSERT ke `attendance`
10. Bordeaux transition 700ms → auto-redirect `/home`

### Flow 2: Task Creation (Manager)
1. Buka `/tasks` → pilih board
2. Klik "Tambah task" di kolom manapun
3. Inline form: title, desc, assignees, deadline, upload gambar
4. Submit → INSERT ke `tasks` (dengan `assignees[]` + `board_id`)
5. `notifyBoardMembers()` → POST `/api/push/send`
6. Realtime channel → users lain lihat card langsung

### Flow 3: Leave Approval Bulk (Admin)
1. `/admin` → tab "Izin"
2. Filter "Menunggu" → bulk action bar muncul
3. "Pilih semua" → checkbox all
4. "Setujui semua" → confirm
5. Loop UPDATE `leaves` status='approved' + push notif per-employee

### Flow 4: Download Laporan PDF per-Karyawan
1. Admin `/admin` → tab "Karyawan"
2. Pastikan bulan di header
3. Klik tombol download hijau
4. Fetch leaves + reimbursements untuk karyawan+bulan
5. Lazy-load jspdf → generate PDF komprehensif
6. Download `Laporan_<Name>_2026-04.pdf`

### Flow 5: PWA Install (HP)
1. Buka `https://absensiredwine.vercel.app` di Chrome/Safari HP
2. Prompt "Add to Home Screen"
3. Icon RedWine muncul di home screen
4. Tap → PWA full-screen mode
5. SW install → cache static

---

## 📦 Scripts yang Tersedia

```bash
npm run dev        # Development server (Turbopack)
npm run build      # Production build
npm run start      # Production server (setelah build)
npm run lint       # ESLint
```

**Tidak ada:**
- ❌ `test` (belum ada test suite)
- ❌ `type-check` (manual: `npx tsc --noEmit -p .`)

---

## 🔧 Troubleshooting Umum

### "Failed to load chunk" / blank page setelah deploy
- **Penyebab:** SW cache serve chunk JS lama yang sudah tidak ada.
- **Solusi:** Bump `CACHE_NAME` di `public/sw.js`. User clear PWA cache di HP.

### React Error #310 "Rendered more hooks..."
- **Penyebab:** Hook dipanggil SETELAH early return.
- **Solusi:** Pindahkan semua hooks ke atas `if (!user) return null`.

### Build gagal di Vercel tapi jalan lokal
- **Penyebab:** TS strict di build lebih ketat.
- **Solusi:** Jalankan `npx tsc --noEmit -p .` lokal sebelum push.

### Realtime tidak update
- **Penyebab:** Table belum enabled realtime di Supabase.
- **Solusi:** Dashboard → Database → Replication → enable per-tabel.

### GPS selalu "di luar radius"
- **Penyebab:** `office_lat/lng` di `settings` salah atau `radius_meters` terlalu kecil.
- **Solusi:** `/admin` → Pengaturan → update. Atau run `supabase-migration-update-office-location.sql`.

### Push notification tidak sampai
- **Penyebab:** VAPID keys mismatch, permission denied, subscription invalid, iOS belum install PWA
- **Solusi:** Cek Vercel Function logs `/api/push/send`.

### PDF muncul karakter aneh "Ø=Þ"
- **Penyebab:** User input ada emoji, jsPDF default font Latin-1 only.
- **Solusi:** Sudah fixed dengan `pdfSafe()` (commit `72c1f39`).

---

## 📋 Checklist Migrasi

Setelah baca file ini, pastikan sudah:

- [ ] Clone repo `Nicks1806/RWABSEN`
- [ ] Install dependencies (`npm install`)
- [ ] Buat/akses Supabase project
- [ ] Copy env vars ke `.env.local`
- [ ] Generate VAPID keys (kalau belum punya)
- [ ] Jalankan semua migration SQL berurutan
- [ ] Buat storage bucket `attendance-photos` (public read)
- [ ] Enable realtime pada tables (board_messages, announcements, attendance, tasks, leaves)
- [ ] Buat admin user pertama via SQL INSERT
- [ ] Set office_lat/lng (Thamrin City: `-6.195806, 106.816667`)
- [ ] Set `radius_meters` (recommended 100m)
- [ ] Deploy ke Vercel dengan env vars set
- [ ] Test PWA install + push notification di physical device
- [ ] Print QR code dari `/admin/qr` untuk pasang di kantor

---

_File ini dibuat otomatis oleh Claude Code. Update file ini setiap kali ada perubahan besar pada arsitektur project._

**Companion files:**
- `AGENTS.md` — warning tentang Next.js 16
- `HANDOFF.md` — extended context + design decisions
- `MIGRATION_NOTES.md` — quick-start migration guide
- `README.md` — public-facing intro
