-- Scoped P0 containment for the five identified history tables, six RPCs,
-- and their three Auto history triggers. No table/column or Kernel changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('public.auto_vehicles_history'::regclass),
      ('public.auto_bookings_history'::regclass),
      ('public.auto_customer_journeys_history'::regclass),
      ('public.hc_temporal_events'::regclass),
      ('public.hc_temporal_snapshots'::regclass)
    ) AS target(relid)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid = target.relid AND c.relkind IN ('r', 'p')
    )
  ) THEN
    RAISE EXCEPTION 'TEMPORAL_CONTAINMENT_PREFLIGHT: expected history table missing or not a table';
  END IF;

  IF to_regprocedure('public.platform_current_actor_profile()') IS NULL
     OR to_regprocedure('public.get_vehicle_as_of(uuid,timestamptz,uuid)') IS NULL
     OR to_regprocedure('public.get_booking_as_of(uuid,timestamptz,uuid)') IS NULL
     OR to_regprocedure('public.get_journey_as_of(uuid,timestamptz,uuid)') IS NULL
     OR to_regprocedure('public.get_temporal_vehicle_inventory(uuid,timestamptz)') IS NULL
     OR to_regprocedure('public.get_vehicle_status_history(uuid,uuid,timestamptz,timestamptz)') IS NULL
     OR to_regprocedure('public.reconstruct_temporal_state_at(uuid,uuid,timestamptz,text)') IS NULL THEN
    RAISE EXCEPTION 'TEMPORAL_CONTAINMENT_PREFLIGHT: canonical actor contract or expected RPC signature missing';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (t.tgname, c.relname) IN (
        ('auto_vehicles_temporal_trigger', 'auto_vehicles'),
        ('auto_bookings_temporal_trigger', 'auto_bookings'),
        ('auto_customer_journeys_temporal_trigger', 'auto_customer_journeys')
      )
      AND NOT t.tgisinternal
      AND t.tgenabled = 'O'
  ) <> 3 THEN
    RAISE EXCEPTION 'TEMPORAL_CONTAINMENT_PREFLIGHT: expected three enabled Auto history triggers';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN (
        'auto_vehicles_history', 'auto_bookings_history',
        'auto_customer_journeys_history', 'hc_temporal_events',
        'hc_temporal_snapshots'
      )
      AND p.policyname NOT IN (
        'auto_vehicles_history_actor_read',
        'auto_bookings_history_actor_read',
        'auto_customer_journeys_history_actor_read',
        'hc_temporal_events_actor_read',
        'hc_temporal_snapshots_actor_read'
      )
  ) THEN
    RAISE EXCEPTION 'TEMPORAL_CONTAINMENT_PREFLIGHT: unexpected policy exists on scoped history tables';
  END IF;
END;
$preflight$;

-- The Platform actor contract is the only authenticated tenant source.
ALTER TABLE public.auto_vehicles_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_bookings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_customer_journeys_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_temporal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_temporal_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.auto_vehicles_history,
  public.auto_bookings_history,
  public.auto_customer_journeys_history,
  public.hc_temporal_events,
  public.hc_temporal_snapshots
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.auto_vehicles_history,
  public.auto_bookings_history,
  public.auto_customer_journeys_history,
  public.hc_temporal_events,
  public.hc_temporal_snapshots
TO authenticated;

DROP POLICY IF EXISTS auto_vehicles_history_actor_read ON public.auto_vehicles_history;
CREATE POLICY auto_vehicles_history_actor_read ON public.auto_vehicles_history
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM public.platform_current_actor_profile() p));

DROP POLICY IF EXISTS auto_bookings_history_actor_read ON public.auto_bookings_history;
CREATE POLICY auto_bookings_history_actor_read ON public.auto_bookings_history
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM public.platform_current_actor_profile() p));

DROP POLICY IF EXISTS auto_customer_journeys_history_actor_read ON public.auto_customer_journeys_history;
CREATE POLICY auto_customer_journeys_history_actor_read ON public.auto_customer_journeys_history
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM public.platform_current_actor_profile() p));

DROP POLICY IF EXISTS hc_temporal_events_actor_read ON public.hc_temporal_events;
CREATE POLICY hc_temporal_events_actor_read ON public.hc_temporal_events
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM public.platform_current_actor_profile() p));

DROP POLICY IF EXISTS hc_temporal_snapshots_actor_read ON public.hc_temporal_snapshots;
CREATE POLICY hc_temporal_snapshots_actor_read ON public.hc_temporal_snapshots
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM public.platform_current_actor_profile() p));

