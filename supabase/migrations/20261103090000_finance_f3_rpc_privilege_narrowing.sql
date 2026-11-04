BEGIN;

-- F3 mutation primitives are internal implementation details. Keep them
-- available to trusted server-side callers, but remove direct client access.
REVOKE EXECUTE ON FUNCTION public.finance_create_draft_invoice(uuid,uuid,character varying,character varying,date,date)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_add_invoice_line(uuid,uuid,uuid,text,numeric,bigint,numeric,character varying)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_finalize_invoice(uuid,uuid,character varying,character varying,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_allocate_payment(uuid,uuid,uuid,bigint,numeric,character varying,timestamp with time zone)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finance_create_draft_invoice(uuid,uuid,character varying,character varying,date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_add_invoice_line(uuid,uuid,uuid,text,numeric,bigint,numeric,character varying) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_finalize_invoice(uuid,uuid,character varying,character varying,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_allocate_payment(uuid,uuid,uuid,bigint,numeric,character varying,timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.finance_authenticated_create_draft_invoice(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_invoice_number character varying,
  p_currency character varying,
  p_issue_date date,
  p_due_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id OR COALESCE(v_actor.role, '') NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'FINANCE_F3_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN public.finance_create_draft_invoice(
    p_tenant_id, p_customer_id, p_invoice_number, p_currency, p_issue_date, p_due_date
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_authenticated_add_invoice_line(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_service_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price_minor bigint,
  p_tax_rate numeric,
  p_revenue_account_code character varying
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id OR COALESCE(v_actor.role, '') NOT IN ('admin', 'accountant') OR NOT EXISTS (
    SELECT 1 FROM public.finance_invoices i
    WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'FINANCE_F3_ACTOR_OR_TENANT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN public.finance_add_invoice_line(
    p_tenant_id, p_invoice_id, p_service_id, p_description, p_quantity,
    p_unit_price_minor, p_tax_rate, p_revenue_account_code
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_authenticated_finalize_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_idempotency_key character varying,
  p_request_hash character varying,
  p_lines_jsonb jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id OR COALESCE(v_actor.role, '') NOT IN ('admin', 'accountant') OR NOT EXISTS (
    SELECT 1 FROM public.finance_invoices i
    WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'FINANCE_F3_ACTOR_OR_TENANT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN public.finance_finalize_invoice(
    p_tenant_id, p_invoice_id, p_idempotency_key, p_request_hash, p_lines_jsonb
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_authenticated_allocate_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_cash_movement_id uuid,
  p_allocated_amount_minor bigint,
  p_exchange_rate numeric,
  p_rate_source character varying,
  p_rate_timestamp timestamp with time zone
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.platform_current_actor_profile();
  IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id OR COALESCE(v_actor.role, '') NOT IN ('admin', 'accountant')
    OR NOT EXISTS (
      SELECT 1 FROM public.finance_invoices i
      WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.finance_cash_movements m
      WHERE m.id = p_cash_movement_id AND m.tenant_id = p_tenant_id
    ) THEN
    RAISE EXCEPTION 'FINANCE_F3_ACTOR_OR_TENANT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN public.finance_allocate_payment(
    p_tenant_id, p_invoice_id, p_cash_movement_id, p_allocated_amount_minor,
    p_exchange_rate, p_rate_source, p_rate_timestamp
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_authenticated_create_draft_invoice(uuid,uuid,character varying,character varying,date,date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finance_authenticated_add_invoice_line(uuid,uuid,uuid,text,numeric,bigint,numeric,character varying)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finance_authenticated_finalize_invoice(uuid,uuid,character varying,character varying,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finance_authenticated_allocate_payment(uuid,uuid,uuid,bigint,numeric,character varying,timestamp with time zone)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.finance_authenticated_create_draft_invoice(uuid,uuid,character varying,character varying,date,date)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_authenticated_add_invoice_line(uuid,uuid,uuid,text,numeric,bigint,numeric,character varying)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_authenticated_finalize_invoice(uuid,uuid,character varying,character varying,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_authenticated_allocate_payment(uuid,uuid,uuid,bigint,numeric,character varying,timestamp with time zone)
  TO authenticated;

COMMIT;
