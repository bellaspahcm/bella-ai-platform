BEGIN;

-- Product allocation command receipt; this is not a Finance GL or workflow ledger.
CREATE TABLE IF NOT EXISTS public.edu_fin_reconciliation_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
    actor_id uuid NOT NULL,
    request_payload jsonb NOT NULL,
    payment_id uuid NOT NULL REFERENCES public.edu_fin_payments(id) ON DELETE RESTRICT,
    invoice_id uuid NOT NULL REFERENCES public.edu_fin_invoices(id) ON DELETE RESTRICT,
    reconciliation_id uuid NOT NULL REFERENCES public.edu_fin_reconciliation_ledger(id) ON DELETE RESTRICT,
    receipt_id uuid NOT NULL REFERENCES public.edu_fin_receipts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, operation_key)
);
ALTER TABLE public.edu_fin_reconciliation_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edu_fin_reconciliation_operations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.edu_fin_reconciliation_operations TO service_role;

-- Only the two entrypoints are callable. Helpers are private to their SECURITY DEFINER owner.
CREATE OR REPLACE FUNCTION public.preschool_finance_require_actor(p_tenant_id uuid, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM 1 FROM auth.users a JOIN public.users u ON u.id = a.id
    WHERE a.id = p_actor_id AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.tenant_id = p_tenant_id AND u.status = 'active'
      AND u.role IN ('admin', 'accountant')
    FOR SHARE OF a, u;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Current active Auth-backed Finance admin/accountant required.' USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_finance_snapshot_canonical(p_snapshot jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    -- The receipt schema is flat. Keys are JS-sort order, currency values are
    -- bounded NUMERIC(15,2), never exponents, and strings are generated ASCII.
    SELECT '{' || string_agg(to_jsonb(k)::text || ':' ||
      CASE WHEN jsonb_typeof(p_snapshot -> k) = 'number'
        THEN trim(trailing '.' FROM trim(trailing '0' FROM ((p_snapshot ->> k)::numeric(15,2))::text))
        ELSE (p_snapshot -> k)::text END, ',' ORDER BY k COLLATE "C") || '}'
    FROM jsonb_object_keys(p_snapshot) k;
$$;

CREATE OR REPLACE FUNCTION public.preschool_finance_canonical_result(p_operation public.edu_fin_reconciliation_operations)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_invoice public.edu_fin_invoices%ROWTYPE;
    v_payment public.edu_fin_payments%ROWTYPE;
    v_entry public.edu_fin_reconciliation_ledger%ROWTYPE;
    v_receipt public.edu_fin_receipts%ROWTYPE;
    v_invoice_total numeric;
    v_payment_total numeric;
    v_status text;
BEGIN
    SELECT * INTO v_invoice FROM public.edu_fin_invoices
      WHERE id = p_operation.invoice_id AND tenant_id = p_operation.tenant_id;
    SELECT * INTO v_payment FROM public.edu_fin_payments
      WHERE id = p_operation.payment_id AND tenant_id = p_operation.tenant_id;
    SELECT * INTO v_entry FROM public.edu_fin_reconciliation_ledger
      WHERE id = p_operation.reconciliation_id AND tenant_id = p_operation.tenant_id;
    SELECT * INTO v_receipt FROM public.edu_fin_receipts
      WHERE id = p_operation.receipt_id AND tenant_id = p_operation.tenant_id;
    IF v_invoice.id IS NULL OR v_payment.id IS NULL OR v_entry.id IS NULL OR v_receipt.id IS NULL
       OR v_payment.student_party_id IS DISTINCT FROM v_invoice.student_party_id
       OR v_invoice.student_party_id IS NULL
       OR v_entry.payment_id IS DISTINCT FROM v_payment.id OR v_entry.invoice_id IS DISTINCT FROM v_invoice.id
       OR v_entry.reconciled_by_party_id IS DISTINCT FROM p_operation.actor_id
       OR v_receipt.payment_id IS DISTINCT FROM v_payment.id OR v_receipt.invoice_id IS DISTINCT FROM v_invoice.id
       OR (p_operation.request_payload ->> 'invoiceId')::uuid IS DISTINCT FROM v_invoice.id
       OR (p_operation.request_payload ->> 'kind' = 'existing-payment'
           AND (p_operation.request_payload ->> 'paymentId')::uuid IS DISTINCT FROM v_payment.id)
       OR (p_operation.request_payload ->> 'kind' = 'new-payment' AND (v_payment.amount IS DISTINCT FROM (p_operation.request_payload ->> 'paymentAmount')::numeric OR v_payment.payment_method IS DISTINCT FROM p_operation.request_payload ->> 'paymentMethod' OR v_payment.created_by IS DISTINCT FROM p_operation.actor_id))
       OR (p_operation.request_payload ->> 'kind' = 'existing-payment' AND v_entry.notes IS DISTINCT FROM p_operation.request_payload ->> 'notes')
       OR v_entry.allocated_amount IS DISTINCT FROM coalesce(p_operation.request_payload ->> 'allocationAmount', p_operation.request_payload ->> 'paymentAmount')::numeric
       OR NOT EXISTS (SELECT 1 FROM public.party_parties p WHERE p.id = v_invoice.student_party_id AND p.tenant_id = p_operation.tenant_id AND p.party_type = 'person')
       OR NOT EXISTS (SELECT 1 FROM public.party_parties p WHERE p.id = v_payment.payer_party_id AND p.tenant_id = p_operation.tenant_id)
    THEN
        RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Command references do not match canonical financial rows.' USING ERRCODE = 'P0001';
    END IF;
    SELECT coalesce(sum(allocated_amount), 0) INTO v_invoice_total FROM public.edu_fin_reconciliation_ledger
      WHERE tenant_id = p_operation.tenant_id AND invoice_id = v_invoice.id;
    SELECT coalesce(sum(allocated_amount), 0) INTO v_payment_total FROM public.edu_fin_reconciliation_ledger
      WHERE tenant_id = p_operation.tenant_id AND payment_id = v_payment.id;
    IF EXISTS (SELECT 1 FROM public.edu_fin_reconciliation_ledger l
      WHERE l.tenant_id = p_operation.tenant_id AND (l.invoice_id = v_invoice.id OR l.payment_id = v_payment.id)
      AND (SELECT count(*) FROM public.edu_fin_receipts r WHERE r.tenant_id = l.tenant_id AND r.invoice_id = l.invoice_id AND r.payment_id = l.payment_id) <> 1) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Historical allocation/receipt partial state requires owner review.';
    END IF;
    IF v_invoice.net_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_invoice.paid_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_invoice.outstanding_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_payment.amount::text IN ('NaN','Infinity','-Infinity')
       OR v_payment.allocated_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_payment.unallocated_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_invoice_total IS DISTINCT FROM v_invoice.paid_amount
       OR v_invoice.outstanding_amount IS DISTINCT FROM greatest(0, v_invoice.net_amount - v_invoice_total)
       OR v_payment_total IS DISTINCT FROM v_payment.allocated_amount
       OR v_payment.unallocated_amount IS DISTINCT FROM v_payment.amount - v_payment_total
       OR v_payment_total < 0 OR v_payment_total > v_payment.amount
       OR v_payment.status NOT IN ('RECEIVED', 'RECONCILED')
       OR v_payment.status IS DISTINCT FROM (CASE WHEN v_payment.unallocated_amount = 0 THEN 'RECONCILED' ELSE 'RECEIVED' END)
       OR v_invoice.settlement_status IS DISTINCT FROM (CASE WHEN v_invoice_total >= v_invoice.net_amount THEN CASE WHEN v_invoice_total > v_invoice.net_amount THEN 'OVERPAID' ELSE 'PAID' END WHEN v_invoice_total > 0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END)
    THEN
        RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Balances disagree with persisted allocation facts; owner review required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.edu_fin_receipts r
      WHERE r.tenant_id=p_operation.tenant_id AND (r.invoice_id=v_invoice.id OR r.payment_id=v_payment.id)
        AND NOT EXISTS (SELECT 1 FROM public.edu_fin_reconciliation_ledger l
          WHERE l.tenant_id=r.tenant_id AND l.invoice_id=r.invoice_id AND l.payment_id=r.payment_id)) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Receipt has no matching allocation; owner review required.';
    END IF;
    IF jsonb_typeof(v_receipt.settlement_snapshot) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Receipt snapshot must be a canonical object.';
    END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(v_receipt.settlement_snapshot) k)
         IS DISTINCT FROM ARRAY['allocationAmount','invoiceId','invoiceNetAmount','issuedAt','newInvoiceOutstandingAmount','newInvoicePaidAmount','paymentId','receiptNumber','settlementStatus','tenantId']
       OR EXISTS (SELECT 1 FROM jsonb_each(v_receipt.settlement_snapshot) field
         WHERE jsonb_typeof(field.value) IS DISTINCT FROM
           (CASE WHEN field.key IN ('allocationAmount','invoiceNetAmount','newInvoiceOutstandingAmount','newInvoicePaidAmount') THEN 'number' ELSE 'string' END)) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Receipt snapshot keys and numeric/string types must match the canonical contract.';
    END IF;
    v_status := v_receipt.settlement_snapshot ->> 'settlementStatus';
    IF v_receipt.settlement_snapshot ->> 'tenantId' IS DISTINCT FROM p_operation.tenant_id::text
       OR v_receipt.settlement_snapshot ->> 'paymentId' IS DISTINCT FROM v_payment.id::text
       OR v_receipt.settlement_snapshot ->> 'invoiceId' IS DISTINCT FROM v_invoice.id::text
       OR v_receipt.settlement_snapshot ->> 'receiptNumber' IS DISTINCT FROM v_receipt.receipt_number
       OR (v_receipt.settlement_snapshot ->> 'allocationAmount')::numeric IS DISTINCT FROM v_entry.allocated_amount
       OR (v_receipt.settlement_snapshot ->> 'invoiceNetAmount')::numeric IS DISTINCT FROM v_invoice.net_amount
       OR (SELECT count(*) FROM jsonb_object_keys(v_receipt.settlement_snapshot)) <> 10
       OR v_receipt.settlement_snapshot ->> 'issuedAt' IS DISTINCT FROM to_char(v_receipt.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       OR (v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric < v_entry.allocated_amount
       OR (v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric > v_invoice_total
       OR (v_receipt.settlement_snapshot ->> 'newInvoiceOutstandingAmount')::numeric IS DISTINCT FROM greatest(0,v_invoice.net_amount-(v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric)
       OR v_status IS DISTINCT FROM (CASE WHEN (v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric >= v_invoice.net_amount THEN CASE WHEN (v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric > v_invoice.net_amount THEN 'OVERPAID' ELSE 'PAID' END WHEN (v_receipt.settlement_snapshot ->> 'newInvoicePaidAmount')::numeric > 0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END)
       OR v_receipt.sha256_fingerprint IS DISTINCT FROM encode(extensions.digest(convert_to(public.preschool_finance_snapshot_canonical(v_receipt.settlement_snapshot), 'UTF8'), 'sha256'), 'hex')
    THEN
        RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Receipt integrity does not match persisted financial facts.';
    END IF;
    RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'reconciliationEntry', to_jsonb(v_entry),
      'receipt', to_jsonb(v_receipt), 'updatedSettlementStatus', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_recover_finance_reconciliation(
    p_tenant_id uuid, p_actor_id uuid, p_operation_key text, p_request jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_operation public.edu_fin_reconciliation_operations%ROWTYPE;
BEGIN
    IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'FINANCE_OPERATION_KEY_REQUIRED: Stable operation key required.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('preschool-finance:' || p_tenant_id::text || ':' || p_operation_key, 0));
    SELECT * INTO v_operation FROM public.edu_fin_reconciliation_operations
      WHERE tenant_id = p_tenant_id AND operation_key = p_operation_key;
    IF v_operation.id IS NOT NULL THEN
      PERFORM 1 FROM public.edu_fin_invoices WHERE id = v_operation.invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
      PERFORM 1 FROM public.edu_fin_payments WHERE id = v_operation.payment_id AND tenant_id = p_tenant_id FOR UPDATE;
    END IF;
    -- Recheck after every potentially blocking command/balance lock; hold through commit.
    PERFORM public.preschool_finance_require_actor(p_tenant_id, p_actor_id);
    IF v_operation.id IS NULL THEN RETURN NULL; END IF;
    IF v_operation.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'AUTH_ROLE_PERMISSION_ERROR: Operation belongs to another actor.' USING ERRCODE = '42501';
    END IF;
    IF v_operation.request_payload IS DISTINCT FROM p_request THEN
      RAISE EXCEPTION 'FINANCE_OPERATION_CONFLICT: Operation key already exists with another payload.';
    END IF;
    RETURN public.preschool_finance_canonical_result(v_operation);
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_reconcile_finance_atomic(
    p_tenant_id uuid, p_actor_id uuid, p_operation_key text, p_request jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_operation public.edu_fin_reconciliation_operations%ROWTYPE;
    v_invoice public.edu_fin_invoices%ROWTYPE;
    v_payment public.edu_fin_payments%ROWTYPE;
    v_entry public.edu_fin_reconciliation_ledger%ROWTYPE;
    v_receipt public.edu_fin_receipts%ROWTYPE;
    v_kind text := p_request ->> 'kind';
    v_amount numeric;
    v_payer uuid;
    v_paid numeric;
    v_outstanding numeric;
    v_status text;
    v_snapshot jsonb;
    v_issued text;
    v_receipt_number text := 'RCT-' || gen_random_uuid()::text;
BEGIN
    IF p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'FINANCE_OPERATION_KEY_REQUIRED: Stable operation key required.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('preschool-finance:' || p_tenant_id::text || ':' || p_operation_key, 0));
    SELECT * INTO v_operation FROM public.edu_fin_reconciliation_operations
      WHERE tenant_id = p_tenant_id AND operation_key = p_operation_key;
    IF v_operation.id IS NOT NULL THEN
      RETURN public.preschool_recover_finance_reconciliation(p_tenant_id, p_actor_id, p_operation_key, p_request);
    END IF;
    IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR v_kind IS NULL
       OR (v_kind = 'new-payment' AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_request) k) IS DISTINCT FROM ARRAY['invoiceId','kind','paymentAmount','paymentMethod'])
       OR (v_kind = 'existing-payment' AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_request) k) IS DISTINCT FROM ARRAY['allocationAmount','invoiceId','kind','notes','paymentId'])
       OR v_kind NOT IN ('new-payment', 'existing-payment')
       OR jsonb_typeof(p_request -> CASE WHEN v_kind = 'new-payment' THEN 'paymentAmount' ELSE 'allocationAmount' END) IS DISTINCT FROM 'number'
    THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST: Exact normalized command payload required.'; END IF;
    v_amount := coalesce(p_request ->> 'paymentAmount', p_request ->> 'allocationAmount')::numeric;
    IF v_amount <= 0 OR v_amount >= 10000000000000 OR v_amount <> round(v_amount, 2)
       OR v_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT_ERROR: Positive NUMERIC(15,2) amount required without rounding.';
    END IF;
    IF v_kind = 'new-payment' AND p_request ->> 'paymentMethod' NOT IN ('BANK_TRANSFER', 'CASH', 'QR_CODE', 'CARD') THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_METHOD_ERROR: Unsupported payment method.';
    END IF;
    SELECT * INTO v_invoice FROM public.edu_fin_invoices
      WHERE id = (p_request ->> 'invoiceId')::uuid AND tenant_id = p_tenant_id FOR UPDATE;
    IF v_kind = 'existing-payment' THEN
      SELECT * INTO v_payment FROM public.edu_fin_payments
        WHERE id = (p_request ->> 'paymentId')::uuid AND tenant_id = p_tenant_id FOR UPDATE;
    END IF;
    -- Recovery checked actor before taking new locks; authority must be checked again AFTER them.
    PERFORM public.preschool_finance_require_actor(p_tenant_id, p_actor_id);
    IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND_ERROR: Invoice not found in tenant.'; END IF;
    IF v_invoice.net_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_invoice.paid_amount::text IN ('NaN','Infinity','-Infinity')
       OR v_invoice.outstanding_amount::text IN ('NaN','Infinity','-Infinity')
       OR (v_kind='existing-payment' AND (v_payment.amount::text IN ('NaN','Infinity','-Infinity')
         OR v_payment.allocated_amount::text IN ('NaN','Infinity','-Infinity')
         OR v_payment.unallocated_amount::text IN ('NaN','Infinity','-Infinity'))) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Nonfinite persisted financial amount requires owner review.';
    END IF;
    IF v_invoice.invoice_status <> 'ISSUED' OR v_invoice.is_archived THEN
      RAISE EXCEPTION 'UNISSUED_INVOICE_RECONCILIATION_ERROR: Active ISSUED invoice required.';
    END IF;
    IF v_kind = 'existing-payment' AND v_payment.id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND_ERROR: Payment not found in tenant.'; END IF;
    IF EXISTS (SELECT 1 FROM public.edu_fin_receipts r
      WHERE r.tenant_id=p_tenant_id AND (r.invoice_id=v_invoice.id OR r.payment_id=v_payment.id)
        AND NOT EXISTS (SELECT 1 FROM public.edu_fin_reconciliation_ledger l
          WHERE l.tenant_id=r.tenant_id AND l.invoice_id=r.invoice_id AND l.payment_id=r.payment_id)) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Receipt has no matching allocation; owner review required.';
    END IF;
    -- Existing duplicate pair remains an error when caller did not supply a durable key.
    IF EXISTS (SELECT 1 FROM public.edu_fin_reconciliation_ledger WHERE tenant_id = p_tenant_id AND invoice_id = v_invoice.id AND payment_id = v_payment.id) THEN
      RAISE EXCEPTION 'DUPLICATE_RECONCILIATION_ERROR: Payment/invoice pair already allocated.';
    END IF;
    IF v_invoice.student_party_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.party_parties p WHERE p.id = v_invoice.student_party_id AND p.tenant_id = p_tenant_id AND p.party_type = 'person' AND p.deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'STUDENT_PARTY_TENANT_MISMATCH: Canonical active Student Party required.'; END IF;
    -- Do not continue a historical financial unit that lacks a complete receipt.
    IF EXISTS (SELECT 1 FROM public.edu_fin_reconciliation_ledger l
      WHERE l.tenant_id = p_tenant_id AND (l.invoice_id = v_invoice.id OR l.payment_id = v_payment.id)
      AND (SELECT count(*) FROM public.edu_fin_receipts r WHERE r.tenant_id = l.tenant_id AND r.invoice_id = l.invoice_id AND r.payment_id = l.payment_id) <> 1) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Historical allocation/receipt partial state requires owner review.';
    END IF;
    IF v_invoice.paid_amount IS DISTINCT FROM (SELECT coalesce(sum(allocated_amount), 0) FROM public.edu_fin_reconciliation_ledger WHERE tenant_id = p_tenant_id AND invoice_id = v_invoice.id)
       OR v_invoice.net_amount < 0 OR v_invoice.paid_amount < 0
       OR v_invoice.settlement_status IS DISTINCT FROM (CASE WHEN v_invoice.paid_amount >= v_invoice.net_amount THEN CASE WHEN v_invoice.paid_amount > v_invoice.net_amount THEN 'OVERPAID' ELSE 'PAID' END WHEN v_invoice.paid_amount > 0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END)
       OR v_invoice.outstanding_amount IS DISTINCT FROM greatest(0, v_invoice.net_amount - v_invoice.paid_amount) THEN
      RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Existing invoice partial state requires owner review.';
    END IF;
    IF v_amount > v_invoice.outstanding_amount THEN RAISE EXCEPTION 'ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Allocation exceeds outstanding balance.'; END IF;
    IF v_kind = 'new-payment' THEN
      IF NOT EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id = p_tenant_id AND e.student_party_id = v_invoice.student_party_id AND e.status IN ('active','pending')) THEN
        RAISE EXCEPTION 'FINANCE_STUDENT_ENROLLMENT_REQUIRED: Active canonical enrollment required.';
      END IF;
      -- Preserve the existing first canonical guardian selection with a stable order.
      SELECT r.source_party_id INTO v_payer
        FROM public.party_relationships r JOIN public.party_parties p ON p.id = r.source_party_id AND p.tenant_id = p_tenant_id AND p.deleted_at IS NULL
        WHERE r.tenant_id = p_tenant_id AND r.target_party_id = v_invoice.student_party_id AND r.relationship_type = 'guardian_of'
        ORDER BY r.source_party_id LIMIT 1;
      IF v_payer IS NULL THEN RAISE EXCEPTION 'FINANCE_GUARDIAN_REQUIRED: Canonical active payer relationship required.'; END IF;
      INSERT INTO public.edu_fin_payments (tenant_id,payer_party_id,student_party_id,student_id,payment_number,payment_method,amount,allocated_amount,unallocated_amount,status,created_by)
        VALUES (p_tenant_id,v_payer,v_invoice.student_party_id,v_invoice.student_id,'PAY-' || gen_random_uuid()::text,p_request ->> 'paymentMethod',v_amount,0,v_amount,'RECEIVED',p_actor_id)
        RETURNING * INTO v_payment;
    ELSE
      IF v_payment.student_party_id IS DISTINCT FROM v_invoice.student_party_id THEN RAISE EXCEPTION 'PAYMENT_INVOICE_STUDENT_MISMATCH_ERROR: Canonical students differ.'; END IF;
      IF v_payment.status NOT IN ('RECEIVED','RECONCILED') THEN RAISE EXCEPTION 'FINANCE_PAYMENT_STATUS_ERROR: Payment is not allocatable.'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.party_parties WHERE id = v_payment.payer_party_id AND tenant_id = p_tenant_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'PAYER_PARTY_TENANT_MISMATCH: Canonical active payer required.';
      END IF;
      IF v_payment.allocated_amount IS DISTINCT FROM (SELECT coalesce(sum(allocated_amount), 0) FROM public.edu_fin_reconciliation_ledger WHERE tenant_id = p_tenant_id AND payment_id = v_payment.id)
        OR v_payment.allocated_amount < 0 OR v_payment.allocated_amount > v_payment.amount
        OR v_payment.status IS DISTINCT FROM (CASE WHEN v_payment.unallocated_amount = 0 THEN 'RECONCILED' ELSE 'RECEIVED' END)
        OR v_payment.unallocated_amount IS DISTINCT FROM v_payment.amount - v_payment.allocated_amount THEN
        RAISE EXCEPTION 'FINANCE_CANONICAL_CONFLICT: Existing payment partial state requires owner review.';
      END IF;
    END IF;
    IF v_amount > v_payment.unallocated_amount THEN RAISE EXCEPTION 'ALLOCATION_EXCEEDS_PAYMENT_UNALLOCATED_ERROR: Allocation exceeds unallocated balance.'; END IF;
    INSERT INTO public.edu_fin_reconciliation_ledger (tenant_id,payment_id,invoice_id,allocated_amount,reconciled_by_party_id,notes)
      VALUES (p_tenant_id,v_payment.id,v_invoice.id,v_amount,p_actor_id,p_request ->> 'notes') RETURNING * INTO v_entry;
    UPDATE public.edu_fin_payments SET allocated_amount = allocated_amount + v_amount, unallocated_amount = unallocated_amount - v_amount,
      status = CASE WHEN unallocated_amount - v_amount = 0 THEN 'RECONCILED' ELSE 'RECEIVED' END
      WHERE id = v_payment.id AND tenant_id = p_tenant_id RETURNING * INTO v_payment;
    v_paid := v_invoice.paid_amount + v_amount;
    v_outstanding := greatest(0, v_invoice.net_amount - v_paid);
    v_status := CASE WHEN v_paid >= v_invoice.net_amount THEN CASE WHEN v_paid > v_invoice.net_amount THEN 'OVERPAID' ELSE 'PAID' END WHEN v_paid > 0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END;
    UPDATE public.edu_fin_invoices SET paid_amount = v_paid, outstanding_amount = v_outstanding, settlement_status = v_status, updated_at = now()
      WHERE id = v_invoice.id AND tenant_id = p_tenant_id;
    v_issued := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_snapshot := jsonb_build_object('tenantId',p_tenant_id::text,'paymentId',v_payment.id::text,'invoiceId',v_invoice.id::text,
      'receiptNumber',v_receipt_number,'allocationAmount',v_amount,'invoiceNetAmount',v_invoice.net_amount,
      'newInvoicePaidAmount',v_paid,'newInvoiceOutstandingAmount',v_outstanding,'settlementStatus',v_status,'issuedAt',v_issued);
    INSERT INTO public.edu_fin_receipts (tenant_id,payment_id,invoice_id,receipt_number,settlement_snapshot,sha256_fingerprint,issued_at)
      VALUES (p_tenant_id,v_payment.id,v_invoice.id,v_receipt_number,v_snapshot,
        encode(extensions.digest(convert_to(public.preschool_finance_snapshot_canonical(v_snapshot),'UTF8'),'sha256'),'hex'),v_issued::timestamptz)
      RETURNING * INTO v_receipt;
    INSERT INTO public.edu_fin_reconciliation_operations (tenant_id,operation_key,actor_id,request_payload,payment_id,invoice_id,reconciliation_id,receipt_id)
      VALUES (p_tenant_id,p_operation_key,p_actor_id,p_request,v_payment.id,v_invoice.id,v_entry.id,v_receipt.id) RETURNING * INTO v_operation;
    RETURN public.preschool_finance_canonical_result(v_operation);
END;
$$;

REVOKE ALL ON FUNCTION public.preschool_finance_require_actor(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.preschool_finance_snapshot_canonical(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.preschool_finance_canonical_result(public.edu_fin_reconciliation_operations) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.preschool_recover_finance_reconciliation(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preschool_reconcile_finance_atomic(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_recover_finance_reconciliation(uuid,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.preschool_reconcile_finance_atomic(uuid,uuid,text,jsonb) TO service_role;

COMMIT;
