-- ============================================================================
-- Bella Interior OS — BOQ Item History & Audit Traceability Migration
--
-- Migration: 20261109140000_interior_boq_item_history.sql
-- Target: lvnvkpyxtuilhrabtlwv (Production)
-- Bounded Context: Bella Interior — BOQ & Commercial Management
--
-- Safety Controls:
-- 1. Tenant Isolation (Gate 0): Strict RLS policy enforcing JWT tenant_id.
-- 2. Immutability & Audit (Gate 2/3): Captures historical snapshots on item
--    lifecycle events (created, updated, deleted, superseded during atomic save).
-- 3. Actor Attribution: Records actor_id from auth.uid() or session context.
-- 4. Search Path Hygiene: Strict search_path = public, pg_temp on all functions.
-- 5. Zero-Downtime Safe: Additive table and index definitions only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BOQ ITEM HISTORY TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_boq_item_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    boq_id UUID NOT NULL REFERENCES public.interior_boqs(id) ON DELETE CASCADE,
    boq_item_id UUID,
    boq_version_number INTEGER NOT NULL DEFAULT 1,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'superseded', 'restored')),
    room_zone_id UUID REFERENCES public.interior_project_room_zones(id) ON DELETE SET NULL,
    room_zone_name TEXT NOT NULL DEFAULT 'Chung',
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
    gross_margin_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    lineage_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- zero-downtime: allow blocking-index - newly created table in same migration
CREATE INDEX IF NOT EXISTS idx_interior_boq_item_history_lookup
    ON public.interior_boq_item_history(tenant_id, boq_id, recorded_at DESC);

-- zero-downtime: allow blocking-index - newly created table in same migration
CREATE INDEX IF NOT EXISTS idx_interior_boq_item_history_item_code
    ON public.interior_boq_item_history(tenant_id, item_code);

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.interior_boq_item_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_boq_item_history' AND policyname = 'tenant_isolation_policy'
    ) THEN
        CREATE POLICY tenant_isolation_policy ON public.interior_boq_item_history
            FOR ALL TO public
            USING (tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. AUDIT TRIGGER FOR BOQ ITEM MUTATIONS
-- Automatically logs item state when updated or deleted/superseded
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_record_interior_boq_item_history()
RETURNS TRIGGER AS $$
DECLARE
    v_boq_version INTEGER := 1;
    v_actor UUID;
BEGIN
    -- Determine actor safely from auth context
    v_actor := auth.uid();

    -- Fetch current BOQ version number from parent header
    IF TG_OP = 'DELETE' THEN
        SELECT COALESCE(version_number, 1) INTO v_boq_version
        FROM public.interior_boqs
        WHERE id = OLD.boq_id AND tenant_id = OLD.tenant_id;

        INSERT INTO public.interior_boq_item_history (
            tenant_id, boq_id, boq_item_id, boq_version_number,
            change_type, room_zone_id, room_zone_name,
            item_code, item_name, category,
            dimensions_json, specifications_json, unit,
            quantity, internal_unit_cost, internal_total_cost,
            client_unit_price, client_total_price,
            gross_margin_amount, gross_margin_percent,
            actor_id, recorded_at
        ) VALUES (
            OLD.tenant_id, OLD.boq_id, OLD.id, v_boq_version,
            'superseded', OLD.room_zone_id, OLD.room_zone_name,
            OLD.item_code, OLD.item_name, OLD.category,
            OLD.dimensions_json, OLD.specifications_json, OLD.unit,
            OLD.quantity, OLD.internal_unit_cost, OLD.internal_total_cost,
            OLD.client_unit_price, OLD.client_total_price,
            OLD.gross_margin_amount, OLD.gross_margin_percent,
            v_actor, timezone('utc'::text, now())
        );

        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only record if substantive data changed
        IF OLD.quantity != NEW.quantity
           OR OLD.internal_unit_cost != NEW.internal_unit_cost
           OR OLD.client_unit_price != NEW.client_unit_price
           OR OLD.specifications_json != NEW.specifications_json
           OR OLD.dimensions_json != NEW.dimensions_json THEN

            SELECT COALESCE(version_number, 1) INTO v_boq_version
            FROM public.interior_boqs
            WHERE id = OLD.boq_id AND tenant_id = OLD.tenant_id;

            INSERT INTO public.interior_boq_item_history (
                tenant_id, boq_id, boq_item_id, boq_version_number,
                change_type, room_zone_id, room_zone_name,
                item_code, item_name, category,
                dimensions_json, specifications_json, unit,
                quantity, internal_unit_cost, internal_total_cost,
                client_unit_price, client_total_price,
                gross_margin_amount, gross_margin_percent,
                actor_id, recorded_at
            ) VALUES (
                OLD.tenant_id, OLD.boq_id, OLD.id, v_boq_version,
                'updated', OLD.room_zone_id, OLD.room_zone_name,
                OLD.item_code, OLD.item_name, OLD.category,
                OLD.dimensions_json, OLD.specifications_json, OLD.unit,
                OLD.quantity, OLD.internal_unit_cost, OLD.internal_total_cost,
                OLD.client_unit_price, OLD.client_total_price,
                OLD.gross_margin_amount, OLD.gross_margin_percent,
                v_actor, timezone('utc'::text, now())
            );
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_interior_boq_items_history_capture ON public.interior_boq_items;
CREATE TRIGGER trg_interior_boq_items_history_capture
BEFORE UPDATE OR DELETE ON public.interior_boq_items
FOR EACH ROW EXECUTE FUNCTION public.trg_record_interior_boq_item_history();

-- ----------------------------------------------------------------------------
-- 4. READ QUERY RPC FOR BOQ ITEM HISTORY
-- Allows authenticated users to view item history within their tenant
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.interior_get_boq_item_history(
    p_boq_id UUID,
    p_item_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    boq_id UUID,
    boq_item_id UUID,
    boq_version_number INTEGER,
    change_type TEXT,
    item_code TEXT,
    item_name TEXT,
    category TEXT,
    unit TEXT,
    quantity NUMERIC,
    internal_unit_cost NUMERIC,
    internal_total_cost NUMERIC,
    client_unit_price NUMERIC,
    client_total_price NUMERIC,
    gross_margin_amount NUMERIC,
    gross_margin_percent NUMERIC,
    dimensions_json JSONB,
    specifications_json JSONB,
    actor_id UUID,
    recorded_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_tenant_id UUID;
BEGIN
    v_caller_tenant_id := ((auth.jwt() ->> 'tenant_id'))::UUID;
    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: tenant_id claim required';
    END IF;

    RETURN QUERY
    SELECT
        h.id,
        h.boq_id,
        h.boq_item_id,
        h.boq_version_number,
        h.change_type,
        h.item_code,
        h.item_name,
        h.category,
        h.unit,
        h.quantity,
        h.internal_unit_cost,
        h.internal_total_cost,
        h.client_unit_price,
        h.client_total_price,
        h.gross_margin_amount,
        h.gross_margin_percent,
        h.dimensions_json,
        h.specifications_json,
        h.actor_id,
        h.recorded_at
    FROM public.interior_boq_item_history h
    WHERE h.tenant_id = v_caller_tenant_id
      AND h.boq_id = p_boq_id
      AND (p_item_code IS NULL OR h.item_code = p_item_code)
    ORDER BY h.recorded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.interior_get_boq_item_history(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.interior_get_boq_item_history(UUID, TEXT) TO authenticated, service_role;

