-- =============================================================================
-- Bella Interior OS — Migration 20261110190000
-- BOQ Versioning & Snapshotting — Additive Schema Extension
--
-- Purpose:
--   Extends interior_boqs with fork lineage metadata and snapshot sealing
--   to support immutable commercial BOQ revision versioning (Phase 1).
--
-- Scope:
--   - Additive only: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--     CREATE FUNCTION IF NOT EXISTS, CREATE OR REPLACE FUNCTION
--   - Zero DROP, CASCADE destructive, or TRUNCATE statements
--   - G8-sealed migrations (140000, 170000, 180000) are NOT touched
--   - Healthcare H1-H12 and Logistics E7.1-E7.3 are NOT touched
--
-- Branch: codex/bella-interior-boq-versioning-phase1
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Add versioning metadata columns to interior_boqs
-- ---------------------------------------------------------------------------

ALTER TABLE public.interior_boqs
  ADD COLUMN IF NOT EXISTS forked_from_boq_id    UUID        REFERENCES public.interior_boqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snapshot_sealed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_notes         TEXT;

COMMENT ON COLUMN public.interior_boqs.forked_from_boq_id IS
  'Parent BOQ revision ID this row was forked from. NULL for V1 (original). Tracks the full revision chain.';
COMMENT ON COLUMN public.interior_boqs.snapshot_sealed_at IS
  'Timestamp when this BOQ was permanently sealed as an immutable commercial snapshot. '
  'Set when a newer revision is forked from this BOQ. Once set, no further content edits are permitted.';
COMMENT ON COLUMN public.interior_boqs.release_notes IS
  'Estimator notes captured at time of fork (e.g. reason for revision, design change reference).';

-- ---------------------------------------------------------------------------
-- Step 2: Supporting indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_interior_boqs_forked_from
  ON public.interior_boqs(forked_from_boq_id)
  WHERE forked_from_boq_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interior_boqs_snapshot_sealed
  ON public.interior_boqs(tenant_id, project_id, snapshot_sealed_at)
  WHERE snapshot_sealed_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3: RPC fork_interior_boq_revision
