BEGIN;
-- Product review repair: reuse existing authority and unpaid-balance semantics.
-- Function replacement only; no table, grant, policy, identity or Kernel changes.

CREATE OR REPLACE FUNCTION public.preschool_open_admission(
  p_tenant_id uuid,p_actor_id uuid,p_operation_key uuid,p_payload jsonb DEFAULT NULL
) RETURNS SETOF public.preschool_admission_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_operation public.preschool_admission_operations%ROWTYPE;
  v_branch_id uuid;
  v_course_id uuid;
  v_code text;
BEGIN
  IF p_operation_key IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN auth.users a ON a.id=u.id
    JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin')
  ) THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-admission:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_operation FROM public.preschool_admission_operations
    WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF FOUND THEN
    PERFORM 1 FROM public.users u JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id
      WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
        AND lower(u.role) IN ('admin','super_admin') FOR SHARE OF u,t,a;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
    IF v_operation.actor_id<>p_actor_id THEN
      RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501';
    END IF;
    IF p_payload IS NOT NULL AND v_operation.payload<>p_payload THEN
      RAISE EXCEPTION 'PRESCHOOL_ADMISSION_PAYLOAD_CONFLICT' USING ERRCODE='P0001';
    END IF;
    RETURN NEXT v_operation; RETURN;
  END IF;
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_INVALID_PAYLOAD' USING ERRCODE='22023';
  END IF;
  v_branch_id := (p_payload->>'branchId')::uuid;
  v_course_id := (p_payload->>'courseId')::uuid;
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_INVALID_PAYLOAD' USING ERRCODE='22023'; END IF;
  -- The immutable Product intent reserves the course/branch before any Party,
  -- Student or enrollment write. Competing branches fail without academic residue.
  -- Assignment uses this same course lock; no new Kernel query or reservation table.
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-course:'||p_tenant_id||':'||v_course_id,0));
  IF EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments
      WHERE tenant_id=p_tenant_id AND course_id=v_course_id AND branch_id<>v_branch_id)
    OR EXISTS(SELECT 1 FROM public.preschool_admission_operations
      WHERE tenant_id=p_tenant_id AND payload->>'courseId'=v_course_id::text AND branch_id<>v_branch_id) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT' USING ERRCODE='P0001';
  END IF;
  IF v_branch_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.org_units WHERE id=v_branch_id AND tenant_id=p_tenant_id
      AND unit_type='branch' AND is_active=true
  ) THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_BRANCH_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.users u JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id
    JOIN public.org_units b ON b.tenant_id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin') AND b.id=v_branch_id AND b.unit_type='branch' AND b.is_active=true
    FOR SHARE OF u,t,a,b;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_BRANCH_DENIED' USING ERRCODE='42501'; END IF;
  -- Allocate once in the Product namespace. The Student public contract owns
  -- uniqueness; an external code collision fails closed without reallocating.
  v_code := 'EDU-'||extract(year FROM now() AT TIME ZONE 'UTC')::text||'-'||nextval('public.preschool_admission_student_code_seq')::text;
  INSERT INTO public.preschool_admission_operations(tenant_id,operation_key,actor_id,branch_id,payload,student_code)
    VALUES(p_tenant_id,p_operation_key,p_actor_id,v_branch_id,p_payload,v_code)
    RETURNING * INTO v_operation;
  RETURN NEXT v_operation;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_branch_access(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_action text DEFAULT 'registry'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_role text; v_allowed boolean;
BEGIN
  IF p_actor_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_actor_id) THEN RETURN false; END IF;
  SELECT lower(u.role) INTO v_role FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp());
  IF v_role IS NULL OR (p_action='admission' AND v_role NOT IN ('admin','super_admin'))
    OR (p_action IN ('registry','attendance') AND v_role NOT IN ('admin','super_admin','admin_staff'))
    OR p_action IS NULL OR p_action NOT IN ('admission','registry','attendance') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE id=p_branch_id AND tenant_id=p_tenant_id
    AND unit_type='branch' AND is_active=true) THEN RETURN false; END IF;
  IF auth.role()='service_role' THEN
    -- Service writers accept only current canonical tenant administrators.
    -- Their tenant-wide active-unit scope is the existing Platform admin rule.
    RETURN v_role IN ('admin','super_admin');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_org_unit_access WHERE user_id=auth.uid()
    AND tenant_id=p_tenant_id AND org_unit_id=p_branch_id) INTO v_allowed;
  RETURN v_allowed;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_assign_chain(
  p_tenant_id uuid,p_actor_id uuid,p_course_id uuid,p_enrollment_id uuid,p_branch_id uuid,p_request_id uuid
) RETURNS SETOF public.preschool_chain_enrollment_branch_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_course public.preschool_chain_course_branch_assignments%ROWTYPE;
  v_assignment public.preschool_chain_enrollment_branch_assignments%ROWTYPE;
