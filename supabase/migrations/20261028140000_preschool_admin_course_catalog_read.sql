BEGIN;

-- Admin-only, current-caller Preschool class identity read. The caller cannot
-- choose an actor or tenant, and no table SELECT grant is added.
CREATE OR REPLACE FUNCTION public.edu_preschool_admin_course_catalog(p_course_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  course_code text,
  title text,
  status text,
  prerequisite_course_codes text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor record;
  v_tenant record;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'PRESCHOOL_COURSE_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Reuse Platform's live, zero-argument caller identity and tenant contracts.
  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF NOT FOUND OR v_actor.id IS DISTINCT FROM auth.uid()
    OR v_actor.status IS DISTINCT FROM 'active'
    OR v_actor.tenant_status IS DISTINCT FROM 'active'
    OR lower(v_actor.role) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PRESCHOOL_COURSE_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tenant FROM public.platform_current_actor_tenant_presentation();
  IF NOT FOUND OR v_tenant.tenant_id IS DISTINCT FROM v_actor.tenant_id
    OR v_tenant.tenant_status IS DISTINCT FROM 'active'
    OR v_tenant.product_key IS DISTINCT FROM 'bella_preschool' THEN
    RAISE EXCEPTION 'PRESCHOOL_COURSE_CATALOG_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT c.id, c.tenant_id, c.course_code, c.title, c.status::text,
      COALESCE(c.prerequisite_course_codes, ARRAY[]::text[])
    FROM public.edu_courses AS c
    WHERE c.tenant_id = v_actor.tenant_id
      AND (p_course_id IS NULL OR c.id = p_course_id)
    ORDER BY c.id;
END;
$$;

REVOKE ALL ON FUNCTION public.edu_preschool_admin_course_catalog(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_admin_course_catalog(uuid) TO authenticated;
COMMENT ON FUNCTION public.edu_preschool_admin_course_catalog(uuid) IS
  'Returns minimal Preschool class identity for the active admin caller tenant. No caller-supplied tenant/actor and no edu_courses table grant.';

NOTIFY pgrst, 'reload schema';
COMMIT;
