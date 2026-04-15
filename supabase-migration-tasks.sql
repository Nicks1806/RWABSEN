-- ============================================
-- Migration: Tasks (Kanban Board)
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'brief' CHECK (status IN ('brief', 'today', 'done', 'history')),
  color TEXT DEFAULT 'red' CHECK (color IN ('red', 'yellow', 'green', 'blue', 'purple', 'gray')),
  assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  due_date DATE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;
