-- Separate server-only draft correction; approved financial evidence stays immutable.
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
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Approved financial snapshots are immutable.';
    END IF;
    IF current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Snapshot changes require the server action.';
    END IF;
    IF NEW.status = 'draft' THEN
      IF (to_jsonb(NEW) - ARRAY['sale_price','discount_amount','cost_basis','sale_document','cost_document']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['sale_price','discount_amount','cost_basis','sale_document','cost_document']) THEN
        RAISE EXCEPTION 'Draft correction can change only financial values and source documents.';
      END IF;
    ELSIF NEW.status = 'approved' THEN
      IF (to_jsonb(NEW) - ARRAY['status','approved_by','approved_at']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','approved_by','approved_at']) THEN
        RAISE EXCEPTION 'Approval cannot change financial values or source documents.';
      END IF;
      IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Approval actor must match authenticated identity.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid financial snapshot state transition.';
    END IF;
    SELECT tenant_id, role, status INTO actor_row FROM public.users WHERE id = auth.uid();
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
     actor_row.status IS DISTINCT FROM 'active' OR actor_row.role IS DISTINCT FROM 'accountant' THEN
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
