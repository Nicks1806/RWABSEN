-- ============================================================================
-- Update Office Location — RedWine Shoes & Bags
-- ============================================================================
--
-- Coordinates: 6°11'44.9"S 106°49'00.0"E
-- Decimal:     -6.195806, 106.816667
-- Location:    Thamrin City area, Jakarta
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Verify with the SELECT at bottom
-- ============================================================================

UPDATE settings
SET
  office_lat = -6.195806,
  office_lng = 106.816667,
  updated_at = NOW()
WHERE id IN (SELECT id FROM settings ORDER BY updated_at DESC LIMIT 1);

-- Verify the change:
SELECT
  id,
  office_lat,
  office_lng,
  radius_meters,
  work_start,
  work_end,
  updated_at
FROM settings
ORDER BY updated_at DESC
LIMIT 1;

-- Expected output: office_lat = -6.195806, office_lng = 106.816667
