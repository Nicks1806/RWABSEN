-- ============================================
-- Migration V2: Profile Lengkap + Sistem Izin/Cuti
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Tambah profile columns ke employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE;

-- 2. Tabel leaves (izin/cuti/sakit)
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

-- 3. RLS
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on leaves" ON leaves;
CREATE POLICY "Allow all on leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date);

-- 5. Add leaves to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leaves;

-- 6. Storage bucket untuk attachment izin (surat dokter dll)
-- Lakukan manual di Supabase Storage: buat bucket "leave-attachments" (Public)

-- Verifikasi
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'employees' ORDER BY ordinal_position;
