-- Mobility OS Foundation MVP contract controls
-- Scope: command idempotency and domain audit only.
-- Existing auto_* tables remain the persistence adapter for vehicles, ownership,
-- lifecycle logs, appointments, repair orders, and service history.

CREATE TABLE IF NOT EXISTS public.mobility_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('vehicle', 'vehicle_owner', 'vehicle_status', 'service_history')
  ),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_mobility_domain_events_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.mobility_command_idempotency (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pk_mobility_command_idempotency PRIMARY KEY (tenant_id, operation, business_key)
);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_domain_events_entity
  ON public.mobility_domain_events(tenant_id, entity_id, recorded_at);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_domain_events_org_unit
  ON public.mobility_domain_events(tenant_id, org_unit_id, recorded_at);

-- zero-downtime: allow blocking-index - new Mobility OS control tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_mobility_command_idempotency_org_unit
  ON public.mobility_command_idempotency(tenant_id, org_unit_id, created_at);

CREATE OR REPLACE FUNCTION public.mobility_tenant_access_allowed(
  p_tenant_id UUID,
  p_org_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_tenant_id = public.get_auth_tenant_id()
    AND (
      (
        p_org_unit_id IS NULL
        AND auth.uid() IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_org_unit_access access
        WHERE access.tenant_id = p_tenant_id
          AND access.org_unit_id = p_org_unit_id
          AND access.user_id = auth.uid()
      )
    );
$$;

ALTER TABLE public.mobility_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_command_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobility_domain_events_tenant_access ON public.mobility_domain_events;
CREATE POLICY mobility_domain_events_tenant_access
  ON public.mobility_domain_events
  FOR ALL TO authenticated
  USING (public.mobility_tenant_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS mobility_command_idempotency_tenant_access ON public.mobility_command_idempotency;
CREATE POLICY mobility_command_idempotency_tenant_access
  ON public.mobility_command_idempotency
  FOR ALL TO authenticated
  USING (public.mobility_tenant_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, org_unit_id));

REVOKE ALL ON public.mobility_domain_events FROM anon;
REVOKE ALL ON public.mobility_command_idempotency FROM anon;

GRANT SELECT, INSERT ON public.mobility_domain_events TO authenticated;
GRANT SELECT, INSERT ON public.mobility_command_idempotency TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_domain_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_command_idempotency TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_tenant_access_allowed(UUID, UUID) TO authenticated, service_role;

-- Replace historical Bella Auto adapter policies that allowed NULL tenant
-- context. Mobility grants below are safe only when these adapter tables enforce
-- a trusted authenticated user tenant.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicles" ON public.auto_vehicles';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicles_tenant_access ON public.auto_vehicles';
    EXECUTE 'CREATE POLICY mobility_auto_vehicles_tenant_access ON public.auto_vehicles FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_status_logs') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicle_status_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicle_status_logs" ON public.auto_vehicle_status_logs';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicle_status_logs_tenant_access ON public.auto_vehicle_status_logs';
    EXECUTE 'CREATE POLICY mobility_auto_vehicle_status_logs_tenant_access ON public.auto_vehicle_status_logs FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_owners') THEN
    EXECUTE 'ALTER TABLE public.auto_vehicle_owners ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Tenant view auto_vehicle_owners" ON public.auto_vehicle_owners';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_vehicle_owners_tenant_access ON public.auto_vehicle_owners';
    EXECUTE 'CREATE POLICY mobility_auto_vehicle_owners_tenant_access ON public.auto_vehicle_owners FOR ALL TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL)) WITH CHECK (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_history') THEN
    EXECUTE 'ALTER TABLE public.auto_service_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS auto_service_history_tenant_isolation ON public.auto_service_history';
    EXECUTE 'DROP POLICY IF EXISTS mobility_auto_service_history_tenant_read ON public.auto_service_history';
    EXECUTE 'CREATE POLICY mobility_auto_service_history_tenant_read ON public.auto_service_history FOR SELECT TO authenticated USING (public.mobility_tenant_access_allowed(tenant_id, NULL))';
  END IF;
END $$;

-- Minimal grants for existing auto_* adapter tables used by the Mobility public
-- contract. RLS remains the tenant boundary.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles') THEN
    GRANT SELECT, INSERT, UPDATE ON public.auto_vehicles TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_status_logs') THEN
    GRANT SELECT, INSERT ON public.auto_vehicle_status_logs TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_owners') THEN
    GRANT SELECT, INSERT, UPDATE ON public.auto_vehicle_owners TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_history') THEN
    GRANT SELECT ON public.auto_service_history TO authenticated, service_role;
  END IF;
END $$;

COMMENT ON TABLE public.mobility_domain_events IS
  'Mobility OS domain audit events for vehicle identity, ownership, lifecycle, and service-history trace.';

COMMENT ON TABLE public.mobility_command_idempotency IS
  'Mobility OS idempotency record keyed by tenant, operation, and business key.';
