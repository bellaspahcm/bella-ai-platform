-- Construction Site Diary and Issue MVP.
-- Additive local/non-production implementation; do not apply to Production
-- without separate authorization.

BEGIN;

ALTER TABLE public.platform_direct_user_action_grants
  DROP CONSTRAINT IF EXISTS platform_direct_user_action_grants_permission_id_check;

ALTER TABLE public.platform_direct_user_action_grants
  ADD CONSTRAINT platform_direct_user_action_grants_permission_id_check
  CHECK (permission_id IN (
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
  ));

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
      RETURN QUERY SELECT 'UNAVAILABLE'::text, 'PERSISTENCE_FAILED'::text, NULL::uuid;
      RETURN;
  END;

  RETURN QUERY SELECT 'COMMITTED'::text, 'GRANTED'::text, v_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_grant_direct_user_action(uuid, text, text, uuid)
  TO authenticated;

CREATE TABLE public.construction_site_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  site_id uuid NOT NULL,
  org_unit_id uuid NOT NULL,
  work_package_id uuid,
  entry_date date NOT NULL,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_construction_site_diary_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_construction_site_diary_scope
    UNIQUE (tenant_id, id, site_id, project_id, org_unit_id),
  CONSTRAINT fk_construction_site_diary_site_scope
    FOREIGN KEY (tenant_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_sites(tenant_id, id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_site_diary_work_package_scope
    FOREIGN KEY (tenant_id, work_package_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT
);

-- zero-downtime: allow blocking-index - This migration creates the empty Diary table immediately before indexing it.
CREATE INDEX idx_construction_site_diary_site_date
  ON public.construction_site_diary_entries (tenant_id, site_id, entry_date DESC, created_at DESC);

-- zero-downtime: allow blocking-index - This migration creates the empty Diary table immediately before indexing it.
CREATE INDEX idx_construction_site_diary_work_package
  ON public.construction_site_diary_entries (tenant_id, work_package_id, entry_date DESC)
  WHERE work_package_id IS NOT NULL;

CREATE TABLE public.construction_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  site_id uuid NOT NULL,
  org_unit_id uuid NOT NULL,
  diary_entry_id uuid,
  work_package_id uuid,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  due_date date,
  resolution_result text,
  reopen_reason text,
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_construction_issues_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_construction_issues_site_scope
    FOREIGN KEY (tenant_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_sites(tenant_id, id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_issues_diary_scope
    FOREIGN KEY (tenant_id, diary_entry_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_site_diary_entries(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_issues_work_package_scope
    FOREIGN KEY (tenant_id, work_package_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_construction_issues_resolved_result
    CHECK (status NOT IN ('RESOLVED', 'CLOSED') OR length(trim(COALESCE(resolution_result, ''))) > 0),
  CONSTRAINT ck_construction_issues_closed_timestamp
    CHECK ((status = 'CLOSED' AND closed_at IS NOT NULL) OR (status <> 'CLOSED' AND closed_at IS NULL))
);

-- zero-downtime: allow blocking-index - This migration creates the empty Issue table immediately before indexing it.
CREATE INDEX idx_construction_issues_site_status
  ON public.construction_issues (tenant_id, site_id, status, due_date, created_at DESC);

-- zero-downtime: allow blocking-index - This migration creates the empty Issue table immediately before indexing it.
CREATE INDEX idx_construction_issues_work_package
  ON public.construction_issues (tenant_id, work_package_id, status)
  WHERE work_package_id IS NOT NULL;

ALTER TABLE public.construction_site_diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_issues ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.construction_site_diary_entries, public.construction_issues
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.construction_site_diary_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.construction_issues TO authenticated;

DROP POLICY IF EXISTS construction_sites_activity_feature_read ON public.construction_sites;
CREATE POLICY construction_sites_activity_feature_read
  ON public.construction_sites FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  );

DROP POLICY IF EXISTS construction_work_packages_activity_feature_read ON public.construction_work_packages;
CREATE POLICY construction_work_packages_activity_feature_read
  ON public.construction_work_packages FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  );

CREATE POLICY construction_site_diary_action_read
  ON public.construction_site_diary_entries FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  );

CREATE POLICY construction_site_diary_action_insert
  ON public.construction_site_diary_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND author_user_id = auth.uid()
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
  );

CREATE POLICY construction_site_diary_action_update
  ON public.construction_site_diary_entries FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
  );

CREATE POLICY construction_issues_action_read
  ON public.construction_issues FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  );

