-- ============================================================================
-- Bella Manufacturing OS - Production Plan MVP
-- ============================================================================
-- Scope:
--   - ProductionPlan
--   - ProductionPlanScheduleSlot
--   - Material readiness snapshot for the plan, read from BOM + Logistics availability
--
-- Explicitly not included:
--   - Production Order lifecycle semantic changes
--   - Logistics stock mutation or reservation
--   - Finance posting / costing / WIP
--   - Factory EIP analytics
--   - MES/IoT, optimizer, procurement workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  plan_number TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('sales_order', 'manual')),
  source_reference_id TEXT,
  source_reference_number TEXT,
  finished_good_item_id TEXT NOT NULL,
  planned_quantity NUMERIC(18, 6) NOT NULL CHECK (planned_quantity > 0),
  uom TEXT NOT NULL,
  requested_due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'planned', 'pending_approval', 'approved', 'rejected', 'cancelled', 'released')),
  bom_revision_id UUID,
  routing_revision_id UUID,
  source_location_id TEXT,
  material_readiness_status TEXT NOT NULL DEFAULT 'not_calculated'
    CHECK (material_readiness_status IN ('not_calculated', 'not_checked', 'available', 'shortage', 'not_proven')),
  material_readiness_checked_at TIMESTAMPTZ,
  material_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_production_order_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  submitted_by UUID,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT uq_manufacturing_production_plans_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_production_plans_tenant_factory_id
    UNIQUE (tenant_id, id, factory_org_unit_id),
  CONSTRAINT uq_manufacturing_production_plans_number UNIQUE (tenant_id, plan_number),
  CONSTRAINT ck_manufacturing_production_plans_sales_reference
    CHECK (source_type <> 'sales_order' OR NULLIF(BTRIM(source_reference_id), '') IS NOT NULL),
  CONSTRAINT ck_manufacturing_production_plans_material_requirements_array
    CHECK (jsonb_typeof(material_requirements) = 'array'),
  CONSTRAINT fk_manufacturing_production_plans_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id),
  CONSTRAINT fk_manufacturing_production_plans_bom_tenant
    FOREIGN KEY (tenant_id, bom_revision_id)
    REFERENCES public.manufacturing_bom_revisions(tenant_id, id),
  CONSTRAINT fk_manufacturing_production_plans_routing_tenant
    FOREIGN KEY (tenant_id, routing_revision_id)
    REFERENCES public.manufacturing_routing_revisions(tenant_id, id),
  CONSTRAINT fk_manufacturing_production_plans_order_tenant
    FOREIGN KEY (tenant_id, linked_production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_production_plan_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  production_plan_id UUID NOT NULL,
  routing_revision_id UUID NOT NULL,
  routing_operation_id UUID NOT NULL,
  operation_sequence INTEGER NOT NULL CHECK (operation_sequence > 0),
  work_center_id UUID NOT NULL,
  planned_date DATE NOT NULL,
  shift_code TEXT NOT NULL,
  planned_quantity NUMERIC(18, 6) NOT NULL CHECK (planned_quantity > 0),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'blocked', 'released', 'cancelled')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  CONSTRAINT uq_manufacturing_plan_schedule_slots_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_plan_schedule_slots_operation
    UNIQUE (tenant_id, production_plan_id, routing_operation_id),
  CONSTRAINT fk_manufacturing_plan_schedule_slots_plan_tenant
    FOREIGN KEY (tenant_id, production_plan_id)
    REFERENCES public.manufacturing_production_plans(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_plan_schedule_slots_plan_factory
    FOREIGN KEY (tenant_id, production_plan_id, factory_org_unit_id)
    REFERENCES public.manufacturing_production_plans(tenant_id, id, factory_org_unit_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_plan_schedule_slots_routing_tenant
    FOREIGN KEY (tenant_id, routing_revision_id)
    REFERENCES public.manufacturing_routing_revisions(tenant_id, id),
  CONSTRAINT fk_manufacturing_plan_schedule_slots_operation_tenant
    FOREIGN KEY (tenant_id, routing_revision_id, routing_operation_id)
    REFERENCES public.manufacturing_routing_operations(tenant_id, routing_revision_id, id),
  CONSTRAINT fk_manufacturing_plan_schedule_slots_work_center_tenant
    FOREIGN KEY (tenant_id, work_center_id)
    REFERENCES public.manufacturing_work_centers(tenant_id, id),
  CONSTRAINT fk_manufacturing_plan_schedule_slots_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Manufacturing Production Plan tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_production_plans_factory_status
  ON public.manufacturing_production_plans(tenant_id, factory_org_unit_id, status);

-- zero-downtime: allow blocking-index - new Manufacturing Production Plan tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_production_plans_due_date
  ON public.manufacturing_production_plans(tenant_id, factory_org_unit_id, requested_due_at);

-- zero-downtime: allow blocking-index - new Manufacturing Production Plan tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_plan_schedule_slots_work_center
  ON public.manufacturing_production_plan_schedule_slots(
    tenant_id,
    factory_org_unit_id,
    work_center_id,
    planned_date,
    shift_code
  );

-- zero-downtime: allow blocking-index - new Manufacturing Production Plan tables have no existing production rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturing_plan_schedule_active_work_center_shift
  ON public.manufacturing_production_plan_schedule_slots(
    tenant_id,
    factory_org_unit_id,
    work_center_id,
    planned_date,
    shift_code
  )
  WHERE status IN ('planned', 'released');

ALTER TABLE public.manufacturing_production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_production_plan_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_production_plans_factory_access
  ON public.manufacturing_production_plans;
CREATE POLICY manufacturing_production_plans_factory_access
  ON public.manufacturing_production_plans
  FOR ALL
  USING (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id))
  WITH CHECK (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id));

DROP POLICY IF EXISTS manufacturing_plan_schedule_slots_plan_access
  ON public.manufacturing_production_plan_schedule_slots;
CREATE POLICY manufacturing_plan_schedule_slots_plan_access
  ON public.manufacturing_production_plan_schedule_slots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_plans plan
      WHERE plan.tenant_id = manufacturing_production_plan_schedule_slots.tenant_id
        AND plan.id = manufacturing_production_plan_schedule_slots.production_plan_id
        AND public.manufacturing_factory_access_allowed(plan.tenant_id, plan.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_plans plan
      WHERE plan.tenant_id = manufacturing_production_plan_schedule_slots.tenant_id
        AND plan.id = manufacturing_production_plan_schedule_slots.production_plan_id
        AND public.manufacturing_factory_access_allowed(plan.tenant_id, plan.factory_org_unit_id)
    )
  );

REVOKE ALL ON public.manufacturing_production_plans FROM anon;
REVOKE ALL ON public.manufacturing_production_plan_schedule_slots FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_plan_schedule_slots TO authenticated, service_role;

COMMENT ON TABLE public.manufacturing_production_plans IS
  'Manufacturing: approved demand/schedule plan before Production Order linkage. No stock mutation or Finance posting.';

COMMENT ON TABLE public.manufacturing_production_plan_schedule_slots IS
  'Manufacturing: Work Center day/shift schedule slots for a Production Plan. No optimizer or capacity engine.';
