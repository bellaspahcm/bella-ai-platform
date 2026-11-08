-- Bella Interior Production security hardening.
-- This migration changes catalog objects only; it does not mutate business rows
-- or grant direct table access to anon/authenticated.

DO $preflight$
DECLARE
  v_tables text[] := ARRAY[
    'interior_projects',
    'interior_project_room_zones',
    'interior_design_revisions',
    'interior_design_assets',
    'interior_design_material_specs',
    'interior_boqs',
    'interior_boq_items',
    'interior_quotations',
    'interior_contracts',
    'interior_payment_milestones',
    'interior_production_orders',
    'interior_production_order_items',
    'interior_site_installation_plans',
    'interior_site_room_installations',
    'interior_site_diaries',
    'interior_qc_punch_list_items',
    'interior_handover_dossiers',
    'interior_warranty_certificates',
    'interior_warranty_service_tickets',
    'interior_sync_idempotency',
    'interior_finance_outbox'
  ];
  v_table text;
  v_policy_count integer;
  v_rls_enabled boolean;
BEGIN
  IF cardinality(v_tables) <> 21 THEN
    RAISE EXCEPTION 'Bella Interior security preflight table list is invalid';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Bella Interior security preflight missing table public.%', v_table;
    END IF;

    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class WHERE oid = to_regclass(format('public.%I', v_table));
    IF v_rls_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Bella Interior security preflight RLS is not enabled on public.%', v_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'tenant_id'
    ) THEN
      RAISE EXCEPTION 'Bella Interior security preflight tenant_id missing on public.%', v_table;
    END IF;

    SELECT count(*) INTO v_policy_count
    FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table;
    IF v_policy_count <> 1 OR NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table AND policyname = 'tenant_isolation_policy'
    ) THEN
      RAISE EXCEPTION 'Bella Interior security preflight expected exactly one tenant policy on public.%', v_table;
    END IF;

    IF has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       OR has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       OR has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       OR has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') THEN
      RAISE EXCEPTION 'Bella Interior security preflight found unexpected direct table grants on public.%', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.platform_direct_user_action_grants'::regclass
      AND conname = 'platform_direct_user_action_grants_permission_id_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'Bella Interior security preflight permission allow-list constraint is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_direct_user_action_grants
    WHERE permission_id NOT IN (
      'construction:foundation:read',
      'construction:project:write',
      'construction:site:write',
      'construction:work_package:write',
      'construction:boq:write'
    )
  ) THEN
    RAISE EXCEPTION 'Bella Interior security preflight found an unexpected existing permission identifier';
  END IF;
END
$preflight$;

-- Extend the existing direct-user-action catalog only. No user or role grants
-- are created here; authorization remains deny-by-default.
ALTER TABLE public.platform_direct_user_action_grants
  DROP CONSTRAINT platform_direct_user_action_grants_permission_id_check;

ALTER TABLE public.platform_direct_user_action_grants
  ADD CONSTRAINT platform_direct_user_action_grants_permission_id_check
  CHECK (permission_id IN (
    'construction:foundation:read',
    'construction:project:write',
    'construction:site:write',
    'construction:work_package:write',
    'construction:boq:write',
    'interior:project:read',
    'interior:project:write',
    'interior:customer:read',
    'interior:design:read',
    'interior:design:write',
    'interior:design:approve',
    'interior:boq:read',
    'interior:boq:write',
    'interior:contract:read',
    'interior:contract:write',
    'interior:finance:read',
    'interior:finance:write',
    'interior:schedule:read',
    'interior:schedule:write',
    'interior:production:read',
    'interior:production:write',
    'interior:installation:read',
    'interior:installation:write',
    'interior:qc:read',
    'interior:qc:write',
    'interior:delivery:read',
    'interior:delivery:write',
    'interior:reports:read',
    'interior:warranty:read',
    'interior:warranty:write',
    'interior:design:upload',
    'interior:executive:approve'
  ));

