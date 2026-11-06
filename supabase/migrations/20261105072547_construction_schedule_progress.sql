-- Construction-owned schedule and per-work-package progress foundation.
-- Apply only to local/non-production environments until separately authorized.

BEGIN;

CREATE TABLE public.construction_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  site_id uuid NOT NULL,
  work_package_id uuid NOT NULL,
  org_unit_id uuid NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  baseline_start_date date NOT NULL,
  baseline_end_date date NOT NULL,
  forecast_start_date date NOT NULL,
  forecast_end_date date NOT NULL,
  actual_start_date date,
  actual_end_date date,
  progress_percent numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  delay_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_construction_schedule_items_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT ck_construction_schedule_items_baseline_dates
    CHECK (baseline_start_date <= baseline_end_date),
  CONSTRAINT ck_construction_schedule_items_forecast_dates
    CHECK (forecast_start_date <= forecast_end_date),
  CONSTRAINT ck_construction_schedule_items_actual_dates
    CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date),
  CONSTRAINT fk_construction_schedule_items_work_package_scope
    FOREIGN KEY (tenant_id, work_package_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT
);

-- zero-downtime: allow blocking-index - This migration creates the empty schedule table immediately before indexing it.
CREATE INDEX idx_construction_schedule_items_work_package
  ON public.construction_schedule_items (tenant_id, work_package_id, baseline_start_date, id);

ALTER TABLE public.construction_schedule_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.construction_schedule_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.construction_schedule_items TO authenticated;
GRANT INSERT (
  tenant_id, project_id, site_id, work_package_id, org_unit_id, title,
  baseline_start_date, baseline_end_date, forecast_start_date, forecast_end_date,
  progress_percent, created_by, updated_by
) ON public.construction_schedule_items TO authenticated;
GRANT UPDATE (
  forecast_start_date, forecast_end_date, actual_start_date, actual_end_date,
  progress_percent, delay_reason
) ON public.construction_schedule_items TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_construction_schedule_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT actor.id, actor.tenant_id
    INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();

  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS DISTINCT FROM v_actor.tenant_id
      OR NEW.created_by IS DISTINCT FROM v_actor.id
      OR NEW.updated_by IS DISTINCT FROM v_actor.id
      OR NEW.progress_percent IS DISTINCT FROM 0
      OR NEW.forecast_start_date IS DISTINCT FROM NEW.baseline_start_date
      OR NEW.forecast_end_date IS DISTINCT FROM NEW.baseline_end_date
      OR NEW.actual_start_date IS NOT NULL
      OR NEW.actual_end_date IS NOT NULL
      OR NEW.delay_reason IS NOT NULL THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_INITIAL_STATE_INVALID' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := statement_timestamp();
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.site_id IS DISTINCT FROM OLD.site_id
      OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
      OR NEW.org_unit_id IS DISTINCT FROM OLD.org_unit_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.baseline_start_date IS DISTINCT FROM OLD.baseline_start_date
      OR NEW.baseline_end_date IS DISTINCT FROM OLD.baseline_end_date THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_BASELINE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_by := v_actor.id;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_construction_schedule_item() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_construction_schedule_item
  BEFORE INSERT OR UPDATE ON public.construction_schedule_items
  FOR EACH ROW EXECUTE FUNCTION private.guard_construction_schedule_item();

