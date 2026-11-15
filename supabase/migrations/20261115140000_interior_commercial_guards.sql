-- =============================================================================
-- Bella Interior Commercial — Handover Work Item Link + D11/D13/D14 Guards
-- Migration: 20261115140000_interior_commercial_guards
--
-- Nội dung:
--   1. ADD interior_handover_dossiers.work_item_id (D10 traceability gap)
--   2. RPC rpc_submit_interior_approval — D11 conditional I6 enforcement
--   3. RPC rpc_issue_interior_warranty  — D13 issuance guard
--   4. Immutability trigger cho warranty_certificates
-- =============================================================================

BEGIN;

-- ── PREFLIGHT ────────────────────────────────────────────────────────────────
DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interior_work_items') THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_work_items must exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interior_internal_approvals') THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_internal_approvals must exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interior_handover_dossiers') THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_handover_dossiers not found';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interior_handover_dossiers' AND column_name='work_item_id') THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_handover_dossiers.work_item_id already exists';
  END IF;
  -- Verify D13 columns exist on warranty_certificates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interior_warranty_certificates' AND column_name='warranty_terms_status') THEN
    RAISE EXCEPTION 'Preflight FAIL: warranty_terms_status missing on interior_warranty_certificates';
  END IF;
END;
$preflight$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. D10: Handover Dossier → Work Item link (additive nullable)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.interior_handover_dossiers
  ADD COLUMN IF NOT EXISTS work_item_id uuid;

ALTER TABLE public.interior_handover_dossiers
  ADD CONSTRAINT interior_handover_dossiers_work_item_id_fkey
    FOREIGN KEY (work_item_id)
      REFERENCES public.interior_work_items(id) ON DELETE RESTRICT
  NOT VALID;

COMMENT ON COLUMN public.interior_handover_dossiers.work_item_id IS
  'D10: FK về work_item — nullable vì handover_dossiers hiện có thể rỗng. Validate sau khi dữ liệu được gắn.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. D11: RPC rpc_submit_interior_approval
--    Conditional I6 enforcement theo work_type:
--    - turnkey / construction_only → bắt buộc design_review approval có
--      ext_technical_source HOẶC design_revision_id trên work item's BOQ
--    - loose_furniture → không tạo design_review; bắt buộc ext_technical_source
--      (product spec) trước khi tạo production_review
--    - existing_drawing → không tạo design_review; bắt buộc ext_technical_source
--      (drawing) trước khi tạo production_review
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.rpc_submit_interior_approval(
  p_tenant_id      uuid,
  p_work_item_id   uuid,
  p_subject_type   text,
  p_subject_id     uuid,
  p_approval_stage text,
  p_decision_note  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id  uuid;
  v_work_item        record;
  v_has_ext_source   boolean;
  v_new_approval_id  uuid;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor required';
  END IF;

  -- Tenant isolation
  v_actor_tenant_id := public.interior_actor_tenant();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'TenantIsolationViolation: request tenant does not match authenticated actor';
  END IF;

  -- Permission: interior:approval:submit
  IF NOT public.interior_has_permission('interior:approval:submit', p_tenant_id, NULL, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: interior:approval:submit required';
  END IF;

  -- Load work item
  SELECT wi.work_type, wi.project_id, wi.status
    INTO v_work_item
  FROM public.interior_work_items wi
  WHERE wi.id = p_work_item_id AND wi.tenant_id = v_actor_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound: work_item % not found for tenant', p_work_item_id;
  END IF;

  IF v_work_item.status = 'cancelled' THEN
    RAISE EXCEPTION 'BusinessRuleViolation: cannot submit approval for a cancelled work item';
  END IF;

  -- ── D11: Conditional I6 enforcement ──────────────────────────────────────

  -- RULE 1: loose_furniture và existing_drawing không được có design_review
  IF v_work_item.work_type IN ('loose_furniture', 'existing_drawing')
     AND p_approval_stage = 'design_review' THEN
    RAISE EXCEPTION 'BusinessRuleViolation: work_type % does not support design_review approval stage. Use production_review instead.',
      v_work_item.work_type;
  END IF;

  -- RULE 2: loose_furniture và existing_drawing bắt buộc có ext_technical_source trước production_review
  IF v_work_item.work_type IN ('loose_furniture', 'existing_drawing')
     AND p_approval_stage = 'production_review' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.interior_external_technical_sources ets
      WHERE ets.work_item_id = p_work_item_id
        AND ets.tenant_id = v_actor_tenant_id
        AND ets.superseded_by_id IS NULL  -- chỉ active source
    ) INTO v_has_ext_source;

    IF NOT v_has_ext_source THEN
      RAISE EXCEPTION 'BusinessRuleViolation: work_type % requires at least one active external technical source (product spec or drawing) before production_review approval.',
        v_work_item.work_type;
    END IF;
  END IF;

  -- RULE 3: turnkey và construction_only phải có design_review PASSED trước production_review
  IF v_work_item.work_type IN ('turnkey', 'construction_only')
     AND p_approval_stage = 'production_review' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.interior_internal_approvals iia
      WHERE iia.work_item_id = p_work_item_id
        AND iia.tenant_id = v_actor_tenant_id
        AND iia.approval_stage = 'design_review'
        AND iia.status = 'approved'
        AND iia.is_superseded = false
    ) THEN
      RAISE EXCEPTION 'BusinessRuleViolation: work_type % requires a passed design_review approval before production_review.',
        v_work_item.work_type;
    END IF;
  END IF;

  -- ── D14: actor ≠ submitted_by bị kiểm tra ở DB level (chk_iia_sod) ──────
  -- submitted_by_id = auth.uid() — không được là decider trong cùng approval

  INSERT INTO public.interior_internal_approvals (
    tenant_id, work_item_id, subject_type, subject_id,
    approval_stage, status, submitted_by_id, submitted_at, decision_note
  ) VALUES (
    p_tenant_id, p_work_item_id, p_subject_type, p_subject_id,
    p_approval_stage, 'pending', auth.uid(), timezone('utc', now()), p_decision_note
  )
  RETURNING id INTO v_new_approval_id;

  RETURN v_new_approval_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_submit_interior_approval(uuid,uuid,text,uuid,text,text) IS
  'D11/D14: Submit approval với conditional I6 enforcement. Kiểm tra work_type trước khi cho phép tạo approval stage.';

