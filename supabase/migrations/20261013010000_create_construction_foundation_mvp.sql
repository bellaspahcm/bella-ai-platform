-- ============================================================================
-- Bella Construction OS - Foundation MVP
-- ============================================================================
-- Scope:
--   - Project
--   - Site anchored to Platform Org Unit access
--   - Work Package
--   - BOQ line
--
-- Explicitly not included:
--   - Construction Product identity
--   - ProductRegistry registration
--   - Finance posting / accounting outbox
--   - Logistics or Warehouse mutation
--   - Independent Construction organization hierarchy
--   - Quality, safety, procurement, scheduling, or advanced cost control
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.construction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL CHECK (length(trim(project_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_construction_projects_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_construction_projects_code UNIQUE (tenant_id, project_code)
);

CREATE TABLE IF NOT EXISTS public.construction_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  site_code TEXT NOT NULL CHECK (length(trim(site_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  location_text TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_construction_sites_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_construction_sites_scope UNIQUE (tenant_id, id, project_id, org_unit_id),
  CONSTRAINT uq_construction_sites_code UNIQUE (tenant_id, project_id, site_code),
  CONSTRAINT fk_construction_sites_project_tenant
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.construction_projects(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_construction_sites_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.construction_work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  site_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  parent_work_package_id UUID,
  work_package_code TEXT NOT NULL CHECK (length(trim(work_package_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'archived')),
  planned_start_date DATE,
  planned_end_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_construction_work_packages_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_construction_work_packages_scope UNIQUE (tenant_id, id, site_id, project_id, org_unit_id),
  CONSTRAINT uq_construction_work_packages_code UNIQUE (tenant_id, site_id, work_package_code),
  CONSTRAINT ck_construction_work_packages_dates
    CHECK (planned_start_date IS NULL OR planned_end_date IS NULL OR planned_start_date <= planned_end_date),
  CONSTRAINT fk_construction_work_packages_site_tenant
    FOREIGN KEY (tenant_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_sites(tenant_id, id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_work_packages_parent_same_scope
    FOREIGN KEY (tenant_id, parent_work_package_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_work_packages_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.construction_boq_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  site_id UUID NOT NULL,
  work_package_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  line_number TEXT NOT NULL CHECK (length(trim(line_number)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  uom TEXT NOT NULL CHECK (length(trim(uom)) > 0),
  unit_rate NUMERIC(18, 2) CHECK (unit_rate IS NULL OR unit_rate >= 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (length(trim(currency)) > 0),
  cost_code TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_construction_boq_lines_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_construction_boq_lines_number UNIQUE (tenant_id, work_package_id, line_number),
  CONSTRAINT fk_construction_boq_lines_work_package_tenant
    FOREIGN KEY (tenant_id, work_package_id, site_id, project_id, org_unit_id)
    REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_construction_boq_lines_org_unit
    FOREIGN KEY (org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Construction OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_construction_projects_tenant_status
  ON public.construction_projects(tenant_id, status);

-- zero-downtime: allow blocking-index - new Construction OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_construction_sites_tenant_project_status
  ON public.construction_sites(tenant_id, project_id, status);

-- zero-downtime: allow blocking-index - new Construction OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_construction_sites_tenant_org_status
  ON public.construction_sites(tenant_id, org_unit_id, status);

-- zero-downtime: allow blocking-index - new Construction OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_construction_work_packages_tenant_site_status
  ON public.construction_work_packages(tenant_id, site_id, status);

-- zero-downtime: allow blocking-index - new Construction OS tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_construction_boq_lines_work_package
  ON public.construction_boq_lines(tenant_id, work_package_id, line_number);

CREATE OR REPLACE FUNCTION public.construction_tenant_access_allowed(
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p_tenant_id = COALESCE(
    public.get_auth_tenant_id(),
    NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
  );
$$;

CREATE OR REPLACE FUNCTION public.construction_org_unit_access_allowed(
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
    public.construction_tenant_access_allowed(p_tenant_id)
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

ALTER TABLE public.construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_boq_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS construction_projects_tenant_access ON public.construction_projects;
CREATE POLICY construction_projects_tenant_access
  ON public.construction_projects
  FOR ALL
  USING (public.construction_tenant_access_allowed(tenant_id))
  WITH CHECK (public.construction_tenant_access_allowed(tenant_id));

DROP POLICY IF EXISTS construction_sites_org_unit_access ON public.construction_sites;
CREATE POLICY construction_sites_org_unit_access
  ON public.construction_sites
  FOR ALL
  USING (public.construction_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.construction_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS construction_work_packages_org_unit_access ON public.construction_work_packages;
CREATE POLICY construction_work_packages_org_unit_access
  ON public.construction_work_packages
  FOR ALL
  USING (public.construction_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.construction_org_unit_access_allowed(tenant_id, org_unit_id));

DROP POLICY IF EXISTS construction_boq_lines_org_unit_access ON public.construction_boq_lines;
CREATE POLICY construction_boq_lines_org_unit_access
  ON public.construction_boq_lines
  FOR ALL
  USING (public.construction_org_unit_access_allowed(tenant_id, org_unit_id))
  WITH CHECK (public.construction_org_unit_access_allowed(tenant_id, org_unit_id));

REVOKE ALL ON public.construction_projects FROM anon;
REVOKE ALL ON public.construction_sites FROM anon;
REVOKE ALL ON public.construction_work_packages FROM anon;
REVOKE ALL ON public.construction_boq_lines FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_sites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_work_packages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_boq_lines TO authenticated, service_role;

COMMENT ON TABLE public.construction_projects IS
  'Construction OS Foundation: tenant-scoped project record owned by Construction OS.';

COMMENT ON TABLE public.construction_sites IS
  'Construction OS Foundation: site record anchored to Platform org unit access. It does not create a Construction organization hierarchy.';

COMMENT ON TABLE public.construction_work_packages IS
  'Construction OS Foundation: work package under a Platform-authorized site.';

COMMENT ON TABLE public.construction_boq_lines IS
  'Construction OS Foundation: BOQ planning line under a work package. It does not post accounting or mutate warehouse inventory.';
