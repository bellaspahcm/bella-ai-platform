-- Migration: 20261120130000_interior_crm_security_invoker_and_actor_grants.sql
-- Purpose:
--   1. Enforce execution permissions on canonical tenant resolver public.interior_actor_tenant()
--      for role 'authenticated' and 'service_role' to enable RLS policy evaluation in authenticated user sessions.
--   2. Enforce security_invoker = true on compatibility views public.interior_customer_profiles
--      and public.interior_customer_merges to prevent PostgreSQL 15 security_definer owner bypass,
--      guaranteeing 100% cross-tenant isolation when queried by authenticated users.

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: Grant EXECUTE on interior_actor_tenant()
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.interior_actor_tenant() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: Enforce security_invoker = true on Compatibility Views
-- ─────────────────────────────────────────────────────────────────────────────

ALTER VIEW public.interior_customer_profiles SET (security_invoker = true);
ALTER VIEW public.interior_customer_merges SET (security_invoker = true);
