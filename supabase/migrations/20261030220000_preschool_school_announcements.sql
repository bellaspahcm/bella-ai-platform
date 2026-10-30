-- Migration: 20261030220000_preschool_school_announcements.sql
-- Scope: Education Product — School Announcements
-- Creates edu_announcements table + tenant-isolated RLS + two RPCs:
--   preschool_list_school_announcements  (GET  /api/education/announcements)
--   preschool_publish_school_announcement (POST /api/education/announcements)
-- Authority: Education Product layer only. No Kernel (H1-H12, E7.x) tables touched.

BEGIN;

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.edu_announcements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id    UUID        NOT NULL,                        -- idempotency key
  title         TEXT        NOT NULL CHECK (char_length(trim(title))    BETWEEN 1 AND 200),
  body_text     TEXT        NOT NULL CHECK (char_length(trim(body_text)) BETWEEN 1 AND 20000),
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID        REFERENCES auth.users(id),
  UNIQUE (tenant_id, request_id)                            -- duplicate-request guard
);

-- Indexes
-- zero-downtime: allow blocking-index - index on newly created edu_announcements table
CREATE INDEX IF NOT EXISTS idx_edu_announcements_tenant_published
  ON public.edu_announcements (tenant_id, published_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.edu_announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'edu_announcements' AND policyname = 'tenant_isolation_edu_announcements'
  ) THEN
    CREATE POLICY tenant_isolation_edu_announcements
      ON public.edu_announcements FOR ALL
      USING (
        tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid
        OR current_setting('role', true) = 'service_role'
      );
  END IF;
END;
$$;

-- ─── RPC: list announcements ───────────────────────────────────────────────
-- Returns { tenantId, announcements[] } for the caller's tenant.
-- Caller must be authenticated; tenant isolation enforced by get_auth_tenant_id() + RLS.
CREATE OR REPLACE FUNCTION public.preschool_list_school_announcements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_rows      jsonb;
BEGIN
  v_tenant_id := public.get_auth_tenant_id();

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          a.id,
      'title',       a.title,
      'bodyText',    a.body_text,
      'publishedAt', to_char(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) ORDER BY a.published_at DESC
  )
  INTO v_rows
  FROM public.edu_announcements a
  WHERE a.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'tenantId',      v_tenant_id,
    'announcements', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- ─── RPC: publish announcement ─────────────────────────────────────────────
-- Inserts a new announcement row. Idempotent via (tenant_id, request_id).
-- Returns the row + duplicate flag.
CREATE OR REPLACE FUNCTION public.preschool_publish_school_announcement(
  p_request_id UUID,
  p_title      TEXT,
  p_body_text  TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_row       public.edu_announcements%ROWTYPE;
  v_duplicate BOOLEAN := FALSE;
BEGIN
  v_tenant_id := public.get_auth_tenant_id();

  -- Validate inputs (mirrors route.ts checks; DB is the final enforcement layer)
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'p_request_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL OR char_length(trim(p_title)) < 1 OR char_length(trim(p_title)) > 200 THEN
    RAISE EXCEPTION 'title must be 1-200 characters' USING ERRCODE = '22023';
  END IF;
  IF p_body_text IS NULL OR char_length(trim(p_body_text)) < 1 OR char_length(trim(p_body_text)) > 20000 THEN
    RAISE EXCEPTION 'body_text must be 1-20000 characters' USING ERRCODE = '22023';
  END IF;

  -- Idempotent insert
  SELECT * INTO v_row
  FROM public.edu_announcements
  WHERE tenant_id = v_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    v_duplicate := TRUE;
  ELSE
    INSERT INTO public.edu_announcements (tenant_id, request_id, title, body_text, created_by)
    VALUES (v_tenant_id, p_request_id, trim(p_title), trim(p_body_text), auth.uid())
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id',          v_row.id,
    'title',       v_row.title,
    'bodyText',    v_row.body_text,
    'publishedAt', to_char(v_row.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'duplicate',   v_duplicate
  );
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- anon/authenticated users access through RLS + RPC (SECURITY INVOKER)
GRANT SELECT, INSERT ON public.edu_announcements TO authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_list_school_announcements()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_publish_school_announcement(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