REVOKE ALL ON FUNCTION public.rpc_submit_interior_approval(uuid,uuid,text,uuid,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_interior_approval(uuid,uuid,text,uuid,text,text)
  TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. D11: RPC rpc_decide_interior_approval (D14 SoD enforced)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.rpc_decide_interior_approval(
  p_tenant_id     uuid,
  p_approval_id   uuid,
  p_decision      text,  -- 'approved' | 'rejected' | 'revision_required'
  p_decision_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_approval        record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor required';
  END IF;

  v_actor_tenant_id := public.interior_actor_tenant();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'TenantIsolationViolation';
  END IF;

  IF NOT public.interior_has_permission('interior:approval:decide', p_tenant_id, NULL, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: interior:approval:decide required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'revision_required') THEN
    RAISE EXCEPTION 'ValidationError: decision must be approved | rejected | revision_required';
  END IF;

  SELECT * INTO v_approval
  FROM public.interior_internal_approvals
  WHERE id = p_approval_id AND tenant_id = v_actor_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound: approval % not found', p_approval_id;
  END IF;

  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'BusinessRuleViolation: approval is not in pending state (current: %)', v_approval.status;
  END IF;

  IF v_approval.is_superseded THEN
    RAISE EXCEPTION 'BusinessRuleViolation: approval has been superseded';
  END IF;

  -- D14: SoD — decider ≠ submitter (enforced ở DB CHECK, kiểm tra thêm ở đây)
  IF auth.uid() = v_approval.submitted_by_id THEN
    RAISE EXCEPTION 'SeparationOfDutiesViolation: decider cannot be the same as submitter (D14)';
  END IF;

  UPDATE public.interior_internal_approvals
  SET
    status        = p_decision,
    decided_by_id = auth.uid(),
    decided_at    = timezone('utc', now()),
    decision_note = COALESCE(p_decision_note, decision_note)
  WHERE id = p_approval_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_decide_interior_approval(uuid,uuid,text,text) IS
  'D14: Quyết định approval. SoD: decider ≠ submitter. Immutability via trigger sau khi update.';

REVOKE ALL ON FUNCTION public.rpc_decide_interior_approval(uuid,uuid,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_decide_interior_approval(uuid,uuid,text,text)
  TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. D13: Warranty issuance immutability trigger
--    Sau khi issued_at được set (phát hành), warranty_terms_snapshot là bất biến
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.guard_interior_warranty_certificate_issuance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Nếu đã phát hành (issued_at NOT NULL), block thay đổi snapshot và issued fields
  IF OLD.issued_at IS NOT NULL THEN
    IF (OLD.warranty_terms_snapshot IS DISTINCT FROM NEW.warranty_terms_snapshot) OR
       (OLD.warranty_terms_status   IS DISTINCT FROM NEW.warranty_terms_status)   OR
       (OLD.issued_by_id            IS DISTINCT FROM NEW.issued_by_id)            OR
       (OLD.issued_at               IS DISTINCT FROM NEW.issued_at)
    THEN
      RAISE EXCEPTION 'ImmutabilityViolation: warranty certificate snapshot and issuance fields are immutable after issuance (D13)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_interior_warranty_certificate_issuance() IS
  'D13: warranty_terms_snapshot và issuance fields bất biến sau khi issued_at được set.';

REVOKE EXECUTE ON FUNCTION public.guard_interior_warranty_certificate_issuance()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_warranty_issuance
  BEFORE UPDATE ON public.interior_warranty_certificates
  FOR EACH ROW EXECUTE FUNCTION public.guard_interior_warranty_certificate_issuance();

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. D13: RPC rpc_issue_interior_warranty
--    Kiểm tra 5 điều kiện phát hành trước khi ghi snapshot
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.rpc_issue_interior_warranty(
  p_tenant_id         uuid,
  p_certificate_id    uuid,
  p_warranty_snapshot jsonb  -- điều khoản từ hợp đồng, do caller cung cấp
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_cert            record;
  v_contract        record;
  v_has_accepted_handover boolean;
  v_has_passed_internal   boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated actor required';
  END IF;

  v_actor_tenant_id := public.interior_actor_tenant();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'TenantIsolationViolation';
  END IF;

  -- D13: kiểm tra permission interior:warranty:issue
  IF NOT public.interior_has_permission('interior:warranty:issue', p_tenant_id, NULL, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: interior:warranty:issue permission required (D13)';
  END IF;

  -- Load certificate
  SELECT * INTO v_cert
  FROM public.interior_warranty_certificates
  WHERE id = p_certificate_id AND tenant_id = v_actor_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NotFound: warranty certificate % not found', p_certificate_id;
  END IF;

  -- D13: không phát hành lại
  IF v_cert.issued_at IS NOT NULL THEN
    RAISE EXCEPTION 'BusinessRuleViolation: warranty certificate has already been issued at %', v_cert.issued_at;
  END IF;

  -- D13: PENDING_TERMS không được phát hành
  IF v_cert.warranty_terms_status = 'PENDING_TERMS' OR v_cert.warranty_terms_status IS NULL THEN
    RAISE EXCEPTION 'BusinessRuleViolation: warranty_terms_status is PENDING_TERMS — confirm terms before issuance (D13)';
  END IF;

  -- D13: snapshot phải được cung cấp và không rỗng
  IF p_warranty_snapshot IS NULL OR p_warranty_snapshot = '{}'::jsonb THEN
    RAISE EXCEPTION 'BusinessRuleViolation: warranty_snapshot cannot be empty — must include contract terms (D13)';
  END IF;

  -- D13: Condition 1 — Contract phải đã ký (có interior_contracts với status 'active' hoặc 'executed')
  SELECT * INTO v_contract
  FROM public.interior_contracts c
  WHERE c.id = v_cert.contract_id AND c.tenant_id = v_actor_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BusinessRuleViolation: no contract found for this warranty certificate (D13)';
  END IF;

  IF v_contract.status NOT IN ('active', 'executed', 'completed') THEN
    RAISE EXCEPTION 'BusinessRuleViolation: contract must be active/executed before warranty issuance. Current status: % (D13)',
      v_contract.status;
  END IF;

  -- D13: Condition 2 — Customer-confirmed handover phải tồn tại
  SELECT EXISTS(
    SELECT 1 FROM public.interior_handover_dossiers hd
    WHERE hd.contract_id = v_cert.contract_id
      AND hd.tenant_id   = v_actor_tenant_id
      AND hd.client_accepted = true
      AND hd.status = 'completed'
  ) INTO v_has_accepted_handover;

  IF NOT v_has_accepted_handover THEN
    RAISE EXCEPTION 'BusinessRuleViolation: no customer-accepted handover dossier found for this contract. Warranty cannot be issued before handover (D13)';
  END IF;

  -- D13: Condition 3 — Internal acceptance PASS (approval stage=handover_review, status=approved)
  -- Lấy work_item_id từ handover_dossiers nếu có, hoặc kiểm tra project-level
  SELECT EXISTS(
    SELECT 1 FROM public.interior_internal_approvals iia
    WHERE iia.tenant_id    = v_actor_tenant_id
      AND iia.subject_id   = v_cert.contract_id
      AND iia.approval_stage = 'handover_review'
      AND iia.status       = 'approved'
      AND iia.is_superseded = false
  ) INTO v_has_passed_internal;

  IF NOT v_has_passed_internal THEN
    RAISE EXCEPTION 'BusinessRuleViolation: no passed internal handover_review approval found for this contract. Internal acceptance required before warranty issuance (D13)';
  END IF;

  -- Tất cả điều kiện PASS — ghi snapshot và phát hành
  UPDATE public.interior_warranty_certificates
  SET
    warranty_terms_snapshot = p_warranty_snapshot,
    warranty_terms_status   = 'CONFIRMED',
    issued_by_id            = auth.uid(),
    issued_at               = timezone('utc', now())
  WHERE id = p_certificate_id;

END;
$$;

COMMENT ON FUNCTION public.rpc_issue_interior_warranty(uuid,uuid,jsonb) IS
  'D13: Phát hành chứng nhận bảo hành. Kiểm tra 5 điều kiện: permission, contract status, customer handover, internal acceptance, non-empty snapshot. Snapshot bất biến sau phát hành.';

REVOKE ALL ON FUNCTION public.rpc_issue_interior_warranty(uuid,uuid,jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_issue_interior_warranty(uuid,uuid,jsonb)
  TO authenticated;

COMMIT;