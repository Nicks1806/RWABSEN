-- ============================================
-- Migration: Reimbursements
-- ============================================

CREATE TABLE IF NOT EXISTS reimbursements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'umum',
  transaction_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on reimbursements" ON reimbursements;
CREATE POLICY "Allow all on reimbursements" ON reimbursements FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_reimb_employee ON reimbursements(employee_id);
CREATE INDEX IF NOT EXISTS idx_reimb_status ON reimbursements(status);

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reimbursements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reimbursements;
  END IF;
END $$;

SELECT 'Reimbursements setup complete' as info;
