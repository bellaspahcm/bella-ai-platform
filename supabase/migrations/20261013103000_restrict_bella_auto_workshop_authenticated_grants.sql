-- Bella Auto workshop least-privilege closure
-- Evidence date: 2026-10-13
--
-- RLS is already enabled and anon access is already revoked by
-- 20261013090000_reenable_bella_auto_workshop_rls.sql. This migration only
-- removes table-management privileges from the authenticated runtime role
-- while preserving normal CRUD access for existing RLS policies.

DO $$
BEGIN
  IF to_regclass('public.auto_service_appointments') IS NOT NULL THEN
    -- zero-downtime: allow truncate - this revokes the table privilege only; it does not truncate data.
    REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.auto_service_appointments FROM authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_service_appointments TO authenticated;
  END IF;

  IF to_regclass('public.auto_repair_orders') IS NOT NULL THEN
    -- zero-downtime: allow truncate - this revokes the table privilege only; it does not truncate data.
    REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public.auto_repair_orders FROM authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_repair_orders TO authenticated;
  END IF;
END $$;
