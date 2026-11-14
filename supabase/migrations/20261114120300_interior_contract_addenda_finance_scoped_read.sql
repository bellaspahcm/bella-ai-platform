-- Keep addenda private from direct Data API access. The authorized contract
-- read RPC below returns them only when the actor has Finance Read for the
-- project, so a tenant-wide JWT claim is not treated as project authorization.
REVOKE ALL ON TABLE public.interior_contract_addenda FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS tenant_isolation_interior_contract_addenda
  ON public.interior_contract_addenda;
DROP POLICY IF EXISTS interior_contract_addenda_no_direct_client_access
  ON public.interior_contract_addenda;
CREATE POLICY interior_contract_addenda_no_direct_client_access
  ON public.interior_contract_addenda
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.interior_read_contract_project(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant UUID := public.interior_actor_tenant();
  v_project public.interior_projects%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_milestones JSONB := '[]'::JSONB;
  v_addenda JSONB := '[]'::JSONB;
  v_finance_access BOOLEAN;
  v_customer_access BOOLEAN;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active tenant and project are required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.interior_projects p
    WHERE p.id = p_project_id AND p.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped project was not found';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant, p_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: contract read is required';
  END IF;

  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.id = p_project_id AND p.tenant_id = v_tenant;
  v_finance_access := public.interior_has_permission('interior:finance:read', v_tenant, p_project_id, NULL);
  v_customer_access := public.interior_has_permission('interior:customer:read', v_tenant, p_project_id, NULL);
  SELECT * INTO v_contract FROM public.interior_contracts c
  WHERE c.tenant_id = v_tenant AND c.project_id = p_project_id
  ORDER BY c.signed_date DESC NULLS LAST, c.id DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasContract', false, 'financeAccess', v_finance_access, 'customerAccess', v_customer_access,
      'project', jsonb_build_object('id', v_project.id, 'code', v_project.code, 'name', v_project.name)
    );
  END IF;

  IF v_finance_access THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'tenantId', m.tenant_id, 'contractId', m.contract_id,
      'milestoneOrder', m.milestone_order, 'name', m.name, 'percentage', m.percentage,
      'amount', m.amount, 'triggerCondition', m.trigger_condition, 'status', m.status,
      'dueDate', m.due_date, 'paidAt', m.paid_at
    ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
    INTO v_milestones FROM public.interior_payment_milestones m
    WHERE m.tenant_id = v_tenant AND m.contract_id = v_contract.id;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'tenantId', d.tenant_id,
      'contractId', d.contract_id,
      'addendumNumber', d.addendum_number,
      'title', d.title,
      'valueDelta', d.value_delta,
      'reason', d.reason,
      'status', d.status,
      'approvalEvidenceStatus', CASE
        WHEN d.status = 'pending_customer_approval' AND a.status = 'pending' THEN 'pending'
        WHEN d.status = 'approved' AND a.status = 'approved' THEN 'verified'
        WHEN d.status = 'rejected' AND a.status = 'rejected' THEN 'verified'
        WHEN d.status = 'superseded' AND a.status = 'approved' THEN 'verified'
        ELSE 'unverified'
      END,
      'customerApprovalId', d.customer_approval_id,
      'customerApprovalStatus', a.status,
      'baseContractValue', d.base_contract_value,
      'proposedPaymentSchedule', d.proposed_payment_schedule,
      'approvedAt', d.approved_at,
      'createdAt', d.created_at
    ) ORDER BY d.created_at, d.id), '[]'::JSONB)
    INTO v_addenda
    FROM public.interior_contract_addenda d
    LEFT JOIN public.interior_customer_approvals a
      ON a.tenant_id = d.tenant_id
      AND a.id = d.customer_approval_id
      AND a.project_id = p_project_id
      AND a.subject_type = 'contract_addendum'
      AND a.subject_id = d.id
    WHERE d.tenant_id = v_tenant AND d.contract_id = v_contract.id;
  END IF;

  RETURN jsonb_build_object(
    'hasContract', true, 'financeAccess', v_finance_access, 'customerAccess', v_customer_access,
    'project', jsonb_build_object('id', v_project.id, 'code', v_project.code, 'name', v_project.name),
    'contract', jsonb_strip_nulls(jsonb_build_object(
      'id', v_contract.id, 'tenantId', v_contract.tenant_id, 'projectId', v_contract.project_id,
      'quotationId', v_contract.quotation_id, 'quotationVersionNumber', v_contract.quotation_version_number,
      'quotationCustomerApprovalId', v_contract.quotation_customer_approval_id,
      'boqId', v_contract.boq_id, 'boqVersionNumber', v_contract.boq_version_number,
      'designRevisionId', v_contract.design_revision_id, 'designVersionNumber', v_contract.design_version_number,
      'customerApprovalId', v_contract.customer_approval_id,
      'contractNumber', v_contract.contract_number, 'title', v_contract.title, 'status', v_contract.status,
      'baselineContractValue', CASE WHEN v_finance_access THEN v_contract.baseline_contract_value END,
      'currentContractValue', CASE WHEN v_finance_access THEN v_contract.current_contract_value END,
      'signedDate', v_contract.signed_date,
      'clientRepresentative', CASE WHEN v_customer_access THEN v_contract.client_representative END,
      'contractorRepresentative', v_contract.contractor_representative,
      'milestones', CASE WHEN v_finance_access THEN v_milestones ELSE '[]'::JSONB END,
      'addenda', CASE WHEN v_finance_access THEN v_addenda ELSE '[]'::JSONB END
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.interior_read_contract_project(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_contract_project(UUID)
  TO authenticated;
