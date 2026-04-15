-- ============================================
-- Migration: Add default work days in settings
-- Run this in Supabase SQL Editor
-- ============================================

-- Default work days (array of day keys: mon, tue, wed, thu, fri, sat, sun)
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["mon","tue","wed","thu","fri","sat"]'::jsonb;

-- Update existing settings to have default (Mon-Sat working)
UPDATE settings
SET work_days = '["mon","tue","wed","thu","fri","sat"]'::jsonb
WHERE work_days IS NULL;
