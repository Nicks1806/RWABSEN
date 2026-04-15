-- ============================================
-- Migration: Push Notifications
-- Run this in Supabase SQL Editor
-- ============================================

-- Store browser push subscriptions per employee/device
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on push_subscriptions" ON push_subscriptions;
CREATE POLICY "Allow all on push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON push_subscriptions(employee_id);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'push_subscriptions' ORDER BY ordinal_position;
