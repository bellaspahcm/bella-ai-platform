-- Forward-fix the private BOQ fork implementation to match the canonical
-- interior_boq_items schema. Migration 20261110190000 referenced legacy names
-- (dimensions/specifications) and columns that are not part of this table.
-- Keep the authorization wrapper and its grants unchanged.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected private BOQ fork implementation is missing';
  END IF;

  IF to_regprocedure('public.fork_interior_boq_revision(uuid,uuid,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected authorized BOQ fork wrapper is missing';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY[
      'tenant_id', 'boq_id', 'room_zone_id', 'room_zone_name',
      'item_code', 'item_name', 'category', 'dimensions_json',
      'specifications_json', 'unit', 'quantity', 'internal_unit_cost',
      'internal_total_cost', 'client_unit_price', 'client_total_price',
      'gross_margin_amount', 'gross_margin_percent',
      'source_takeoff_component_id', 'stable_component_id'
    ]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns AS actual
      WHERE actual.table_schema = 'public'
        AND actual.table_name = 'interior_boq_items'
        AND actual.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'Canonical Interior BOQ item columns are missing';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public._fork_interior_boq_revision_unchecked(
  p_tenant_id UUID,
  p_source_boq_id UUID,
  p_actor_id UUID,
  p_release_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_source public.interior_boqs%ROWTYPE;
  v_new_boq_id UUID := gen_random_uuid();
  v_new_version INT;
  v_new_boq_number TEXT;
  v_existing_id UUID;
BEGIN
  SELECT *
    INTO v_source
  FROM public.interior_boqs
  WHERE id = p_source_boq_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOQNotFound: Source BOQ % not found for tenant %',
      p_source_boq_id, p_tenant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_source.status NOT IN ('approved', 'locked_for_contract') THEN
    RAISE EXCEPTION 'BOQForkViolation: Cannot fork BOQ in status "%". Source must be approved or locked_for_contract.',
      v_source.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Preserve the existing retry behavior for a source and release-note pair.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id
      INTO v_existing_id
    FROM public.interior_boqs
    WHERE tenant_id = p_tenant_id
      AND forked_from_boq_id = p_source_boq_id
      AND COALESCE(release_notes, '') = COALESCE(p_release_notes, '')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  v_new_version := v_source.version_number + 1;
  v_new_boq_number := regexp_replace(v_source.boq_number, '-V[0-9]+$', '') || '-V' || v_new_version;

  UPDATE public.interior_boqs
  SET snapshot_sealed_at = NOW()
  WHERE id = p_source_boq_id
    AND tenant_id = p_tenant_id
    AND snapshot_sealed_at IS NULL;

  INSERT INTO public.interior_boqs (
    id,
    tenant_id,
    project_id,
    design_revision_id,
    boq_number,
    version_number,
    status,
    total_internal_cost,
    total_client_price,
    total_gross_margin,
    gross_margin_percent,
    prepared_by,
    forked_from_boq_id,
    release_notes,
    snapshot_sealed_at,
    created_at,
    updated_at
  )
  VALUES (
    v_new_boq_id,
    p_tenant_id,
    v_source.project_id,
    v_source.design_revision_id,
    v_new_boq_number,
    v_new_version,
    'draft',
    v_source.total_internal_cost,
    v_source.total_client_price,
    v_source.total_gross_margin,
    v_source.gross_margin_percent,
    p_actor_id::TEXT,
    p_source_boq_id,
    COALESCE(p_release_notes, ''),
    NULL,
    NOW(),
    NOW()
  );

  -- Deep-copy the canonical persisted item fields and both existing lineage
  -- pointers; do not introduce columns that are absent from the public schema.
  INSERT INTO public.interior_boq_items (
    id,
    tenant_id,
    boq_id,
    room_zone_id,
    room_zone_name,
    item_code,
    item_name,
    category,
    dimensions_json,
    specifications_json,
    unit,
    quantity,
    internal_unit_cost,
    internal_total_cost,
    client_unit_price,
    client_total_price,
    gross_margin_amount,
    gross_margin_percent,
    source_takeoff_component_id,
    stable_component_id,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    p_tenant_id,
    v_new_boq_id,
    source_item.room_zone_id,
    source_item.room_zone_name,
    source_item.item_code,
    source_item.item_name,
    source_item.category,
    source_item.dimensions_json,
    source_item.specifications_json,
    source_item.unit,
    source_item.quantity,
    source_item.internal_unit_cost,
    source_item.internal_total_cost,
    source_item.client_unit_price,
    source_item.client_total_price,
    source_item.gross_margin_amount,
    source_item.gross_margin_percent,
    source_item.source_takeoff_component_id,
    source_item.stable_component_id,
    NOW(),
    NOW()
  FROM public.interior_boq_items AS source_item
  WHERE source_item.boq_id = p_source_boq_id
    AND source_item.tenant_id = p_tenant_id;

  RETURN v_new_boq_id;
END;
$$;

COMMENT ON FUNCTION public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text) IS
  'Internal atomic BOQ revision copy using canonical item columns; callable only by the authenticated authorization wrapper.';

COMMIT;