DO $grant_catalog$
DECLARE
  v_definition text;
  v_before text := $before$ p_permission_id NOT IN (
       'construction:foundation:read',
       'construction:project:write',
       'construction:site:write',
       'construction:work_package:write',
       'construction:boq:write'
     )$before$;
  v_after text := $after$ p_permission_id NOT IN (
       'construction:foundation:read',
       'construction:project:write',
       'construction:site:write',
       'construction:work_package:write',
       'construction:boq:write',
       'interior:project:read',
       'interior:project:write',
       'interior:customer:read',
       'interior:design:read',
       'interior:design:write',
       'interior:design:approve',
       'interior:boq:read',
       'interior:boq:write',
       'interior:contract:read',
       'interior:contract:write',
       'interior:finance:read',
       'interior:finance:write',
       'interior:schedule:read',
       'interior:schedule:write',
       'interior:production:read',
       'interior:production:write',
       'interior:installation:read',
       'interior:installation:write',
       'interior:qc:read',
       'interior:qc:write',
       'interior:delivery:read',
       'interior:delivery:write',
       'interior:reports:read',
       'interior:warranty:read',
       'interior:warranty:write',
       'interior:design:upload',
       'interior:executive:approve'
     )$after$;
  v_position integer;
BEGIN
  SELECT pg_get_functiondef('public.platform_grant_direct_user_action(uuid,text,text,uuid)'::regprocedure)
  INTO v_definition;

  v_position := strpos(v_definition, v_before);
  IF v_position = 0 OR strpos(substr(v_definition, v_position + length(v_before)), v_before) > 0 THEN
    RAISE EXCEPTION 'Bella Interior security preflight grant RPC allow-list does not match the reviewed Production definition';
  END IF;

  EXECUTE replace(v_definition, v_before, v_after);
END
$grant_catalog$;

-- Make each Interior RLS boundary derive tenant from the active canonical actor
-- profile, not a caller-controlled/custom JWT tenant claim. A restrictive policy
-- means a future permissive policy cannot widen access across tenants. No table
-- privileges are granted by this migration, so current direct access stays shut.
DO $tenant_policies$
DECLARE
  v_tables text[] := ARRAY[
    'interior_projects',
    'interior_project_room_zones',
    'interior_design_revisions',
    'interior_design_assets',
    'interior_design_material_specs',
    'interior_boqs',
    'interior_boq_items',
    'interior_quotations',
    'interior_contracts',
    'interior_payment_milestones',
    'interior_production_orders',
    'interior_production_order_items',
    'interior_site_installation_plans',
    'interior_site_room_installations',
    'interior_site_diaries',
    'interior_qc_punch_list_items',
    'interior_handover_dossiers',
    'interior_warranty_certificates',
    'interior_warranty_service_tickets',
    'interior_sync_idempotency',
    'interior_finance_outbox'
  ];
  v_table text;
  v_tenant_check text := '(tenant_id = (SELECT actor.tenant_id FROM public.platform_current_actor_profile() AS actor WHERE actor.id = auth.uid()))';
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('DROP POLICY tenant_isolation_policy ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      v_table, v_tenant_check, v_tenant_check
    );
  END LOOP;
END
$tenant_policies$;

-- Revoke public execution and remove authenticated access to the cross-tenant
-- maintenance function. Only the trusted service role may run cleanup.
ALTER FUNCTION public.cleanup_expired_interior_idempotency() SET search_path = '';
REVOKE ALL ON FUNCTION public.cleanup_expired_interior_idempotency() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_interior_idempotency() TO service_role;

