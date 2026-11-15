-- Keep internal policy lookups outside the exposed Data API schema.
CREATE OR REPLACE FUNCTION private.interior_payment_transaction_finance_read_allowed(
  p_tenant_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_tenant_id = public.interior_actor_tenant()
     AND EXISTS (
       SELECT 1
       FROM public.interior_contracts c
       WHERE c.tenant_id = p_tenant_id
         AND c.id = p_contract_id
         AND public.interior_has_permission(
           'interior:finance:read', c.tenant_id, c.project_id, NULL
         )
     );
$$;

CREATE OR REPLACE FUNCTION private.interior_payment_transaction_record_allowed(
  p_tenant_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_tenant_id = public.interior_actor_tenant()
     AND EXISTS (
       SELECT 1
       FROM public.interior_contracts c
       WHERE c.tenant_id = p_tenant_id
         AND c.id = p_contract_id
         AND c.status IN ('signed', 'active')
         AND public.interior_has_permission(
           'interior:payment:record', c.tenant_id, c.project_id, NULL
         )
     );
$$;

REVOKE ALL ON FUNCTION private.interior_payment_transaction_finance_read_allowed(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.interior_payment_transaction_finance_read_allowed(UUID, UUID)
  TO authenticated;
REVOKE ALL ON FUNCTION private.interior_payment_transaction_record_allowed(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.interior_payment_transaction_record_allowed(UUID, UUID)
  TO authenticated;

DROP POLICY IF EXISTS interior_payment_transactions_finance_read
  ON public.interior_payment_transactions;
CREATE POLICY interior_payment_transactions_finance_read
  ON public.interior_payment_transactions
  FOR SELECT TO authenticated
  USING (private.interior_payment_transaction_finance_read_allowed(tenant_id, contract_id));

DROP POLICY IF EXISTS interior_payment_transactions_record
  ON public.interior_payment_transactions;
CREATE POLICY interior_payment_transactions_record
  ON public.interior_payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (private.interior_payment_transaction_record_allowed(tenant_id, contract_id));

-- The API may read only the contract context needed for the requested lifecycle
-- operation. It never needs a direct SELECT grant on interior_contracts.
CREATE OR REPLACE FUNCTION public.interior_read_contract_lifecycle_context(
  p_contract_id UUID,
  p_context TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_contract public.interior_contracts%ROWTYPE;
  v_milestones JSONB;
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL OR p_contract_id IS NULL
     OR p_context IS NULL OR p_context NOT IN ('payment', 'amendment') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_contract
  FROM public.interior_contracts c
  WHERE c.tenant_id = v_tenant_id AND c.id = p_contract_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF p_context = 'payment' THEN
    IF NOT public.interior_has_permission(
      'interior:payment:record', v_tenant_id, v_contract.project_id, NULL
    ) THEN
      RETURN NULL;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'milestoneOrder', m.milestone_order
    ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
    INTO v_milestones
    FROM public.interior_payment_milestones m
    WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract.id;
    RETURN jsonb_build_object(
      'id', v_contract.id, 'tenantId', v_tenant_id,
      'projectId', v_contract.project_id, 'status', v_contract.status,
      'milestones', v_milestones
    );
  END IF;

  IF NOT public.interior_has_permission(
       'interior:contract:amend', v_tenant_id, v_contract.project_id, NULL
     ) OR NOT public.interior_has_permission(
       'interior:finance:read', v_tenant_id, v_contract.project_id, NULL
     ) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'tenantId', m.tenant_id, 'contractId', m.contract_id,
    'milestoneOrder', m.milestone_order, 'name', m.name,
    'percentage', m.percentage, 'amount', m.amount,
    'triggerCondition', m.trigger_condition, 'status', m.status,
    'dueDate', m.due_date, 'paidAt', m.paid_at,
    'collectedAmount', m.collected_amount, 'invoiceStatus', m.invoice_status,
    'invoiceNumber', m.invoice_number, 'invoicedAt', m.invoiced_at
  ) ORDER BY m.milestone_order, m.id), '[]'::JSONB)
  INTO v_milestones
  FROM public.interior_payment_milestones m
  WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract.id;
  RETURN jsonb_build_object(
    'id', v_contract.id, 'tenantId', v_tenant_id,
    'projectId', v_contract.project_id, 'status', v_contract.status,
    'currentContractValue', v_contract.current_contract_value,
    'milestones', v_milestones
  );
END;
$$;

REVOKE ALL ON FUNCTION public.interior_read_contract_lifecycle_context(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_contract_lifecycle_context(UUID, TEXT)
  TO authenticated;
