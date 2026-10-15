-- Protect the same balance when collection enters through the existing deposit API.
-- No receipt mutation, additional write grants, or refund policy is introduced.
CREATE FUNCTION public.guard_automove_deposit_collection_cap()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  recognized_total NUMERIC;
  post_sale_total NUMERIC;
  confirmed_total NUMERIC;
  recognized_count INTEGER;
  previous_id UUID;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.auto_bookings
    WHERE id=NEW.booking_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO post_sale_total
    FROM public.auto_vehicle_sale_payments
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id;
  -- Before the first post-sale receipt, retain the established deposit contract.
  IF post_sale_total = 0 THEN RETURN NEW; END IF;
  SELECT count(*),sum(r.sale_price_recognized + coalesce((
    SELECT sum(a.sale_price_delta) FROM public.auto_vehicle_sale_recognition_adjustments a
      WHERE a.recognition_id=r.id AND a.tenant_id=r.tenant_id
  ),0)) INTO recognized_count,recognized_total
    FROM public.auto_vehicle_sale_recognitions r
    WHERE r.booking_id=NEW.booking_id AND r.tenant_id=NEW.tenant_id;
  IF TG_OP = 'UPDATE' THEN previous_id := OLD.id; END IF;
  SELECT coalesce(sum(amount),0) INTO confirmed_total FROM public.auto_deposits
    WHERE booking_id=NEW.booking_id AND tenant_id=NEW.tenant_id AND status='confirmed'
      AND id IS DISTINCT FROM previous_id;
  IF recognized_count <> 1 OR recognized_total IS NULL OR
     confirmed_total + post_sale_total + NEW.amount > recognized_total THEN
    RAISE EXCEPTION 'Combined collections exceed the canonical recognized sale balance.'
      USING ERRCODE='23514', CONSTRAINT='automove_combined_collection_cap';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_automove_deposit_collection_cap() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_automove_deposit_collection_cap
  BEFORE INSERT OR UPDATE OF amount,status,booking_id,tenant_id ON public.auto_deposits
  FOR EACH ROW EXECUTE FUNCTION public.guard_automove_deposit_collection_cap();
