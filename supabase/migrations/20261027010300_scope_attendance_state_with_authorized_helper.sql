BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regprocedure('public.edu_can_access_attendance_enrollment(uuid,uuid,date)') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class
      WHERE oid = 'public.edu_attendance_daily_state'::regclass AND relrowsecurity
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.edu_attendance_daily_state'::regclass
        AND polname = 'roster_rpc_state_allow'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = 'public.edu_attendance_daily_state'::regclass
        AND polname = 'roster_rpc_state_guard'
    ) THEN
    RAISE EXCEPTION 'ATTENDANCE_STATE_POLICY_PRECONDITION_FAILED';
  END IF;
END;
$preflight$;

-- Keep the existing authorization contract as the sole attendance-row predicate.
-- Its SECURITY DEFINER boundary resolves the current authenticated tenant and
-- branch without requiring callers to read public.tenants from an RLS policy.
DROP POLICY roster_rpc_state_allow ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_allow
  ON public.edu_attendance_daily_state
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day));

DROP POLICY roster_rpc_state_guard ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_guard
  ON public.edu_attendance_daily_state
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day));

COMMIT;
