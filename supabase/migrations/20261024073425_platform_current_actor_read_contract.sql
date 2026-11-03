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

REVOKE ALL ON FUNCTION public.platform_current_actor_profile() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_profile() TO authenticated;

COMMIT;