CREATE POLICY construction_issues_action_insert
  ON public.construction_issues FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
  );

CREATE POLICY construction_issues_action_update
  ON public.construction_issues FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', tenant_id, org_unit_id) d WHERE d.status = 'ALLOW')
    )
  );

CREATE OR REPLACE FUNCTION private.guard_construction_site_diary_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_decision record;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS DISTINCT FROM v_actor.tenant_id
      OR NEW.author_user_id IS DISTINCT FROM v_actor.id
      OR NEW.created_by IS DISTINCT FROM v_actor.id
      OR NEW.updated_by IS DISTINCT FROM v_actor.id THEN
      RAISE EXCEPTION 'CONSTRUCTION_SITE_DIARY_AUTHOR_INVALID' USING ERRCODE = '42501';
    END IF;
    SELECT decision.status INTO v_decision
    FROM public.platform_authorize_action('construction.site_diary.create', NEW.tenant_id, NEW.org_unit_id) decision;
    IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
      RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'UNAVAILABLE') USING ERRCODE = '42501';
    END IF;
    NEW.created_at := statement_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.site_id IS DISTINCT FROM OLD.site_id
      OR NEW.org_unit_id IS DISTINCT FROM OLD.org_unit_id
      OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'CONSTRUCTION_SITE_DIARY_AUTHOR_OR_SCOPE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    SELECT decision.status INTO v_decision
    FROM public.platform_authorize_action('construction.site_diary.update', OLD.tenant_id, OLD.org_unit_id) decision;
    IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
      RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'UNAVAILABLE') USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT public.construction_org_unit_access_allowed(NEW.tenant_id, NEW.org_unit_id) THEN
    RAISE EXCEPTION 'CONSTRUCTION_ORG_UNIT_ACCESS_REQUIRED' USING ERRCODE = '42501';
  END IF;
  NEW.updated_by := v_actor.id;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_construction_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_permission text;
  v_decision record;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS DISTINCT FROM v_actor.tenant_id
      OR NEW.created_by IS DISTINCT FROM v_actor.id
      OR NEW.updated_by IS DISTINCT FROM v_actor.id
      OR NEW.status IS DISTINCT FROM 'OPEN'
      OR NEW.resolution_result IS NOT NULL
      OR NEW.reopen_reason IS NOT NULL
      OR NEW.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'CONSTRUCTION_ISSUE_INITIAL_STATE_INVALID' USING ERRCODE = '23514';
    END IF;
    v_permission := 'construction.issue.create';
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.site_id IS DISTINCT FROM OLD.site_id
      OR NEW.org_unit_id IS DISTINCT FROM OLD.org_unit_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'CONSTRUCTION_ISSUE_SCOPE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'IN_PROGRESS' AND OLD.status = 'OPEN' THEN
        v_permission := 'construction.issue.update';
      ELSIF NEW.status = 'RESOLVED' AND OLD.status IN ('OPEN', 'IN_PROGRESS')
        AND length(trim(COALESCE(NEW.resolution_result, ''))) > 0 THEN
        v_permission := 'construction.issue.resolve';
      ELSIF NEW.status = 'CLOSED' AND OLD.status = 'RESOLVED'
        AND length(trim(COALESCE(NEW.resolution_result, ''))) > 0
        AND NEW.closed_at IS NOT NULL THEN
        v_permission := 'construction.issue.close';
      ELSIF NEW.status = 'IN_PROGRESS' AND OLD.status IN ('RESOLVED', 'CLOSED')
        AND length(trim(COALESCE(NEW.reopen_reason, ''))) > 0
        AND NEW.closed_at IS NULL THEN
        v_permission := 'construction.issue.reopen';
      ELSE
        RAISE EXCEPTION 'CONSTRUCTION_ISSUE_TRANSITION_INVALID' USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NEW.resolution_result IS DISTINCT FROM OLD.resolution_result
        OR NEW.reopen_reason IS DISTINCT FROM OLD.reopen_reason
        OR NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
        RAISE EXCEPTION 'CONSTRUCTION_ISSUE_LIFECYCLE_FIELDS_IMMUTABLE' USING ERRCODE = '23514';
      END IF;
      v_permission := 'construction.issue.update';
    END IF;
  END IF;

  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action(v_permission, NEW.tenant_id, NEW.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  IF NOT public.construction_org_unit_access_allowed(NEW.tenant_id, NEW.org_unit_id) THEN
    RAISE EXCEPTION 'CONSTRUCTION_ORG_UNIT_ACCESS_REQUIRED' USING ERRCODE = '42501';
  END IF;
  NEW.updated_by := v_actor.id;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_construction_site_diary_entry() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_construction_issue() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_construction_site_diary_entry
  BEFORE INSERT OR UPDATE ON public.construction_site_diary_entries
  FOR EACH ROW EXECUTE FUNCTION private.guard_construction_site_diary_entry();
CREATE TRIGGER trg_guard_construction_issue
  BEFORE INSERT OR UPDATE ON public.construction_issues
  FOR EACH ROW EXECUTE FUNCTION private.guard_construction_issue();

CREATE OR REPLACE FUNCTION public.construction_list_site_activity_sites()
RETURNS TABLE (
  id uuid,
  project_id uuid,
  org_unit_id uuid,
  site_code text,
  name text,
  can_view_diary boolean,
  can_create_diary boolean,
  can_update_diary boolean,
  can_view_issue boolean,
  can_create_issue boolean,
  can_update_issue boolean,
  can_resolve_issue boolean,
  can_close_issue boolean,
  can_reopen_issue boolean
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT site_row.id, site_row.project_id, site_row.org_unit_id, site_row.site_code, site_row.name,
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW'),
    EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_sites site_row ON site_row.tenant_id = actor.tenant_id
  WHERE actor.id = auth.uid()
    AND site_row.status = 'active'
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', site_row.tenant_id, site_row.org_unit_id) d WHERE d.status = 'ALLOW')
    )
  ORDER BY site_row.name, site_row.id;
$$;

CREATE OR REPLACE FUNCTION public.construction_list_activity_work_packages(p_site_id uuid)
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
    AND package_row.status <> 'archived'
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.create', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.create', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', package_row.tenant_id, package_row.org_unit_id) d WHERE d.status = 'ALLOW')
    )
  ORDER BY package_row.work_package_code, package_row.id;
