-- ============================================
-- Migration: Task Checklist & Comments
-- ============================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- Verify
SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks';
