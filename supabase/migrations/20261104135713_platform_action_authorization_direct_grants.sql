-- Bella Platform direct action grants, initially consumed by Construction.
-- This migration is additive and must be applied only to local/non-production
-- databases until separately authorized.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.platform_direct_user_action_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  permission_id text NOT NULL
    CHECK (permission_id IN (
      'construction:foundation:read',
      'construction:project:write',
      'construction:site:write',
      'construction:work_package:write',
      'construction:boq:write'
    )),
  scope_type text NOT NULL CHECK (scope_type IN ('TENANT', 'ORG_UNIT')),
  org_unit_id uuid REFERENCES public.org_units(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid,
  revoked_at timestamptz,
  CONSTRAINT ck_platform_direct_grant_scope CHECK (
    (scope_type = 'TENANT' AND org_unit_id IS NULL)
    OR (scope_type = 'ORG_UNIT' AND org_unit_id IS NOT NULL)
  ),
  CONSTRAINT ck_platform_direct_grant_revocation CHECK (
    (status = 'ACTIVE' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

-- zero-downtime: allow blocking-index - This migration creates the empty grant table immediately before indexing it.
CREATE UNIQUE INDEX uq_platform_direct_user_action_grants_active_tenant_scope
  ON public.platform_direct_user_action_grants (user_id, tenant_id, permission_id)
  WHERE status = 'ACTIVE' AND scope_type = 'TENANT';

-- zero-downtime: allow blocking-index - This migration creates the empty grant table immediately before indexing it.
CREATE UNIQUE INDEX uq_platform_direct_user_action_grants_active_org_unit_scope
  ON public.platform_direct_user_action_grants (user_id, tenant_id, permission_id, org_unit_id)
  WHERE status = 'ACTIVE' AND scope_type = 'ORG_UNIT';

-- zero-downtime: allow blocking-index - This migration creates the empty grant table immediately before indexing it.
CREATE INDEX idx_platform_direct_user_action_grants_actor_permission
  ON public.platform_direct_user_action_grants (user_id, tenant_id, permission_id)
  WHERE status = 'ACTIVE';

CREATE TABLE public.platform_direct_user_action_grant_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  permission_id text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('TENANT', 'ORG_UNIT')),
  org_unit_id uuid,
  action text NOT NULL CHECK (action IN ('GRANT', 'REVOKE')),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ck_platform_direct_grant_audit_scope CHECK (
    (scope_type = 'TENANT' AND org_unit_id IS NULL)
    OR (scope_type = 'ORG_UNIT' AND org_unit_id IS NOT NULL)
  )
);

-- zero-downtime: allow blocking-index - This migration creates the empty audit table immediately before indexing it.
CREATE INDEX idx_platform_direct_user_action_grant_audit_tenant_time
  ON public.platform_direct_user_action_grant_audit (tenant_id, recorded_at DESC);

-- zero-downtime: allow blocking-index - This migration creates the empty audit table immediately before indexing it.
CREATE INDEX idx_platform_direct_user_action_grant_audit_grant_time
  ON public.platform_direct_user_action_grant_audit (grant_id, recorded_at DESC);

ALTER TABLE public.platform_direct_user_action_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_direct_user_action_grant_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_direct_user_action_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.platform_direct_user_action_grants TO authenticated;
GRANT INSERT (user_id, tenant_id, permission_id, scope_type, org_unit_id)
  ON public.platform_direct_user_action_grants TO authenticated;
GRANT UPDATE (status) ON public.platform_direct_user_action_grants TO authenticated;

REVOKE ALL ON public.platform_direct_user_action_grant_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.platform_direct_user_action_grant_audit TO authenticated;

DROP POLICY IF EXISTS platform_direct_action_grants_select ON public.platform_direct_user_action_grants;
CREATE POLICY platform_direct_action_grants_select
  ON public.platform_direct_user_action_grants
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.tenant_id = platform_direct_user_action_grants.tenant_id
        AND (
          actor.role = 'admin'
          OR platform_direct_user_action_grants.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS platform_direct_action_grants_insert ON public.platform_direct_user_action_grants;
CREATE POLICY platform_direct_action_grants_insert
  ON public.platform_direct_user_action_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'ACTIVE'
    AND granted_by = auth.uid()
    AND revoked_by IS NULL
    AND revoked_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'admin'
        AND actor.tenant_id = platform_direct_user_action_grants.tenant_id
    )
  );

