-- =============================================================================
-- Bella Interior Commercial — External Technical Source (D12)
-- Migration: 20261115120000_interior_external_technical_sources
--
-- Business: Nguồn kỹ thuật bên ngoài — không giới hạn bản vẽ: catalogue,
-- spec, hồ sơ. Bất biến theo phiên bản. SHA-256. UUID người tiếp nhận.
-- Tham chiếu ở cấp BOQ Item và Production Order Item (additive nullable).
-- =============================================================================

BEGIN;

-- ── PREFLIGHT ────────────────────────────────────────────────────────────────
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_work_items'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_work_items must exist first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_external_technical_sources'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_external_technical_sources already exists';
  END IF;
END;
$preflight$;

-- ── CREATE TABLE ─────────────────────────────────────────────────────────────
CREATE TABLE public.interior_external_technical_sources (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  work_item_id          uuid        NOT NULL,
  source_category       text        NOT NULL,
  title                 text        NOT NULL,
  -- Storage: R2/Supabase bucket path hoặc external URL
  storage_bucket        text,
  storage_path          text,
  external_url          text,
  -- D12: SHA-256 hex của file gốc
  file_sha256           text,
  integrity_verified_at timestamptz,
  -- D12: UUID người tiếp nhận — không được suy đoán
  received_by_id        uuid        NOT NULL,
  received_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  notes                 text,
  -- D12: Self-reference để track phiên bản mới (versioning bất biến)
  superseded_by_id      uuid,
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT interior_external_technical_sources_pkey PRIMARY KEY (id),

  -- D12: source_category hợp lệ
  CONSTRAINT chk_iets_category CHECK (source_category IN (
    'drawing',      -- bản vẽ thiết kế
    'catalogue',    -- catalogue sản phẩm
    'specification',-- spec kỹ thuật
    'dossier',      -- hồ sơ kỹ thuật
    'reference',    -- tài liệu tham khảo
    'other'
  )),

  -- D12: phải có ít nhất một trong storage_path hoặc external_url
  CONSTRAINT chk_iets_source_location CHECK (
    storage_path IS NOT NULL OR external_url IS NOT NULL
  ),

  -- D12: SHA-256 format (64 hex chars) nếu có
  CONSTRAINT chk_iets_sha256_format CHECK (
    file_sha256 IS NULL
    OR (length(file_sha256) = 64 AND file_sha256 ~ '^[a-f0-9]+$')
  ),

  -- D12: superseded_by không tự trỏ về chính nó
  CONSTRAINT chk_iets_no_self_supersede CHECK (
    superseded_by_id IS NULL OR superseded_by_id <> id
  ),

  CONSTRAINT interior_external_technical_sources_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,

  CONSTRAINT interior_external_technical_sources_work_item_id_fkey
    FOREIGN KEY (work_item_id) REFERENCES public.interior_work_items(id) ON DELETE RESTRICT,

  CONSTRAINT interior_external_technical_sources_received_by_id_fkey
    FOREIGN KEY (received_by_id) REFERENCES auth.users(id) ON DELETE RESTRICT,

  CONSTRAINT interior_external_technical_sources_superseded_by_id_fkey
    FOREIGN KEY (superseded_by_id)
      REFERENCES public.interior_external_technical_sources(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.interior_external_technical_sources IS
  'D12: Nguồn kỹ thuật bên ngoài — bất biến theo phiên bản. Thay thế bằng record mới có superseded_by_id.';
COMMENT ON COLUMN public.interior_external_technical_sources.file_sha256 IS
  'D12: SHA-256 hex 64 ký tự của file gốc. NULL nếu chưa xác minh.';
COMMENT ON COLUMN public.interior_external_technical_sources.received_by_id IS
  'D12: UUID người tiếp nhận nguồn kỹ thuật — bắt buộc, không được suy đoán.';
COMMENT ON COLUMN public.interior_external_technical_sources.superseded_by_id IS
  'D12: Nếu có phiên bản mới, trỏ đến record mới. Record cũ vẫn bất biến.';

-- ── INDEX ─────────────────────────────────────────────────────────────────────
CREATE INDEX idx_iets_tenant_work_item
  ON public.interior_external_technical_sources (tenant_id, work_item_id);
CREATE INDEX idx_iets_active
  ON public.interior_external_technical_sources (work_item_id)
  WHERE superseded_by_id IS NULL;

-- ── IMMUTABILITY TRIGGER ──────────────────────────────────────────────────────
-- D12: bất biến — chỉ cho phép cập nhật superseded_by_id và integrity_verified_at
CREATE FUNCTION public.guard_interior_external_technical_sources_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Cho phép cập nhật chỉ hai cột mutable: superseded_by_id và integrity_verified_at
  IF (OLD.id                IS DISTINCT FROM NEW.id) OR
     (OLD.tenant_id         IS DISTINCT FROM NEW.tenant_id) OR
     (OLD.work_item_id      IS DISTINCT FROM NEW.work_item_id) OR
     (OLD.source_category   IS DISTINCT FROM NEW.source_category) OR
     (OLD.title             IS DISTINCT FROM NEW.title) OR
     (OLD.storage_bucket    IS DISTINCT FROM NEW.storage_bucket) OR
     (OLD.storage_path      IS DISTINCT FROM NEW.storage_path) OR
     (OLD.external_url      IS DISTINCT FROM NEW.external_url) OR
     (OLD.file_sha256       IS DISTINCT FROM NEW.file_sha256) OR
     (OLD.received_by_id    IS DISTINCT FROM NEW.received_by_id) OR
     (OLD.received_at       IS DISTINCT FROM NEW.received_at) OR
     (OLD.created_at        IS DISTINCT FROM NEW.created_at)
  THEN
    RAISE EXCEPTION 'ImmutabilityViolation: external technical source record is immutable. Create a new record and set superseded_by_id.';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_interior_external_technical_sources_immutability() IS
  'Trigger helper: enforce D12 immutability. Only superseded_by_id and integrity_verified_at may change.';

REVOKE EXECUTE ON FUNCTION public.guard_interior_external_technical_sources_immutability()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_iets_immutability
  BEFORE UPDATE ON public.interior_external_technical_sources
  FOR EACH ROW EXECUTE FUNCTION
    public.guard_interior_external_technical_sources_immutability();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.interior_external_technical_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.interior_external_technical_sources
  AS RESTRICTIVE
  USING (tenant_id = public.interior_actor_tenant())
  WITH CHECK (tenant_id = public.interior_actor_tenant());

CREATE POLICY interior_rbac_select ON public.interior_external_technical_sources
  FOR SELECT
  USING (
    public.interior_has_permission('interior:ext_source:read', tenant_id, NULL, NULL)
  );

CREATE POLICY interior_rbac_insert ON public.interior_external_technical_sources
  FOR INSERT
  WITH CHECK (
    public.interior_has_permission('interior:ext_source:create', tenant_id, NULL, NULL)
  );

-- UPDATE chỉ cho phép qua trigger (cập nhật superseded_by_id và integrity_verified_at)
CREATE POLICY interior_rbac_update ON public.interior_external_technical_sources
  FOR UPDATE
  USING (
    public.interior_has_permission('interior:ext_source:manage', tenant_id, NULL, NULL)
  )
  WITH CHECK (
    public.interior_has_permission('interior:ext_source:manage', tenant_id, NULL, NULL)
  );

-- ── PERMISSIONS SEED ─────────────────────────────────────────────────────────
INSERT INTO public.interior_permissions
  (permission_id, module_key, action_key, description, sensitive)
VALUES
  ('interior:ext_source:read',   'ext_source', 'READ',   'Xem nguồn kỹ thuật bên ngoài',           false),
  ('interior:ext_source:create', 'ext_source', 'CREATE', 'Tiếp nhận nguồn kỹ thuật mới',           false),
  ('interior:ext_source:manage', 'ext_source', 'MANAGE', 'Quản lý phiên bản nguồn kỹ thuật (admin)', true)
ON CONFLICT (permission_id) DO NOTHING;

-- ── ADDITIVE LINKS: BOQ Items và Production Order Items ───────────────────────
-- D12: Tham chiếu ở cấp BOQ Item và Production Order Item.
-- Additive nullable — không phá vỡ dữ liệu hiện hữu.

ALTER TABLE public.interior_boq_items
  ADD COLUMN IF NOT EXISTS ext_technical_source_id uuid,
  ADD COLUMN IF NOT EXISTS work_item_id             uuid;

ALTER TABLE public.interior_boq_items
  ADD CONSTRAINT interior_boq_items_ext_source_fkey
    FOREIGN KEY (ext_technical_source_id)
      REFERENCES public.interior_external_technical_sources(id) ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.interior_boq_items
  ADD CONSTRAINT interior_boq_items_work_item_id_fkey
    FOREIGN KEY (work_item_id)
      REFERENCES public.interior_work_items(id) ON DELETE RESTRICT
  NOT VALID;

-- Validate sau (không block existing data khi NOT VALID)
ALTER TABLE public.interior_boq_items
  VALIDATE CONSTRAINT interior_boq_items_ext_source_fkey;
ALTER TABLE public.interior_boq_items
  VALIDATE CONSTRAINT interior_boq_items_work_item_id_fkey;

ALTER TABLE public.interior_production_order_items
  ADD COLUMN IF NOT EXISTS ext_technical_source_id uuid;

ALTER TABLE public.interior_production_order_items
  ADD CONSTRAINT interior_poi_ext_source_fkey
    FOREIGN KEY (ext_technical_source_id)
      REFERENCES public.interior_external_technical_sources(id) ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.interior_production_order_items
  VALIDATE CONSTRAINT interior_poi_ext_source_fkey;

COMMIT;