-- ============================================================================
-- RLS HARDENING — Optional tighter policies for RedWine Attendance
-- ============================================================================
--
-- CONTEXT:
-- This app uses client-side PIN auth (localStorage employee) with Supabase
-- ANON_KEY. There's NO Supabase Auth / JWT — so Postgres cannot verify "who"
-- the caller is. All existing policies are `USING (true)` (fully open).
--
-- THIS FILE offers a middle-ground: restrict destructive operations (DELETE,
-- UPDATE of sensitive columns) while keeping reads + inserts open.
--
-- HOW TO APPLY:
-- 1. Run in Supabase SQL Editor (or psql)
-- 2. Policies are drop-if-exists then recreate → safe to re-run
-- 3. If something breaks, re-run supabase-schema.sql to restore defaults
--
-- TRADE-OFFS:
-- - Employees can still READ all employee data (names, positions visible)
-- - Employees can still INSERT attendance/leaves/reimbursements for themselves
-- - Only DELETE + sensitive UPDATE are blocked at DB level
-- - App-layer should still enforce admin-only actions (defense in depth)
-- ============================================================================

-- ===== SETTINGS: block UPDATE from client (admin must use service role or explicit RPC) =====
-- Settings control office GPS, radius, work hours — critical. Block all writes.
DROP POLICY IF EXISTS "Allow all on settings" ON settings;
DROP POLICY IF EXISTS "Read settings" ON settings;
DROP POLICY IF EXISTS "Insert settings" ON settings;
DROP POLICY IF EXISTS "Update settings" ON settings;
DROP POLICY IF EXISTS "Delete settings" ON settings;

CREATE POLICY "Read settings" ON settings FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE disabled from client. Admin updates settings via
-- Next.js API route using SERVICE_ROLE_KEY (bypasses RLS).

-- ===== EMPLOYEES: block DELETE from client =====
-- Accidental / malicious delete of an employee record would wipe history.
DROP POLICY IF EXISTS "Allow all on employees" ON employees;
DROP POLICY IF EXISTS "Read employees" ON employees;
DROP POLICY IF EXISTS "Insert employees" ON employees;
DROP POLICY IF EXISTS "Update employees" ON employees;
DROP POLICY IF EXISTS "Delete employees" ON employees;

CREATE POLICY "Read employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Insert employees" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Update employees" ON employees FOR UPDATE USING (true);
-- DELETE disabled from client. Use soft-delete (is_active = false) via UPDATE.
-- Hard delete requires service role / SQL console.

-- ===== QR_TOKENS: read-only from client =====
-- QR tokens are the physical clock-in trigger. Don't let clients regenerate.
DROP POLICY IF EXISTS "Allow all on qr_tokens" ON qr_tokens;
DROP POLICY IF EXISTS "Read qr_tokens" ON qr_tokens;
DROP POLICY IF EXISTS "Insert qr_tokens" ON qr_tokens;
DROP POLICY IF EXISTS "Update qr_tokens" ON qr_tokens;
DROP POLICY IF EXISTS "Delete qr_tokens" ON qr_tokens;

CREATE POLICY "Read qr_tokens" ON qr_tokens FOR SELECT USING (true);
-- INSERT / DELETE via /admin/qr page currently bypasses this. Admin must be
-- migrated to use a service-role API route, OR admin's browser must use a
-- privileged key (not recommended). For now, this lockdown only protects
-- against non-admin clients tampering.

-- ===== PUSH_SUBSCRIPTIONS: allow INSERT but not bulk DELETE =====
-- Prevent one user from wiping other subscriptions.
DROP POLICY IF EXISTS "Allow all on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Read push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Insert push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Update push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Delete push_subscriptions" ON push_subscriptions;

CREATE POLICY "Read push_subscriptions" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Insert push_subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (true);
-- DELETE happens from /api/push/send route using service role key when
-- a subscription returns 404/410, so DELETE from client is blocked.

-- ===== ANNOUNCEMENTS: read open, write via admin-only API =====
DROP POLICY IF EXISTS "Allow all on announcements" ON announcements;
DROP POLICY IF EXISTS "Read announcements" ON announcements;
DROP POLICY IF EXISTS "Insert announcements" ON announcements;
DROP POLICY IF EXISTS "Update announcements" ON announcements;
DROP POLICY IF EXISTS "Delete announcements" ON announcements;

