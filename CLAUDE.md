@AGENTS.md

# RedWine Attendance — Project Guide

## Tentang Projek
Sistem absensi & manajemen karyawan **RedWine Shoes & Bags** (toko di Thamrin City, Jakarta).
Web app PWA (installable di HP) digunakan oleh ~10-15 karyawan setiap hari.

**Stack**: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS + Supabase + Vercel
**URL**: https://absensiredwine.vercel.app
**Repo**: https://github.com/Nicks1806/RWABSEN

## Fitur Utama
1. **Absensi** — Clock in/out dengan selfie + GPS (radius Thamrin City) + QR code, face detection
2. **Leave Management** — Cuti/Sakit/Izin dengan approval flow admin
3. **Reimbursement** — Pengajuan reimburse dengan attachment + bank account
4. **Admin Dashboard** — Analytics, charts (recharts lazy-loaded), export PDF/Excel
5. **Task Board** — Kanban drag & drop (@dnd-kit), multi-board, checklist, comments, attachments, per-board chat
6. **Pengumuman** — CRUD dengan prioritas + push notification + periode tayang
7. **PWA** — Installable, push notifications (VAPID), service worker cache
8. **Employee Directory** — Profil dengan foto, schedule per karyawan, role/position

## Arsitektur

### Database (Supabase PostgreSQL)
- `employees` — data karyawan, role, schedule, pin, photo
- `attendance` — clock in/out records
- `leaves` — pengajuan cuti/sakit/izin
- `reimbursements` — pengajuan reimburse
- `announcements` — pengumuman admin
- `settings` — konfigurasi kantor (GPS, radius, jam kerja)
- `tasks` — kanban cards (status, assignees, checklist, comments, attachments, labels)
- `boards` — multi-board support dengan allowed_roles
- `board_columns` — dynamic columns per board
- `board_messages` — per-board chat
- `push_subscriptions` — web push subscriptions
- `qr_tokens` — permanent QR code

### Key Files
- `src/lib/types.ts` — Semua TypeScript interfaces
- `src/lib/supabase.ts` — Supabase client
- `src/lib/auth.ts` — localStorage session
- `src/lib/permissions.ts` — Access control (canAccessTasks)
- `src/lib/positions.ts` — Predefined positions + color coding
- `src/lib/workHours.ts` — Per-employee schedule
- `src/lib/faceDetection.ts` — Face detection (lazy-loaded)
- `src/lib/geo.ts` — GPS distance with accuracy tolerance

### Pages
- `/` — Login | `/home` — Dashboard | `/absen` — Clock in/out
- `/tasks` — Task Board | `/admin` — Admin dashboard
- `/pegawai` — Directory | `/pengajuan` — Leave/reimburse
- `/inbox` — Notifications | `/profile` — Profile | `/riwayat` — History

## Aturan WAJIB
- UI text dalam **Bahasa Indonesia**
- Primary color: `#8B1A1A` (dark red RedWine)
- Mobile-first, test di 375px minimum
- Clock in/out max **1x per hari**
- Face detection wajib saat absen (lazy-loaded)
- GPS tolerance: `effectiveDist = max(0, distance - accuracy)`

## JANGAN
- Import heavy libs di top-level → lazy load (recharts, xlsx, jspdf, face-api)
- useState/useEffect SETELAH `if (!user) return null` → React hooks crash
- 2 DndContext bersamaan → hooks conflict crash
- Tailwind arbitrary class untuk width kritis → pakai inline style
- Push >50 commit/hari → Vercel free limit 100 deploy/hari

## Performance
- BottomNav: `<Link prefetch>` + router.prefetch on mount
- SW: stale-while-revalidate HTML, cache-first static
- Realtime: debounce 500ms + useRef stable callback
- `/tasks`: `force-dynamic` layout (bypass edge cache)

## Task Board Specifics
- Desktop: @dnd-kit SortableContext drag reorder
- Mobile: NO @dnd-kit, tab view + bottom sheet
- `isMobile` BEFORE early returns
- Chat: inline style `{width: 360}`, board `marginLeft: 360`

## Environment Variables (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (mailto:)

## Deployment
- GitHub → Vercel auto-deploy on push to `main`
- SW cache issue → bump `CACHE_NAME` in `public/sw.js`
- Edge cache stale → `layout.tsx` with `export const dynamic = "force-dynamic"`
