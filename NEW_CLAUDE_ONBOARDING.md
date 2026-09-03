# 🚀 NEW_CLAUDE_ONBOARDING.md — Bootstrap Guide for New Claude Code Instance

> **Kamu Claude Code baru? Baca file ini SEBELUM apa pun.**
> Setelah baca ini, kamu siap kerja di project dengan skill setara Claude yang sudah kerja berminggu-minggu di sini.
>
> Buatan: 20 April 2026 · Instance sebelumnya: Claude Opus 4.7 (1M context)

---

## 🎯 STEP 0 — Baca 5 file ini secara berurutan

```
1. NEW_CLAUDE_ONBOARDING.md   ← kamu di sini (bootstrap)
2. AGENTS.md                   ← 3 baris, WAJIB (Next.js 16 warning)
3. PROJECT_MASTER.md           ← 1160 baris, konsolidasi lengkap
4. CLAUDE.md                   ← 640 baris, detailed reference
5. HANDOFF.md                  ← 420 baris, extended history
6. MIGRATION_NOTES.md          ← 230 baris, setup checklist
```

Setelah selesai, kamu tahu:
- Apa itu project ini (RedWine Attendance)
- Semua tech + tools + integrations
- Full database schema
- Semua env vars yang dibutuhkan
- Semua flow user
- Semua gotchas + fixes
- Komunikasi + workflow

---

## 🔐 STEP 1 — Full Access Setup

Owner (Nicks1806) harus kasih ke kamu:

### A. Repo access
- **GitHub:** collaborator invite ke `Nicks1806/RWABSEN`
- Setelah accept → clone repo:
  ```bash
  git clone https://github.com/Nicks1806/RWABSEN.git
  cd RWABSEN/redwine-attendance
  ```

### B. 7 Env vars (isi `.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=<dari Supabase Dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dari Supabase Dashboard>
SUPABASE_SERVICE_KEY=<dari Supabase Dashboard - SECRET>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID public>
VAPID_PRIVATE_KEY=<VAPID private - SECRET>
VAPID_SUBJECT=mailto:admin@redwineshoes.id
CSV_EXPORT_KEY=<bebas, password untuk /api/attendance-csv>
```

### C. Platform access
- **Vercel:** invite ke team → project RWABSEN
- **Supabase:** invite ke organization → project
- **Domain registrar** (kalau ada, untuk setup custom domain)

### D. Info tambahan yang berguna
- Existing admin PIN (test login tanpa buat admin baru)
- Supabase project ref (bagian sebelum `.supabase.co`)
- List karyawan aktif (buat referensi)

---

## ⚡ STEP 2 — Quick Start (setelah step 1 selesai)

```bash
# 1. Install
npm install

# 2. Setup env
# Buat .env.local dengan 7 vars dari Step 1B

# 3. Test type check
npx tsc --noEmit -p .

# 4. Dev server
npm run dev
# → http://localhost:3000

# 5. Login pakai admin credentials
# → Explore /admin, /tasks, /absen, /home
```

Kalau ini berhasil, environment kamu ready.

---

## 🧠 STEP 3 — Core Mental Model

### Ini apa?
**RedWine Attendance** = PWA absensi untuk boutique sepatu premium di Thamrin City, Jakarta. ~10-15 karyawan pakai HP setiap hari untuk clock in/out. 1-2 admin pakai desktop untuk approve cuti/reimburse + monitoring.

### Arsitektur high-level
```
┌─────────────────────────────────────────────────────────┐
│  User HP (PWA)     Admin Desktop     Cron / Automation  │
└────────────┬───────────────┬─────────────────────────────┘
             │               │
             ▼               ▼
    ┌─────────────────────────────────┐
    │  Next.js 16 App (Vercel Edge)   │
    │  - App Router pages             │
    │  - Server Components + APIs     │
    │  - Service Worker (PWA)         │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌─────────────────────────────────┐
    │  Supabase (Postgres + Storage)  │
    │  - 12 tables (RLS open)         │
    │  - attendance-photos bucket     │
    │  - Realtime channels            │
    └─────────────────────────────────┘