-- BOQ persistence remains a SECURITY DEFINER transaction, but authenticated
-- calls must be the active tenant actor, bind audit identity to auth.uid(), and
-- hold the explicit BOQ write action. Service role remains available to trusted
-- server workflows, which still pass all existing tenant/project checks below.
DO $boq_rpc$
DECLARE
  v_definition text;
  v_declaration_before text := '    v_auth_tenant_str TEXT;';
  v_declaration_after text := E'    v_auth_role TEXT;\n    v_actor_tenant_id UUID;';
  v_guard_before text := $before$    -- If caller is authenticated via PostgREST JWT, verify tenant matches JWT claim
    IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
        v_auth_tenant_str := auth.jwt() ->> 'tenant_id';
        IF v_auth_tenant_str IS NOT NULL AND (v_auth_tenant_str)::UUID IS DISTINCT FROM p_tenant_id THEN
            RAISE EXCEPTION 'TenantIsolationViolation: JWT tenant does not match request tenant';
        END IF;
    END IF;$before$;
  v_guard_after text := $after$    v_auth_role := current_setting('request.jwt.claim.role', true);
    IF v_auth_role = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'AuthorizationViolation: authenticated actor is required';
        END IF;

        SELECT actor.tenant_id INTO v_actor_tenant_id
        FROM public.platform_current_actor_profile() AS actor
        WHERE actor.id = auth.uid();

        IF v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
            RAISE EXCEPTION 'TenantIsolationViolation: canonical actor tenant does not match request tenant';
        END IF;

        IF p_audit_actor_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'AuthorizationViolation: audit actor must match authenticated actor';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.platform_authorize_action('interior:boq:write', p_tenant_id, NULL) AS decision
            WHERE decision.status = 'ALLOW'
        ) THEN
            RAISE EXCEPTION 'AuthorizationViolation: interior BOQ write action is required';
        END IF;
    ELSIF v_auth_role IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'AuthorizationViolation: only an authenticated actor or trusted service role may save BOQs';
    END IF;$after$;
  v_item_loop_before text := $loop_before$    FOR v_item IN SELECT * FROM jsonb_array_elements(p_boq_items)
    LOOP
        INSERT INTO public.interior_boq_items ($loop_before$;
  v_item_loop_after text := $loop_after$    FOR v_item IN SELECT * FROM jsonb_array_elements(p_boq_items)
    LOOP
        IF NULLIF(v_item.value->>'room_zone_id', '') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM public.interior_project_room_zones AS room_zone
             WHERE room_zone.id = (v_item.value->>'room_zone_id')::uuid
               AND room_zone.tenant_id = p_tenant_id
               AND room_zone.project_id = v_project_id
           ) THEN
            RAISE EXCEPTION 'TenantIsolationViolation: BOQ item room zone is not in the request project';
        END IF;

        INSERT INTO public.interior_boq_items ($loop_after$;
  v_position integer;
BEGIN
  SELECT pg_get_functiondef('public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid)'::regprocedure)
  INTO v_definition;

  IF strpos(v_definition, v_declaration_before) = 0 OR strpos(v_definition, v_guard_before) = 0 THEN
    RAISE EXCEPTION 'Bella Interior security preflight BOQ RPC does not match the reviewed Production definition';
  END IF;

  v_position := strpos(v_definition, v_guard_before);
  IF strpos(substr(v_definition, v_position + length(v_guard_before)), v_guard_before) > 0 THEN
    RAISE EXCEPTION 'Bella Interior security preflight BOQ tenant guard is ambiguous';
  END IF;

  v_definition := replace(v_definition, v_declaration_before, v_declaration_after);
  v_definition := replace(v_definition, v_guard_before, v_guard_after);
  v_position := strpos(v_definition, v_item_loop_before);
  IF v_position = 0 OR strpos(substr(v_definition, v_position + length(v_item_loop_before)), v_item_loop_before) > 0 THEN
    RAISE EXCEPTION 'Bella Interior security preflight BOQ item loop does not match the reviewed Production definition';
  END IF;
  v_definition := replace(v_definition, v_item_loop_before, v_item_loop_after);
  EXECUTE v_definition;
END
$boq_rpc$;

ALTER FUNCTION public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid) SET search_path = '';
REVOKE ALL ON FUNCTION public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid) TO authenticated, service_role;

