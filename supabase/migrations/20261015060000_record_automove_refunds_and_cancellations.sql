-- Cash refunds and operational cancellation only: no revenue or journal posting.
CREATE TABLE public.auto_vehicle_sale_settlement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  idempotency_key UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('refund','cancel')),
  source_deposit_id UUID REFERENCES public.auto_deposits(id),
  source_payment_id UUID REFERENCES public.auto_vehicle_sale_payments(id),
  amount NUMERIC(18,0) NOT NULL CHECK (amount >= 0 AND amount <= 9007199254740991),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  source_document JSONB NOT NULL CHECK (jsonb_typeof(source_document) = 'object'),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT automove_settlement_key UNIQUE(tenant_id,idempotency_key),
  CONSTRAINT automove_settlement_source CHECK (
    (action_type='cancel' AND amount=0 AND source_deposit_id IS NULL AND source_payment_id IS NULL) OR
    (action_type='refund' AND amount>0 AND num_nonnulls(source_deposit_id,source_payment_id)=1)
  )
);
-- zero-downtime: allow blocking-index - The new action table is empty.
CREATE INDEX automove_settlement_booking ON public.auto_vehicle_sale_settlement_actions(tenant_id,booking_id,created_at,id);
-- zero-downtime: allow blocking-index - One cancellation fact per booking in the new table.
CREATE UNIQUE INDEX automove_settlement_cancel ON public.auto_vehicle_sale_settlement_actions(tenant_id,booking_id)
  WHERE action_type='cancel';

CREATE FUNCTION public.guard_automove_settlement_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  original_amount NUMERIC;
  returned_amount NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Settlement actions are append-only.'; END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.role='accountant' AND u.status='active'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN RAISE EXCEPTION 'An active tenant accountant is required.'; END IF;
  PERFORM id FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement booking is outside the actor tenant.'; END IF;
  IF NEW.source_document->>'bucket' IS DISTINCT FROM 'automove-sale-documents' OR
    split_part(NEW.source_document->>'path','/',1) IS DISTINCT FROM NEW.tenant_id::text OR
    coalesce(NEW.source_document->>'sha256','') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Tenant source document and checksum are required.';
  END IF;
  IF NEW.action_type='refund' THEN
    IF NEW.source_deposit_id IS NOT NULL THEN
      SELECT amount INTO original_amount FROM public.auto_deposits
        WHERE id=NEW.source_deposit_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status='confirmed';
    ELSE
      SELECT amount INTO original_amount FROM public.auto_vehicle_sale_payments
        WHERE id=NEW.source_payment_id AND booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
    END IF;
    IF original_amount IS NULL THEN RAISE EXCEPTION 'Confirmed original receipt is required.'; END IF;
    SELECT coalesce(sum(amount),0) INTO returned_amount FROM public.auto_vehicle_sale_settlement_actions
      WHERE tenant_id=NEW.tenant_id AND action_type='refund' AND
        (source_deposit_id=NEW.source_deposit_id OR source_payment_id=NEW.source_payment_id);
    IF returned_amount+NEW.amount > original_amount THEN RAISE EXCEPTION 'Refund exceeds the unrefunded original receipt.'; END IF;
  END IF;
  NEW.created_at := statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_automove_settlement_action BEFORE INSERT OR UPDATE OR DELETE
  ON public.auto_vehicle_sale_settlement_actions FOR EACH ROW EXECUTE FUNCTION public.guard_automove_settlement_action();
REVOKE ALL ON FUNCTION public.guard_automove_settlement_action() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.auto_vehicle_sale_settlement_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_settlement_actions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.auto_vehicle_sale_settlement_actions TO authenticated;
GRANT SELECT,INSERT ON public.auto_vehicle_sale_settlement_actions TO service_role;
CREATE POLICY automove_settlement_read ON public.auto_vehicle_sale_settlement_actions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_settlement_actions.tenant_id)
);
COMMENT ON TABLE public.auto_vehicle_sale_settlement_actions IS
  'Immutable receipt-linked manual refund and independent cancellation facts; not revenue adjustments or Finance postings.';

-- Forward-align the existing receipt cap with net cash; preserve every prior guard.
CREATE OR REPLACE FUNCTION public.guard_automove_post_sale_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  refund_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'AutoMove sale receipts are append-only.'; END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN RAISE EXCEPTION 'An active tenant accountant must record the receipt.'; END IF;
  SELECT * INTO booking_row FROM public.auto_bookings WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF booking_row.id IS NULL OR booking_row.status='cancelled' OR booking_row.payment_status='refunded' THEN
    RAISE EXCEPTION 'Booking is unavailable for collection.';
  END IF;
  SELECT * INTO recognition_row FROM public.auto_vehicle_sale_recognitions
    WHERE id=NEW.recognition_id AND tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  IF recognition_row.id IS NULL OR recognition_row.customer_id IS DISTINCT FROM booking_row.customer_id OR
     recognition_row.vehicle_id IS DISTINCT FROM booking_row.vehicle_id OR
     (SELECT count(*) FROM public.auto_vehicle_sale_recognitions WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id) <> 1 THEN
    RAISE EXCEPTION 'Receipt must reference the canonical sale for this booking.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id AND
      (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN ('refund_recorded','sale_revenue_reversed'))) THEN
    RAISE EXCEPTION 'Settlement requires resolution of refund/reversal adjustments.';
  END IF;
  SELECT coalesce(sum(amount),0) INTO deposit_total FROM public.auto_deposits
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND status='confirmed';
  IF deposit_total IS DISTINCT FROM booking_row.deposit_paid OR
     recognition_row.payment_received_total <> recognition_row.deposit_received_total OR
     recognition_row.receivable_amount_at_recognition <> recognition_row.sale_price_recognized-recognition_row.payment_received_total OR
     deposit_total < recognition_row.deposit_received_total THEN
    RAISE EXCEPTION 'Receipt/deposit reconciliation mismatch.';
  END IF;
  SELECT coalesce(sum(sale_price_delta),0) INTO price_delta FROM public.auto_vehicle_sale_recognition_adjustments
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id;
  SELECT coalesce(sum(amount),0) INTO payment_total FROM public.auto_vehicle_sale_payments
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id;
  SELECT coalesce(sum(amount),0) INTO refund_total FROM public.auto_vehicle_sale_settlement_actions
    WHERE tenant_id=NEW.tenant_id AND booking_id=NEW.booking_id AND action_type='refund';
  IF deposit_total+payment_total-refund_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION 'Receipt exceeds the remaining recognized sale amount.';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
$$;
