-- Rollback Migration: 20261119090001_interior_crm_customer_persistence_rollback.sql
-- Purpose:
--   Emergency clean rollback plan for Phase C3 Customer Persistence.
-- Safety Notice:
--   - For local/staging drill recovery only.
--   - MUST NOT be executed on Production without explicit architect authorization.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- 1. Drop compatibility views
DROP VIEW IF EXISTS public.interior_customer_merges CASCADE;
DROP VIEW IF EXISTS public.interior_customer_profiles CASCADE;

-- 2. Drop merge stored procedure
DROP FUNCTION IF EXISTS public.interior_execute_customer_merge(UUID, UUID, UUID, TEXT, UUID);

-- 3. Remove customer_profile_id column & constraint from interior_projects
DROP INDEX IF EXISTS public.idx_interior_projects_customer_profile;
ALTER TABLE public.interior_projects
  DROP CONSTRAINT IF EXISTS fk_interior_projects_customer_profile;
ALTER TABLE public.interior_projects
  DROP COLUMN IF EXISTS customer_profile_id;

-- 4. Drop child tables in dependency order
DROP TABLE IF EXISTS public.interior_customer_merge_logs CASCADE;
DROP TABLE IF EXISTS public.interior_customer_aliases CASCADE;
DROP TABLE IF EXISTS public.interior_customer_addresses CASCADE;
DROP TABLE IF EXISTS public.interior_customer_contacts CASCADE;

-- 5. Drop hard delete trigger and base customer table
DROP TRIGGER IF EXISTS trg_interior_prevent_customer_hard_delete ON public.interior_customers;
DROP FUNCTION IF EXISTS public.interior_prevent_customer_hard_delete();
DROP TABLE IF EXISTS public.interior_customers CASCADE;

-- 6. Drop sequence function and table
DROP FUNCTION IF EXISTS public.interior_generate_customer_code(UUID);
DROP TABLE IF EXISTS public.interior_customer_sequences CASCADE;
