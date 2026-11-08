-- ============================================================================
-- Bella Interior OS — Production Hardening Migration
--
-- Migration: 20261108153000_harden_interior_boq_production_safety.sql
-- Purpose:
-- 1. [R2] Persistent Idempotency: Create table `interior_sync_idempotency`
--    with request_hash guard and 7-day expiration.
-- 2. [R3] Transaction Atomicity: Create RPC `save_interior_boq_atomic`
--    executing header upsert, item replacement, audit log, and idempotency
--    in a single atomic PostgreSQL transaction.
-- 3. [R4] Database-level Immutability: Add BEFORE UPDATE and BEFORE DELETE
--    triggers on `interior_boqs` and `interior_boq_items`.
-- 4. [R5] Database Concurrency Protection: Optimistic locking in RPC + constraints.
-- 5. [R6] Protected Audit Integration: Audit logs written within the same transaction.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERSISTENT IDEMPOTENCY TABLE (R2)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_sync_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    boq_id UUID REFERENCES public.interior_boqs(id) ON DELETE CASCADE,
    operation_status TEXT NOT NULL DEFAULT 'completed' CHECK (operation_status IN ('processing', 'completed', 'failed')),
    response_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_interior_sync_idempotency UNIQUE (tenant_id, project_id, idempotency_key)
);

