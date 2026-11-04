-- Live primary authorization and trigger verification. All synthetic rows and
-- no-op parent updates are enclosed in one transaction and rolled back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $fixtures$
DECLARE
  v_actor_a uuid;
  v_tenant_a uuid;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_actor_b uuid;
  v_tenant_b uuid;
  v_tenant_journey uuid;
  v_actor_journey uuid;
  v_customer_id uuid;
  v_stage_id uuid;
  v_encounter_a uuid := pg_catalog.gen_random_uuid();
  v_encounter_b uuid := pg_catalog.gen_random_uuid();
  v_vehicle_history_a uuid := pg_catalog.gen_random_uuid();
  v_vehicle_history_b uuid := pg_catalog.gen_random_uuid();
  v_booking_history_a uuid := pg_catalog.gen_random_uuid();
  v_booking_history_b uuid := pg_catalog.gen_random_uuid();
  v_journey_history_a uuid := pg_catalog.gen_random_uuid();
  v_journey_history_b uuid := pg_catalog.gen_random_uuid();
  v_event_a uuid := pg_catalog.gen_random_uuid();
  v_event_b uuid := pg_catalog.gen_random_uuid();
  v_snapshot_a uuid := pg_catalog.gen_random_uuid();
  v_snapshot_b uuid := pg_catalog.gen_random_uuid();
