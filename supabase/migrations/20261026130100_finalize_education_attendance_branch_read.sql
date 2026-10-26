-- Finalize the authenticated branch-read ACL/policies after the roster RPC
-- capability migration; this also reconciles E2E environments that recorded
-- the earlier policy-only 20261026100000 candidate.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  v_access_helper regprocedure := to_regprocedure('public.edu_can_access_attendance_enrollment(uuid,uuid,date)');
  v_roster_rpc regprocedure := to_regprocedure('public.edu_preschool_roster_identity(uuid,date)');
BEGIN
  IF v_access_helper IS NULL OR v_roster_rpc IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_BRANCH_READ_CAPABILITY_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'edu_attendance_daily_state'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_DAILY_STATE_RLS_DISABLED';
  END IF;
  IF has_table_privilege('anon', 'public.edu_attendance_daily_state', 'SELECT')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'INSERT')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'DELETE') THEN
    RAISE EXCEPTION 'ATTENDANCE_DAILY_STATE_ACL_PREFLIGHT_FAILED';
  END IF;
  IF NOT has_function_privilege('authenticated', v_access_helper, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', v_roster_rpc, 'EXECUTE')
    OR has_function_privilege('anon', v_access_helper, 'EXECUTE')
    OR has_function_privilege('anon', v_roster_rpc, 'EXECUTE') THEN
    RAISE EXCEPTION 'ATTENDANCE_BRANCH_READ_RPC_ACL_PREFLIGHT_FAILED';
  END IF;
END;
$preflight$;

GRANT SELECT ON TABLE public.edu_attendance_daily_state TO authenticated;

-- Remove the earlier policy-only candidate, which constrained every Education
-- product. These policies isolate Preschool while preserving the tenant policy
-- for other products and ensuring it cannot bypass Preschool branch scope.
DROP POLICY IF EXISTS edu_attendance_daily_state_branch_scope ON public.edu_attendance_daily_state;
DROP POLICY IF EXISTS roster_rpc_state_allow ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_allow
  ON public.edu_attendance_daily_state
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT t.product_key FROM public.tenants t WHERE t.id = edu_attendance_daily_state.tenant_id) = 'bella_preschool'
    AND public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)
  );

DROP POLICY IF EXISTS roster_rpc_state_guard ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_guard
  ON public.edu_attendance_daily_state
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = edu_attendance_daily_state.tenant_id
        AND t.product_key IS DISTINCT FROM 'bella_preschool'
    )
    OR public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)
  );

COMMIT;
