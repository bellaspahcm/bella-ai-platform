-- Customer-approved contract addenda. A variation may change the current
-- contract value only after the exact revised payment schedule is approved.
-- Existing legacy rows are preserved as-is and are not treated as evidence of
-- customer approval by the new application contract.

ALTER TABLE public.interior_contract_addenda
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN approved_at DROP NOT NULL,
  ALTER COLUMN approved_at DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS proposed_payment_schedule JSONB,
  ADD COLUMN IF NOT EXISTS base_contract_value NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS customer_approval_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_interior_contract_addenda_status'
      AND conrelid = 'public.interior_contract_addenda'::regclass
  ) THEN
    ALTER TABLE public.interior_contract_addenda
      ADD CONSTRAINT ck_interior_contract_addenda_status
      CHECK (status IN ('approved', 'pending_customer_approval', 'rejected', 'superseded')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_interior_contract_addenda_customer_approval'
      AND conrelid = 'public.interior_contract_addenda'::regclass
  ) THEN
    ALTER TABLE public.interior_contract_addenda
      ADD CONSTRAINT fk_interior_contract_addenda_customer_approval
      FOREIGN KEY (tenant_id, customer_approval_id)
      REFERENCES public.interior_customer_approvals(tenant_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.interior_create_contract_addendum_request(p_addendum JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_contract public.interior_contracts%ROWTYPE;
  v_addendum public.interior_contract_addenda%ROWTYPE;
  v_contract_id UUID;
  v_value_delta NUMERIC(15, 2);
  v_schedule JSONB;
  v_schedule_total NUMERIC(15, 2);
  v_schedule_percentage NUMERIC(7, 2);
  v_existing_count INTEGER;
BEGIN
  IF v_tenant_id IS NULL OR v_actor_id IS NULL
     OR jsonb_typeof(p_addendum) IS DISTINCT FROM 'object'
     OR (p_addendum ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated Interior tenant is required';
  END IF;
  v_contract_id := (p_addendum ->> 'contract_id')::UUID;
  v_value_delta := (p_addendum ->> 'value_delta')::NUMERIC(15, 2);
  v_schedule := p_addendum -> 'proposed_payment_schedule';
  IF v_contract_id IS NULL OR v_value_delta IS NULL
     OR jsonb_typeof(v_schedule) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_schedule) = 0
     OR NULLIF(btrim(p_addendum ->> 'addendum_number'), '') IS NULL
     OR NULLIF(btrim(p_addendum ->> 'title'), '') IS NULL
     OR NULLIF(btrim(p_addendum ->> 'reason'), '') IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_REQUEST_INVALID';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:write', v_tenant_id,
      (SELECT c.project_id FROM public.interior_contracts c
       WHERE c.tenant_id = v_tenant_id AND c.id = v_contract_id), NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract write permission is required';
  END IF;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id AND actor.tenant_id = v_tenant_id;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;

  SELECT * INTO v_contract
  FROM public.interior_contracts c
  WHERE c.tenant_id = v_tenant_id AND c.id = v_contract_id
  FOR UPDATE;
  IF NOT FOUND OR v_contract.status NOT IN ('signed', 'active') THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_CONTRACT_NOT_SIGNED_OR_ACTIVE';
  END IF;
  IF v_contract.current_contract_value + v_value_delta <= 0 THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_VALUE_MUST_REMAIN_POSITIVE';
  END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.interior_payment_milestones m
  WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract_id;
  IF jsonb_array_length(v_schedule) <> v_existing_count THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_SCHEDULE_MUST_PRESERVE_MILESTONE_IDENTITIES';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_schedule) AS s(
      id UUID, "milestoneOrder" INTEGER, name TEXT, percentage NUMERIC,
      amount NUMERIC, "triggerCondition" TEXT, "dueDate" DATE
    )
    LEFT JOIN public.interior_payment_milestones m
      ON m.tenant_id = v_tenant_id AND m.contract_id = v_contract_id AND m.id = s.id
    WHERE m.id IS NULL OR s."milestoneOrder" IS DISTINCT FROM m.milestone_order
       OR NULLIF(btrim(s.name), '') IS NULL OR NULLIF(btrim(s."triggerCondition"), '') IS NULL
       OR s.percentage IS NULL OR s.percentage <= 0 OR s.amount IS NULL OR s.amount <= 0
  ) OR (
    SELECT count(DISTINCT s.id)
    FROM jsonb_to_recordset(v_schedule) AS s(id UUID)
  ) <> v_existing_count THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_SCHEDULE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.interior_payment_milestones m
    JOIN jsonb_to_recordset(v_schedule) AS s(
      id UUID, "milestoneOrder" INTEGER, name TEXT, percentage NUMERIC,
      amount NUMERIC, "triggerCondition" TEXT, "dueDate" DATE
    ) ON s.id = m.id
    WHERE m.tenant_id = v_tenant_id AND m.contract_id = v_contract_id
      AND (m.status = 'paid' OR COALESCE(m.collected_amount, 0) > 0
        OR COALESCE(m.invoice_status, 'unissued') <> 'unissued')
      AND (s."milestoneOrder" IS DISTINCT FROM m.milestone_order
        OR s.name IS DISTINCT FROM m.name OR s.percentage IS DISTINCT FROM m.percentage
        OR s.amount IS DISTINCT FROM m.amount OR s."triggerCondition" IS DISTINCT FROM m.trigger_condition
        OR s."dueDate" IS DISTINCT FROM m.due_date)
  ) THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_CANNOT_CHANGE_INVOICED_OR_PAID_MILESTONE';
  END IF;
  SELECT COALESCE(sum(s.amount), 0), COALESCE(sum(s.percentage), 0)
  INTO v_schedule_total, v_schedule_percentage
  FROM jsonb_to_recordset(v_schedule) AS s(amount NUMERIC, percentage NUMERIC);
  IF v_schedule_total <> v_contract.current_contract_value + v_value_delta
     OR v_schedule_percentage <> 100 THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_SCHEDULE_TOTAL_MISMATCH';
  END IF;

  -- A newly prepared schedule supersedes other unconsumed drafts for the same
  -- contract. Their approval capabilities become unusable in this transaction.
  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = 'Superseded by a newer contract addendum',
      updated_at = clock_timestamp()
  WHERE a.tenant_id = v_tenant_id AND a.subject_type = 'contract_addendum'
    AND a.subject_id IN (
      SELECT d.id FROM public.interior_contract_addenda d
      WHERE d.tenant_id = v_tenant_id AND d.contract_id = v_contract_id
        AND d.status = 'pending_customer_approval'
    ) AND a.status = 'pending';
  UPDATE public.interior_contract_addenda d
  SET status = 'superseded'
  WHERE d.tenant_id = v_tenant_id AND d.contract_id = v_contract_id
    AND d.status = 'pending_customer_approval';

  INSERT INTO public.interior_contract_addenda (
    id, tenant_id, contract_id, addendum_number, title, value_delta, reason,
    status, approved_at, proposed_payment_schedule, base_contract_value, created_at
  ) VALUES (
    COALESCE((p_addendum ->> 'id')::UUID, gen_random_uuid()), v_tenant_id, v_contract_id,
    btrim(p_addendum ->> 'addendum_number'), btrim(p_addendum ->> 'title'),
    v_value_delta, btrim(p_addendum ->> 'reason'), 'pending_customer_approval', NULL,
    v_schedule, v_contract.current_contract_value, clock_timestamp()
  ) RETURNING * INTO v_addendum;
  RETURN to_jsonb(v_addendum) || jsonb_build_object('created_by_actor_id', v_actor_id, 'created_by_actor_name', v_actor_name);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_contract_addendum_request(JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_contract_addendum_request(JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_contract_addendum_for_approval(p_addendum_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_addendum public.interior_contract_addenda%ROWTYPE;
  v_project_id UUID;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_addendum_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor is required';
  END IF;
  SELECT d, c.project_id INTO v_addendum, v_project_id
  FROM public.interior_contract_addenda d
  JOIN public.interior_contracts c ON c.tenant_id = d.tenant_id AND c.id = d.contract_id
  WHERE d.tenant_id = v_tenant_id AND d.id = p_addendum_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant_id, v_project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract read is required';
  END IF;
  RETURN jsonb_build_object(
    'id', v_addendum.id, 'tenant_id', v_addendum.tenant_id,
    'contract_id', v_addendum.contract_id, 'project_id', v_project_id,
    'status', v_addendum.status, 'version_number', 1,
    'customer_approval_id', v_addendum.customer_approval_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_contract_addendum_for_approval(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_contract_addendum_for_approval(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_create_customer_addendum_approval_request(p_approval JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_addendum public.interior_contract_addenda%ROWTYPE;
  v_project_id UUID;
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_subject_id UUID;
  v_sent_at TIMESTAMPTZ := (p_approval ->> 'sent_at')::TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ := (p_approval ->> 'expires_at')::TIMESTAMPTZ;
BEGIN
  IF v_tenant_id IS NULL OR v_actor_id IS NULL
     OR jsonb_typeof(p_approval) IS DISTINCT FROM 'object'
     OR p_approval ->> 'subject_type' IS DISTINCT FROM 'contract_addendum'
     OR (p_approval ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR (p_approval ->> 'sent_by_actor_id') IS DISTINCT FROM v_actor_id::TEXT
     OR p_approval ->> 'status' IS DISTINCT FROM 'pending'
     OR (p_approval ->> 'subject_version_number')::INTEGER IS DISTINCT FROM 1
     OR NULLIF(btrim(p_approval ->> 'client_representative'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'client_contact'), '') IS NULL
     OR v_sent_at IS NULL OR v_expires_at <= clock_timestamp()
     OR v_expires_at > clock_timestamp() + INTERVAL '365 days' THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_REQUEST_INVALID';
  END IF;
  v_subject_id := (p_approval ->> 'subject_id')::UUID;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id AND actor.tenant_id = v_tenant_id;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;
  SELECT c.project_id INTO v_project_id
  FROM public.interior_contracts c
  JOIN public.interior_contract_addenda d
    ON d.tenant_id = c.tenant_id AND d.contract_id = c.id
  WHERE c.tenant_id = v_tenant_id AND d.id = v_subject_id
  FOR UPDATE OF c;
  IF NOT FOUND OR v_project_id IS DISTINCT FROM (p_approval ->> 'project_id')::UUID THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_INVALID';
  END IF;
  SELECT d.* INTO v_addendum
  FROM public.interior_contract_addenda d
  WHERE d.tenant_id = v_tenant_id AND d.id = v_subject_id
    AND d.status = 'pending_customer_approval'
  FOR UPDATE;
  IF NOT FOUND
     OR NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_INVALID';
  END IF;
  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = 'Superseded by a newer customer approval request',
      updated_at = clock_timestamp()
  WHERE a.tenant_id = v_tenant_id AND a.subject_type = 'contract_addendum'
    AND a.subject_id = v_subject_id AND a.status = 'pending';
  INSERT INTO public.interior_customer_approvals (
    id, tenant_id, project_id, subject_type, subject_id, subject_version_number,
    approval_token, status, client_representative, client_contact, sent_at, expires_at,
    sent_by_actor_id, sent_by_actor_name, created_at, updated_at
  ) VALUES (
    (p_approval ->> 'id')::UUID, v_tenant_id, v_project_id, 'contract_addendum', v_subject_id, 1,
    (p_approval ->> 'approval_token')::UUID, 'pending',
    btrim(p_approval ->> 'client_representative'), btrim(p_approval ->> 'client_contact'),
    v_sent_at, v_expires_at, v_actor_id::TEXT, btrim(v_actor_name),
    COALESCE((p_approval ->> 'created_at')::TIMESTAMPTZ, v_sent_at),
    COALESCE((p_approval ->> 'updated_at')::TIMESTAMPTZ, v_sent_at)
  ) RETURNING * INTO v_approval;
  UPDATE public.interior_contract_addenda d
  SET customer_approval_id = v_approval.id
  WHERE d.tenant_id = v_tenant_id AND d.id = v_subject_id
    AND d.status = 'pending_customer_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
  RETURN to_jsonb(v_approval);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_customer_addendum_approval_request(JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_customer_addendum_approval_request(JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_public_customer_addendum_approval(
  p_approval_id UUID, p_approval_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;
REVOKE ALL ON FUNCTION public.interior_read_public_customer_addendum_approval(UUID, UUID)
  FROM PUBLIC, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_public_customer_addendum_approval(UUID, UUID)
  TO anon;

CREATE OR REPLACE FUNCTION public.guard_interior_customer_approval_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'pending' OR NEW.approved_at IS NOT NULL OR NEW.rejected_at IS NOT NULL
     OR NEW.signature_storage_path IS NOT NULL OR NEW.signature_sha256_hash IS NOT NULL THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_MUST_START_PENDING';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:write', NEW.tenant_id, NEW.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: contract write permission is required to request customer approval';
  END IF;
  IF NEW.subject_type = 'quotation' AND NOT EXISTS (
    SELECT 1 FROM public.interior_quotations q
    WHERE q.tenant_id = NEW.tenant_id AND q.project_id = NEW.project_id
      AND q.id = NEW.subject_id AND q.version_number = NEW.subject_version_number
      AND q.status IN ('sent_to_client', 'negotiating')
  ) THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_QUOTATION_SUBJECT_INVALID';
  ELSIF NEW.subject_type = 'contract' AND NOT EXISTS (
    SELECT 1 FROM public.interior_contracts c
    WHERE c.tenant_id = NEW.tenant_id AND c.project_id = NEW.project_id
      AND c.id = NEW.subject_id AND c.status = 'in_review'
      AND c.quotation_version_number = NEW.subject_version_number
  ) THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_CONTRACT_SUBJECT_INVALID';
  ELSIF NEW.subject_type = 'contract_addendum' AND NOT EXISTS (
    SELECT 1 FROM public.interior_contract_addenda d
    JOIN public.interior_contracts c ON c.tenant_id = d.tenant_id AND c.id = d.contract_id
    WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.subject_id
      AND c.project_id = NEW.project_id AND d.status = 'pending_customer_approval'
      AND NEW.subject_version_number = 1
  ) THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_ADDENDUM_SUBJECT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_interior_addendum_after_customer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_addendum public.interior_contract_addenda%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected')
     OR NEW.subject_type <> 'contract_addendum' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_addendum FROM public.interior_contract_addenda d
  WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.subject_id
    AND d.customer_approval_id = NEW.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
  -- Lock in contract -> addendum -> milestone order. Payment receipt writes lock
  -- their milestone rows, so locking the complete schedule before validation
  -- makes the approved total agree with any concurrently recorded receipt.
  SELECT * INTO v_contract FROM public.interior_contracts c
  WHERE c.tenant_id = v_addendum.tenant_id AND c.id = v_addendum.contract_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
  SELECT * INTO v_addendum FROM public.interior_contract_addenda d
  WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.subject_id
    AND d.customer_approval_id = NEW.id AND d.status = 'pending_customer_approval'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
  IF NEW.status = 'rejected' THEN
    UPDATE public.interior_contract_addenda d
    SET status = 'rejected'
    WHERE d.tenant_id = NEW.tenant_id AND d.id = v_addendum.id
      AND d.status = 'pending_customer_approval';
    IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
    RETURN NEW;
  END IF;
  IF NOT FOUND OR v_contract.status NOT IN ('signed', 'active')
     OR v_contract.current_contract_value IS DISTINCT FROM v_addendum.base_contract_value THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_CONTRACT_VALUE_CHANGED_REISSUE_REQUIRED';
  END IF;
  PERFORM m.id
  FROM public.interior_payment_milestones m
  WHERE m.tenant_id = v_addendum.tenant_id AND m.contract_id = v_addendum.contract_id
  ORDER BY m.milestone_order, m.id
  FOR UPDATE;
  IF EXISTS (
    SELECT 1
    FROM public.interior_payment_milestones m
    JOIN jsonb_to_recordset(v_addendum.proposed_payment_schedule) AS s(
    id UUID, "milestoneOrder" INTEGER, name TEXT, percentage NUMERIC,
    amount NUMERIC, "triggerCondition" TEXT, "dueDate" DATE
    ) ON s.id = m.id
    WHERE m.tenant_id = v_addendum.tenant_id AND m.contract_id = v_addendum.contract_id
      AND (m.status = 'paid' OR COALESCE(m.collected_amount, 0) > 0
        OR COALESCE(m.invoice_status, 'unissued') <> 'unissued')
      AND (s."milestoneOrder" IS DISTINCT FROM m.milestone_order
        OR s.name IS DISTINCT FROM m.name OR s.percentage IS DISTINCT FROM m.percentage
        OR s.amount IS DISTINCT FROM m.amount OR s."triggerCondition" IS DISTINCT FROM m.trigger_condition
        OR s."dueDate" IS DISTINCT FROM m.due_date)
  ) THEN
    RAISE EXCEPTION 'INTERIOR_ADDENDUM_MILESTONE_BECAME_IMMUTABLE_REISSUE_REQUIRED';
  END IF;
  UPDATE public.interior_payment_milestones m
  SET name = s.name, percentage = s.percentage, amount = s.amount,
      trigger_condition = s."triggerCondition", due_date = s."dueDate"
  FROM jsonb_to_recordset(v_addendum.proposed_payment_schedule) AS s(
    id UUID, "milestoneOrder" INTEGER, name TEXT, percentage NUMERIC,
    amount NUMERIC, "triggerCondition" TEXT, "dueDate" DATE
  )
  WHERE m.tenant_id = v_addendum.tenant_id AND m.contract_id = v_addendum.contract_id
    AND m.id = s.id AND m.status <> 'paid' AND COALESCE(m.collected_amount, 0) = 0
    AND COALESCE(m.invoice_status, 'unissued') = 'unissued';
  IF NOT FOUND THEN
    -- A schedule can legitimately leave all immutable rows unchanged; verify
    -- the referenced milestone set before applying the contract value below.
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(v_addendum.proposed_payment_schedule) AS s(id UUID)
      LEFT JOIN public.interior_payment_milestones m
        ON m.tenant_id = v_addendum.tenant_id AND m.contract_id = v_addendum.contract_id AND m.id = s.id
      WHERE m.id IS NULL
    ) THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_SCHEDULE_SUBJECT_STALE'; END IF;
  END IF;
  UPDATE public.interior_contract_addenda d
  SET status = 'approved', approved_at = NEW.approved_at
  WHERE d.tenant_id = NEW.tenant_id AND d.id = v_addendum.id
    AND d.status = 'pending_customer_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_APPROVAL_SUBJECT_STALE'; END IF;
  UPDATE public.interior_contracts c
  SET current_contract_value = c.current_contract_value + v_addendum.value_delta,
      updated_at = NEW.approved_at
  WHERE c.tenant_id = v_addendum.tenant_id AND c.id = v_addendum.contract_id
    AND c.current_contract_value = v_addendum.base_contract_value;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_ADDENDUM_CONTRACT_VALUE_CHANGED_REISSUE_REQUIRED'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_interior_addendum_after_customer_approval()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_advance_interior_addendum_after_customer_approval
  ON public.interior_customer_approvals;
CREATE TRIGGER trg_advance_interior_addendum_after_customer_approval
  AFTER UPDATE OF status ON public.interior_customer_approvals
  FOR EACH ROW EXECUTE FUNCTION public.advance_interior_addendum_after_customer_approval();

REVOKE INSERT, UPDATE, DELETE ON public.interior_contract_addenda FROM anon, authenticated;
