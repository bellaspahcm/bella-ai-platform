-- ============================================================================
-- Bella Interior — Emergency Recovery Script (Pre-Migration 170000 Baseline)
-- Generated: 2026-11-09T22:53:01.434Z
-- Target: lvnvkpyxtuilhrabtlwv (Production)
--
-- This script safely rolls back any partial or failed deployment of
-- migration 170000 / 180000 back to the exact pre-170000 Production state.
-- ============================================================================

BEGIN;

-- 1. Safely de-link and drop new columns from interior_boq_items (if added)
ALTER TABLE IF EXISTS public.interior_boq_items
  DROP COLUMN IF EXISTS source_takeoff_component_id CASCADE,
  DROP COLUMN IF EXISTS stable_component_id CASCADE;

-- 2. Drop new Takeoff tables (if created) — ONLY if 0 business rows exist
DO $$
DECLARE
  v_runs_cnt INT := 0;
  v_comp_cnt INT := 0;
BEGIN
  IF to_regclass('public.interior_takeoff_runs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.interior_takeoff_runs' INTO v_runs_cnt;
  END IF;
  IF to_regclass('public.interior_takeoff_components') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.interior_takeoff_components' INTO v_comp_cnt;
  END IF;

  IF v_runs_cnt = 0 AND v_comp_cnt = 0 THEN
    DROP TABLE IF EXISTS public.interior_takeoff_components CASCADE;
    DROP TABLE IF EXISTS public.interior_takeoff_runs CASCADE;
    RAISE NOTICE 'Cleanly dropped empty Takeoff tables';
  ELSE
    RAISE WARNING 'Takeoff tables contain % runs and % components — soft disabling triggers instead of dropping data',
      v_runs_cnt, v_comp_cnt;
    EXECUTE 'ALTER TABLE public.interior_takeoff_components DISABLE TRIGGER ALL';
    EXECUTE 'ALTER TABLE public.interior_takeoff_runs DISABLE TRIGGER ALL';
  END IF;
END $$;

-- 3. Restore pre-180000 trigger function on interior_boq_items
-- Restores original 5-field substantive filter from migration 140000
CREATE OR REPLACE FUNCTION public.trg_record_interior_boq_item_history()
RETURNS TRIGGER AS $$
DECLARE
    v_boq_version INTEGER := 1;
    v_actor UUID;
BEGIN
    v_actor := auth.uid();

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

-- 4. Clean up schema_migrations ledger if partial entries were made
DELETE FROM supabase_migrations.schema_migrations WHERE version IN ('20261109170000', '20261109180000');

COMMIT;
