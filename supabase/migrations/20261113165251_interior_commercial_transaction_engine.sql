-- Commercial state must be backed by immutable, version-specific customer evidence.
-- Product-local migration; it does not backfill or alter Production data in this task.

ALTER TABLE public.interior_contracts
  ALTER COLUMN signed_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS design_revision_id UUID,
  ADD COLUMN IF NOT EXISTS design_version_number INTEGER,
  ADD COLUMN IF NOT EXISTS quotation_customer_approval_id UUID,
  ADD COLUMN IF NOT EXISTS customer_approval_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_interior_contracts_quotation_approval'
      AND conrelid = 'public.interior_contracts'::REGCLASS
  ) THEN
    ALTER TABLE public.interior_contracts
      ADD CONSTRAINT fk_interior_contracts_quotation_approval
      FOREIGN KEY (tenant_id, quotation_customer_approval_id)
      REFERENCES public.interior_customer_approvals (tenant_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_interior_contracts_customer_approval'
      AND conrelid = 'public.interior_contracts'::REGCLASS
  ) THEN
    ALTER TABLE public.interior_contracts
      ADD CONSTRAINT fk_interior_contracts_customer_approval
      FOREIGN KEY (tenant_id, customer_approval_id)
      REFERENCES public.interior_customer_approvals (tenant_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE public.interior_contracts
  -- zero-downtime: allow validate-constraint - validate added composite quote approval FK
  VALIDATE CONSTRAINT fk_interior_contracts_quotation_approval;
ALTER TABLE public.interior_contracts
  -- zero-downtime: allow validate-constraint - validate added composite signature approval FK
  VALIDATE CONSTRAINT fk_interior_contracts_customer_approval;

COMMENT ON COLUMN public.interior_contracts.design_revision_id IS
  'Exact design revision inherited from the quoted, versioned BOQ; never resolve from latest.';
COMMENT ON COLUMN public.interior_contracts.design_version_number IS
  'Exact design version inherited from the quoted, versioned BOQ.';
COMMENT ON COLUMN public.interior_contracts.quotation_customer_approval_id IS
  'Customer evidence approving this exact quotation version.';
COMMENT ON COLUMN public.interior_contracts.customer_approval_id IS
  'Customer evidence signing this exact contract.';

CREATE OR REPLACE FUNCTION public.guard_interior_commercial_customer_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_quote public.interior_quotations%ROWTYPE;
  v_boq public.interior_boqs%ROWTYPE;
  v_design public.interior_design_revisions%ROWTYPE;
  v_status_changed BOOLEAN;
  v_contract_lineage_changed BOOLEAN;
  v_signature_evidence_changed BOOLEAN;
  v_signed_date_changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_status_changed := TRUE;
  ELSE
    v_status_changed := OLD.status IS DISTINCT FROM NEW.status;
  END IF;

  IF TG_TABLE_NAME = 'interior_quotations' THEN
    IF TG_OP = 'UPDATE' AND OLD.status IN ('sent_to_client', 'accepted', 'rejected') THEN
      IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
         OR NEW.project_id IS DISTINCT FROM OLD.project_id
         OR NEW.quotation_number IS DISTINCT FROM OLD.quotation_number
         OR NEW.version_number IS DISTINCT FROM OLD.version_number
         OR NEW.boq_id IS DISTINCT FROM OLD.boq_id
         OR NEW.boq_version_number IS DISTINCT FROM OLD.boq_version_number
         OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
         OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
         OR NEW.vat_percent IS DISTINCT FROM OLD.vat_percent
         OR NEW.vat_amount IS DISTINCT FROM OLD.vat_amount
         OR NEW.grand_total IS DISTINCT FROM OLD.grand_total
         OR NEW.total_internal_cogs IS DISTINCT FROM OLD.total_internal_cogs
         OR NEW.total_gross_margin IS DISTINCT FROM OLD.total_gross_margin
         OR NEW.gross_margin_percent IS DISTINCT FROM OLD.gross_margin_percent
         OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
         OR NEW.validity_days IS DISTINCT FROM OLD.validity_days
         OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
         OR NEW.forked_from_quotation_id IS DISTINCT FROM OLD.forked_from_quotation_id THEN
        RAISE EXCEPTION 'INTERIOR_QUOTATION_SNAPSHOT_IMMUTABLE';
      END IF;
      IF OLD.status = 'accepted' AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'INTERIOR_ACCEPTED_QUOTATION_STATUS_IMMUTABLE';
      END IF;
    END IF;
    IF NEW.status = 'accepted' AND v_status_changed THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.interior_customer_approvals a
        WHERE a.tenant_id = NEW.tenant_id
          AND a.subject_type = 'quotation'
          AND a.subject_id = NEW.id
          AND a.subject_version_number = NEW.version_number
          AND a.status = 'approved'
          AND a.approved_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'INTERIOR_QUOTATION_APPROVAL_EVIDENCE_REQUIRED';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Existing signed contracts predate this lineage extension. Preserve them on
  -- unrelated edits, but require complete exact lineage on every new contract,
  -- source-lineage change, or transition into signed.
  IF TG_OP = 'UPDATE' AND OLD.status IN ('in_review', 'rejected') AND (
       NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
       OR NEW.quotation_version_number IS DISTINCT FROM OLD.quotation_version_number
       OR NEW.boq_id IS DISTINCT FROM OLD.boq_id
       OR NEW.boq_version_number IS DISTINCT FROM OLD.boq_version_number
       OR NEW.design_revision_id IS DISTINCT FROM OLD.design_revision_id
       OR NEW.design_version_number IS DISTINCT FROM OLD.design_version_number
       OR NEW.quotation_customer_approval_id IS DISTINCT FROM OLD.quotation_customer_approval_id
       OR NEW.contract_number IS DISTINCT FROM OLD.contract_number
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.baseline_contract_value IS DISTINCT FROM OLD.baseline_contract_value
       OR NEW.current_contract_value IS DISTINCT FROM OLD.current_contract_value
       OR NEW.client_representative IS DISTINCT FROM OLD.client_representative
       OR NEW.contractor_representative IS DISTINCT FROM OLD.contractor_representative
       OR NEW.quotation_number IS DISTINCT FROM OLD.quotation_number
       OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
       OR NEW.execution_start_date IS DISTINCT FROM OLD.execution_start_date
       OR NEW.execution_end_date IS DISTINCT FROM OLD.execution_end_date
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR (OLD.status = 'rejected' AND NEW.status IS DISTINCT FROM OLD.status)
       OR (OLD.status = 'in_review' AND NEW.status NOT IN ('in_review', 'signed', 'rejected'))
       OR (NEW.status <> 'signed'
           AND NEW.customer_approval_id IS DISTINCT FROM OLD.customer_approval_id)
     ) THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_IMMUTABLE_DURING_CUSTOMER_REVIEW';
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_contract_lineage_changed := TRUE;
    v_signature_evidence_changed := TRUE;
    v_signed_date_changed := TRUE;
  ELSE
    IF OLD.status IN ('signed', 'active', 'completed', 'terminated')
       AND (
         NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
         OR NEW.quotation_version_number IS DISTINCT FROM OLD.quotation_version_number
         OR NEW.boq_id IS DISTINCT FROM OLD.boq_id
         OR NEW.boq_version_number IS DISTINCT FROM OLD.boq_version_number
         OR NEW.design_revision_id IS DISTINCT FROM OLD.design_revision_id
         OR NEW.design_version_number IS DISTINCT FROM OLD.design_version_number
         OR NEW.quotation_customer_approval_id IS DISTINCT FROM OLD.quotation_customer_approval_id
         OR NEW.customer_approval_id IS DISTINCT FROM OLD.customer_approval_id
       ) THEN
      RAISE EXCEPTION 'INTERIOR_SIGNED_CONTRACT_LINEAGE_IMMUTABLE';
    END IF;
    v_contract_lineage_changed :=
      NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
      OR NEW.boq_id IS DISTINCT FROM OLD.boq_id
      OR NEW.boq_version_number IS DISTINCT FROM OLD.boq_version_number
      OR NEW.design_revision_id IS DISTINCT FROM OLD.design_revision_id
      OR NEW.design_version_number IS DISTINCT FROM OLD.design_version_number
      OR NEW.baseline_contract_value IS DISTINCT FROM OLD.baseline_contract_value
      OR NEW.quotation_customer_approval_id IS DISTINCT FROM OLD.quotation_customer_approval_id;
    v_signature_evidence_changed := NEW.customer_approval_id IS DISTINCT FROM OLD.customer_approval_id;
    v_signed_date_changed := NEW.signed_date IS DISTINCT FROM OLD.signed_date;
  END IF;

  IF v_contract_lineage_changed OR (NEW.status = 'signed' AND v_status_changed) THEN
    SELECT * INTO v_quote
    FROM public.interior_quotations q
    WHERE q.tenant_id = NEW.tenant_id AND q.id = NEW.quotation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_QUOTATION_NOT_FOUND';
    END IF;
    IF NEW.baseline_contract_value IS DISTINCT FROM v_quote.grand_total THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_BASELINE_MUST_MATCH_ACCEPTED_QUOTATION';
    END IF;

  SELECT * INTO v_boq
  FROM public.interior_boqs b
  WHERE b.tenant_id = NEW.tenant_id AND b.id = v_quote.boq_id;
  IF NOT FOUND
     OR NEW.boq_id IS DISTINCT FROM v_boq.id
     OR NEW.boq_version_number IS DISTINCT FROM v_boq.version_number
     OR NEW.design_revision_id IS DISTINCT FROM v_boq.design_revision_id THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_LINEAGE_MISMATCH';
  END IF;

  SELECT * INTO v_design
  FROM public.interior_design_revisions d
  WHERE d.tenant_id = NEW.tenant_id AND d.id = v_boq.design_revision_id;
  IF NOT FOUND OR NEW.design_version_number IS DISTINCT FROM v_design.version_number THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_DESIGN_LINEAGE_MISMATCH';
  END IF;

  IF NEW.quotation_customer_approval_id IS NOT NULL THEN
    SELECT * INTO v_approval
    FROM public.interior_customer_approvals a
    WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.quotation_customer_approval_id;
    IF NOT FOUND
       OR v_approval.subject_type <> 'quotation'
       OR v_approval.subject_id <> v_quote.id
       OR v_approval.subject_version_number <> v_quote.version_number
       OR v_approval.status <> 'approved'
       OR v_approval.approved_at IS NULL THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_APPROVAL_EVIDENCE_MISMATCH';
    END IF;
  ELSE
    RAISE EXCEPTION 'INTERIOR_QUOTATION_APPROVAL_EVIDENCE_REQUIRED';
  END IF;
  END IF;

  IF NEW.status = 'signed' AND (v_status_changed OR v_signature_evidence_changed) THEN
    IF NEW.customer_approval_id IS NULL THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_EVIDENCE_REQUIRED';
    END IF;
    SELECT * INTO v_approval
    FROM public.interior_customer_approvals a
    WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.customer_approval_id;
    IF NOT FOUND
       OR v_approval.subject_type <> 'contract'
       OR v_approval.subject_id <> NEW.id
       OR v_approval.project_id <> NEW.project_id
       OR v_approval.status <> 'approved'
       OR v_approval.approved_at IS NULL
       OR v_approval.signature_sha256_hash !~ '^[0-9a-fA-F]{64}$' THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_EVIDENCE_INVALID';
    END IF;
    NEW.signed_date := v_approval.approved_at;
  ELSIF NEW.status <> 'signed' AND NEW.signed_date IS NOT NULL
        AND (v_status_changed OR v_signed_date_changed) THEN
    RAISE EXCEPTION 'INTERIOR_UNSIGNED_CONTRACT_CANNOT_HAVE_SIGNED_DATE';
  END IF;

  RETURN NEW;
END;
$$;

-- Customer approval is a bearer-link workflow. Contract signature files stay
-- private and are uploaded only by the server after it validates the token.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interior-customer-signatures',
  'interior-customer-signatures',
  FALSE,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'interior_customer_signatures_no_client_access'
  ) THEN
    CREATE POLICY interior_customer_signatures_no_client_access
      ON storage.objects AS RESTRICTIVE
      FOR ALL TO anon, authenticated
      USING (bucket_id <> 'interior-customer-signatures')
      WITH CHECK (bucket_id <> 'interior-customer-signatures');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.interior_read_public_customer_approval(
  p_approval_id UUID,
  p_approval_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
  WHERE a.id = p_approval_id AND a.approval_token = p_approval_token;
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
$$;
REVOKE ALL ON FUNCTION public.interior_read_public_customer_approval(UUID, UUID)
  FROM PUBLIC, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_public_customer_approval(UUID, UUID)
  TO anon;

CREATE OR REPLACE FUNCTION public.interior_transition_public_customer_approval(
  p_approval_id UUID,
  p_approval_token UUID,
  p_target_status public.interior_approval_status,
  p_rejection_reason TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_signature_storage_path TEXT DEFAULT NULL,
  p_signature_mime_type TEXT DEFAULT NULL,
  p_signature_file_size_bytes BIGINT DEFAULT NULL,
  p_signature_sha256_hash TEXT DEFAULT NULL,
  p_signature_uploaded_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_storage_size BIGINT;
  v_storage_mime TEXT;
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'service_role')
     OR p_approval_id IS NULL OR p_approval_token IS NULL
     OR p_target_status IS NULL OR p_target_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'AuthorizationViolation: valid customer approval capability is required';
  END IF;
  IF p_customer_notes IS NOT NULL AND length(p_customer_notes) > 2000 THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_CUSTOMER_NOTES_TOO_LONG';
  END IF;
  IF p_target_status = 'rejected'
     AND NULLIF(btrim(p_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_REJECTION_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_approval
  FROM public.interior_customer_approvals a
  WHERE a.id = p_approval_id AND a.approval_token = p_approval_token
    AND a.status = 'pending' AND a.expires_at > v_now
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_approval.subject_type = 'contract' AND p_target_status = 'approved' THEN
    IF auth.role() <> 'service_role'
       OR p_signature_storage_path IS NULL
       OR p_signature_storage_path !~ ('^' || v_approval.tenant_id::TEXT || '/' || v_approval.id::TEXT || '/[0-9a-f-]{36}\.(pdf|jpg|png)$')
       OR p_signature_mime_type IS NULL
       OR p_signature_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
       OR p_signature_file_size_bytes IS NULL OR p_signature_file_size_bytes <= 0
       OR p_signature_file_size_bytes > 5242880
       OR p_signature_sha256_hash IS NULL
       OR p_signature_sha256_hash !~ '^[0-9a-fA-F]{64}$'
       OR p_signature_uploaded_at IS NULL
       OR p_signature_uploaded_at > v_now + INTERVAL '1 minute'
       OR p_signature_uploaded_at < v_now - INTERVAL '10 minutes' THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_EVIDENCE_INVALID';
    END IF;

    SELECT (o.metadata ->> 'size')::BIGINT, o.metadata ->> 'mimetype'
      INTO v_storage_size, v_storage_mime
    FROM storage.objects o
    WHERE o.bucket_id = 'interior-customer-signatures'
      AND o.name = p_signature_storage_path;
    IF NOT FOUND OR v_storage_size IS DISTINCT FROM p_signature_file_size_bytes
       OR v_storage_mime IS DISTINCT FROM p_signature_mime_type THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_OBJECT_NOT_FOUND';
    END IF;
  ELSIF p_signature_storage_path IS NOT NULL OR p_signature_mime_type IS NOT NULL
     OR p_signature_file_size_bytes IS NOT NULL OR p_signature_sha256_hash IS NOT NULL
     OR p_signature_uploaded_at IS NOT NULL THEN
    RAISE EXCEPTION 'INTERIOR_SIGNATURE_NOT_ALLOWED_FOR_THIS_DECISION';
  END IF;

  UPDATE public.interior_customer_approvals a
  SET status = p_target_status,
      approved_at = CASE WHEN p_target_status = 'approved' THEN v_now ELSE NULL END,
      rejected_at = CASE WHEN p_target_status = 'rejected' THEN v_now ELSE NULL END,
      rejection_reason = CASE WHEN p_target_status = 'rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      customer_notes = NULLIF(btrim(p_customer_notes), ''),
      signature_storage_path = p_signature_storage_path,
      signature_storage_url = NULL,
      signature_mime_type = p_signature_mime_type,
      signature_file_size_bytes = p_signature_file_size_bytes,
      signature_sha256_hash = p_signature_sha256_hash,
      signature_uploaded_at = p_signature_uploaded_at,
      updated_at = v_now
  WHERE a.tenant_id = v_approval.tenant_id AND a.id = v_approval.id
    AND a.status = 'pending' AND a.expires_at > v_now;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_transition_public_customer_approval(
  UUID, UUID, public.interior_approval_status, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_transition_public_customer_approval(
  UUID, UUID, public.interior_approval_status, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ
) TO anon, service_role;

CREATE OR REPLACE FUNCTION public.guard_interior_customer_approval_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'pending'
     OR NEW.approved_at IS NOT NULL
     OR NEW.rejected_at IS NOT NULL
     OR NEW.signature_storage_path IS NOT NULL
     OR NEW.signature_sha256_hash IS NOT NULL THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_MUST_START_PENDING';
  END IF;
  IF NOT public.interior_has_permission(
    'interior:contract:write', NEW.tenant_id, NEW.project_id, NULL
  ) THEN
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_interior_customer_approval_insert
  ON public.interior_customer_approvals;
CREATE TRIGGER trg_guard_interior_customer_approval_insert
  BEFORE INSERT ON public.interior_customer_approvals
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_customer_approval_insert();
REVOKE ALL ON FUNCTION public.guard_interior_customer_approval_insert()
  FROM PUBLIC, anon, authenticated, service_role;

-- Addenda currently have no customer-bound approval subject or atomic
-- approval-to-current-value transition. Keep them readable but deny direct
-- client-role writes instead of letting an internal status default imply consent.
REVOKE INSERT, UPDATE, DELETE ON public.interior_contract_addenda FROM anon, authenticated;

-- Approval rows are insertable/readable under existing tenant RLS, but only
-- these token-bearing transitions may change an existing row.
REVOKE UPDATE ON public.interior_customer_approvals FROM anon, authenticated;
REVOKE DELETE ON public.interior_customer_approvals FROM anon, authenticated;
REVOKE SELECT ON public.interior_customer_approvals FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, project_id, subject_type, subject_id, subject_version_number, status,
  client_representative, client_contact, sent_at, expires_at, approved_at, rejected_at,
  rejection_reason, customer_notes, signature_storage_path, signature_storage_url,
  signature_mime_type, signature_file_size_bytes, signature_sha256_hash, signature_uploaded_at,
  sent_by_actor_id, sent_by_actor_name, created_at, updated_at
) ON public.interior_customer_approvals TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_customer_approval_by_token(
  p_tenant_id UUID,
  p_approval_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_approval public.interior_customer_approvals%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: active tenant does not match approval tenant';
  END IF;
  SELECT * INTO v_approval FROM public.interior_customer_approvals a
  WHERE a.tenant_id = p_tenant_id AND a.approval_token = p_approval_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF NOT public.interior_has_permission(
    'interior:contract:write', p_tenant_id, v_approval.project_id, NULL
  ) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract write permission is required';
  END IF;
  -- The caller already supplied this capability token. Return only fields the
  -- transition service needs; never expose stored signature metadata or a full
  -- approval row through a token lookup RPC.
  RETURN jsonb_build_object(
    'id', v_approval.id,
    'tenant_id', v_approval.tenant_id,
    'project_id', v_approval.project_id,
    'subject_type', v_approval.subject_type,
    'subject_id', v_approval.subject_id,
    'subject_version_number', v_approval.subject_version_number,
    'approval_token', p_approval_token,
    'status', v_approval.status,
    'client_representative', v_approval.client_representative,
    'sent_at', v_approval.sent_at,
    'expires_at', v_approval.expires_at,
    'approved_at', v_approval.approved_at,
    'rejected_at', v_approval.rejected_at,
    'rejection_reason', v_approval.rejection_reason,
    'customer_notes', v_approval.customer_notes,
    'sent_by_actor_id', v_approval.sent_by_actor_id,
    'sent_by_actor_name', v_approval.sent_by_actor_name,
    'created_at', v_approval.created_at,
    'updated_at', v_approval.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_customer_approval_by_token(UUID, UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_customer_approval_by_token(UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_create_customer_approval_request(p_approval JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_subject_type TEXT;
  v_subject_id UUID;
  v_project_id UUID;
  v_subject_version INTEGER;
  v_sent_at TIMESTAMPTZ;
  v_actor_name TEXT;
BEGIN
  IF v_tenant_id IS NULL OR v_actor_id IS NULL OR jsonb_typeof(p_approval) IS DISTINCT FROM 'object'
     OR (p_approval ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR (p_approval ->> 'sent_by_actor_id') IS DISTINCT FROM v_actor_id::TEXT THEN
    RAISE EXCEPTION 'AuthorizationViolation: approval actor and tenant must match the authenticated session';
  END IF;
  v_subject_type := p_approval ->> 'subject_type';
  v_subject_id := (p_approval ->> 'subject_id')::UUID;
  v_project_id := (p_approval ->> 'project_id')::UUID;
  v_subject_version := (p_approval ->> 'subject_version_number')::INTEGER;
  v_sent_at := (p_approval ->> 'sent_at')::TIMESTAMPTZ;
  IF p_approval ->> 'status' IS DISTINCT FROM 'pending'
     OR v_subject_type NOT IN ('quotation', 'contract')
     OR v_subject_version < 1
     OR NULLIF(btrim(p_approval ->> 'client_representative'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'client_contact'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'sent_by_actor_name'), '') IS NULL
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ <= clock_timestamp()
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ > clock_timestamp() + INTERVAL '365 days' THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_REQUEST_INVALID';
  END IF;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id AND actor.tenant_id = v_tenant_id;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL
     OR length(btrim(v_actor_name)) > 200 THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract write permission is required';
  END IF;

  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = 'Superseded by a newer approval request', updated_at = clock_timestamp()
  WHERE a.tenant_id = v_tenant_id AND a.subject_type = v_subject_type
    AND a.subject_id = v_subject_id AND a.status = 'pending';

  IF v_subject_type = 'quotation' THEN
    UPDATE public.interior_quotations q
    SET status = CASE WHEN q.status = 'draft' THEN 'sent_to_client' ELSE q.status END,
        sent_to_client_at = COALESCE(q.sent_to_client_at, v_sent_at),
        latest_approval_status = 'pending', latest_approval_sent_at = v_sent_at,
        latest_approved_at = NULL, latest_rejected_at = NULL
    WHERE q.tenant_id = v_tenant_id AND q.project_id = v_project_id
      AND q.id = v_subject_id AND q.version_number = v_subject_version
      AND q.status IN ('draft', 'sent_to_client', 'negotiating');
  ELSE
    UPDATE public.interior_contracts c
    SET status = CASE WHEN c.status = 'draft' THEN 'in_review' ELSE c.status END,
        updated_at = v_sent_at
    WHERE c.tenant_id = v_tenant_id AND c.project_id = v_project_id
      AND c.id = v_subject_id AND c.status IN ('draft', 'in_review');
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_APPROVAL_SUBJECT_STALE'; END IF;

  INSERT INTO public.interior_customer_approvals (
    id, tenant_id, project_id, subject_type, subject_id, subject_version_number,
    approval_token, status, client_representative, client_contact, sent_at, expires_at,
    sent_by_actor_id, sent_by_actor_name, created_at, updated_at
  ) VALUES (
    (p_approval ->> 'id')::UUID, v_tenant_id, v_project_id, v_subject_type,
    v_subject_id, v_subject_version, (p_approval ->> 'approval_token')::UUID,
    'pending', btrim(p_approval ->> 'client_representative'), btrim(p_approval ->> 'client_contact'),
    v_sent_at, (p_approval ->> 'expires_at')::TIMESTAMPTZ,
    v_actor_id::TEXT, btrim(v_actor_name),
    (p_approval ->> 'created_at')::TIMESTAMPTZ, (p_approval ->> 'updated_at')::TIMESTAMPTZ
  ) RETURNING * INTO v_approval;
  RETURN to_jsonb(v_approval);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_customer_approval(p_approval_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_approval public.interior_customer_approvals%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor is required';
  END IF;
  SELECT * INTO v_approval FROM public.interior_customer_approvals a
  WHERE a.tenant_id = v_tenant_id AND a.id = p_approval_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant_id, v_approval.project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_approval.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped approval read is required';
  END IF;
  RETURN to_jsonb(v_approval) - 'approval_token';
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_customer_approval(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_customer_approval(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_customer_approvals(p_subject_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_result JSONB;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_subject_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and subject are required';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(a) - 'approval_token' ORDER BY a.sent_at, a.id), '[]'::JSONB)
    INTO v_result
  FROM public.interior_customer_approvals a
  WHERE a.tenant_id = v_tenant_id AND a.subject_id = p_subject_id
    AND (public.interior_has_permission('interior:contract:read', v_tenant_id, a.project_id, NULL)
      OR public.interior_has_permission('interior:contract:create', v_tenant_id, a.project_id, NULL));
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_customer_approvals(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_customer_approvals(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_transition_customer_approval(
  p_tenant_id UUID,
  p_approval_id UUID,
  p_approval_token UUID,
  p_target_status public.interior_approval_status,
  p_rejection_reason TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_signature_storage_path TEXT DEFAULT NULL,
  p_signature_storage_url TEXT DEFAULT NULL,
  p_signature_mime_type TEXT DEFAULT NULL,
  p_signature_file_size_bytes BIGINT DEFAULT NULL,
  p_signature_sha256_hash TEXT DEFAULT NULL,
  p_signature_uploaded_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_target_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_TRANSITION_INVALID';
  END IF;
  IF p_tenant_id IS NULL OR public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: active tenant does not match approval tenant';
  END IF;
  IF p_target_status = 'approved' AND EXISTS (
    SELECT 1 FROM public.interior_customer_approvals a
    WHERE a.tenant_id = p_tenant_id AND a.id = p_approval_id
      AND a.approval_token = p_approval_token AND a.subject_type = 'contract'
  ) THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_REQUIRES_VERIFIED_PRIVATE_UPLOAD';
  END IF;

  UPDATE public.interior_customer_approvals a
  SET status = p_target_status,
      approved_at = CASE WHEN p_target_status = 'approved' THEN v_now ELSE NULL END,
      rejected_at = CASE WHEN p_target_status = 'rejected' THEN v_now ELSE NULL END,
      rejection_reason = CASE WHEN p_target_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
      customer_notes = p_customer_notes,
      signature_storage_path = p_signature_storage_path,
      signature_storage_url = p_signature_storage_url,
      signature_mime_type = p_signature_mime_type,
      signature_file_size_bytes = p_signature_file_size_bytes,
      signature_sha256_hash = p_signature_sha256_hash,
      signature_uploaded_at = p_signature_uploaded_at,
      updated_at = v_now
  WHERE a.tenant_id = p_tenant_id
    AND a.id = p_approval_id
    AND a.approval_token = p_approval_token
    AND a.status = 'pending'
    AND a.sent_by_actor_id <> auth.uid()::TEXT
    AND a.expires_at > v_now;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_transition_customer_approval(
  UUID, UUID, UUID, public.interior_approval_status, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_transition_customer_approval(
  UUID, UUID, UUID, public.interior_approval_status, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TIMESTAMPTZ
) TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_supersede_pending_customer_approvals(
  p_tenant_id UUID,
  p_subject_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_tenant_id IS NULL OR public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: active tenant does not match approval tenant';
  END IF;
  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = p_reason, updated_at = clock_timestamp()
  WHERE a.tenant_id = p_tenant_id
    AND a.subject_id = p_subject_id
    AND a.status = 'pending'
    AND public.interior_has_permission('interior:contract:write', p_tenant_id, a.project_id, NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_supersede_pending_customer_approvals(UUID, UUID, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_supersede_pending_customer_approvals(UUID, UUID, TEXT)
  TO authenticated;

DROP TRIGGER IF EXISTS trg_guard_interior_quotation_customer_evidence ON public.interior_quotations;
CREATE TRIGGER trg_guard_interior_quotation_customer_evidence
  BEFORE INSERT OR UPDATE ON public.interior_quotations
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_commercial_customer_evidence();

DROP TRIGGER IF EXISTS trg_guard_interior_contract_customer_evidence ON public.interior_contracts;
CREATE TRIGGER trg_guard_interior_contract_customer_evidence
  BEFORE INSERT OR UPDATE ON public.interior_contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_commercial_customer_evidence();

REVOKE ALL ON FUNCTION public.guard_interior_commercial_customer_evidence() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_interior_quotation_items_after_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_quote_id UUID;
  v_tenant_id UUID;
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quote_id := OLD.quotation_id;
    v_tenant_id := OLD.tenant_id;
  ELSE
    v_quote_id := NEW.quotation_id;
    v_tenant_id := NEW.tenant_id;
  END IF;
  SELECT q.status INTO v_status
  FROM public.interior_quotations q
  WHERE q.tenant_id = v_tenant_id AND q.id = v_quote_id;
  IF v_status IN ('sent_to_client', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_ITEMS_IMMUTABLE_AFTER_CUSTOMER_DISPATCH';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_interior_quotation_items_after_dispatch()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_guard_interior_quotation_items_after_dispatch
  ON public.interior_quotation_items;
CREATE TRIGGER trg_guard_interior_quotation_items_after_dispatch
  BEFORE INSERT OR UPDATE OR DELETE ON public.interior_quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_quotation_items_after_dispatch();

-- The guarded token transition and its commercial state change share one
-- PostgreSQL transaction. No application-side second write can leave a token
-- consumed while its quotation or contract remains in the previous state.
CREATE OR REPLACE FUNCTION public.advance_interior_commercial_after_customer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_affected INTEGER;
  v_contract_number TEXT;
  v_milestone public.interior_payment_milestones%ROWTYPE;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.subject_type = 'quotation' THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.interior_quotations q
      SET status = 'accepted', accepted_at = NEW.approved_at,
          latest_approval_status = 'approved', latest_approved_at = NEW.approved_at
      WHERE q.tenant_id = NEW.tenant_id
        AND q.id = NEW.subject_id
        AND q.project_id = NEW.project_id
        AND q.version_number = NEW.subject_version_number
        AND q.status IN ('sent_to_client', 'negotiating');
    ELSE
      UPDATE public.interior_quotations q
      SET status = 'rejected', rejected_at = NEW.rejected_at,
          rejection_reason = NEW.rejection_reason,
          latest_approval_status = 'rejected', latest_rejected_at = NEW.rejected_at
      WHERE q.tenant_id = NEW.tenant_id
        AND q.id = NEW.subject_id
        AND q.project_id = NEW.project_id
        AND q.version_number = NEW.subject_version_number
        AND q.status IN ('sent_to_client', 'negotiating');
    END IF;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_APPROVAL_SUBJECT_STALE';
    END IF;
    RETURN NEW;
  ELSIF NEW.subject_type = 'contract' THEN
    IF NEW.status = 'rejected' THEN
      UPDATE public.interior_contracts c
      SET status = 'rejected', updated_at = NEW.rejected_at
      WHERE c.tenant_id = NEW.tenant_id AND c.project_id = NEW.project_id
        AND c.id = NEW.subject_id AND c.status IN ('draft', 'in_review');
      GET DIAGNOSTICS v_affected = ROW_COUNT;
      IF v_affected <> 1 THEN
        RAISE EXCEPTION 'INTERIOR_CONTRACT_APPROVAL_SUBJECT_STALE';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
    IF NEW.signature_storage_path IS NULL OR btrim(NEW.signature_storage_path) = ''
       OR NEW.signature_file_size_bytes IS NULL OR NEW.signature_file_size_bytes <= 0
       OR NEW.signature_sha256_hash !~ '^[0-9a-fA-F]{64}$'
       OR NEW.signature_uploaded_at IS NULL THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_SIGNATURE_EVIDENCE_INVALID';
    END IF;

    UPDATE public.interior_contracts c
    SET status = 'signed', signed_date = NEW.approved_at,
        customer_approval_id = NEW.id
    WHERE c.tenant_id = NEW.tenant_id
      AND c.project_id = NEW.project_id
      AND c.id = NEW.subject_id
      AND c.status IN ('draft', 'in_review')
      AND c.quotation_customer_approval_id IS NOT NULL;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'INTERIOR_CONTRACT_APPROVAL_SUBJECT_STALE';
    END IF;

    UPDATE public.interior_projects p
    SET status = 'contracted', updated_at = NEW.approved_at
    WHERE p.tenant_id = NEW.tenant_id AND p.id = NEW.project_id;

    SELECT c.contract_number INTO v_contract_number
    FROM public.interior_contracts c
    WHERE c.tenant_id = NEW.tenant_id AND c.id = NEW.subject_id;
    SELECT m.* INTO v_milestone
    FROM public.interior_payment_milestones m
    WHERE m.tenant_id = NEW.tenant_id AND m.contract_id = NEW.subject_id
    ORDER BY m.milestone_order
    LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.interior_finance_outbox (
        tenant_id, event_type, reference_type, reference_id, payload
      ) VALUES (
        NEW.tenant_id,
        'INTERIOR_CONTRACT_MILESTONE_INVOICED',
        'PAYMENT_MILESTONE',
        NEW.subject_id::TEXT || '_m' || v_milestone.milestone_order::TEXT,
        jsonb_build_object(
          'tenantId', NEW.tenant_id,
          'projectId', NEW.project_id,
          'contractId', NEW.subject_id,
          'milestoneOrder', v_milestone.milestone_order,
          'milestoneName', v_milestone.name,
          'amount', v_milestone.amount,
          'currency', 'VND',
          'clientName', NEW.client_representative,
          'occurredAt', NEW.approved_at,
          'contractNumber', v_contract_number
        )
      ) ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_interior_commercial_after_customer_approval
  ON public.interior_customer_approvals;
CREATE TRIGGER trg_advance_interior_commercial_after_customer_approval
  AFTER UPDATE OF status ON public.interior_customer_approvals
  FOR EACH ROW EXECUTE FUNCTION public.advance_interior_commercial_after_customer_approval();

REVOKE ALL ON FUNCTION public.advance_interior_commercial_after_customer_approval()
  FROM PUBLIC, anon, authenticated, service_role;

-- Payment receipts are append-only and their aggregate must advance in the
-- same database transaction. Do not rely on a second application request to
-- recompute a milestone after the receipt has already committed.
DROP POLICY IF EXISTS tenant_isolation_interior_payment_transactions
  ON public.interior_payment_transactions;
CREATE POLICY interior_payment_transactions_finance_read
  ON public.interior_payment_transactions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.interior_actor_tenant()
    AND EXISTS (
      SELECT 1
      FROM public.interior_contracts c
      WHERE c.tenant_id = interior_payment_transactions.tenant_id
        AND c.id = interior_payment_transactions.contract_id
        AND public.interior_has_permission(
          'interior:finance:read', c.tenant_id, c.project_id, NULL
        )
    )
  );
CREATE POLICY interior_payment_transactions_record
  ON public.interior_payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.interior_actor_tenant()
    AND EXISTS (
      SELECT 1
      FROM public.interior_contracts c
      WHERE c.tenant_id = interior_payment_transactions.tenant_id
        AND c.id = interior_payment_transactions.contract_id
        AND public.interior_has_permission(
          'interior:payment:record', c.tenant_id, c.project_id, NULL
        )
    )
  );
REVOKE ALL ON public.interior_payment_transactions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.interior_payment_transactions TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.interior_payment_transactions
    GROUP BY tenant_id, contract_id, lower(btrim(reference_code))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_REFERENCE_NORMALIZATION_COLLISION: resolve duplicate historical references before enabling uniqueness';
  END IF;
END $$;
-- zero-downtime: allow blocking-index - enforce case-insensitive payment reference uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_payment_tx_reference_normalized
  ON public.interior_payment_transactions (
    tenant_id, contract_id, lower(btrim(reference_code))
  );

CREATE OR REPLACE FUNCTION public.guard_interior_payment_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
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
  IF v_collected_amount + NEW.amount > v_milestone_amount THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE';
  END IF;

  NEW.reference_code := btrim(NEW.reference_code);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_interior_payment_transaction_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reconcile_interior_payment_milestone_after_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id UUID;
  v_collected_amount NUMERIC(15, 2);
  v_milestone_status TEXT;
BEGIN
  SELECT c.project_id INTO v_project_id
  FROM public.interior_contracts c
  WHERE c.tenant_id = NEW.tenant_id
    AND c.id = NEW.contract_id
    AND c.status IN ('signed', 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_MILESTONE_OR_SIGNED_CONTRACT_REQUIRED';
  END IF;
  IF auth.uid() IS NULL
     OR public.interior_actor_tenant() IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated payment tenant is required';
  END IF;
  IF NOT public.interior_has_permission('interior:payment:record', NEW.tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated payment permission and signed contract are required';
  END IF;

  UPDATE public.interior_payment_milestones m
  SET collected_amount = COALESCE(m.collected_amount, 0) + NEW.amount,
      status = CASE
        WHEN COALESCE(m.collected_amount, 0) + NEW.amount >= m.amount THEN 'paid'
        ELSE m.status
      END,
      paid_at = CASE
        WHEN COALESCE(m.collected_amount, 0) + NEW.amount >= m.amount THEN clock_timestamp()
        ELSE m.paid_at
      END
  WHERE m.tenant_id = NEW.tenant_id
    AND m.id = NEW.milestone_id
    AND m.contract_id = NEW.contract_id
  RETURNING m.collected_amount, m.status INTO v_collected_amount, v_milestone_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_MILESTONE_RECONCILIATION_FAILED';
  END IF;

  INSERT INTO public.interior_finance_outbox (
    tenant_id, event_type, reference_type, reference_id, payload
  ) VALUES (
    NEW.tenant_id,
    'INTERIOR_PAYMENT_TRANSACTION_RECORDED',
    'PAYMENT_TRANSACTION',
    NEW.id::TEXT,
    jsonb_build_object(
      'tenantId', NEW.tenant_id,
      'projectId', v_project_id,
      'contractId', NEW.contract_id,
      'milestoneId', NEW.milestone_id,
      'amount', NEW.amount,
      'currency', 'VND',
      'paymentMethod', NEW.payment_method,
      'referenceCode', NEW.reference_code,
      'transactionDate', NEW.transaction_date,
      'recordedBy', NEW.recorded_by,
      'collectedAmount', v_collected_amount,
      'milestoneStatus', v_milestone_status
    )
  ) ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_interior_payment_milestone_after_receipt()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_interior_payment_transaction_insert
  ON public.interior_payment_transactions;
CREATE TRIGGER trg_guard_interior_payment_transaction_insert
  BEFORE INSERT ON public.interior_payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_payment_transaction_insert();
DROP TRIGGER IF EXISTS trg_reconcile_interior_payment_milestone_after_receipt
  ON public.interior_payment_transactions;
CREATE TRIGGER trg_reconcile_interior_payment_milestone_after_receipt
  AFTER INSERT ON public.interior_payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_interior_payment_milestone_after_receipt();

-- Reconcile any receipts that predate this transactional trigger before it is
-- enabled, preserving exact cent values and completed milestone state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT tenant_id, milestone_id, SUM(amount)::NUMERIC(15, 2) AS collected_amount
      FROM public.interior_payment_transactions
      GROUP BY tenant_id, milestone_id
    ) totals
    JOIN public.interior_payment_milestones m
      ON m.tenant_id = totals.tenant_id AND m.id = totals.milestone_id
    WHERE totals.collected_amount > m.amount
  ) THEN
    RAISE EXCEPTION 'INTERIOR_PAYMENT_BALANCE_RECONCILIATION_REQUIRED: historical receipts exceed a milestone amount';
  END IF;
END $$;
WITH payment_totals AS (
  SELECT tenant_id, milestone_id, SUM(amount)::NUMERIC(15, 2) AS collected_amount
  FROM public.interior_payment_transactions
  GROUP BY tenant_id, milestone_id
)
UPDATE public.interior_payment_milestones m
SET collected_amount = totals.collected_amount,
    status = CASE WHEN totals.collected_amount >= m.amount THEN 'paid' ELSE m.status END,
    paid_at = CASE WHEN totals.collected_amount >= m.amount THEN COALESCE(m.paid_at, clock_timestamp()) ELSE m.paid_at END
FROM payment_totals totals
WHERE m.tenant_id = totals.tenant_id AND m.id = totals.milestone_id;

-- Contract header and its payment schedule are one creation unit. The
-- advisory lock makes retries/concurrent requests for the same quote serialize.
CREATE OR REPLACE FUNCTION public.interior_create_quotation_snapshot(
  p_quotation JSONB,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_quote_id UUID;
  v_project_id UUID;
  v_boq_id UUID;
  v_boq_version INTEGER;
  v_version INTEGER;
  v_parent_id UUID;
  v_boq_status TEXT;
  v_source_count INTEGER;
  v_input_count INTEGER;
  v_subtotal NUMERIC(15, 2);
  v_cogs NUMERIC(15, 2);
  v_discount NUMERIC(15, 2);
  v_vat_percent NUMERIC(4, 2);
  v_vat_amount NUMERIC(15, 2);
  v_grand_total NUMERIC(15, 2);
  v_gross_margin NUMERIC(15, 2);
  v_gross_margin_percent NUMERIC(5, 2);
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR jsonb_typeof(p_quotation) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor, quotation, and line snapshots are required';
  END IF;

  v_quote_id := (p_quotation ->> 'id')::UUID;
  v_project_id := (p_quotation ->> 'project_id')::UUID;
  v_boq_id := (p_quotation ->> 'boq_id')::UUID;
  v_boq_version := (p_quotation ->> 'boq_version_number')::INTEGER;
  v_version := (p_quotation ->> 'version_number')::INTEGER;
  v_parent_id := NULLIF(p_quotation ->> 'forked_from_quotation_id', '')::UUID;

  IF (p_quotation ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_project_id, NULL)
     OR NOT public.interior_has_permission('interior:finance:read', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: quotation tenant, create permission, or costing permission is invalid';
  END IF;
  IF p_quotation ->> 'status' IS DISTINCT FROM 'draft'
     OR v_version IS NULL OR v_version < 1
     OR NULLIF(btrim(p_quotation ->> 'quotation_number'), '') IS NULL
     OR length(p_quotation ->> 'quotation_number') > 120
     OR NULLIF(btrim(p_quotation ->> 'payment_terms'), '') IS NULL
     OR NULLIF(btrim(p_quotation ->> 'prepared_by'), '') IS NULL
     OR (p_quotation ->> 'validity_days')::INTEGER NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_DRAFT_TERMS_INVALID';
  END IF;

  PERFORM 1 FROM public.interior_projects p
  WHERE p.tenant_id = v_tenant_id AND p.id = v_project_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_QUOTATION_PROJECT_NOT_FOUND'; END IF;

  SELECT b.status INTO v_boq_status
  FROM public.interior_boqs b
  WHERE b.tenant_id = v_tenant_id AND b.id = v_boq_id
    AND b.project_id = v_project_id AND b.version_number = v_boq_version
  FOR SHARE;
  IF NOT FOUND OR v_boq_status NOT IN ('approved', 'locked_for_contract') THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_REQUIRES_EXACT_APPROVED_BOQ_VERSION';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT || ':' || v_boq_id::TEXT, 0));

  IF v_parent_id IS NULL THEN
    IF v_version <> 1 THEN RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_PARENT_REQUIRED'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.interior_quotations existing
      WHERE existing.tenant_id = v_tenant_id AND existing.boq_id = v_boq_id
        AND existing.forked_from_quotation_id IS NULL
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_ALREADY_EXISTS_FOR_BOQ';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.interior_quotations parent
      WHERE parent.tenant_id = v_tenant_id AND parent.id = v_parent_id
        AND parent.project_id = v_project_id AND parent.boq_id = v_boq_id
        AND parent.boq_version_number = v_boq_version
        AND parent.version_number + 1 = v_version
        AND parent.status IN ('draft', 'sent_to_client', 'negotiating', 'rejected')
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_PARENT_INVALID';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.interior_quotations sibling
      WHERE sibling.tenant_id = v_tenant_id AND sibling.forked_from_quotation_id = v_parent_id
    ) THEN
      RAISE EXCEPTION 'INTERIOR_QUOTATION_REVISION_ALREADY_EXISTS';
    END IF;
  END IF;

  SELECT count(*) INTO v_source_count
  FROM public.interior_boq_items b
  WHERE b.tenant_id = v_tenant_id AND b.boq_id = v_boq_id;
  SELECT count(*) INTO v_input_count FROM jsonb_array_elements(p_items);
  IF v_source_count = 0 OR v_input_count <> v_source_count THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINEAGE_ITEMS_INCOMPLETE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT value ->> 'boq_item_id' AS boq_item_id, count(*) AS n
      FROM jsonb_array_elements(p_items)
      GROUP BY value ->> 'boq_item_id'
    ) duplicates
    WHERE duplicates.boq_item_id IS NULL OR duplicates.n <> 1
  ) THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINEAGE_ITEMS_DUPLICATED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item(value)
    LEFT JOIN public.interior_boq_items source
      ON source.tenant_id = v_tenant_id
     AND source.boq_id = v_boq_id
     AND source.id = (item.value ->> 'boq_item_id')::UUID
    WHERE source.id IS NULL
       OR (item.value ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
       OR (item.value ->> 'quotation_id')::UUID IS DISTINCT FROM v_quote_id
       OR item.value ->> 'item_code' IS DISTINCT FROM source.item_code
       OR item.value ->> 'item_name' IS DISTINCT FROM source.item_name
       OR item.value ->> 'category' IS DISTINCT FROM source.category
       OR item.value ->> 'unit' IS DISTINCT FROM source.unit
       OR COALESCE(item.value ->> 'stable_component_id', '') IS DISTINCT FROM COALESCE(source.stable_component_id, '')
       OR (item.value ->> 'room_zone_name') IS DISTINCT FROM source.room_zone_name
       OR (item.value ->> 'quantity')::NUMERIC IS DISTINCT FROM source.quantity
       OR (item.value ->> 'internal_unit_cost')::NUMERIC IS DISTINCT FROM source.internal_unit_cost
       OR (item.value ->> 'internal_total_cost')::NUMERIC IS DISTINCT FROM round(source.internal_unit_cost * source.quantity)
       OR (item.value ->> 'client_unit_price')::NUMERIC < 0
       OR (item.value ->> 'client_total_price')::NUMERIC IS DISTINCT FROM
          round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
       OR (item.value ->> 'gross_margin_amount')::NUMERIC IS DISTINCT FROM
          round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
            - round(source.internal_unit_cost * source.quantity)
       OR (item.value ->> 'gross_margin_percent')::NUMERIC IS DISTINCT FROM
          CASE WHEN round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity) > 0
            THEN round(((
              round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)
              - round(source.internal_unit_cost * source.quantity)
            ) / round((item.value ->> 'client_unit_price')::NUMERIC * source.quantity)) * 1000) / 10
            ELSE 0 END
       OR (item.value ->> 'markup_percent')::NUMERIC IS DISTINCT FROM
          CASE WHEN source.internal_unit_cost > 0
            THEN round(((
              (item.value ->> 'client_unit_price')::NUMERIC - source.internal_unit_cost
            ) / source.internal_unit_cost) * 1000) / 10
            ELSE 0 END
       OR item.value ->> 'specifications' IS DISTINCT FROM COALESCE(
         NULLIF(concat_ws('; ',
           NULLIF(btrim(source.specifications_json ->> 'carcassMaterial'), ''),
           NULLIF(btrim(source.specifications_json ->> 'doorFrontMaterial'), ''),
           NULLIF(btrim(source.specifications_json ->> 'surfaceFinish'), ''),
           NULLIF(btrim(source.specifications_json ->> 'hardwareSpec'), ''),
           NULLIF(btrim(source.specifications_json ->> 'stoneOrGlassSpec'), '')
         ), ''),
         'Theo tiêu chuẩn hoàn thiện Bella'
       )
  ) THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_LINE_ITEM_MUST_MATCH_BOQ_SOURCE';
  END IF;

  SELECT COALESCE(sum((item.value ->> 'client_total_price')::NUMERIC), 0),
         COALESCE(sum((item.value ->> 'internal_total_cost')::NUMERIC), 0)
    INTO v_subtotal, v_cogs
  FROM jsonb_array_elements(p_items) item(value);
  v_discount := (p_quotation ->> 'discount_amount')::NUMERIC;
  v_vat_percent := (p_quotation ->> 'vat_percent')::NUMERIC;
  IF v_discount IS NULL OR v_discount < 0 OR v_discount > v_subtotal
     OR v_vat_percent IS NULL OR v_vat_percent < 0 OR v_vat_percent > 100 THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_FINANCIAL_TERMS_INVALID';
  END IF;
  v_vat_amount := round(((v_subtotal - v_discount) * v_vat_percent) / 100);
  v_grand_total := v_subtotal - v_discount + v_vat_amount;
  v_gross_margin := v_subtotal - v_discount - v_cogs;
  v_gross_margin_percent := CASE WHEN v_subtotal - v_discount > 0
    THEN round((v_gross_margin / (v_subtotal - v_discount)) * 1000) / 10
    ELSE 0 END;
  IF (p_quotation ->> 'subtotal')::NUMERIC IS DISTINCT FROM v_subtotal
     OR (p_quotation ->> 'total_internal_cogs')::NUMERIC IS DISTINCT FROM v_cogs
     OR (p_quotation ->> 'vat_amount')::NUMERIC IS DISTINCT FROM v_vat_amount
     OR (p_quotation ->> 'grand_total')::NUMERIC IS DISTINCT FROM v_grand_total
     OR (p_quotation ->> 'total_gross_margin')::NUMERIC IS DISTINCT FROM v_gross_margin
     OR (p_quotation ->> 'gross_margin_percent')::NUMERIC IS DISTINCT FROM v_gross_margin_percent THEN
    RAISE EXCEPTION 'INTERIOR_QUOTATION_TOTALS_DO_NOT_RECONCILE';
  END IF;

  INSERT INTO public.interior_quotations (
    id, tenant_id, project_id, boq_id, quotation_number, version_number, status,
    subtotal, discount_amount, vat_percent, vat_amount, grand_total, payment_terms,
    validity_days, boq_version_number, total_internal_cogs, total_gross_margin,
    gross_margin_percent, forked_from_quotation_id, prepared_by, created_at
  ) VALUES (
    v_quote_id, v_tenant_id, v_project_id, v_boq_id,
    p_quotation ->> 'quotation_number', v_version, 'draft',
    v_subtotal, v_discount, v_vat_percent, v_vat_amount, v_grand_total,
    p_quotation ->> 'payment_terms', (p_quotation ->> 'validity_days')::INTEGER,
    v_boq_version, v_cogs, v_gross_margin, v_gross_margin_percent,
    v_parent_id, p_quotation ->> 'prepared_by',
    COALESCE(NULLIF(p_quotation ->> 'created_at', '')::TIMESTAMPTZ, clock_timestamp())
  );

  INSERT INTO public.interior_quotation_items (
    id, tenant_id, quotation_id, boq_item_id, stable_component_id, room_zone_name,
    item_code, item_name, category, specifications, unit, quantity,
    internal_unit_cost, internal_total_cost, markup_percent, client_unit_price,
    client_total_price, gross_margin_amount, gross_margin_percent, cost_breakdown_json
  )
  SELECT (item.value ->> 'id')::UUID, v_tenant_id, v_quote_id,
         (item.value ->> 'boq_item_id')::UUID,
         NULLIF(item.value ->> 'stable_component_id', ''),
         item.value ->> 'room_zone_name', item.value ->> 'item_code',
         item.value ->> 'item_name', item.value ->> 'category', item.value ->> 'specifications',
         item.value ->> 'unit', (item.value ->> 'quantity')::NUMERIC,
         (item.value ->> 'internal_unit_cost')::NUMERIC,
         (item.value ->> 'internal_total_cost')::NUMERIC,
         (item.value ->> 'markup_percent')::NUMERIC,
         (item.value ->> 'client_unit_price')::NUMERIC,
         (item.value ->> 'client_total_price')::NUMERIC,
         (item.value ->> 'gross_margin_amount')::NUMERIC,
         (item.value ->> 'gross_margin_percent')::NUMERIC,
         item.value -> 'cost_breakdown_json'
  FROM jsonb_array_elements(p_items) item(value);

  IF v_parent_id IS NOT NULL THEN
    UPDATE public.interior_customer_approvals
    SET status = 'superseded',
        customer_notes = 'Superseded by a newer quotation revision',
        updated_at = clock_timestamp()
    WHERE tenant_id = v_tenant_id
      AND subject_type = 'quotation'
      AND subject_id = v_parent_id
      AND status = 'pending';
  END IF;

  RETURN v_quote_id;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_quotation_snapshot(JSONB, JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_quotation_snapshot(JSONB, JSONB)
  TO authenticated;

-- Contract header and its payment schedule are one creation unit. The
-- advisory lock makes retries/concurrent requests for the same quote serialize.
CREATE OR REPLACE FUNCTION public.interior_create_contract_with_milestones(
  p_contract JSONB,
  p_milestones JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_contract_id UUID;
  v_project_id UUID;
  v_quotation_id UUID;
  v_quotation_version INTEGER;
  v_contract_value NUMERIC(15, 2);
  v_milestone_count INTEGER;
  v_percentage_total NUMERIC(8, 2);
  v_amount_total NUMERIC(15, 2);
BEGIN
  IF v_actor_id IS NULL OR v_tenant_id IS NULL
     OR jsonb_typeof(p_contract) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_milestones) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor, contract, and milestone schedule are required';
  END IF;
  IF (p_contract ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'AuthorizationViolation: contract tenant does not match the authenticated tenant';
  END IF;

  v_project_id := (p_contract ->> 'project_id')::UUID;
  v_quotation_id := (p_contract ->> 'quotation_id')::UUID;
  v_quotation_version := (p_contract ->> 'quotation_version_number')::INTEGER;
  v_contract_id := (p_contract ->> 'id')::UUID;
  v_contract_value := (p_contract ->> 'baseline_contract_value')::NUMERIC(15, 2);
  IF NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: contract create permission is required';
  END IF;
  IF p_contract ->> 'status' IS DISTINCT FROM 'draft'
     OR NULLIF(btrim(p_contract ->> 'signed_date'), '') IS NOT NULL
     OR NULLIF(btrim(p_contract ->> 'customer_approval_id'), '') IS NOT NULL
     OR v_contract_value IS NULL OR v_contract_value <= 0
     OR (p_contract ->> 'current_contract_value')::NUMERIC(15, 2) IS DISTINCT FROM v_contract_value THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_MUST_START_UNSIGNED_WITH_BASELINE_VALUE';
  END IF;
  IF NULLIF(btrim(p_contract ->> 'contract_number'), '') IS NULL
     OR NULLIF(btrim(p_contract ->> 'title'), '') IS NULL
     OR NULLIF(btrim(p_contract ->> 'client_representative'), '') IS NULL
     OR NULLIF(btrim(p_contract ->> 'contractor_representative'), '') IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_PARTY_DETAILS_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT || ':' || v_quotation_id::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM public.interior_contracts c
    WHERE c.tenant_id = v_tenant_id AND c.quotation_id = v_quotation_id
  ) THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_ALREADY_EXISTS_FOR_QUOTATION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.interior_quotations q
    WHERE q.tenant_id = v_tenant_id AND q.id = v_quotation_id
      AND q.project_id = v_project_id AND q.status = 'accepted'
      AND q.version_number = v_quotation_version
      AND q.grand_total = v_contract_value
      AND q.boq_id = (p_contract ->> 'boq_id')::UUID
      AND q.boq_version_number = (p_contract ->> 'boq_version_number')::INTEGER
  ) THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_QUOTATION_LINEAGE_OR_ACCEPTANCE_INVALID';
  END IF;

  SELECT count(*), COALESCE(sum((milestone.value ->> 'percentage')::NUMERIC), 0),
         COALESCE(sum((milestone.value ->> 'amount')::NUMERIC), 0)
    INTO v_milestone_count, v_percentage_total, v_amount_total
  FROM jsonb_array_elements(p_milestones) AS milestone(value);
  IF v_milestone_count = 0 OR abs(v_percentage_total - 100) > 0.01
     OR abs(v_amount_total - v_contract_value) > 0.01
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_milestones) AS milestone(value)
       WHERE (milestone.value ->> 'status') IS DISTINCT FROM 'pending'
          OR NULLIF(btrim(milestone.value ->> 'name'), '') IS NULL
          OR NULLIF(btrim(milestone.value ->> 'trigger_condition'), '') IS NULL
          OR (milestone.value ->> 'amount')::NUMERIC < 0
          OR (milestone.value ->> 'percentage')::NUMERIC <= 0
          OR (milestone.value ->> 'milestone_order')::INTEGER <= 0
          OR NULLIF(btrim(milestone.value ->> 'id'), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'INTERIOR_CONTRACT_PAYMENT_SCHEDULE_INVALID';
  END IF;

  INSERT INTO public.interior_contracts (
    id, tenant_id, project_id, quotation_id, contract_number, title, status,
    baseline_contract_value, current_contract_value, signed_date,
    quotation_customer_approval_id, customer_approval_id, client_representative,
    contractor_representative, quotation_number, quotation_version_number,
    boq_id, boq_version_number, design_revision_id, design_version_number,
    payment_terms, execution_start_date, execution_end_date, notes, created_at, updated_at
  ) VALUES (
    v_contract_id, v_tenant_id, v_project_id, v_quotation_id,
    p_contract ->> 'contract_number', p_contract ->> 'title', 'draft',
    v_contract_value, v_contract_value, NULL,
    (p_contract ->> 'quotation_customer_approval_id')::UUID, NULL,
    p_contract ->> 'client_representative', p_contract ->> 'contractor_representative',
    p_contract ->> 'quotation_number', v_quotation_version,
    (p_contract ->> 'boq_id')::UUID, (p_contract ->> 'boq_version_number')::INTEGER,
    (p_contract ->> 'design_revision_id')::UUID, (p_contract ->> 'design_version_number')::INTEGER,
    p_contract ->> 'payment_terms', NULLIF(p_contract ->> 'execution_start_date', '')::DATE,
    NULLIF(p_contract ->> 'execution_end_date', '')::DATE, p_contract ->> 'notes',
    COALESCE(NULLIF(p_contract ->> 'created_at', '')::TIMESTAMPTZ, clock_timestamp()),
    COALESCE(NULLIF(p_contract ->> 'updated_at', '')::TIMESTAMPTZ, clock_timestamp())
  );

  INSERT INTO public.interior_payment_milestones (
    id, tenant_id, contract_id, milestone_order, name, percentage, amount,
    trigger_condition, status, due_date, paid_at, collected_amount,
    invoice_status, invoice_number, invoiced_at
  )
  SELECT (milestone.value ->> 'id')::UUID, v_tenant_id, v_contract_id,
         (milestone.value ->> 'milestone_order')::INTEGER, milestone.value ->> 'name',
         (milestone.value ->> 'percentage')::NUMERIC(5, 2), (milestone.value ->> 'amount')::NUMERIC(15, 2),
         milestone.value ->> 'trigger_condition', 'pending', NULLIF(milestone.value ->> 'due_date', '')::DATE,
         NULL, 0, 'unissued', NULL, NULL
  FROM jsonb_array_elements(p_milestones) AS milestone(value);

  RETURN v_contract_id;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_contract_with_milestones(JSONB, JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_contract_with_milestones(JSONB, JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_boq_for_commercial(p_boq_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_boq public.interior_boqs%ROWTYPE;
  v_can_read_internal BOOLEAN;
  v_can_read_client BOOLEAN;
  v_items JSONB;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_boq_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and BOQ are required';
  END IF;
  SELECT * INTO v_boq
  FROM public.interior_boqs b
  WHERE b.tenant_id = v_tenant_id AND b.id = p_boq_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:boq:read', v_tenant_id, v_boq.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped BOQ read is required';
  END IF;
  v_can_read_internal := public.interior_has_permission('interior:finance:read', v_tenant_id, v_boq.project_id, NULL);
  v_can_read_client := v_can_read_internal
    OR public.interior_has_permission('interior:contract:read', v_tenant_id, v_boq.project_id, NULL)
    OR public.interior_has_permission('interior:contract:create', v_tenant_id, v_boq.project_id, NULL);

  SELECT COALESCE(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', i.id, 'tenant_id', i.tenant_id, 'boq_id', i.boq_id,
      'room_zone_id', i.room_zone_id, 'room_zone_name', i.room_zone_name,
      'item_code', i.item_code, 'item_name', i.item_name, 'category', i.category,
      'dimensions_json', i.dimensions_json, 'specifications_json', i.specifications_json,
      'unit', i.unit, 'quantity', i.quantity,
      'internal_unit_cost', CASE WHEN v_can_read_internal THEN i.internal_unit_cost END,
      'internal_total_cost', CASE WHEN v_can_read_internal THEN i.internal_total_cost END,
      'client_unit_price', CASE WHEN v_can_read_client THEN i.client_unit_price END,
      'client_total_price', CASE WHEN v_can_read_client THEN i.client_total_price END,
      'gross_margin_amount', CASE WHEN v_can_read_internal THEN i.gross_margin_amount END,
      'gross_margin_percent', CASE WHEN v_can_read_internal THEN i.gross_margin_percent END,
      'stable_component_id', i.stable_component_id
    )) ORDER BY i.item_code, i.id
  ), '[]'::JSONB) INTO v_items
  FROM public.interior_boq_items i
  WHERE i.tenant_id = v_tenant_id AND i.boq_id = v_boq.id;

  RETURN jsonb_build_object(
    'boq', jsonb_strip_nulls(jsonb_build_object(
      'id', v_boq.id, 'tenant_id', v_boq.tenant_id, 'project_id', v_boq.project_id,
      'design_revision_id', v_boq.design_revision_id, 'boq_number', v_boq.boq_number,
      'version_number', v_boq.version_number, 'status', v_boq.status,
      'total_internal_cost', CASE WHEN v_can_read_internal THEN v_boq.total_internal_cost END,
      'total_client_price', CASE WHEN v_can_read_client THEN v_boq.total_client_price END,
      'total_gross_margin', CASE WHEN v_can_read_internal THEN v_boq.total_gross_margin END,
      'gross_margin_percent', CASE WHEN v_can_read_internal THEN v_boq.gross_margin_percent END,
      'prepared_by', v_boq.prepared_by, 'forked_from_boq_id', v_boq.forked_from_boq_id,
      'snapshot_sealed_at', v_boq.snapshot_sealed_at, 'release_notes', v_boq.release_notes,
      'created_at', v_boq.created_at, 'updated_at', v_boq.updated_at
    )),
    'items', v_items
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_boq_for_commercial(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_boq_for_commercial(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_project_for_contract(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_project public.interior_projects%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:create', v_tenant_id, p_project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:write', v_tenant_id, p_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract create or write permission is required';
  END IF;
  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.tenant_id = v_tenant_id AND p.id = p_project_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', v_project.id, 'code', v_project.code, 'name', v_project.name,
    'customerId', v_project.customer_id, 'customerName', v_project.customer_name,
    'customerPhone', v_project.customer_phone
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_project_for_contract(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_project_for_contract(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_design_revision_commercial(p_revision_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_revision public.interior_design_revisions%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_revision_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and design revision are required';
  END IF;
  SELECT * INTO v_revision FROM public.interior_design_revisions r
  WHERE r.tenant_id = v_tenant_id AND r.id = p_revision_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:boq:create', v_tenant_id, v_revision.project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_revision.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped commercial design lineage read is required';
  END IF;
  RETURN jsonb_build_object(
    'id', v_revision.id, 'tenant_id', v_revision.tenant_id, 'project_id', v_revision.project_id,
    'version_number', v_revision.version_number, 'title', v_revision.title, 'status', v_revision.status,
    'change_summary', v_revision.change_summary, 'submitted_by', v_revision.submitted_by,
    'submitted_at', v_revision.submitted_at, 'approved_by', v_revision.approved_by,
    'approved_at', v_revision.approved_at, 'client_signoff_name', v_revision.client_signoff_name,
    'client_signoff_date', v_revision.client_signoff_date
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_design_revision_commercial(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_design_revision_commercial(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_quotation(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_quote public.interior_quotations%ROWTYPE;
  v_can_read_internal BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_quotation_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and quotation are required';
  END IF;
  SELECT * INTO v_quote
  FROM public.interior_quotations q
  WHERE q.tenant_id = v_tenant_id AND q.id = p_quotation_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant_id, v_quote.project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:create', v_tenant_id, v_quote.project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_quote.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped quotation read is required';
  END IF;
  v_can_read_internal := public.interior_has_permission('interior:finance:read', v_tenant_id, v_quote.project_id, NULL);
  v_result := jsonb_build_object(
    'id', v_quote.id, 'tenant_id', v_quote.tenant_id, 'project_id', v_quote.project_id,
    'boq_id', v_quote.boq_id, 'boq_version_number', v_quote.boq_version_number,
    'quotation_number', v_quote.quotation_number, 'version_number', v_quote.version_number,
    'status', v_quote.status, 'subtotal', v_quote.subtotal,
    'discount_amount', v_quote.discount_amount, 'vat_percent', v_quote.vat_percent,
    'vat_amount', v_quote.vat_amount, 'grand_total', v_quote.grand_total,
    'payment_terms', v_quote.payment_terms, 'validity_days', v_quote.validity_days,
    'forked_from_quotation_id', v_quote.forked_from_quotation_id,
    'prepared_by', v_quote.prepared_by, 'approved_by', v_quote.approved_by,
    'sent_to_client_at', v_quote.sent_to_client_at, 'accepted_at', v_quote.accepted_at,
    'rejected_at', v_quote.rejected_at, 'rejection_reason', v_quote.rejection_reason,
    'created_at', v_quote.created_at
  );
  IF v_can_read_internal THEN
    v_result := v_result || jsonb_build_object(
      'total_internal_cogs', v_quote.total_internal_cogs,
      'total_gross_margin', v_quote.total_gross_margin,
      'gross_margin_percent', v_quote.gross_margin_percent
    );
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_quotation(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_quotation(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_quotations_by_project(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_can_read_internal BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant_id, p_project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:create', v_tenant_id, p_project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:write', v_tenant_id, p_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped quotation read is required';
  END IF;
  v_can_read_internal := public.interior_has_permission('interior:finance:read', v_tenant_id, p_project_id, NULL);
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', q.id, 'tenant_id', q.tenant_id, 'project_id', q.project_id,
      'boq_id', q.boq_id, 'boq_version_number', q.boq_version_number,
      'quotation_number', q.quotation_number, 'version_number', q.version_number,
      'status', q.status, 'subtotal', q.subtotal, 'discount_amount', q.discount_amount,
      'vat_percent', q.vat_percent, 'vat_amount', q.vat_amount, 'grand_total', q.grand_total,
      'payment_terms', q.payment_terms, 'validity_days', q.validity_days,
      'forked_from_quotation_id', q.forked_from_quotation_id,
      'prepared_by', q.prepared_by, 'approved_by', q.approved_by,
      'sent_to_client_at', q.sent_to_client_at, 'accepted_at', q.accepted_at,
      'rejected_at', q.rejected_at, 'rejection_reason', q.rejection_reason,
      'created_at', q.created_at
    ) || CASE WHEN v_can_read_internal THEN jsonb_build_object(
      'total_internal_cogs', q.total_internal_cogs,
      'total_gross_margin', q.total_gross_margin,
      'gross_margin_percent', q.gross_margin_percent
    ) ELSE '{}'::JSONB END
    ORDER BY q.version_number DESC, q.created_at DESC
  ), '[]'::JSONB) INTO v_result
  FROM public.interior_quotations q
  WHERE q.tenant_id = v_tenant_id AND q.project_id = p_project_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_quotations_by_project(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_quotations_by_project(UUID)
  TO authenticated;

-- Keep the authorized contract read model complete enough for manufacturing
-- and installation consumers to preserve the exact signed commercial lineage.
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
      'milestones', CASE WHEN v_finance_access THEN v_milestones ELSE '[]'::JSONB END
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_read_contract_for_customer_approval(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_contract public.interior_contracts%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR auth.uid() IS NULL OR p_contract_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor and contract are required';
  END IF;
  SELECT * INTO v_contract
  FROM public.interior_contracts c
  WHERE c.tenant_id = v_tenant_id AND c.id = p_contract_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:contract:read', v_tenant_id, v_contract.project_id, NULL)
     AND NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_contract.project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract approval access is required';
  END IF;
  RETURN jsonb_build_object(
    'id', v_contract.id,
    'tenant_id', v_contract.tenant_id,
    'project_id', v_contract.project_id,
    'status', v_contract.status,
    'quotation_version_number', v_contract.quotation_version_number
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_read_contract_for_customer_approval(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_contract_for_customer_approval(UUID)
  TO authenticated;
