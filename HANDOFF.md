# RedWine Attendance — Project Handoff

> Comprehensive handoff for continuing development in another Claude Code session.
> Read this end-to-end before making changes. Last updated: April 2026.

---

## 1. PROJECT OVERVIEW

**App:** RedWine Attendance — Employee management PWA for **RedWine Shoes & Bags** (boutique store at Thamrin City, Jakarta)

**Users:** ~10-15 employees daily (small team, mobile-first)

**Production URL:** https://absensiredwine.vercel.app
**Repo:** https://github.com/Nicks1806/RWABSEN
**Local path:** `C:\Penyimpanan utama\Downloads\absen rw\redwine-attendance`

**Stack:**
- **Framework**: Next.js 16 (App Router + Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase PostgreSQL
- **Auth**: Custom PIN-based via localStorage (NOT Supabase Auth)
- **Storage**: Supabase Storage (employee photos, attachments)
- **Realtime**: Supabase Realtime channels
- **Hosting**: Vercel (auto-deploy from `main`)
- **PWA**: Service Worker + Web Push notifications (VAPID)

**Brand:**
- Primary color: `#8B1A1A` (bordeaux/wine red)
- Primary-dark: `#5A1010`
- Logo: `/public/logo.png`
- Tagline: "Matched in Elegance"

---

## 2. KEY GUARDRAILS (read first)

### ⚠️ Next.js 16 quirks
- This is **NOT** the Next.js you might know from training data — file structure and APIs differ. Read `node_modules/next/dist/docs/` before writing new patterns.
- `viewport` config goes in `export const viewport: Viewport` (not metadata).
- `force-dynamic` layout is used in `/tasks` to bypass Vercel edge cache.

### ⚠️ Hooks rules (HARD RULE)
- All `useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`/`useTransition` **MUST** be called BEFORE any `if (!user) return null` early return.
- Violating this crashes with React Error #310 ("Rendered more hooks than during the previous render").

### ⚠️ Lazy imports for heavy libs
- `recharts` (~400KB) — lazy via `next/dynamic` (admin Analytics tab)
- `jspdf` + `jspdf-autotable` — lazy via `await import("@/lib/pdfExport")`
- `xlsx` — lazy when export Excel
- `@vladmandic/face-api` — lazy in `src/lib/faceDetection.ts`
- DO NOT add these to top-level imports.

### ⚠️ Mobile-first
- Test minimum at 375px width (iPhone SE).
- UI text in **Bahasa Indonesia** (NOT English).
- iOS PWA quirks: `playsinline` + `muted` required for `<video>` autoplay.

### ⚠️ Drag-and-drop
- `/tasks` desktop uses `@dnd-kit/sortable` for cards
- Mobile uses tab-view (NO @dnd-kit) — two DndContext simultaneously crashes
- `isMobile` state must be set BEFORE early returns

### ⚠️ Vercel deploy limits
- Free tier: 100 deployments/day
- Service worker cache: bump `CACHE_NAME` in `public/sw.js` when chunks change (e.g., `redwine-v16` → `v17`)
- Edge cache stale → use `force-dynamic` layout

---

## 3. ARCHITECTURE

### Pages (App Router)
```
src/app/
├── page.tsx                    # / Login (PIN-based)
├── home/page.tsx               # /home Employee dashboard
├── absen/page.tsx              # /absen Clock in/out (camera + GPS + face detect)
├── tasks/page.tsx              # /tasks Kanban board (multi-board, chat)
├── admin/page.tsx              # /admin Admin dashboard (5 tabs)
├── admin/karyawan/[id]/page.tsx# /admin/karyawan/[id] Employee detail
├── admin/qr/page.tsx           # /admin/qr Permanent QR code generator
├── admin/pengumuman/page.tsx   # /admin/pengumuman Announcements CRUD
├── pegawai/page.tsx            # /pegawai Employee directory
├── pengajuan/page.tsx          # /pengajuan Leave + reimbursement
├── inbox/page.tsx              # /inbox Notifications
├── profile/page.tsx            # /profile Profile + change PIN + bank account
├── riwayat/page.tsx            # /riwayat Attendance history
└── api/push/send/route.ts      # POST /api/push/send (server-side push)
```

### Components
```
src/components/
├── Avatar.tsx           # Lazy-loaded employee photo with fallback initial
├── BottomNav.tsx        # Mobile bottom navigation (prefetch-aware)
├── Logo.tsx             # RedWine logo with size variants
├── NotifToggle.tsx      # Push subscription toggle
├── PWARegister.tsx      # Service worker registration on mount
├── Skeleton.tsx         # Loading skeletons (Skeleton, SkeletonBoard, SkeletonCard, etc.)
├── TaskDetailModal.tsx  # Full task detail modal (assignees, checklist, comments, attachments)
└── PrefetchOnHover.tsx  # (if exists) hover-triggered prefetching
```

### Libraries
```
src/lib/
├── supabase.ts          # Supabase client singleton
├── auth.ts              # localStorage session (getStoredEmployee, storeEmployee, clearEmployee)
├── permissions.ts       # canAccessTasks, canAccessBoard, canManageBoards
├── positions.ts         # POSITIONS list + getPositionColor()
├── workHours.ts         # getEffectiveWorkHours() per-employee
├── faceDetection.ts     # Lazy-loaded face-api wrapper (hasFace, prewarmFaceModels)
├── geo.ts               # GPS distance calculation with accuracy tolerance
├── pdfExport.ts         # jsPDF exporters (exportMonthlyPDF, exportEmployeeMonthlyReport)
└── types.ts             # ALL TypeScript interfaces
```

---

## 4. DATABASE SCHEMA (Supabase)

### Tables
- `employees` — id, name, pin, role ('employee'|'admin'), is_active, position, photo_url, work_start, work_end, schedule (JSON Day→{start,end,off}), phone, email, address, bank_account, join_date, created_at
- `attendance` — id, employee_id, date, clock_in, clock_out, status ('present'|'late'|'early_leave'|'absent'), clock_in/out_photo, clock_in/out_lat, clock_in/out_lng, notes
- `leaves` — id, employee_id, leave_type ('cuti'|'sakit'|'izin'), start_date, end_date, reason, attachment_url, status, admin_notes, reviewed_by, reviewed_at
- `reimbursements` — id, employee_id, category, transaction_date, amount, description, attachment_url, bank_account, status, admin_notes, reviewed_by, reviewed_at
- `announcements` — id, title, body, priority ('normal'|'important'|'urgent'), is_active, start_date, end_date, created_by
- `settings` — id, office_lat, office_lng, radius_meters, work_start, work_end, work_days (text[]), qr_required (bool), updated_at
- `tasks` — id, board_id, title, description, status (col key), color, labels (text[]), assignee_id, assignees (text[]), created_by, due_date, position, checklist (json[]), comments (json[]), attachments (json[]), cover_url
- `boards` — id, name, description, color, cover_url, allowed_roles (text[]), created_by
- `board_columns` — id, board_id, key, label, description, color, position, is_default
- `board_messages` — id, board_id, sender_id, sender_name, text, image_url, reply_to_id, reply_to_text, reply_to_sender
- `push_subscriptions` — id, employee_id, endpoint, p256dh, auth
- `qr_tokens` — id, token, created_at, expires_at

### Migration files (in repo root)
- `supabase-schema.sql` — main schema
- `supabase-migration-v2.sql` — early additions
- `supabase-migration-tasks.sql` / `-tasks-trello.sql` — task system
- `supabase-migration-announcements.sql`
- `supabase-migration-reimbursements.sql`
- `supabase-migration-push.sql` — push_subscriptions
- `supabase-migration-qr.sql`
- `supabase-migration-employee-schedules.sql` / `-schedule.sql` / `-work-hours.sql` / `-workdays.sql`
- `supabase-migration-rls-hardening.sql` — OPTIONAL tighter RLS (defaults are open)
- `supabase-migration-update-office-location.sql` — Thamrin City coords (-6.195806, 106.816667)

### RLS Status
- All tables: RLS enabled, policies `USING (true)` (fully open) by default
- Client auth via PIN in localStorage → cannot carry JWT claims → server-level user-scoping not possible without major refactor
- Hardening available via `supabase-migration-rls-hardening.sql` (opt-in)

---

## 5. ENVIRONMENT VARIABLES (Vercel)

Required vars on Vercel project Settings → Environment Variables:

| Variable | Description | Where to get |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (https://xxx.supabase.co) | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Same screen ↑ |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only, for `/api/push/send`) | Same screen ↑ — KEEP SECRET |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key | Generated once via `web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | VAPID private key | Same generation step ↑ — KEEP SECRET |
| `VAPID_SUBJECT` | VAPID contact (mailto:admin@redwine.com) | Configured manually |

**Local dev:** copy to `.env.local` (gitignored). Generate VAPID keys: `npx web-push generate-vapid-keys`.

---

## 6. EXTERNAL SERVICES & ACCESS

### Supabase
- Dashboard: https://supabase.com/dashboard/project/<project-ref>
- Tables visible via Table Editor
- SQL Editor for running migrations
- Storage buckets: `attendance-photos`, `task-attachments`, `reimbursements` (auto-created or via Dashboard)
- Realtime: enabled per-table via Replication settings

### GitHub
- Repo: https://github.com/Nicks1806/RWABSEN
- Owner: `Nicks1806`
- Default branch: `main`
- Auto-deploy webhook to Vercel

### Vercel
- Project: `RWABSEN` (or similar)
- Production domain: `absensiredwine.vercel.app`
- Owner account: whichever owns the project
- Deploy trigger: push to `main`
- Free tier limits: 100 deploys/day, 100GB bandwidth/mo

### Domain (planned)
- Main domain: `redwineshoes.id` (status unknown — see HANDOFF section 11)

---

## 7. AUTH FLOW (Custom, no Supabase Auth)

1. User opens `/` → enters Name + PIN
2. Login page queries `employees` table where `name ILIKE` + `pin =`
3. On match: `storeEmployee(data)` saves to localStorage key `redwine_employee`
4. `getStoredEmployee()` reads on any protected page mount
5. If null/wrong role → `router.push("/")` (back to login)
6. Logout: `clearEmployee()` removes from localStorage

**Implication:** Server cannot verify user from request alone. All admin checks happen client-side. For DB-level enforcement, apply `supabase-migration-rls-hardening.sql`.

---

## 8. CORE FEATURES

1. **Attendance (`/absen`)** — Camera selfie + GPS radius check + face detection + QR scan (optional) + 1×/day cap
2. **Leave & Reimbursement (`/pengajuan`)** — Employee submits, admin approves with bulk action
3. **Task Board (`/tasks`)** — Multi-board, drag-and-drop (managers only), checklist, comments, attachments, per-board chat with realtime
4. **Admin Dashboard (`/admin`)** — 5 tabs (Dashboard / Analitik / Izin / Karyawan / Pengaturan), per-employee monthly PDF report download, bulk approve leaves/reimbs
5. **Announcements (`/admin/pengumuman`)** — Admin CRUD, priority levels, scheduled publish
6. **PWA** — Installable, push notifications via VAPID, service worker network-first HTML / cache-first static
7. **QR Code (`/admin/qr`)** — Permanent token for physical print at office; karyawan scan saat absen

---

## 9. PERFORMANCE PATTERNS

- BottomNav uses `<Link prefetch>` + `router.prefetch()` on mount
- Supabase realtime: debounced 500ms with stable `useRef` callback
- `/tasks`: `force-dynamic` layout, large file (~2500 lines) — split candidates: TaskCard, ColumnDroppable, Chat panel
- `/admin`: `useTransition` for tab switching, `useMemo` for empStatsMap + effHoursMap + monthlyHoursMap
- Avatar component: `loading="lazy"` + `decoding="async"`

---

## 10. RECENT WORK (Apr 2026) — chronological highlights

| Commit | Description |
|---|---|
| `256d663` | SQL migration for office location update to Thamrin City coords |
| `72c1f39` | Fix PDF emoji rendering (Latin-1 sanitize via `pdfSafe()`) |
| `2cc99c9` | Per-employee monthly PDF report (attendance + leaves + reimbursements) |
| `3669ae2` | Silhouette outline: wider shoulders + vertical body; remove REC badge |
| `9e290ec` | Full-frame silhouette + smooth bordeaux transition to /home after success |
| `2c328ba` | Floating capture button overlay + auto-redirect to home |
| `12ca9a8` | Selfie camera redesign: silhouette outline + premium flow (iOS/Android safe-area) |
| `420f0df` | Defensive guards: photo data, time parsing, duplicate Clock import |
| `714158b` | SW cache bump v9→v10 (mobile PWA blank screen fix) |
| `6a706f8` | Back button: fallback to /home when history empty |
| `96a7ed5` | Admin tab switching: useTransition + memoized work hours + lazy Avatar |
| `7f5f7b6` | Task Board polish: compact stats, column gradients, label pills, empty states |
| `dbd0522` | Profile: editable bank_account + auto-default in reimburse form |
| `e54b43f` | Admin: clock-out reminder push + Top Rajin / Paling Telat ranking |
| `8c8ce4b` | Task search/filter + skeleton loading (`Skeleton.tsx`) |
| `a49580d` | Bulk approve leaves/reimbursements + RLS hardening SQL |

---

## 11. PENDING / KNOWN ISSUES

### Pending features (not started)
- Custom domain mount: `redwineshoes.id/absensi` or `absensi.redwineshoes.id` (recommended subdomain) — see SUBDOMAIN_SETUP.md (TBD)
- Calendar heatmap di `/riwayat`
- Dark mode toggle
- Toast notification system (replace `alert()` calls)
- Audit log table (who approved what when)
- Keyboard shortcuts desktop (`N` new task, `/` search)
- Login page hero redesign

### Pre-existing lint warnings (not blocking build)
- 7× `react-hooks/set-state-in-effect` — `setEmployee(emp)` after `getStoredEmployee()`. Valid pattern, can be refactored to `useState(() => getStoredEmployee())` lazy initializer.

### Gotchas
- **PWA cache**: when bumping `CACHE_NAME` in `public/sw.js`, also bump if you change manifest or any static asset.
- **iOS Safari camera**: `<video>` requires `playsInline + muted + autoPlay`. Don't remove these.
- **Supabase realtime**: payload arrives lazy — always `fetchData()` after channel event, don't trust inline payload.
- **Service worker**: skip cache for `_next/static/chunks/` and `_next/static/css/` (already handled in `sw.js`).
- **Vercel edge cache**: `/tasks` uses `force-dynamic` layout. Don't add layout-level static config without testing.

---

## 12. HOW TO RUN LOCALLY

```bash
# Clone
git clone https://github.com/Nicks1806/RWABSEN.git
cd RWABSEN/redwine-attendance

# Install deps
npm install

# Set up env
cp .env.example .env.local       # if .env.example exists; otherwise create manually
# Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, VAPID keys, etc.

# Dev server
npm run dev                       # http://localhost:3000

# Production build (verify before push)
npm run build

# Lint
npm run lint
```

**Pre-commit checklist:**
1. `npx tsc --noEmit -p .` must pass (zero errors)
2. `npm run build` must succeed
3. Bump `CACHE_NAME` in `public/sw.js` if any client code changed significantly
4. Test on mobile width (375px) in DevTools

---

## 13. DEPLOY FLOW

1. Code change → commit on local
2. `git push origin main`
3. GitHub webhook triggers Vercel build
4. Vercel installs deps, runs `next build`, deploys to production
5. Build takes ~3-5 min typically
6. Old PWA users need cache clear (SW handles this when `CACHE_NAME` bumped)

**Rollback:** Vercel Dashboard → Deployments → click previous → "Promote to Production".

---

## 14. DESIGN SYSTEM

- Primary: `#8B1A1A` Bordeaux (CSS var `--primary`)
- Primary-dark: `#5A1010`
- All UI text in Bahasa Indonesia
- Default board bg: `bg-gradient-to-br from-rose-50/40 via-white to-amber-50/20`
- Column color palette: rose, amber, emerald, blue, purple, slate, pink, indigo, teal (`COL_COLORS` in tasks/page.tsx)
- Task labels: red/yellow/green/blue/purple/gray (`CARD_COLORS` in tasks/page.tsx)
- Animations in `globals.css`: `animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-stagger`, `silhouette-dash`, `animate-sheet-up`
- Respect `prefers-reduced-motion` (already in globals.css)

---

## 15. FILES MOST LIKELY TO TOUCH

| Path | Lines | When to touch |
|---|---|---|
| `src/app/tasks/page.tsx` | ~2500 | Task Board features (split candidate) |
| `src/app/admin/page.tsx` | ~2500 | Admin tabs (split candidate) |
| `src/app/absen/page.tsx` | ~1200 | Clock-in flow, camera, face detect |
| `src/app/home/page.tsx` | ~350 | Employee dashboard |
| `src/lib/types.ts` | ~190 | When schema changes |
| `src/lib/pdfExport.ts` | ~530 | PDF report layout |
| `public/sw.js` | ~140 | PWA cache strategy |
| `src/app/globals.css` | ~150 | Global animations, safe-area utils |

---

## 16. COMMUNICATION CONVENTIONS

- User language: **Bahasa Indonesia** (casual, friendly)
- Commits: conventional commits (`feat:`, `fix:`, `style:`, `perf:`, `docs:`, `chore:`)
- Commit body uses bullet points + co-author trailer
- User feedback "lag/berat" → look for memoization + image lazy + useTransition opportunities
- User feedback "perbagus ui nya" → keep within existing design system (no big rebrand) unless explicitly approved

---

## 17. CRITICAL CONTACTS / ACCESS

> ⚠️ **Secret values are NOT in this file.** Ask the project owner for:

1. Supabase project URL + anon key (for `.env.local`)
2. Supabase service role key (server-side push only)
3. VAPID public + private keys (for push notifications)
4. GitHub repo write access (`Nicks1806/RWABSEN`)
5. Vercel team / project access
6. Domain registrar access (if mounting custom domain)

---

## 18. WHEN STUCK — DEBUGGING TIPS

1. **Blank page on /tasks or /admin**: usually stale SW cache → bump `CACHE_NAME` + clear PWA cache on device
2. **"Failed to load chunk"**: same as above — SW cached old chunk URL
3. **React Error #310**: hook called after early return → reorder hooks before `if (!user) return null`
4. **Build fails on Vercel but works locally**: likely TypeScript strict mode → run `npx tsc --noEmit -p .` locally
5. **Realtime not updating**: check Supabase Replication settings — table must have realtime ENABLED
6. **GPS always shows out of radius**: verify `office_lat/office_lng` in `settings` table + radius_meters
7. **Push notification not received**: check VAPID keys + `/api/push/send` logs in Vercel + browser permissions

---

## 19. TODO BEFORE LIVE LAUNCH (production-ready checklist)

- [ ] Apply `supabase-migration-rls-hardening.sql` for DB-level security
- [ ] Set up custom domain (subdomain `absensi.redwineshoes.id` recommended)
- [ ] Update office location via `supabase-migration-update-office-location.sql` OR `/admin > Pengaturan`
- [ ] Add admin account if not yet — direct INSERT to `employees` table with `role='admin'`
- [ ] Test push notification on physical iOS + Android devices (PWA installed)
- [ ] Print QR code from `/admin/qr` and post at office entrance
- [ ] Set radius_meters to appropriate value (50-150m depending on building)
- [ ] Train admin on bulk approve flow + PDF report download
- [ ] Bookmark Vercel logs URL for live troubleshooting

---

## 20. WHAT THE NEXT CLAUDE SESSION SHOULD READ FIRST

In order:
1. **This file** (`HANDOFF.md`)
2. `CLAUDE.md` (terse project guide)
3. `AGENTS.md` (Next.js 16 warning)
4. `src/lib/types.ts` (all data shapes)
5. `package.json` (dependencies)
6. Recent commits: `git log --oneline -30`
7. `public/sw.js` (PWA caching logic)

Then read whichever feature file the user is asking about. **Don't read all 2500-line files unless needed** — use Grep for specific symbols.

---

_Generated by Claude Code session, April 2026. Update this file as the project evolves._
