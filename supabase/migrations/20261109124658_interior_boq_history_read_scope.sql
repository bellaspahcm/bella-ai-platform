-- ============================================================================
-- Bella Interior OS — BOQ Item History Read Scope RPC
-- Migration: 20261109124658_interior_boq_history_read_scope.sql
-- Target: lvnvkpyxtuilhrabtlwv (Production)
-- Bounded Context: Bella Interior — BOQ & Commercial Management
--
-- Safety Controls:
-- 1. Search Path Hygiene: Strict SET search_path TO ''
-- 2. Authorization: Authentication, tenant matching, and scoped permission checks
-- 3. Granular Field Redaction: Redacts internal cost / margin for client roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.interior_get_boq_item_history(
    p_boq_id uuid,
    p_item_code text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid,
    boq_id uuid,
    boq_item_id uuid,
    boq_version_number integer,
    change_type text,
    item_code text,
    item_name text,
    category text,
    unit text,
    quantity numeric,
    internal_unit_cost numeric,
    internal_total_cost numeric,
    client_unit_price numeric,
    client_total_price numeric,
    gross_margin_amount numeric,
    gross_margin_percent numeric,
    dimensions_json jsonb,
    specifications_json jsonb,
    actor_id uuid,
    recorded_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_tenant_id uuid;
    v_project_id uuid;
    v_can_read_internal boolean;
    v_can_read_client boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AuthorizationViolation: authenticated actor is required'
            USING ERRCODE = '42501';
    END IF;

    v_tenant_id := public.interior_actor_tenant();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT b.project_id
      INTO v_project_id
      FROM public.interior_boqs b
     WHERE b.id = p_boq_id
       AND b.tenant_id = v_tenant_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'AuthorizationViolation: BOQ not found in active tenant'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.interior_has_permission(
        'interior:boq:read', v_tenant_id, v_project_id, NULL
    ) THEN
        RAISE EXCEPTION 'AuthorizationViolation: scoped BOQ read is required'
            USING ERRCODE = '42501';
    END IF;

    v_can_read_internal := public.interior_has_permission(
        'interior:finance:read', v_tenant_id, v_project_id, NULL
    );

    v_can_read_client := v_can_read_internal OR public.interior_has_permission(
        'interior:contract:read', v_tenant_id, v_project_id, NULL
    );

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
        CASE WHEN v_can_read_internal THEN h.internal_unit_cost ELSE NULL END,
        CASE WHEN v_can_read_internal THEN h.internal_total_cost ELSE NULL END,
        CASE WHEN v_can_read_client THEN h.client_unit_price ELSE NULL END,
        CASE WHEN v_can_read_client THEN h.client_total_price ELSE NULL END,
        CASE WHEN v_can_read_internal THEN h.gross_margin_amount ELSE NULL END,
        CASE WHEN v_can_read_internal THEN h.gross_margin_percent ELSE NULL END,
        h.dimensions_json,
        h.specifications_json,
        h.actor_id,
        h.recorded_at
    FROM public.interior_boq_item_history h
    WHERE h.tenant_id = v_tenant_id
      AND h.boq_id = p_boq_id
      AND (p_item_code IS NULL OR h.item_code = p_item_code)
    ORDER BY h.recorded_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.interior_get_boq_item_history(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.interior_get_boq_item_history(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.interior_get_boq_item_history(uuid, text) TO authenticated;