CREATE POLICY "Read announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY "Insert announcements" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Update announcements" ON announcements FOR UPDATE USING (true);
-- DELETE blocked. Admin soft-deletes via is_active = false.

-- ===== ATTENDANCE: prevent backdating / deletion =====
DROP POLICY IF EXISTS "Allow all on attendance" ON attendance;
DROP POLICY IF EXISTS "Read attendance" ON attendance;
DROP POLICY IF EXISTS "Insert attendance" ON attendance;
DROP POLICY IF EXISTS "Update attendance" ON attendance;
DROP POLICY IF EXISTS "Delete attendance" ON attendance;

CREATE POLICY "Read attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Insert attendance" ON attendance FOR INSERT WITH CHECK (
  date = CURRENT_DATE  -- Can only insert today's record (no backdating)
);
CREATE POLICY "Update attendance" ON attendance FOR UPDATE USING (
  date = CURRENT_DATE  -- Can only update today's record (for clock-out)
);
-- DELETE blocked. Historical attendance is immutable from client.

-- ===== LEAVES / REIMBURSEMENTS: block delete of approved records =====
DROP POLICY IF EXISTS "Allow all on leaves" ON leaves;
DROP POLICY IF EXISTS "Read leaves" ON leaves;
DROP POLICY IF EXISTS "Insert leaves" ON leaves;
DROP POLICY IF EXISTS "Update leaves" ON leaves;
DROP POLICY IF EXISTS "Delete leaves" ON leaves;

CREATE POLICY "Read leaves" ON leaves FOR SELECT USING (true);
CREATE POLICY "Insert leaves" ON leaves FOR INSERT WITH CHECK (true);
CREATE POLICY "Update leaves" ON leaves FOR UPDATE USING (true);
CREATE POLICY "Delete leaves" ON leaves FOR DELETE USING (status = 'pending');
-- Only pending leaves can be deleted. Approved/rejected are immutable audit trail.

DROP POLICY IF EXISTS "Allow all on reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Read reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Insert reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Update reimbursements" ON reimbursements;
DROP POLICY IF EXISTS "Delete reimbursements" ON reimbursements;

CREATE POLICY "Read reimbursements" ON reimbursements FOR SELECT USING (true);
CREATE POLICY "Insert reimbursements" ON reimbursements FOR INSERT WITH CHECK (true);
CREATE POLICY "Update reimbursements" ON reimbursements FOR UPDATE USING (true);
CREATE POLICY "Delete reimbursements" ON reimbursements FOR DELETE USING (status = 'pending');

-- ===== BOARDS / BOARD_COLUMNS / BOARD_MESSAGES (if they exist) =====
-- Enable RLS if not already. Drop-create policies.
-- (Harmless if tables don't exist — the ALTER will silently fail.)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'boards') THEN
    ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all on boards" ON boards;
    DROP POLICY IF EXISTS "Read boards" ON boards;
    DROP POLICY IF EXISTS "Write boards" ON boards;
    CREATE POLICY "Read boards" ON boards FOR SELECT USING (true);
    CREATE POLICY "Write boards" ON boards FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'board_columns') THEN
    ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all on board_columns" ON board_columns;
    DROP POLICY IF EXISTS "All board_columns" ON board_columns;
    CREATE POLICY "All board_columns" ON board_columns FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'board_messages') THEN
    ALTER TABLE board_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all on board_messages" ON board_messages;
    DROP POLICY IF EXISTS "Read board_messages" ON board_messages;
    DROP POLICY IF EXISTS "Insert board_messages" ON board_messages;
    DROP POLICY IF EXISTS "Delete board_messages" ON board_messages;
    CREATE POLICY "Read board_messages" ON board_messages FOR SELECT USING (true);
    CREATE POLICY "Insert board_messages" ON board_messages FOR INSERT WITH CHECK (true);
    -- Messages immutable once sent (no UPDATE policy)
    CREATE POLICY "Delete board_messages" ON board_messages FOR DELETE USING (
      created_at > NOW() - INTERVAL '5 minutes'  -- Only delete within 5 min of sending
    );
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK (uncomment if you want to revert to fully-open policies):
-- ============================================================================
-- DROP POLICY IF EXISTS ... ON each_table;
-- CREATE POLICY "Allow all on xxx" ON xxx FOR ALL USING (true) WITH CHECK (true);
