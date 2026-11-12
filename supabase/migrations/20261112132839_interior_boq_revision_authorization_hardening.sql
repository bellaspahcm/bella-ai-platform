-- =============================================================================
-- Bella Interior OS — BOQ revision RPC authorization hardening
-- Forward-only repair for migration 20261110190000.
--
-- The original SECURITY DEFINER implementation accepted caller-supplied tenant
-- and actor IDs and retained PostgreSQL's default PUBLIC EXECUTE grant. Keep its
-- atomic copy implementation private to this authorization-checked wrapper.
-- =============================================================================

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.fork_interior_boq_revision(uuid,uuid,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected public.fork_interior_boq_revision function is missing';
  END IF;
  IF to_regprocedure('public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Internal BOQ fork function already exists; refusing to overwrite';
  END IF;
  IF to_regprocedure('public.interior_actor_tenant()') IS NULL
     OR to_regprocedure('public.interior_has_permission(text,uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Canonical Interior actor or permission function is missing';
  END IF;
END;
$preflight$;

ALTER FUNCTION public.fork_interior_boq_revision(uuid,uuid,uuid,text,text)
  RENAME TO _fork_interior_boq_revision_unchecked;

ALTER FUNCTION public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text)
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._fork_interior_boq_revision_unchecked(uuid,uuid,uuid,text,text) IS
  'Internal atomic BOQ revision copy implementation; callable only by the authenticated authorization wrapper.';

CREATE FUNCTION public.fork_interior_boq_revision(
  p_tenant_id uuid,
  p_source_boq_id uuid,
  p_actor_id uuid,
  p_release_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_tenant_id uuid;
  v_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated Interior actor is required';
  END IF;

  v_actor_tenant_id := public.interior_actor_tenant();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'TenantIsolationViolation: request tenant does not match the authenticated Interior actor';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AuthorizationViolation: actor_id must match the authenticated user';
  END IF;

  SELECT b.project_id
    INTO v_project_id
  FROM public.interior_boqs AS b
  WHERE b.id = p_source_boq_id
    AND b.tenant_id = v_actor_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOQNotFound: Source BOQ % not found for authenticated tenant', p_source_boq_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.interior_has_permission('interior:boq:read', v_actor_tenant_id, v_project_id, NULL)
     OR NOT public.interior_has_permission('interior:boq:create', v_actor_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped BOQ read and create permissions are required';
  END IF;

  RETURN public._fork_interior_boq_revision_unchecked(
    p_tenant_id,
    p_source_boq_id,
    p_actor_id,
    p_release_notes,
    p_idempotency_key
  );
END;
$$;

COMMENT ON FUNCTION public.fork_interior_boq_revision(uuid,uuid,uuid,text,text) IS
  'Authorization-checked BOQ revision fork. Requires a live authenticated Interior actor, matching tenant and actor IDs, and scoped BOQ read/create permissions.';

REVOKE ALL ON FUNCTION public.fork_interior_boq_revision(uuid,uuid,uuid,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fork_interior_boq_revision(uuid,uuid,uuid,text,text)
  TO authenticated;

COMMIT;