BEGIN
  SELECT u.id, u.tenant_id, v.id, b.id
  INTO v_actor_a, v_tenant_a, v_vehicle_id, v_booking_id
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  JOIN public.tenants t ON t.id = u.tenant_id
  CROSS JOIN LATERAL (
    SELECT x.id FROM public.auto_vehicles x
    WHERE x.tenant_id = u.tenant_id LIMIT 1
  ) v
  CROSS JOIN LATERAL (
    SELECT x.id FROM public.auto_bookings x
    WHERE x.tenant_id = u.tenant_id LIMIT 1
  ) b
  WHERE u.status = 'active' AND t.status = 'active'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.now())
  LIMIT 1;
  IF v_actor_a IS NULL THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_FIXTURE: no active actor tenant has both vehicle and booking rows';
  END IF;

  SELECT u.id, u.tenant_id INTO v_actor_b, v_tenant_b
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.status = 'active' AND t.status = 'active'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.now())
    AND u.tenant_id <> v_tenant_a
  LIMIT 1;
  IF v_actor_b IS NULL THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_FIXTURE: no second active actor tenant';
  END IF;

  SELECT c.tenant_id, c.id, s.id, u.id
  INTO v_tenant_journey, v_customer_id, v_stage_id, v_actor_journey
  FROM public.customers c
  JOIN public.auto_journey_stages s ON s.tenant_id = c.tenant_id
  JOIN public.users u ON u.tenant_id = c.tenant_id
  JOIN auth.users a ON a.id = u.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.auto_customer_journeys j
    WHERE j.tenant_id = c.tenant_id AND j.customer_id = c.id
  )
    AND u.status = 'active' AND t.status = 'active'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.now())
  LIMIT 1;
  IF v_customer_id IS NULL OR v_stage_id IS NULL OR v_actor_journey IS NULL THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_FIXTURE: no active tenant actor, customer, and journey stage pair';
  END IF;

  PERFORM pg_catalog.set_config('test.containment_actor_a', v_actor_a::text, true);
  PERFORM pg_catalog.set_config('test.containment_tenant_a', v_tenant_a::text, true);
  PERFORM pg_catalog.set_config('test.containment_vehicle_id', v_vehicle_id::text, true);
  PERFORM pg_catalog.set_config('test.containment_booking_id', v_booking_id::text, true);
  PERFORM pg_catalog.set_config('test.containment_actor_b', v_actor_b::text, true);
  PERFORM pg_catalog.set_config('test.containment_tenant_b', v_tenant_b::text, true);
  PERFORM pg_catalog.set_config('test.containment_journey_tenant', v_tenant_journey::text, true);
  PERFORM pg_catalog.set_config('test.containment_journey_actor', v_actor_journey::text, true);
  PERFORM pg_catalog.set_config('test.containment_journey_customer', v_customer_id::text, true);
  PERFORM pg_catalog.set_config('test.containment_journey_stage', v_stage_id::text, true);
  PERFORM pg_catalog.set_config('test.containment_encounter_a', v_encounter_a::text, true);
  PERFORM pg_catalog.set_config('test.containment_encounter_b', v_encounter_b::text, true);

  INSERT INTO public.auto_vehicles_history (
    id, tenant_id, variant_id, vin, color_exterior, model_year, status, valid_from, valid_to
  ) VALUES
    (v_vehicle_history_a, v_tenant_a, pg_catalog.gen_random_uuid(), 'CONTAINMENT-TEST-A', 'test', 2026, 'test', pg_catalog.now(), 'infinity'),
    (v_vehicle_history_b, v_tenant_b, pg_catalog.gen_random_uuid(), 'CONTAINMENT-TEST-B', 'test', 2026, 'test', pg_catalog.now(), 'infinity');

  INSERT INTO public.auto_bookings_history (
    id, tenant_id, status, valid_from, valid_to
  ) VALUES
    (v_booking_history_a, v_tenant_a, 'test', pg_catalog.now(), 'infinity'),
    (v_booking_history_b, v_tenant_b, 'test', pg_catalog.now(), 'infinity');

  INSERT INTO public.auto_customer_journeys_history (
    id, tenant_id, sla_status, valid_from, valid_to
  ) VALUES
    (v_journey_history_a, v_tenant_a, 'test', pg_catalog.now(), 'infinity'),
    (v_journey_history_b, v_tenant_b, 'test', pg_catalog.now(), 'infinity');

  INSERT INTO public.hc_temporal_events (
    id, tenant_id, encounter_id, patient_id, aggregate_type, aggregate_id,
    event_type, valid_time, transaction_time, sequence_number, delta_payload
  ) VALUES
    (v_event_a, v_tenant_a, v_encounter_a, pg_catalog.gen_random_uuid(), 'Test', pg_catalog.gen_random_uuid(), 'test_event', pg_catalog.now(), pg_catalog.now(), 1, '{}'::jsonb),
    (v_event_b, v_tenant_b, v_encounter_b, pg_catalog.gen_random_uuid(), 'Test', pg_catalog.gen_random_uuid(), 'test_event', pg_catalog.now(), pg_catalog.now(), 1, '{}'::jsonb);

  INSERT INTO public.hc_temporal_snapshots (
    id, tenant_id, encounter_id, patient_id, snapshot_version,
    as_of_valid_time, as_of_transaction_time, reconstructed_state
  ) VALUES
    (v_snapshot_a, v_tenant_a, v_encounter_a, pg_catalog.gen_random_uuid(), 0, pg_catalog.now() - interval '1 day', pg_catalog.now() - interval '1 day', '{}'::jsonb),
    (v_snapshot_b, v_tenant_b, v_encounter_b, pg_catalog.gen_random_uuid(), 0, pg_catalog.now() - interval '1 day', pg_catalog.now() - interval '1 day', '{}'::jsonb);
END;
$fixtures$;

DO $set_actor_a$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', current_setting('test.containment_actor_a'), true);
END;
$set_actor_a$;
SET LOCAL ROLE authenticated;

DO $authenticated_checks$
DECLARE
  v_tenant_a uuid := current_setting('test.containment_tenant_a')::uuid;
  v_tenant_b uuid := current_setting('test.containment_tenant_b')::uuid;
  v_entity uuid;
  v_before bigint;
  v_after bigint;
  v_count bigint;
  v_updated bigint;
  v_denied boolean;
  v_h9 jsonb;
