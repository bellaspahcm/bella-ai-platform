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
