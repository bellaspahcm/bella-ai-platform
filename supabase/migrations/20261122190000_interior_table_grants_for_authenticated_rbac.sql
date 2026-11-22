-- Migration: 20261122190000_interior_table_grants_for_authenticated_rbac.sql
-- Purpose:
-- 1. Grant SELECT on interior operational and commercial tables to role 'authenticated'
--    so PostgreSQL table-level privileges allow RLS policies to evaluate when authenticated
--    users query projects, contracts, production orders, site diaries, and punch lists.
-- 2. Provide interior_update_user_status RPC for account activation/deactivation by authorized actors
--    with strict tenant isolation, self-lockout prevention, and last-owner safeguards.

BEGIN;

-- 1. Table Grants for authenticated users (protected by existing RLS policies)
GRANT SELECT ON public.interior_projects TO authenticated;
GRANT SELECT ON public.interior_contracts TO authenticated;
GRANT SELECT ON public.interior_contract_addenda TO authenticated;
GRANT SELECT ON public.interior_payment_milestones TO authenticated;
GRANT SELECT ON public.interior_quotations TO authenticated;
GRANT SELECT ON public.interior_quotation_items TO authenticated;
GRANT SELECT ON public.interior_production_orders TO authenticated;
GRANT SELECT ON public.interior_production_order_items TO authenticated;
GRANT SELECT ON public.interior_site_diaries TO authenticated;
GRANT SELECT ON public.interior_site_installation_plans TO authenticated;
GRANT SELECT ON public.interior_site_room_installations TO authenticated;
GRANT SELECT ON public.interior_qc_punch_list_items TO authenticated;
GRANT SELECT ON public.interior_handover_dossiers TO authenticated;
GRANT SELECT ON public.interior_warranty_certificates TO authenticated;
GRANT SELECT ON public.interior_warranty_service_tickets TO authenticated;

-- 2. RPC: interior_update_user_status
CREATE OR REPLACE FUNCTION public.interior_update_user_status(
  p_target_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(status text, reason text, user_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid := public.interior_actor_tenant();
  v_old_status text;
  v_is_owner boolean;
  v_can_manage boolean;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text, 'AUTHENTICATION_REQUIRED'::text, NULL::uuid; RETURN;
  END IF;

  v_is_owner := public.interior_is_owner(v_tenant, v_actor);
  v_can_manage := v_is_owner
    OR public.interior_actor_can_manage_roles(v_tenant)
    OR public.interior_has_permission('interior:users:manage', v_tenant, NULL, NULL);

  IF NOT v_can_manage THEN
    RETURN QUERY SELECT 'DENIED'::text, 'USER_MANAGEMENT_DENIED'::text, NULL::uuid; RETURN;
  END IF;

  IF p_target_user_id IS NULL OR p_status IS NULL OR lower(p_status) NOT IN ('active', 'inactive') THEN
    RETURN QUERY SELECT 'DENIED'::text, 'INVALID_INPUT'::text, NULL::uuid; RETURN;
  END IF;

  IF p_target_user_id = v_actor THEN
    RETURN QUERY SELECT 'DENIED'::text, 'CANNOT_CHANGE_OWN_STATUS'::text, NULL::uuid; RETURN;
  END IF;

  -- Lock target user in tenant
  SELECT lower(u.status) INTO v_old_status
  FROM public.users u
  WHERE u.id = p_target_user_id AND u.tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text, 'USER_NOT_FOUND_IN_TENANT'::text, NULL::uuid; RETURN;
  END IF;

  -- If deactivating, protect against deactivating the last active OWNER
  IF lower(p_status) = 'inactive' THEN
    IF EXISTS (
      SELECT 1 FROM public.interior_user_roles ur
      WHERE ur.tenant_id = v_tenant AND ur.user_id = p_target_user_id
        AND ur.role_key = 'OWNER' AND ur.status = 'ACTIVE'
    ) THEN
      IF NOT v_is_owner THEN
        RETURN QUERY SELECT 'DENIED'::text, 'OWNER_ONLY'::text, NULL::uuid; RETURN;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.interior_user_roles ur
        WHERE ur.tenant_id = v_tenant AND ur.user_id <> p_target_user_id
          AND ur.role_key = 'OWNER' AND ur.status = 'ACTIVE'
      ) THEN
        RETURN QUERY SELECT 'DENIED'::text, 'CANNOT_DEACTIVATE_LAST_OWNER'::text, NULL::uuid; RETURN;
      END IF;
    END IF;
  END IF;

  -- Update public.users
  UPDATE public.users
  SET status = lower(p_status),
      updated_at = statement_timestamp()
  WHERE id = p_target_user_id AND tenant_id = v_tenant;

  -- Audit log entry
  INSERT INTO public.interior_permission_audit_logs(
    tenant_id,
    actor_user_id,
    target_user_id,
    event_type,
    before_state,
    after_state
  ) VALUES (
    v_tenant,
    v_actor,
    p_target_user_id,
    CASE WHEN lower(p_status) = 'active' THEN 'USER_ACTIVATED' ELSE 'USER_DEACTIVATED' END,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', lower(p_status), 'reason', p_reason)
  );

  RETURN QUERY SELECT 'COMMITTED'::text, CASE WHEN lower(p_status) = 'active' THEN 'USER_ACTIVATED' ELSE 'USER_DEACTIVATED' END, p_target_user_id;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.interior_update_user_status(uuid, text, text) TO authenticated;

COMMIT;