ALTER TABLE public.interior_sync_idempotency ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interior_sync_idempotency' AND policyname = 'tenant_isolation_policy'
    ) THEN
        CREATE POLICY tenant_isolation_policy ON public.interior_sync_idempotency
            FOR ALL TO public
            USING (tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interior_sync_idempotency_lookup
    ON public.interior_sync_idempotency(tenant_id, project_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- 2. DATABASE-LEVEL IMMUTABILITY TRIGGERS (R4)
-- ----------------------------------------------------------------------------

-- 2.1 Trigger on interior_boqs (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.trg_guard_interior_boq_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. If currently locked_for_contract, NO mutation is allowed whatsoever
    IF OLD.status = 'locked_for_contract' THEN
        RAISE EXCEPTION 'Immutability violation: BOQ % is locked_for_contract and cannot be modified.', OLD.id;
    END IF;

    -- 2. If currently approved, ONLY transition to locked_for_contract is permitted,
    --    AND all commercial figures must remain strictly unchanged!
    IF OLD.status = 'approved' THEN
        IF NEW.status != 'locked_for_contract' THEN
            RAISE EXCEPTION 'Immutability violation: BOQ % is approved and cannot be updated to status %.', OLD.id, NEW.status;
        END IF;

        -- Strict invariant: no financial or identity tampering during the status transition
        IF NEW.total_internal_cost != OLD.total_internal_cost
           OR NEW.total_client_price != OLD.total_client_price
           OR NEW.total_gross_margin != OLD.total_gross_margin
           OR NEW.gross_margin_percent != OLD.gross_margin_percent
           OR NEW.boq_number != OLD.boq_number
           OR NEW.version_number != OLD.version_number
           OR NEW.design_revision_id != OLD.design_revision_id
           OR NEW.project_id != OLD.project_id
           OR NEW.tenant_id != OLD.tenant_id THEN
            RAISE EXCEPTION 'Immutability violation: Cannot alter commercial figures or identities of approved BOQ % during contract locking.', OLD.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_interior_boq_update_immutability ON public.interior_boqs;
CREATE TRIGGER check_interior_boq_update_immutability
BEFORE UPDATE ON public.interior_boqs
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_interior_boq_immutability();

-- 2.2 Trigger on interior_boqs (BEFORE DELETE)
CREATE OR REPLACE FUNCTION public.trg_guard_interior_boq_delete_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('approved', 'locked_for_contract') THEN
        RAISE EXCEPTION 'Immutability violation: BOQ % is % and cannot be deleted.', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_interior_boq_delete_immutability ON public.interior_boqs;
CREATE TRIGGER check_interior_boq_delete_immutability
BEFORE DELETE ON public.interior_boqs
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_interior_boq_delete_immutability();

-- 2.3 Trigger on interior_boq_items (BEFORE INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.trg_guard_interior_boq_items_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status TEXT;
    v_target_boq_id UUID;
BEGIN
    v_target_boq_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.boq_id ELSE NEW.boq_id END;

    SELECT status INTO v_parent_status
    FROM public.interior_boqs
    WHERE id = v_target_boq_id;

    IF v_parent_status IN ('approved', 'locked_for_contract') THEN
        RAISE EXCEPTION 'Immutability violation: Cannot % item on parent BOQ % with status %.', TG_OP, v_target_boq_id, v_parent_status;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_interior_boq_items_immutability ON public.interior_boq_items;
CREATE TRIGGER check_interior_boq_items_immutability
BEFORE INSERT OR UPDATE OR DELETE ON public.interior_boq_items
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_interior_boq_items_immutability();

-- ----------------------------------------------------------------------------
-- 3. ATOMIC TRANSACTION RPC FOR BOQ PERSISTENCE (R3, R5, R6)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_interior_boq_atomic(
    p_tenant_id UUID,
    p_boq_header JSONB,
    p_boq_items JSONB,
    p_expected_version INTEGER DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_request_hash TEXT DEFAULT NULL,
    p_audit_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_boq_id UUID;
    v_project_id UUID;
    v_existing RECORD;
    v_existing_idempotency RECORD;
    v_item RECORD;
    v_old_snapshot JSONB;
BEGIN
    -- 1. Validate mandatory tenant ID
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TenantIsolationViolation: tenant_id is required';
    END IF;

    v_boq_id := (p_boq_header->>'id')::UUID;
    v_project_id := (p_boq_header->>'project_id')::UUID;

    -- 2. Persistent Idempotency Check (R2)
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
        SELECT * INTO v_existing_idempotency
        FROM public.interior_sync_idempotency
        WHERE tenant_id = p_tenant_id
          AND project_id = v_project_id
          AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Payload Mismatch Guard
            IF p_request_hash IS NOT NULL AND v_existing_idempotency.request_hash != p_request_hash THEN
                RAISE EXCEPTION 'IdempotencyPayloadMismatch: Re-used idempotency key with conflicting payload';
            END IF;
            -- Return cached response
            RETURN v_existing_idempotency.response_snapshot;
        END IF;
    END IF;

    -- 3. Check existing BOQ and Concurrency (Optimistic Locking R5)
    SELECT * INTO v_existing
    FROM public.interior_boqs
    WHERE id = v_boq_id AND tenant_id = p_tenant_id;

    IF FOUND THEN
        -- Concurrency Guard
        IF p_expected_version IS NOT NULL AND v_existing.version_number != p_expected_version THEN
            RAISE EXCEPTION 'ConcurrencyConflict: Expected version %, but found %', p_expected_version, v_existing.version_number;
        END IF;
        v_old_snapshot := to_jsonb(v_existing);
    ELSE
        v_old_snapshot := NULL;
    END IF;

    -- 4. Upsert BOQ Header (R3 Atomicity)
    INSERT INTO public.interior_boqs (
        id, tenant_id, project_id, design_revision_id,
        boq_number, version_number, status,
        total_internal_cost, total_client_price, total_gross_margin, gross_margin_percent,
        prepared_by, updated_at
    ) VALUES (
        v_boq_id,
        p_tenant_id,
        v_project_id,
        (p_boq_header->>'design_revision_id')::UUID,
        p_boq_header->>'boq_number',
        (p_boq_header->>'version_number')::INTEGER,
        p_boq_header->>'status',
        (p_boq_header->>'total_internal_cost')::NUMERIC,
        (p_boq_header->>'total_client_price')::NUMERIC,
        (p_boq_header->>'total_gross_margin')::NUMERIC,
        (p_boq_header->>'gross_margin_percent')::NUMERIC,
        p_boq_header->>'prepared_by',
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        design_revision_id = EXCLUDED.design_revision_id,
        boq_number = EXCLUDED.boq_number,
        version_number = EXCLUDED.version_number,
        status = EXCLUDED.status,
        total_internal_cost = EXCLUDED.total_internal_cost,
        total_client_price = EXCLUDED.total_client_price,
        total_gross_margin = EXCLUDED.total_gross_margin,
        gross_margin_percent = EXCLUDED.gross_margin_percent,
        prepared_by = EXCLUDED.prepared_by,
        updated_at = timezone('utc'::text, now());

    -- 5. Delete old items (atomic replacement)
    DELETE FROM public.interior_boq_items
    WHERE boq_id = v_boq_id AND tenant_id = p_tenant_id;

    -- 6. Insert new items from JSON array
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_boq_items)
    LOOP
        INSERT INTO public.interior_boq_items (
            id, tenant_id, boq_id, room_zone_id, room_zone_name,
            item_code, item_name, category, dimensions_json, specifications_json,
            unit, quantity, internal_unit_cost, internal_total_cost,
            client_unit_price, client_total_price, gross_margin_amount, gross_margin_percent
        ) VALUES (
            (v_item.value->>'id')::UUID,
            p_tenant_id,
            v_boq_id,
            (v_item.value->>'room_zone_id')::UUID,
            v_item.value->>'room_zone_name',
            v_item.value->>'item_code',
            v_item.value->>'item_name',
            v_item.value->>'category',
            COALESCE(v_item.value->'dimensions', '{}'::jsonb),
            COALESCE(v_item.value->'specifications', '{}'::jsonb),
            v_item.value->>'unit',
            (v_item.value->>'quantity')::NUMERIC,
            (v_item.value->>'internal_unit_cost')::NUMERIC,
            (v_item.value->>'internal_total_cost')::NUMERIC,
            (v_item.value->>'client_unit_price')::NUMERIC,
            (v_item.value->>'client_total_price')::NUMERIC,
            (v_item.value->>'gross_margin_amount')::NUMERIC,
            (v_item.value->>'gross_margin_percent')::NUMERIC
        );
    END LOOP;

    -- 7. Audit Logging in the same transaction (R6)
    INSERT INTO public.audit_logs (
        tenant_id, table_name, record_id, action,
        old_data, new_data, changed_by_id, created_at
    ) VALUES (
        p_tenant_id,
        'interior_boqs',
        v_boq_id,
        CASE WHEN v_existing IS NOT NULL THEN 'UPDATE' ELSE 'INSERT' END,
        v_old_snapshot,
        p_boq_header,
        p_audit_actor_id,
        timezone('utc'::text, now())
    );

    -- 8. Save Idempotency Record if key provided (R2)
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
        INSERT INTO public.interior_sync_idempotency (
            tenant_id, project_id, idempotency_key, request_hash,
            boq_id, operation_status, response_snapshot, expires_at
        ) VALUES (
            p_tenant_id,
            v_project_id,
            p_idempotency_key,
            COALESCE(p_request_hash, 'none'),
            v_boq_id,
            'completed',
            jsonb_build_object(
                'success', true,
                'boq_id', v_boq_id,
                'version_number', (p_boq_header->>'version_number')::INTEGER,
                'status', p_boq_header->>'status'
            ),
            timezone('utc'::text, now()) + INTERVAL '7 days'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'boq_id', v_boq_id,
        'version_number', (p_boq_header->>'version_number')::INTEGER,
        'status', p_boq_header->>'status'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

