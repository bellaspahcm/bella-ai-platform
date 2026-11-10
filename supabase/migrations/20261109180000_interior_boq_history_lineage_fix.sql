-- ============================================================================
-- Bella Interior OS — BOQ History Lineage Trigger Forward Fix
--
-- Migration: 20261109180000_interior_boq_history_lineage_fix.sql
-- Target: lvnvkpyxtuilhrabtlwv (Production)
-- Bounded Context: Bella Interior — BOQ Item History
--
-- PURPOSE:
--   Migration 140000 defined trg_record_interior_boq_item_history with a
--   substantive change filter covering: quantity, internal_unit_cost,
--   client_unit_price, specifications_json, dimensions_json.
--
--   Migration 170000 adds two lineage columns to interior_boq_items:
--     - source_takeoff_component_id (FK → interior_takeoff_components)
--     - stable_component_id (UUID lineage anchor)
--
--   These columns were NOT included in the substantive change filter.
--   An UPDATE that only sets Takeoff lineage on a BOQ item (linking it to a
--   Takeoff component) would NOT produce a history record under the 140000
--   trigger, breaking audit traceability for the Takeoff → BOQ sync event.
--
-- FIX:
--   Replace the trigger function with CREATE OR REPLACE to extend the filter.
--   The table, indexes, RLS policy, and existing trigger binding remain.
--   Only the FUNCTION body is updated — this is a forward-fix, not a rewrite.
--
-- SAFETY:
--   - CREATE OR REPLACE FUNCTION: idempotent, no downtime risk.
--   - Existing trigger binding (trg_interior_boq_items_history_capture)
--     automatically uses the replaced function — no DROP/CREATE TRIGGER needed.
--   - Zero destructive DDL. Zero ledger tampering.
--   - Trigger is BEFORE: history INSERT runs in same transaction as parent
--     UPDATE. If parent transaction rollbacks, history INSERT rollbacks too.
--     No phantom history records on rollback.
--   - search_path retained as SECURITY DEFINER SET search_path = public, pg_temp.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_record_interior_boq_item_history()
RETURNS TRIGGER AS $$
DECLARE
    v_boq_version INTEGER := 1;
    v_actor UUID;
BEGIN
    -- Determine actor safely from auth context (never from payload)
    v_actor := auth.uid();

    -- ----------------------------------------------------------------
    -- DELETE: always capture snapshot of OLD state as 'superseded'
    -- ----------------------------------------------------------------
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
            lineage_metadata,
            actor_id, recorded_at
        ) VALUES (
            OLD.tenant_id, OLD.boq_id, OLD.id, v_boq_version,
            'superseded', OLD.room_zone_id, OLD.room_zone_name,
            OLD.item_code, OLD.item_name, OLD.category,
            OLD.dimensions_json, OLD.specifications_json, OLD.unit,
            OLD.quantity, OLD.internal_unit_cost, OLD.internal_total_cost,
            OLD.client_unit_price, OLD.client_total_price,
            OLD.gross_margin_amount, OLD.gross_margin_percent,
            jsonb_build_object(
                'source_takeoff_component_id', OLD.source_takeoff_component_id,
                'stable_component_id', OLD.stable_component_id
            ),
            v_actor, timezone('utc'::text, now())
        );

        RETURN OLD;

    -- ----------------------------------------------------------------
    -- UPDATE: capture if substantive change detected
    -- Substantive = any change to: pricing, quantity, specifications,
    -- dimensions, OR Takeoff lineage columns (source_takeoff_component_id,
    -- stable_component_id).
    -- ----------------------------------------------------------------
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.quantity IS DISTINCT FROM NEW.quantity
           OR OLD.internal_unit_cost IS DISTINCT FROM NEW.internal_unit_cost
           OR OLD.client_unit_price IS DISTINCT FROM NEW.client_unit_price
           OR OLD.specifications_json IS DISTINCT FROM NEW.specifications_json
           OR OLD.dimensions_json IS DISTINCT FROM NEW.dimensions_json
           OR OLD.source_takeoff_component_id IS DISTINCT FROM NEW.source_takeoff_component_id
           OR OLD.stable_component_id IS DISTINCT FROM NEW.stable_component_id THEN

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
                lineage_metadata,
                actor_id, recorded_at
            ) VALUES (
                OLD.tenant_id, OLD.boq_id, OLD.id, v_boq_version,
                'updated', OLD.room_zone_id, OLD.room_zone_name,
                OLD.item_code, OLD.item_name, OLD.category,
                OLD.dimensions_json, OLD.specifications_json, OLD.unit,
                OLD.quantity, OLD.internal_unit_cost, OLD.internal_total_cost,
                OLD.client_unit_price, OLD.client_total_price,
                OLD.gross_margin_amount, OLD.gross_margin_percent,
                jsonb_build_object(
                    'source_takeoff_component_id', OLD.source_takeoff_component_id,
                    'stable_component_id', OLD.stable_component_id
                ),
                v_actor, timezone('utc'::text, now())
            );
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- NOTE: The trigger binding already exists from migration 140000:
--   CREATE TRIGGER trg_interior_boq_items_history_capture
--   BEFORE UPDATE OR DELETE ON public.interior_boq_items
--   FOR EACH ROW EXECUTE FUNCTION public.trg_record_interior_boq_item_history();
--
-- PostgreSQL automatically uses the replaced function. No DROP/CREATE needed.
-- ============================================================================

