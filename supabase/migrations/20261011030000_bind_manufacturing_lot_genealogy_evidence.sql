-- ============================================================================
-- Bella Manufacturing OS - Lot Genealogy Evidence Binding
-- ============================================================================
-- Scope:
--   - Persist verified Logistics material issue evidence on Manufacturing execution.
--   - Enable read-only material-to-finished lot genealogy queries.
--
-- Explicitly not included:
--   - Logistics stock mutation or Logistics kernel/schema changes
--   - Finance posting / WIP / costing / variance
--   - Planning / Scheduling / MRP
--   - UI/API/runtime route registration
--   - ProductRegistry registration
-- ============================================================================

ALTER TABLE public.manufacturing_production_executions
  ADD COLUMN IF NOT EXISTS material_issue_evidence JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.manufacturing_production_executions'::regclass
      AND conname = 'ck_manufacturing_execution_material_issue_evidence_object'
  ) THEN
    ALTER TABLE public.manufacturing_production_executions
      ADD CONSTRAINT ck_manufacturing_execution_material_issue_evidence_object
      CHECK (
        material_issue_evidence IS NULL OR
        jsonb_typeof(material_issue_evidence) = 'object'
      );
  END IF;
END $$;

-- zero-downtime: allow blocking-index - Manufacturing execution scope is MVP-sized and additive.
CREATE INDEX IF NOT EXISTS idx_manufacturing_executions_material_lot
  ON public.manufacturing_production_executions (
    tenant_id,
    factory_org_unit_id,
    ((material_issue_evidence #>> '{itemId}')),
    ((material_issue_evidence #>> '{lotNumber}'))
  )
  WHERE material_issue_evidence IS NOT NULL;

-- zero-downtime: allow blocking-index - supports read-only FGR lot lookup over persisted completion evidence.
CREATE INDEX IF NOT EXISTS idx_manufacturing_completions_receipt_evidence_gin
  ON public.manufacturing_production_order_completions
  USING GIN (receipt_evidence jsonb_path_ops);

COMMENT ON COLUMN public.manufacturing_production_executions.material_issue_evidence IS
  'Manufacturing: verified public Logistics Stock-Out evidence persisted for read-only lot genealogy. No Logistics write.';
