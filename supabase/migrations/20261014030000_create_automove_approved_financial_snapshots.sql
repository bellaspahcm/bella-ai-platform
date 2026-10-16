-- AutoMove financial source snapshots. Approval is a separate server action.
CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sale_transaction_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (btrim(idempotency_key) <> ''),
  booking_id UUID NOT NULL REFERENCES public.auto_bookings(id),
  vehicle_id UUID NOT NULL REFERENCES public.auto_vehicles(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  sale_price NUMERIC(18,0) NOT NULL CHECK (sale_price > 0),
  discount_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  cost_basis NUMERIC(18,0) NOT NULL CHECK (cost_basis >= 0),
  sale_document JSONB NOT NULL,
  cost_document JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  CONSTRAINT automove_snapshot_discount CHECK (discount_amount < sale_price),
  CONSTRAINT automove_snapshot_approval CHECK (
    (status = 'draft' AND approved_by IS NULL AND approved_at IS NULL) OR
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT automove_snapshot_transaction UNIQUE (tenant_id, sale_transaction_id),
  CONSTRAINT automove_snapshot_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT automove_snapshot_booking_vehicle UNIQUE (tenant_id, booking_id, vehicle_id),
  CONSTRAINT automove_snapshot_sale_document CHECK (
    jsonb_typeof(sale_document) = 'object' AND
    coalesce(sale_document->>'bucket', '') <> '' AND
    coalesce(sale_document->>'path', '') <> '' AND
    coalesce(sale_document->>'sha256', '') ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT automove_snapshot_cost_document CHECK (
    jsonb_typeof(cost_document) = 'object' AND
    coalesce(cost_document->>'bucket', '') <> '' AND
    coalesce(cost_document->>'path', '') <> '' AND
    coalesce(cost_document->>'sha256', '') ~ '^[a-f0-9]{64}$'
  )
);

CREATE OR REPLACE FUNCTION public.guard_automove_financial_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_row RECORD;
  booking_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial source snapshots cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' OR NEW.status <> 'approved' OR
       (to_jsonb(NEW) - ARRAY['status','approved_by','approved_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','approved_by','approved_at']) THEN
      RAISE EXCEPTION 'Only draft approval is allowed; financial snapshots are immutable.';
    END IF;
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Snapshot approval requires the server action.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Approval actor must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.approved_by;
  ELSE
    IF NEW.status <> 'draft' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'New snapshots must be unapproved drafts.';
    END IF;
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Snapshot creator must match authenticated identity.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = NEW.created_by;
  END IF;
  IF actor_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     actor_row.status IS DISTINCT FROM 'active' OR
     actor_row.role IS NULL OR actor_row.role NOT IN ('accountant','finance_manager') THEN
    RAISE EXCEPTION 'An active tenant accountant or finance manager is required.';
  END IF;
  SELECT tenant_id, customer_id, vehicle_id, status, payment_status INTO booking_row
    FROM public.auto_bookings WHERE id = NEW.booking_id;
  IF booking_row.tenant_id IS DISTINCT FROM NEW.tenant_id OR
     booking_row.customer_id IS DISTINCT FROM NEW.customer_id OR
     booking_row.vehicle_id IS DISTINCT FROM NEW.vehicle_id OR
     booking_row.status = 'cancelled' OR booking_row.payment_status = 'refunded' OR
     NOT EXISTS (SELECT 1 FROM public.auto_vehicles WHERE id = NEW.vehicle_id AND tenant_id = NEW.tenant_id) OR
     NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Snapshot business references are invalid.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_automove_financial_snapshot ON public.auto_vehicle_sale_financial_snapshots;
CREATE TRIGGER guard_automove_financial_snapshot BEFORE INSERT OR UPDATE OR DELETE
ON public.auto_vehicle_sale_financial_snapshots FOR EACH ROW
EXECUTE FUNCTION public.guard_automove_financial_snapshot();

ALTER TABLE public.auto_vehicle_sale_financial_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_vehicle_sale_financial_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.auto_vehicle_sale_financial_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.auto_vehicle_sale_financial_snapshots TO service_role;
CREATE POLICY automove_snapshot_read ON public.auto_vehicle_sale_financial_snapshots
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role IN ('accountant','finance_manager'))
);
CREATE POLICY automove_snapshot_draft ON public.auto_vehicle_sale_financial_snapshots
FOR INSERT TO authenticated WITH CHECK (
  status = 'draft' AND approved_by IS NULL AND approved_at IS NULL AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role IN ('accountant','finance_manager'))
);

REVOKE ALL ON FUNCTION public.guard_automove_financial_snapshot() FROM PUBLIC, anon, authenticated;

-- Reuse Platform Storage for the source documents; content is write-once.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('automove-sale-documents', 'automove-sale-documents', false, 20971520,
  ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY automove_sale_document_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role IN ('accountant','finance_manager') AND u.tenant_id::text = (storage.foldername(name))[1]
));
CREATE POLICY automove_sale_document_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role IN ('accountant','finance_manager') AND u.tenant_id::text = (storage.foldername(name))[1]
));
