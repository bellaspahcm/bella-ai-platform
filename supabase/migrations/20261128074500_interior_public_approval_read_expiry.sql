-- Stop public approval link reads once the token expires.
-- Guard exact Production pre-state before replacing any function.
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('public.interior_read_public_customer_addendum_approval(uuid,uuid)'::regprocedure)) <> '458939405cf519560f00494ac559d96d' THEN RAISE EXCEPTION 'Production function changed: interior_read_public_customer_addendum_approval(uuid,uuid)'; END IF;
  IF md5(pg_get_functiondef('public.interior_read_public_customer_approval(uuid,uuid)'::regprocedure)) <> '254f8193327f2ed214c4b22f83f2146d' THEN RAISE EXCEPTION 'Production function changed: interior_read_public_customer_approval(uuid,uuid)'; END IF;
  IF md5(pg_get_functiondef('public.interior_read_public_handover_acceptance(uuid,uuid)'::regprocedure)) <> 'ec569580dc412cb464ea2e6354e9113a' THEN RAISE EXCEPTION 'Production function changed: interior_read_public_handover_acceptance(uuid,uuid)'; END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.interior_read_public_customer_addendum_approval(p_approval_id uuid, p_approval_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_addendum public.interior_contract_addenda%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'service_role')
     OR p_approval_id IS NULL OR p_approval_token IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: valid customer approval capability is required';
  END IF;
  SELECT * INTO v_approval FROM public.interior_customer_approvals a
  WHERE a.id = p_approval_id AND a.approval_token = p_approval_token
    AND a.expires_at > statement_timestamp()
    AND a.subject_type = 'contract_addendum';
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_addendum FROM public.interior_contract_addenda d
  WHERE d.tenant_id = v_approval.tenant_id AND d.id = v_approval.subject_id
    AND d.customer_approval_id = v_approval.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_contract FROM public.interior_contracts c
  WHERE c.tenant_id = v_addendum.tenant_id AND c.id = v_addendum.contract_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'approvalId', v_approval.id, 'tenantId', v_approval.tenant_id,
    'subjectType', v_approval.subject_type, 'status', v_approval.status,
    'expiresAt', v_approval.expires_at,
    'canRespond', v_approval.status = 'pending' AND v_approval.expires_at > statement_timestamp(),
    'clientRepresentative', v_approval.client_representative,
    'subject', jsonb_build_object(
      'addendumId', v_addendum.id, 'addendumNumber', v_addendum.addendum_number,
      'title', v_addendum.title, 'reason', v_addendum.reason,
      'valueDelta', v_addendum.value_delta,
      'baseContractValue', v_addendum.base_contract_value,
      'proposedContractValue', v_addendum.base_contract_value + v_addendum.value_delta,
      'contractNumber', v_contract.contract_number,
      'proposedPaymentSchedule', v_addendum.proposed_payment_schedule
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.interior_read_public_customer_approval(p_approval_id uuid, p_approval_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_quotation public.interior_quotations%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_items JSONB := '[]'::JSONB;
  v_milestones JSONB := '[]'::JSONB;
  v_subject JSONB;
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated', 'service_role')
     OR p_approval_id IS NULL OR p_approval_token IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: valid customer approval capability is required';
  END IF;
  SELECT * INTO v_approval
  FROM public.interior_customer_approvals a
  WHERE a.id = p_approval_id AND a.approval_token = p_approval_token AND a.expires_at > statement_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_approval.subject_type = 'quotation' THEN
    SELECT * INTO v_quotation
    FROM public.interior_quotations q
    WHERE q.tenant_id = v_approval.tenant_id AND q.id = v_approval.subject_id
      AND q.version_number = v_approval.subject_version_number;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'itemNumber', item.row_number,
      'roomZoneName', item.room_zone_name,
      'itemCode', item.item_code,
      'itemName', item.item_name,
      'specifications', item.specifications,
      'unit', item.unit,
      'quantity', item.quantity,
      'clientUnitPrice', item.client_unit_price,
      'clientTotalPrice', item.client_total_price
    ) ORDER BY item.item_code, item.id), '[]'::JSONB)
    INTO v_items
    FROM (
      SELECT qi.*, row_number() OVER (ORDER BY qi.item_code, qi.id) AS row_number
      FROM public.interior_quotation_items qi
      WHERE qi.tenant_id = v_approval.tenant_id AND qi.quotation_id = v_quotation.id
    ) item;
    v_subject := jsonb_build_object(
      'quotationId', v_quotation.id,
      'quotationNumber', v_quotation.quotation_number,
      'versionNumber', v_quotation.version_number,
      'status', v_quotation.status,
      'subtotal', v_quotation.subtotal,
      'discountAmount', v_quotation.discount_amount,
      'vatPercent', v_quotation.vat_percent,
      'vatAmount', v_quotation.vat_amount,
      'grandTotal', v_quotation.grand_total,
      'paymentTerms', v_quotation.payment_terms,
      'validityDays', v_quotation.validity_days,
      'items', v_items
    );
  ELSIF v_approval.subject_type = 'contract' THEN
    SELECT * INTO v_contract
    FROM public.interior_contracts c
    WHERE c.tenant_id = v_approval.tenant_id AND c.id = v_approval.subject_id
      AND c.quotation_version_number = v_approval.subject_version_number;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'milestoneOrder', m.milestone_order,
      'name', m.name,
      'percentage', m.percentage,
      'amount', m.amount,
      'triggerCondition', m.trigger_condition,
      'dueDate', m.due_date
    ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
    INTO v_milestones
    FROM public.interior_payment_milestones m
    WHERE m.tenant_id = v_approval.tenant_id AND m.contract_id = v_contract.id;
    v_subject := jsonb_build_object(
      'contractId', v_contract.id,
      'contractNumber', v_contract.contract_number,
      'title', v_contract.title,
      'status', v_contract.status,
      'baselineContractValue', v_contract.baseline_contract_value,
      'paymentTerms', v_contract.payment_terms,
      'quotationNumber', v_contract.quotation_number,
      'quotationVersionNumber', v_contract.quotation_version_number,
      'boqVersionNumber', v_contract.boq_version_number,
      'designVersionNumber', v_contract.design_version_number,
      'milestones', v_milestones
    );
  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'approvalId', v_approval.id,
    'tenantId', v_approval.tenant_id,
    'subjectType', v_approval.subject_type,
    'status', v_approval.status,
    'expiresAt', v_approval.expires_at,
    'canRespond', v_approval.status = 'pending' AND v_approval.expires_at > statement_timestamp(),
    'clientRepresentative', v_approval.client_representative,
    'subject', v_subject
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.interior_read_public_handover_acceptance(p_approval_id uuid, p_approval_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_request public.interior_handover_acceptance_requests%ROWTYPE;
  v_project public.interior_projects%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_dossier public.interior_handover_dossiers%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.interior_handover_acceptance_requests r
  WHERE r.id = p_approval_id AND r.approval_token = p_approval_token AND r.expires_at > statement_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.tenant_id = v_request.tenant_id AND p.id = v_request.project_id;
  SELECT * INTO v_contract FROM public.interior_contracts c
  WHERE c.tenant_id = v_request.tenant_id AND c.id = v_request.contract_id;
  SELECT * INTO v_dossier FROM public.interior_handover_dossiers h
  WHERE h.tenant_id = v_request.tenant_id AND h.id = v_request.dossier_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'approvalId', v_request.id,
    'tenantId', v_request.tenant_id,
    'status', v_request.status,
    'expiresAt', v_request.expires_at,
    'canRespond', v_request.status = 'pending' AND v_request.expires_at > statement_timestamp(),
    'customerRepresentative', v_request.customer_representative,
    'subject', jsonb_build_object(
      'projectCode', v_project.code,
      'projectName', v_project.name,
      'siteAddress', v_project.site_address,
      'contractNumber', v_contract.contract_number,
      'contractStatus', v_contract.status,
      'finalSettlementValue', v_request.final_settlement_value,
      'totalPunchListItems', v_request.total_punch_list_items,
      'openPunchListItems', v_request.open_punch_list_items
    )
  );
END;
$function$;


