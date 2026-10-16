-- Explicit Platform tenant management, not a NULL-tenant bypass into Product data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenants'::regclass AND polname = 'platform_active_hq_tenant_select') THEN
    CREATE POLICY platform_active_hq_tenant_select ON public.tenants
      FOR SELECT TO authenticated USING (public.is_hq_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenants'::regclass AND polname = 'platform_active_hq_tenant_update') THEN
    CREATE POLICY platform_active_hq_tenant_update ON public.tenants
      FOR UPDATE TO authenticated
      USING (public.is_hq_super_admin()) WITH CHECK (public.is_hq_super_admin());
  END IF;
END;
$$;

ALTER POLICY platform_active_hq_tenant_select ON public.tenants
  TO authenticated USING (public.is_hq_super_admin());
ALTER POLICY platform_active_hq_tenant_update ON public.tenants
  TO authenticated USING (public.is_hq_super_admin()) WITH CHECK (public.is_hq_super_admin());
