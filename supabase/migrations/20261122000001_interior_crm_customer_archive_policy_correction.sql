-- ============================================================
-- Bella Interior OS — Corrective Migration
-- RC-1.0.0 Customer Archive Lifecycle Policy Correction
-- ============================================================
-- Owner Decision (22/11/2026): Customer Hard Delete is permanently
-- prohibited. Customer lifecycle is preserved via
-- profile_status = 'inactive' (Archive).
--
-- This migration ensures that any environment that had the original
-- migration 20261121000050 applied (which included customer:delete
-- permission and DELETE policy) is corrected to match the
-- authoritative state.
--
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Remove Hard Delete permission if it was previously granted
DELETE FROM interior_permissions
WHERE module_key = 'interior' AND action_key = 'customer:delete';

-- 2. Remove DELETE RLS policy if it exists
DROP POLICY IF EXISTS interior_customers_delete ON public.interior_customers;

-- 3. Revoke DELETE privilege from authenticated role (not from system roles)
REVOKE DELETE ON public.interior_customers FROM authenticated;

-- 4. Ensure the unique index exists (applied directly on Production 22/11/2026)
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_notes_tenant_id_id
  ON public.interior_acceptance_notes (tenant_id, id);

-- ============================================================
-- Expected post-state:
--   interior_permissions: NO row with action_key = 'customer:delete'
--   pg_policies: NO interior_customers_delete policy
--   role_table_grants: authenticated has SELECT, INSERT, UPDATE only
--   pg_indexes: uq_interior_acceptance_notes_tenant_id_id EXISTS
-- ============================================================