$$;

CREATE OR REPLACE FUNCTION public.construction_list_site_diary_entries(p_site_id uuid)
RETURNS SETOF public.construction_site_diary_entries
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT diary.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_site_diary_entries diary
    ON diary.tenant_id = actor.tenant_id AND diary.site_id = p_site_id
  WHERE actor.id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.view', diary.tenant_id, diary.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.site_diary.update', diary.tenant_id, diary.org_unit_id) d WHERE d.status = 'ALLOW')
    )
  ORDER BY diary.entry_date DESC, diary.created_at DESC, diary.id;
$$;

CREATE OR REPLACE FUNCTION public.construction_list_issues(p_site_id uuid)
RETURNS SETOF public.construction_issues
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT issue.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_issues issue
    ON issue.tenant_id = actor.tenant_id AND issue.site_id = p_site_id
  WHERE actor.id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.view', issue.tenant_id, issue.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.update', issue.tenant_id, issue.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.resolve', issue.tenant_id, issue.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.close', issue.tenant_id, issue.org_unit_id) d WHERE d.status = 'ALLOW')
      OR EXISTS (SELECT 1 FROM public.platform_authorize_action('construction.issue.reopen', issue.tenant_id, issue.org_unit_id) d WHERE d.status = 'ALLOW')
    )
  ORDER BY
    CASE issue.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'RESOLVED' THEN 2 ELSE 3 END,
    issue.due_date NULLS LAST, issue.created_at DESC, issue.id;
$$;

