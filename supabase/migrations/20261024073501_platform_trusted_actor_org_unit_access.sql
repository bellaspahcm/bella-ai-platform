BEGIN;

CREATE OR REPLACE FUNCTION public.platform_org_unit_access_for_actor(
    p_tenant_id uuid, p_actor_id uuid
) RETURNS TABLE (
    user_id uuid, tenant_id uuid, org_unit_id uuid, root_org_unit_id uuid,
    relationship_id uuid, access_source text
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_tenant_id IS NULL OR p_actor_id IS NULL
       OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) THEN
        RAISE EXCEPTION 'PLATFORM_ACTOR_ACCESS_DENIED: Trusted actor context required.' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM auth.users a
      JOIN public.users u ON u.id = a.id
      JOIN public.tenants t ON t.id = u.tenant_id
    WHERE a.id = p_actor_id AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.tenant_id = p_tenant_id AND u.status = 'active' AND t.status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PLATFORM_ACTOR_ACCESS_DENIED: Current active Auth-backed actor and tenant required.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH RECURSIVE direct_access AS (
      SELECT pd.user_id, rel.tenant_id, rel.to_id AS org_unit_id,
        rel.to_id AS root_org_unit_id, rel.id AS relationship_id,
        rel.rel_type AS access_source
      FROM public.people_directory pd
      JOIN public.org_relationships rel ON rel.tenant_id = pd.tenant_id
        AND rel.from_id = pd.id AND rel.from_type = 'person' AND rel.to_type = 'unit'
        AND rel.rel_type IN ('belongs_to', 'manages', 'participates_in')
        AND (rel.since IS NULL OR rel.since <= CURRENT_DATE)
        AND (rel.until IS NULL OR rel.until >= CURRENT_DATE)
      JOIN public.org_units ou ON ou.id = rel.to_id
        AND ou.tenant_id = rel.tenant_id AND ou.is_active = TRUE
      WHERE pd.user_id = p_actor_id AND pd.tenant_id = p_tenant_id AND pd.is_active = TRUE
    ), expanded_access AS (
      SELECT da.user_id, da.tenant_id, da.org_unit_id, da.root_org_unit_id,
        da.relationship_id, da.access_source FROM direct_access da
      UNION
      SELECT ea.user_id, child.tenant_id, child.id, ea.root_org_unit_id,
        ea.relationship_id, ea.access_source
      FROM expanded_access ea
      JOIN public.org_units child ON child.parent_id = ea.org_unit_id
        AND child.tenant_id = ea.tenant_id AND child.is_active = TRUE
    ), admin_access AS (
      SELECT u.id AS user_id, ou.tenant_id, ou.id AS org_unit_id,
        ou.id AS root_org_unit_id, NULL::uuid AS relationship_id,
        'tenant_admin'::text AS access_source
      FROM public.users u
      JOIN public.org_units ou ON ou.tenant_id = u.tenant_id AND ou.is_active = TRUE
      WHERE u.id = p_actor_id AND u.tenant_id = p_tenant_id
        AND lower(u.role) IN ('admin', 'super_admin')
    )
    SELECT ea.user_id, ea.tenant_id, ea.org_unit_id, ea.root_org_unit_id,
      ea.relationship_id, ea.access_source FROM expanded_access ea
    UNION
    SELECT aa.user_id, aa.tenant_id, aa.org_unit_id, aa.root_org_unit_id,
      aa.relationship_id, aa.access_source FROM admin_access aa;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_org_unit_access_for_actor(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_org_unit_access_for_actor(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_current_actor_org_unit_access()
RETURNS TABLE (
  user_id uuid, tenant_id uuid, org_unit_id uuid, root_org_unit_id uuid,
  relationship_id uuid, access_source text
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id FROM public.platform_current_actor_profile() p;
  RETURN QUERY
    SELECT a.user_id, a.tenant_id, a.org_unit_id, a.root_org_unit_id,
      a.relationship_id, a.access_source
    FROM public.platform_org_unit_access_for_actor(v_tenant_id, auth.uid()) a;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_current_actor_org_unit_access() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_org_unit_access() TO authenticated;

COMMIT;
