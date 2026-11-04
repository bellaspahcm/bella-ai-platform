-- Migration: 20261031090000_fix_edu_announcements_rls_and_portal_read.sql
-- Scope: Education Product — Fix school announcement RLS and Parent Portal feed synchronization
--
-- 1. Fix RLS policy on public.edu_announcements:
--    Use public.get_auth_tenant_id() for authenticated browser sessions instead of
--    the non-existent current_setting('app.current_tenant_id').
--    Matches 20261030140000_fix_enrollment_rls_auth_tenant_helper.sql pattern.
--
-- 2. Update preschool_portal_school_announcements_read():
--    Point to public.edu_announcements so parents on the portal see announcements
--    published by the school admin.

BEGIN;

-- ─── 1. Fix RLS on public.edu_announcements ─────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_edu_announcements ON public.edu_announcements;

CREATE POLICY tenant_isolation_edu_announcements
  ON public.edu_announcements FOR ALL
  USING (
    tenant_id = public.get_auth_tenant_id()
    OR current_setting('role', true) = 'service_role'
  )
  WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    OR current_setting('role', true) = 'service_role'
  );

-- ─── 2. Point Portal Feed to edu_announcements ──────────────────────────────
CREATE OR REPLACE FUNCTION public.preschool_portal_school_announcements_read(p_tenant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND t.status = 'active'
      AND t.product_key = 'bella_preschool'
  ) THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          q.id,
        'title',       q.title,
        'bodyText',    q.body_text,
        'publishedAt', to_char(q.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      ORDER BY q.published_at DESC, q.id DESC
    ),
    '[]'::jsonb
  )
  INTO v_feed
  FROM (
    SELECT a.id, a.title, a.body_text, a.published_at
    FROM public.edu_announcements a
    WHERE a.tenant_id = p_tenant_id
    ORDER BY a.published_at DESC, a.id DESC
    LIMIT 100
  ) q;

  RETURN jsonb_build_object(
    'tenantId',      p_tenant_id,
    'announcements', v_feed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preschool_portal_school_announcements_read(UUID) TO service_role;

COMMIT;