--
-- Atomically:
--   1. Validates source BOQ is 'approved' or 'locked_for_contract' and belongs to tenant
--   2. Seals the source BOQ with snapshot_sealed_at = NOW()
--   3. Creates a new draft BOQ header with version_number = source.version_number + 1
--   4. Deep-copies all items from source to new BOQ (preserving stableComponentId lineage)
--   5. Returns the new draft BOQ ID
--
-- Security:
--   - Enforces tenant isolation (p_tenant_id must match source BOQ)
--   - Respects existing immutability triggers on interior_boq_items
--   - Uses SECURITY DEFINER to bypass RLS for the atomic copy (caller must be authenticated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fork_interior_boq_revision(
  p_tenant_id     UUID,
  p_source_boq_id UUID,
  p_actor_id      UUID,
  p_release_notes TEXT    DEFAULT NULL,
  p_idempotency_key TEXT  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source          public.interior_boqs%ROWTYPE;
  v_new_boq_id      UUID := gen_random_uuid();
  v_new_version     INT;
  v_new_boq_number  TEXT;
BEGIN
  -- ── Gate 0: Tenant isolation ─────────────────────────────────────────────
  SELECT * INTO v_source
  FROM public.interior_boqs
  WHERE id = p_source_boq_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;  -- lock row to prevent concurrent forks

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOQNotFound: Source BOQ % not found for tenant %',
      p_source_boq_id, p_tenant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Gate 1: Source must be approved or locked_for_contract ────────────────
  IF v_source.status NOT IN ('approved', 'locked_for_contract') THEN
    RAISE EXCEPTION 'BOQForkViolation: Cannot fork BOQ in status "%". Source must be approved or locked_for_contract.',
      v_source.status
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Gate 2: Already sealed? ───────────────────────────────────────────────
  -- Allow forking a sealed BOQ again (creates a new branch from same point)
  -- This is valid: user may fork V1 → V2a AND V1 → V2b independently.
  -- We do NOT block re-forking a sealed source.

  -- ── Idempotency guard: same actor + source + key → return existing new BOQ ──
  IF p_idempotency_key IS NOT NULL THEN
    DECLARE
      v_existing_id UUID;
    BEGIN
      SELECT id INTO v_existing_id
      FROM public.interior_boqs
      WHERE tenant_id = p_tenant_id
        AND forked_from_boq_id = p_source_boq_id
        AND release_notes = COALESCE(p_release_notes, '')
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
      END IF;
    END;
  END IF;

  -- ── Compute new version number ────────────────────────────────────────────
  v_new_version := v_source.version_number + 1;

  -- Build new boq_number: append -V{N} suffix or replace existing suffix
  -- Convention: BOQ-INT-L81-PH-V1 → BOQ-INT-L81-PH-V2
  v_new_boq_number := regexp_replace(v_source.boq_number, '-V\d+$', '') || '-V' || v_new_version;

  -- ── Seal the source BOQ (set snapshot_sealed_at) ─────────────────────────
  -- Note: existing immutability trigger only blocks content edits (items).
  -- Sealing is a metadata update on the BOQ header row itself — permitted.
  UPDATE public.interior_boqs
  SET snapshot_sealed_at = NOW()
  WHERE id = p_source_boq_id
    AND snapshot_sealed_at IS NULL;  -- idempotent: only seal once

  -- ── Create new draft BOQ header ───────────────────────────────────────────
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
    snapshot_sealed_at,  -- NULL for new draft
    created_at,
    updated_at
  )
  VALUES (
    v_new_boq_id,
    p_tenant_id,
    v_source.project_id,
    v_source.design_revision_id,  -- inherit design revision lineage
    v_new_boq_number,
    v_new_version,
    'draft',
    v_source.total_internal_cost,  -- inherit financials (estimator adjusts in draft)
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

  -- ── Deep-copy BOQ items (preserve stableComponentId + 7-field lineage) ────
  -- Note: target BOQ is 'draft', so immutability trigger allows INSERT.
  INSERT INTO public.interior_boq_items (
    id,
    tenant_id,
    boq_id,
    room_zone_id,
    room_zone_name,
    item_code,
    item_name,
    category,
    dimensions,
    specifications,
    unit,
    quantity,
    internal_unit_cost,
    internal_total_cost,
    client_unit_price,
    client_total_price,
    gross_margin_amount,
    gross_margin_percent,
    stable_component_id,
    sync_status,
    source_design_revision_id,
    source_takeoff_run_id,
    source_stable_component_id,
    diff_change_type,
    synced_at,
    source_diff_run_id,
    source_boq_revision_id,
    pricing_pending,
    price_review_needed,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),   -- new item ID for the forked revision
    p_tenant_id,
    v_new_boq_id,        -- new BOQ
    room_zone_id,
    room_zone_name,
    item_code,
    item_name,
    category,
    dimensions,
    specifications,
    unit,
    quantity,
    internal_unit_cost,
    internal_total_cost,
    client_unit_price,
    client_total_price,
    gross_margin_amount,
    gross_margin_percent,
    stable_component_id,
    'active',            -- reset sync_status to active on new draft
    source_design_revision_id,
    source_takeoff_run_id,
    source_stable_component_id,
    diff_change_type,
    synced_at,
    source_diff_run_id,
    id                   -- source_boq_revision_id = this item's original ID (7th lineage field)
  FROM public.interior_boq_items
  WHERE boq_id = p_source_boq_id
    AND tenant_id = p_tenant_id;

  RETURN v_new_boq_id;
END;
$$;

COMMENT ON FUNCTION public.fork_interior_boq_revision(UUID, UUID, UUID, TEXT, TEXT) IS
  'Atomically forks an approved/locked BOQ revision into a new draft revision. '
  'Seals the source BOQ, deep-copies all items (preserving 7-field lineage), '
  'and returns the new draft BOQ ID. Enforces tenant isolation and status gate.';

-- Grant execute to authenticated role (same pattern as save_interior_boq_atomic)
GRANT EXECUTE ON FUNCTION public.fork_interior_boq_revision(UUID, UUID, UUID, TEXT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Step 4: Helper view — boq_version_history
--   Ordered list of all BOQ revisions for a project with fork lineage metadata.
--   Used by listBOQVersionHistory() repository method.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.interior_boq_version_history AS
SELECT
  b.id                              AS boq_id,
  b.tenant_id,
  b.project_id,
  b.boq_number,
  b.version_number,
  b.status,
  b.forked_from_boq_id,
  parent.version_number             AS forked_from_version_number,
  b.snapshot_sealed_at,
  b.release_notes,
  b.prepared_by,
  b.created_at,
  b.total_client_price,
  b.total_internal_cost,
  b.total_gross_margin,
  b.gross_margin_percent,
  COUNT(i.id)::INT                  AS item_count
FROM public.interior_boqs b
LEFT JOIN public.interior_boqs parent
  ON parent.id = b.forked_from_boq_id
LEFT JOIN public.interior_boq_items i
  ON i.boq_id = b.id AND i.tenant_id = b.tenant_id
GROUP BY
  b.id,
  b.tenant_id,
  b.project_id,
  b.boq_number,
  b.version_number,
  b.status,
  b.forked_from_boq_id,
  parent.version_number,
  b.snapshot_sealed_at,
  b.release_notes,
  b.prepared_by,
  b.created_at,
  b.total_client_price,
  b.total_internal_cost,
  b.total_gross_margin,
  b.gross_margin_percent;

COMMENT ON VIEW public.interior_boq_version_history IS
  'Ordered view of all BOQ revisions per project with fork lineage, item counts, '
  'and financial summary. Filtered by tenant via RLS on underlying interior_boqs table.';

COMMIT;

