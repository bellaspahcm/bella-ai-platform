-- Interior trigger-function hardening.
-- Trigger helpers are not application RPCs. Their EXECUTE privilege is needed
-- when CREATE TRIGGER binds them, not for an existing trigger to fire.
-- Keep their function bodies on a fixed system-only search_path so SECURITY
-- DEFINER trigger code cannot resolve attacker-controlled objects.

BEGIN;

ALTER FUNCTION public.guard_interior_quotation_items_immutability()
  SET search_path = pg_catalog;
ALTER FUNCTION public.guard_interior_quotations_immutability()
  SET search_path = pg_catalog;
ALTER FUNCTION public.guard_interior_contracts_immutability()
  SET search_path = pg_catalog;
ALTER FUNCTION public.guard_interior_payment_milestones_immutability()
  SET search_path = pg_catalog;
ALTER FUNCTION public.guard_interior_customer_approvals_immutability()
  SET search_path = pg_catalog;
ALTER FUNCTION public.interior_customer_approvals_updated_at()
  SET search_path = pg_catalog;
ALTER FUNCTION public.trg_record_interior_boq_item_history()
  SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.guard_interior_quotation_items_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_interior_quotations_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_interior_contracts_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_interior_payment_milestones_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_interior_customer_approvals_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.interior_customer_approvals_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.interior_guard_boq_approval()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.trg_record_interior_boq_item_history()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
