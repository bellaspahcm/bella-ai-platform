-- =============================================================================
-- Bella Interior Commercial — Internal Approvals (D11, D13, D14)
-- Migration: 20261115130000_interior_internal_approvals
--
-- Business:
--   D11: Approval I6 conditional theo work_type (turnkey/partial bắt buộc;
--        loose_furniture/existing_drawing không tạo revision nội bộ giả).
--   D13: Warranty snapshot từ hợp đồng; PENDING_TERMS khi chưa xác định.
--   D14: Separation of Duties — approved_by_id ≠ submitted_by_id (DB CHECK
--        + immutable decision + permission guard).
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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_external_technical_sources'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_external_technical_sources must exist first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interior_internal_approvals'
  ) THEN
    RAISE EXCEPTION 'Preflight FAIL: interior_internal_approvals already exists';
  END IF;
END;
$preflight$;

-- ── CREATE TABLE: interior_internal_approvals ─────────────────────────────────
CREATE TABLE public.interior_internal_approvals (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  work_item_id     uuid        NOT NULL,
  subject_type     text        NOT NULL,
  subject_id       uuid        NOT NULL,
  -- D11: stage trong workflow — dùng để kiểm tra I6 conditional
  approval_stage   text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending',
  -- D14: submitted_by_id — người trình ký (bắt buộc)
  submitted_by_id  uuid        NOT NULL,
  submitted_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  -- D14: decided_by_id nullable — chỉ bắt buộc khi status = approved/rejected
  decided_by_id    uuid,
  decided_at       timestamptz,
  decision_note    text,
  -- D14: immutable khi đã có quyết định
  is_superseded    boolean     NOT NULL DEFAULT false,
  superseded_by_id uuid,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT interior_internal_approvals_pkey PRIMARY KEY (id),

  -- D14: subject_type chỉ được là các loại nghiệp vụ đã xác định
  CONSTRAINT chk_iia_subject_type CHECK (subject_type IN (
    'boq',
    'design_revision',
    'production_order',
    'handover_dossier',
    'warranty_certificate'
  )),

  -- D11: approval_stage hợp lệ
  CONSTRAINT chk_iia_approval_stage CHECK (approval_stage IN (
    'design_review',      -- I6: chỉ áp dụng cho turnkey/construction_only
    'boq_review',
    'production_review',
    'handover_review',
    'warranty_issuance'   -- D13: phát hành chứng nhận bảo hành
  )),

  CONSTRAINT chk_iia_status CHECK (status IN (
    'pending', 'approved', 'rejected', 'revision_required', 'withdrawn'
  )),

  -- D14: Separation of Duties — người duyệt ≠ người trình
  CONSTRAINT chk_iia_sod CHECK (
    decided_by_id IS NULL OR decided_by_id <> submitted_by_id
  ),

  -- D14: completeness — khi approved/rejected phải có decided_by_id và decided_at
  CONSTRAINT chk_iia_decision_completeness CHECK (
    status NOT IN ('approved', 'rejected')
    OR (decided_by_id IS NOT NULL AND decided_at IS NOT NULL)
  ),

  -- D14: immutable khi superseded — không tự trỏ về chính nó
  CONSTRAINT chk_iia_no_self_supersede CHECK (
    superseded_by_id IS NULL OR superseded_by_id <> id
  ),

  CONSTRAINT interior_internal_approvals_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,

  CONSTRAINT interior_internal_approvals_work_item_id_fkey
    FOREIGN KEY (work_item_id) REFERENCES public.interior_work_items(id) ON DELETE RESTRICT,

  CONSTRAINT interior_internal_approvals_submitted_by_id_fkey
    FOREIGN KEY (submitted_by_id) REFERENCES auth.users(id) ON DELETE RESTRICT,

  CONSTRAINT interior_internal_approvals_decided_by_id_fkey
    FOREIGN KEY (decided_by_id) REFERENCES auth.users(id) ON DELETE RESTRICT,

  CONSTRAINT interior_internal_approvals_superseded_by_id_fkey
    FOREIGN KEY (superseded_by_id)
      REFERENCES public.interior_internal_approvals(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.interior_internal_approvals IS
  'D11/D14: Approval nội bộ tách biệt với customer handover. Immutable decision với SoD enforced.';
COMMENT ON COLUMN public.interior_internal_approvals.decided_by_id IS
  'D14: UUID người quyết định. NULL khi pending/revision_required/withdrawn. Bắt buộc khi approved/rejected.';
COMMENT ON COLUMN public.interior_internal_approvals.is_superseded IS
  'D14: TRUE khi record đã bị thay thế bởi superseded_by_id. Record cũ bất biến.';

-- ── INDEX ─────────────────────────────────────────────────────────────────────
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iia_tenant_work_item
  ON public.interior_internal_approvals (tenant_id, work_item_id);
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iia_subject
  ON public.interior_internal_approvals (subject_type, subject_id);
-- zero-downtime: allow blocking-index - new table created in same migration; no existing rows to scan
CREATE INDEX idx_iia_pending
  ON public.interior_internal_approvals (tenant_id, status)
  WHERE status = 'pending' AND is_superseded = false;

-- ── IMMUTABILITY TRIGGER ──────────────────────────────────────────────────────
-- D14: Quyết định đã có (approved/rejected) là bất biến.
-- Chỉ cho phép cập nhật is_superseded và superseded_by_id.
CREATE FUNCTION public.guard_interior_internal_approvals_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Nếu record cũ đã có quyết định cuối (approved/rejected), block tất cả
  -- thay đổi trừ việc đánh dấu superseded
  IF OLD.status IN ('approved', 'rejected') THEN
    IF (OLD.id               IS DISTINCT FROM NEW.id) OR
       (OLD.tenant_id        IS DISTINCT FROM NEW.tenant_id) OR
       (OLD.work_item_id     IS DISTINCT FROM NEW.work_item_id) OR
       (OLD.subject_type     IS DISTINCT FROM NEW.subject_type) OR
       (OLD.subject_id       IS DISTINCT FROM NEW.subject_id) OR
       (OLD.approval_stage   IS DISTINCT FROM NEW.approval_stage) OR
       (OLD.status           IS DISTINCT FROM NEW.status) OR
       (OLD.submitted_by_id  IS DISTINCT FROM NEW.submitted_by_id) OR
       (OLD.submitted_at     IS DISTINCT FROM NEW.submitted_at) OR
       (OLD.decided_by_id    IS DISTINCT FROM NEW.decided_by_id) OR
       (OLD.decided_at       IS DISTINCT FROM NEW.decided_at) OR
       (OLD.decision_note    IS DISTINCT FROM NEW.decision_note) OR
       (OLD.created_at       IS DISTINCT FROM NEW.created_at)
    THEN
      RAISE EXCEPTION 'ImmutabilityViolation: approved/rejected approval record cannot be modified. Create a new approval and set superseded_by_id.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_interior_internal_approvals_immutability() IS
  'D14: Immutable decisions. Approved/rejected records cannot be modified.';

REVOKE EXECUTE ON FUNCTION public.guard_interior_internal_approvals_immutability()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_iia_immutability
  BEFORE UPDATE ON public.interior_internal_approvals
  FOR EACH ROW EXECUTE FUNCTION
    public.guard_interior_internal_approvals_immutability();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.interior_internal_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.interior_internal_approvals
  AS RESTRICTIVE
  USING (tenant_id = public.interior_actor_tenant())
  WITH CHECK (tenant_id = public.interior_actor_tenant());

CREATE POLICY interior_rbac_select ON public.interior_internal_approvals
  FOR SELECT
  USING (
    public.interior_has_permission('interior:approval:read', tenant_id, NULL, NULL)
  );

CREATE POLICY interior_rbac_insert ON public.interior_internal_approvals
  FOR INSERT
  WITH CHECK (
    public.interior_has_permission('interior:approval:submit', tenant_id, NULL, NULL)
  );

-- D14: Chỉ người có permission decide mới được UPDATE (quyết định)
CREATE POLICY interior_rbac_decide ON public.interior_internal_approvals
  FOR UPDATE
  USING (
    public.interior_has_permission('interior:approval:decide', tenant_id, NULL, NULL)
  )
  WITH CHECK (
    public.interior_has_permission('interior:approval:decide', tenant_id, NULL, NULL)
    -- SoD enforced ở DB level (chk_iia_sod), policy chỉ cần kiểm tra permission
  );

-- ── PERMISSIONS SEED ─────────────────────────────────────────────────────────
INSERT INTO public.interior_permissions
  (permission_id, module_key, action_key, description, sensitive)
VALUES
  ('interior:approval:read',    'approval', 'READ',   'Xem approval nội bộ',                    false),
  ('interior:approval:submit',  'approval', 'SUBMIT', 'Trình ký approval nội bộ',               false),
  ('interior:approval:decide',  'approval', 'DECIDE', 'Quyết định approval (approve/reject)',    true),
  ('interior:warranty:issue',   'warranty', 'ISSUE',  'Phát hành chứng nhận bảo hành (D13)',    true)
ON CONFLICT (permission_id) DO NOTHING;

-- ── D10: Liên kết BOQ và Production Order với Work Item ───────────────────────
-- Additive nullable trên interior_boqs
ALTER TABLE public.interior_boqs
  ADD COLUMN IF NOT EXISTS work_item_id uuid;

ALTER TABLE public.interior_boqs
  ADD CONSTRAINT interior_boqs_work_item_id_fkey
    FOREIGN KEY (work_item_id)
      REFERENCES public.interior_work_items(id) ON DELETE RESTRICT
  NOT VALID;

-- NOT VALID vì có 1 row hiện hữu chưa có work_item_id
-- Validate sẽ chạy sau khi dữ liệu được gắn work_item_id
-- (không validate ngay để tránh block production data)

-- Additive nullable trên interior_production_orders
ALTER TABLE public.interior_production_orders
  ADD COLUMN IF NOT EXISTS work_item_id uuid;

ALTER TABLE public.interior_production_orders
  ADD CONSTRAINT interior_production_orders_work_item_id_fkey
    FOREIGN KEY (work_item_id)
      REFERENCES public.interior_work_items(id) ON DELETE RESTRICT
  NOT VALID;

-- production_orders rỗng — validate ngay được
-- zero-downtime: allow validate-constraint - interior_production_orders confirmed empty on production (0 rows); no existing data to scan
ALTER TABLE public.interior_production_orders
  VALIDATE CONSTRAINT interior_production_orders_work_item_id_fkey;

-- D10: design_revision_id trên interior_production_orders: DROP NOT NULL
-- (cần nullable để hỗ trợ loose_furniture/existing_drawing không có revision nội bộ)
-- production_orders rỗng — safe to alter
ALTER TABLE public.interior_production_orders
  ALTER COLUMN design_revision_id DROP NOT NULL;

-- DROP unique constraint cũ trói design_revision_id: (tenant_id, design_revision_id, project_id)
-- Lý do: sau khi nullable, constraint này không còn đủ để đảm bảo uniqueness
-- (NULL = NULL là false trong unique index — sẽ tạo duplicate rows)
ALTER TABLE public.interior_production_orders
  DROP CONSTRAINT IF EXISTS uq_interior_prod_orders_design;

-- Tạo unique constraint mới dựa trên order_number (đã tồn tại) — đủ để đảm bảo uniqueness
-- uq_interior_prod_orders_tenant_number đã tồn tại từ trước — không cần tạo thêm

-- D11: interior_design_revisions link tới work_item (additive nullable)
-- Chỉ bắt buộc cho turnkey/construction_only — xử lý ở service layer theo D11
ALTER TABLE public.interior_design_revisions
  ADD COLUMN IF NOT EXISTS work_item_id uuid;

ALTER TABLE public.interior_design_revisions
  ADD CONSTRAINT interior_design_revisions_work_item_id_fkey
    FOREIGN KEY (work_item_id)
      REFERENCES public.interior_work_items(id) ON DELETE RESTRICT
  NOT VALID;

-- 1 row hiện hữu — không validate ngay; validate sau khi gắn work_item_id

-- D13: Warranty snapshot columns (additive) trên interior_warranty_certificates
ALTER TABLE public.interior_warranty_certificates
  ADD COLUMN IF NOT EXISTS warranty_terms_snapshot    jsonb,
  ADD COLUMN IF NOT EXISTS warranty_terms_status      text DEFAULT 'PENDING_TERMS',
  ADD COLUMN IF NOT EXISTS issued_by_id               uuid,
  ADD COLUMN IF NOT EXISTS issued_at                  timestamptz;

ALTER TABLE public.interior_warranty_certificates
  ADD CONSTRAINT chk_iwc_terms_status CHECK (
    warranty_terms_status IN ('PENDING_TERMS', 'CONFIRMED')
  );

ALTER TABLE public.interior_warranty_certificates
  ADD CONSTRAINT interior_warranty_certificates_issued_by_id_fkey
    FOREIGN KEY (issued_by_id) REFERENCES auth.users(id) ON DELETE RESTRICT
  NOT VALID;

-- zero-downtime: allow validate-constraint - interior_warranty_certificates.issued_by_id is newly added nullable column; all existing rows have NULL value, nothing to validate
ALTER TABLE public.interior_warranty_certificates
  VALIDATE CONSTRAINT interior_warranty_certificates_issued_by_id_fkey;

COMMIT;