CREATE POLICY construction_schedule_items_action_read
  ON public.construction_schedule_items FOR SELECT TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('construction:foundation:read', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE POLICY construction_schedule_items_action_insert
  ON public.construction_schedule_items FOR INSERT TO authenticated
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE POLICY construction_schedule_items_action_update
  ON public.construction_schedule_items FOR UPDATE TO authenticated
  USING (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  )
  WITH CHECK (
    public.construction_org_unit_access_allowed(tenant_id, org_unit_id)
    AND updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('construction:work_package:write', tenant_id, org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  );

CREATE OR REPLACE FUNCTION public.construction_create_schedule_item(
  p_work_package_id uuid,
  p_title text,
  p_baseline_start_date date,
  p_baseline_end_date date
)
RETURNS public.construction_schedule_items
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_package record;
  v_decision record;
  v_result public.construction_schedule_items;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0
    OR p_baseline_start_date IS NULL OR p_baseline_end_date IS NULL
    OR p_baseline_start_date > p_baseline_end_date THEN
    RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_INPUT_INVALID' USING ERRCODE = '23514';
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
  FROM public.platform_authorize_action(
    'construction:work_package:write', v_package.tenant_id, v_package.org_unit_id
  ) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.construction_schedule_items (
    tenant_id, project_id, site_id, work_package_id, org_unit_id, title,
    baseline_start_date, baseline_end_date, forecast_start_date, forecast_end_date,
    progress_percent, created_by, updated_by
  ) VALUES (
    v_package.tenant_id, v_package.project_id, v_package.site_id, p_work_package_id,
    v_package.org_unit_id, trim(p_title), p_baseline_start_date, p_baseline_end_date,
    p_baseline_start_date, p_baseline_end_date, 0, v_actor.id, v_actor.id
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_update_schedule_item(
  p_schedule_item_id uuid,
  p_forecast_start_date date,
  p_forecast_end_date date,
  p_actual_start_date date,
  p_actual_end_date date,
  p_progress_percent numeric,
  p_delay_reason text DEFAULT NULL
)
RETURNS public.construction_schedule_items
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor record;
  v_item public.construction_schedule_items;
  v_decision record;
  v_result public.construction_schedule_items;
BEGIN
  SELECT actor.id, actor.tenant_id INTO v_actor
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_AUTH_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_forecast_start_date IS NULL OR p_forecast_end_date IS NULL
    OR p_forecast_start_date > p_forecast_end_date
    OR (p_actual_start_date IS NOT NULL AND p_actual_end_date IS NOT NULL
      AND p_actual_start_date > p_actual_end_date)
    OR p_progress_percent IS NULL OR p_progress_percent < 0 OR p_progress_percent > 100 THEN
    RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_PROGRESS_INPUT_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT item.* INTO v_item
  FROM public.construction_schedule_items item
  WHERE item.id = p_schedule_item_id AND item.tenant_id = v_actor.tenant_id
  FOR UPDATE;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.status, decision.reason INTO v_decision
  FROM public.platform_authorize_action(
    'construction:work_package:write', v_item.tenant_id, v_item.org_unit_id
  ) decision;
  IF v_decision.status IS DISTINCT FROM 'ALLOW' THEN
    RAISE EXCEPTION 'CONSTRUCTION_ACTION_DENIED:%', COALESCE(v_decision.reason, 'RESOLVER_UNAVAILABLE') USING ERRCODE = '42501';
  END IF;

  UPDATE public.construction_schedule_items item
  SET forecast_start_date = p_forecast_start_date,
      forecast_end_date = p_forecast_end_date,
      actual_start_date = p_actual_start_date,
      actual_end_date = p_actual_end_date,
      progress_percent = p_progress_percent,
      delay_reason = NULLIF(trim(p_delay_reason), '')
  WHERE item.id = v_item.id AND item.tenant_id = v_actor.tenant_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_list_schedule_items(p_work_package_id uuid)
RETURNS SETOF public.construction_schedule_items
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT item.*
  FROM public.platform_current_actor_profile() actor
  JOIN public.construction_schedule_items item
    ON item.tenant_id = actor.tenant_id
   AND item.work_package_id = p_work_package_id
  WHERE actor.id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('construction:foundation:read', item.tenant_id, item.org_unit_id) decision
      WHERE decision.status = 'ALLOW'
    )
  ORDER BY item.baseline_start_date, item.id;
$$;

REVOKE ALL ON FUNCTION public.construction_create_schedule_item(uuid, text, date, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_update_schedule_item(uuid, date, date, date, date, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_list_schedule_items(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.construction_create_schedule_item(uuid, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_update_schedule_item(uuid, date, date, date, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_list_schedule_items(uuid) TO authenticated;

COMMIT;
