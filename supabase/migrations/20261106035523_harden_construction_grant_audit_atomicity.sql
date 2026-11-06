-- Keep unexpected persistence errors inside the PostgREST statement transaction.
-- The TypeScript consumer maps RPC errors to PERSISTENCE_FAILED; allowing the
-- error to abort the RPC guarantees the grant/revoke and audit trigger roll back.
BEGIN;

CREATE OR REPLACE FUNCTION public.platform_grant_direct_user_action(
  p_target_user_id uuid,
  p_permission_id text,
  p_scope_type text,
  p_org_unit_id uuid DEFAULT NULL
)
RETURNS TABLE(status text, reason text, grant_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_actor_role text;
  v_org_unit_allowed boolean;
  v_grant_id uuid;
BEGIN
  SELECT actor.tenant_id, actor.role
    INTO v_actor_tenant_id, v_actor_role
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();

  IF auth.uid() IS NULL OR v_actor_tenant_id IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, 'AUTH_CONTEXT_UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RETURN QUERY SELECT 'DENIED'::text, 'NOT_TENANT_GRANT_ADMIN'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_target_user_id IS NULL OR p_permission_id IS NULL OR p_permission_id NOT IN (
       'construction:foundation:read',
       'construction:project:write',
       'construction:site:write',
       'construction:work_package:write',
       'construction:boq:write',
       'construction.site_diary.view',
       'construction.site_diary.create',
       'construction.site_diary.update',
       'construction.issue.view',
       'construction.issue.create',
       'construction.issue.update',
       'construction.issue.resolve',
       'construction.issue.close',
       'construction.issue.reopen'
     ) OR p_scope_type IS NULL OR p_scope_type NOT IN ('TENANT', 'ORG_UNIT')
     OR (p_scope_type = 'TENANT' AND p_org_unit_id IS NOT NULL)
     OR (p_scope_type = 'ORG_UNIT' AND p_org_unit_id IS NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_scope_type = 'ORG_UNIT' THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM public.platform_current_actor_org_unit_access() access
        WHERE access.tenant_id = v_actor_tenant_id
          AND access.org_unit_id = p_org_unit_id
      ) INTO v_org_unit_allowed;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, 'ORG_UNIT_UNAVAILABLE'::text, NULL::uuid;
      RETURN;
    END;

    IF NOT v_org_unit_allowed THEN
      RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.platform_direct_user_action_grants (
      user_id, tenant_id, permission_id, scope_type, org_unit_id
    ) VALUES (
      p_target_user_id, v_actor_tenant_id, p_permission_id, p_scope_type, p_org_unit_id
    ) RETURNING id INTO v_grant_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'DENIED'::text, 'ALREADY_GRANTED'::text, NULL::uuid;
      RETURN;
    WHEN invalid_parameter_value OR foreign_key_violation THEN
      RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
      RETURN;
    WHEN OTHERS THEN
      RAISE;
  END;

  RETURN QUERY SELECT 'COMMITTED'::text, 'GRANTED'::text, v_grant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_revoke_direct_user_action(p_grant_id uuid)
RETURNS TABLE(status text, reason text, grant_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_actor_role text;
  v_revoked_id uuid;
BEGIN
  SELECT actor.tenant_id, actor.role
    INTO v_actor_tenant_id, v_actor_role
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();

  IF auth.uid() IS NULL OR v_actor_tenant_id IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, 'AUTH_CONTEXT_UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RETURN QUERY SELECT 'DENIED'::text, 'NOT_TENANT_GRANT_ADMIN'::text, NULL::uuid;
    RETURN;
  END IF;

  IF p_grant_id IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.platform_direct_user_action_grants grant_row
  SET status = 'REVOKED'
  WHERE grant_row.id = p_grant_id
    AND grant_row.tenant_id = v_actor_tenant_id
    AND grant_row.status = 'ACTIVE'
  RETURNING grant_row.id INTO v_revoked_id;

  IF v_revoked_id IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'COMMITTED'::text, 'REVOKED'::text, v_revoked_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.platform_revoke_direct_user_action(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_revoke_direct_user_action(uuid)
  TO authenticated;

COMMIT;
