-- ============================================================================
-- Bella Interior OS — Canonical Takeoff Staging & BOQ Sync Schema
--
-- Migration: 20261109170000_interior_canonical_takeoff_and_boq_sync.sql
-- Target: lvnvkpyxtuilhrabtlwv (Production)
-- Bounded Context: Bella Interior — Design Studio to BOQ Takeoff Lifecycle
--
-- Architectural Integrity Controls:
-- 1. [Gate 0] Tenant Isolation & Scoped RBAC:
--    - RESTRICTIVE tenant isolation policy via tenant_id JWT claim.
--    - PERMISSIVE RBAC policies enforcing canonical permissions (interior:design:*).
-- 2. [Gate 1] Canonical Actor & Session Attribution:
--    - auth.uid() strictly enforced at DB trigger boundary (no unauthenticated writes).
--    - prepared_by_user_id assigned exclusively from auth.uid() on INSERT.
--    - completed_by_user_id assigned exclusively from auth.uid() on transition to completed.
--    - verified_by_user_id assigned exclusively from auth.uid() on component verification,
--      requiring interior:design:approve permission and separation of duties.
-- 3. [Gate 2] Lifecycle State Machine & Full Immutability:
--    - INSERT strictly restricted to 'draft' status (prevents bypassing lifecycle).
--    - Core bindings (id, tenant_id, project_id, revision_id, run_number, created_at) immutable.
--    - Valid transitions: draft -> under_review -> completed -> locked.
--    - Full metadata immutability on completed runs (only 'locked' status change permitted).
--    - Zero updates permitted on locked runs.
-- 4. [Gate 3] Parent Run Tenant & Project Guard:
--    - parent_run_id verified to belong to the exact same tenant and project.
-- 5. [Gate 4] Stable Component Identity & Lineage:
--    - stable_component_id column has NO DEFAULT, ensuring trigger-managed inheritance.
--    - Inherits from matching (room_zone_id, component_code) in parent_run_id when available.
--    - Cross-component collision prevention in the same project.
--    - Strictly immutable across component updates.
-- 6. [Gate 5] Component Run Binding & Delete Concurrency:
--    - takeoff_run_id immutable after component creation (no run hopping).
--    - DELETE trigger employs FOR SHARE row lock on parent run to prevent seal race conditions.
-- 7. [Gate 6] BOQ Lineage Integration:
--    - source_takeoff_component_id & stable_component_id FK on interior_boq_items.
--
-- Incident Management & Safe Rollback:
-- Forward-fix compliant. Zero destructive DROP CASCADE. Zero ledger tampering.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CANONICAL TAKEOFF RUNS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_takeoff_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    design_revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE RESTRICT,
    run_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'completed', 'locked')),
    is_immutable BOOLEAN NOT NULL DEFAULT FALSE,
    prepared_by TEXT NOT NULL,
    prepared_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_by TEXT,
    completed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    parent_run_id UUID REFERENCES public.interior_takeoff_runs(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    total_components_count INTEGER NOT NULL DEFAULT 0,
    pending_review_count INTEGER NOT NULL DEFAULT 0,
    verified_count INTEGER NOT NULL DEFAULT 0,
    review_required_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_takeoff_runs_number UNIQUE (tenant_id, project_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_interior_takeoff_runs_lookup
    ON public.interior_takeoff_runs(tenant_id, project_id, design_revision_id);

CREATE INDEX IF NOT EXISTS idx_interior_takeoff_runs_status
    ON public.interior_takeoff_runs(tenant_id, status);

ALTER TABLE public.interior_takeoff_runs ENABLE ROW LEVEL SECURITY;

-- 1.1 Tenant Isolation (Gate 0 RESTRICTIVE)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_runs' AND policyname = 'tenant_isolation_policy'
    ) THEN
        CREATE POLICY tenant_isolation_policy ON public.interior_takeoff_runs
            AS RESTRICTIVE FOR ALL TO authenticated, service_role
            USING (tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid);
    END IF;
END $$;

-- 1.2 Scoped RBAC Policies (PERMISSIVE Actions)
DO $$ BEGIN
    -- SELECT (Read)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_runs' AND policyname = 'interior_takeoff_runs_rbac_select'
    ) THEN
        CREATE POLICY interior_takeoff_runs_rbac_select ON public.interior_takeoff_runs
            AS PERMISSIVE FOR SELECT TO authenticated
            USING (public.interior_has_permission('interior:design:read', tenant_id, project_id, NULL));
    END IF;

    -- INSERT (Create)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_runs' AND policyname = 'interior_takeoff_runs_rbac_insert'
    ) THEN
        CREATE POLICY interior_takeoff_runs_rbac_insert ON public.interior_takeoff_runs
            AS PERMISSIVE FOR INSERT TO authenticated
            WITH CHECK (
                public.interior_has_permission('interior:design:create', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
            );
    END IF;

    -- UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_runs' AND policyname = 'interior_takeoff_runs_rbac_update'
    ) THEN
        CREATE POLICY interior_takeoff_runs_rbac_update ON public.interior_takeoff_runs
            AS PERMISSIVE FOR UPDATE TO authenticated
            USING (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:approve', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:boq:create', tenant_id, project_id, NULL)
            )
            WITH CHECK (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:approve', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:boq:create', tenant_id, project_id, NULL)
            );
    END IF;

    -- DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_runs' AND policyname = 'interior_takeoff_runs_rbac_delete'
    ) THEN
        CREATE POLICY interior_takeoff_runs_rbac_delete ON public.interior_takeoff_runs
            AS PERMISSIVE FOR DELETE TO authenticated
            USING (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. CANONICAL TAKEOFF COMPONENTS TABLE (NORMALIZED RELATIONAL MODEL)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_takeoff_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stable_component_id UUID NOT NULL, -- Blocker 1.2: NO DEFAULT to allow trigger-driven inheritance
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    takeoff_run_id UUID NOT NULL REFERENCES public.interior_takeoff_runs(id) ON DELETE CASCADE,
    design_revision_id UUID NOT NULL REFERENCES public.interior_design_revisions(id) ON DELETE RESTRICT,
    room_zone_id UUID NOT NULL REFERENCES public.interior_project_room_zones(id) ON DELETE RESTRICT,
    room_zone_name TEXT NOT NULL,
    component_code TEXT NOT NULL,
    component_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'cabinetry', 'loose_furniture', 'wall_paneling', 'stone_work',
        'metal_glass', 'lighting_fitout', 'curtain_soft', 'custom_decorative'
    )),
    dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    specifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    unit TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'verified', 'review_required')),
    review_notes TEXT,
    verified_by TEXT,
    verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    source_drawing_ref TEXT,
    source_3d_visual_ref TEXT,
    estimated_unit_cost NUMERIC(15, 2) DEFAULT 0,
    target_unit_price NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_interior_takeoff_components_code UNIQUE (takeoff_run_id, component_code)
);

