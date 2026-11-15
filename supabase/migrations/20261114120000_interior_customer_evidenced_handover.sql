-- Customer-evidenced handover. The legacy staff assertion RPC remains revoked.
CREATE TABLE IF NOT EXISTS public.interior_handover_acceptance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
  dossier_id UUID NOT NULL REFERENCES public.interior_handover_dossiers(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.interior_contracts(id) ON DELETE RESTRICT,
  approval_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  customer_representative TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  final_settlement_value NUMERIC(15, 2) NOT NULL,
  total_punch_list_items INTEGER NOT NULL DEFAULT 0,
  open_punch_list_items INTEGER NOT NULL DEFAULT 0,
  requested_by_actor_id UUID NOT NULL,
  requested_by_actor_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  rejection_reason TEXT,
  customer_notes TEXT,
  signature_storage_path TEXT,
  signature_mime_type TEXT,
  signature_file_size_bytes BIGINT,
  signature_sha256_hash TEXT,
  signature_uploaded_at TIMESTAMPTZ,
  CONSTRAINT uq_interior_handover_acceptance_token UNIQUE (approval_token),
  CONSTRAINT uq_interior_handover_acceptance_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT ck_interior_handover_acceptance_signature_hash
    CHECK (signature_sha256_hash IS NULL OR signature_sha256_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_interior_handover_acceptance_signature_size
    CHECK (signature_file_size_bytes IS NULL OR signature_file_size_bytes BETWEEN 1 AND 5242880)
);

ALTER TABLE public.interior_handover_dossiers
  ADD COLUMN IF NOT EXISTS customer_acceptance_request_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_interior_handover_customer_acceptance'
      AND conrelid = 'public.interior_handover_dossiers'::REGCLASS
  ) THEN
    ALTER TABLE public.interior_handover_dossiers
      ADD CONSTRAINT fk_interior_handover_customer_acceptance
      FOREIGN KEY (tenant_id, customer_acceptance_request_id)
      REFERENCES public.interior_handover_acceptance_requests (tenant_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- zero-downtime: allow validate-constraint - handover evidence reference
ALTER TABLE public.interior_handover_dossiers
  VALIDATE CONSTRAINT fk_interior_handover_customer_acceptance;

ALTER TABLE public.interior_handover_acceptance_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interior_handover_acceptance_requests FROM PUBLIC, anon, authenticated, service_role;

-- zero-downtime: allow blocking-index - token lookup on the newly created handover request table
CREATE INDEX IF NOT EXISTS idx_interior_handover_acceptance_token_lookup
  ON public.interior_handover_acceptance_requests (id, approval_token, expires_at);

-- zero-downtime: allow blocking-index - one active customer request per handover dossier
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_handover_acceptance_pending
  ON public.interior_handover_acceptance_requests (tenant_id, dossier_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.guard_interior_handover_customer_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_needs_customer_evidence BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_needs_customer_evidence := NEW.client_accepted OR NEW.status = 'completed';
  ELSE
    v_needs_customer_evidence :=
      (NOT OLD.client_accepted AND NEW.client_accepted)
      OR (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed');
  END IF;

  IF v_needs_customer_evidence THEN
    IF NEW.customer_acceptance_request_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.interior_handover_acceptance_requests r
      WHERE r.tenant_id = NEW.tenant_id AND r.id = NEW.customer_acceptance_request_id
        AND r.dossier_id = NEW.id AND r.project_id = NEW.project_id
        AND r.contract_id = NEW.contract_id AND r.status = 'approved'
        AND r.signature_storage_path IS NOT NULL AND r.signature_sha256_hash ~ '^[0-9a-f]{64}$'
    ) THEN RAISE EXCEPTION 'INTERIOR_HANDOVER_CUSTOMER_EVIDENCE_REQUIRED'; END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.client_accepted AND (
      NEW.client_accepted IS DISTINCT FROM OLD.client_accepted
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.handover_date IS DISTINCT FROM OLD.handover_date
      OR NEW.total_punch_list_items IS DISTINCT FROM OLD.total_punch_list_items
      OR NEW.open_punch_list_items IS DISTINCT FROM OLD.open_punch_list_items
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
      OR NEW.customer_acceptance_request_id IS DISTINCT FROM OLD.customer_acceptance_request_id
      OR NEW.client_signoff_name IS DISTINCT FROM OLD.client_signoff_name
      OR NEW.final_settlement_value IS DISTINCT FROM OLD.final_settlement_value
      OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
    ) THEN
      RAISE EXCEPTION 'INTERIOR_HANDOVER_ACCEPTANCE_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_interior_handover_customer_evidence()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_interior_handover_customer_evidence
  ON public.interior_handover_dossiers;
CREATE TRIGGER trg_guard_interior_handover_customer_evidence
  BEFORE INSERT OR UPDATE ON public.interior_handover_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_handover_customer_evidence();

CREATE OR REPLACE FUNCTION public.interior_request_handover_acceptance(
  p_project_id UUID,
  p_contract_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant UUID := public.interior_actor_tenant();
  v_actor UUID := auth.uid();
  v_project public.interior_projects%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_dossier public.interior_handover_dossiers%ROWTYPE;
  v_request public.interior_handover_acceptance_requests%ROWTYPE;
  v_total INTEGER;
  v_open INTEGER;
  v_contract_count INTEGER;
  v_actor_name TEXT;
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior actor is required';
  END IF;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor AND actor.tenant_id = v_tenant;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL
     OR length(btrim(v_actor_name)) > 200 THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_REQUEST_INVALID';
  END IF;
  IF NOT public.interior_has_permission('interior:handover:approve', v_tenant, p_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped handover permission is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_tenant::TEXT || ':' || p_project_id::TEXT, 0)
  );
  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.tenant_id = v_tenant AND p.id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_HANDOVER_PROJECT_NOT_FOUND'; END IF;
  IF NULLIF(btrim(v_project.customer_name), '') IS NULL
     OR NULLIF(btrim(v_project.customer_phone), '') IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_CUSTOMER_CONTACT_REQUIRED';
  END IF;
  IF p_contract_id IS NULL THEN
    SELECT count(*)::INTEGER INTO v_contract_count FROM public.interior_contracts c
    WHERE c.tenant_id = v_tenant AND c.project_id = p_project_id AND c.status IN ('signed', 'active');
    IF v_contract_count = 0 THEN RAISE EXCEPTION 'INTERIOR_HANDOVER_SIGNED_CONTRACT_REQUIRED'; END IF;
    IF v_contract_count > 1 THEN RAISE EXCEPTION 'INTERIOR_HANDOVER_CONTRACT_AMBIGUOUS'; END IF;
    SELECT * INTO v_contract FROM public.interior_contracts c
    WHERE c.tenant_id = v_tenant AND c.project_id = p_project_id AND c.status IN ('signed', 'active')
    FOR UPDATE;
  ELSE
    SELECT * INTO v_contract FROM public.interior_contracts c
    WHERE c.tenant_id = v_tenant AND c.project_id = p_project_id
      AND c.id = p_contract_id AND c.status IN ('signed', 'active') FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_HANDOVER_SIGNED_CONTRACT_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.interior_handover_dossiers h
    WHERE h.tenant_id = v_tenant AND h.project_id = p_project_id
      AND h.contract_id = v_contract.id AND h.client_accepted
      AND h.customer_acceptance_request_id IS NULL
  ) THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_LEGACY_ACCEPTANCE_UNVERIFIED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.interior_handover_dossiers h
    WHERE h.tenant_id = v_tenant AND h.project_id = p_project_id
      AND h.contract_id = v_contract.id AND h.client_accepted
  ) THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_ALREADY_COMPLETED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.interior_qc_punch_list_items q
    WHERE q.tenant_id = v_tenant AND q.project_id = p_project_id
      AND q.severity IN ('critical', 'major') AND q.status <> 'verified'
  ) THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN';
  END IF;

  SELECT count(*)::INTEGER,
         count(*) FILTER (WHERE q.status <> 'verified')::INTEGER
    INTO v_total, v_open
  FROM public.interior_qc_punch_list_items q
  WHERE q.tenant_id = v_tenant AND q.project_id = p_project_id;

  SELECT * INTO v_dossier FROM public.interior_handover_dossiers h
  WHERE h.tenant_id = v_tenant AND h.project_id = p_project_id
    AND h.contract_id = v_contract.id AND NOT h.client_accepted
  ORDER BY h.created_at DESC, h.id DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.interior_handover_dossiers (
      tenant_id, project_id, contract_id, handover_date, status,
      total_punch_list_items, open_punch_list_items, client_accepted,
      client_signoff_name, final_settlement_value, created_by_user_id,
      approved_by_user_id, created_at
    ) VALUES (
      v_tenant, p_project_id, v_contract.id, clock_timestamp(), 'pending_customer_acceptance',
      v_total, v_open, FALSE, NULL, v_contract.current_contract_value,
      v_actor, NULL, clock_timestamp()
    ) RETURNING * INTO v_dossier;
  ELSE
    UPDATE public.interior_handover_dossiers h
    SET status = 'pending_customer_acceptance',
        total_punch_list_items = v_total,
        open_punch_list_items = v_open,
        final_settlement_value = v_contract.current_contract_value
    WHERE h.tenant_id = v_tenant AND h.id = v_dossier.id
    RETURNING * INTO v_dossier;
  END IF;

  SELECT * INTO v_request FROM public.interior_handover_acceptance_requests r
  WHERE r.tenant_id = v_tenant AND r.dossier_id = v_dossier.id
    AND r.status = 'pending' AND r.expires_at > clock_timestamp()
  FOR UPDATE;
  IF FOUND AND (
    v_request.final_settlement_value IS DISTINCT FROM v_contract.current_contract_value
    OR v_request.total_punch_list_items IS DISTINCT FROM v_total
    OR v_request.open_punch_list_items IS DISTINCT FROM v_open
  ) THEN
    UPDATE public.interior_handover_acceptance_requests r
    SET status = 'expired', responded_at = clock_timestamp()
    WHERE r.id = v_request.id AND r.tenant_id = v_tenant;
    v_request := NULL;
  END IF;
  IF v_request.id IS NULL THEN
    UPDATE public.interior_handover_acceptance_requests r
    SET status = 'expired', responded_at = clock_timestamp()
    WHERE r.tenant_id = v_tenant AND r.dossier_id = v_dossier.id
      AND r.status = 'pending' AND r.expires_at <= clock_timestamp();
    INSERT INTO public.interior_handover_acceptance_requests (
      tenant_id, project_id, dossier_id, contract_id, status,
      customer_representative, customer_contact, final_settlement_value,
      total_punch_list_items, open_punch_list_items, requested_by_actor_id,
      requested_by_actor_name, expires_at
    ) VALUES (
      v_tenant, p_project_id, v_dossier.id, v_contract.id, 'pending',
      v_project.customer_name, v_project.customer_phone, v_contract.current_contract_value,
      v_total, v_open, v_actor,
      btrim(v_actor_name), clock_timestamp() + INTERVAL '30 days'
    ) RETURNING * INTO v_request;
  END IF;

  UPDATE public.interior_handover_dossiers h
  SET customer_acceptance_request_id = v_request.id
  WHERE h.tenant_id = v_tenant AND h.id = v_dossier.id;

  RETURN jsonb_build_object(
    'status', 'COMMITTED',
    'reason', 'CUSTOMER_ACCEPTANCE_REQUESTED',
    'dossier', jsonb_build_object(
      'id', v_dossier.id,
      'tenantId', v_dossier.tenant_id,
      'projectId', v_dossier.project_id,
      'contractId', v_dossier.contract_id,
      'handoverDate', v_dossier.handover_date,
      'status', v_dossier.status,
      'clientAccepted', v_dossier.client_accepted,
      'totalPunchListItems', v_dossier.total_punch_list_items,
      'openPunchListItems', v_dossier.open_punch_list_items,
      'finalSettlementValue', v_dossier.final_settlement_value
    ),
    'approval', jsonb_build_object(
      'id', v_request.id,
      'token', v_request.approval_token,
      'expiresAt', v_request.expires_at,
      'status', v_request.status
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.interior_request_handover_acceptance(UUID, UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_request_handover_acceptance(UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_list_handover_dossiers(p_project_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant UUID := public.interior_actor_tenant();
  v_result JSONB;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant is required';
  END IF;
  IF p_project_id IS NOT NULL
     AND NOT public.interior_has_permission('interior:delivery:read', v_tenant, p_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped handover read is required';
  END IF;
  IF p_project_id IS NULL
     AND NOT public.interior_has_permission('interior:delivery:read', v_tenant, NULL, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: tenant handover read is required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', h.id,
    'tenantId', h.tenant_id,
    'projectId', h.project_id,
    'contractId', h.contract_id,
    'handoverDate', h.handover_date,
    'status', h.status,
    'totalPunchListItems', h.total_punch_list_items,
    'openPunchListItems', h.open_punch_list_items,
    'clientAccepted', h.client_accepted,
    'clientSignoffName', CASE
      WHEN public.interior_has_permission('interior:customer:read', v_tenant, h.project_id, NULL)
      THEN h.client_signoff_name END,
    'finalSettlementValue', CASE
      WHEN public.interior_has_permission('interior:finance:read', v_tenant, h.project_id, NULL)
        OR public.interior_has_permission('interior:contract:read', v_tenant, h.project_id, NULL)
      THEN h.final_settlement_value END,
    'dossierDocumentUrl', h.dossier_document_url,
    'createdByUserId', h.created_by_user_id,
    'createdAt', h.created_at,
    'customerAcceptanceRequestId', h.customer_acceptance_request_id,
    'customerAcceptanceStatus', CASE
      WHEN h.client_accepted AND h.customer_acceptance_request_id IS NULL THEN 'legacy_unverified'
      ELSE r.status END,
    'customerAcceptanceSignatureSha256', CASE
      WHEN public.interior_has_permission('interior:customer:read', v_tenant, h.project_id, NULL)
      THEN r.signature_sha256_hash END
  )) ORDER BY h.handover_date DESC, h.id), '[]'::JSONB)
  INTO v_result
  FROM public.interior_handover_dossiers h
  LEFT JOIN public.interior_handover_acceptance_requests r
    ON r.tenant_id = h.tenant_id AND r.id = h.customer_acceptance_request_id
  WHERE h.tenant_id = v_tenant
    AND (p_project_id IS NULL OR h.project_id = p_project_id)
    AND public.interior_has_permission('interior:delivery:read', v_tenant, h.project_id, NULL);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_list_handover_dossiers(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_list_handover_dossiers(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_read_public_handover_acceptance(
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
  v_request public.interior_handover_acceptance_requests%ROWTYPE;
  v_project public.interior_projects%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_dossier public.interior_handover_dossiers%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.interior_handover_acceptance_requests r
  WHERE r.id = p_approval_id AND r.approval_token = p_approval_token;
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
$$;
REVOKE ALL ON FUNCTION public.interior_read_public_handover_acceptance(UUID, UUID)
  FROM PUBLIC, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_read_public_handover_acceptance(UUID, UUID)
  TO anon;

CREATE OR REPLACE FUNCTION public.interior_transition_public_handover_acceptance(
  p_approval_id UUID,
  p_approval_token UUID,
  p_target_status TEXT,
  p_rejection_reason TEXT,
  p_customer_notes TEXT,
  p_signature_storage_path TEXT,
  p_signature_mime_type TEXT,
  p_signature_file_size_bytes BIGINT,
  p_signature_sha256_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.interior_handover_acceptance_requests%ROWTYPE;
  v_project public.interior_projects%ROWTYPE;
  v_contract public.interior_contracts%ROWTYPE;
  v_dossier public.interior_handover_dossiers%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_certificate_number TEXT;
  v_total INTEGER;
  v_open INTEGER;
BEGIN
  IF p_target_status NOT IN ('approved', 'rejected')
     OR length(COALESCE(p_rejection_reason, '')) > 2000
     OR length(COALESCE(p_customer_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_RESPONSE_INVALID';
  END IF;
  IF p_target_status = 'rejected'
     AND NULLIF(btrim(p_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_REJECTION_REASON_REQUIRED';
  END IF;
  IF p_target_status = 'rejected' AND (
    p_signature_storage_path IS NOT NULL OR p_signature_mime_type IS NOT NULL
    OR p_signature_file_size_bytes IS NOT NULL OR p_signature_sha256_hash IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INTERIOR_HANDOVER_REJECTION_MUST_NOT_INCLUDE_SIGNATURE';
  END IF;

  -- Read identifiers without a row lock, then lock project -> contract ->
  -- dossier -> request, matching the staff request path and avoiding cycles.
  SELECT * INTO v_request FROM public.interior_handover_acceptance_requests r
  WHERE r.id = p_approval_id AND r.approval_token = p_approval_token;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_request.tenant_id::TEXT || ':' || v_request.project_id::TEXT, 0)
  );
  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.tenant_id = v_request.tenant_id AND p.id = v_request.project_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_contract FROM public.interior_contracts c
  WHERE c.tenant_id = v_request.tenant_id AND c.project_id = v_request.project_id
    AND c.id = v_request.contract_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_dossier FROM public.interior_handover_dossiers h
  WHERE h.tenant_id = v_request.tenant_id AND h.project_id = v_request.project_id
    AND h.contract_id = v_request.contract_id AND h.id = v_request.dossier_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_dossier.client_accepted THEN RETURN FALSE; END IF;
  SELECT * INTO v_request FROM public.interior_handover_acceptance_requests r
  WHERE r.id = p_approval_id AND r.approval_token = p_approval_token FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_request.status <> 'pending' THEN RETURN FALSE; END IF;
  IF v_request.expires_at <= v_now THEN
    UPDATE public.interior_handover_acceptance_requests r
    SET status = 'expired', responded_at = v_now
    WHERE r.id = p_approval_id AND r.tenant_id = v_request.tenant_id;
    RETURN FALSE;
  END IF;

  IF p_target_status = 'approved' THEN
    IF v_contract.status NOT IN ('signed', 'active')
       OR v_dossier.status <> 'pending_customer_acceptance' THEN
      RETURN FALSE;
    END IF;
    IF p_signature_storage_path IS NULL
       OR p_signature_mime_type IS NULL
       OR p_signature_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
       OR p_signature_file_size_bytes IS NULL
       OR p_signature_file_size_bytes NOT BETWEEN 1 AND 5242880
       OR p_signature_sha256_hash IS NULL
       OR p_signature_sha256_hash !~ '^[0-9a-f]{64}$'
       OR p_signature_storage_path NOT LIKE v_request.tenant_id::TEXT || '/' || v_request.id::TEXT || '/%' THEN
      RAISE EXCEPTION 'INTERIOR_HANDOVER_SIGNATURE_EVIDENCE_INVALID';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'interior-customer-signatures'
        AND o.name = p_signature_storage_path
    ) THEN
      RAISE EXCEPTION 'INTERIOR_HANDOVER_SIGNATURE_OBJECT_NOT_FOUND';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.interior_qc_punch_list_items q
      WHERE q.tenant_id = v_request.tenant_id AND q.project_id = v_request.project_id
        AND q.severity IN ('critical', 'major') AND q.status <> 'verified'
    ) THEN
      RAISE EXCEPTION 'INTERIOR_HANDOVER_OPEN_QC_ITEMS_REMAIN';
    END IF;
    SELECT count(*)::INTEGER,
           count(*) FILTER (WHERE q.status <> 'verified')::INTEGER
      INTO v_total, v_open
    FROM public.interior_qc_punch_list_items q
    WHERE q.tenant_id = v_request.tenant_id AND q.project_id = v_request.project_id;
    IF v_contract.current_contract_value IS DISTINCT FROM v_request.final_settlement_value
       OR v_total IS DISTINCT FROM v_request.total_punch_list_items
       OR v_open IS DISTINCT FROM v_request.open_punch_list_items THEN
      UPDATE public.interior_handover_acceptance_requests r
      SET status = 'expired', responded_at = v_now
      WHERE r.id = v_request.id AND r.tenant_id = v_request.tenant_id;
      RETURN FALSE;
    END IF;

    UPDATE public.interior_handover_acceptance_requests r
    SET status = 'approved', responded_at = v_now, customer_notes = NULLIF(btrim(p_customer_notes), ''),
        signature_storage_path = p_signature_storage_path,
        signature_mime_type = p_signature_mime_type,
        signature_file_size_bytes = p_signature_file_size_bytes,
        signature_sha256_hash = lower(p_signature_sha256_hash),
        signature_uploaded_at = v_now
    WHERE r.id = v_request.id AND r.tenant_id = v_request.tenant_id;

    UPDATE public.interior_handover_dossiers h
    SET status = 'completed', handover_date = v_now,
        client_accepted = TRUE, client_signoff_name = v_request.customer_representative,
        final_settlement_value = v_request.final_settlement_value,
        customer_acceptance_request_id = v_request.id,
        total_punch_list_items = (
          SELECT count(*)::INTEGER FROM public.interior_qc_punch_list_items q
          WHERE q.tenant_id = v_request.tenant_id AND q.project_id = v_request.project_id
        ),
        open_punch_list_items = (
          SELECT count(*)::INTEGER FROM public.interior_qc_punch_list_items q
          WHERE q.tenant_id = v_request.tenant_id AND q.project_id = v_request.project_id
            AND q.status <> 'verified'
        )
    WHERE h.tenant_id = v_request.tenant_id AND h.id = v_request.dossier_id;

    v_certificate_number := 'WAR-' || v_project.code || '-'
      || EXTRACT(YEAR FROM v_now)::INTEGER::TEXT || '-'
      || substring(replace(v_dossier.id::TEXT, '-', '') FROM 1 FOR 8);
    INSERT INTO public.interior_warranty_certificates (
      tenant_id, project_id, contract_id, certificate_number,
      customer_name, site_address, effective_date, expiration_date,
      woodwork_warranty_months, hardware_warranty_months, stone_warranty_months,
      terms_summary
    ) VALUES (
      v_request.tenant_id, v_request.project_id, v_request.contract_id, v_certificate_number,
      v_project.customer_name, v_project.site_address, v_now, v_now + INTERVAL '24 months',
      24, 60, 120,
      'Bảo hành kết cấu gỗ 24 tháng, phụ kiện bản lề/ray trượt 60 tháng, mặt đá 120 tháng.'
    );
    UPDATE public.interior_projects p
    SET status = 'warranty'
    WHERE p.tenant_id = v_request.tenant_id AND p.id = v_request.project_id;
  ELSE
    UPDATE public.interior_handover_acceptance_requests r
    SET status = 'rejected', responded_at = v_now,
        rejection_reason = btrim(p_rejection_reason),
        customer_notes = NULLIF(btrim(p_customer_notes), '')
    WHERE r.id = v_request.id AND r.tenant_id = v_request.tenant_id;
  END IF;

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_transition_public_handover_acceptance(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT
) FROM PUBLIC, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_transition_public_handover_acceptance(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT
) TO service_role;
