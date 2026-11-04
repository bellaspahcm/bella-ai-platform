-- Add the owner-approved Preschool announcement action boundary at the DB layer.
-- This migration is a local candidate only; it has not been applied to any DB.
BEGIN;

-- The existing tenant policy remains permissive. This restrictive INSERT policy
-- additionally requires an active Preschool admin with current access to every
-- active branch, including when a caller writes directly through PostgREST.
CREATE POLICY preschool_announcement_admin_all_branches_insert
  ON public.edu_announcements
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND created_by = auth.uid()
    AND published_at <= now()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.tenants t ON t.id = u.tenant_id
      WHERE u.id = auth.uid()
        AND u.tenant_id = public.edu_announcements.tenant_id
        AND u.status = 'active'
        AND lower(u.role) = 'admin'
        AND t.status = 'active'
        AND t.product_key = 'bella_preschool'
    )
    AND EXISTS (
      SELECT 1 FROM public.org_units b
      WHERE b.tenant_id = public.edu_announcements.tenant_id
        AND b.unit_type = 'branch' AND b.is_active
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.org_units b
      WHERE b.tenant_id = public.edu_announcements.tenant_id
        AND b.unit_type = 'branch' AND b.is_active
        AND NOT EXISTS (
          SELECT 1 FROM public.platform_current_actor_org_unit_access() a
          WHERE a.user_id = auth.uid()
            AND a.tenant_id = public.edu_announcements.tenant_id
            AND a.org_unit_id = b.id
        )
    )
  );

CREATE OR REPLACE FUNCTION public.preschool_publish_school_announcement(
  p_request_id UUID,
  p_title TEXT,
  p_body_text TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_tenant_id UUID;
  v_row public.edu_announcements%ROWTYPE;
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF v_actor_id IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Bind actor, tenant, Product, and role to current Auth-backed rows.
  SELECT u.tenant_id INTO v_tenant_id
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE a.id = v_actor_id
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= now())
    AND u.status = 'active'
    AND lower(u.role) = 'admin'
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
  FOR SHARE OF a, u, t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_units b
    WHERE b.tenant_id = v_tenant_id AND b.unit_type = 'branch' AND b.is_active
  ) OR EXISTS (
    SELECT 1 FROM public.org_units b
    WHERE b.tenant_id = v_tenant_id AND b.unit_type = 'branch' AND b.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_org_unit_access_for_actor(v_tenant_id, v_actor_id) a
        WHERE a.user_id = v_actor_id AND a.tenant_id = v_tenant_id AND a.org_unit_id = b.id
      )
  ) THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL
    OR p_title IS NULL OR char_length(trim(p_title)) NOT BETWEEN 1 AND 200
    OR p_body_text IS NULL OR char_length(trim(p_body_text)) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.edu_announcements (tenant_id, request_id, title, body_text, created_by)
  VALUES (v_tenant_id, p_request_id, trim(p_title), trim(p_body_text), v_actor_id)
  ON CONFLICT (tenant_id, request_id) DO NOTHING
  RETURNING * INTO v_row;
  v_inserted := FOUND;

  IF NOT v_inserted THEN
    SELECT * INTO v_row
    FROM public.edu_announcements
    WHERE tenant_id = v_tenant_id AND request_id = p_request_id
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_REQUEST_CONFLICT' USING ERRCODE = '23505';
    END IF;
    IF v_row.title IS DISTINCT FROM trim(p_title)
      OR v_row.body_text IS DISTINCT FROM trim(p_body_text) THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_REQUEST_CONFLICT' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'bodyText', v_row.body_text,
    'publishedAt', to_char(v_row.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'duplicate', NOT v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preschool_publish_school_announcement(UUID, TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_publish_school_announcement(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
