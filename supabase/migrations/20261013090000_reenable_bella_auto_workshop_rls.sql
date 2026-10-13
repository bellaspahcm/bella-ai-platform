-- Bella Auto workshop security repair
-- Evidence date: 2026-10-13
--
-- Real DB verification showed RLS disabled on the two primary workshop tables
-- while anon/authenticated grants allowed direct REST access. Existing policies
-- already use public.get_auth_tenant_id(); this migration reactivates that
-- database boundary and removes anonymous table access.

DO $$
BEGIN
  IF to_regclass('public.auto_service_appointments') IS NOT NULL THEN
    ALTER TABLE public.auto_service_appointments ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.auto_service_appointments FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_service_appointments TO authenticated;
  END IF;

  IF to_regclass('public.auto_repair_orders') IS NOT NULL THEN
    ALTER TABLE public.auto_repair_orders ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.auto_repair_orders FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auto_repair_orders TO authenticated;
  END IF;
END $$;

COMMENT ON TABLE public.auto_service_appointments IS
  'Bella Auto workshop appointments. RLS is required; tenant isolation is enforced by public.get_auth_tenant_id() policies.';

COMMENT ON TABLE public.auto_repair_orders IS
  'Bella Auto workshop repair orders. RLS is required; tenant isolation is enforced by public.get_auth_tenant_id() policies.';
