BEGIN;

-- Read-only, current-caller Preschool branch catalog. No caller-selected
-- tenant/actor input and no direct SELECT grant on Platform org_units/users.
CREATE OR REPLACE FUNCTION public.edu_preschool_admin_branch_catalog()
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor record;
  v_tenant record;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'PRESCHOOL_BRANCH_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF NOT FOUND OR v_actor.id IS DISTINCT FROM auth.uid()
    OR v_actor.status IS DISTINCT FROM 'active'
    OR v_actor.tenant_status IS DISTINCT FROM 'active'
    OR lower(v_actor.role) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PRESCHOOL_BRANCH_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tenant FROM public.platform_current_actor_tenant_presentation();
  IF NOT FOUND OR v_tenant.tenant_id IS DISTINCT FROM v_actor.tenant_id
    OR v_tenant.tenant_status IS DISTINCT FROM 'active'
    OR v_tenant.product_key IS DISTINCT FROM 'bella_preschool' THEN
    RAISE EXCEPTION 'PRESCHOOL_BRANCH_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT unit.id, unit.name::text
    FROM public.org_units AS unit
    WHERE unit.tenant_id = v_actor.tenant_id
      AND unit.unit_type = 'branch'
      AND unit.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM public.platform_current_actor_org_unit_access() AS access
        WHERE access.user_id = auth.uid()
          AND access.tenant_id = v_actor.tenant_id
          AND access.org_unit_id = unit.id
          AND access.relationship_id IS NULL
          AND access.access_source = 'tenant_admin'
      )
    ORDER BY unit.name, unit.id;
END;
$$;

REVOKE ALL ON FUNCTION public.edu_preschool_admin_branch_catalog()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_admin_branch_catalog() TO authenticated;
COMMENT ON FUNCTION public.edu_preschool_admin_branch_catalog() IS
  'Returns active Preschool branches for the authenticated active tenant admin. Tenant and actor are derived from Platform caller contracts; no direct org_units/users table grant.';

NOTIFY pgrst, 'reload schema';
COMMIT;
