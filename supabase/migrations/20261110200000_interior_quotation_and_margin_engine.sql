-- =============================================================================
-- Bella Interior OS — Migration 20261110200000
-- Quotation & Commercial Margin Engine — Additive Schema Extension (Phase 2)
--
-- Purpose:
--   Extends interior_quotations with commercial margin summary and revision fields.
--   Creates interior_quotation_items to capture decoupled line-item commercial snapshots
--   with tiered markups and granular cost breakdowns.
--   Enforces strict tenant integrity, snapshot immutability, and client data security.
--
-- Scope:
--   - Additive only: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--     CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION/TRIGGER/VIEW
--   - Zero destructive DDL (no DROP TABLE, DROP COLUMN, TRUNCATE, or CASCADE)
--   - G8-sealed migrations (140000, 170000, 180000) and Phase 1 (190000) UNTOUCHED
--   - Healthcare H1-H12 and Logistics E7.1-E7.3 FROZEN / SEALED UNTOUCHED
--
-- Branch: codex/bella-interior-quotation-margin-engine-phase2
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Add commercial margin & revision tracking columns to interior_quotations
-- ---------------------------------------------------------------------------

ALTER TABLE public.interior_quotations
  ADD COLUMN IF NOT EXISTS boq_version_number       INTEGER         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_internal_cogs      NUMERIC(15, 2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gross_margin       NUMERIC(15, 2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_margin_percent     NUMERIC(5, 2)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forked_from_quotation_id UUID            REFERENCES public.interior_quotations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prepared_by              TEXT,
  ADD COLUMN IF NOT EXISTS approved_by              TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_client_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason         TEXT,
  ADD COLUMN IF NOT EXISTS revision_notes           TEXT;

COMMENT ON COLUMN public.interior_quotations.boq_version_number IS
  'Exact BOQ revision version number at the time this quotation was generated.';
COMMENT ON COLUMN public.interior_quotations.total_internal_cogs IS
  'Total internal Cost of Goods Sold (Internal Unit Cost * Quantity across all items). Estimator only.';
COMMENT ON COLUMN public.interior_quotations.total_gross_margin IS
  'Net Revenue (Subtotal - Discount) - Total Internal COGS. Estimator only.';
COMMENT ON COLUMN public.interior_quotations.gross_margin_percent IS
  'Weighted Blended Gross Margin % on Net Revenue across entire quotation. Estimator only.';
COMMENT ON COLUMN public.interior_quotations.forked_from_quotation_id IS
  'Parent Quotation ID if this is a revised quotation (e.g. V1 -> V2).';

-- Ensure composite uniqueness for cross-tenant composite FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_interior_quotations_tenant_id'
  ) THEN
    ALTER TABLE public.interior_quotations
      ADD CONSTRAINT uq_interior_quotations_tenant_id UNIQUE (tenant_id, id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: Create interior_quotation_items table with composite tenant FK
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_quotation_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_id          UUID NOT NULL,
  boq_item_id           UUID,
  stable_component_id   TEXT,
  room_zone_name        TEXT NOT NULL,
  item_code             TEXT NOT NULL,
  item_name             TEXT NOT NULL,
  category              TEXT NOT NULL,
  specifications        TEXT,
  unit                  TEXT NOT NULL DEFAULT 'bộ',
  quantity              NUMERIC(10, 2) NOT NULL DEFAULT 1,
  
  -- Internal Costing (Estimator/PM only)
  internal_unit_cost    NUMERIC(15, 2) NOT NULL DEFAULT 0,
  internal_total_cost   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  markup_percent        NUMERIC(6, 2)  NOT NULL DEFAULT 0,
  gross_margin_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gross_margin_percent  NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  cost_breakdown_json   JSONB,

  -- Client Selling Price (Client Facing)
  client_unit_price     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  client_total_price    NUMERIC(15, 2) NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Enforces strict tenant containment: item cannot belong to a different tenant than parent quotation
  CONSTRAINT fk_interior_quotation_items_parent FOREIGN KEY (tenant_id, quotation_id)
    REFERENCES public.interior_quotations(tenant_id, id) ON DELETE CASCADE,

  CONSTRAINT chk_interior_quotation_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_interior_quotation_items_prices_non_negative CHECK (
    internal_unit_cost >= 0 AND client_unit_price >= 0
  )
);

COMMENT ON TABLE public.interior_quotation_items IS
  'Decoupled commercial quotation items. Stores client-facing presentation alongside internal COGS/margin.';
COMMENT ON COLUMN public.interior_quotation_items.cost_breakdown_json IS
  'Detailed cost breakdown JSON: { materialCost, laborCost, hardwareCost, finishingCost }.';

-- ---------------------------------------------------------------------------
-- Step 3: Indexes
-- ---------------------------------------------------------------------------

-- zero-downtime: allow blocking-index - newly created child table in fresh interior vertical
CREATE INDEX IF NOT EXISTS idx_interior_quotation_items_tenant_quotation
  ON public.interior_quotation_items(tenant_id, quotation_id);

-- zero-downtime: allow blocking-index - partial index on new child table
CREATE INDEX IF NOT EXISTS idx_interior_quotation_items_stable_component
  ON public.interior_quotation_items(tenant_id, stable_component_id)
  WHERE stable_component_id IS NOT NULL;

-- zero-downtime: allow blocking-index - newly added column indexing on interior vertical table
CREATE INDEX IF NOT EXISTS idx_interior_quotations_forked_from
  ON public.interior_quotations(forked_from_quotation_id)
  WHERE forked_from_quotation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4: Row Level Security (RLS) on interior_quotation_items
-- ---------------------------------------------------------------------------

ALTER TABLE public.interior_quotation_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'interior_quotation_items' AND policyname = 'interior_quotation_items_tenant_isolation'
  ) THEN
    CREATE POLICY interior_quotation_items_tenant_isolation
      ON public.interior_quotation_items
      FOR ALL
      USING (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
      )
      WITH CHECK (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 5: Immutability triggers for Quotation snapshots
-- ---------------------------------------------------------------------------

-- 5A: Protect quotation items from modification once sent or accepted
CREATE OR REPLACE FUNCTION public.guard_interior_quotation_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quotation_status TEXT;
BEGIN
  SELECT status INTO v_quotation_status
  FROM public.interior_quotations
  WHERE id = COALESCE(OLD.quotation_id, NEW.quotation_id);

  IF v_quotation_status IN ('sent_to_client', 'accepted') THEN
    RAISE EXCEPTION 'QuotationSnapshotImmutableError: Quotation is in status "%". Items cannot be modified or deleted. Create a new quotation revision.',
      v_quotation_status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_interior_quotation_items_immutability
  ON public.interior_quotation_items;

CREATE TRIGGER trg_guard_interior_quotation_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.interior_quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_interior_quotation_items_immutability();

-- 5B: Protect quotation header financial terms from modification once sent or accepted
CREATE OR REPLACE FUNCTION public.guard_interior_quotations_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Block deletion of sent or accepted quotation
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('sent_to_client', 'accepted') THEN
      RAISE EXCEPTION 'QuotationImmutableError: Cannot delete quotation "%" in status "%".',
        OLD.quotation_number, OLD.status
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  -- Block financial modifications on sent or accepted quotation
  IF OLD.status IN ('sent_to_client', 'accepted') THEN
    -- Allow status transitions: sent_to_client -> accepted / rejected
    -- Allow timestamp stamping: accepted_at, rejected_at, approved_by, sent_to_client_at
    -- Disallow mutating commercial financial terms
    IF (OLD.subtotal <> NEW.subtotal) OR
       (OLD.discount_amount <> NEW.discount_amount) OR
       (OLD.vat_percent <> NEW.vat_percent) OR
       (OLD.grand_total <> NEW.grand_total) OR
       (OLD.total_internal_cogs <> NEW.total_internal_cogs) OR
       (OLD.boq_id <> NEW.boq_id) OR
       (OLD.boq_version_number <> NEW.boq_version_number) THEN
      RAISE EXCEPTION 'QuotationImmutableError: Cannot modify financial terms of quotation "%" in status "%". Create a new revision.',
        OLD.quotation_number, OLD.status
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_interior_quotations_immutability
  ON public.interior_quotations;

CREATE TRIGGER trg_guard_interior_quotations_immutability
  BEFORE UPDATE OR DELETE
  ON public.interior_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_interior_quotations_immutability();

-- ---------------------------------------------------------------------------
-- Step 6: Sanitized Client-Facing Database Views (Zero Financial Leakage)
-- Clients query these views — internal COGS, margins, and markups are NOT exposed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.interior_client_quotations_view AS
SELECT
  q.id,
  q.tenant_id,
  q.project_id,
  q.quotation_number,
  q.version_number,
  q.status,
  q.subtotal,
  q.discount_amount,
  q.vat_percent,
  q.vat_amount,
  q.grand_total,
  q.payment_terms,
  q.validity_days,
  q.sent_to_client_at,
  q.accepted_at,
  q.created_at
FROM public.interior_quotations q;

COMMENT ON VIEW public.interior_client_quotations_view IS
  'Sanitized client-facing quotation header view. Excludes internal COGS, gross margin, and markups.';

CREATE OR REPLACE VIEW public.interior_client_quotation_items_view AS
SELECT
  i.id,
  i.tenant_id,
  i.quotation_id,
  i.room_zone_name,
  i.item_code,
  i.item_name,
  i.category,
  i.specifications,
  i.unit,
  i.quantity,
  i.client_unit_price,
  i.client_total_price,
  i.created_at
FROM public.interior_quotation_items i;

COMMENT ON VIEW public.interior_client_quotation_items_view IS
  'Sanitized client-facing quotation items view. Excludes internal_unit_cost, internal_total_cost, markup_percent, gross_margin_amount, and cost_breakdown_json.';

COMMIT;
