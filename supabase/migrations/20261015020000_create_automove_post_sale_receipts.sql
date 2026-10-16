-- Operational receipt facts only. No Finance posting or historical mutation.
CREATE TABLE public.auto_vehicle_sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  recognition_id UUID NOT NULL REFERENCES public.auto_vehicle_sale_recognitions(id),
  idempotency_key UUID NOT NULL,
  amount NUMERIC(18,0) NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank_transfer','card')),
  transaction_ref TEXT CHECK (transaction_ref IS NULL OR
    (transaction_ref = btrim(transaction_ref) AND length(transaction_ref) BETWEEN 1 AND 200)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  received_by UUID NOT NULL REFERENCES public.users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automove_sale_payment_key UNIQUE (tenant_id,idempotency_key),
  CONSTRAINT automove_sale_payment_reference_required CHECK (
    payment_method = 'cash' OR transaction_ref IS NOT NULL)
);
-- zero-downtime: allow blocking-index - Indexes target only the new empty receipt table.
CREATE INDEX automove_sale_payment_booking ON public.auto_vehicle_sale_payments(tenant_id,booking_id,received_at,id);
-- zero-downtime: allow blocking-index - Unique reference index targets the same new empty table.
CREATE UNIQUE INDEX automove_sale_payment_reference ON public.auto_vehicle_sale_payments(tenant_id,payment_method,transaction_ref)
  WHERE transaction_ref IS NOT NULL;

CREATE FUNCTION public.guard_automove_post_sale_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  booking_row RECORD;
  recognition_row RECORD;
  deposit_total NUMERIC;
  payment_total NUMERIC;
  price_delta NUMERIC;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'AutoMove sale receipts are append-only.';
  END IF;
  IF NEW.received_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant'
      AND u.tenant_id=NEW.tenant_id AND t.status='active'
  ) THEN
    RAISE EXCEPTION 'An active tenant accountant must record the receipt.';
  END IF;
  SELECT * INTO booking_row FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
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
    WHERE tenant_id=NEW.tenant_id AND recognition_id=NEW.recognition_id
      AND (refund_amount<>0 OR receivable_delta<>sale_price_delta OR adjustment_type IN ('refund_recorded','sale_revenue_reversed'))) THEN
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
  IF deposit_total+payment_total+NEW.amount > recognition_row.sale_price_recognized+price_delta THEN
    RAISE EXCEPTION 'Receipt exceeds the remaining recognized sale amount.';
  END IF;
  NEW.received_at := statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_automove_post_sale_receipt BEFORE INSERT OR UPDATE OR DELETE
  ON public.auto_vehicle_sale_payments FOR EACH ROW EXECUTE FUNCTION public.guard_automove_post_sale_receipt();
REVOKE ALL ON FUNCTION public.guard_automove_post_sale_receipt() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.auto_vehicle_sale_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_payments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.auto_vehicle_sale_payments TO authenticated,service_role;
CREATE POLICY automove_sale_payment_read ON public.auto_vehicle_sale_payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_payments.tenant_id)
);
CREATE POLICY automove_sale_payment_insert ON public.auto_vehicle_sale_payments FOR INSERT TO authenticated WITH CHECK (
  received_by=auth.uid() AND EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=auth.uid() AND u.status='active' AND u.role='accountant' AND t.status='active'
      AND u.tenant_id=auto_vehicle_sale_payments.tenant_id)
);
COMMENT ON TABLE public.auto_vehicle_sale_payments IS
  'Append-only AutoMove post-sale collection receipts; not Finance postings or revenue recognition.';