-- Trigger execution follows the parent UPDATE role. Keep authenticated Auto
-- updates and trusted server updates working while the history table itself
-- denies direct client writes.
CREATE OR REPLACE FUNCTION public.temporal_snapshot_auto_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM OLD.tenant_id
       OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auto_vehicles_history
  SET valid_to = pg_catalog.now()
  WHERE id = OLD.id AND tenant_id = OLD.tenant_id AND valid_to = 'infinity';

  INSERT INTO public.auto_vehicles_history (
    id, tenant_id, variant_id, vin, chassis_number, engine_number,
    color_exterior, color_interior, model_year, list_price, cost_price,
    status, location_note, allocated_to_contract_id, allocated_at,
    delivered_at, delivered_to_customer_id, valid_from, changed_by
  ) VALUES (
    OLD.id, OLD.tenant_id, OLD.variant_id, OLD.vin, OLD.chassis_number,
    OLD.engine_number, OLD.color_exterior, OLD.color_interior,
    OLD.model_year, OLD.list_price, OLD.cost_price, OLD.status,
    OLD.location_note, OLD.allocated_to_contract_id, OLD.allocated_at,
    OLD.delivered_at, OLD.delivered_to_customer_id, pg_catalog.now(),
    NULLIF(pg_catalog.current_setting('app.current_user_id', true), '')::uuid
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.temporal_snapshot_auto_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM OLD.tenant_id
       OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auto_bookings_history
  SET valid_to = pg_catalog.now()
  WHERE id = OLD.id AND tenant_id = OLD.tenant_id AND valid_to = 'infinity';

  INSERT INTO public.auto_bookings_history (
    id, tenant_id, customer_id, variant_id, vehicle_id,
    status, total_price, deposit_amount, valid_from, changed_by
  ) VALUES (
    OLD.id, OLD.tenant_id, OLD.customer_id, OLD.variant_id, OLD.vehicle_id,
    OLD.status, OLD.total_price, OLD.deposit_amount, pg_catalog.now(),
    NULLIF(pg_catalog.current_setting('app.current_user_id', true), '')::uuid
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.temporal_snapshot_auto_customer_journeys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM OLD.tenant_id
       OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auto_customer_journeys_history
  SET valid_to = pg_catalog.now()
  WHERE id = OLD.id AND tenant_id = OLD.tenant_id AND valid_to = 'infinity';

  INSERT INTO public.auto_customer_journeys_history (
    id, tenant_id, customer_id, current_stage_id, entered_stage_at,
    sla_deadline, sla_status, valid_from, changed_by
  ) VALUES (
    OLD.id, OLD.tenant_id, OLD.customer_id, OLD.current_stage_id,
    OLD.entered_stage_at, OLD.sla_deadline, OLD.sla_status,
    pg_catalog.now(),
    NULLIF(pg_catalog.current_setting('app.current_user_id', true), '')::uuid
  );

  RETURN NEW;
END;
$function$;

-- Auto temporal RPCs remain usable by signed-in users only for their own
-- tenant, plus trusted service_role server callers.
CREATE OR REPLACE FUNCTION public.get_vehicle_as_of(
  p_entity_id uuid, p_as_of_date timestamptz, p_tenant_id uuid
)
RETURNS TABLE (
  id uuid, tenant_id uuid, variant_id uuid, vin text, chassis_number text,
  engine_number text, color_exterior text, color_interior text,
  model_year integer, list_price numeric, cost_price numeric,
  status text, location_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT h.id, h.tenant_id, h.variant_id, h.vin, h.chassis_number,
         h.engine_number, h.color_exterior, h.color_interior, h.model_year,
         h.list_price, h.cost_price, h.status::text, h.location_note
  FROM public.auto_vehicles_history h
  WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
    AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
  UNION ALL
  SELECT v.id, v.tenant_id, v.variant_id, v.vin, v.chassis_number,
         v.engine_number, v.color_exterior, v.color_interior, v.model_year,
         v.list_price, v.cost_price, v.status::text, v.location_note
  FROM public.auto_vehicles v
  WHERE v.id = p_entity_id AND v.tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM public.auto_vehicles_history h
      WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
        AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_booking_as_of(
  p_entity_id uuid, p_as_of_date timestamptz, p_tenant_id uuid
)
RETURNS TABLE (
  id uuid, tenant_id uuid, customer_id uuid, variant_id uuid,
  vehicle_id uuid, status text, total_price numeric, deposit_amount numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT h.id, h.tenant_id, h.customer_id, h.variant_id, h.vehicle_id,
         h.status::text, h.total_price, h.deposit_amount
  FROM public.auto_bookings_history h
  WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
    AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
  UNION ALL
  SELECT b.id, b.tenant_id, b.customer_id, b.variant_id, b.vehicle_id,
         b.status::text, b.total_price, b.deposit_amount
  FROM public.auto_bookings b
  WHERE b.id = p_entity_id AND b.tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM public.auto_bookings_history h
      WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
        AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_journey_as_of(
  p_entity_id uuid, p_as_of_date timestamptz, p_tenant_id uuid
)
RETURNS TABLE (
  id uuid, tenant_id uuid, customer_id uuid,
  current_stage_id uuid, sla_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT h.id, h.tenant_id, h.customer_id, h.current_stage_id, h.sla_status
  FROM public.auto_customer_journeys_history h
  WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
    AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
  UNION ALL
  SELECT j.id, j.tenant_id, j.customer_id, j.current_stage_id, j.sla_status
  FROM public.auto_customer_journeys j
  WHERE j.id = p_entity_id AND j.tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM public.auto_customer_journeys_history h
      WHERE h.id = p_entity_id AND h.tenant_id = p_tenant_id
        AND h.valid_from <= p_as_of_date AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_temporal_vehicle_inventory(
  p_tenant_id uuid,
  p_as_of_time timestamptz DEFAULT pg_catalog.now()
)
RETURNS TABLE (
  id uuid, vin text, variant_id uuid, color_exterior text,
  model_year integer, status text, location_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_as_of_time >= pg_catalog.now() - interval '1 hour' THEN
    RETURN QUERY
    SELECT v.id, v.vin, v.variant_id, v.color_exterior, v.model_year,
           v.status::text, v.location_note
    FROM public.auto_vehicles v
    WHERE v.tenant_id = p_tenant_id
    LIMIT 1000;
  ELSE
    RETURN QUERY
    SELECT h.id, h.vin, h.variant_id, h.color_exterior, h.model_year,
           h.status::text, h.location_note
    FROM public.auto_vehicles_history h
    WHERE h.tenant_id = p_tenant_id
      AND h.valid_from <= p_as_of_time
      AND (h.valid_to = 'infinity' OR h.valid_to > p_as_of_time)
    LIMIT 1000;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_vehicle_status_history(
  p_tenant_id uuid,
  p_vehicle_id uuid,
  p_start_time timestamptz DEFAULT pg_catalog.now() - interval '90 days',
  p_end_time timestamptz DEFAULT pg_catalog.now()
)
RETURNS TABLE (
  valid_from timestamptz, valid_to timestamptz, status text, location_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'AUTO_HISTORY_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'AUTO_HISTORY_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT h.valid_from, h.valid_to, h.status::text, h.location_note
  FROM public.auto_vehicles_history h
  WHERE h.tenant_id = p_tenant_id AND h.id = p_vehicle_id
    AND h.valid_from >= p_start_time AND h.valid_from <= p_end_time
  ORDER BY h.valid_from DESC;
END;
$function$;

-- H9 remains the same invoker-side reconstruction capability. Its actor
-- tenant is checked before reading, and RLS also scopes both source tables.
CREATE OR REPLACE FUNCTION public.reconstruct_temporal_state_at(
  p_tenant_id uuid,
  p_encounter_id uuid,
  p_target_time timestamptz,
  p_dimension text DEFAULT 'VALID_TIME'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant uuid;
  v_role text := auth.role();
  v_patient_id uuid;
  v_snapshot_state jsonb := '{}'::jsonb;
  v_last_snapshot_ver bigint := 0;
  v_rec record;
  v_meds jsonb := '[]'::jsonb;
  v_allergies jsonb := '[]'::jsonb;
  v_labs jsonb := '[]'::jsonb;
  v_vitals jsonb := '[]'::jsonb;
  v_diagnoses jsonb := '[]'::jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_cds_decisions jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  IF v_role = 'authenticated' THEN
    SELECT p.tenant_id INTO v_actor_tenant
    FROM public.platform_current_actor_profile() p;
    IF v_actor_tenant IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'H9_TEMPORAL_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role'
        AND NOT (v_role IS NULL AND session_user = 'postgres') THEN
    RAISE EXCEPTION 'H9_TEMPORAL_CALLER_ROLE_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_dimension = 'TRANSACTION_TIME' THEN
    SELECT s.reconstructed_state, s.snapshot_version, s.patient_id
    INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
    FROM public.hc_temporal_snapshots s
    WHERE s.tenant_id = p_tenant_id
      AND s.encounter_id = p_encounter_id
      AND s.as_of_transaction_time <= p_target_time
    ORDER BY s.snapshot_version DESC
    LIMIT 1;
  ELSE
    SELECT s.reconstructed_state, s.snapshot_version, s.patient_id
    INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
    FROM public.hc_temporal_snapshots s
    WHERE s.tenant_id = p_tenant_id
      AND s.encounter_id = p_encounter_id
      AND s.as_of_valid_time <= p_target_time
    ORDER BY s.snapshot_version DESC
    LIMIT 1;
  END IF;

  v_last_snapshot_ver := COALESCE(v_last_snapshot_ver, 0);
  IF v_snapshot_state IS NOT NULL AND v_snapshot_state <> '{}'::jsonb THEN
    v_meds := COALESCE(v_snapshot_state->'activeMedications', '[]'::jsonb);
    v_allergies := COALESCE(v_snapshot_state->'allergies', '[]'::jsonb);
    v_labs := COALESCE(v_snapshot_state->'labResults', '[]'::jsonb);
    v_vitals := COALESCE(v_snapshot_state->'vitalSigns', '[]'::jsonb);
    v_diagnoses := COALESCE(v_snapshot_state->'diagnoses', '[]'::jsonb);
    v_orders := COALESCE(v_snapshot_state->'orders', '[]'::jsonb);
    v_cds_decisions := COALESCE(v_snapshot_state->'cdsDecisions', '[]'::jsonb);
  END IF;

  FOR v_rec IN
    SELECT e.*
    FROM public.hc_temporal_events e
    WHERE e.tenant_id = p_tenant_id
      AND e.encounter_id = p_encounter_id
      AND e.sequence_number > v_last_snapshot_ver
      AND (
        (p_dimension = 'TRANSACTION_TIME' AND e.transaction_time <= p_target_time)
        OR (p_dimension = 'VALID_TIME' AND e.valid_time <= p_target_time)
      )
    ORDER BY e.sequence_number ASC
  LOOP
    v_patient_id := v_rec.patient_id;
    v_count := v_count + 1;

    IF v_rec.aggregate_type = 'Pharmacy' OR v_rec.event_type LIKE '%medication%' THEN
      v_meds := v_meds || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.event_type LIKE '%allergy%' THEN
      v_allergies := v_allergies || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.aggregate_type = 'Laboratory' OR v_rec.event_type LIKE '%lab%' THEN
      v_labs := v_labs || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.event_type LIKE '%vital%' THEN
      v_vitals := v_vitals || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.event_type LIKE '%diagnosis%' THEN
      v_diagnoses := v_diagnoses || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.aggregate_type = 'Order' OR v_rec.event_type LIKE '%order%' THEN
      v_orders := v_orders || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    ELSIF v_rec.aggregate_type = 'ClinicalDecision' OR v_rec.event_type LIKE '%cds%' THEN
      v_cds_decisions := v_cds_decisions || pg_catalog.jsonb_build_array(v_rec.delta_payload);
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'tenantId', p_tenant_id,
    'encounterId', p_encounter_id,
    'patientId', v_patient_id,
    'asOfValidTime', p_target_time,
    'asOfTransactionTime', pg_catalog.now(),
    'timeDimension', p_dimension,
    'activeMedications', v_meds,
    'allergies', v_allergies,
    'labResults', v_labs,
    'vitalSigns', v_vitals,
    'diagnoses', v_diagnoses,
    'orders', v_orders,
    'cdsDecisions', v_cds_decisions,
    'eventCountReconstructed', v_count
  );
END;
$function$;

-- Remove anonymous execute inherited through PUBLIC. Authenticated RPC calls
-- are constrained by explicit actor checks; server flows retain service_role.
REVOKE ALL ON FUNCTION public.get_vehicle_as_of(uuid,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booking_as_of(uuid,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_journey_as_of(uuid,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_temporal_vehicle_inventory(uuid,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_vehicle_status_history(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reconstruct_temporal_state_at(uuid,uuid,timestamptz,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_vehicle_as_of(uuid,timestamptz,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_as_of(uuid,timestamptz,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_journey_as_of(uuid,timestamptz,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_temporal_vehicle_inventory(uuid,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_vehicle_status_history(uuid,uuid,timestamptz,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconstruct_temporal_state_at(uuid,uuid,timestamptz,text) TO authenticated, service_role;

ROLLBACK;