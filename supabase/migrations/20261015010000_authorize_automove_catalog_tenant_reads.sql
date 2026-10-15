-- AutoMove catalog read boundary only. Historical policies and write ACLs stay intact.
-- Restrictive SELECT guards are ANDed with existing permissive SELECT/ALL policies.
-- SELECT policies can also affect write row selection: stop if writers need review.
DO $$
DECLARE
  target_name TEXT;
  target_oid OID;
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Catalog reads require canonical public.users and public.tenants.';
  END IF;
  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants']
  LOOP
    target_oid := to_regclass('public.' || target_name);
    IF target_oid IS NULL THEN
      RAISE EXCEPTION 'Catalog read authorization requires public.%.', target_name;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = target_oid) THEN
      RAISE EXCEPTION 'Catalog read authorization requires existing RLS on public.%.', target_name;
    END IF;
    IF has_table_privilege('authenticated', target_oid, 'INSERT,UPDATE,DELETE')
       OR has_any_column_privilege('authenticated', target_oid, 'INSERT,UPDATE') THEN
      RAISE EXCEPTION 'Catalog authenticated writers require a separate impact review: public.%.', target_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = target_oid AND p.polpermissive AND p.polcmd IN ('r', '*')
        AND (0::oid = ANY(p.polroles) OR 'authenticated'::regrole::oid = ANY(p.polroles))
    ) THEN
      RAISE EXCEPTION 'Catalog read authorization requires an existing permissive read policy: public.%.', target_name;
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS auto_brands_tenant_read_guard ON public.auto_brands;
CREATE POLICY auto_brands_tenant_read_guard ON public.auto_brands
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_brands.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_models_tenant_read_guard ON public.auto_models;
CREATE POLICY auto_models_tenant_read_guard ON public.auto_models
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_models.tenant_id AND t.status = 'active'
  ));

DROP POLICY IF EXISTS auto_variants_tenant_read_guard ON public.auto_variants;
CREATE POLICY auto_variants_tenant_read_guard ON public.auto_variants
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
      AND u.tenant_id = auto_variants.tenant_id AND t.status = 'active'
  ));

REVOKE SELECT ON TABLE public.auto_brands, public.auto_models, public.auto_variants FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.auto_brands, public.auto_models, public.auto_variants TO authenticated;

DO $$
DECLARE
  target_name TEXT;
BEGIN
  FOREACH target_name IN ARRAY ARRAY['auto_brands', 'auto_models', 'auto_variants']
  LOOP
    IF has_any_column_privilege('anon', 'public.' || target_name, 'SELECT') THEN
      RAISE EXCEPTION 'Catalog anonymous inherited/column SELECT requires separate review: public.%.', target_name;
    END IF;
  END LOOP;
END $$;
