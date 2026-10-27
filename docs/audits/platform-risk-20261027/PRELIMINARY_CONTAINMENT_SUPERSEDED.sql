-- SUPERSEDED AFTER LIVE CONSUMER DISCOVERY. DO NOT EXECUTE.
-- This table-only candidate is preserved as an audit receipt, not as an action plan.
-- PROPOSAL ONLY. NOT EXECUTED. Requires explicit owner authorization for primary ACL changes.
-- Target project: lvnvkpyxtuilhrabtlwv, selected explicitly by the execution command.
-- Five tables only. Revoke direct browser-role access; preserve service_role privileges.
-- This can interrupt an undocumented direct authenticated consumer. It does not
-- implement tenant-aware RLS and does not close the other catalog findings.
-- Before any authorized execution, refresh the saved preflight and review the
-- affected Product/Kernel consumers; do not replace these fingerprints silently.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  target record;
  actual record;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('auto_bookings_history', '1db41df921044d21d6e370df3df45b0b'),
    ('auto_customer_journeys_history', 'eaa69ac629e8545f45452d5fc7aa80c6'),
    ('auto_vehicles_history', '1db41df921044d21d6e370df3df45b0b'),
    ('hc_temporal_events', 'eaa69ac629e8545f45452d5fc7aa80c6'),
    ('hc_temporal_snapshots', 'eaa69ac629e8545f45452d5fc7aa80c6')
  ) AS expected(table_name, acl_md5)
  LOOP
    SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity,
      pg_get_userbyid(c.relowner) AS owner_role,
      md5(coalesce(c.relacl::text, '')) AS acl_md5
    INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = target.table_name AND c.relkind = 'r';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONTAINMENT_TABLE_MISSING: %', target.table_name;
    END IF;
    IF actual.owner_role <> 'postgres' OR actual.relrowsecurity OR actual.relforcerowsecurity
      OR actual.acl_md5 <> target.acl_md5 THEN
      RAISE EXCEPTION 'CONTAINMENT_PREFLIGHT_DRIFT: %', target.table_name;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = actual.oid
      AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
      RAISE EXCEPTION 'CONTAINMENT_COLUMN_ACL_REVIEW_REQUIRED: %', target.table_name;
    END IF;
  END LOOP;
END;
$preflight$;

REVOKE ALL PRIVILEGES ON TABLE
  public.auto_bookings_history,
  public.auto_customer_journeys_history,
  public.auto_vehicles_history,
  public.hc_temporal_events,
  public.hc_temporal_snapshots
FROM PUBLIC, anon, authenticated;

DO $postcondition$
DECLARE
  table_name text;
  role_name text;
  privilege_name text;
  table_oid regclass;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'auto_bookings_history', 'auto_customer_journeys_history', 'auto_vehicles_history',
    'hc_temporal_events', 'hc_temporal_snapshots'
  ] LOOP
    table_oid := format('public.%I', table_name)::regclass;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(role_name, table_oid, privilege_name) THEN
          RAISE EXCEPTION 'CONTAINMENT_ROLE_STILL_PRIVILEGED: %.% %', role_name, table_name, privilege_name;
        END IF;
      END LOOP;
    END LOOP;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
      IF NOT has_table_privilege('service_role', table_oid, privilege_name) THEN
        RAISE EXCEPTION 'CONTAINMENT_SERVICE_ROLE_REGRESSION: % %', table_name, privilege_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$postcondition$;
COMMIT;

-- After an authorized commit: repeat catalog/role checks and anonymous HTTP HEAD
-- (expect denied access), then exercise the approved server-side business flows.
-- Historical ACLs are preserved in containment-preflight.json. Restoring their
-- anonymous grants would reopen the finding; recovery needs its own owner decision.
