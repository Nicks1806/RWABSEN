-- ============================================
-- Migration: Add per-day schedule per employee
-- Run this in Supabase SQL Editor
-- ============================================

-- Add schedule JSONB column for per-day work hours
-- Format: { "mon": {start: "09:00", end: "18:00", off: false}, "tue": ..., ... }
-- Keys: mon, tue, wed, thu, fri, sat, sun
-- If schedule is NULL or day is missing, uses employees.work_start/work_end or settings default
-- off=true means employee is off that day
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS schedule JSONB;