-- A finance outbox event may only represent a real invoiced/paid milestone in
-- the caller's canonical tenant. Payload identity and amount are checked against
-- persisted source rows; the stored payload is rebuilt from those rows.
CREATE OR REPLACE FUNCTION public.enqueue_interior_finance_event(
  p_tenant_id uuid,
  p_event_type text,
  p_reference_type text,
  p_reference_id text,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_actor_tenant_id uuid;
  v_contract_id uuid;
  v_project_id uuid;
  v_payload_project_id uuid;
  v_milestone_order integer;
  v_payload_amount numeric;
  v_milestone_name text;
  v_milestone_amount numeric;
  v_milestone_status text;
  v_customer_name text;
  v_currency text;
  v_id uuid;
  v_existing_payload jsonb;
  v_canonical_payload jsonb;
BEGIN
  v_role := current_setting('request.jwt.claim.role', true);
  IF v_role IS NULL OR v_role NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor or trusted service role required';
  END IF;

  IF p_tenant_id IS NULL
     OR p_event_type IS DISTINCT FROM 'INTERIOR_CONTRACT_MILESTONE_INVOICED'
     OR p_reference_type IS DISTINCT FROM 'PAYMENT_MILESTONE'
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'InvalidInteriorFinanceEvent: unsupported event envelope';
  END IF;

  v_contract_id := NULLIF(p_payload ->> 'contractId', '')::uuid;
  v_payload_project_id := NULLIF(p_payload ->> 'projectId', '')::uuid;
  v_milestone_order := NULLIF(p_payload ->> 'milestoneOrder', '')::integer;
  v_payload_amount := NULLIF(p_payload ->> 'amount', '')::numeric;
  v_currency := upper(NULLIF(trim(p_payload ->> 'currency'), ''));

  IF v_contract_id IS NULL OR v_payload_project_id IS NULL OR v_milestone_order IS NULL
     OR v_milestone_order < 1 OR v_payload_amount IS NULL OR v_payload_amount <= 0
     OR v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$'
     OR p_payload ->> 'tenantId' IS DISTINCT FROM p_tenant_id::text
     OR p_reference_id IS DISTINCT FROM (v_contract_id::text || '_m' || v_milestone_order::text) THEN
    RAISE EXCEPTION 'InvalidInteriorFinanceEvent: invalid tenant, source reference, amount, or currency';
  END IF;

  IF v_role = 'authenticated' THEN
    SELECT actor.tenant_id INTO v_actor_tenant_id
    FROM public.platform_current_actor_profile() AS actor
    WHERE actor.id = auth.uid();

    IF auth.uid() IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'TenantIsolationViolation: canonical actor tenant does not match event tenant';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.platform_authorize_action('interior:finance:write', p_tenant_id, NULL) AS decision
      WHERE decision.status = 'ALLOW'
    ) THEN
      RAISE EXCEPTION 'AuthorizationViolation: interior finance write action is required';
    END IF;
  END IF;

  SELECT contract.project_id, milestone.name, milestone.amount, milestone.status, project.customer_name
    INTO v_project_id, v_milestone_name, v_milestone_amount, v_milestone_status, v_customer_name
  FROM public.interior_contracts AS contract
  JOIN public.interior_payment_milestones AS milestone
    ON milestone.tenant_id = contract.tenant_id
   AND milestone.contract_id = contract.id
  JOIN public.interior_projects AS project
    ON project.tenant_id = contract.tenant_id
   AND project.id = contract.project_id
  WHERE contract.tenant_id = p_tenant_id
    AND contract.id = v_contract_id
    AND contract.project_id = v_payload_project_id
    AND milestone.milestone_order = v_milestone_order;

  IF NOT FOUND OR v_project_id IS DISTINCT FROM v_payload_project_id
     OR v_milestone_amount IS DISTINCT FROM v_payload_amount
     OR v_milestone_status NOT IN ('invoiced', 'paid') THEN
    RAISE EXCEPTION 'InvalidInteriorFinanceEvent: source milestone is missing or not invoiced';
  END IF;

  IF p_payload ->> 'milestoneName' IS DISTINCT FROM v_milestone_name THEN
    RAISE EXCEPTION 'InvalidInteriorFinanceEvent: milestone name does not match persisted source';
  END IF;

  v_canonical_payload := jsonb_build_object(
    'tenantId', p_tenant_id,
    'projectId', v_project_id,
    'contractId', v_contract_id,
    'milestoneOrder', v_milestone_order,
    'milestoneName', v_milestone_name,
    'amount', v_milestone_amount,
    'currency', v_currency,
    'clientName', v_customer_name,
    'occurredAt', timezone('utc'::text, now())
  );

  INSERT INTO public.interior_finance_outbox (
    tenant_id, event_type, reference_type, reference_id, payload
  ) VALUES (
    p_tenant_id, p_event_type, p_reference_type, p_reference_id, v_canonical_payload
  )
  ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT outbox.id, outbox.payload INTO v_id, v_existing_payload
    FROM public.interior_finance_outbox AS outbox
    WHERE outbox.tenant_id = p_tenant_id
      AND outbox.event_type = p_event_type
      AND outbox.reference_type = p_reference_type
      AND outbox.reference_id = p_reference_id;

    IF v_id IS NULL
       OR v_existing_payload ->> 'tenantId' IS DISTINCT FROM v_canonical_payload ->> 'tenantId'
       OR v_existing_payload ->> 'projectId' IS DISTINCT FROM v_canonical_payload ->> 'projectId'
       OR v_existing_payload ->> 'contractId' IS DISTINCT FROM v_canonical_payload ->> 'contractId'
       OR v_existing_payload ->> 'milestoneOrder' IS DISTINCT FROM v_canonical_payload ->> 'milestoneOrder'
       OR v_existing_payload ->> 'milestoneName' IS DISTINCT FROM v_canonical_payload ->> 'milestoneName'
       OR v_existing_payload ->> 'amount' IS DISTINCT FROM v_canonical_payload ->> 'amount' THEN
      RAISE EXCEPTION 'InteriorFinanceEventConflict: existing idempotency key has a different source payload';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_interior_finance_event(uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_interior_finance_event(uuid,text,text,text,jsonb) TO authenticated, service_role;
