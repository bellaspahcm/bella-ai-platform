-- ============================================================================
-- Bella Agriculture OS - Foundation MVP
-- ============================================================================
-- Scope:
--   - Farm and Plot domain records
--   - Crop Cycle lifecycle and transition evidence
--   - Crop Activity evidence
--   - Material Usage evidence
--   - Harvest evidence
--   - Agriculture domain events and command idempotency
--
-- Explicitly not included:
--   - Agriculture Product identity
--   - ProductRegistry registration
--   - UI/API/runtime route registration
--   - Logistics stock mutation
--   - Finance posting / accounting outbox
--   - GIS, livestock, aquaculture, or agronomy rules engine
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agriculture_farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID NOT NULL,
  farm_code TEXT NOT NULL CHECK (length(trim(farm_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_farms_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_agriculture_farms_code UNIQUE (tenant_id, farm_code),
  CONSTRAINT fk_agriculture_farms_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  plot_code TEXT NOT NULL CHECK (length(trim(plot_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_plots_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_agriculture_plots_tenant_id_farm UNIQUE (tenant_id, id, farm_id),
  CONSTRAINT uq_agriculture_plots_code UNIQUE (tenant_id, farm_id, plot_code),
  CONSTRAINT fk_agriculture_plots_farm_tenant
    FOREIGN KEY (tenant_id, farm_id)
    REFERENCES public.agriculture_farms(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_agriculture_plots_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_crop_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  plot_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  cycle_code TEXT NOT NULL CHECK (length(trim(cycle_code)) > 0),
  crop_name TEXT NOT NULL CHECK (length(trim(crop_name)) > 0),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  planned_start_date DATE,
  planned_end_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_disposition TEXT
    CHECK (
      completion_disposition IS NULL OR
      completion_disposition IN (
        'completed_with_harvest',
        'crop_failure',
        'abandoned',
        'terminated_without_harvest',
        'other'
      )
    ),
  completion_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_crop_cycles_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_agriculture_crop_cycles_tenant_plot_farm UNIQUE (tenant_id, id, plot_id, farm_id),
  CONSTRAINT uq_agriculture_crop_cycle_code UNIQUE (tenant_id, plot_id, cycle_code),
  CONSTRAINT ck_agriculture_crop_cycles_dates
    CHECK (planned_start_date IS NULL OR planned_end_date IS NULL OR planned_start_date <= planned_end_date),
  CONSTRAINT ck_agriculture_crop_cycles_completion
    CHECK (
      status <> 'completed'
      OR completed_at IS NOT NULL
    ),
  CONSTRAINT ck_agriculture_crop_cycles_cancellation
    CHECK (
      status <> 'cancelled'
      OR (cancelled_at IS NOT NULL AND length(trim(coalesce(cancellation_reason, ''))) > 0)
    ),
  CONSTRAINT fk_agriculture_crop_cycles_plot_tenant
    FOREIGN KEY (tenant_id, plot_id, farm_id)
    REFERENCES public.agriculture_plots(tenant_id, id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_agriculture_crop_cycles_farm_tenant
    FOREIGN KEY (tenant_id, farm_id)
    REFERENCES public.agriculture_farms(tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_agriculture_crop_cycles_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_crop_cycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  crop_cycle_id UUID NOT NULL,
  from_status TEXT
    CHECK (from_status IS NULL OR from_status IN ('planned', 'active', 'completed', 'cancelled')),
  to_status TEXT NOT NULL
    CHECK (to_status IN ('planned', 'active', 'completed', 'cancelled')),
  reason TEXT,
  disposition TEXT
    CHECK (
      disposition IS NULL OR
      disposition IN (
        'completed_with_harvest',
        'crop_failure',
        'abandoned',
        'terminated_without_harvest',
        'other'
      )
    ),
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_crop_cycle_events_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_agriculture_cycle_events_cycle_tenant
    FOREIGN KEY (tenant_id, crop_cycle_id)
    REFERENCES public.agriculture_crop_cycles(tenant_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.agriculture_crop_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  plot_id UUID NOT NULL,
  crop_cycle_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (length(trim(activity_type)) > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_crop_activities_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_agriculture_crop_activities_cycle_tenant
    FOREIGN KEY (tenant_id, crop_cycle_id, plot_id, farm_id)
    REFERENCES public.agriculture_crop_cycles(tenant_id, id, plot_id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_agriculture_crop_activities_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_material_usage_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  plot_id UUID NOT NULL,
  crop_cycle_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  material_id TEXT NOT NULL CHECK (length(trim(material_id)) > 0),
  material_name TEXT,
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity >= 0),
  uom TEXT NOT NULL CHECK (length(trim(uom)) > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_material_usage_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_agriculture_material_usage_cycle_tenant
    FOREIGN KEY (tenant_id, crop_cycle_id, plot_id, farm_id)
    REFERENCES public.agriculture_crop_cycles(tenant_id, id, plot_id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_agriculture_material_usage_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_harvest_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  plot_id UUID NOT NULL,
  crop_cycle_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  harvest_batch_code TEXT,
  crop_name TEXT,
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity >= 0),
  uom TEXT NOT NULL CHECK (length(trim(uom)) > 0),
  quality_grade TEXT,
  harvested_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_harvest_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_agriculture_harvest_cycle_tenant
    FOREIGN KEY (tenant_id, crop_cycle_id, plot_id, farm_id)
    REFERENCES public.agriculture_crop_cycles(tenant_id, id, plot_id, farm_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_agriculture_harvest_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('farm', 'plot', 'crop_cycle', 'crop_activity', 'material_usage', 'harvest')),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_domain_events_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_agriculture_domain_events_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.agriculture_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID NOT NULL,
  operation TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agriculture_command_idempotency UNIQUE (tenant_id, operation, business_key),
  CONSTRAINT fk_agriculture_command_idempotency_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_farms_tenant_org_status
  ON public.agriculture_farms(tenant_id, org_unit_id, status);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_plots_tenant_farm_status
  ON public.agriculture_plots(tenant_id, farm_id, status);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_crop_cycles_tenant_plot_status
  ON public.agriculture_crop_cycles(tenant_id, plot_id, status);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_activity_cycle
  ON public.agriculture_crop_activities(tenant_id, crop_cycle_id, occurred_at);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_material_usage_cycle
  ON public.agriculture_material_usage_evidence(tenant_id, crop_cycle_id, occurred_at);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_harvest_cycle
  ON public.agriculture_harvest_evidence(tenant_id, crop_cycle_id, harvested_at);

-- zero-downtime: allow blocking-index - new Agriculture OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_agriculture_domain_events_entity
  ON public.agriculture_domain_events(tenant_id, entity_id, recorded_at);

CREATE OR REPLACE FUNCTION public.agriculture_org_unit_access_allowed(
  p_tenant_id UUID,
  p_org_unit_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND p_org_unit_id IN (
      SELECT access.org_unit_id
      FROM public.user_org_unit_access access
      WHERE access.user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND access.tenant_id = p_tenant_id
    );
$$;

ALTER TABLE public.agriculture_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_crop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_crop_cycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_crop_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_material_usage_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_harvest_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agriculture_command_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agriculture_farms_org_unit_access ON public.agriculture_farms;
CREATE POLICY agriculture_farms_org_unit_access
  ON public.agriculture_farms
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_plots_org_unit_access ON public.agriculture_plots;
CREATE POLICY agriculture_plots_org_unit_access
  ON public.agriculture_plots
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_crop_cycles_org_unit_access ON public.agriculture_crop_cycles;
CREATE POLICY agriculture_crop_cycles_org_unit_access
  ON public.agriculture_crop_cycles
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_cycle_events_cycle_access ON public.agriculture_crop_cycle_events;
CREATE POLICY agriculture_cycle_events_cycle_access
  ON public.agriculture_crop_cycle_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.agriculture_crop_cycles cycle
      WHERE cycle.tenant_id = agriculture_crop_cycle_events.tenant_id
        AND cycle.id = agriculture_crop_cycle_events.crop_cycle_id
        AND public.agriculture_org_unit_access_allowed(cycle.tenant_id, cycle.org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agriculture_crop_cycles cycle
      WHERE cycle.tenant_id = agriculture_crop_cycle_events.tenant_id
        AND cycle.id = agriculture_crop_cycle_events.crop_cycle_id
        AND public.agriculture_org_unit_access_allowed(cycle.tenant_id, cycle.org_unit_id)
    )
  );

DROP POLICY IF EXISTS agriculture_crop_activities_org_unit_access ON public.agriculture_crop_activities;
CREATE POLICY agriculture_crop_activities_org_unit_access
  ON public.agriculture_crop_activities
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_material_usage_org_unit_access ON public.agriculture_material_usage_evidence;
CREATE POLICY agriculture_material_usage_org_unit_access
  ON public.agriculture_material_usage_evidence
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_harvest_org_unit_access ON public.agriculture_harvest_evidence;
CREATE POLICY agriculture_harvest_org_unit_access
  ON public.agriculture_harvest_evidence
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_domain_events_org_unit_access ON public.agriculture_domain_events;
CREATE POLICY agriculture_domain_events_org_unit_access
  ON public.agriculture_domain_events
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS agriculture_command_idempotency_org_unit_access ON public.agriculture_command_idempotency;
CREATE POLICY agriculture_command_idempotency_org_unit_access
  ON public.agriculture_command_idempotency
  FOR ALL
  USING (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.agriculture_org_unit_access_allowed(tenant_id, org_unit_id));

REVOKE ALL ON public.agriculture_farms FROM anon;
REVOKE ALL ON public.agriculture_plots FROM anon;
REVOKE ALL ON public.agriculture_crop_cycles FROM anon;
REVOKE ALL ON public.agriculture_crop_cycle_events FROM anon;
REVOKE ALL ON public.agriculture_crop_activities FROM anon;
REVOKE ALL ON public.agriculture_material_usage_evidence FROM anon;
REVOKE ALL ON public.agriculture_harvest_evidence FROM anon;
REVOKE ALL ON public.agriculture_domain_events FROM anon;
REVOKE ALL ON public.agriculture_command_idempotency FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_farms TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_plots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_crop_cycles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_crop_cycle_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_crop_activities TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_material_usage_evidence TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_harvest_evidence TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_domain_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agriculture_command_idempotency TO authenticated, service_role;

COMMENT ON TABLE public.agriculture_farms IS
  'Agriculture OS Foundation: tenant-scoped farm domain record anchored to Platform org unit access.';

COMMENT ON TABLE public.agriculture_crop_cycles IS
  'Agriculture OS Foundation: crop-cycle lifecycle record. Overlapping cycles on the same plot are permitted.';

COMMENT ON TABLE public.agriculture_material_usage_evidence IS
  'Agriculture OS Foundation: material usage evidence only. Inventory movement is outside this scope.';

COMMENT ON TABLE public.agriculture_harvest_evidence IS
  'Agriculture OS Foundation: harvest evidence only. Inventory receipt is outside this scope.';

COMMENT ON TABLE public.agriculture_command_idempotency IS
  'Agriculture OS Foundation: operation-specific command duplicate defense keyed by tenant, operation, and business key.';
