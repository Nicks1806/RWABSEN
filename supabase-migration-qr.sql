-- ============================================
-- Migration: QR Code Clock-in
-- Run this in Supabase SQL Editor
-- ============================================

-- Tabel untuk rotating QR codes (valid 30 detik)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on qr_tokens" ON qr_tokens FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);

-- Add settings column untuk enable/disable QR
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS qr_required BOOLEAN DEFAULT false;

-- Enable realtime for QR tokens
ALTER PUBLICATION supabase_realtime ADD TABLE qr_tokens;

-- Auto-cleanup expired tokens (optional - pakai supabase scheduled function atau manual delete)
-- Contoh manual cleanup:
-- DELETE FROM qr_tokens WHERE expires_at < NOW() - INTERVAL '1 hour';
