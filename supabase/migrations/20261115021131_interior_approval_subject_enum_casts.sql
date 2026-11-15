-- Keep approval subject validation as text, cast only at enum database boundaries.
CREATE OR REPLACE FUNCTION public.interior_create_customer_approval_request(p_approval JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := public.interior_actor_tenant();
  v_actor_id UUID := auth.uid();
  v_approval public.interior_customer_approvals%ROWTYPE;
  v_subject_type TEXT;
  v_subject_id UUID;
  v_project_id UUID;
  v_subject_version INTEGER;
  v_sent_at TIMESTAMPTZ;
  v_actor_name TEXT;
BEGIN
  IF v_tenant_id IS NULL OR v_actor_id IS NULL OR jsonb_typeof(p_approval) IS DISTINCT FROM 'object'
     OR (p_approval ->> 'tenant_id')::UUID IS DISTINCT FROM v_tenant_id
     OR (p_approval ->> 'sent_by_actor_id') IS DISTINCT FROM v_actor_id::TEXT THEN
    RAISE EXCEPTION 'AuthorizationViolation: approval actor and tenant must match the authenticated session';
  END IF;
  v_subject_type := p_approval ->> 'subject_type';
  v_subject_id := (p_approval ->> 'subject_id')::UUID;
  v_project_id := (p_approval ->> 'project_id')::UUID;
  v_subject_version := (p_approval ->> 'subject_version_number')::INTEGER;
  v_sent_at := (p_approval ->> 'sent_at')::TIMESTAMPTZ;
  IF p_approval ->> 'status' IS DISTINCT FROM 'pending'
     OR v_subject_type NOT IN ('quotation', 'contract')
     OR v_subject_version < 1
     OR NULLIF(btrim(p_approval ->> 'client_representative'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'client_contact'), '') IS NULL
     OR NULLIF(btrim(p_approval ->> 'sent_by_actor_name'), '') IS NULL
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ <= clock_timestamp()
     OR (p_approval ->> 'expires_at')::TIMESTAMPTZ > clock_timestamp() + INTERVAL '365 days' THEN
    RAISE EXCEPTION 'INTERIOR_APPROVAL_REQUEST_INVALID';
  END IF;
  SELECT actor.full_name INTO v_actor_name
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = v_actor_id AND actor.tenant_id = v_tenant_id;
  IF NOT FOUND OR NULLIF(btrim(v_actor_name), '') IS NULL
     OR length(btrim(v_actor_name)) > 200 THEN
    RAISE EXCEPTION 'AuthorizationViolation: canonical active actor name is required';
  END IF;
  IF NOT public.interior_has_permission('interior:contract:write', v_tenant_id, v_project_id, NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped contract write permission is required';
  END IF;

  UPDATE public.interior_customer_approvals a
  SET status = 'superseded', customer_notes = 'Superseded by a newer approval request', updated_at = clock_timestamp()
  WHERE a.tenant_id = v_tenant_id AND a.subject_type = v_subject_type::public.interior_approval_subject_type
    AND a.subject_id = v_subject_id AND a.status = 'pending';

  IF v_subject_type = 'quotation' THEN
    UPDATE public.interior_quotations q
    SET status = CASE WHEN q.status = 'draft' THEN 'sent_to_client' ELSE q.status END,
        sent_to_client_at = COALESCE(q.sent_to_client_at, v_sent_at),
        latest_approval_status = 'pending', latest_approval_sent_at = v_sent_at,
        latest_approved_at = NULL, latest_rejected_at = NULL
    WHERE q.tenant_id = v_tenant_id AND q.project_id = v_project_id
      AND q.id = v_subject_id AND q.version_number = v_subject_version
      AND q.status IN ('draft', 'sent_to_client', 'negotiating');
  ELSE
    UPDATE public.interior_contracts c
    SET status = CASE WHEN c.status = 'draft' THEN 'in_review' ELSE c.status END,
        updated_at = v_sent_at
    WHERE c.tenant_id = v_tenant_id AND c.project_id = v_project_id
      AND c.id = v_subject_id AND c.status IN ('draft', 'in_review');
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERIOR_APPROVAL_SUBJECT_STALE'; END IF;

  INSERT INTO public.interior_customer_approvals (
    id, tenant_id, project_id, subject_type, subject_id, subject_version_number,
    approval_token, status, client_representative, client_contact, sent_at, expires_at,
    sent_by_actor_id, sent_by_actor_name, created_at, updated_at
  ) VALUES (
    (p_approval ->> 'id')::UUID, v_tenant_id, v_project_id, v_subject_type::public.interior_approval_subject_type,
    v_subject_id, v_subject_version, (p_approval ->> 'approval_token')::UUID,
    'pending', btrim(p_approval ->> 'client_representative'), btrim(p_approval ->> 'client_contact'),
    v_sent_at, (p_approval ->> 'expires_at')::TIMESTAMPTZ,
    v_actor_id::TEXT, btrim(v_actor_name),
    (p_approval ->> 'created_at')::TIMESTAMPTZ, (p_approval ->> 'updated_at')::TIMESTAMPTZ
  ) RETURNING * INTO v_approval;
  RETURN to_jsonb(v_approval);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_customer_approval_request(JSONB)
  TO authenticated;
