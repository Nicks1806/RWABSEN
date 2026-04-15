-- ============================================
-- RedWine Attendance - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Employees table
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Attendance records
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

-- 3. Settings table (work hours, office location, radius)
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  office_lat DOUBLE PRECISION NOT NULL,
  office_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  work_start TIME NOT NULL DEFAULT '09:30',
  work_end TIME NOT NULL DEFAULT '18:30',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insert default settings (update office coordinates later)
INSERT INTO settings (office_lat, office_lng, radius_meters, work_start, work_end)
VALUES (-6.1947, 106.8164, 100, '09:30', '18:30');

-- 5. Insert default admin account (PIN: 123456)
INSERT INTO employees (name, pin, role)
VALUES ('Admin', '123456', 'admin');

-- 6. Insert employees
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

-- 7. Create storage bucket for attendance photos
-- (Do this in Supabase Dashboard > Storage > New Bucket > "attendance-photos" > Public)

-- 8. RLS Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since we use PIN auth, not Supabase Auth)
CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- 9. Indexes for performance
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_employees_pin ON employees(pin);
