BEGIN;

-- Product-owned public server surface. No table, Platform, Kernel, accounting,
-- default-privilege or historical migration changes. Identity is trusted API
-- context; only service_role can execute the public entrypoints.
CREATE FUNCTION public.preschool_finance_require_branch_scope(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Current Finance branch checks require READ COMMITTED isolation.' USING ERRCODE='42501';
  END IF;
  PERFORM public.preschool_finance_require_actor(p_tenant_id,p_actor_id);
  PERFORM 1 FROM public.org_units b WHERE b.id=p_branch_id AND b.tenant_id=p_tenant_id
    AND b.unit_type='branch' AND b.is_active FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.platform_org_unit_access_for_actor(p_tenant_id,p_actor_id) a
    WHERE a.org_unit_id=p_branch_id AND a.user_id=p_actor_id AND a.tenant_id=p_tenant_id
      AND a.relationship_id IS NOT NULL AND a.access_source IN ('belongs_to','manages','participates_in')
  ) THEN
    RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Select a currently authorized active Finance branch.' USING ERRCODE='42501';
  END IF;
END;
$$;

CREATE FUNCTION public.preschool_finance_read_branch(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_branches jsonb; v_students uuid[]; v_student uuid; v_result jsonb;
BEGIN
  PERFORM public.preschool_finance_require_actor(p_tenant_id,p_actor_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'code',b.code) ORDER BY b.name,b.id),'[]')
    INTO v_branches FROM public.org_units b WHERE b.tenant_id=p_tenant_id AND b.unit_type='branch' AND b.is_active
    AND EXISTS(SELECT 1 FROM public.platform_org_unit_access_for_actor(p_tenant_id,p_actor_id) a
      WHERE a.org_unit_id=b.id AND a.relationship_id IS NOT NULL
        AND a.access_source IN ('belongs_to','manages','participates_in'));
  IF p_branch_id IS NULL THEN
    RETURN jsonb_build_object('branches',v_branches,'selectedBranchId',NULL,'students','[]'::jsonb,
      'billingPeriods','[]'::jsonb,'invoices','[]'::jsonb,'payments','[]'::jsonb,'exceptions','[]'::jsonb,
      'servicePeriodCompletions','[]'::jsonb,'completionAvailable',false);
  END IF;
  PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
  -- Branchless records have no proven ownership and are never returned. Any
  -- record linked to this branch must reconcile every canonical assignment.
  SELECT coalesce(array_agg(DISTINCT e.student_party_id),'{}'::uuid[]) INTO v_students
    FROM public.edu_enrollments e
    LEFT JOIN public.preschool_chain_enrollment_branch_assignments a ON a.tenant_id=e.tenant_id AND a.enrollment_id=e.id
    LEFT JOIN public.preschool_chain_course_branch_assignments c ON c.tenant_id=e.tenant_id AND c.course_id=e.course_id
    WHERE e.tenant_id=p_tenant_id AND (a.branch_id=p_branch_id OR c.branch_id=p_branch_id);
  FOREACH v_student IN ARRAY v_students LOOP
    IF public.preschool_finance_require_student_branch(p_tenant_id,p_actor_id,v_student) IS DISTINCT FROM p_branch_id
      OR (SELECT count(*) FROM public.students s JOIN public.party_parties p ON p.id=s.party_id AND p.tenant_id=s.tenant_id
        WHERE s.tenant_id=p_tenant_id AND s.party_id=v_student AND p.party_type='person' AND p.deleted_at IS NULL)<>1 THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Unique canonical student registry and branch mapping required.';
    END IF;
  END LOOP;
  SELECT jsonb_build_object('branches',v_branches,'selectedBranchId',p_branch_id,'completionAvailable',false,
    'students',coalesce((SELECT jsonb_agg(jsonb_build_object('enrollmentId',e.id,'courseId',e.course_id,
      'studentPartyId',e.student_party_id,'studentId',s.student_id,'studentCode',s.student_code,'displayName',p.display_name) ORDER BY e.id)
      FROM public.edu_enrollments e JOIN public.party_parties p ON p.id=e.student_party_id AND p.tenant_id=e.tenant_id
      JOIN public.students s ON s.party_id=p.id AND s.tenant_id=e.tenant_id
      WHERE e.tenant_id=p_tenant_id AND e.student_party_id=ANY(v_students) AND e.status IN ('active','pending')),'[]'),
    -- Billing periods are tenant catalog configuration, not branch ownership.
    'billingPeriods',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.edu_fin_billing_periods t WHERE t.tenant_id=p_tenant_id AND t.status='ACTIVE'),'[]'),
    'servicePeriodCompletions','[]'::jsonb,
    'invoices',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.edu_fin_invoices t WHERE t.tenant_id=p_tenant_id AND t.student_party_id=ANY(v_students)),'[]'),
    'payments',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.edu_fin_payments t WHERE t.tenant_id=p_tenant_id AND t.student_party_id=ANY(v_students)),'[]'),
    'exceptions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.edu_comm_exceptions x
      JOIN public.edu_comm_notices n ON n.id=x.notice_id AND n.tenant_id=x.tenant_id
      JOIN public.edu_comm_threads th ON th.id=n.thread_id AND th.tenant_id=n.tenant_id
      JOIN public.edu_fin_invoices i ON i.id=n.source_entity_id AND i.tenant_id=n.tenant_id
      WHERE x.tenant_id=p_tenant_id AND n.source_domain='P7_FINANCE' AND n.source_entity_type='INVOICE'
        AND i.student_party_id=ANY(v_students) AND x.student_id=i.student_party_id AND th.student_id=i.student_party_id
        AND th.guardian_party_id=x.guardian_party_id AND EXISTS(SELECT 1 FROM public.party_relationships r
          WHERE r.tenant_id=p_tenant_id AND r.source_party_id=x.guardian_party_id AND r.target_party_id=i.student_party_id AND r.relationship_type='guardian_of')),'[]')) INTO v_result;
  PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.preschool_finance_branch_command(
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
      WHERE value->>'invoice_status'='ISSUED' AND value->>'settlement_status'<>'PAID' AND (value->>'due_date')::date<CURRENT_DATE LOOP
      SELECT * INTO v_invoice FROM public.edu_fin_invoices WHERE tenant_id=p_tenant_id AND id=v_id FOR UPDATE;
      PERFORM public.preschool_finance_require_branch_scope(p_tenant_id,p_actor_id,p_branch_id);
      IF public.preschool_finance_require_invoice_branch(p_tenant_id,p_actor_id,v_id) IS DISTINCT FROM p_branch_id THEN RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Invoice branch changed.' USING ERRCODE='42501'; END IF;
      IF v_invoice.invoice_status<>'ISSUED' OR v_invoice.settlement_status='PAID' OR v_invoice.due_date>=CURRENT_DATE THEN CONTINUE; END IF;
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

REVOKE ALL ON FUNCTION public.preschool_finance_require_branch_scope(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preschool_finance_read_branch(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.preschool_finance_branch_command(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_finance_read_branch(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preschool_finance_branch_command(uuid,uuid,uuid,text,jsonb) TO service_role;
COMMIT;
