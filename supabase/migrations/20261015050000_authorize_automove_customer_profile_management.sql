-- Existing AutoMove preference storage lacks authenticated access.
-- Only customer-owned preference rows are writable; no new table/helper.
DO $$ BEGIN
  IF to_regclass('public.auto_customer_profiles') IS NULL THEN
    RAISE EXCEPTION 'Canonical AutoMove customer profiles must already exist';
  END IF;
END $$;

DROP POLICY IF EXISTS "Tenant view auto_customer_profiles" ON public.auto_customer_profiles;
CREATE POLICY automove_customer_profile_tenant_access ON public.auto_customer_profiles
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.tenant_id = auto_customer_profiles.tenant_id)
  )
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.tenant_id = auto_customer_profiles.tenant_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.auto_customer_profiles TO authenticated;
