-- =============================================================================
-- Bella Interior Commercial — Work Item entity (D10)
-- Migration: 20261115110000_interior_work_items
--
-- Business: Một project có nhiều hạng mục công việc (Work Items).
-- BOQ, Production Order và Handover trace về work_item_id.
-- project_type trên interior_projects giữ nguyên để backward compat.
-- =============================================================================

BEGIN;

-- ── PREFLIGHT ────────────────────────────────────────────────────────────────
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_projects'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_projects not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_work_items'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_work_items already exists — idempotency guard';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_permissions'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_permissions not found';
  END IF;
  -- Verify interior_has_permission exists
  IF to_regprocedure('public.interior_has_permission(text,uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_has_permission not found';
  END IF;
  IF to_regprocedure('public.interior_actor_tenant()') IS NULL THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_actor_tenant not found';
  END IF;
END;
$preflight$;

-- ── CREATE TABLE ─────────────────────────────────────────────────────────────
CREATE TABLE public.interior_work_items (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL,
  project_id           uuid        NOT NULL,
  work_item_code       text        NOT NULL,
  title                text        NOT NULL,
  work_type            text        NOT NULL,
  status               text        NOT NULL DEFAULT 'planning',
  scope_description    text,
  scheduled_start_date date,
  scheduled_end_date   date,
  created_by_id        uuid        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT interior_work_items_pkey PRIMARY KEY (id),

  CONSTRAINT chk_iwi_work_type CHECK (work_type IN (
    'turnkey',
    'construction_only',
    'loose_furniture',
    'existing_drawing'
  )),

  CONSTRAINT chk_iwi_status CHECK (status IN (
    'planning', 'active', 'on_hold', 'completed', 'cancelled'
  )),

  CONSTRAINT chk_iwi_code_format CHECK (
    work_item_code = trim(work_item_code) AND length(work_item_code) > 0
  ),

  CONSTRAINT interior_work_items_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,

  CONSTRAINT interior_work_items_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.interior_projects(id) ON DELETE CASCADE,

  CONSTRAINT interior_work_items_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES auth.users(id) ON DELETE RESTRICT,

  CONSTRAINT uq_iwi_tenant_project_code
    UNIQUE (tenant_id, project_id, work_item_code)
);

COMMENT ON TABLE public.interior_work_items IS
  'D10: Hạng mục công việc nội thất. Một project 1:N work_items với loại hình độc lập.';
COMMENT ON COLUMN public.interior_work_items.work_type IS
  'D10: turnkey | construction_only | loose_furniture | existing_drawing';
COMMENT ON COLUMN public.interior_work_items.created_by_id IS
  'D14: UUID FK bắt buộc. Không được suy đoán từ TEXT lịch sử.';

-- ── INDEX ─────────────────────────────────────────────────────────────────────
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iwi_tenant_project
  ON public.interior_work_items (tenant_id, project_id);
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iwi_work_type
  ON public.interior_work_items (tenant_id, work_type);
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iwi_active_status
  ON public.interior_work_items (status)
  WHERE status IN ('planning', 'active');

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
CREATE FUNCTION public.interior_work_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.interior_work_items_updated_at() IS
  'Trigger helper: auto-update updated_at. NOT an application RPC.';

REVOKE EXECUTE ON FUNCTION public.interior_work_items_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_iwi_updated_at
  BEFORE UPDATE ON public.interior_work_items
  FOR EACH ROW EXECUTE FUNCTION public.interior_work_items_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.interior_work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.interior_work_items
  AS RESTRICTIVE
  USING (tenant_id = public.interior_actor_tenant())
  WITH CHECK (tenant_id = public.interior_actor_tenant());

CREATE POLICY interior_rbac_select ON public.interior_work_items
  FOR SELECT
  USING (
    public.interior_has_permission('interior:work_item:read', tenant_id, project_id, NULL)
  );

CREATE POLICY interior_rbac_insert ON public.interior_work_items
  FOR INSERT
  WITH CHECK (
    public.interior_has_permission('interior:work_item:create', tenant_id, project_id, NULL)
  );

CREATE POLICY interior_rbac_update ON public.interior_work_items
  FOR UPDATE
  USING (
    public.interior_has_permission('interior:work_item:update', tenant_id, project_id, NULL)
  )
  WITH CHECK (
    public.interior_has_permission('interior:work_item:update', tenant_id, project_id, NULL)
  );

-- ── PERMISSIONS SEED ─────────────────────────────────────────────────────────
-- interior_permissions schema: permission_id (PK text), module_key, action_key,
--                               description, sensitive
INSERT INTO public.interior_permissions
  (permission_id, module_key, action_key, description, sensitive)
VALUES
  ('interior:work_item:read',   'work_item', 'READ',   'Xem hạng mục công việc',          false),
  ('interior:work_item:create', 'work_item', 'CREATE', 'Tạo hạng mục công việc mới',      false),
  ('interior:work_item:update', 'work_item', 'UPDATE', 'Cập nhật hạng mục công việc',     false),
  ('interior:work_item:manage', 'work_item', 'MANAGE', 'Quản lý toàn bộ hạng mục (admin)', true)
ON CONFLICT (permission_id) DO NOTHING;

COMMIT;