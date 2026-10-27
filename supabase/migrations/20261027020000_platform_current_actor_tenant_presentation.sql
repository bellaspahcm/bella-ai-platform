BEGIN;

-- A separate, zero-argument contract keeps the existing actor-profile return
-- shape stable; that contract is consumed by other Platform functions.
-- The caller can only receive the presentation projection for auth.uid()'s
-- active tenant. This does not grant table access or confer Product authority.
CREATE FUNCTION public.platform_current_actor_tenant_presentation()
RETURNS TABLE (
  tenant_id uuid,
  tenant_status text,
  name text,
  product_key text,
  enabled_modules jsonb,
  brand_theme jsonb,
  logo_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'PLATFORM_CURRENT_ACTOR_TENANT_PRESENTATION_DENIED: Signed-in actor required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT t.id, t.status::text, t.name::text, t.product_key::text,
      t.enabled_modules, t.brand_theme, t.logo_url::text
    FROM auth.users a
    JOIN public.users u ON u.id = a.id
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE a.id = auth.uid()
      AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.status = 'active'
      AND t.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLATFORM_CURRENT_ACTOR_TENANT_PRESENTATION_DENIED: Active identity and tenant required.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_current_actor_tenant_presentation()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_actor_tenant_presentation()
  TO authenticated;

COMMENT ON FUNCTION public.platform_current_actor_tenant_presentation() IS
  'Platform signed-in self tenant presentation: fixed display/routing fields for auth.uid() active tenant only; no tenant input, direct table grant, or Product action authority.';

COMMIT;
