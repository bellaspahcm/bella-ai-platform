-- Prevent staff identity or caller-supplied names from being treated as
-- customer acceptance. A dedicated token-backed customer evidence transition
-- must be deployed before handovers can be completed through the application.
REVOKE ALL ON FUNCTION public.interior_create_handover_dossier(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.interior_create_handover_dossier(uuid, text) IS
  'Disabled: this legacy RPC marked handover accepted from staff-supplied customer name without customer-issued evidence.';
