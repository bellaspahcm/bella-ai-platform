BEGIN;

-- Platform-owned, self-scoped signed-in reads. No table permission expansion.
CREATE OR REPLACE FUNCTION public.platform_current_actor_profile()
RETURNS TABLE (
  id uuid, email text, full_name text, role text, avatar_url text,
  tenant_id uuid, status text, tenant_status text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'PLATFORM_CURRENT_ACTOR_DENIED: Signed-in actor required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.full_name::text, u.role::text, u.avatar_url::text,
      u.tenant_id, u.status::text, t.status::text
    FROM auth.users a
    JOIN public.users u ON u.id = a.id
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE a.id = auth.uid() AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.status = 'active' AND t.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLATFORM_CURRENT_ACTOR_DENIED: Current active identity and tenant required.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_current_actor_org_unit_access()
RETURNS TABLE (
  user_id uuid, tenant_id uuid, org_unit_id uuid, root_org_unit_id uuid,
  relationship_id uuid, access_source text
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant_id uuid;
BEGIN
  -- No actor/tenant input: the signed-in profile contract is the sole authority.
  SELECT p.tenant_id INTO v_tenant_id FROM public.platform_current_actor_profile() p;
  RETURN QUERY
    SELECT a.user_id, a.tenant_id, a.org_unit_id, a.root_org_unit_id,
      a.relationship_id, a.access_source
    FROM public.platform_org_unit_access_for_actor(v_tenant_id, auth.uid()) a;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_current_actor_profile() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.platform_current_actor_org_unit_access() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_org_unit_access() TO authenticated;

COMMENT ON FUNCTION public.platform_current_actor_profile() IS
  'Platform signed-in self profile: explicit safe fields only; live active Auth/profile/tenant; no caller-supplied identity.';
COMMENT ON FUNCTION public.platform_current_actor_org_unit_access() IS
  'Platform signed-in self organization access; reuses canonical trusted actor capability; provenance is not Product action permission.';

COMMIT;
