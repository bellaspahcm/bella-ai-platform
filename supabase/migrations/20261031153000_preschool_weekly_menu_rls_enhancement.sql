-- ============================================================================
-- BELLA PRESCHOOL OS: ENHANCED RLS POLICIES FOR WEEKLY NUTRITION MENUS
-- Migration: 20261031153000_preschool_weekly_menu_rls_enhancement.sql
-- Description:
--   Harmonize RLS on edu_weekly_menus & edu_weekly_menu_days with public.get_auth_tenant_id()
--   and ensure both SELECT and INSERT/UPDATE/DELETE (WITH CHECK) work across authenticated
--   preschool staff and service roles while strictly enforcing Gate 0 tenant isolation.
-- ============================================================================

BEGIN;

-- Drop previous policies if present
DROP POLICY IF EXISTS tenant_isolation_edu_weekly_menus ON public.edu_weekly_menus;
DROP POLICY IF EXISTS tenant_isolation_edu_weekly_menu_days ON public.edu_weekly_menu_days;

-- Re-create canonical tenant isolation policy on edu_weekly_menus
CREATE POLICY tenant_isolation_edu_weekly_menus ON public.edu_weekly_menus
  FOR ALL
  USING (
    tenant_id = public.get_auth_tenant_id()
    OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
    OR current_setting('role', true) = 'service_role'
  )
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
    OR current_setting('role', true) = 'service_role'
  );

-- Re-create canonical tenant isolation policy on edu_weekly_menu_days
CREATE POLICY tenant_isolation_edu_weekly_menu_days ON public.edu_weekly_menu_days
  FOR ALL
  USING (
    tenant_id = public.get_auth_tenant_id()
    OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
    OR current_setting('role', true) = 'service_role'
  )
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
    OR current_setting('role', true) = 'service_role'
  );

COMMIT;

