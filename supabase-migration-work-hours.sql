-- ============================================
-- Migration: Add custom work hours per employee
-- Run this in Supabase SQL Editor
-- ============================================

-- Add work_start and work_end columns to employees (nullable - fallback to settings)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME;

-- Optional: Set specific hours for employees who have different shifts
-- Example (uncomment and adjust):
-- UPDATE employees SET work_start = '08:00', work_end = '17:00' WHERE name = 'Aria';
-- UPDATE employees SET work_start = '10:00', work_end = '19:00' WHERE name = 'Grace';
