-- The next migration performs a data update against bookings.package_name.
-- This column was historically added later in 20260515040000, so a clean replay
-- must create it before 20260515010000_the_great_purge.sql first writes it.
-- Existing databases that already have the column are left unchanged.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS package_name TEXT;
