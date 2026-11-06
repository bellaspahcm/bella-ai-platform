-- Add task responsibility and same-work-package finish-to-start dependencies.
-- Construction-owned, additive, and intended for local/non-production only.

BEGIN;

ALTER TABLE public.construction_schedule_items
  ADD COLUMN responsible_user_id uuid,
  ADD COLUMN predecessor_schedule_item_id uuid,
  ADD CONSTRAINT uq_construction_schedule_item_tenant_package
    UNIQUE (tenant_id, id, work_package_id),
  ADD CONSTRAINT fk_construction_schedule_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_construction_schedule_predecessor_same_package
    FOREIGN KEY (tenant_id, predecessor_schedule_item_id, work_package_id)
    REFERENCES public.construction_schedule_items(tenant_id, id, work_package_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT ck_construction_schedule_item_not_own_predecessor
    CHECK (predecessor_schedule_item_id IS NULL OR predecessor_schedule_item_id <> id);

-- zero-downtime: allow blocking-index - The responsibility index is added to the new Schedule table before runtime exposure.
CREATE INDEX idx_construction_schedule_items_tenant_responsible
  ON public.construction_schedule_items (tenant_id, responsible_user_id)
  WHERE responsible_user_id IS NOT NULL;

-- zero-downtime: allow blocking-index - The dependency index is added to the new Schedule table before runtime exposure.
CREATE INDEX idx_construction_schedule_items_predecessor
  ON public.construction_schedule_items (tenant_id, predecessor_schedule_item_id)
  WHERE predecessor_schedule_item_id IS NOT NULL;

GRANT UPDATE (responsible_user_id, predecessor_schedule_item_id)
  ON public.construction_schedule_items TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_construction_schedule_assignment_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_assignee_tenant uuid;
  v_assignee_status text;
  v_predecessor_end date;
  v_has_cycle boolean := false;
BEGIN
  IF NEW.responsible_user_id IS NOT NULL THEN
    SELECT person.tenant_id, person.status
      INTO v_assignee_tenant, v_assignee_status
    FROM public.users person
    WHERE person.id = NEW.responsible_user_id;

    IF v_assignee_tenant IS DISTINCT FROM NEW.tenant_id
      OR v_assignee_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_ASSIGNEE_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.predecessor_schedule_item_id IS NOT NULL THEN
    SELECT predecessor.forecast_end_date
      INTO v_predecessor_end
    FROM public.construction_schedule_items predecessor
    WHERE predecessor.id = NEW.predecessor_schedule_item_id
      AND predecessor.tenant_id = NEW.tenant_id
      AND predecessor.work_package_id = NEW.work_package_id;

    IF v_predecessor_end IS NULL THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_PREDECESSOR_INVALID' USING ERRCODE = '23514';
    END IF;

    IF NEW.forecast_start_date < v_predecessor_end THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_DEPENDENCY_DATE_CONFLICT' USING ERRCODE = '23514';
    END IF;

    WITH RECURSIVE predecessor_chain(schedule_item_id) AS (
      SELECT NEW.predecessor_schedule_item_id
      UNION
      SELECT parent.predecessor_schedule_item_id
      FROM public.construction_schedule_items parent
      JOIN predecessor_chain chain ON parent.id = chain.schedule_item_id
      WHERE parent.tenant_id = NEW.tenant_id
        AND parent.work_package_id = NEW.work_package_id
        AND parent.predecessor_schedule_item_id IS NOT NULL
    )
    SELECT EXISTS (
      SELECT 1 FROM predecessor_chain WHERE schedule_item_id = NEW.id
    ) INTO v_has_cycle;

    IF v_has_cycle THEN
      RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_DEPENDENCY_CYCLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.forecast_end_date > OLD.forecast_end_date
    AND EXISTS (
      SELECT 1
      FROM public.construction_schedule_items dependent
      WHERE dependent.tenant_id = NEW.tenant_id
        AND dependent.predecessor_schedule_item_id = NEW.id
        AND dependent.forecast_start_date < NEW.forecast_end_date
    ) THEN
    RAISE EXCEPTION 'CONSTRUCTION_SCHEDULE_DEPENDENT_DATE_CONFLICT' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_construction_schedule_assignment_dependency()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_construction_schedule_assignment_dependency
  BEFORE UPDATE OF responsible_user_id, predecessor_schedule_item_id,
    forecast_start_date, forecast_end_date
  ON public.construction_schedule_items
  FOR EACH ROW EXECUTE FUNCTION private.guard_construction_schedule_assignment_dependency();

CREATE OR REPLACE FUNCTION public.construction_create_schedule_item_with_details(
  p_work_package_id uuid,
  p_title text,
  p_baseline_start_date date,
  p_baseline_end_date date,
  p_responsible_user_id uuid DEFAULT NULL,
  p_predecessor_schedule_item_id uuid DEFAULT NULL
)
RETURNS public.construction_schedule_items
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item public.construction_schedule_items;
BEGIN
  v_item := public.construction_create_schedule_item(
    p_work_package_id, p_title, p_baseline_start_date, p_baseline_end_date
  );

  UPDATE public.construction_schedule_items item
  SET responsible_user_id = p_responsible_user_id,
      predecessor_schedule_item_id = p_predecessor_schedule_item_id
  WHERE item.id = v_item.id
  RETURNING item.* INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.construction_update_schedule_item_with_details(
  p_schedule_item_id uuid,
  p_forecast_start_date date,
  p_forecast_end_date date,
  p_actual_start_date date,
  p_actual_end_date date,
  p_progress_percent numeric,
  p_delay_reason text DEFAULT NULL,
  p_responsible_user_id uuid DEFAULT NULL,
  p_predecessor_schedule_item_id uuid DEFAULT NULL
)
RETURNS public.construction_schedule_items
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item public.construction_schedule_items;
BEGIN
  v_item := public.construction_update_schedule_item(
    p_schedule_item_id,
    p_forecast_start_date,
    p_forecast_end_date,
    p_actual_start_date,
    p_actual_end_date,
    p_progress_percent,
    p_delay_reason
  );

  UPDATE public.construction_schedule_items item
  SET responsible_user_id = p_responsible_user_id,
      predecessor_schedule_item_id = p_predecessor_schedule_item_id
  WHERE item.id = p_schedule_item_id
  RETURNING item.* INTO v_item;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.construction_create_schedule_item_with_details(uuid, text, date, date, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.construction_update_schedule_item_with_details(uuid, date, date, date, date, numeric, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.construction_create_schedule_item_with_details(uuid, text, date, date, uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.construction_update_schedule_item_with_details(uuid, date, date, date, date, numeric, text, uuid, uuid)
  TO authenticated;

COMMIT;