DROP POLICY IF EXISTS platform_direct_action_grants_revoke ON public.platform_direct_user_action_grants;
CREATE POLICY platform_direct_action_grants_revoke
  ON public.platform_direct_user_action_grants
  FOR UPDATE TO authenticated
  USING (
    status = 'ACTIVE'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'admin'
        AND actor.tenant_id = platform_direct_user_action_grants.tenant_id
    )
  )
  WITH CHECK (
    status = 'REVOKED'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'admin'
        AND actor.tenant_id = platform_direct_user_action_grants.tenant_id
    )
  );

DROP POLICY IF EXISTS platform_direct_action_grant_audit_tenant_admin_read
  ON public.platform_direct_user_action_grant_audit;
CREATE POLICY platform_direct_action_grant_audit_tenant_admin_read
  ON public.platform_direct_user_action_grant_audit
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.role = 'admin'
        AND actor.tenant_id = platform_direct_user_action_grant_audit.tenant_id
    )
  );

CREATE OR REPLACE FUNCTION private.validate_platform_direct_action_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_actor_role text;
  v_target_active boolean;
  v_org_unit_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_GRANT_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT actor.tenant_id, actor.role
    INTO v_actor_tenant_id, v_actor_role
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();

  IF v_actor_tenant_id IS NULL OR v_actor_role IS DISTINCT FROM 'admin'
     OR v_actor_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'PLATFORM_GRANT_TENANT_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM auth.users auth_user
      JOIN public.users target_user ON target_user.id = auth_user.id
      JOIN public.tenants target_tenant ON target_tenant.id = target_user.tenant_id
      WHERE auth_user.id = NEW.user_id
        AND auth_user.deleted_at IS NULL
        AND (auth_user.banned_until IS NULL OR auth_user.banned_until <= now())
        AND target_user.status = 'active'
        AND target_tenant.status = 'active'
        AND target_user.tenant_id = NEW.tenant_id
    ) INTO v_target_active;

    IF NOT v_target_active THEN
      RAISE EXCEPTION 'PLATFORM_GRANT_TARGET_NOT_ACTIVE_IN_TENANT' USING ERRCODE = '22023';
    END IF;

    IF NEW.scope_type = 'ORG_UNIT' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.org_units unit
        WHERE unit.id = NEW.org_unit_id
          AND unit.tenant_id = NEW.tenant_id
          AND unit.is_active = TRUE
      ) INTO v_org_unit_active;

      IF NOT v_org_unit_active OR NOT EXISTS (
        SELECT 1
        FROM public.platform_current_actor_org_unit_access() access
        WHERE access.org_unit_id = NEW.org_unit_id
          AND access.tenant_id = NEW.tenant_id
      ) THEN
        RAISE EXCEPTION 'PLATFORM_GRANT_ORG_UNIT_OUT_OF_SCOPE' USING ERRCODE = '22023';
      END IF;
    END IF;

    NEW.granted_by := auth.uid();
    NEW.granted_at := statement_timestamp();
    NEW.status := 'ACTIVE';
    NEW.revoked_by := NULL;
    NEW.revoked_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM 'ACTIVE'
       OR NEW.status IS DISTINCT FROM 'REVOKED'
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.permission_id IS DISTINCT FROM OLD.permission_id
       OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
       OR NEW.org_unit_id IS DISTINCT FROM OLD.org_unit_id
       OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
       OR NEW.granted_at IS DISTINCT FROM OLD.granted_at THEN
      RAISE EXCEPTION 'PLATFORM_GRANT_REVOCATION_TRANSITION_INVALID' USING ERRCODE = '22023';
    END IF;

    NEW.revoked_by := auth.uid();
    NEW.revoked_at := statement_timestamp();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PLATFORM_GRANT_OPERATION_INVALID' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION private.audit_platform_direct_action_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_GRANT_AUDIT_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_direct_user_action_grant_audit (
    grant_id,
    actor_user_id,
    target_user_id,
    tenant_id,
    permission_id,
    scope_type,
    org_unit_id,
    action,
    recorded_at
  ) VALUES (
    NEW.id,
    auth.uid(),
    NEW.user_id,
    NEW.tenant_id,
    NEW.permission_id,
    NEW.scope_type,
    NEW.org_unit_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'GRANT' ELSE 'REVOKE' END,
    statement_timestamp()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_platform_direct_action_grant() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_platform_direct_action_grant() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER platform_direct_action_grant_validate
  BEFORE INSERT OR UPDATE ON public.platform_direct_user_action_grants
  FOR EACH ROW EXECUTE FUNCTION private.validate_platform_direct_action_grant();

CREATE TRIGGER platform_direct_action_grant_audit
  AFTER INSERT OR UPDATE ON public.platform_direct_user_action_grants
  FOR EACH ROW EXECUTE FUNCTION private.audit_platform_direct_action_grant();

CREATE OR REPLACE FUNCTION public.platform_authorize_action(
  p_permission_id text,
  p_tenant_id uuid,
  p_org_unit_id uuid DEFAULT NULL
)
RETURNS TABLE(status text, reason text)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_tenant_id uuid;
  v_org_unit_allowed boolean;
  v_granted boolean;
BEGIN
  IF v_actor_id IS NULL OR p_permission_id IS NULL
     OR length(trim(p_permission_id)) = 0 OR p_tenant_id IS NULL THEN
    RETURN QUERY SELECT 'DENY'::text, 'INVALID_CONTEXT'::text;
    RETURN;
  END IF;

  SELECT actor.tenant_id INTO v_actor_tenant_id
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id;

  IF v_actor_tenant_id IS NULL THEN
    RETURN QUERY SELECT 'DENY'::text, 'INVALID_CONTEXT'::text;
    RETURN;
  END IF;

  IF p_tenant_id IS DISTINCT FROM v_actor_tenant_id THEN
    RETURN QUERY SELECT 'DENY'::text, 'TENANT_MISMATCH'::text;
    RETURN;
  END IF;

  IF p_org_unit_id IS NOT NULL THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM public.platform_current_actor_org_unit_access() access
        WHERE access.tenant_id = v_actor_tenant_id
          AND access.org_unit_id = p_org_unit_id
      ) INTO v_org_unit_allowed;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, 'ORG_UNIT_UNAVAILABLE'::text;
      RETURN;
    END;

    IF NOT v_org_unit_allowed THEN
      RETURN QUERY SELECT 'DENY'::text, 'ORG_UNIT_MISMATCH'::text;
      RETURN;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.platform_direct_user_action_grants grant_row
    WHERE grant_row.user_id = v_actor_id
      AND grant_row.tenant_id = v_actor_tenant_id
      AND grant_row.permission_id = p_permission_id
      AND grant_row.status = 'ACTIVE'
      AND (
        grant_row.scope_type = 'TENANT'
        OR (
          p_org_unit_id IS NOT NULL
          AND grant_row.scope_type = 'ORG_UNIT'
          AND grant_row.org_unit_id = p_org_unit_id
        )
      )
  ) INTO v_granted;

  IF v_granted THEN
    RETURN QUERY SELECT 'ALLOW'::text, 'DIRECT_GRANT'::text;
  ELSE
    RETURN QUERY SELECT 'DENY'::text, 'NO_GRANT'::text;
  END IF;