CREATE OR REPLACE FUNCTION public.construction_create_site_diary_entry(
  p_site_id uuid,
  p_entry_date date,
  p_work_package_id uuid,
  p_content text
)
RETURNS public.construction_site_diary_entries
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_site record;
  v_decision record;
  v_result public.construction_site_diary_entries;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_entry_date IS NULL OR p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_DIARY_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT context.tenant_id, context.project_id, context.org_unit_id, context.status
    INTO v_site
  FROM private.construction_site_context_for_actor(p_site_id) context
  WHERE context.tenant_id = v_actor.tenant_id;
  IF v_site.tenant_id IS NULL OR v_site.status <> 'active' THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action('construction.site_diary.create', v_site.tenant_id, v_site.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  IF p_work_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.construction_work_packages package_row
    WHERE package_row.id = p_work_package_id
      AND package_row.tenant_id = v_site.tenant_id
      AND package_row.project_id = v_site.project_id
      AND package_row.site_id = p_site_id
      AND package_row.org_unit_id = v_site.org_unit_id
      AND package_row.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'CONSTRUCTION_WORK_PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.construction_site_diary_entries (
    tenant_id, project_id, site_id, org_unit_id, work_package_id,
    entry_date, content, author_user_id, created_by, updated_by
  ) VALUES (
    v_site.tenant_id, v_site.project_id, p_site_id, v_site.org_unit_id, p_work_package_id,
    p_entry_date, trim(p_content), v_actor.id, v_actor.id, v_actor.id
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_update_site_diary_entry(
  p_entry_id uuid,
  p_entry_date date,
  p_work_package_id uuid,
  p_content text
)
RETURNS public.construction_site_diary_entries
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_entry public.construction_site_diary_entries;
  v_decision record;
  v_result public.construction_site_diary_entries;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_entry_date IS NULL OR p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_DIARY_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT diary.* INTO v_entry
  FROM public.construction_site_diary_entries diary
  WHERE diary.id = p_entry_id AND diary.tenant_id = v_actor.tenant_id
  FOR UPDATE;
  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_DIARY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action('construction.site_diary.update', v_entry.tenant_id, v_entry.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  IF p_work_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.construction_work_packages package_row
    WHERE package_row.id = p_work_package_id
      AND package_row.tenant_id = v_entry.tenant_id
      AND package_row.project_id = v_entry.project_id
      AND package_row.site_id = v_entry.site_id
      AND package_row.org_unit_id = v_entry.org_unit_id
      AND package_row.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'CONSTRUCTION_WORK_PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.construction_site_diary_entries diary
  SET entry_date = p_entry_date,
      work_package_id = p_work_package_id,
      content = trim(p_content)
  WHERE diary.id = v_entry.id AND diary.tenant_id = v_entry.tenant_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_create_issue(
  p_site_id uuid,
  p_title text,
  p_description text,
  p_due_date date,
  p_diary_entry_id uuid,
  p_work_package_id uuid
)
RETURNS public.construction_issues
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_site record;
  v_decision record;
  v_result public.construction_issues;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0
    OR p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT context.tenant_id, context.project_id, context.org_unit_id, context.status
    INTO v_site
  FROM private.construction_site_context_for_actor(p_site_id) context
  WHERE context.tenant_id = v_actor.tenant_id;
  IF v_site.tenant_id IS NULL OR v_site.status <> 'active' THEN
    RAISE EXCEPTION 'CONSTRUCTION_SITE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action('construction.issue.create', v_site.tenant_id, v_site.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;
  IF p_work_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.construction_work_packages package_row
    WHERE package_row.id = p_work_package_id
      AND package_row.tenant_id = v_site.tenant_id
      AND package_row.project_id = v_site.project_id
      AND package_row.site_id = p_site_id
      AND package_row.org_unit_id = v_site.org_unit_id
      AND package_row.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'CONSTRUCTION_WORK_PACKAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.construction_issues (
    tenant_id, project_id, site_id, org_unit_id, diary_entry_id, work_package_id,
    title, description, status, due_date, created_by, updated_by
  ) VALUES (
    v_site.tenant_id, v_site.project_id, p_site_id, v_site.org_unit_id,
    p_diary_entry_id, p_work_package_id, trim(p_title), trim(p_description),
    'OPEN', p_due_date, v_actor.id, v_actor.id
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_update_issue(
  p_issue_id uuid,
  p_title text,
  p_description text,
  p_due_date date,
  p_diary_entry_id uuid,
  p_work_package_id uuid
)
RETURNS public.construction_issues
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_issue public.construction_issues;
  v_decision record;
  v_result public.construction_issues;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0
    OR p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT issue.* INTO v_issue
  FROM public.construction_issues issue
  WHERE issue.id = p_issue_id AND issue.tenant_id = v_actor.tenant_id
  FOR UPDATE;
  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action('construction.issue.update', v_issue.tenant_id, v_issue.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;
  IF v_issue.status IN ('RESOLVED', 'CLOSED') THEN
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_EDIT_AFTER_RESOLUTION' USING ERRCODE = '23514';
  END IF;

  UPDATE public.construction_issues issue
  SET title = trim(p_title),
      description = trim(p_description),
      due_date = p_due_date,
      diary_entry_id = p_diary_entry_id,
      work_package_id = p_work_package_id
  WHERE issue.id = v_issue.id AND issue.tenant_id = v_issue.tenant_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_transition_issue(
  p_issue_id uuid,
  p_target_status text,
  p_resolution_result text DEFAULT NULL,
  p_reopen_reason text DEFAULT NULL
)
RETURNS public.construction_issues
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_issue public.construction_issues;
  v_permission text;
  v_decision record;
  v_result public.construction_issues;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT issue.* INTO v_issue
  FROM public.construction_issues issue
  WHERE issue.id = p_issue_id AND issue.tenant_id = v_actor.tenant_id
  FOR UPDATE;
  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_target_status = 'IN_PROGRESS' AND v_issue.status = 'OPEN' THEN
    v_permission := 'construction.issue.update';
  ELSIF p_target_status = 'RESOLVED' AND v_issue.status IN ('OPEN', 'IN_PROGRESS')
    AND length(trim(COALESCE(p_resolution_result, ''))) > 0 THEN
    v_permission := 'construction.issue.resolve';
  ELSIF p_target_status = 'CLOSED' AND v_issue.status = 'RESOLVED' THEN
    v_permission := 'construction.issue.close';
  ELSIF p_target_status = 'IN_PROGRESS' AND v_issue.status IN ('RESOLVED', 'CLOSED')
    AND length(trim(COALESCE(p_reopen_reason, ''))) > 0 THEN
    v_permission := 'construction.issue.reopen';
  ELSE
    RAISE EXCEPTION 'CONSTRUCTION_ISSUE_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT decision.status INTO v_decision
  FROM public.platform_authorize_action(v_permission, v_issue.tenant_id, v_issue.org_unit_id) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.status, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  UPDATE public.construction_issues issue
  SET status = p_target_status,
      resolution_result = CASE WHEN p_target_status = 'RESOLVED'
        THEN NULLIF(trim(p_resolution_result), '') ELSE issue.resolution_result END,
      reopen_reason = CASE WHEN p_target_status = 'IN_PROGRESS' AND v_issue.status IN ('RESOLVED', 'CLOSED')
        THEN NULLIF(trim(p_reopen_reason), '') ELSE issue.reopen_reason END,
      closed_at = CASE WHEN p_target_status = 'CLOSED' THEN statement_timestamp() ELSE NULL END
  WHERE issue.id = v_issue.id AND issue.tenant_id = v_issue.tenant_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.construction_list_site_activity_sites() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_activity_work_packages(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_site_diary_entries(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_issues(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_create_site_diary_entry(uuid, date, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_update_site_diary_entry(uuid, date, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_create_issue(uuid, text, text, date, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_update_issue(uuid, text, text, date, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_transition_issue(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.construction_list_site_activity_sites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_activity_work_packages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_site_diary_entries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_issues(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_create_site_diary_entry(uuid, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_update_site_diary_entry(uuid, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_create_issue(uuid, text, text, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_update_issue(uuid, text, text, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_transition_issue(uuid, text, text, text) TO authenticated;

COMMIT;
