-- Keep timestamp ownership on the database while authenticated callers retain
-- only the narrow contact/address UPDATE column privileges.
BEGIN;

CREATE OR REPLACE FUNCTION public.interior_crm_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_crm_touch_updated_at() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_interior_customer_contacts_updated_at ON public.interior_customer_contacts;
CREATE TRIGGER trg_interior_customer_contacts_updated_at
  BEFORE UPDATE ON public.interior_customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_interior_customer_addresses_updated_at ON public.interior_customer_addresses;
CREATE TRIGGER trg_interior_customer_addresses_updated_at
  BEFORE UPDATE ON public.interior_customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();

COMMIT;
