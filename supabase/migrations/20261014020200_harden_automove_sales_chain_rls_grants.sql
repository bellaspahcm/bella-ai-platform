-- ============================================================================
-- AutoMove sales-chain RLS hardening
-- Scope: auto_leads, auto_bookings, auto_deposits only.
-- Forward migration only. No historical migration rewrite.
-- ============================================================================

DO $$
DECLARE
  missing_table TEXT;
BEGIN
  SELECT table_name
    INTO missing_table
    FROM (
      VALUES
        ('auto_leads'),
        ('auto_bookings'),
        ('auto_deposits')
    ) AS required_tables(table_name)
   WHERE to_regclass('public.' || required_tables.table_name) IS NULL
   LIMIT 1;

  IF missing_table IS NOT NULL THEN
    RAISE EXCEPTION 'AutoMove sales-chain RLS hardening requires public.% to exist.', missing_table;
  END IF;
END $$;

ALTER TABLE public.auto_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant view auto_leads" ON public.auto_leads;
DROP POLICY IF EXISTS "Tenant view auto_bookings" ON public.auto_bookings;
DROP POLICY IF EXISTS "Tenant view auto_deposits" ON public.auto_deposits;

DROP POLICY IF EXISTS auto_leads_tenant_select ON public.auto_leads;
DROP POLICY IF EXISTS auto_leads_tenant_insert ON public.auto_leads;
DROP POLICY IF EXISTS auto_leads_tenant_update ON public.auto_leads;

DROP POLICY IF EXISTS auto_bookings_tenant_select ON public.auto_bookings;
DROP POLICY IF EXISTS auto_bookings_tenant_insert ON public.auto_bookings;
DROP POLICY IF EXISTS auto_bookings_tenant_update ON public.auto_bookings;

DROP POLICY IF EXISTS auto_deposits_tenant_select ON public.auto_deposits;
DROP POLICY IF EXISTS auto_deposits_tenant_insert ON public.auto_deposits;
DROP POLICY IF EXISTS auto_deposits_tenant_update ON public.auto_deposits;

CREATE POLICY auto_leads_tenant_select
  ON public.auto_leads
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_leads_tenant_insert
  ON public.auto_leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_leads_tenant_update
  ON public.auto_leads
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_select
  ON public.auto_bookings
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_insert
  ON public.auto_bookings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_bookings_tenant_update
  ON public.auto_bookings
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_select
  ON public.auto_deposits
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_insert
  ON public.auto_deposits
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY auto_deposits_tenant_update
  ON public.auto_deposits
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

REVOKE ALL ON TABLE public.auto_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_bookings FROM PUBLIC;
REVOKE ALL ON TABLE public.auto_deposits FROM PUBLIC;

REVOKE ALL ON TABLE public.auto_leads FROM anon;
REVOKE ALL ON TABLE public.auto_bookings FROM anon;
REVOKE ALL ON TABLE public.auto_deposits FROM anon;

REVOKE ALL ON TABLE public.auto_leads FROM authenticated;
REVOKE ALL ON TABLE public.auto_bookings FROM authenticated;
REVOKE ALL ON TABLE public.auto_deposits FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auto_deposits TO authenticated;

DO $$
DECLARE
  unsafe_policy RECORD;
  unsafe_grant RECORD;
  public_grant RECORD;
BEGIN
  SELECT tablename, policyname
    INTO unsafe_policy
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND (
       COALESCE(qual, '') ILIKE '%get_auth_tenant_id() IS NULL%'
       OR COALESCE(with_check, '') ILIKE '%get_auth_tenant_id() IS NULL%'
       OR COALESCE(qual, '') ILIKE '%IS NULL OR%'
       OR COALESCE(with_check, '') ILIKE '%IS NULL OR%'
     )
   LIMIT 1;

  IF unsafe_policy.tablename IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe AutoMove sales-chain RLS policy remains on %.%: %.',
      'public', unsafe_policy.tablename, unsafe_policy.policyname;
  END IF;

  SELECT table_name, privilege_type
    INTO unsafe_grant
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND grantee = 'authenticated'
     AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
   LIMIT 1;

  IF unsafe_grant.table_name IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected authenticated % grant remains on public.%.',
      unsafe_grant.privilege_type, unsafe_grant.table_name;
  END IF;

  SELECT table_name, grantee, privilege_type
    INTO public_grant
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('auto_leads', 'auto_bookings', 'auto_deposits')
     AND grantee IN ('anon', 'PUBLIC')
   LIMIT 1;

  IF public_grant.table_name IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected % % grant remains on public.%.',
      public_grant.grantee, public_grant.privilege_type, public_grant.table_name;
  END IF;
END $$;

COMMENT ON POLICY auto_leads_tenant_select ON public.auto_leads IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';
COMMENT ON POLICY auto_bookings_tenant_select ON public.auto_bookings IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';
COMMENT ON POLICY auto_deposits_tenant_select ON public.auto_deposits IS
  'AutoMove sales-chain read: authenticated users may read only rows for their resolved tenant. Null-tenant fallback is intentionally forbidden.';
