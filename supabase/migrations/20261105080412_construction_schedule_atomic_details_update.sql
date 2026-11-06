-- Apply forecast/progress and task details in one row mutation so dependency
-- validation sees the complete next state, including dependency replacement.

BEGIN;

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
      delay_reason = NULLIF(trim(p_delay_reason), ''),
      responsible_user_id = p_responsible_user_id,
      predecessor_schedule_item_id = p_predecessor_schedule_item_id
  WHERE item.id = v_item.id AND item.tenant_id = v_actor.tenant_id
  RETURNING item.* INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.construction_update_schedule_item_with_details(uuid, date, date, date, date, numeric, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.construction_update_schedule_item_with_details(uuid, date, date, date, date, numeric, text, uuid, uuid)
  TO authenticated;

COMMIT;
