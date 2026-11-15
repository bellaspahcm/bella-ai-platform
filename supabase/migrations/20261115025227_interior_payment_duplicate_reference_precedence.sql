-- Duplicate receipts must remain idempotently identifiable after the milestone
-- has been fully collected. Keep the unique index as the concurrency guard.
CREATE OR REPLACE FUNCTION public.guard_interior_payment_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id UUID;
  v_milestone_amount NUMERIC(15, 2);
  v_collected_amount NUMERIC(15, 2);
BEGIN
  IF auth.uid() IS NULL
     OR NEW.tenant_id IS DISTINCT FROM public.interior_actor_tenant()
     OR NEW.recorded_by IS DISTINCT FROM auth.uid()::TEXT THEN
    RAISE EXCEPTION 'AuthorizationViolation: payment actor and tenant must match the authenticated session';
  END IF;
  IF btrim(NEW.reference_code) = '' THEN
    RAISE EXCEPTION 'PaymentReferenceCodeRequired';
  END IF;

  SELECT c.project_id, m.amount, COALESCE(m.collected_amount, 0)
    INTO v_project_id, v_milestone_amount, v_collected_amount
  FROM public.interior_payment_milestones m
  JOIN public.interior_contracts c
    ON c.tenant_id = m.tenant_id AND c.id = m.contract_id
  WHERE m.tenant_id = NEW.tenant_id
    AND m.id = NEW.milestone_id
    AND m.contract_id = NEW.contract_id
    AND c.status IN ('signed', 'active')
  FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_MILESTONE_OR_SIGNED_CONTRACT_REQUIRED';
  END IF;
  IF NOT public.interior_has_permission(
    'interior:payment:record', NEW.tenant_id, v_project_id, NULL
  ) THEN
    RAISE EXCEPTION 'AuthorizationViolation: payment record permission is required';
  END IF;

  -- Check only after row locking and authorization. This keeps concurrent
  -- retries serialized while preserving 23505 when a completed receipt is retried.
  IF EXISTS (
    SELECT 1
    FROM public.interior_payment_transactions existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.contract_id = NEW.contract_id
      AND lower(btrim(existing.reference_code)) = lower(btrim(NEW.reference_code))
  ) THEN
    RAISE EXCEPTION 'duplicate key value violates unique constraint "uq_interior_payment_tx_reference_normalized"'
      USING ERRCODE = '23505', CONSTRAINT = 'uq_interior_payment_tx_reference_normalized';
  END IF;

  IF v_collected_amount + NEW.amount > v_milestone_amount THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE';
  END IF;

  NEW.reference_code := btrim(NEW.reference_code);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_interior_payment_transaction_insert()
  FROM PUBLIC, anon, authenticated, service_role;
