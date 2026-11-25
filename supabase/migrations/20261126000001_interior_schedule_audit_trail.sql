-- ============================================================
-- Bella Interior OS — Scheduled Events Audit Trail & Timestamps
-- Migration: 20261126000001_interior_schedule_audit_trail
--
-- Purpose: Add lifecycle tracking columns to interior_scheduled_events:
--   created_by_name, started_at, started_by_id, started_by_name,
--   completed_at, completed_by_id, completed_by_name, and status_history
--   for lead time measurement, auditability, and performance analytics.
-- Change Authority: PRODUCT layer only — no Kernel tables touched.
-- ============================================================

ALTER TABLE public.interior_scheduled_events
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by_id uuid,
  ADD COLUMN IF NOT EXISTS started_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by_id uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;