BEGIN
  IF NOT public.preschool_branch_access(p_tenant_id,p_actor_id,p_branch_id,'admission') THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-course:'||p_tenant_id||':'||p_course_id,0));
  IF EXISTS(SELECT 1 FROM public.preschool_admission_operations WHERE tenant_id=p_tenant_id
    AND payload->>'courseId'=p_course_id::text AND branch_id<>p_branch_id) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT'; END IF;
  -- Recheck after a potentially blocking lock and hold live authority rows.
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id JOIN public.org_units b ON b.tenant_id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin') AND b.id=p_branch_id AND b.unit_type='branch' AND b.is_active=true
    FOR SHARE OF u,t,a,b;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  -- Read-only owning canonical relations; no Kernel mutation or authorization grant.
  IF NOT EXISTS(SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id
    JOIN public.students s ON s.party_id=e.student_party_id AND s.tenant_id=e.tenant_id
    JOIN public.party_parties p ON p.id=e.student_party_id AND p.tenant_id=e.tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
    WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id AND e.course_id=p_course_id
      AND e.request_id=p_request_id::text AND e.status IN ('active','pending')) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_course FROM public.preschool_chain_course_branch_assignments
    WHERE tenant_id=p_tenant_id AND course_id=p_course_id FOR UPDATE;
  IF FOUND AND v_course.branch_id<>p_branch_id THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT'; END IF;
  SELECT * INTO v_assignment FROM public.preschool_chain_enrollment_branch_assignments
    WHERE tenant_id=p_tenant_id AND (enrollment_id=p_enrollment_id OR request_id=p_request_id) FOR UPDATE;
  IF FOUND THEN
    IF v_course.id IS NULL THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT'; END IF;
    IF v_assignment.enrollment_id<>p_enrollment_id OR v_assignment.course_id<>p_course_id
      OR v_assignment.branch_id<>p_branch_id OR v_assignment.request_id<>p_request_id THEN
      RAISE EXCEPTION 'PRESCHOOL_CHAIN_ASSIGNMENT_CONFLICT'; END IF;
    RETURN NEXT v_assignment; RETURN;
  END IF;
  IF v_course.id IS NULL THEN
    INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id,course_id,branch_id,assigned_by)
      VALUES(p_tenant_id,p_course_id,p_branch_id,p_actor_id);
  END IF;
  INSERT INTO public.preschool_chain_enrollment_branch_assignments(tenant_id,enrollment_id,course_id,branch_id,request_id,assigned_by)
    VALUES(p_tenant_id,p_enrollment_id,p_course_id,p_branch_id,p_request_id,p_actor_id) RETURNING * INTO v_assignment;
  RETURN NEXT v_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_admission_pickup(
  p_tenant_id uuid,p_actor_id uuid,p_student_party_id uuid,p_guardian_party_id uuid,p_normalized_phone text
) RETURNS SETOF public.edu_preschool_pickup_authorizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_relation public.party_relationships%ROWTYPE; v_auth public.edu_preschool_pickup_authorizations%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp()) AND lower(u.role) IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  IF p_student_party_id=p_guardian_party_id OR NOT EXISTS(SELECT 1 FROM public.party_parties WHERE id=p_student_party_id
    AND tenant_id=p_tenant_id AND party_type='person' AND deleted_at IS NULL) OR NOT EXISTS(
      SELECT 1 FROM public.party_identifiers i JOIN public.party_parties p ON p.id=i.party_id
      WHERE i.tenant_id=p_tenant_id AND p.tenant_id=p_tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
        AND i.party_id=p_guardian_party_id AND i.identifier_type='preschool_guardian_phone' AND i.identifier_value=p_normalized_phone) THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_CANONICAL_IDENTITY_CONFLICT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-pickup:'||p_tenant_id||':'||p_student_party_id||':'||p_guardian_party_id,0));
  SELECT * INTO v_relation FROM public.party_relationships WHERE tenant_id=p_tenant_id
    AND source_party_id=p_guardian_party_id AND target_party_id=p_student_party_id AND relationship_type='guardian_of' FOR UPDATE;
  IF NOT FOUND OR (v_relation.active_from IS NOT NULL AND v_relation.active_from>CURRENT_DATE)
    OR (v_relation.active_to IS NOT NULL AND v_relation.active_to<CURRENT_DATE) THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_RELATIONSHIP_NOT_ACTIVE'; END IF;
  -- Lock every prior authorization, including revoked rows. Concurrent revocation
  -- either precedes this check or waits until this admission step commits.
  PERFORM 1 FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id FOR UPDATE;
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin') FOR SHARE OF u,t,a;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_auth FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id AND status='authorized';
  IF FOUND THEN RETURN NEXT v_auth; RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id AND status='revoked') THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_AUTHORIZATION_REVOKED'; END IF;
  INSERT INTO public.edu_preschool_pickup_authorizations(tenant_id,student_party_id,guardian_party_id,status)
    VALUES(p_tenant_id,p_student_party_id,p_guardian_party_id,'authorized') RETURNING * INTO v_auth;
  RETURN NEXT v_auth;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_finance_branch_command(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_action text,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invoice public.edu_fin_invoices%ROWTYPE; v_item jsonb; v_student uuid;
  v_result jsonb; v_notice public.edu_comm_notices%ROWTYPE; v_thread uuid; v_guardians uuid[];
  v_guardian uuid; v_exception public.edu_comm_exceptions%ROWTYPE; v_duplicate boolean;
  v_request jsonb; v_key text; v_count integer:=0; v_results jsonb:='[]'; v_id uuid;
BEGIN
  PERFORM public.preschool_finance_require_actor(p_tenant_id,p_actor_id);
  IF p_action IN ('recover-payment','recordAndReconcilePayment') THEN
    v_key:=p_payload->>'operationKey'; v_request:=p_payload->'request';
    IF v_key IS NULL OR length(v_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'FINANCE_OPERATION_KEY_REQUIRED: Stable operation key required.'; END IF;
    -- Same lock ordering as the sealed Product payment contract; no second key.
    PERFORM pg_advisory_xact_lock(hashtextextended('preschool-finance:'||p_tenant_id::text||':'||v_key,0));
    PERFORM 1 FROM public.edu_fin_invoices WHERE tenant_id=p_tenant_id AND id=(v_request->>'invoiceId')::uuid FOR UPDATE;
    PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
    IF public.preschool_finance_require_invoice_branch(p_tenant_id,p_actor_id,(v_request->>'invoiceId')::uuid) IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Invoice is outside the selected Finance branch.' USING ERRCODE='42501';
    END IF;
    IF p_action='recover-payment' THEN
      RETURN public.preschool_recover_finance_reconciliation(p_tenant_id,p_actor_id,v_key,v_request);
    END IF;
    RETURN public.preschool_reconcile_finance_atomic(p_tenant_id,p_actor_id,v_key,v_request);
  END IF;
  IF p_action='create-invoice' THEN
    v_student:=(p_payload->'invoice'->>'studentPartyId')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.party_parties p WHERE p.id=v_student AND p.tenant_id=p_tenant_id AND p.party_type='person' AND p.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'STUDENT_PARTY_TENANT_MISMATCH: Canonical student must belong to tenant.';
    END IF;
    PERFORM 1 FROM public.edu_fin_billing_periods WHERE tenant_id=p_tenant_id AND id=(p_payload->'invoice'->>'billingPeriodId')::uuid AND status='ACTIVE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FINANCE_BILLING_PERIOD_NOT_FOUND: Active tenant billing period required.'; END IF;
    PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
    IF public.preschool_finance_require_student_branch(p_tenant_id,p_actor_id,v_student) IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Student is outside the selected Finance branch.' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.edu_enrollments WHERE tenant_id=p_tenant_id AND student_party_id=v_student AND status IN ('active','pending')) THEN
      RAISE EXCEPTION 'FINANCE_STUDENT_ENROLLMENT_REQUIRED: Active or pending enrollment required.';
    END IF;
    -- Existing Product calculation service supplies the draft and line items;
    -- this boundary only commits them together after current authorization.
    IF p_payload->'invoice'->>'tenantId' IS DISTINCT FROM p_tenant_id::text
      OR p_payload->'invoice'->>'createdBy' IS DISTINCT FROM p_actor_id::text
      OR jsonb_typeof(p_payload->'lineItems') IS DISTINCT FROM 'array'
      OR p_payload->'invoice'->>'invoiceStatus' IS DISTINCT FROM 'DRAFT'
      OR p_payload->'invoice'->>'settlementStatus' IS DISTINCT FROM 'UNPAID'
      OR (p_payload->'invoice'->>'paidAmount')::numeric IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Trusted draft publication required.';
    END IF;
    INSERT INTO public.edu_fin_invoices(tenant_id,student_party_id,student_id,billing_period_id,invoice_number,invoice_status,settlement_status,gross_amount,discount_amount,net_amount,paid_amount,outstanding_amount,due_date,is_archived,created_by)
      VALUES(p_tenant_id,v_student,(p_payload->'invoice'->>'studentId')::uuid,(p_payload->'invoice'->>'billingPeriodId')::uuid,
      p_payload->'invoice'->>'invoiceNumber','DRAFT','UNPAID',(p_payload->'invoice'->>'grossAmount')::numeric,
      (p_payload->'invoice'->>'discountAmount')::numeric,(p_payload->'invoice'->>'netAmount')::numeric,0,
      (p_payload->'invoice'->>'netAmount')::numeric,(p_payload->'invoice'->>'dueDate')::date,false,p_actor_id) RETURNING * INTO v_invoice;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'lineItems') LOOP
      IF v_item->>'tenantId' IS DISTINCT FROM p_tenant_id::text THEN RAISE EXCEPTION 'TENANT_ISOLATION_VIOLATION: Line item tenant mismatch.' USING ERRCODE='42501'; END IF;
      INSERT INTO public.edu_fin_invoice_line_items(tenant_id,invoice_id,item_type,description,unit_price,quantity,subtotal_amount,source_domain,source_entity_type,source_entity_id)
      VALUES(p_tenant_id,v_invoice.id,v_item->>'itemType',v_item->>'description',(v_item->>'unitPrice')::numeric,
        (v_item->>'quantity')::numeric,(v_item->>'subtotalAmount')::numeric,v_item->>'sourceDomain',v_item->>'sourceEntityType',(v_item->>'sourceEntityId')::uuid);
    END LOOP;
  ELSIF p_action IN ('issue-invoice','projectInvoiceNotice') THEN
    -- Invoice lock also serializes notice deduplication; recheck branch after it.
    SELECT * INTO v_invoice FROM public.edu_fin_invoices WHERE tenant_id=p_tenant_id AND id=(p_payload->>'invoiceId')::uuid FOR UPDATE;
    PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
    IF v_invoice.id IS NULL OR public.preschool_finance_require_invoice_branch(p_tenant_id,p_actor_id,v_invoice.id) IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Canonical invoice in selected branch required.' USING ERRCODE='42501';
    END IF;
    IF p_action='issue-invoice' THEN
      IF v_invoice.invoice_status='VOID' THEN RAISE EXCEPTION 'INVOICE_VOID_ERROR: Cannot issue void invoice.'; END IF;
      IF v_invoice.invoice_status<>'ISSUED' THEN
        IF p_payload->'patch'->>'invoiceStatus' IS DISTINCT FROM 'ISSUED' OR length(p_payload->'patch'->>'sha256Checksum')<>64 THEN RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Canonical invoice checksum required.'; END IF;
        UPDATE public.edu_fin_invoices SET invoice_status='ISSUED',issued_at=(p_payload->'patch'->>'issuedAt')::timestamptz,
          sha256_checksum=p_payload->'patch'->>'sha256Checksum',updated_at=now() WHERE tenant_id=p_tenant_id AND id=v_invoice.id RETURNING * INTO v_invoice;
      END IF;
    ELSE
      IF v_invoice.invoice_status<>'ISSUED' THEN RAISE EXCEPTION 'UNISSUED_INVOICE_PROJECTION_ERROR: Issued invoice required.'; END IF;
      SELECT * INTO v_notice FROM public.edu_comm_notices n WHERE n.tenant_id=p_tenant_id AND n.source_domain='P7_FINANCE'
        AND n.source_entity_type='INVOICE' AND n.source_entity_id=v_invoice.id AND NOT n.is_archived AND n.source_version='1' AND n.projection_type='PARENT_PUBLICATION';
      v_duplicate:=v_notice.id IS NOT NULL;
      SELECT array_agg(DISTINCT r.source_party_id ORDER BY r.source_party_id) INTO v_guardians FROM public.party_relationships r
        JOIN public.party_parties p ON p.id=r.source_party_id AND p.tenant_id=r.tenant_id AND p.deleted_at IS NULL
        WHERE r.tenant_id=p_tenant_id AND r.target_party_id=v_invoice.student_party_id AND r.relationship_type='guardian_of';
      IF cardinality(v_guardians) IS NULL THEN RAISE EXCEPTION 'FINANCE_GUARDIAN_REQUIRED: Canonical guardian relation required.'; END IF;
      IF NOT v_duplicate THEN
        INSERT INTO public.edu_comm_threads(tenant_id,student_id,guardian_party_id,thread_type,title,status,created_by)
          VALUES(p_tenant_id,v_invoice.student_party_id,v_guardians[1],'GENERAL',p_payload->>'title','ACTIVE',p_actor_id) RETURNING id INTO v_thread;
        INSERT INTO public.edu_comm_notices(tenant_id,thread_id,source_domain,source_entity_type,source_entity_id,source_version,projection_type,notice_category,priority,requirement_type,title,body_text,metadata,due_at,is_archived,created_by)
          VALUES(p_tenant_id,v_thread,'P7_FINANCE','INVOICE',v_invoice.id,'1','PARENT_PUBLICATION','INFO','HIGH','REQUIRES_ACK',
            p_payload->>'title',p_payload->>'bodyText',jsonb_build_object('invoiceNumber',v_invoice.invoice_number,'netAmount',v_invoice.net_amount,'dueDate',v_invoice.due_date),v_invoice.due_date::timestamptz,false,p_actor_id) RETURNING * INTO v_notice;
        FOREACH v_guardian IN ARRAY v_guardians LOOP
          INSERT INTO public.edu_comm_deliveries(tenant_id,notice_id,recipient_party_id,channel,status,attempt_count)
            VALUES(p_tenant_id,v_notice.id,v_guardian,'IN_APP','READY',0);
        END LOOP;
      END IF;
      RETURN jsonb_build_object('isDuplicate',v_duplicate,'notice',to_jsonb(v_notice),'deliveries',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.edu_comm_deliveries d WHERE d.tenant_id=p_tenant_id AND d.notice_id=v_notice.id),'[]'));
    END IF;
  ELSIF p_action='resolveException' THEN
    SELECT * INTO v_exception FROM public.edu_comm_exceptions WHERE tenant_id=p_tenant_id AND id=(p_payload->>'exceptionId')::uuid FOR UPDATE;
    SELECT i.* INTO v_invoice FROM public.edu_comm_notices n JOIN public.edu_fin_invoices i ON i.tenant_id=n.tenant_id AND i.id=n.source_entity_id
      JOIN public.edu_comm_threads th ON th.tenant_id=n.tenant_id AND th.id=n.thread_id
      WHERE n.tenant_id=p_tenant_id AND n.id=v_exception.notice_id AND n.source_domain='P7_FINANCE' AND n.source_entity_type='INVOICE'
        AND i.student_party_id=v_exception.student_id AND th.student_id=i.student_party_id
        AND EXISTS(SELECT 1 FROM public.party_relationships r WHERE r.tenant_id=p_tenant_id AND r.target_party_id=i.student_party_id AND r.source_party_id=v_exception.guardian_party_id AND r.relationship_type='guardian_of') FOR UPDATE OF i;
    PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
    IF v_invoice.id IS NULL OR public.preschool_finance_require_invoice_branch(p_tenant_id,p_actor_id,v_invoice.id) IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Canonical Finance exception in selected branch required.' USING ERRCODE='42501';
    END IF;
    UPDATE public.edu_comm_exceptions SET status='RESOLVED',resolved_by=p_actor_id,resolved_at=now(),resolution_notes=p_payload->>'resolutionNotes',updated_at=now()
      WHERE id=v_exception.id AND tenant_id=p_tenant_id RETURNING * INTO v_exception;
    RETURN to_jsonb(v_exception);
  ELSIF p_action='scanOverdueInvoices' THEN
    v_result:=public.preschool_finance_read_branch(p_tenant_id,p_actor_id,p_branch_id);
    FOR v_id IN SELECT (value->>'id')::uuid FROM jsonb_array_elements(v_result->'invoices')
      WHERE value->>'invoice_status'='ISSUED' AND value->>'settlement_status' NOT IN ('PAID','OVERPAID') AND (value->>'outstanding_amount')::numeric>0
        AND (value->>'due_date')::date<CURRENT_DATE LOOP
      SELECT * INTO v_invoice FROM public.edu_fin_invoices WHERE tenant_id=p_tenant_id AND id=v_id FOR UPDATE;
      PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
      IF public.preschool_finance_require_invoice_branch(p_tenant_id,p_actor_id,v_id) IS DISTINCT FROM p_branch_id THEN RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Invoice branch changed.' USING ERRCODE='42501'; END IF;
      IF v_invoice.invoice_status<>'ISSUED' OR v_invoice.settlement_status IN ('PAID','OVERPAID') OR v_invoice.outstanding_amount<=0 OR v_invoice.due_date>=CURRENT_DATE THEN CONTINUE; END IF;
      SELECT r.source_party_id INTO v_guardian FROM public.party_relationships r WHERE r.tenant_id=p_tenant_id AND r.target_party_id=v_invoice.student_party_id AND r.relationship_type='guardian_of' ORDER BY r.source_party_id LIMIT 1;
      SELECT * INTO v_notice FROM public.edu_comm_notices n WHERE n.tenant_id=p_tenant_id AND n.source_domain='P7_FINANCE' AND n.source_entity_type='INVOICE' AND n.source_entity_id=v_id AND NOT n.is_archived ORDER BY n.id LIMIT 1;
      IF v_guardian IS NULL OR v_notice.id IS NULL THEN CONTINUE; END IF;
      SELECT * INTO v_exception FROM public.edu_comm_exceptions x WHERE x.tenant_id=p_tenant_id AND x.notice_id=v_notice.id AND x.guardian_party_id=v_guardian AND x.exception_type='OVERDUE_PAYMENT_SLA' AND x.status IN ('OPEN','IN_PROGRESS');
      v_duplicate:=v_exception.id IS NOT NULL;
      IF NOT v_duplicate THEN
        INSERT INTO public.edu_comm_exceptions(tenant_id,notice_id,student_id,guardian_party_id,exception_type,severity,assigned_role,status)
          VALUES(p_tenant_id,v_notice.id,v_invoice.student_party_id,v_guardian,'OVERDUE_PAYMENT_SLA','HIGH','ADMIN','OPEN') RETURNING * INTO v_exception;
        v_count:=v_count+1;
      END IF;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('invoiceId',v_id,'exceptionId',v_exception.id,'isDuplicate',v_duplicate));
    END LOOP;
    RETURN jsonb_build_object('escalatedCount',v_count,'exceptions',v_results);
  ELSE
    -- In particular, a tenant-wide completion cannot be attributed to one branch.
    RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Unsupported action in branch Finance contract.' USING ERRCODE='42501';
  END IF;
  SELECT to_jsonb(v_invoice)||jsonb_build_object('line_items',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM public.edu_fin_invoice_line_items l WHERE l.tenant_id=p_tenant_id AND l.invoice_id=v_invoice.id),'[]')) INTO v_result;
  RETURN v_result;
END;
$$;
COMMIT;
