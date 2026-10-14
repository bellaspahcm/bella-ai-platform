-- ============================================================================
-- Harden policy_registry RLS profile references
-- Scope: remove legacy policy_registry policies that referenced public.profiles
-- and leave only the approved active-global accounting policy read boundary.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.policy_registry') IS NULL THEN
    RAISE EXCEPTION 'policy_registry RLS hardening requires public.policy_registry.';
  END IF;
END $$;

DROP POLICY IF EXISTS "policy_registry_read" ON public.policy_registry;
DROP POLICY IF EXISTS "policy_registry_insert" ON public.policy_registry;
DROP POLICY IF EXISTS "policy_registry_update" ON public.policy_registry;
DROP POLICY IF EXISTS "policy_registry_delete" ON public.policy_registry;

ALTER TABLE public.policy_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'policy_registry'
       AND policyname = 'policy_registry_read_active_global_accounting_policy'
  ) THEN
    CREATE POLICY "policy_registry_read_active_global_accounting_policy"
      ON public.policy_registry
      FOR SELECT TO authenticated
      USING (
        tenant_id IS NULL
        AND status = 'active'
        AND is_active = true
        AND deleted_at IS NULL
      );
  END IF;
END $$;

REVOKE ALL ON TABLE public.policy_registry FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_registry FROM anon;
REVOKE ALL ON TABLE public.policy_registry FROM authenticated;
GRANT SELECT ON TABLE public.policy_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.policy_registry TO service_role;

DO $$
DECLARE
  legacy_policy TEXT;
  unexpected_policy TEXT;
BEGIN
  SELECT policyname
    INTO legacy_policy
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'policy_registry'
     AND (
       COALESCE(qual, '') ILIKE '%profiles%'
       OR COALESCE(with_check, '') ILIKE '%profiles%'
     )
   LIMIT 1;

  IF legacy_policy IS NOT NULL THEN
    RAISE EXCEPTION 'policy_registry RLS policy % still references legacy profiles identity.', legacy_policy;
  END IF;

  SELECT policyname
    INTO unexpected_policy
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'policy_registry'
     AND policyname <> 'policy_registry_read_active_global_accounting_policy'
   LIMIT 1;

  IF unexpected_policy IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected policy_registry RLS policy remains: %.', unexpected_policy;
  END IF;
END $$;

COMMENT ON POLICY "policy_registry_read_active_global_accounting_policy" ON public.policy_registry IS
  'Authenticated users may read only active non-deleted global policies. Legacy profile-based policy_registry policies are intentionally removed.';
