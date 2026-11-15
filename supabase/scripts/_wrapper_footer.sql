

-- ══════════════════════════════════════════════════════════════
-- END OF SECTION 1 (M1 verbatim)
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Restore M12 — interior_create_quotation_snapshot
-- Source: 20261115020234_interior_quotation_snapshot_stable_component_uuid_fix.sql
-- SHA-256: DAF3D18CC39516A4235FBC5C233C64D43D18BAAA57BF79A3ACE5FFD1D457F0DC
-- Key fix: COALESCE(source.stable_component_id::TEXT, '')
-- ══════════════════════════════════════════════════════════════
-- Repair quotation lineage comparison where BOQ stable_component_id is UUID and quote JSON is text.
-- CREATE OR REPLACE preserves the function contract and existing object ownership.
CREATE OR REPLACE FUNCTION public.interior_create_quotation_snapshot(
  p_quotation JSONB,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_quote_id UUID;
  v_project_id UUID;
  v_boq_id UUID;
  v_boq_version INTEGER;
  v_version INTEGER;
  v_parent_id UUID;
  v_boq_status TEXT;
  v_source_count INTEGER;
  v_input_count INTEGER;
  v_subtotal NUMERIC(15, 2);
  v_cogs NUMERIC(15, 2);
  v_discount NUMERIC(15, 2);
  v_vat_percent NUMERIC(4, 2);
  v_vat_amount NUMERIC(15, 2);
  v_grand_total NUMERIC(15, 2);
  v_gross_margin NUMERIC(15, 2);
  v_gross_margin_percent NUMERIC(5, 2);
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR jsonb_typeof(p_quotation) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor, quotation, and line snapshots are required';
  END IF;

  v_quote_id := (p_quotation ->> 'id')::UUID;
  v_project_id := (p_quotation ->> 'project_id')::UUID;
  v_boq_id := (p_quotation ->> 'boq_id')::UUID;
  v_boq_version := (p_quotation ->> 'boq_version_number')::INTEGER;
  v_version := (p_quotation ->> 'version_number')::INTEGER;
  v_parent_id := NULLIF(p_quotation ->> 'forked_from_quotation_id', '')::UUID;

  IF (p_quotation ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_project_id, NULL)
     OR NOT public.interior_has_permission('interior:finance:read', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: quotation tenant, create permission, or costing permission is invalid';
  END IF;
  IF p_quotation ->> 'status' IS DISTINCT FROM 'draft'
     OR v_version IS NULL OR v_version < 1
     OR NULLIF(btrim(p_quotation ->> 'quotation_number'), '') IS NULL
     OR length(p_quotation ->> 'quotation_number') > 120
     OR NULLIF(btrim(p_quotation ->> 'payment_terms'), '') IS NULL
     OR NULLIF(btrim(p_quotation ->> 'prepared_by'), '') IS NULL
     OR (p_quotation ->> 'validity_days')::INTEGER NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_DRAFT_TERMS_INVALID';
  END IF;

  PERFORM 1 FROM public.interior_projects p
  WHERE p.tenant_id = v_tenant_id AND p.id = v_project_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_QUOTATION_PROJECT_NOT_FOUND'; END IF;

  SELECT b.status INTO v_boq_status
  FROM public.interior_boqs b
  WHERE b.tenant_id = v_tenant_id AND b.id = v_boq_id
    AND b.project_id = v_project_id AND b.version_number = v_boq_version
  FOR SHARE;
  IF NOT FOUND OR v_boq_status NOT IN ('approved', 'locked_for_contract') THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_REQUIRES_EXACT_APPROVED_BOQ_VERSION';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT || ':' || v_boq_id::TEXT, 0));

  IF v_parent_id IS NULL THEN
    IF v_version <> 1 THEN RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_PARENT_REQUIRED'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.interior_quotations existing
      WHERE existing.tenant_id = v_tenant_id AND existing.boq_id = v_boq_id
        AND existing.forked_from_quotation_id IS NULL
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_ALREADY_EXISTS_FOR_BOQ';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.interior_quotations parent
      WHERE parent.tenant_id = v_tenant_id AND parent.id = v_parent_id
        AND parent.project_id = v_project_id AND parent.boq_id = v_boq_id
        AND parent.boq_version_number = v_boq_version
        AND parent.version_number + 1 = v_version
        AND parent.status IN ('draft', 'sent_to_client', 'negotiating', 'rejected')
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_PARENT_INVALID';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.interior_quotations sibling
      WHERE sibling.tenant_id = v_tenant_id AND sibling.forked_from_quotation_id = v_parent_id
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_ALREADY_EXISTS';
    END IF;
  END IF;

  SELECT count(*) INTO v_source_count
  FROM public.interior_boq_items b
  WHERE b.tenant_id = v_tenant_id AND b.boq_id = v_boq_id;
  SELECT count(*) INTO v_input_count FROM jsonb_array_elements(p_items);
  IF v_source_count = 0 OR v_input_count <> v_source_count THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINEAGE_ITEMS_INCOMPLETE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT value ->> 'boq_item_id' AS boq_item_id, count(*) AS n
      FROM jsonb_array_elements(p_items)
      GROUP BY value ->> 'boq_item_id'
    ) duplicates
    WHERE duplicates.boq_item_id IS NULL OR duplicates.n <> 1
  ) THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINEAGE_ITEMS_DUPLICATED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item(value)
    LEFT JOIN public.interior_boq_items source
      ON source.tenant_id = v_tenant_id
     AND source.boq_id = v_boq_id
     AND source.id = (item.value ->> 'boq_item_id')::UUID
    WHERE source.id IS NULL
       OR (item.value ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
       OR (item.value ->> 'quotation_id')::UUID IS DISTINCT FROM v_quote_id
       OR item.value ->> 'item_code' IS DISTINCT FROM source.item_code
       OR item.value ->> 'item_name' IS DISTINCT FROM source.item_name
       OR item.value ->> 'category' IS DISTINCT FROM source.category
       OR item.value ->> 'unit' IS DISTINCT FROM source.unit
       OR COALESCE(item.value ->> 'stable_component_id', '') IS DISTINCT FROM COALESCE(source.stable_component_id::TEXT, '')
       OR (item.value ->> 'room_zone_name') IS DISTINCT FROM source.room_zone_name
       OR (item.value ->> 'quantity')::NUMERIC IS DISTINCT FROM source.quantity
       OR (item.value ->> 'internal_unit_cost')::NUMERIC IS DISTINCT FROM source.internal_unit_cost
       OR (item.value ->> 'internal_total_cost')::NUMERIC IS DISTINCT FROM round(source.internal_unit_cost * source.quantity)
       OR (item.value ->> 'client_unit_price')::NUMERIC < 0
       OR (item.value ->> 'client_total_price')::NUMERIC IS DISTINCT FROM
          round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
       OR (item.value ->> 'gross_margin_amount')::NUMERIC IS DISTINCT FROM
          round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
            - round(source.internal_unit_cost * source.quantity)
       OR (item.value ->> 'gross_margin_percent')::NUMERIC IS DISTINCT FROM
          CASE WHEN round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity) > 0
            THEN round(((
              round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
              - round(source.internal_unit_cost * source.quantity)
            ) / round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)) * 1000) / 10
            ELSE 0 END
       OR (item.value ->> 'markup_percent')::NUMERIC IS DISTINCT FROM
          CASE WHEN source.internal_unit_cost > 0
            THEN round(((
              (item.value ->> 'client_unit_price')::NUMERIC - source.internal_unit_cost
            ) / source.internal_unit_cost) * 1000) / 10
            ELSE 0 END
       OR item.value ->> 'specifications' IS DISTINCT FROM COALESCE(
         NULLIF(concat_ws('; ',
           NULLIF(btrim(source.specifications_json ->> 'carcassMaterial'), ''),
           NULLIF(btrim(source.specifications_json ->> 'doorFrontMaterial'), ''),
           NULLIF(btrim(source.specifications_json ->> 'surfaceFinish'), ''),
           NULLIF(btrim(source.specifications_json ->> 'hardwareSpec'), ''),
           NULLIF(btrim(source.specifications_json ->> 'stoneOrGlassSpec'), '')
         ), ''),
         'Theo tiêu chuẩn hoàn thiện Bella'
       )
  ) THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINE_ITEM_MUST_MATCH_BOQ_SOURCE';
  END IF;

  SELECT COALESCE(sum((item.value ->> 'client_total_price')::NUMERIC), 0),
         COALESCE(sum((item.value ->> 'internal_total_cost')::NUMERIC), 0)
    INTO v_subtotal, v_cogs
  FROM jsonb_array_elements(p_items) item(value);
  v_discount := (p_quotation ->> 'discount_amount')::NUMERIC;
  v_vat_percent := (p_quotation ->> 'vat_percent')::NUMERIC;
  IF v_discount IS NULL OR v_discount < 0 OR v_discount > v_subtotal
     OR v_vat_percent IS NULL OR v_vat_percent < 0 OR v_vat_percent > 100 THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_FINANCIAL_TERMS_INVALID';
  END IF;
  v_vat_amount := round(((v_subtotal - v_discount) * v_vat_percent) / 100);
  v_grand_total := v_subtotal - v_discount + v_vat_amount;
  v_gross_margin := v_subtotal - v_discount - v_cogs;
  v_gross_margin_percent := CASE WHEN v_subtotal - v_discount > 0
    THEN round((v_gross_margin / (v_subtotal - v_discount)) * 1000) / 10
    ELSE 0 END;
  IF (p_quotation ->> 'subtotal')::NUMERIC IS DISTINCT FROM v_subtotal
     OR (p_quotation ->> 'total_internal_cogs')::NUMERIC IS DISTINCT FROM v_cogs
     OR (p_quotation ->> 'vat_amount')::NUMERIC IS DISTINCT FROM v_vat_amount
     OR (p_quotation ->> 'grand_total')::NUMERIC IS DISTINCT FROM v_grand_total
     OR (p_quotation ->> 'total_gross_margin')::NUMERIC IS DISTINCT FROM v_gross_margin
     OR (p_quotation ->> 'gross_margin_percent')::NUMERIC IS DISTINCT FROM v_gross_margin_percent THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_TOTALS_DO_NOT_RECONCILE';
  END IF;

  INSERT INTO public.interior_quotations (
    id, tenant_id, project_id, boq_id, quotation_number, version_number, status,
    subtotal, discount_amount, vat_percent, vat_amount, grand_total, payment_terms,
    validity_days, boq_version_number, total_internal_cogs, total_gross_margin,
    gross_margin_percent, forked_from_quotation_id, prepared_by, created_at
  ) VALUES (
    v_quote_id, v_tenant_id, v_project_id, v_boq_id,
    p_quotation ->> 'quotation_number', v_version, 'draft',
    v_subtotal, v_discount, v_vat_percent, v_vat_amount, v_grand_total,
    p_quotation ->> 'payment_terms', (p_quotation ->> 'validity_days')::INTEGER,
    v_boq_version, v_cogs, v_gross_margin, v_gross_margin_percent,
    v_parent_id, p_quotation ->> 'prepared_by',
    COALESCE(NULLIF(p_quotation ->> 'created_at', '')::TIMESTAMPTZ, clock_timestamp())
  );

  INSERT INTO public.interior_quotation_items (
    id, tenant_id, quotation_id, boq_item_id, stable_component_id, room_zone_name,
    item_code, item_name, category, specifications, unit, quantity,
    internal_unit_cost, internal_total_cost, markup_percent, client_unit_price,
    client_total_price, gross_margin_amount, gross_margin_percent, cost_breakdown_json
  )
  SELECT (item.value ->> 'id')::UUID, v_tenant_id, v_quote_id,
         (item.value ->> 'boq_item_id')::UUID,
         NULLIF(item.value ->> 'stable_component_id', ''),
         item.value ->> 'room_zone_name', item.value ->> 'item_code',
         item.value ->> 'item_name', item.value ->> 'category', item.value ->> 'specifications',
         item.value ->> 'unit', (item.value ->> 'quantity')::NUMERIC,
         (item.value ->> 'internal_unit_cost')::NUMERIC,
         (item.value ->> 'internal_total_cost')::NUMERIC,
         (item.value ->> 'markup_percent')::NUMERIC,
         (item.value ->> 'client_unit_price')::NUMERIC,
         (item.value ->> 'client_total_price')::NUMERIC,
         (item.value ->> 'gross_margin_amount')::NUMERIC,
         (item.value ->> 'gross_margin_percent')::NUMERIC,
         item.value -> 'cost_breakdown_json'
  FROM jsonb_array_elements(p_items) item(value);

  IF v_parent_id IS NOT NULL THEN
    UPDATE public.interior_customer_approvals
    SET status = 'superseded',
        customer_notes = 'Superseded by a newer quotation revision',
        updated_at = clock_timestamp()
    WHERE tenant_id = v_tenant_id
      AND subject_type = 'quotation'
      AND subject_id = v_parent_id
      AND status = 'pending';
  END IF;

  RETURN v_quote_id;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_quotation_snapshot(JSONB, JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_quotation_snapshot(JSONB, JSONB)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: Restore M13 — interior_create_customer_approval_request
-- Source: 20261115021131_interior_approval_subject_enum_casts.sql
-- SHA-256: 34B4912BB46B32CD201CA5E73ED4890354B31176BE853FA56B6707725ED1CD54
-- Key fix: v_subject_type::public.interior_approval_subject_type enum cast
-- ══════════════════════════════════════════════════════════════
-- Keep approval subject validation as text, cast only at enum database boundaries.
CREATE OR REPLACE FUNCTION public.interior_create_customer_approval_request(p_approval JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_subject_type TEXT;
  v_subject_id UUID;
  v_project_id UUID;
  v_subject_version INTEGER;
  v_sent_at TIMESTAMPTZ;
  v_actor_name TEXT;
BEGIN
  IF v_tenant_id IS NULL OR v_actor_id IS NULL OR jsonb_typeof(p_approval) IS DISTINCT FROM 'object'
     OR (p_approval ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR (p_approval ->> 'sent_by_actor_id') IS DISTINCT FROM v_actor_id::TEXT THEN
    RAISE EXCEPTION 'AuthorizationViolation: approval actor and tenant must match the authenticated session';
  END IF;
  v_subject_type := p_approval ->> 'subject_type';
  v_subject_id := (p_approval ->> 'subject_id')::UUID;
  v_project_id := (p_approval ->> 'project_id')::UUID;
  v_subject_version := (p_approval ->> 'subject_version_number')::INTEGER;
  v_sent_at := (p_approval ->> 'sent_at')::TIMESTAMPTZ;
  IF p_approval ->> 'status' IS DISTINCT FROM 'pending'
     OR v_subject_type NOT IN ('quotation', 'contract')
     OR v_subject_version < 1
     OR NULLIF(btrim(p_approval ->> 'client_representative'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'client_contact'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'sent_by_actor_name'), '') IS NULL
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ <= clock_timestamp()
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ > clock_timestamp() + INTERVAL '365 days' THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_REQUEST_INVALID';
  END IF;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id AND actor.tenant_id = v_tenant_id;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL
     OR length(btrim(v_actor_name)) > 200 THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract write permission is required';
  END IF;

  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = 'Superseded by a newer approval request', updated_at = clock_timestamp()
  WHERE a.tenant_id = v_tenant_id AND a.subject_type = v_subject_type::public.interior_approval_subject_type
    AND a.subject_id = v_subject_id AND a.status = 'pending';

  IF v_subject_type = 'quotation' THEN
    UPDATE public.interior_quotations q
    SET status = CASE WHEN q.status = 'draft' THEN 'sent_to_client' ELSE q.status END,
        sent_to_client_at = COALESCE(q.sent_to_client_at, v_sent_at),
        latest_approval_status = 'pending', latest_approval_sent_at = v_sent_at,
        latest_approved_at = NULL, latest_rejected_at = NULL
    WHERE q.tenant_id = v_tenant_id AND q.project_id = v_project_id
      AND q.id = v_subject_id AND q.version_number = v_subject_version
      AND q.status IN ('draft', 'sent_to_client', 'negotiating');
  ELSE
    UPDATE public.interior_contracts c
    SET status = CASE WHEN c.status = 'draft' THEN 'in_review' ELSE c.status END,
        updated_at = v_sent_at
    WHERE c.tenant_id = v_tenant_id AND c.project_id = v_project_id
      AND c.id = v_subject_id AND c.status IN ('draft', 'in_review');
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_APPROVAL_SUBJECT_STALE'; END IF;

  INSERT INTO public.interior_customer_approvals (
    id, tenant_id, project_id, subject_type, subject_id, subject_version_number,
    approval_token, status, client_representative, client_contact, sent_at, expires_at,
    sent_by_actor_id, sent_by_actor_name, created_at, updated_at
  ) VALUES (
    (p_approval ->> 'id')::UUID, v_tenant_id, v_project_id, v_subject_type::public.interior_approval_subject_type,
    v_subject_id, v_subject_version, (p_approval ->> 'approval_token')::UUID,
    'pending', btrim(p_approval ->> 'client_representative'), btrim(p_approval ->> 'client_contact'),
    v_sent_at, (p_approval ->> 'expires_at')::TIMESTAMPTZ,
    v_actor_id::TEXT, btrim(v_actor_name),
    (p_approval ->> 'created_at')::TIMESTAMPTZ, (p_approval ->> 'updated_at')::TIMESTAMPTZ
  ) RETURNING * INTO v_approval;
  RETURN to_jsonb(v_approval);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: In-transaction assertions (12 checks)
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_count INTEGER;
  v_text  TEXT;
BEGIN
  -- 4.1: 4 new columns on interior_contracts
  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema='public' AND table_name='interior_contracts'
    AND column_name IN ('design_revision_id','design_version_number','quotation_customer_approval_id','customer_approval_id');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'ASSERT 4.1 FAIL: Expected 4 new columns on interior_contracts, found %', v_count;
  END IF;

  -- 4.2: signed_date nullable
  SELECT is_nullable INTO v_text FROM information_schema.columns
  WHERE table_schema='public' AND table_name='interior_contracts' AND column_name='signed_date';
  IF v_text IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'ASSERT 4.2 FAIL: interior_contracts.signed_date should be nullable, is_nullable=%', v_text;
  END IF;

  -- 4.3: Old ALL policy gone
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interior_payment_transactions'
    AND policyname='tenant_isolation_interior_payment_transactions') THEN
    RAISE EXCEPTION 'ASSERT 4.3 FAIL: Old ALL policy still exists on interior_payment_transactions';
  END IF;

  -- 4.4: Exactly 2 new RLS policies
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND tablename='interior_payment_transactions'
    AND policyname IN ('interior_payment_transactions_finance_read','interior_payment_transactions_record');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT 4.4 FAIL: Expected 2 new RLS policies, found %', v_count;
  END IF;

  -- 4.5: M12 UUID::TEXT COALESCE pattern present (not regressed)
  SELECT p.prosrc INTO v_text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public' AND p.proname='interior_create_quotation_snapshot';
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'ASSERT 4.5 FAIL: interior_create_quotation_snapshot not found after restore';
  END IF;
  IF position('COALESCE(source.stable_component_id::TEXT' IN v_text) = 0 THEN
    RAISE EXCEPTION 'ASSERT 4.5 FAIL: M12 COALESCE(stable_component_id::TEXT) pattern missing — M1 regression';
  END IF;

  -- 4.6: M13 enum cast present
  SELECT p.prosrc INTO v_text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public' AND p.proname='interior_create_customer_approval_request';
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'ASSERT 4.6 FAIL: interior_create_customer_approval_request not found after restore';
  END IF;
  IF position('::public.interior_approval_subject_type' IN v_text) = 0 THEN
    RAISE EXCEPTION 'ASSERT 4.6 FAIL: M13 enum cast missing — M1 regression';
  END IF;

  -- 4.7: Both functions SECURITY DEFINER
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public'
    AND p.proname IN ('interior_create_quotation_snapshot','interior_create_customer_approval_request')
    AND p.prosecdef = TRUE;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ASSERT 4.7 FAIL: Expected 2 SECURITY DEFINER functions, found %', v_count;
  END IF;

  -- 4.8: 7 triggers
  SELECT count(*) INTO v_count
  FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND t.tgname IN (
    'trg_guard_interior_customer_approval_insert',
    'trg_guard_interior_quotation_customer_evidence',
    'trg_guard_interior_contract_customer_evidence',
    'trg_guard_interior_quotation_items_after_dispatch',
    'trg_advance_interior_commercial_after_customer_approval',
    'trg_guard_interior_payment_transaction_insert',
    'trg_reconcile_interior_payment_milestone_after_receipt');
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'ASSERT 4.8 FAIL: Expected 7 M1 triggers, found %', v_count;
  END IF;

  -- 4.9: Normalized index
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND tablename='interior_payment_transactions'
    AND indexname='uq_interior_payment_tx_reference_normalized') THEN
    RAISE EXCEPTION 'ASSERT 4.9 FAIL: uq_interior_payment_tx_reference_normalized not found';
  END IF;

  -- 4.10: 5 core M1 functions
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE n.nspname='public' AND p.proname IN (
    'guard_interior_commercial_customer_evidence',
    'guard_interior_customer_approval_insert',
    'reconcile_interior_payment_milestone_after_receipt',
    'interior_create_contract_with_milestones',
    'interior_read_boq_for_commercial');
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'ASSERT 4.10 FAIL: Expected 5 core M1 functions, found %', v_count;
  END IF;

  -- 4.11: Existing data not lost
  SELECT count(*) INTO v_count FROM public.interior_contracts;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'ASSERT 4.11 FAIL: interior_contracts empty — data loss detected';
  END IF;

  -- 4.12: Ledger not yet written (pre-commit guard against duplicate)
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261113165251') THEN
    RAISE EXCEPTION 'ASSERT 4.12 FAIL: M1 already in ledger before INSERT — duplicate apply';
  END IF;

  RAISE NOTICE 'SECTION 4 PASS: 12/12 assertions OK at %', clock_timestamp();
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 5: Record in migration ledger
-- Table: supabase_migrations.schema_migrations
-- Schema: (version TEXT NOT NULL, statements TEXT[], name TEXT,
--          created_by TEXT, idempotency_key TEXT, rollback TEXT[])
-- ══════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
VALUES (
  '20261113165251',
  NULL,
  'interior_commercial_transaction_engine',
  'production-apply-window-b',
  NULL,
  NULL
);

-- 5.1: Verify insert persisted within transaction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20261113165251' AND created_by='production-apply-window-b') THEN
    RAISE EXCEPTION 'ASSERT 5.1 FAIL: Ledger INSERT did not persist within transaction';
  END IF;
  RAISE NOTICE 'SECTION 5 PASS: ledger entry verified at %', clock_timestamp();
END $$;


-- ══════════════════════════════════════════════════════════════
-- COMMIT — only reached if ALL sections succeeded
-- ══════════════════════════════════════════════════════════════
COMMIT;


-- ══════════════════════════════════════════════════════════════
-- POST-COMMIT: Independent spot-check (outside transaction)
-- ══════════════════════════════════════════════════════════════
SELECT 'POST-COMMIT CHECK' AS phase,
  (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261113165251') AS m1_in_ledger,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='interior_contracts'
   AND column_name IN ('design_revision_id','design_version_number',
                       'quotation_customer_approval_id','customer_approval_id')) AS new_columns,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='interior_payment_transactions') AS rls_policy_count,
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid
   JOIN pg_namespace n ON c.relnamespace=n.oid
   WHERE n.nspname='public' AND t.tgname LIKE 'trg_%interior%') AS trigger_count;
-- Expected: m1_in_ledger=1, new_columns=4, rls_policy_count=2, trigger_count>=7
