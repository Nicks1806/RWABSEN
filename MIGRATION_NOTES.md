# MIGRATION_NOTES.md — Quick-Start Migration Guide

> Panduan cepat untuk pindah project ke environment baru / developer baru / Claude Code instance baru.
> Untuk konteks lengkap → baca `CLAUDE.md` dan `HANDOFF.md`.

---

## 📝 Ringkasan Project (5 kalimat)

**RedWine Attendance** adalah PWA (Progressive Web App) untuk sistem absensi & manajemen karyawan **RedWine Shoes & Bags** — boutique premium sepatu & tas di Thamrin City, Jakarta. Aplikasi dipakai harian oleh ~10-15 karyawan di HP mereka untuk clock in/out dengan foto selfie + GPS radius kantor + face detection, plus fitur cuti/izin, reimbursement, task board kanban, dan chat internal. Stack utama: **Next.js 16 + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Storage, Realtime) + Vercel**, dengan custom PIN-based auth (bukan Supabase Auth) yang disimpan di localStorage. Push notification via Web Push (VAPID) untuk reminder absen, task assignment, dan approval status. Deploy otomatis dari GitHub `main` branch ke Vercel, live di `https://absensiredwine.vercel.app`.

---

## ✅ Yang WAJIB Dilakukan Sebelum Project Jalan di Environment Baru

### 1. Setup Repository
- [ ] Clone repo: `git clone https://github.com/Nicks1806/RWABSEN.git`
- [ ] Masuk ke folder: `cd RWABSEN/redwine-attendance`
- [ ] Install: `npm install`

### 2. Setup Supabase (jika project baru)
- [ ] Buat project baru di https://supabase.com/dashboard
- [ ] Catat **project URL** (`https://xxxxx.supabase.co`)
- [ ] Copy **anon key** dan **service role key** dari Settings → API
- [ ] Buka SQL Editor, jalankan migration files SECARA BERURUTAN:
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
  13. `supabase-migration-rls-hardening.sql` (**OPSIONAL** — kalau mau DB-level security)
  14. `supabase-migration-update-office-location.sql` (set Thamrin City coords)

### 3. Setup Storage Bucket
- [ ] Supabase Dashboard → Storage → **New bucket**
- [ ] Name: `attendance-photos`
- [ ] Public: **Yes** (bisa akses via URL langsung)
- [ ] File size limit: 5MB (opsional)

### 4. Enable Realtime pada Tables
Supabase Dashboard → Database → Replication → toggle enable untuk:
- [ ] `board_messages` (untuk chat realtime di Task Board)
- [ ] `announcements` (untuk pengumuman live update)
- [ ] `attendance` (untuk admin dashboard live monitoring)
- [ ] `tasks` (untuk kanban board realtime)
- [ ] `leaves` (opsional, untuk approval notification)

### 5. Generate VAPID Keys (Web Push)
```bash
npx web-push generate-vapid-keys
```
- [ ] Copy **Public Key** → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- [ ] Copy **Private Key** → `VAPID_PRIVATE_KEY`
- [ ] Set `VAPID_SUBJECT=mailto:admin@redwineshoes.id` (atau email lain)

### 6. Setup Environment Variables

