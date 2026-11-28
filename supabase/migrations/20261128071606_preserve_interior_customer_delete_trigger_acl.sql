-- Remove the public/anon RPC surface from the trigger-only guard function.
-- Keep application and trusted backend privileges for existing trigger use.
REVOKE ALL ON FUNCTION public.interior_prevent_customer_hard_delete()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_prevent_customer_hard_delete()
  TO authenticated, service_role;