BEGIN
  IF current_user <> 'authenticated' OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_ROLE: authenticated role was not active';
  END IF;

  IF has_table_privilege(current_user, 'public.auto_bookings_history', 'INSERT')
     OR has_table_privilege(current_user, 'public.hc_temporal_events', 'UPDATE') THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_ACL: authenticated retains direct history writes';
  END IF;

  SELECT count(*) INTO v_count FROM public.auto_vehicles_history WHERE tenant_id = v_tenant_a;
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A cannot read own vehicle history'; END IF;
  SELECT count(*) INTO v_count FROM public.auto_bookings_history WHERE tenant_id = v_tenant_a;
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A cannot read own booking history'; END IF;
  SELECT count(*) INTO v_count FROM public.auto_customer_journeys_history WHERE tenant_id = v_tenant_a;
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A cannot read own journey history'; END IF;
  SELECT count(*) INTO v_count FROM public.hc_temporal_events WHERE tenant_id = v_tenant_a;
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A cannot read own temporal events'; END IF;
  SELECT count(*) INTO v_count FROM public.hc_temporal_snapshots WHERE tenant_id = v_tenant_a;
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A cannot read own temporal snapshots'; END IF;
  SELECT count(*) INTO v_count FROM public.auto_vehicles_history WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A read tenant B vehicle history'; END IF;
  SELECT count(*) INTO v_count FROM public.auto_bookings_history WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A read tenant B booking history'; END IF;
  SELECT count(*) INTO v_count FROM public.auto_customer_journeys_history WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A read tenant B journey history'; END IF;
  SELECT count(*) INTO v_count FROM public.hc_temporal_events WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A read tenant B temporal events'; END IF;
  SELECT count(*) INTO v_count FROM public.hc_temporal_snapshots WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RLS: tenant A read tenant B temporal snapshots'; END IF;

  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_vehicle_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant_b);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: vehicle_as_of accepted tenant B'; END IF;
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_booking_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant_b);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: booking_as_of accepted tenant B'; END IF;
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_journey_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant_b);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: journey_as_of accepted tenant B'; END IF;
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_temporal_vehicle_inventory(v_tenant_b, pg_catalog.now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: temporal_vehicle_inventory accepted tenant B'; END IF;
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_vehicle_status_history(v_tenant_b, pg_catalog.gen_random_uuid(), pg_catalog.now() - interval '1 day', pg_catalog.now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: vehicle_status_history accepted tenant B'; END IF;
  v_denied := false;
  BEGIN
    PERFORM public.reconstruct_temporal_state_at(v_tenant_b, current_setting('test.containment_encounter_b')::uuid, pg_catalog.now(), 'VALID_TIME');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: H9 accepted tenant B'; END IF;

  v_h9 := public.reconstruct_temporal_state_at(
    v_tenant_a, current_setting('test.containment_encounter_a')::uuid,
    pg_catalog.now() + interval '1 hour', 'VALID_TIME'
  );
  IF (v_h9->>'eventCountReconstructed')::integer <> 1 THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_H9: authenticated own-tenant reconstruction failed';
  END IF;

  v_entity := current_setting('test.containment_vehicle_id')::uuid;
  SELECT count(*) INTO v_before FROM public.auto_vehicles_history WHERE tenant_id = v_tenant_a;
  UPDATE public.auto_vehicles SET location_note = location_note
  WHERE id = v_entity AND tenant_id = v_tenant_a;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  SELECT count(*) INTO v_after FROM public.auto_vehicles_history WHERE tenant_id = v_tenant_a;
  IF v_updated <> 1 OR v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_TRIGGER: authenticated vehicle history write failed';
  END IF;

  v_entity := current_setting('test.containment_booking_id')::uuid;
  SELECT count(*) INTO v_before FROM public.auto_bookings_history WHERE tenant_id = v_tenant_a;
  UPDATE public.auto_bookings SET status = status
  WHERE id = v_entity AND tenant_id = v_tenant_a;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  SELECT count(*) INTO v_after FROM public.auto_bookings_history WHERE tenant_id = v_tenant_a;
  IF v_updated <> 1 OR v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_TRIGGER: authenticated booking history write failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_vehicle_as_of(
    current_setting('test.containment_vehicle_id')::uuid,
    pg_catalog.now() + interval '1 hour', v_tenant_a
  );
  IF v_count <> 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: own-tenant get_vehicle_as_of failed'; END IF;
  SELECT count(*) INTO v_count
  FROM public.get_booking_as_of(
    current_setting('test.containment_booking_id')::uuid,
    pg_catalog.now() + interval '1 hour', v_tenant_a
  );
  IF v_count <> 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: own-tenant get_booking_as_of failed'; END IF;
  SELECT count(*) INTO v_count
  FROM public.get_temporal_vehicle_inventory(v_tenant_a, pg_catalog.now());
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: own-tenant get_temporal_vehicle_inventory failed'; END IF;
  SELECT count(*) INTO v_count
  FROM public.get_vehicle_status_history(
    v_tenant_a, current_setting('test.containment_vehicle_id')::uuid,
    pg_catalog.now() - interval '1 hour', pg_catalog.now() + interval '1 hour'
  );
  IF v_count < 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: own-tenant get_vehicle_status_history failed'; END IF;

  PERFORM pg_catalog.set_config('test.result_tenant_rls', 'PASS', true);
  PERFORM pg_catalog.set_config('test.result_rpc_tenant', 'PASS', true);
  PERFORM pg_catalog.set_config('test.result_rpc_own_tenant', 'PASS', true);
  PERFORM pg_catalog.set_config('test.result_auto_auth_triggers', 'PASS', true);
  PERFORM pg_catalog.set_config('test.result_h9_auth_read', 'PASS', true);
END;
$authenticated_checks$;

RESET ROLE;
DO $set_service_role$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
END;
$set_service_role$;
SET LOCAL ROLE service_role;

DO $server_checks$
DECLARE
  v_journey_id uuid := pg_catalog.gen_random_uuid();
  v_journey_tenant uuid := current_setting('test.containment_journey_tenant')::uuid;
  v_customer_id uuid := current_setting('test.containment_journey_customer')::uuid;
  v_stage_id uuid := current_setting('test.containment_journey_stage')::uuid;
  v_event_id uuid := pg_catalog.gen_random_uuid();
  v_encounter_id uuid := current_setting('test.containment_encounter_a')::uuid;
  v_patient_id uuid := pg_catalog.gen_random_uuid();
  v_before bigint;
  v_after bigint;
  v_updated bigint;
  v_result jsonb;
BEGIN
  IF current_user <> 'service_role' OR auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_ROLE: service_role was not active';
  END IF;

  SELECT count(*) INTO v_before
  FROM public.auto_customer_journeys_history WHERE tenant_id = v_journey_tenant;
  INSERT INTO public.auto_customer_journeys (id, tenant_id, customer_id, current_stage_id)
  VALUES (v_journey_id, v_journey_tenant, v_customer_id, v_stage_id);
  UPDATE public.auto_customer_journeys SET sla_status = sla_status
  WHERE id = v_journey_id AND tenant_id = v_journey_tenant;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  SELECT count(*) INTO v_after
  FROM public.auto_customer_journeys_history WHERE tenant_id = v_journey_tenant;
  IF v_updated <> 1 OR v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_TRIGGER: service_role journey history write failed';
  END IF;

  INSERT INTO public.hc_temporal_events (
    id, tenant_id, encounter_id, patient_id, aggregate_type, aggregate_id,
    event_type, valid_time, transaction_time, sequence_number, delta_payload
  ) VALUES (
    v_event_id,
    current_setting('test.containment_tenant_a')::uuid,
    v_encounter_id, v_patient_id, 'Pharmacy', pg_catalog.gen_random_uuid(),
    'medication_recorded', pg_catalog.now(), pg_catalog.now(), 2,
    '{"containmentProbe":true}'::jsonb
  );
  v_result := public.reconstruct_temporal_state_at(
    current_setting('test.containment_tenant_a')::uuid, v_encounter_id,
    pg_catalog.now() + interval '1 hour', 'VALID_TIME'
  );
  IF (v_result->>'eventCountReconstructed')::integer <> 2 THEN
    RAISE EXCEPTION 'CONTAINMENT_TEST_H9: service_role write and reconstruction failed';
  END IF;

  PERFORM pg_catalog.set_config('test.result_auto_journey_trigger', 'PASS', true);
  PERFORM pg_catalog.set_config('test.result_h9_service_flow', 'PASS', true);
  PERFORM pg_catalog.set_config('test.containment_journey_id', v_journey_id::text, true);
END;
$server_checks$;

RESET ROLE;
DO $set_journey_actor$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', current_setting('test.containment_journey_actor'), true);
END;
$set_journey_actor$;
SET LOCAL ROLE authenticated;

DO $journey_rpc_check$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.get_journey_as_of(
    current_setting('test.containment_journey_id')::uuid,
    pg_catalog.now() + interval '1 hour',
    current_setting('test.containment_journey_tenant')::uuid
  );
  IF v_count <> 1 THEN RAISE EXCEPTION 'CONTAINMENT_TEST_RPC: own-tenant get_journey_as_of failed'; END IF;
  PERFORM pg_catalog.set_config('test.result_rpc_own_journey', 'PASS', true);
END;
$journey_rpc_check$;

RESET ROLE;
DO $set_anon_role$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
END;
$set_anon_role$;
SET LOCAL ROLE anon;

DO $anonymous_checks$
DECLARE
  v_tenant uuid := current_setting('test.containment_tenant_a')::uuid;
  v_denied boolean;
BEGIN
  v_denied := false;
  BEGIN PERFORM count(*) FROM public.auto_vehicles_history;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: history REST/table access remains'; END IF;

  v_denied := false;
  BEGIN PERFORM * FROM public.get_vehicle_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: get_vehicle_as_of remains executable'; END IF;
  v_denied := false;
  BEGIN PERFORM * FROM public.get_booking_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: get_booking_as_of remains executable'; END IF;
  v_denied := false;
  BEGIN PERFORM * FROM public.get_journey_as_of(pg_catalog.gen_random_uuid(), pg_catalog.now(), v_tenant);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: get_journey_as_of remains executable'; END IF;
  v_denied := false;
  BEGIN PERFORM * FROM public.get_temporal_vehicle_inventory(v_tenant, pg_catalog.now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: get_temporal_vehicle_inventory remains executable'; END IF;
  v_denied := false;
  BEGIN PERFORM * FROM public.get_vehicle_status_history(v_tenant, pg_catalog.gen_random_uuid(), pg_catalog.now() - interval '1 day', pg_catalog.now());
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: get_vehicle_status_history remains executable'; END IF;
  v_denied := false;
  BEGIN PERFORM public.reconstruct_temporal_state_at(v_tenant, pg_catalog.gen_random_uuid(), pg_catalog.now(), 'VALID_TIME');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CONTAINMENT_TEST_ANON: reconstruct_temporal_state_at remains executable'; END IF;

  PERFORM pg_catalog.set_config('test.result_anonymous_sql_denials', 'PASS', true);
END;
$anonymous_checks$;

RESET ROLE;
SELECT jsonb_build_object(
  'anonymous_sql_denials', current_setting('test.result_anonymous_sql_denials'),
  'tenant_a_vs_b_rls', current_setting('test.result_tenant_rls'),
  'auto_rpc_tenant_guards', current_setting('test.result_rpc_tenant'),
  'auto_rpc_own_tenant_reads', current_setting('test.result_rpc_own_tenant'),
  'auto_journey_rpc_own_tenant_read', current_setting('test.result_rpc_own_journey'),
  'authenticated_vehicle_booking_triggers', current_setting('test.result_auto_auth_triggers'),
  'service_role_journey_trigger', current_setting('test.result_auto_journey_trigger'),
  'h9_authenticated_tenant_read', current_setting('test.result_h9_auth_read'),
  'h9_service_role_write_and_reconstruct', current_setting('test.result_h9_service_flow'),
  'persistent_fixture_rows', 0
) AS verification;

ROLLBACK;