END;
$$;

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
       'construction:boq:write'
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
      RETURN QUERY SELECT 'UNAVAILABLE'::text, 'PERSISTENCE_FAILED'::text, NULL::uuid;
      RETURN;
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

  BEGIN
    UPDATE public.platform_direct_user_action_grants grant_row
    SET status = 'REVOKED'
    WHERE grant_row.id = p_grant_id
      AND grant_row.tenant_id = v_actor_tenant_id
      AND grant_row.status = 'ACTIVE'
    RETURNING grant_row.id INTO v_revoked_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, 'PERSISTENCE_FAILED'::text, NULL::uuid;
    RETURN;
  END;

  IF v_revoked_id IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text, 'INVALID_TARGET_OR_SCOPE'::text, NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'COMMITTED'::text, 'REVOKED'::text, v_revoked_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_authorize_action(text, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_authorize_action(text, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.platform_revoke_direct_user_action(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_revoke_direct_user_action(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.construction_project_is_active_for_actor(
  p_project_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      JOIN public.construction_projects project_row
        ON project_row.tenant_id = actor.tenant_id
       AND project_row.id = p_project_id
       AND project_row.status = 'active'
      WHERE actor.id = auth.uid()
        AND actor.tenant_id = p_tenant_id
    );
$$;

CREATE OR REPLACE FUNCTION private.construction_site_context_for_actor(p_site_id uuid)
RETURNS TABLE(tenant_id uuid, project_id uuid, org_unit_id uuid, status text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT site_row.tenant_id, site_row.project_id, site_row.org_unit_id, site_row.status
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_sites site_row
    ON site_row.tenant_id = actor.tenant_id
   AND site_row.id = p_site_id
  WHERE auth.uid() = actor.id
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_org_unit_access() access
      WHERE access.tenant_id = site_row.tenant_id
        AND access.org_unit_id = site_row.org_unit_id
    );
$$;

CREATE OR REPLACE FUNCTION private.construction_work_package_context_for_actor(p_work_package_id uuid)
RETURNS TABLE(tenant_id uuid, project_id uuid, site_id uuid, org_unit_id uuid, status text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT package_row.tenant_id, package_row.project_id, package_row.site_id,
    package_row.org_unit_id, package_row.status
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_work_packages package_row
    ON package_row.tenant_id = actor.tenant_id
   AND package_row.id = p_work_package_id
  WHERE auth.uid() = actor.id
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_org_unit_access() access
      WHERE access.tenant_id = package_row.tenant_id
        AND access.org_unit_id = package_row.org_unit_id
    );
$$;

REVOKE ALL ON FUNCTION private.construction_project_is_active_for_actor(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.construction_site_context_for_actor(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.construction_work_package_context_for_actor(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.construction_project_is_active_for_actor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.construction_site_context_for_actor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.construction_work_package_context_for_actor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.construction_create_project(p_project_code text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_decision record;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT decision.status, decision.reason INTO v_decision
  FROM public.platform_authorize_action('construction:project:write', v_actor.tenant_id, NULL) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.construction_projects (
    id, tenant_id, project_code, name, status, created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_id, v_actor.tenant_id, p_project_code, p_name, 'active', v_actor.id, v_now, v_actor.id, v_now
  );

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_create_site(
  p_project_id uuid, p_org_unit_id uuid, p_site_code text, p_name text, p_location_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_decision record;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT private.construction_project_is_active_for_actor(p_project_id, v_actor.tenant_id) THEN
    RAISE EXCEPTION 'CONSTRUCTION_PROJECT_NOT_FOUND_OR_INACTIVE' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.status, decision.reason INTO v_decision
  FROM public.platform_authorize_action('construction:site:write', v_actor.tenant_id, p_org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.construction_sites (
    id, tenant_id, project_id, org_unit_id, site_code, name, location_text, status,
    created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_id, v_actor.tenant_id, p_project_id, p_org_unit_id, p_site_code, p_name,
    NULLIF(trim(p_location_text), ''), 'active', v_actor.id, v_now, v_actor.id, v_now
  );

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_create_work_package(
  p_site_id uuid,
  p_work_package_code text,
  p_name text,
  p_parent_work_package_id uuid DEFAULT NULL,
  p_planned_start_date date DEFAULT NULL,
  p_planned_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_site record;
  v_decision record;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT context.tenant_id, context.project_id, context.org_unit_id, context.status
    INTO v_site
  FROM private.construction_site_context_for_actor(p_site_id) context;
  IF v_site.tenant_id IS NULL OR v_site.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_NOT_FOUND_OR_INACTIVE' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.status, decision.reason INTO v_decision
  FROM public.platform_authorize_action('construction:work_package:write', v_site.tenant_id, v_site.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.construction_work_packages (
    id, tenant_id, project_id, site_id, org_unit_id, parent_work_package_id,
    work_package_code, name, status, planned_start_date, planned_end_date,
    created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_id, v_site.tenant_id, v_site.project_id, p_site_id, v_site.org_unit_id, p_parent_work_package_id,
    p_work_package_code, p_name, 'planned', p_planned_start_date, p_planned_end_date,
    v_actor.id, v_now, v_actor.id, v_now
  );

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_create_boq_line(
  p_work_package_id uuid,
  p_line_number text,
  p_description text,
  p_quantity numeric,
  p_uom text,
  p_unit_rate numeric DEFAULT NULL,
  p_currency text DEFAULT 'VND',
  p_cost_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_package record;
  v_decision record;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT context.tenant_id, context.project_id, context.site_id, context.org_unit_id, context.status
    INTO v_package
  FROM private.construction_work_package_context_for_actor(p_work_package_id) context;
  IF v_package.tenant_id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_WORK_PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_package.status = 'archived' THEN
    RAISE EXCEPTION 'CONSTRUCTION_WORK_PACKAGE_ARCHIVED' USING ERRCODE = '23514';
  END IF;

  SELECT decision.status, decision.reason INTO v_decision
  FROM public.platform_authorize_action('construction:boq:write', v_package.tenant_id, v_package.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.construction_boq_lines (
    id, tenant_id, project_id, site_id, work_package_id, org_unit_id,
    line_number, description, quantity, uom, unit_rate, currency, cost_code,
    created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_id, v_package.tenant_id, v_package.project_id, v_package.site_id, p_work_package_id, v_package.org_unit_id,
    p_line_number, p_description, p_quantity, p_uom, p_unit_rate, COALESCE(NULLIF(trim(p_currency), ''), 'VND'),
    NULLIF(trim(p_cost_code), ''), v_actor.id, v_now, v_actor.id, v_now
  );

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_list_projects(p_project_id uuid DEFAULT NULL)
RETURNS SETOF public.construction_projects
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT project_row.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_projects project_row ON project_row.tenant_id = actor.tenant_id
  WHERE actor.id = auth.uid()
    AND (p_project_id IS NULL OR project_row.id = p_project_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:foundation:read', actor.tenant_id, NULL) decision
      WHERE decision.status = 'ALLOW'
    );
$$;

CREATE OR REPLACE FUNCTION public.construction_list_sites(p_project_id uuid)
RETURNS SETOF public.construction_sites
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT site_row.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_sites site_row
    ON site_row.tenant_id = actor.tenant_id
   AND site_row.project_id = p_project_id
  WHERE actor.id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action(
        'construction:foundation:read', site_row.tenant_id, site_row.org_unit_id
      ) decision WHERE decision.status = 'ALLOW'
    );
$$;

CREATE OR REPLACE FUNCTION public.construction_list_work_packages(p_site_id uuid)
RETURNS SETOF public.construction_work_packages
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT package_row.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_work_packages package_row
    ON package_row.tenant_id = actor.tenant_id
   AND package_row.site_id = p_site_id
  WHERE actor.id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action(
        'construction:foundation:read', package_row.tenant_id, package_row.org_unit_id
      ) decision WHERE decision.status = 'ALLOW'
    );
$$;

CREATE OR REPLACE FUNCTION public.construction_list_boq_lines(p_work_package_id uuid)
RETURNS SETOF public.construction_boq_lines
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT line_row.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_boq_lines line_row
    ON line_row.tenant_id = actor.tenant_id
   AND line_row.work_package_id = p_work_package_id
  WHERE actor.id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action(
        'construction:foundation:read', line_row.tenant_id, line_row.org_unit_id
      ) decision WHERE decision.status = 'ALLOW'
    );
$$;

REVOKE ALL ON FUNCTION public.construction_create_project(text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_create_site(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_create_work_package(uuid, text, text, uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_create_boq_line(uuid, text, text, numeric, text, numeric, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_projects(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_sites(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_work_packages(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_boq_lines(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.construction_create_project(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_create_site(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_create_work_package(uuid, text, text, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_create_boq_line(uuid, text, text, numeric, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_projects(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_sites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_work_packages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_boq_lines(uuid) TO authenticated;

-- Replace the broad Construction foundation policies with separate action and
-- data-scope checks. RLS rechecks the same action independently from the API RPC.
CREATE OR REPLACE FUNCTION public.construction_tenant_access_allowed(
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_current_actor_profile() actor
      WHERE actor.id = auth.uid()
        AND actor.tenant_id = p_tenant_id
    );
$$;

CREATE OR REPLACE FUNCTION public.construction_org_unit_access_allowed(
  p_tenant_id uuid,
  p_org_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.construction_tenant_access_allowed(p_tenant_id)
    AND p_org_unit_id IN (
      SELECT access.org_unit_id
      FROM public.platform_current_actor_org_unit_access() access
      WHERE access.tenant_id = p_tenant_id
    );
$$;

DROP POLICY IF EXISTS construction_projects_tenant_access ON public.construction_projects;
DROP POLICY IF EXISTS construction_sites_org_unit_access ON public.construction_sites;
DROP POLICY IF EXISTS construction_work_packages_org_unit_access ON public.construction_work_packages;
DROP POLICY IF EXISTS construction_boq_lines_org_unit_access ON public.construction_boq_lines;

CREATE POLICY construction_projects_action_read
  ON public.construction_projects FOR SELECT TO authenticated
  USING (
    public.construction_tenant_access_allowed(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:foundation:read', tenant_id, NULL) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_projects_action_insert
  ON public.construction_projects FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_tenant_access_allowed(tenant_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:project:write', tenant_id, NULL) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_projects_action_update
  ON public.construction_projects FOR UPDATE TO authenticated
  USING (
    public.construction_tenant_access_allowed(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:project:write', tenant_id, NULL) decision
      WHERE decision.status = 'ALLOW'
    )
  )
  WITH CHECK (
    public.construction_tenant_access_allowed(tenant_id)
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:project:write', tenant_id, NULL) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE POLICY construction_sites_action_read
  ON public.construction_sites FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:foundation:read', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_sites_action_insert
  ON public.construction_sites FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:site:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_sites_action_update
  ON public.construction_sites FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:site:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:site:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE POLICY construction_work_packages_action_read
  ON public.construction_work_packages FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:foundation:read', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_work_packages_action_insert
  ON public.construction_work_packages FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_work_packages_action_update
  ON public.construction_work_packages FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE POLICY construction_boq_lines_action_read
  ON public.construction_boq_lines FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:foundation:read', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_boq_lines_action_insert
  ON public.construction_boq_lines FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:boq:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );
CREATE POLICY construction_boq_lines_action_update
  ON public.construction_boq_lines FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:boq:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.platform_authorize_action('construction:boq:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

-- Construction data APIs use authenticated callers only. In particular, do
-- not retain the broad service-role grants from the earlier foundation draft.
REVOKE ALL ON public.construction_projects, public.construction_sites,
  public.construction_work_packages, public.construction_boq_lines
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.construction_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.construction_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.construction_work_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.construction_boq_lines TO authenticated;

COMMIT;
