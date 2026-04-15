-- ============================================
-- Migration: Set jadwal per karyawan
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Update existing employees with their schedules

-- ARIA - libur Minggu, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'aria';

-- NORMAN - libur Minggu, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'norman';

-- EVRI - libur Senin, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"mon": {"off": true}}'::jsonb
WHERE LOWER(name) = 'evri';

-- TATI - libur Selasa, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"tue": {"off": true}}'::jsonb
WHERE LOWER(name) = 'tati';

-- HELLEN - libur Rabu, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"wed": {"off": true}}'::jsonb
WHERE LOWER(name) = 'hellen';

-- SURYA - libur Sabtu, jam 09:30-18:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"sat": {"off": true}}'::jsonb
WHERE LOWER(name) = 'surya';

-- GRACE - libur Sabtu & Minggu, jam 09:30-17:30
UPDATE employees SET
  work_start = '09:30:00',
  work_end = '17:30:00',
  schedule = '{"sat": {"off": true}, "sun": {"off": true}}'::jsonb
WHERE LOWER(name) = 'grace';

-- 2. Add new employees if not exist

-- TIWI - libur Jumat, jam 09:30-18:30 (PIN: 000011)
INSERT INTO employees (name, pin, role, work_start, work_end, schedule, is_active)
SELECT 'Tiwi', '000011', 'employee', '09:30:00', '18:30:00', '{"fri": {"off": true}}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE LOWER(name) = 'tiwi');

UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"fri": {"off": true}}'::jsonb
WHERE LOWER(name) = 'tiwi';

-- MOTY - libur Kamis, jam 09:30-18:30 (PIN: 000012)
INSERT INTO employees (name, pin, role, work_start, work_end, schedule, is_active)
SELECT 'Moty', '000012', 'employee', '09:30:00', '18:30:00', '{"thu": {"off": true}}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE LOWER(name) = 'moty');

UPDATE employees SET
  work_start = '09:30:00',
  work_end = '18:30:00',
  schedule = '{"thu": {"off": true}}'::jsonb
WHERE LOWER(name) = 'moty';

-- 3. Settings: all 7 days are "workable" (biar schedule per karyawan yg atur)
UPDATE settings SET
  work_days = '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb
WHERE id = (SELECT id FROM settings LIMIT 1);

-- Verify: cek hasil
SELECT name, work_start, work_end, schedule FROM employees ORDER BY name;
