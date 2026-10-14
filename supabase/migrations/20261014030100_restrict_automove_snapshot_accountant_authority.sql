-- Owner-approved accountant-only authority; preserve the applied snapshot migration.
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
     actor_row.role IS DISTINCT FROM 'accountant' THEN
    RAISE EXCEPTION 'An active tenant accountant is required.';
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

REVOKE ALL ON FUNCTION public.guard_automove_financial_snapshot() FROM PUBLIC, anon, authenticated;

ALTER POLICY automove_snapshot_read ON public.auto_vehicle_sale_financial_snapshots
USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role = 'accountant')
);
ALTER POLICY automove_snapshot_draft ON public.auto_vehicle_sale_financial_snapshots
WITH CHECK (
  status = 'draft' AND approved_by IS NULL AND approved_at IS NULL AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
    AND u.tenant_id = auto_vehicle_sale_financial_snapshots.tenant_id
    AND u.status = 'active' AND u.role = 'accountant')
);
ALTER POLICY automove_sale_document_read ON storage.objects
USING (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role = 'accountant' AND u.tenant_id::text = (storage.foldername(name))[1]
));
ALTER POLICY automove_sale_document_upload ON storage.objects
WITH CHECK (bucket_id = 'automove-sale-documents' AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND u.role = 'accountant' AND u.tenant_id::text = (storage.foldername(name))[1]
));