CREATE INDEX IF NOT EXISTS idx_interior_takeoff_components_run
    ON public.interior_takeoff_components(tenant_id, takeoff_run_id);

CREATE INDEX IF NOT EXISTS idx_interior_takeoff_components_stable_id
    ON public.interior_takeoff_components(tenant_id, stable_component_id);

CREATE INDEX IF NOT EXISTS idx_interior_takeoff_components_room_zone
    ON public.interior_takeoff_components(tenant_id, room_zone_id);

ALTER TABLE public.interior_takeoff_components ENABLE ROW LEVEL SECURITY;

-- 2.1 Tenant Isolation (Gate 0 RESTRICTIVE)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_components' AND policyname = 'tenant_isolation_policy'
    ) THEN
        CREATE POLICY tenant_isolation_policy ON public.interior_takeoff_components
            AS RESTRICTIVE FOR ALL TO authenticated, service_role
            USING (tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid);
    END IF;
END $$;

-- 2.2 Scoped RBAC Policies (PERMISSIVE Actions)
DO $$ BEGIN
    -- SELECT (Read)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_components' AND policyname = 'interior_takeoff_components_rbac_select'
    ) THEN
        CREATE POLICY interior_takeoff_components_rbac_select ON public.interior_takeoff_components
            AS PERMISSIVE FOR SELECT TO authenticated
            USING (public.interior_has_permission('interior:design:read', tenant_id, project_id, NULL));
    END IF;

    -- INSERT (Create)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_components' AND policyname = 'interior_takeoff_components_rbac_insert'
    ) THEN
        CREATE POLICY interior_takeoff_components_rbac_insert ON public.interior_takeoff_components
            AS PERMISSIVE FOR INSERT TO authenticated
            WITH CHECK (
                public.interior_has_permission('interior:design:create', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
            );
    END IF;

    -- UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_components' AND policyname = 'interior_takeoff_components_rbac_update'
    ) THEN
        CREATE POLICY interior_takeoff_components_rbac_update ON public.interior_takeoff_components
            AS PERMISSIVE FOR UPDATE TO authenticated
            USING (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:approve', tenant_id, project_id, NULL)
            )
            WITH CHECK (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:approve', tenant_id, project_id, NULL)
            );
    END IF;

    -- DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_takeoff_components' AND policyname = 'interior_takeoff_components_rbac_delete'
    ) THEN
        CREATE POLICY interior_takeoff_components_rbac_delete ON public.interior_takeoff_components
            AS PERMISSIVE FOR DELETE TO authenticated
            USING (
                public.interior_has_permission('interior:design:update', tenant_id, project_id, NULL)
                OR public.interior_has_permission('interior:design:write', tenant_id, project_id, NULL)
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. EXTEND BOQ ITEMS WITH TAKEOFF LINEAGE POINTERS
-- ----------------------------------------------------------------------------

ALTER TABLE public.interior_boq_items
    ADD COLUMN IF NOT EXISTS source_takeoff_component_id UUID REFERENCES public.interior_takeoff_components(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS stable_component_id UUID;

CREATE INDEX IF NOT EXISTS idx_interior_boq_items_takeoff_component
    ON public.interior_boq_items(tenant_id, source_takeoff_component_id);

CREATE INDEX IF NOT EXISTS idx_interior_boq_items_stable_component
    ON public.interior_boq_items(tenant_id, stable_component_id);

-- ----------------------------------------------------------------------------
-- 4. DATABASE INTEGRITY, LIFECYCLE & ACTOR ATTRIBUTION TRIGGERS
-- ----------------------------------------------------------------------------

-- 4.1 Guard: Takeoff Run Lifecycle, Parent Guard & Full Immutability
CREATE OR REPLACE FUNCTION public.trg_guard_takeoff_run_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_rev_status TEXT;
    v_rev_project UUID;
    v_actor UUID;
    v_parent_tenant UUID;
    v_parent_project UUID;
BEGIN
    v_actor := auth.uid();

    -- Blocker 1.1: Strictly enforce authenticated user session actor (no NULL logic leak)
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'AuthorizationViolation: authenticated session actor required for Takeoff writes';
    END IF;

    -- Validate Design Revision exists and matches tenant + project
    SELECT status, project_id INTO v_rev_status, v_rev_project
    FROM public.interior_design_revisions
    WHERE id = NEW.design_revision_id AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TakeoffValidationViolation: Design revision % does not exist in this tenant.', NEW.design_revision_id;
    END IF;

    IF v_rev_project != NEW.project_id THEN
        RAISE EXCEPTION 'TakeoffValidationViolation: Design revision project % does not match takeoff run project %.',
            v_rev_project, NEW.project_id;
    END IF;

    -- Gate 1: Approved Design Lock
    IF v_rev_status != 'approved' THEN
        RAISE EXCEPTION 'ApprovedDesignLockViolation: Cannot create/update Takeoff Run for revision % with status %. Only approved revisions are eligible.',
            NEW.design_revision_id, v_rev_status;
    END IF;

    -- Blocker 1.4: Verify parent_run_id belongs to the same tenant and project
    IF NEW.parent_run_id IS NOT NULL THEN
        IF TG_OP = 'UPDATE' AND NEW.parent_run_id IS DISTINCT FROM OLD.parent_run_id THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: parent_run_id cannot be altered on existing Takeoff Run.';
        END IF;

        IF NEW.parent_run_id = NEW.id THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: Takeoff Run cannot be its own parent.';
        END IF;

        SELECT tenant_id, project_id INTO v_parent_tenant, v_parent_project
        FROM public.interior_takeoff_runs
        WHERE id = NEW.parent_run_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: Parent takeoff run % does not exist.', NEW.parent_run_id;
        END IF;

        IF v_parent_tenant != NEW.tenant_id THEN
            RAISE EXCEPTION 'TenantIsolationViolation: Parent takeoff run % belongs to a different tenant.', NEW.parent_run_id;
        END IF;

        IF v_parent_project != NEW.project_id THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: Parent takeoff run % belongs to project %, expected %.',
                NEW.parent_run_id, v_parent_project, NEW.project_id;
        END IF;
    END IF;

    -- 4.1.A: INSERT Lifecycle & Attribution Guard
    IF TG_OP = 'INSERT' THEN
        -- Blocker 1.3: Run MUST start in 'draft' status. Direct completion at INSERT is rejected.
        IF NEW.status IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'TakeoffLifecycleViolation: New Takeoff Run must be created in "draft" status (attempted "%")', NEW.status;
        END IF;

        IF NEW.is_immutable THEN
            RAISE EXCEPTION 'TakeoffLifecycleViolation: New Takeoff Run cannot be created as immutable';
        END IF;

        -- Blocker 1.1: Strict actor attribution from session auth.uid()
        NEW.prepared_by_user_id := v_actor;
        NEW.completed_by_user_id := NULL;
        NEW.completed_by := NULL;
        NEW.completed_at := NULL;
        NEW.is_immutable := FALSE;
        NEW.updated_at := timezone('utc'::text, now());
        RETURN NEW;
    END IF;

    -- 4.1.B: UPDATE Lifecycle & Full Immutability Guard
    IF TG_OP = 'UPDATE' THEN
        -- Needs Fix 1.5: Core bindings (id, tenant_id, project_id, revision_id, run_number, created_at) are strictly immutable
        IF NEW.id != OLD.id
           OR NEW.tenant_id != OLD.tenant_id
           OR NEW.project_id != OLD.project_id
           OR NEW.design_revision_id != OLD.design_revision_id
           OR NEW.run_number != OLD.run_number
           OR NEW.created_at != OLD.created_at THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: Core identity fields (id, tenant_id, project_id, revision, run_number, created_at) are strictly immutable.';
        END IF;

        -- Blocker 1.4: Locked runs are completely immutable (0 updates permitted)
        IF OLD.status = 'locked' THEN
            RAISE EXCEPTION 'TakeoffImmutabilityViolation: Locked Takeoff Run % is completely immutable.', OLD.id;
        END IF;

        -- Blocker 1.4 & Needs Fix 1.5: Completed runs can ONLY transition status to 'locked'. All metadata is sealed.
        IF OLD.status = 'completed' THEN
            IF NEW.status != 'locked' THEN
                RAISE EXCEPTION 'TakeoffImmutabilityViolation: Completed Takeoff Run % is sealed and can only transition to locked.', OLD.id;
            END IF;

            -- Verify NO metadata was altered during transition to locked
            IF NEW.title != OLD.title
               OR NEW.prepared_by != OLD.prepared_by
               OR NEW.prepared_by_user_id IS DISTINCT FROM OLD.prepared_by_user_id
               OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
               OR NEW.completed_by_user_id IS DISTINCT FROM OLD.completed_by_user_id
               OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
               OR NEW.parent_run_id IS DISTINCT FROM OLD.parent_run_id
               OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
               OR NEW.total_components_count != OLD.total_components_count
               OR NEW.pending_review_count != OLD.pending_review_count
               OR NEW.verified_count != OLD.verified_count
               OR NEW.review_required_count != OLD.review_required_count THEN
                RAISE EXCEPTION 'TakeoffImmutabilityViolation: Cannot modify Takeoff Run metadata when transitioning to locked.';
            END IF;

            NEW.is_immutable := TRUE;
            NEW.updated_at := timezone('utc'::text, now());
            RETURN NEW;
        END IF;

        -- Protect preparer attribution
        NEW.prepared_by_user_id := OLD.prepared_by_user_id;
        NEW.prepared_by := OLD.prepared_by;

        -- Needs Fix 1.5: In draft or under_review, caller cannot arbitrarily set completion metadata
        IF NEW.status IN ('draft', 'under_review') THEN
            NEW.is_immutable := FALSE;
            NEW.completed_at := NULL;
            NEW.completed_by := NULL;
            NEW.completed_by_user_id := NULL;
        END IF;

        -- State machine sequencing
        IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'under_review') THEN
            RAISE EXCEPTION 'TakeoffLifecycleViolation: Draft Takeoff Run can only transition to under_review.';
        END IF;

        IF OLD.status = 'under_review' AND NEW.status NOT IN ('under_review', 'draft', 'completed') THEN
            RAISE EXCEPTION 'TakeoffLifecycleViolation: Invalid status transition from under_review to %.', NEW.status;
        END IF;

        -- Blocker 1.1: When completing run, overwrite completed_by_user_id strictly from session auth.uid()
        IF NEW.status = 'completed' THEN
            IF NOT (
                public.interior_has_permission('interior:design:approve', NEW.tenant_id, NEW.project_id, NULL)
                OR public.interior_has_permission('interior:boq:create', NEW.tenant_id, NEW.project_id, NULL)
            ) THEN
                RAISE EXCEPTION 'AuthorizationViolation: Caller lacks permission to complete Takeoff Run.';
            END IF;

            NEW.is_immutable := TRUE;
            NEW.completed_at := timezone('utc'::text, now());
            NEW.completed_by_user_id := v_actor;
        END IF;

        NEW.updated_at := timezone('utc'::text, now());
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS check_takeoff_run_lifecycle ON public.interior_takeoff_runs;
CREATE TRIGGER check_takeoff_run_lifecycle
BEFORE INSERT OR UPDATE ON public.interior_takeoff_runs
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_takeoff_run_lifecycle();

-- 4.2 Guard: Takeoff Components Relational Integrity, Stable Identity & Verification RBAC
CREATE OR REPLACE FUNCTION public.trg_guard_takeoff_components_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status TEXT;
    v_parent_immutable BOOLEAN;
    v_parent_tenant UUID;
    v_parent_project UUID;
    v_parent_revision UUID;
    v_parent_run_id UUID;
    v_parent_preparer UUID;
    v_room_zone_name TEXT;
    v_existing_zone UUID;
    v_existing_code TEXT;
    v_parent_comp_stable_id UUID;
    v_actor UUID;
BEGIN
    v_actor := auth.uid();

    -- Blocker 1.1: Enforce session actor
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'AuthorizationViolation: authenticated session actor required for Takeoff writes';
    END IF;

    -- 1. Fetch parent run metadata with share lock
    SELECT tenant_id, project_id, design_revision_id, status, is_immutable, parent_run_id, prepared_by_user_id
    INTO v_parent_tenant, v_parent_project, v_parent_revision, v_parent_status, v_parent_immutable, v_parent_run_id, v_parent_preparer
    FROM public.interior_takeoff_runs
    WHERE id = NEW.takeoff_run_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TakeoffValidationViolation: Target takeoff run % does not exist.', NEW.takeoff_run_id;
    END IF;

    -- Enforce Tenant & Project match between component and parent run
    IF NEW.tenant_id != v_parent_tenant THEN
        RAISE EXCEPTION 'TenantIsolationViolation: Component tenant % does not match run tenant %.',
            NEW.tenant_id, v_parent_tenant;
    END IF;

    IF NEW.project_id != v_parent_project THEN
        RAISE EXCEPTION 'TakeoffValidationViolation: Component project % does not match run project %.',
            NEW.project_id, v_parent_project;
    END IF;

    NEW.design_revision_id := v_parent_revision;

    -- Immutability Lock on completed / locked runs
    IF v_parent_status IN ('completed', 'locked') OR v_parent_immutable THEN
        RAISE EXCEPTION 'TakeoffImmutabilityViolation: Cannot modify components on sealed Takeoff Run % (status: %).',
            NEW.takeoff_run_id, v_parent_status;
    END IF;

    -- 2. Validate Room Zone belongs to same tenant & project
    SELECT name INTO v_room_zone_name
    FROM public.interior_project_room_zones
    WHERE id = NEW.room_zone_id AND tenant_id = NEW.tenant_id AND project_id = NEW.project_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TakeoffValidationViolation: Room zone % does not belong to project % in tenant %.',
            NEW.room_zone_id, NEW.project_id, NEW.tenant_id;
    END IF;

    NEW.room_zone_name := v_room_zone_name;

    -- 3. Needs Fix 1.6 & Blocker 1.2: Component Run Binding & Stable Identity Protection
    IF TG_OP = 'UPDATE' THEN
        -- Needs Fix 1.6: Cannot change component run binding after insert (no run hopping)
        IF NEW.id != OLD.id
           OR NEW.tenant_id != OLD.tenant_id
           OR NEW.project_id != OLD.project_id
           OR NEW.takeoff_run_id != OLD.takeoff_run_id
           OR NEW.design_revision_id != OLD.design_revision_id
           OR NEW.created_at != OLD.created_at THEN
            RAISE EXCEPTION 'TakeoffValidationViolation: Component identity and run bindings (id, tenant, project, takeoff_run_id, revision, created_at) cannot be altered after creation.';
        END IF;

        IF NEW.stable_component_id IS DISTINCT FROM OLD.stable_component_id THEN
            RAISE EXCEPTION 'TakeoffIdentityViolation: stable_component_id is immutable across updates';
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        -- Blocker 1.2: Trigger-driven stable identity and parent inheritance (NO DEFAULT on column)
        IF NEW.stable_component_id IS NOT NULL THEN
            -- Check cross-component collision in the same project
            SELECT room_zone_id, component_code INTO v_existing_zone, v_existing_code
            FROM public.interior_takeoff_components
            WHERE stable_component_id = NEW.stable_component_id
              AND tenant_id = NEW.tenant_id
              AND project_id = NEW.project_id
            LIMIT 1;

            IF FOUND AND (v_existing_zone != NEW.room_zone_id OR v_existing_code != NEW.component_code) THEN
                RAISE EXCEPTION 'TakeoffIdentityViolation: stable_component_id % is already bound to code % in zone %',
                    NEW.stable_component_id, v_existing_code, v_existing_zone;
            END IF;
        ELSE
            -- Inherit stable_component_id from parent run if available
            IF v_parent_run_id IS NOT NULL THEN
                SELECT stable_component_id INTO v_parent_comp_stable_id
                FROM public.interior_takeoff_components
                WHERE takeoff_run_id = v_parent_run_id
                  AND room_zone_id = NEW.room_zone_id
                  AND component_code = NEW.component_code
                LIMIT 1;

                IF FOUND AND v_parent_comp_stable_id IS NOT NULL THEN
                    NEW.stable_component_id := v_parent_comp_stable_id;
                ELSE
                    NEW.stable_component_id := gen_random_uuid();
                END IF;
            ELSE
                NEW.stable_component_id := gen_random_uuid();
            END IF;
        END IF;
    END IF;

    -- 4. Blocker 1.3: Component Verification RBAC and Separation of Duties
    IF NEW.review_status = 'verified' AND (TG_OP = 'INSERT' OR OLD.review_status IS DISTINCT FROM 'verified') THEN
        IF NOT public.interior_has_permission('interior:design:approve', NEW.tenant_id, NEW.project_id, NULL) THEN
            RAISE EXCEPTION 'AuthorizationViolation: Component verification requires "interior:design:approve" permission.';
        END IF;

        IF v_parent_preparer IS NOT NULL AND v_parent_preparer = v_actor THEN
            RAISE EXCEPTION 'AuthorizationViolation: Takeoff preparer cannot verify components (separation of duties).';
        END IF;

        NEW.verified_by_user_id := v_actor;
        NEW.verified_at := timezone('utc'::text, now());
    ELSIF TG_OP = 'UPDATE' AND OLD.review_status = 'verified' AND NEW.review_status = 'verified' THEN
        -- Protect verified attribution from payload tampering
        NEW.verified_by_user_id := OLD.verified_by_user_id;
        NEW.verified_at := OLD.verified_at;
    ELSIF NEW.review_status != 'verified' THEN
        NEW.verified_by_user_id := NULL;
        NEW.verified_at := NULL;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS check_takeoff_components_integrity ON public.interior_takeoff_components;
CREATE TRIGGER check_takeoff_components_integrity
BEFORE INSERT OR UPDATE ON public.interior_takeoff_components
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_takeoff_components_integrity();

-- 4.3 Guard: Takeoff Components Delete Immutability with FOR SHARE Lock
CREATE OR REPLACE FUNCTION public.trg_guard_takeoff_components_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status TEXT;
    v_parent_immutable BOOLEAN;
BEGIN
    -- Needs Fix 2.2: Add FOR SHARE lock to eliminate delete race conditions
    SELECT status, is_immutable
    INTO v_parent_status, v_parent_immutable
    FROM public.interior_takeoff_runs
    WHERE id = OLD.takeoff_run_id
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN OLD;
    END IF;

    IF v_parent_status IN ('completed', 'locked') OR v_parent_immutable THEN
        RAISE EXCEPTION 'TakeoffImmutabilityViolation: Cannot delete component from sealed Takeoff Run % (status: %).',
            OLD.takeoff_run_id, v_parent_status;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS check_takeoff_components_delete ON public.interior_takeoff_components;
CREATE TRIGGER check_takeoff_components_delete
BEFORE DELETE ON public.interior_takeoff_components
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_takeoff_components_delete();

-- ----------------------------------------------------------------------------
-- 5. INCIDENT RESPONSE & SAFE ROLLBACK SPECIFICATION (NON-DESTRUCTIVE)
-- ----------------------------------------------------------------------------
-- ARCHITECTURAL POLICY:
-- In production, NEVER execute "DROP TABLE ... CASCADE" or "DELETE FROM schema_migrations".
-- If emergency deactivation of Takeoff triggers/constraints is mandated:
--
-- 1. Soft Deactivation (Preserves all business data):
--    ALTER TABLE public.interior_takeoff_components DISABLE TRIGGER check_takeoff_components_integrity;
--    ALTER TABLE public.interior_takeoff_components DISABLE TRIGGER check_takeoff_components_delete;
--    ALTER TABLE public.interior_takeoff_runs DISABLE TRIGGER check_takeoff_run_lifecycle;
--
-- 2. Forward-Fix Policy:
--    Any bug or schema modification must be addressed by submitting a new additive
--    forward migration (e.g. 20261109180000_interior_takeoff_forward_fix.sql).
-- ----------------------------------------------------------------------------
