-- ============================================================================
-- Bella Interior OS Foundation Migration
-- 
-- Architecture: Platform Reuse – Domain Ownership – Product Independence
-- Invariant: Gate 0 Tenant Isolation strictly enforced across all 4 Bounded Contexts:
--   1. Design & Specification
--   2. Commercial & Costing
--   3. Manufacturing & Installation
--   4. Project Delivery & Aftercare
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DESIGN & SPECIFICATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    site_address TEXT NOT NULL,
    project_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'survey',
    estimated_budget NUMERIC(15, 2) NOT NULL DEFAULT 0,
    target_completion_date DATE NOT NULL,
    lead_architect_id TEXT NOT NULL,
    lead_architect_name TEXT NOT NULL,
    active_approved_revision_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_projects_tenant_code UNIQUE (tenant_id, code)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_projects_tenant_status 
    ON public.interior_projects(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.interior_project_room_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1,
    area_square_meters NUMERIC(8, 2),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_room_zones_tenant_code UNIQUE (tenant_id, project_id, code)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_room_zones_tenant_project 
    ON public.interior_project_room_zones(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_design_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'client_review',
    change_summary TEXT,
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    client_signoff_name TEXT,
    client_signoff_date TIMESTAMPTZ,
    CONSTRAINT uq_interior_revisions_tenant_project_version UNIQUE (tenant_id, project_id, version_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_revisions_tenant_project 
    ON public.interior_design_revisions(tenant_id, project_id, status);

CREATE TABLE IF NOT EXISTS public.interior_design_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE CASCADE,
    room_zone_id UUID REFERENCES public.interior_project_room_zones(id) ON DELETE SET NULL,
    asset_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_design_assets_tenant_revision 
    ON public.interior_design_assets(tenant_id, revision_id);

CREATE TABLE IF NOT EXISTS public.interior_design_material_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE CASCADE,
    item_category TEXT NOT NULL,
    brand TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    color_tone TEXT,
    spec_description TEXT NOT NULL,
    approved_for_use BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_material_specs_tenant_revision 
    ON public.interior_design_material_specs(tenant_id, revision_id);

-- ----------------------------------------------------------------------------
-- 2. COMMERCIAL & COSTING (BOQ, Quotation, Contract Milestones)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_boqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    design_revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE RESTRICT,
    boq_number TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    total_internal_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_client_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_gross_margin NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_margin_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    prepared_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_boqs_tenant_number UNIQUE (tenant_id, boq_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_boqs_tenant_project 
    ON public.interior_boqs(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    boq_id UUID NOT NULL REFERENCES public.interior_boqs(id) ON DELETE CASCADE,
    room_zone_id UUID REFERENCES public.interior_project_room_zones(id) ON DELETE SET NULL,
    room_zone_name TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    specifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    unit TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    internal_unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    internal_total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    client_unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    client_total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_margin_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_margin_percent NUMERIC(6, 2) NOT NULL DEFAULT 0
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_boq_items_tenant_boq 
    ON public.interior_boq_items(tenant_id, boq_id);

CREATE TABLE IF NOT EXISTS public.interior_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    boq_id UUID NOT NULL REFERENCES public.interior_boqs(id) ON DELETE RESTRICT,
    quotation_number TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    vat_percent NUMERIC(4, 2) NOT NULL DEFAULT 8,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_terms TEXT NOT NULL,
    validity_days INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_quotations_tenant_number UNIQUE (tenant_id, quotation_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_quotations_tenant_project 
    ON public.interior_quotations(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES public.interior_quotations(id) ON DELETE RESTRICT,
    contract_number TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    baseline_contract_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_contract_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    signed_date TIMESTAMPTZ NOT NULL,
    client_representative TEXT NOT NULL,
    contractor_representative TEXT NOT NULL,
    CONSTRAINT uq_interior_contracts_tenant_number UNIQUE (tenant_id, contract_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_contracts_tenant_project 
    ON public.interior_contracts(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_payment_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.interior_contracts(id) ON DELETE CASCADE,
    milestone_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    trigger_condition TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    CONSTRAINT uq_interior_milestones_order UNIQUE (tenant_id, contract_id, milestone_order)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_milestones_tenant_contract 
    ON public.interior_payment_milestones(tenant_id, contract_id);

-- ----------------------------------------------------------------------------
-- 3. MANUFACTURING & INSTALLATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    design_revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE RESTRICT,
    boq_id UUID NOT NULL REFERENCES public.interior_boqs(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'in_house',
    subcontractor_name TEXT,
    status TEXT NOT NULL DEFAULT 'in_production',
    scheduled_start_date DATE NOT NULL,
    scheduled_completion_date DATE NOT NULL,
    actual_dispatched_date TIMESTAMPTZ,
    workshop_manager_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_prod_orders_tenant_number UNIQUE (tenant_id, order_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_prod_orders_tenant_project 
    ON public.interior_production_orders(tenant_id, project_id, status);

CREATE TABLE IF NOT EXISTS public.interior_production_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    production_order_id UUID NOT NULL REFERENCES public.interior_production_orders(id) ON DELETE CASCADE,
    boq_item_id UUID NOT NULL REFERENCES public.interior_boq_items(id) ON DELETE RESTRICT,
    room_zone_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL,
    dimensions_summary TEXT NOT NULL,
    material_summary TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'cutting_cnc',
    qc_passed BOOLEAN NOT NULL DEFAULT false,
    qc_notes TEXT
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_prod_items_tenant_order 
    ON public.interior_production_order_items(tenant_id, production_order_id);

CREATE TABLE IF NOT EXISTS public.interior_site_installation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    plan_number TEXT NOT NULL,
    site_supervisor_id TEXT NOT NULL,
    site_supervisor_name TEXT NOT NULL,
    scheduled_start_date DATE NOT NULL,
    scheduled_end_date DATE NOT NULL,
    overall_progress_percent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_plans_tenant_number UNIQUE (tenant_id, plan_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_install_plans_tenant_project 
    ON public.interior_site_installation_plans(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_site_room_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.interior_site_installation_plans(id) ON DELETE CASCADE,
    room_zone_id UUID REFERENCES public.interior_project_room_zones(id) ON DELETE SET NULL,
    room_zone_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_delivered',
    installer_team_leader TEXT NOT NULL,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    target_install_date DATE NOT NULL,
    completed_date TIMESTAMPTZ
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_room_installs_tenant_plan 
    ON public.interior_site_room_installations(tenant_id, plan_id);

-- ----------------------------------------------------------------------------
-- 4. DELIVERY & AFTERCARE (Diary, Punch List, Handover, Warranty)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_site_diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weather TEXT NOT NULL,
    labor_headcount INTEGER NOT NULL DEFAULT 1,
    activities_completed TEXT[] NOT NULL DEFAULT '{}',
    material_delivered TEXT[] NOT NULL DEFAULT '{}',
    issues_noted TEXT,
    supervisor_name TEXT NOT NULL,
    photo_urls TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_site_diaries_tenant_project 
    ON public.interior_site_diaries(tenant_id, project_id, date);

CREATE TABLE IF NOT EXISTS public.interior_qc_punch_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    room_zone_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    defect_category TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'minor',
    photo_url TEXT,
    assigned_fixer TEXT NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    rectification_note TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_punch_list_tenant_project_status 
    ON public.interior_qc_punch_list_items(tenant_id, project_id, status);

CREATE TABLE IF NOT EXISTS public.interior_handover_dossiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.interior_contracts(id) ON DELETE RESTRICT,
    handover_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    total_punch_list_items INTEGER NOT NULL DEFAULT 0,
    open_punch_list_items INTEGER NOT NULL DEFAULT 0,
    client_accepted BOOLEAN NOT NULL DEFAULT true,
    client_signoff_name TEXT,
    final_settlement_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    dossier_document_url TEXT
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_handovers_tenant_project 
    ON public.interior_handover_dossiers(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_warranty_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.interior_contracts(id) ON DELETE RESTRICT,
    certificate_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    site_address TEXT NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL,
    expiration_date TIMESTAMPTZ NOT NULL,
    woodwork_warranty_months INTEGER NOT NULL DEFAULT 24,
    hardware_warranty_months INTEGER NOT NULL DEFAULT 60,
    stone_warranty_months INTEGER NOT NULL DEFAULT 120,
    terms_summary TEXT NOT NULL,
    CONSTRAINT uq_interior_warranties_tenant_number UNIQUE (tenant_id, certificate_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_warranties_tenant_project 
    ON public.interior_warranty_certificates(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.interior_warranty_service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES public.interior_warranty_certificates(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    reported_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    customer_report TEXT NOT NULL,
    room_zone_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    defect_category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    assigned_technician TEXT,
    scheduled_fix_date DATE,
    resolved_date TIMESTAMPTZ,
    resolution_details TEXT,
    supplier_chargeback_eligible BOOLEAN DEFAULT false,
    CONSTRAINT uq_interior_tickets_tenant_number UNIQUE (tenant_id, ticket_number)
);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_tickets_tenant_status 
    ON public.interior_warranty_service_tickets(tenant_id, status);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (GATE 0 TENANT ISOLATION)
-- ----------------------------------------------------------------------------

ALTER TABLE public.interior_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_project_room_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_design_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_design_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_design_material_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_boqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_production_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_site_installation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_site_room_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_site_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_qc_punch_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_handover_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_warranty_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_warranty_service_tickets ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'interior_projects', 'interior_project_room_zones', 'interior_design_revisions',
        'interior_design_assets', 'interior_design_material_specs', 'interior_boqs',
        'interior_boq_items', 'interior_quotations', 'interior_contracts',
        'interior_payment_milestones', 'interior_production_orders', 'interior_production_order_items',
        'interior_site_installation_plans', 'interior_site_room_installations', 'interior_site_diaries',
        'interior_qc_punch_list_items', 'interior_handover_dossiers', 'interior_warranty_certificates',
        'interior_warranty_service_tickets'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;
            CREATE POLICY tenant_isolation_policy ON public.%I
                USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid);
        ', tbl, tbl);
    END LOOP;
END $$;