-- ============================================================================
-- SERVICE ROLE ACTOR ATTRIBUTION CLARIFICATION
-- ============================================================================
-- Migration 170000 applies tenant_isolation_policy to authenticated AND
-- service_role. However, the triggers for Takeoff (170000) require
-- auth.uid() IS NOT NULL.
--
-- Policy:
--   - Direct service_role writes to interior_takeoff_runs or
--     interior_takeoff_components are NOT PERMITTED without a valid JWT
--     user session. The trigger's IS NULL check will reject them.
--   - Backend services that must write Takeoff data must do so via
--     authenticated RPC calls with a user session JWT, not via service_role
--     bypass. This is intentional.
--   - If a system (automated) Takeoff run is required in future (e.g., bulk
--     import with no interactive user), a dedicated system actor UUID must be
--     provisioned and the write must carry that UUID in an authenticated JWT,
--     not bypass the trigger.
--   - BOQ item history (migration 140000) does NOT enforce auth.uid() IS NOT
--     NULL — a service_role write to interior_boq_items will produce a history
--     record with actor_id = NULL (acceptable for system-originated mutations).
--
-- This policy is recorded here as explicit commentary, not enforced by new DDL.
-- ============================================================================

-- ============================================================================
-- SOFT DEACTIVATION PROCEDURE (Documentation Only — NOT EXECUTED HERE)
-- ============================================================================
-- If emergency deactivation of BOQ history trigger is required:
--
-- PRE-CONDITIONS before DISABLE TRIGGER:
--   1. Halt all application write paths that touch interior_boq_items
--      (stop save_interior_boq_atomic RPC processing).
--   2. Restrict table access via RLS or temporarily revoke EXECUTE on
--      save_interior_boq_atomic from authenticated role.
--   3. Record in audit log: timestamp, operator, reason, trigger disabled.
--
-- DEACTIVATION (single atomic command):
--   ALTER TABLE public.interior_boq_items
--     DISABLE TRIGGER trg_interior_boq_items_history_capture;
--
-- RECOVERY (forward migration required):
--   Create a new migration (e.g. 20261109190000_...) that:
--     a. RE-ENABLES trigger: ALTER TABLE public.interior_boq_items
--          ENABLE TRIGGER trg_interior_boq_items_history_capture;
--     b. Backfills any history missed during the disabled window using
--        source data from interior_sync_idempotency or application logs.
--     c. Documents the gap period in lineage_metadata.
--
-- DO NOT use DISABLE TRIGGER as a default maintenance procedure.
-- ============================================================================