**Local dev:** Buat file `.env.local` di root `redwine-attendance/`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxx...
VAPID_PRIVATE_KEY=Xxxx...
VAPID_SUBJECT=mailto:admin@redwineshoes.id
CSV_EXPORT_KEY=rw_csv_secret_password
```

**Vercel production:** Dashboard project → Settings → Environment Variables → paste semua 7 var di atas → Save → Redeploy.

### 7. Buat Admin User Pertama
Karena auth PIN-based, admin harus dibuat manual via SQL:
```sql
INSERT INTO employees (name, pin, role, is_active, position, created_at)
VALUES ('Admin RedWine', '1234', 'admin', true, 'Owner', NOW());
```
Ganti `1234` dengan PIN yang aman.

### 8. Update Lokasi Kantor
- **Cara A:** Login sebagai admin → `/admin` → tab **Pengaturan** → isi:
  - Office Latitude: `-6.195806` (Thamrin City)
  - Office Longitude: `106.816667`
  - Radius Meters: `100` (recommended)
- **Cara B:** Run `supabase-migration-update-office-location.sql` di SQL Editor

### 9. Test Development
```bash
npm run dev
# Buka http://localhost:3000
# Login pakai admin yang dibuat di step 7
```

### 10. Deploy ke Vercel
- [ ] Connect Vercel ke GitHub repo `Nicks1806/RWABSEN`
- [ ] Set env vars (step 6)
- [ ] Deploy pertama akan trigger otomatis
- [ ] Live URL: `<project>.vercel.app`

### 11. Test PWA + Push Notification (di HP fisik)
- [ ] Buka production URL di Chrome (Android) / Safari (iOS) HP
- [ ] Add to Home Screen
- [ ] Buka PWA dari home screen
- [ ] Login → Profile → toggle notification ON → allow browser permission
- [ ] Test kirim push dari admin → cek muncul di HP

### 12. Print QR Code Fisik
- [ ] Login admin → `/admin/qr` → Print QR code (permanent, 10 tahun)
- [ ] Pasang di dinding kantor / area absensi

---

## 🔑 Daftar Akses yang Perlu Disiapkan

### Wajib (Owner harus share ke developer baru):

| Akses | Format | Ambil dari |
|---|---|---|
| **Supabase Project URL** | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| **Supabase Anon Key** | `eyJhbGciOi...` (JWT panjang) | Supabase Dashboard → Settings → API → "anon public" |
| **Supabase Service Role Key** | `eyJhbGciOi...` (JWT panjang) | Supabase Dashboard → Settings → API → "service_role" (⚠️ SECRET) |
| **Supabase Project Ref** | `xxxxx` (dari URL) | Bagian sebelum `.supabase.co` |
| **VAPID Public Key** | `BLxx...` (~87 chars) | Generate via `npx web-push generate-vapid-keys` atau ambil dari Vercel env |
| **VAPID Private Key** | `Xxxx...` (~43 chars) | Sama seperti public key |
| **CSV_EXPORT_KEY** | Custom password | Buat sendiri, bebas format |
| **GitHub repo access** | Collaborator invite | Owner: `Nicks1806` → repo Settings → Collaborators |
| **Vercel team access** | Team member invite | Owner Vercel → Team Settings → Members |
| **Domain registrar login** | (opsional) | Kalau mau setup `absensi.redwineshoes.id` |

### Tidak wajib tapi berguna:

- **Existing admin PIN** (untuk test login tanpa buat admin baru)
- **List karyawan aktif + PIN masing-masing** (untuk migrasi data)
- **Backup terbaru** (kalau ada) — export via Supabase Dashboard → Database → Backups
- **Google Sheets ID** (kalau CSV endpoint sudah connected ke sheet)

---

## ⏱️ Estimasi Waktu Setup dari Nol

| Skenario | Estimasi Waktu | Catatan |
|---|---|---|
| **Existing project, dev baru clone** | 30-45 menit | Sudah ada env vars, tinggal `.env.local` + `npm install` + `npm run dev` |
| **Fresh Supabase project (data baru)** | 1.5-2 jam | Setup Supabase, run 12+ SQL migrations, seed admin, VAPID keys, Vercel deploy |
| **Migrasi ke Supabase project baru dengan data lama** | 3-4 jam | Tambah export data lama → import → verify integrity |
| **Full production deploy dengan custom domain** | 4-5 jam | Termasuk DNS config, SSL propagation wait, PWA test di iOS+Android |
| **Emergency clone + deploy (hot handoff)** | 1 jam | Kalau semua env vars sudah ada di password manager |

---

## 🎯 Prioritas Task untuk Developer Baru

**Minggu 1 (familiarisasi):**
1. Baca `CLAUDE.md`, `HANDOFF.md`, `AGENTS.md`
2. Setup local dev, test semua fitur di local
3. Baca kode `src/lib/*` (semua utility functions)
4. Trace 1 flow ujung-ke-ujung (misal: clock-in flow)

**Minggu 2 (contribute):**
5. Pick TODO ringan dari HANDOFF.md
6. Baca `src/app/tasks/page.tsx` dan `src/app/admin/page.tsx` (~2500 baris masing-masing)
7. Test push notification di physical device

**Ongoing:**
8. Monitor Vercel deployment logs
9. Update `CLAUDE.md` setelah perubahan arsitektur besar
10. Bump `CACHE_NAME` di `public/sw.js` kalau major client change

---

## ⚠️ Hal-Hal Kritis untuk Diketahui Sejak Awal

1. **Ini Next.js 16 (bukan 14/15)** — API + convention berbeda. Baca `node_modules/next/dist/docs/` kalau ragu.
2. **Auth pakai localStorage PIN, BUKAN Supabase Auth** — jangan pakai `supabase.auth.signIn()`.
3. **RLS policy default `USING (true)` (fully open)** — semua guard di client-side. Apply `supabase-migration-rls-hardening.sql` untuk DB-level security.
4. **Semua UI text Bahasa Indonesia** — hard rule.
5. **Mobile-first** — test di 375px width (iPhone SE).
6. **Hooks HARUS di atas early return** — otherwise React Error #310.
7. **Heavy libs (jspdf, xlsx, recharts, face-api) HARUS lazy-loaded** — jangan import di top-level.
8. **Bump `CACHE_NAME` di sw.js setiap client change signifikan** — otherwise mobile PWA users lihat blank screen.
9. **Vercel free tier limit: 100 deploys/day** — plan commits accordingly.
10. **Face detection fail-open** — kalau model gagal load, tetap boleh submit clock-in (deliberate UX choice untuk koneksi tidak stabil).

---

## 📞 Kalau Stuck / Butuh Bantuan

1. **Baca dulu:** `CLAUDE.md` section "Troubleshooting Umum"
2. **Cek Vercel logs:** Dashboard → project → Deployments → latest → Function Logs
3. **Cek Supabase logs:** Dashboard → Logs → API / Realtime / Storage
4. **Debug PWA di HP:** Chrome DevTools → chrome://inspect#devices (Android USB debug)
5. **Cache issue:** Selalu coba `Ctrl+Shift+R` (hard reload) atau clear PWA storage dulu

---

## 📋 Checklist Handoff Selesai

- [ ] Env vars di dev baru sudah lengkap 7 keys (`.env.local`)
- [ ] `npm run dev` jalan tanpa error di `http://localhost:3000`
- [ ] Login pakai admin berhasil, sampai ke `/admin`
- [ ] Clock-in test dari HP karyawan berhasil (GPS + photo submit)
- [ ] Push notification test berhasil di 1 device (iOS or Android)
- [ ] Vercel deploy production berhasil, live di URL production
- [ ] Developer baru bisa jelaskan flow "PIN login → localStorage → protected pages"
- [ ] Developer baru tahu di mana bump `CACHE_NAME` kalau ada blank screen

---

_Dibuat: 20 April 2026 · Update file ini kalau ada perubahan proses onboarding._