```

### Auth (WAJIB dipahami)
**Custom PIN + localStorage. BUKAN Supabase Auth.**

- User input nama + PIN → query `employees` table
- Match → `localStorage.setItem("redwine_employee", data)`
- Setiap protected page: `useEffect` cek localStorage, redirect kalau tidak ada
- Server tidak tahu siapa user (tidak ada JWT)
- Semua admin guard di client-side

Baca `src/lib/auth.ts` (22 baris) dan `src/lib/permissions.ts` (44 baris) untuk detail.

---

## 🚨 STEP 4 — Hard Rules (melanggar = crash/bug)

### 1. Ini Next.js 16 (bukan 14/15)
Baca `AGENTS.md`. Jangan asumsikan API lama masih valid.

### 2. Hooks HARUS di atas early return
```tsx
// ❌ SALAH
useEffect(...);
if (!user) return null;
useState(...);   // ← crash React Error #310

// ✅ BENAR
useState(...);
useEffect(...);
if (!user) return null;
```

### 3. Heavy libs HARUS lazy-loaded
Jangan `import jspdf from "jspdf"` di top-level. Pakai:
```ts
async function exportPDF() {
  const { exportMonthlyPDF } = await import("@/lib/pdfExport");
  ...
}
```

### 4. Bump SW cache setiap major client change
```js
// public/sw.js
const CACHE_NAME = "redwine-v16";  // → v17
```
Otherwise mobile PWA users lihat blank screen.

### 5. UI text semua Bahasa Indonesia
Comments dan code boleh Inggris. UI tampilan WAJIB Indonesia.

### 6. Test di 375px width minimum
Mobile-first. iPhone SE dulu, desktop belakangan.

### 7. Vercel free tier
Max 100 deploys/day. Jangan spam push.

---

## 📝 STEP 5 — Workflow Standard

### Sebelum edit
1. Baca file target lengkap
2. Cek related files (imports, types)
3. Kalau tidak yakin, `grep` dulu sebelum edit

### Setelah edit
1. `npx tsc --noEmit -p .` — harus pass
2. Test di dev server kalau UI change
3. Kalau major client change → bump `CACHE_NAME` di sw.js

### Commit
Convention:
```
feat(scope): what changed
fix(scope): what fixed
style(scope): visual change
perf(scope): performance
docs: documentation only
chore: cleanup / refactor
```

Body: bullet points explaining WHAT + WHY.

Trailer:
```
Co-Authored-By: Claude Opus X.X (1M context) <noreply@anthropic.com>
```

### Push
```bash
git push origin main
```

Vercel auto-deploy in 3-5 min. Kalau limit hit (100/day), tunggu reset besok.

---

## 💬 STEP 6 — Komunikasi dengan User

### Bahasa
User pakai **Bahasa Indonesia casual**. Reply juga Indonesia casual.
- "gas" = proceed / lanjut
- "cek" = check
- "kerjakan" = do it
- "gimana" = how / what about
- "biar" = so that
- "kalo" / "kalau" = if

### Style
- **Terse & practical.** User ini action-oriented, ga suka penjelasan panjang.
- **Kasih summary singkat setelah commit.** Bullet points > paragraf.
- **Tunjukkan hasil, bukan proses.** "Pushed X. Fitur Y sekarang jalan." bukan "Saya sedang bekerja pada..."
- **Kalau ada masalah, propose fix + tanya.** Jangan cuma report bug.

### Feedback yang sering muncul
| User bilang | Artinya |
|---|---|
| "perbagus ui nya" | Polish styling within existing design system |
| "masih sama" | Belum kelihatan berubah (cek cache PWA) |
| "gk cocok" / "tidak cocok" | Approach salah, coba alternatif |
| "hapus X" | Straight up remove, no push-back |
| "cek bug" | Comprehensive audit, prioritize by severity |
| "lag/berat" | Performance issue — lazy load, memoize, useTransition |
| "tidak muncul" | Deploy belum selesai atau cache PWA lama |

### Kalau user tunjukin screenshot bug
1. Cek dulu apakah kode di GitHub sudah correct
2. Kalau code correct tapi user lihat masalah → itu cache issue
3. Kasih instruksi hard refresh / clear PWA cache
4. Selalu bump SW `CACHE_NAME` sebagai fix permanent

---

## 🛠️ STEP 7 — Common Tasks (quick reference)

### Tambah field baru ke table
1. Buat SQL migration file (contoh: `supabase-migration-add-X.sql`)
2. Run di Supabase SQL Editor
3. Update `src/lib/types.ts` interface
4. Update UI di form yang relevan
5. Kalau muncul di PDF: update `src/lib/pdfExport.ts`

### Tambah page baru
1. Buat `src/app/newpage/page.tsx`
2. Copy protected page pattern dari existing (getStoredEmployee + redirect)
3. Add link ke BottomNav kalau butuh
4. Test hooks order (semua sebelum early return)

### Setup realtime channel
```tsx
useEffect(() => {
  if (!employee) return;
  const channel = supabase
    .channel(`my-channel-${employee.id}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "my_table" },
      (payload) => { /* debounced fetch */ }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };  // ← WAJIB
}, [employee]);
```

### Send push notification
```ts
await fetch("/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    employee_ids: [uuid1, uuid2],  // atau employee_id: uuid
    title: "Judul",
    body: "Isi pesan",
    url: "/absen"                   // optional, default /
  })
});
```

### Fix "blank screen di HP"
1. Bump `CACHE_NAME` di `public/sw.js`
2. Commit + push
3. Instruct user: clear PWA cache / uninstall + reinstall
4. Deploy akan force SW update, cache lama otomatis di-delete

---

## 📊 STEP 8 — Full Work History (semua yang pernah dikerjakan)

Chronological, terbaru → terlama:

### Documentation & Handoff
- `08f086a` PROJECT_MASTER.md — single-file complete recap
- `cbef14a` CLAUDE.md + MIGRATION_NOTES.md — full audit
- `79d6feb` HANDOFF.md — extended history
- `256d663` SQL migration Thamrin City coords (-6.195806, 106.816667)

### Recent Features
- `72c1f39` PDF sanitize emoji (Latin-1 only jsPDF font)
- `2cc99c9` Per-employee monthly PDF report (attendance + leaves + reimburse)
- `27f8914` 3 audit fixes: board scope on column delete, double-submit guard, photo size guard

### Absen Redesign (silhouette camera)
- `3669ae2` Wider shoulders + vertical body sides + remove REC badge
- `7f5f358` Silhouette passport-photo style
- `9e290ec` Full-frame silhouette + bordeaux transition to home
- `acb546d` Faster redirect (400ms) + router.replace
- `2c328ba` Floating capture button overlay + auto-redirect home
- `12ca9a8` Selfie silhouette outline + premium capture flow

### Defensive Guards & Bug Fixes
- `420f0df` Guards: photo data, time parsing, duplicate Clock import
- `714158b` SW v9→v10 (blank screen mobile PWA)
- `6a706f8` Back button fallback ke /home
- `831753b` Force /tasks dynamic rendering (bypass edge cache)
- `9c1d5dd` isMobile useState BEFORE early return (hooks order)

### Performance
- `96a7ed5` Admin tab switching: useTransition + memoized work hours + lazy Avatar
- `8c8ce4b` Task search + filter + skeleton loading

### Task Board Iterations
- `7f5f7b6` Full UI polish (6 preview sections)
- `a7a6615` Premium UI polish — cleaner columns, hero add-column
- `b60ae65` Hide horizontal scrollbar, add edge gradient fade
- `0f50090` Disable drag for karyawan (non-manager view)
- `824f109` Board card text truncate — 1 role atau 'RoleName +N'

### Admin Dashboard
- `a49580d` Bulk approve leaves + reimbursements + RLS hardening SQL
- `e54b43f` Dashboard analytics + clock-out push reminder
- `15ed620` Codebase audit cleanup — dead code + hoisting

### Profile & Auth
- `dbd0522` Editable bank account + auto-default reimburse
- `2109aa7` Board management restricted to Founder/CEO/GM
- `e9c0a15` Soft delete + hard delete opsi karyawan

### Realtime & Chat
- `3f9f90f` Realtime subscription stability
- `18d2a6c` Inline quick-add + chat realtime + board delete visible
- `c22a58f` Trello bottom bar + per-board chat messaging
- `710c6c5` Chat power-up + assignee picker + hide nav when chat open
- `02d0e84` Board role access + chat UI polish

### PWA & Service Worker Evolution
- v3→v4: initial refinement
- v4→v5: force refresh
- v5→v6: Trello UI iteration
- v6→v7: task board features
- `b83b374` SW v7 + tasks error boundary
- `084d5bc` SW v8 - skip Next chunks
- v8→v9: continued
- `714158b` v9→v10 (fix mobile blank)
- `12ca9a8` v10→v11 (absen redesign)
- v11→v12: floating button
- v12→v13: faster redirect
- v13→v14: silhouette + transition
- v14→v15: passport silhouette
- **v15→v16 (current)**: wider shoulders

### Design System Evolution
- Board background: sky-blue → bordeaux-warm (`from-rose-50/40 via-white to-amber-50/20`)
- Card labels: colored strip → label pills with dot + uppercase
- Column colors: 9 palette entries (rose/amber/emerald/blue/purple/slate/pink/indigo/teal)
- Empty states: personalized per column
- StatPill: 3 large gradient cards → 1 inline compact pill
- BottomNav: standard → floating pill with gradient active state
- Animations: fade-in, slide-up, scale-in, stagger, soft-pulse, shimmer, silhouette-dash

### Removed / Reverted
- Task color picker (auto random assignment)
- "Lebih Detail" toggle in form (all-in-one inline)
- Label color filter chips in task board header
- Design rebuild dengan gold/serif (user cancel, stay dengan existing bordeaux system)

---

## 🎨 STEP 9 — Design Language Cheat Sheet

### Colors
```
Primary:      #8B1A1A (Bordeaux)
Primary-dark: #5A1010
Board bg:     from-rose-50/40 via-white to-amber-50/20

Column tints:
- rose (Brief)
- amber (Today)
- emerald (Done)
- slate (History)
- blue, purple, pink, indigo, teal (custom)

Status:
- Green: success/hadir
- Amber: warning/terlambat/pulang-awal
- Red: overdue/absent
- Blue: info
```

### Typography
- Font: Geist Sans (via `next/font`)
- Heading: semibold, tracking-tight
- Emphasis: bold
- Uppercase caps: tracking-wider, letter-spacing higher
- Numbers: tabular-nums
- Font sizes: mostly `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px)

### Spacing
- Border radius: `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px)
- Padding: `p-2` untuk compact, `p-3` untuk normal, `p-4` untuk generous
- Gap: `gap-1.5`, `gap-2`, `gap-3` paling umum

### Animations
Semua di `src/app/globals.css`:
- `animate-fade-in` — appear
- `animate-slide-up` — bottom sheet
- `animate-scale-in` — modal
- `animate-stagger` — list items
- `animate-soft-pulse` — live indicators
- `animate-shimmer` — skeleton
- `silhouette-dash` — dashed stroke flow
- `animate-sheet-up` — bottom sheet up

Respect `prefers-reduced-motion`.

---

## 🐛 STEP 10 — Troubleshooting Playbook

### "Blank page setelah deploy"
- SW cache lama → bump `CACHE_NAME` + user clear PWA cache

### React Error #310
- Hook setelah early return → pindah ke atas

### Build fails Vercel tapi jalan lokal
- TS strict → run `npx tsc --noEmit -p .` lokal

### Realtime tidak update
- Table belum enabled realtime → Supabase Dashboard → Replication

### GPS "di luar radius"
- `office_lat/lng` di settings salah → `/admin` → Pengaturan atau run migration SQL

### Push notification tidak sampai
- Cek: VAPID keys match? Permission granted? Sub valid? iOS PWA installed?
- Lihat Vercel Function logs `/api/push/send`

### PDF karakter aneh (Ø=Þ)
- Emoji → sudah fix dengan `pdfSafe()` (commit `72c1f39`)

### Duplicate attendance row
- Double-tap during transition → `disabled={loading || transitioning}`

### Board A delete kolom pengaruh board B
- Missing `.eq("board_id", ...)` → fix commit `27f8914`

---

## ✅ STEP 11 — Checklist Selesai Onboarding

Kamu siap kerja penuh kalau bisa:
- [ ] Login pakai admin PIN
- [ ] Explore /admin, /tasks, /home tanpa error
- [ ] Test clock-in dari HP fisik (butuh HTTPS)
- [ ] Push notification test berhasil
- [ ] Type check pass (`npx tsc --noEmit -p .`)
- [ ] Build pass (`npm run build`)
- [ ] Trace flow #1 (Clock In) di kode
- [ ] Tahu di mana bump `CACHE_NAME`
- [ ] Tahu 3 heavy libs yang wajib lazy-load
- [ ] Tahu hooks-before-early-return rule
- [ ] Tahu auth pakai PIN + localStorage (bukan Supabase Auth)
- [ ] Bisa jelaskan flow "PIN login → localStorage → protected pages"

---

## 🎯 STEP 12 — First Task Suggestion

Setelah onboarding selesai, task pertama yang bagus untuk warm-up:

1. **Baca sepenuhnya** `src/lib/*.ts` (11 files, total ~1000 baris) — pattern library
2. **Trace 1 user flow** dari click sampai DB write (contoh: Clock In)
3. **Pick 1 pending item** dari section "Pending / Nice-to-have" di `PROJECT_MASTER.md`
4. **Commit + push** ke branch feature
5. **Test di production** setelah Vercel deploy

Prioritas pending:
- Custom domain `absensi.redwineshoes.id` setup
- Calendar heatmap di `/riwayat`
- Toast notification (replace `alert()`)
- Audit log table
- Keyboard shortcuts desktop

---

## 📞 STEP 13 — Kalau Stuck

1. Grep dulu di codebase — sering ada existing pattern
2. Baca commit history untuk konteks: `git log --oneline`
3. Cek `HANDOFF.md` section "Debugging Tips"
4. Cek `PROJECT_MASTER.md` section "Known Gotchas + Fixes"
5. Vercel Function logs untuk API errors
6. Supabase Dashboard → Logs untuk DB issues
7. Tanya user — jangan asumsi. User punya konteks bisnis yang kamu tidak punya.

---

## 🎬 CLOSING

Selamat datang di RedWine Attendance. Project ini sudah production dan dipakai harian, jadi **stability > new features**. Kalau ada perubahan major, test dulu di local, review carefully, baru push.

**Communication style:** casual Indonesia, terse, action-oriented. Tunjukkan hasil, bukan proses.

**Working style:** commit yang jelas, lazy load heavy stuff, bump SW cache untuk major client change, respect hooks order, mobile-first.

**Referensi:**
- `PROJECT_MASTER.md` — 90% pertanyaan bisa dijawab dari sini
- `CLAUDE.md` — untuk lookup detail spesifik
- `HANDOFF.md` — untuk konteks historis "kenapa begitu"
- `MIGRATION_NOTES.md` — untuk setup env baru
- `AGENTS.md` — jangan lupa baca (3 baris)

**Kalau semua confused:** clone repo, `npm install`, `npm run dev`, buka localhost:3000, explore. Kode di depan mata.

Good luck. ⚡

---

_Dibuat 20 April 2026 oleh Claude Opus 4.7 (1M context) untuk instance Claude Code berikutnya._
_Update file ini kalau ada perubahan major di workflow atau architecture._
