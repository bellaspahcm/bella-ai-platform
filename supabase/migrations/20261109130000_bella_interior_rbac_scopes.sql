-- Bella Interior Product-local RBAC and project scope.
-- Additive only: no business rows are rewritten and no direct table CRUD is granted.
BEGIN;

DO $preflight$
DECLARE
  v_table text;
  v_expected text[] := ARRAY[
    'interior_projects','interior_project_room_zones','interior_design_revisions',
    'interior_design_assets','interior_design_material_specs','interior_boqs',
    'interior_boq_items','interior_quotations','interior_contracts',
    'interior_payment_milestones','interior_production_orders',
    'interior_production_order_items','interior_site_installation_plans',
    'interior_site_room_installations','interior_site_diaries',
    'interior_qc_punch_list_items','interior_handover_dossiers',
    'interior_warranty_certificates','interior_warranty_service_tickets',
    'interior_sync_idempotency','interior_finance_outbox'
  ];
BEGIN
  IF cardinality(v_expected) <> 21 THEN
    RAISE EXCEPTION 'Interior RBAC migration table inventory is invalid';
  END IF;
  FOREACH v_table IN ARRAY v_expected LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM pg_class c
         WHERE c.oid = to_regclass(format('public.%I', v_table))
           AND c.relrowsecurity
       )
       OR NOT EXISTS (
         SELECT 1 FROM pg_policies p
         WHERE p.schemaname = 'public'
           AND p.tablename = v_table
           AND p.policyname = 'tenant_isolation_policy'
           AND p.permissive = 'RESTRICTIVE'
       ) THEN
      RAISE EXCEPTION 'Interior RBAC preflight failed for public.%', v_table;
    END IF;
    IF has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') THEN
      RAISE EXCEPTION 'Interior RBAC preflight found a direct table grant on public.%', v_table;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'interior_roles','interior_permissions','interior_role_permissions',
      'interior_user_roles','interior_user_project_assignments',
      'interior_user_permission_grants','interior_admin_role_delegations',
      'interior_permission_audit_logs'
    ]) AS expected(table_name)
    WHERE to_regclass(format('public.%I',expected.table_name)) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Interior RBAC relations already exist; reconcile before applying this migration';
  END IF;
  IF to_regprocedure('public.interior_authorize_action(text,uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Interior RBAC resolver already exists; reconcile before applying this migration';
  END IF;
END
$preflight$;

ALTER TABLE public.interior_qc_punch_list_items
  ADD COLUMN IF NOT EXISTS room_zone_id uuid,
  ADD COLUMN IF NOT EXISTS reported_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT statement_timestamp();

CREATE TABLE public.interior_roles (
  role_key text PRIMARY KEY,
  display_name text NOT NULL,
  responsibility text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ck_interior_roles_key CHECK (role_key IN (
    'OWNER','ADMIN','SALES','DESIGNER','QS','PM','SITE_MANAGER',
    'PRODUCTION_MANAGER','QC','ACCOUNTANT','WARRANTY','EXECUTIVE'
  ))
);

CREATE TABLE public.interior_permissions (
  permission_id text PRIMARY KEY,
  module_key text NOT NULL,
  action_key text NOT NULL,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE public.interior_role_permissions (
  role_key text NOT NULL REFERENCES public.interior_roles(role_key) ON DELETE RESTRICT,
  permission_id text NOT NULL REFERENCES public.interior_permissions(permission_id) ON DELETE RESTRICT,
  PRIMARY KEY (role_key, permission_id)
);

CREATE TABLE public.interior_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role_key text NOT NULL REFERENCES public.interior_roles(role_key) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('TENANT','BRANCH','PROJECT','SELF')),
  scope_id uuid,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  CONSTRAINT ck_interior_user_role_scope CHECK (
    (scope_type IN ('TENANT','SELF') AND scope_id IS NULL)
    OR (scope_type IN ('BRANCH','PROJECT') AND scope_id IS NOT NULL)
  ),
  CONSTRAINT ck_interior_user_role_revocation CHECK (
    (status = 'ACTIVE' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_user_roles_active_tenant
  ON public.interior_user_roles(tenant_id,user_id,role_key)
  WHERE status='ACTIVE' AND scope_type='TENANT';
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_user_roles_active_scoped
  ON public.interior_user_roles(tenant_id,user_id,role_key,scope_type,scope_id)
  WHERE status='ACTIVE' AND scope_type IN ('BRANCH','PROJECT');
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_user_roles_active_self
  ON public.interior_user_roles(tenant_id,user_id,role_key)
  WHERE status='ACTIVE' AND scope_type='SELF';
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE INDEX idx_interior_user_roles_actor
  ON public.interior_user_roles(tenant_id,user_id,status,role_key);

CREATE TABLE public.interior_user_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.interior_projects(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  CONSTRAINT ck_interior_project_assignment_revocation CHECK (
    (status='ACTIVE' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status='REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_project_assignment_active
  ON public.interior_user_project_assignments(tenant_id,project_id,user_id)
  WHERE status='ACTIVE';
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE INDEX idx_interior_project_assignment_user
  ON public.interior_user_project_assignments(tenant_id,user_id,status,project_id);

CREATE TABLE public.interior_user_permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  permission_id text NOT NULL REFERENCES public.interior_permissions(permission_id) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('TENANT','BRANCH','PROJECT','SELF')),
  scope_id uuid,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  CONSTRAINT ck_interior_direct_grant_scope CHECK (
    (scope_type IN ('TENANT','SELF') AND scope_id IS NULL)
    OR (scope_type IN ('BRANCH','PROJECT') AND scope_id IS NOT NULL)
  ),
  CONSTRAINT ck_interior_direct_grant_revocation CHECK (
    (status='ACTIVE' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status='REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_direct_grant_active_tenant
  ON public.interior_user_permission_grants(tenant_id,user_id,permission_id)
  WHERE status='ACTIVE' AND scope_type='TENANT';
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_direct_grant_active_scope
  ON public.interior_user_permission_grants(tenant_id,user_id,permission_id,scope_type,scope_id)
  WHERE status='ACTIVE' AND scope_type IN ('BRANCH','PROJECT');
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_direct_grant_active_self
  ON public.interior_user_permission_grants(tenant_id,user_id,permission_id)
  WHERE status='ACTIVE' AND scope_type='SELF';

CREATE TABLE public.interior_admin_role_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role_key text NOT NULL REFERENCES public.interior_roles(role_key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  delegated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  delegated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  CONSTRAINT ck_interior_admin_delegation_revocation CHECK (
    (status='ACTIVE' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status='REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT ck_interior_admin_cannot_delegate_owner CHECK (role_key <> 'OWNER')
);
-- zero-downtime: allow blocking-index - New RBAC relation is empty and has no direct grants before this index is built.
CREATE UNIQUE INDEX uq_interior_admin_role_delegation_active
  ON public.interior_admin_role_delegations(tenant_id,admin_user_id,role_key)
  WHERE status='ACTIVE';

CREATE TABLE public.interior_permission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  assignment_id uuid,
  role_key text,
  permission_id text,
  scope_type text,
  scope_id uuid,
  before_state jsonb,
  after_state jsonb,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
-- zero-downtime: allow blocking-index - New audit relation is empty and has no direct grants before this index is built.
CREATE INDEX idx_interior_permission_audit_tenant_time
  ON public.interior_permission_audit_logs(tenant_id,recorded_at DESC);
-- zero-downtime: allow blocking-index - New audit relation is empty and has no direct grants before this index is built.
CREATE INDEX idx_interior_permission_audit_target_time
  ON public.interior_permission_audit_logs(tenant_id,target_user_id,recorded_at DESC);

ALTER TABLE public.interior_projects ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE public.interior_projects
  ADD CONSTRAINT fk_interior_projects_branch
  FOREIGN KEY (branch_id) REFERENCES public.org_units(id) ON DELETE RESTRICT;
-- zero-downtime: allow blocking-index - Production contains five Interior projects; the indexed nullable branch key is newly added and no existing row is rewritten.
CREATE INDEX IF NOT EXISTS idx_interior_projects_tenant_branch
  ON public.interior_projects(tenant_id,branch_id) WHERE branch_id IS NOT NULL;

ALTER TABLE public.interior_boqs
  ADD COLUMN IF NOT EXISTS prepared_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.interior_design_revisions
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.interior_handover_dossiers
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

INSERT INTO public.interior_roles(role_key,display_name,responsibility) VALUES
  ('OWNER','Chủ doanh nghiệp','Toàn quyền và quyết định cuối cùng'),
  ('ADMIN','Quản trị hệ thống','Người dùng, cấu hình và vận hành trong phạm vi OWNER ủy quyền'),
  ('SALES','Kinh doanh','Khách hàng, cơ hội, báo giá và hợp đồng'),
  ('DESIGNER','Thiết kế','Hồ sơ thiết kế, phiên bản và vật liệu'),
  ('QS','Dự toán / BOQ','Khối lượng, đơn giá và dự toán'),
  ('PM','Quản lý dự án','Tiến độ, ngân sách, điều phối và bàn giao'),
  ('SITE_MANAGER','Quản lý công trình','Nhật ký, nhân công, vật tư và lắp đặt'),
  ('PRODUCTION_MANAGER','Quản lý sản xuất','Lệnh và tiến độ sản xuất'),
  ('QC','Kiểm soát chất lượng','Kiểm tra, lỗi và nghiệm thu'),
  ('ACCOUNTANT','Kế toán','Công nợ, ghi nhận thu chi và đối soát'),
  ('WARRANTY','Bảo hành / Chăm sóc','Yêu cầu sau bàn giao và bảo trì'),
  ('EXECUTIVE','Ban điều hành','Báo cáo và hiệu quả kinh doanh');

INSERT INTO public.interior_permissions(permission_id,module_key,action_key,description,sensitive) VALUES
  ('interior:project:read','project','READ','Xem dự án',false),
  ('interior:project:create','project','CREATE','Tạo dự án',false),
  ('interior:project:update','project','UPDATE','Cập nhật dự án',false),
  ('interior:project:write','project','WRITE','Tương thích API cũ: tạo hoặc cập nhật dự án',false),
  ('interior:project:export','project','EXPORT','Xuất dữ liệu dự án',false),
  ('interior:customer:read','customer','READ','Xem khách hàng và thông tin liên hệ',false),
  ('interior:design:read','design','READ','Xem hồ sơ thiết kế',false),
  ('interior:design:create','design','CREATE','Tạo hồ sơ thiết kế',false),
  ('interior:design:update','design','UPDATE','Cập nhật hồ sơ thiết kế',false),
  ('interior:design:write','design','WRITE','Tương thích API cũ: tạo hoặc cập nhật thiết kế',false),
  ('interior:design:approve','design','APPROVE','Phê duyệt thiết kế',true),
  ('interior:design:upload','design','UPLOAD','Tải tài sản thiết kế',false),
  ('interior:design:export','design','EXPORT','Xuất hồ sơ thiết kế',false),
  ('interior:boq:read','boq','READ','Xem BOQ',false),
  ('interior:boq:create','boq','CREATE','Tạo BOQ',false),
  ('interior:boq:update','boq','UPDATE','Cập nhật BOQ',false),
  ('interior:boq:write','boq','WRITE','Tương thích API cũ: tạo hoặc cập nhật BOQ',false),
  ('interior:boq:approve','boq','APPROVE','Phê duyệt BOQ',true),
  ('interior:boq:export','boq','EXPORT','Xuất BOQ',false),
  ('interior:contract:read','contract','READ','Xem báo giá và hợp đồng',false),
  ('interior:contract:create','contract','CREATE','Tạo báo giá hoặc hợp đồng',false),
  ('interior:contract:update','contract','UPDATE','Cập nhật bản nháp hợp đồng',false),
  ('interior:contract:write','contract','WRITE','Tương thích API cũ: tạo hoặc cập nhật hợp đồng',false),
  ('interior:contract:approve','contract','APPROVE','Phê duyệt hợp đồng',true),
  ('interior:contract:sign','contract','SIGN','Ký hợp đồng',true),
  ('interior:contract:amend','contract','AMEND','Sửa đổi hợp đồng đã duyệt/ký',true),
  ('interior:contract:export','contract','EXPORT','Xuất hợp đồng',false),
  ('interior:finance:read','finance','READ','Xem tài chính và công nợ',false),
  ('interior:finance:write','finance','WRITE','Ghi nghiệp vụ tài chính không phải duyệt/hoàn tiền',true),
  ('interior:payment:record','payment','RECORD','Ghi nhận khoản thu/thanh toán',true),
  ('interior:payment:approve','payment','APPROVE','Duyệt khoản thanh toán',true),
  ('interior:payment:refund','payment','REFUND','Hoàn tiền',true),
  ('interior:schedule:read','schedule','READ','Xem tiến độ',false),
  ('interior:schedule:create','schedule','CREATE','Tạo kế hoạch tiến độ',false),
  ('interior:schedule:update','schedule','UPDATE','Cập nhật kế hoạch tiến độ',false),
  ('interior:schedule:write','schedule','WRITE','Tương thích API cũ: tạo hoặc cập nhật tiến độ',false),
  ('interior:schedule:export','schedule','EXPORT','Xuất tiến độ',false),
  ('interior:production:read','production','READ','Xem sản xuất',false),
  ('interior:production:create','production','CREATE','Tạo lệnh sản xuất nháp',false),
  ('interior:production:update','production','UPDATE','Cập nhật tiến độ sản xuất',false),
  ('interior:production:write','production','WRITE','Tương thích API cũ: tạo hoặc cập nhật sản xuất',false),
  ('interior:production:execute','production','EXECUTE','Thực hiện tác vụ sản xuất đã phát hành',true),
  ('interior:production:export','production','EXPORT','Xuất dữ liệu sản xuất',false),
  ('interior:production_order:release','production_order','RELEASE','Phát hành lệnh sản xuất sau khi đủ điều kiện',true),
  ('interior:installation:read','installation','READ','Xem thi công và lắp đặt',false),
  ('interior:installation:create','installation','CREATE','Tạo nhật ký/kế hoạch lắp đặt',false),
  ('interior:installation:update','installation','UPDATE','Cập nhật nhật ký/kế hoạch lắp đặt',false),
  ('interior:installation:write','installation','WRITE','Tương thích API cũ: tạo hoặc cập nhật lắp đặt',false),
  ('interior:installation:execute','installation','EXECUTE','Xác nhận tác vụ lắp đặt',true),
  ('interior:qc:read','qc','READ','Xem QC và punch list',false),
  ('interior:qc:create','qc','CREATE','Tạo hạng mục QC/lỗi',false),
  ('interior:qc:update','qc','UPDATE','Cập nhật hạng mục QC',false),
  ('interior:qc:write','qc','WRITE','Tương thích API cũ: tạo hoặc cập nhật QC',false),
  ('interior:qc:approve','qc','APPROVE','Xác nhận kết quả QC',true),
  ('interior:qc:execute','qc','EXECUTE','Thực hiện kiểm tra QC',true),
  ('interior:delivery:read','delivery','READ','Xem bàn giao và nghiệm thu',false),
  ('interior:delivery:create','delivery','CREATE','Tạo hồ sơ bàn giao',false),
  ('interior:delivery:update','delivery','UPDATE','Cập nhật hồ sơ bàn giao',false),
  ('interior:delivery:write','delivery','WRITE','Tương thích API cũ: tạo hoặc cập nhật bàn giao',false),
  ('interior:handover:approve','handover','APPROVE','Phê duyệt nghiệm thu/bàn giao',true),
  ('interior:warranty:read','warranty','READ','Xem bảo hành',false),
  ('interior:warranty:create','warranty','CREATE','Tạo phiếu bảo hành',false),
  ('interior:warranty:update','warranty','UPDATE','Cập nhật phiếu bảo hành',false),
  ('interior:warranty:write','warranty','WRITE','Tương thích API cũ: tạo hoặc cập nhật bảo hành',false),
  ('interior:warranty:close','warranty','CLOSE','Đóng yêu cầu bảo hành',true),
  ('interior:warranty:export','warranty','EXPORT','Xuất dữ liệu bảo hành',false),
  ('interior:reports:read','reports','READ','Xem báo cáo',false),
  ('interior:reports:export','reports','EXPORT','Xuất báo cáo',false),
  ('interior:users:read','users','READ','Xem danh sách nhân viên',false),
  ('interior:users:manage','users','MANAGE_USERS','Quản lý vai trò và phạm vi nhân viên',true),
  ('interior:roles:read','roles','READ','Xem danh mục vai trò và quyền',false),
  ('interior:roles:assign','roles','MANAGE_ROLES','Gán vai trò đã được OWNER ủy quyền',true),
  ('interior:roles:manage','roles','MANAGE_ROLES','Quản trị role matrix',true),
  ('interior:company:read','company','READ','Xem cấu hình doanh nghiệp',false),
  ('interior:company:manage','company','UPDATE','Cấu hình doanh nghiệp',true),
  ('interior:branch:read','branch','READ','Xem chi nhánh',false),
  ('interior:branch:manage','branch','UPDATE','Cấu hình chi nhánh',true),
  ('interior:audit:read','audit','VIEW_AUDIT_LOG','Xem audit log đầy đủ',true),
  ('interior:audit:read_limited','audit','VIEW_AUDIT_LOG','Xem thống kê audit giới hạn',false),
  ('interior:executive:approve','legacy','APPROVE','Tương thích action cũ; không được suy ra từ quyền báo cáo',true)
ON CONFLICT (permission_id) DO NOTHING;

-- Fixed role matrix. WRITE aliases preserve callers that have not yet migrated;
-- they never imply APPROVE, EXECUTE, SIGN, REFUND, or RELEASE.
INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT 'OWNER', permission_id FROM public.interior_permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES
  ('ADMIN','interior:project:read'),('ADMIN','interior:project:create'),('ADMIN','interior:project:update'),('ADMIN','interior:project:write'),
  ('ADMIN','interior:customer:read'),('ADMIN','interior:design:read'),('ADMIN','interior:design:create'),('ADMIN','interior:design:update'),('ADMIN','interior:design:write'),
  ('ADMIN','interior:boq:read'),('ADMIN','interior:boq:create'),('ADMIN','interior:boq:update'),('ADMIN','interior:boq:write'),
  ('ADMIN','interior:contract:read'),('ADMIN','interior:contract:create'),('ADMIN','interior:contract:update'),('ADMIN','interior:contract:write'),('ADMIN','interior:finance:read'),
  ('ADMIN','interior:schedule:read'),('ADMIN','interior:schedule:create'),('ADMIN','interior:schedule:update'),('ADMIN','interior:schedule:write'),
  ('ADMIN','interior:production:read'),('ADMIN','interior:production:create'),('ADMIN','interior:production:update'),('ADMIN','interior:production:write'),
  ('ADMIN','interior:installation:read'),('ADMIN','interior:installation:create'),('ADMIN','interior:installation:update'),('ADMIN','interior:installation:write'),
  ('ADMIN','interior:qc:read'),('ADMIN','interior:qc:create'),('ADMIN','interior:qc:update'),('ADMIN','interior:qc:write'),
  ('ADMIN','interior:delivery:read'),('ADMIN','interior:delivery:create'),('ADMIN','interior:delivery:update'),('ADMIN','interior:delivery:write'),
  ('ADMIN','interior:warranty:read'),('ADMIN','interior:warranty:create'),('ADMIN','interior:warranty:update'),('ADMIN','interior:warranty:write'),
  ('ADMIN','interior:users:read'),('ADMIN','interior:users:manage'),('ADMIN','interior:roles:read'),('ADMIN','interior:roles:assign'),
  ('ADMIN','interior:company:read'),('ADMIN','interior:company:manage'),('ADMIN','interior:branch:read'),('ADMIN','interior:branch:manage'),('ADMIN','interior:audit:read'),
  ('SALES','interior:project:read'),('SALES','interior:project:create'),('SALES','interior:project:update'),('SALES','interior:project:write'),('SALES','interior:customer:read'),
  ('SALES','interior:design:read'),('SALES','interior:boq:read'),('SALES','interior:contract:read'),('SALES','interior:contract:create'),('SALES','interior:contract:update'),('SALES','interior:contract:write'),
  ('SALES','interior:finance:read'),('SALES','interior:schedule:read'),('SALES','interior:installation:read'),('SALES','interior:qc:read'),('SALES','interior:delivery:read'),('SALES','interior:warranty:read'),
  ('DESIGNER','interior:project:read'),('DESIGNER','interior:design:read'),('DESIGNER','interior:design:create'),('DESIGNER','interior:design:update'),('DESIGNER','interior:design:write'),('DESIGNER','interior:design:upload'),
  ('DESIGNER','interior:boq:read'),('DESIGNER','interior:contract:read'),('DESIGNER','interior:schedule:read'),('DESIGNER','interior:installation:read'),('DESIGNER','interior:production:read'),('DESIGNER','interior:qc:read'),('DESIGNER','interior:delivery:read'),
  ('QS','interior:project:read'),('QS','interior:design:read'),('QS','interior:boq:read'),('QS','interior:boq:create'),('QS','interior:boq:update'),('QS','interior:boq:write'),
  ('QS','interior:contract:read'),('QS','interior:contract:create'),('QS','interior:contract:update'),('QS','interior:contract:write'),('QS','interior:finance:read'),('QS','interior:schedule:read'),('QS','interior:installation:read'),('QS','interior:production:read'),
  ('PM','interior:project:read'),('PM','interior:project:create'),('PM','interior:project:update'),('PM','interior:project:write'),('PM','interior:design:read'),('PM','interior:boq:read'),('PM','interior:contract:read'),('PM','interior:finance:read'),
  ('PM','interior:schedule:read'),('PM','interior:schedule:create'),('PM','interior:schedule:update'),('PM','interior:schedule:write'),('PM','interior:installation:read'),('PM','interior:installation:create'),('PM','interior:installation:update'),('PM','interior:installation:write'),('PM','interior:production:read'),
  ('PM','interior:boq:approve'),('PM','interior:qc:read'),('PM','interior:qc:create'),('PM','interior:qc:update'),('PM','interior:qc:write'),('PM','interior:delivery:read'),('PM','interior:delivery:create'),('PM','interior:delivery:update'),('PM','interior:delivery:write'),('PM','interior:handover:approve'),('PM','interior:warranty:read'),('PM','interior:production_order:release'),
  ('SITE_MANAGER','interior:project:read'),('SITE_MANAGER','interior:design:read'),('SITE_MANAGER','interior:boq:read'),('SITE_MANAGER','interior:contract:read'),('SITE_MANAGER','interior:schedule:read'),('SITE_MANAGER','interior:installation:read'),('SITE_MANAGER','interior:installation:create'),('SITE_MANAGER','interior:installation:update'),('SITE_MANAGER','interior:installation:write'),('SITE_MANAGER','interior:production:read'),
  ('SITE_MANAGER','interior:qc:read'),('SITE_MANAGER','interior:qc:create'),('SITE_MANAGER','interior:qc:update'),('SITE_MANAGER','interior:qc:write'),('SITE_MANAGER','interior:delivery:read'),('SITE_MANAGER','interior:delivery:create'),('SITE_MANAGER','interior:delivery:update'),('SITE_MANAGER','interior:delivery:write'),('SITE_MANAGER','interior:warranty:read'),
  ('PRODUCTION_MANAGER','interior:project:read'),('PRODUCTION_MANAGER','interior:design:read'),('PRODUCTION_MANAGER','interior:boq:read'),('PRODUCTION_MANAGER','interior:contract:read'),('PRODUCTION_MANAGER','interior:schedule:read'),('PRODUCTION_MANAGER','interior:installation:read'),('PRODUCTION_MANAGER','interior:production:read'),('PRODUCTION_MANAGER','interior:production:create'),('PRODUCTION_MANAGER','interior:production:update'),('PRODUCTION_MANAGER','interior:production:write'),('PRODUCTION_MANAGER','interior:production:execute'),
  ('PRODUCTION_MANAGER','interior:qc:read'),('PRODUCTION_MANAGER','interior:qc:create'),('PRODUCTION_MANAGER','interior:qc:update'),('PRODUCTION_MANAGER','interior:qc:write'),('PRODUCTION_MANAGER','interior:delivery:read'),('PRODUCTION_MANAGER','interior:delivery:create'),('PRODUCTION_MANAGER','interior:delivery:update'),('PRODUCTION_MANAGER','interior:delivery:write'),
  ('QC','interior:project:read'),('QC','interior:design:read'),('QC','interior:boq:read'),('QC','interior:schedule:read'),('QC','interior:installation:read'),('QC','interior:production:read'),('QC','interior:qc:read'),('QC','interior:qc:create'),('QC','interior:qc:update'),('QC','interior:qc:write'),('QC','interior:qc:approve'),('QC','interior:qc:execute'),('QC','interior:delivery:read'),('QC','interior:warranty:read'),
  ('ACCOUNTANT','interior:project:read'),('ACCOUNTANT','interior:boq:read'),('ACCOUNTANT','interior:contract:read'),('ACCOUNTANT','interior:finance:read'),('ACCOUNTANT','interior:finance:write'),('ACCOUNTANT','interior:payment:record'),('ACCOUNTANT','interior:qc:read'),('ACCOUNTANT','interior:delivery:read'),('ACCOUNTANT','interior:warranty:read'),
  ('WARRANTY','interior:project:read'),('WARRANTY','interior:design:read'),('WARRANTY','interior:contract:read'),('WARRANTY','interior:finance:read'),('WARRANTY','interior:installation:read'),('WARRANTY','interior:qc:read'),('WARRANTY','interior:delivery:read'),('WARRANTY','interior:warranty:read'),('WARRANTY','interior:warranty:create'),('WARRANTY','interior:warranty:update'),('WARRANTY','interior:warranty:write'),('WARRANTY','interior:warranty:close'),
  ('EXECUTIVE','interior:project:read'),('EXECUTIVE','interior:customer:read'),('EXECUTIVE','interior:design:read'),('EXECUTIVE','interior:boq:read'),('EXECUTIVE','interior:contract:read'),('EXECUTIVE','interior:finance:read'),('EXECUTIVE','interior:schedule:read'),('EXECUTIVE','interior:production:read'),('EXECUTIVE','interior:installation:read'),('EXECUTIVE','interior:qc:read'),('EXECUTIVE','interior:delivery:read'),('EXECUTIVE','interior:warranty:read'),('EXECUTIVE','interior:reports:read'),('EXECUTIVE','interior:audit:read_limited')
ON CONFLICT DO NOTHING;

ALTER TABLE public.interior_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_user_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_user_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_admin_role_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_permission_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.interior_roles,public.interior_permissions,public.interior_role_permissions,
  public.interior_user_roles,public.interior_user_project_assignments,
  public.interior_user_permission_grants,public.interior_admin_role_delegations,
  public.interior_permission_audit_logs FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.interior_actor_tenant()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT actor.tenant_id
  FROM public.platform_current_actor_profile() actor
  WHERE actor.id = auth.uid()
    AND lower(actor.status) = 'active'
    AND lower(actor.tenant_status) = 'active'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id=actor.tenant_id AND t.status='active'
        AND t.product_key='bella_interior'
    )
    AND EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND au.deleted_at IS NULL
        AND (au.banned_until IS NULL OR au.banned_until <= now())
    )
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.interior_resolve_project_id(
  p_tenant_id uuid,
  p_resource_key text,
  p_resource_id uuid DEFAULT NULL,
  p_parent_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_project_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RETURN NULL; END IF;
  IF public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN RETURN NULL; END IF;
  IF p_project_id IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.interior_projects
    WHERE id=p_project_id AND tenant_id=p_tenant_id;
    RETURN v_project_id;
  END IF;
  CASE p_resource_key
    WHEN 'project' THEN
      SELECT id INTO v_project_id FROM public.interior_projects WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'boq' THEN
      SELECT project_id INTO v_project_id FROM public.interior_boqs WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'design_revision' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'boq_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_boqs WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'design_asset' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'design_material' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'qc_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_qc_punch_list_items WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'payment_milestone' THEN
      SELECT project_id INTO v_project_id FROM public.interior_contracts WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'production_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_production_orders WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'installation_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_site_installation_plans WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    ELSE
      RETURN NULL;
  END CASE;
  RETURN v_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_has_permission(
  p_permission_id text,
  p_tenant_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_actor_tenant_id uuid;
  v_project_branch_id uuid;
  v_branch_id uuid;
  v_project_exists boolean := false;
BEGIN
  IF v_user_id IS NULL OR p_permission_id IS NULL OR p_tenant_id IS NULL THEN RETURN false; END IF;
  v_actor_tenant_id := public.interior_actor_tenant();
  IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id=p_permission_id) THEN RETURN false; END IF;

  IF p_project_id IS NOT NULL THEN
    SELECT true, branch_id INTO v_project_exists,v_project_branch_id
    FROM public.interior_projects WHERE id=p_project_id AND tenant_id=p_tenant_id;
    IF NOT v_project_exists THEN RETURN false; END IF;
    IF p_branch_id IS NOT NULL AND p_branch_id IS DISTINCT FROM v_project_branch_id THEN RETURN false; END IF;
    v_branch_id := v_project_branch_id;
  ELSIF p_branch_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.org_units
                   WHERE id=p_branch_id AND tenant_id=p_tenant_id AND unit_type='branch' AND is_active) THEN
      RETURN false;
    END IF;
    v_branch_id := p_branch_id;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.interior_user_roles ur
    JOIN public.interior_role_permissions rp ON rp.role_key=ur.role_key
    WHERE ur.tenant_id=p_tenant_id AND ur.user_id=v_user_id AND ur.status='ACTIVE'
      AND rp.permission_id=p_permission_id
      AND CASE ur.scope_type
        WHEN 'TENANT' THEN true
        WHEN 'BRANCH' THEN (v_branch_id IS NOT NULL AND ur.scope_id=v_branch_id)
        WHEN 'PROJECT' THEN (p_project_id IS NOT NULL AND ur.scope_id=p_project_id)
        WHEN 'SELF' THEN
          (p_project_id IS NULL AND p_permission_id='interior:project:create')
          OR (p_project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.interior_user_project_assignments a
            WHERE a.tenant_id=p_tenant_id AND a.user_id=v_user_id
              AND a.project_id=p_project_id AND a.status='ACTIVE'
          ))
        ELSE false
      END
  ) OR EXISTS (
    SELECT 1 FROM public.interior_user_permission_grants g
    WHERE g.tenant_id=p_tenant_id AND g.user_id=v_user_id
      AND g.permission_id=p_permission_id AND g.status='ACTIVE'
      AND CASE g.scope_type
        WHEN 'TENANT' THEN true
        WHEN 'BRANCH' THEN (v_branch_id IS NOT NULL AND g.scope_id=v_branch_id)
        WHEN 'PROJECT' THEN (p_project_id IS NOT NULL AND g.scope_id=p_project_id)
        WHEN 'SELF' THEN
          (p_project_id IS NULL AND p_permission_id='interior:project:create')
          OR (p_project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.interior_user_project_assignments a
            WHERE a.tenant_id=p_tenant_id AND a.user_id=v_user_id
              AND a.project_id=p_project_id AND a.status='ACTIVE'
          ))
        ELSE false
      END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_authorize_project_list(p_tenant_id uuid)
RETURNS TABLE(status text,reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor_tenant uuid:=public.interior_actor_tenant(); v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL OR v_actor_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_actor_tenant THEN
    RETURN QUERY SELECT 'DENY'::text,'TENANT_MISMATCH'::text; RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.interior_user_roles ur
    JOIN public.interior_role_permissions rp ON rp.role_key=ur.role_key
    WHERE ur.tenant_id=p_tenant_id AND ur.user_id=v_user AND ur.status='ACTIVE'
      AND rp.permission_id='interior:project:read'
      AND CASE ur.scope_type
        WHEN 'TENANT' THEN true
        WHEN 'BRANCH' THEN EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.tenant_id=p_tenant_id AND p.branch_id=ur.scope_id)
        WHEN 'PROJECT' THEN EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.tenant_id=p_tenant_id AND p.id=ur.scope_id)
        WHEN 'SELF' THEN EXISTS (SELECT 1 FROM public.interior_user_project_assignments a WHERE a.tenant_id=p_tenant_id AND a.user_id=v_user AND a.status='ACTIVE')
        ELSE false
      END
  ) OR EXISTS (
    SELECT 1 FROM public.interior_user_permission_grants g
    WHERE g.tenant_id=p_tenant_id AND g.user_id=v_user AND g.status='ACTIVE'
      AND g.permission_id='interior:project:read'
      AND CASE g.scope_type
        WHEN 'TENANT' THEN true
        WHEN 'BRANCH' THEN EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.tenant_id=p_tenant_id AND p.branch_id=g.scope_id)
        WHEN 'PROJECT' THEN EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.tenant_id=p_tenant_id AND p.id=g.scope_id)
        WHEN 'SELF' THEN EXISTS (SELECT 1 FROM public.interior_user_project_assignments a WHERE a.tenant_id=p_tenant_id AND a.user_id=v_user AND a.status='ACTIVE')
        ELSE false
      END
  ) THEN
    RETURN QUERY SELECT 'ALLOW'::text,'SCOPED_PROJECT_LIST'::text;
  ELSE
    RETURN QUERY SELECT 'DENY'::text,'NO_GRANT'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_projects()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'AuthorizationViolation: active tenant is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_authorize_project_list(v_tenant) a WHERE a.status='ALLOW') THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped project read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'code',p.code,'name',p.name,'status',p.status,
    'customerId',CASE WHEN public.interior_has_permission('interior:customer:read',v_tenant,p.id,p.branch_id) THEN p.customer_id ELSE NULL END,
    'customerName',CASE WHEN public.interior_has_permission('interior:customer:read',v_tenant,p.id,p.branch_id) THEN p.customer_name ELSE NULL END,
    'estimatedBudget',CASE WHEN public.interior_has_permission('interior:finance:read',v_tenant,p.id,p.branch_id)
      OR public.interior_has_permission('interior:contract:read',v_tenant,p.id,p.branch_id) THEN p.estimated_budget ELSE NULL END,
    'targetCompletionDate',p.target_completion_date,'leadArchitectName',p.lead_architect_name
  ) ORDER BY p.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM public.interior_projects p
  WHERE p.tenant_id=v_tenant
    AND public.interior_has_permission('interior:project:read',v_tenant,p.id,p.branch_id);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_authorize_customer_list(p_tenant_id uuid)
RETURNS TABLE(status text,reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor_tenant uuid:=public.interior_actor_tenant();
BEGIN
  IF auth.uid() IS NULL OR v_actor_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_actor_tenant THEN
    RETURN QUERY SELECT 'DENY'::text,'TENANT_MISMATCH'::text;
    RETURN;
  END IF;

  -- A customer list is derived from projects. Require both permissions on at least
  -- one visible project here; the list RPC repeats both checks per row.
  IF EXISTS (
    SELECT 1
    FROM public.interior_projects p
    WHERE p.tenant_id=p_tenant_id
      AND public.interior_has_permission('interior:project:read',p_tenant_id,p.id,p.branch_id)
      AND public.interior_has_permission('interior:customer:read',p_tenant_id,p.id,p.branch_id)
  ) THEN
    RETURN QUERY SELECT 'ALLOW'::text,'SCOPED_CUSTOMER_LIST'::text;
  ELSE
    RETURN QUERY SELECT 'DENY'::text,'NO_GRANT'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_authorize_schedule_list(p_tenant_id uuid)
RETURNS TABLE(status text,reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor_tenant uuid:=public.interior_actor_tenant();
BEGIN
  IF auth.uid() IS NULL OR v_actor_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_actor_tenant THEN
    RETURN QUERY SELECT 'DENY'::text,'TENANT_MISMATCH'::text;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.interior_projects p
    WHERE p.tenant_id=p_tenant_id
      AND public.interior_has_permission('interior:schedule:read',p_tenant_id,p.id,p.branch_id)
  ) THEN
    RETURN QUERY SELECT 'ALLOW'::text,'SCOPED_SCHEDULE_LIST'::text;
  ELSE
    RETURN QUERY SELECT 'DENY'::text,'NO_GRANT'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_read_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_project public.interior_projects%ROWTYPE;
  v_can_read_customer boolean;
  v_can_read_finance boolean;
  v_can_read_contract boolean;
  v_can_read_design boolean;
  v_rooms jsonb:='[]'::jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.id=p_project_id AND p.tenant_id=v_tenant;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:project:read',v_tenant,p_project_id,v_project.branch_id) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped project read is required';
  END IF;
  v_can_read_customer:=public.interior_has_permission('interior:customer:read',v_tenant,p_project_id,v_project.branch_id);
  v_can_read_finance:=public.interior_has_permission('interior:finance:read',v_tenant,p_project_id,v_project.branch_id);
  v_can_read_contract:=public.interior_has_permission('interior:contract:read',v_tenant,p_project_id,v_project.branch_id);
  v_can_read_design:=public.interior_has_permission('interior:design:read',v_tenant,p_project_id,v_project.branch_id);
  IF v_can_read_design THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',z.id,'code',z.code,'name',z.name,'floor',z.floor,'areaSquareMeters',z.area_square_meters
    ) ORDER BY z.floor,z.code),'[]'::jsonb) INTO v_rooms
    FROM public.interior_project_room_zones z
    WHERE z.tenant_id=v_tenant AND z.project_id=p_project_id;
  END IF;
  RETURN jsonb_build_object(
    'id',v_project.id,'code',v_project.code,'name',v_project.name,'status',v_project.status,
    'customerName',CASE WHEN v_can_read_customer THEN v_project.customer_name ELSE NULL END,
    'siteAddress',CASE WHEN v_can_read_customer THEN v_project.site_address ELSE NULL END,
    'projectType',v_project.project_type,
    'totalFloorAreaSquareMeters',CASE WHEN v_can_read_design THEN coalesce((SELECT sum(z.area_square_meters)
      FROM public.interior_project_room_zones z WHERE z.tenant_id=v_tenant AND z.project_id=p_project_id),0) ELSE 0 END,
    'estimatedBudget',CASE WHEN v_can_read_finance OR v_can_read_contract THEN v_project.estimated_budget ELSE NULL END,
    'targetCompletionDate',v_project.target_completion_date,'leadArchitectName',v_project.lead_architect_name,
    'rooms',v_rooms,'materials',NULL,'progress',NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_room_zones(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:design:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped design read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',z.id,'tenantId',z.tenant_id,'projectId',z.project_id,'code',z.code,'name',z.name,
    'floor',z.floor,'areaSquareMeters',z.area_square_meters,'description',z.description
  ) ORDER BY z.floor,z.code),'[]'::jsonb)
  INTO v_result
  FROM public.interior_project_room_zones z
  WHERE z.tenant_id=v_tenant AND z.project_id=p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_design_revisions(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:design:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped design read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'tenantId',r.tenant_id,'projectId',r.project_id,'versionNumber',r.version_number,
    'title',r.title,'status',r.status,'changeSummary',r.change_summary,'submittedBy',r.submitted_by,
    'submittedAt',r.submitted_at,'approvedBy',r.approved_by,'approvedAt',r.approved_at,
    'clientSignoffName',r.client_signoff_name,'clientSignoffDate',r.client_signoff_date,
    'assets',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'tenantId',a.tenant_id,'revisionId',a.revision_id,'type',a.asset_type,
      'title',a.title,'fileUrl',a.file_url,'roomZoneId',a.room_zone_id,'notes',a.notes
    ) ORDER BY a.created_at,a.id) FROM public.interior_design_assets a
      WHERE a.tenant_id=v_tenant AND a.revision_id=r.id),'[]'::jsonb),
    'materialSpecs',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'tenantId',m.tenant_id,'revisionId',m.revision_id,'itemCategory',m.item_category,
      'brand',m.brand,'code',m.code,'name',m.name,'colorTone',m.color_tone,
      'specDescription',m.spec_description,'approvedForUse',m.approved_for_use
    ) ORDER BY m.created_at,m.id) FROM public.interior_design_material_specs m
      WHERE m.tenant_id=v_tenant AND m.revision_id=r.id),'[]'::jsonb)
  ) ORDER BY r.version_number),'[]'::jsonb)
  INTO v_result
  FROM public.interior_design_revisions r
  WHERE r.tenant_id=v_tenant AND r.project_id=p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_installation_plans(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant is required';
  END IF;
  IF p_project_id IS NOT NULL AND NOT public.interior_has_permission('interior:schedule:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped schedule read is required';
  END IF;
  IF p_project_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.interior_projects p WHERE p.tenant_id=v_tenant
      AND public.interior_has_permission('interior:schedule:read',v_tenant,p.id,p.branch_id)
  ) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped schedule read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'tenantId',i.tenant_id,'projectId',i.project_id,'planNumber',i.plan_number,
    'siteSupervisorId',i.site_supervisor_id,'siteSupervisorName',i.site_supervisor_name,
    'scheduledStartDate',i.scheduled_start_date,'scheduledEndDate',i.scheduled_end_date,
    'overallProgressPercent',i.overall_progress_percent,
    'rooms',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'tenantId',r.tenant_id,'planId',r.plan_id,'roomZoneId',r.room_zone_id,
      'roomZoneName',r.room_zone_name,'status',r.status,'installerTeamLeader',r.installer_team_leader,
      'progressPercent',r.progress_percent,'targetInstallDate',r.target_install_date,'completedDate',r.completed_date
    ) ORDER BY r.target_install_date,r.id) FROM public.interior_site_room_installations r
      WHERE r.tenant_id=v_tenant AND r.plan_id=i.id),'[]'::jsonb)
  ) ORDER BY i.scheduled_start_date,i.id),'[]'::jsonb)
  INTO v_result
  FROM public.interior_site_installation_plans i
  WHERE i.tenant_id=v_tenant
    AND (p_project_id IS NULL OR i.project_id=p_project_id)
    AND public.interior_has_permission('interior:schedule:read',v_tenant,i.project_id,NULL);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_site_diaries(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:installation:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped installation read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'tenantId',d.tenant_id,'projectId',d.project_id,'date',d.date,'weather',d.weather,
    'workersPresent',d.labor_headcount,'activitiesCompleted',d.activities_completed,
    'materialDelivered',d.material_delivered,'issuesNoted',d.issues_noted,
    'supervisorName',d.supervisor_name,'photoUrls',d.photo_urls,'createdAt',d.created_at
  ) ORDER BY d.date DESC,d.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM public.interior_site_diaries d
  WHERE d.tenant_id=v_tenant AND d.project_id=p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_create_site_diary(
  p_project_id uuid,p_entry_date date,p_labor_headcount integer,p_weather text,
  p_activities_completed text[],p_issues_noted text DEFAULT ''
)
RETURNS TABLE(status text,reason text,entry_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_supervisor text;
  v_entry_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_entry_date IS NULL OR p_labor_headcount IS NULL OR p_labor_headcount<0
    OR p_weather IS NULL OR p_weather NOT IN ('sunny','cloudy','rainy','stormy')
    OR p_activities_completed IS NULL OR cardinality(p_activities_completed)<1 OR cardinality(p_activities_completed)>50
    OR EXISTS (SELECT 1 FROM unnest(p_activities_completed) item WHERE nullif(trim(item),'') IS NULL OR length(item)>2000)
    OR length(coalesce(p_issues_noted,''))>5000 THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_SITE_DIARY_INPUT'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p
    WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:installation:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'SITE_DIARY_CREATE_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT coalesce(nullif(trim(a.full_name),''),'Interior staff') INTO v_supervisor
  FROM public.platform_current_actor_profile() a WHERE a.id=v_actor;
  INSERT INTO public.interior_site_diaries(
    tenant_id,project_id,date,weather,labor_headcount,activities_completed,material_delivered,
    issues_noted,supervisor_name,photo_urls
  ) VALUES(v_tenant,p_project_id,p_entry_date,p_weather,p_labor_headcount,p_activities_completed,
    ARRAY[]::text[],nullif(trim(coalesce(p_issues_noted,'')),''),coalesce(v_supervisor,'Interior staff'),ARRAY[]::text[])
  RETURNING id INTO v_entry_id;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_site_diaries',v_entry_id,'CREATE',NULL,
    jsonb_build_object('project_id',p_project_id,'date',p_entry_date,'labor_headcount',p_labor_headcount),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'SITE_DIARY_CREATED'::text,v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_qc_items(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:qc:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped QC read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'tenantId',q.tenant_id,'projectId',q.project_id,'roomZoneId',q.room_zone_id,
    'reportedByUserId',q.reported_by_user_id,
    'roomZoneName',q.room_zone_name,'itemName',q.item_name,'category',q.defect_category,
    'description',q.description,'severity',q.severity,'photoUrl',q.photo_url,
    'assignedFixer',q.assigned_fixer,'deadline',q.deadline,'status',q.status,
    'rectificationNote',q.rectification_note,'verifiedBy',q.verified_by,
    'verifiedAt',q.verified_at,'createdAt',q.created_at,'updatedAt',q.updated_at
  ) ORDER BY q.created_at DESC,q.id),'[]'::jsonb)
  INTO v_result
  FROM public.interior_qc_punch_list_items q
  WHERE q.tenant_id=v_tenant AND q.project_id=p_project_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_read_qc_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_item public.interior_qc_punch_list_items%ROWTYPE;
BEGIN
  IF v_tenant IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and QC item are required';
  END IF;
  SELECT * INTO v_item FROM public.interior_qc_punch_list_items q
  WHERE q.id=p_item_id AND q.tenant_id=v_tenant;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public.interior_has_permission('interior:qc:read',v_tenant,v_item.project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped QC read is required';
  END IF;
  RETURN jsonb_build_object(
    'id',v_item.id,'tenantId',v_item.tenant_id,'projectId',v_item.project_id,'roomZoneId',v_item.room_zone_id,
    'reportedByUserId',v_item.reported_by_user_id,
    'roomZoneName',v_item.room_zone_name,'itemName',v_item.item_name,'category',v_item.defect_category,
    'description',v_item.description,'severity',v_item.severity,'photoUrl',v_item.photo_url,
    'assignedFixer',v_item.assigned_fixer,'deadline',v_item.deadline,'status',v_item.status,
    'rectificationNote',v_item.rectification_note,'verifiedBy',v_item.verified_by,
    'verifiedAt',v_item.verified_at,'createdAt',v_item.created_at,'updatedAt',v_item.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_create_qc_item(
  p_project_id uuid,p_room_zone_id uuid,p_description text,p_category text,p_severity text
)
RETURNS TABLE(status text,reason text,item jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_actor uuid:=auth.uid();
  v_room_name text:='Khu vực chính';
  v_item public.interior_qc_punch_list_items%ROWTYPE;
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 1 AND 4000
    OR p_category IS NULL OR p_category NOT IN ('finishing','structural','furniture_fit','electrical_coordination','painting')
    OR p_severity IS NULL OR p_severity NOT IN ('critical','major','minor') THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_ITEM_INPUT'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::jsonb; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:qc:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_CREATE_PERMISSION_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_room_zone_id IS NOT NULL THEN
    SELECT z.name INTO v_room_name FROM public.interior_project_room_zones z
    WHERE z.id=p_room_zone_id AND z.project_id=p_project_id AND z.tenant_id=v_tenant;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'DENIED'::text,'ROOM_ZONE_NOT_FOUND'::text,NULL::jsonb; RETURN;
    END IF;
  END IF;
  INSERT INTO public.interior_qc_punch_list_items(
    tenant_id,project_id,room_zone_id,reported_by_user_id,room_zone_name,item_name,defect_category,description,severity,
    assigned_fixer,deadline,status
  ) VALUES(v_tenant,p_project_id,p_room_zone_id,v_actor,v_room_name,left(trim(p_description),30),p_category,
    trim(p_description),p_severity,'Chưa phân công',current_date+3,'open')
  RETURNING * INTO v_item;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_qc_punch_list_items',v_item.id,'CREATE',NULL,
    jsonb_build_object('project_id',p_project_id,'room_zone_id',p_room_zone_id,'severity',p_severity,'status','open'),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'QC_ITEM_CREATED'::text,
    jsonb_build_object('id',v_item.id,'tenantId',v_item.tenant_id,'projectId',v_item.project_id,
      'roomZoneId',v_item.room_zone_id,'reportedByUserId',v_item.reported_by_user_id,
      'roomZoneName',v_item.room_zone_name,'itemName',v_item.item_name,
      'category',v_item.defect_category,'description',v_item.description,'severity',v_item.severity,
      'photoUrl',v_item.photo_url,'assignedFixer',v_item.assigned_fixer,'deadline',v_item.deadline,
      'status',v_item.status,'rectificationNote',v_item.rectification_note,'verifiedBy',v_item.verified_by,
      'verifiedAt',v_item.verified_at,'createdAt',v_item.created_at,'updatedAt',v_item.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_update_qc_item(
  p_item_id uuid,p_status text,p_rectification_note text DEFAULT NULL
)
RETURNS TABLE(status text,reason text,item jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_actor uuid:=auth.uid();
  v_item public.interior_qc_punch_list_items%ROWTYPE;
  v_old_item public.interior_qc_punch_list_items%ROWTYPE;
  v_permission text;
  v_action text;
BEGIN
  IF v_tenant IS NULL OR v_actor IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_item_id IS NULL OR p_status IS NULL OR p_status NOT IN ('open','in_progress','rectified','verified')
    OR (p_rectification_note IS NOT NULL AND length(p_rectification_note)>4000) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_ITEM_INPUT'::text,NULL::jsonb; RETURN;
  END IF;
  SELECT * INTO v_item FROM public.interior_qc_punch_list_items q
  WHERE q.id=p_item_id AND q.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_ITEM_NOT_FOUND'::text,NULL::jsonb; RETURN;
  END IF;
  v_old_item:=v_item;
  v_permission:=CASE WHEN p_status='verified' THEN 'interior:qc:approve' ELSE 'interior:qc:update' END;
  IF NOT public.interior_has_permission(v_permission,v_tenant,v_item.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_UPDATE_PERMISSION_REQUIRED'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_status IS DISTINCT FROM v_item.status AND NOT (
    (v_item.status='open' AND p_status='in_progress')
    OR (v_item.status='in_progress' AND p_status='rectified')
    OR (v_item.status='rectified' AND p_status='verified')
  ) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_QC_STATE_TRANSITION'::text,NULL::jsonb; RETURN;
  END IF;
  IF p_status='verified' AND v_item.status<>'rectified' THEN
    RETURN QUERY SELECT 'DENIED'::text,'QC_ITEM_MUST_BE_RECTIFIED_BEFORE_VERIFICATION'::text,NULL::jsonb; RETURN;
  END IF;
  UPDATE public.interior_qc_punch_list_items q SET
    status=p_status,
    rectification_note=coalesce(p_rectification_note,q.rectification_note),
    verified_by=CASE WHEN p_status='verified' THEN v_actor::text ELSE q.verified_by END,
    verified_at=CASE WHEN p_status='verified' THEN statement_timestamp() ELSE q.verified_at END,
    updated_at=statement_timestamp()
  WHERE q.id=p_item_id AND q.tenant_id=v_tenant
  RETURNING * INTO v_item;
  v_action:=CASE WHEN p_status='verified' THEN 'APPROVE' ELSE 'UPDATE' END;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_qc_punch_list_items',v_item.id,v_action,to_jsonb(v_old_item),
    to_jsonb(v_item),v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'QC_ITEM_UPDATED'::text,
    jsonb_build_object('id',v_item.id,'tenantId',v_item.tenant_id,'projectId',v_item.project_id,
      'roomZoneId',v_item.room_zone_id,'reportedByUserId',v_item.reported_by_user_id,
      'roomZoneName',v_item.room_zone_name,'itemName',v_item.item_name,
      'category',v_item.defect_category,'description',v_item.description,'severity',v_item.severity,
      'photoUrl',v_item.photo_url,'assignedFixer',v_item.assigned_fixer,'deadline',v_item.deadline,
      'status',v_item.status,'rectificationNote',v_item.rectification_note,'verifiedBy',v_item.verified_by,
      'verifiedAt',v_item.verified_at,'createdAt',v_item.created_at,'updatedAt',v_item.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_read_boqs(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_tenant uuid:=public.interior_actor_tenant();
  v_can_read_internal boolean;
  v_can_read_client boolean;
  v_boqs jsonb;
  v_total integer;
  v_internal_total numeric;
  v_client_total numeric;
  v_margin_total numeric;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:boq:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped BOQ read is required';
  END IF;
  v_can_read_internal:=public.interior_has_permission('interior:finance:read',v_tenant,p_project_id,NULL);
  v_can_read_client:=v_can_read_internal OR public.interior_has_permission('interior:contract:read',v_tenant,p_project_id,NULL);
  SELECT count(*)::integer,coalesce(sum(b.total_internal_cost),0),coalesce(sum(b.total_client_price),0),
    coalesce(sum(b.total_gross_margin),0)
  INTO v_total,v_internal_total,v_client_total,v_margin_total
  FROM public.interior_boqs b WHERE b.tenant_id=v_tenant AND b.project_id=p_project_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'tenantId',b.tenant_id,'projectId',b.project_id,'designRevisionId',b.design_revision_id,
    'boqNumber',b.boq_number,'versionNumber',b.version_number,'status',b.status,
    'totalInternalCost',CASE WHEN v_can_read_internal THEN b.total_internal_cost ELSE NULL END,
    'totalClientPrice',CASE WHEN v_can_read_client THEN b.total_client_price ELSE NULL END,
    'totalGrossMargin',CASE WHEN v_can_read_internal THEN b.total_gross_margin ELSE NULL END,
    'grossMarginPercent',CASE WHEN v_can_read_internal THEN b.gross_margin_percent ELSE NULL END,
    'preparedBy',b.prepared_by,'createdAt',b.created_at,'updatedAt',b.updated_at,
    'items',coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',i.id,'tenantId',i.tenant_id,'boqId',i.boq_id,'roomZoneId',i.room_zone_id,'roomZoneName',i.room_zone_name,
      'itemCode',i.item_code,'itemName',i.item_name,'category',i.category,'dimensions',i.dimensions_json,
      'specifications',i.specifications_json,'unit',i.unit,'quantity',i.quantity,
      'internalUnitCost',CASE WHEN v_can_read_internal THEN i.internal_unit_cost ELSE NULL END,
      'internalTotalCost',CASE WHEN v_can_read_internal THEN i.internal_total_cost ELSE NULL END,
      'clientUnitPrice',CASE WHEN v_can_read_client THEN i.client_unit_price ELSE NULL END,
      'clientTotalPrice',CASE WHEN v_can_read_client THEN i.client_total_price ELSE NULL END,
      'grossMarginAmount',CASE WHEN v_can_read_internal THEN i.gross_margin_amount ELSE NULL END,
      'grossMarginPercent',CASE WHEN v_can_read_internal THEN i.gross_margin_percent ELSE NULL END
    )) ORDER BY i.item_code,i.id) FROM public.interior_boq_items i
      WHERE i.tenant_id=v_tenant AND i.boq_id=b.id),'[]'::jsonb)
  ) ORDER BY b.version_number DESC,b.created_at DESC),'[]'::jsonb) INTO v_boqs
  FROM public.interior_boqs b WHERE b.tenant_id=v_tenant AND b.project_id=p_project_id;
  RETURN jsonb_build_object(
    'projectId',p_project_id,'boqs',v_boqs,'total',v_total,
    'totals',jsonb_strip_nulls(jsonb_build_object(
      'internalCost',CASE WHEN v_can_read_internal THEN v_internal_total ELSE NULL END,
      'clientPrice',CASE WHEN v_can_read_client THEN v_client_total ELSE NULL END,
      'grossMargin',CASE WHEN v_can_read_internal THEN v_margin_total ELSE NULL END
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_authorize_action(
  p_permission_id text,
  p_tenant_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(status text,reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor_tenant uuid;
BEGIN
  IF auth.uid() IS NULL OR p_permission_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN QUERY SELECT 'DENY'::text,'INVALID_CONTEXT'::text; RETURN;
  END IF;
  v_actor_tenant := public.interior_actor_tenant();
  IF v_actor_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENY'::text,'INVALID_CONTEXT'::text; RETURN;
  END IF;
  IF p_tenant_id IS DISTINCT FROM v_actor_tenant THEN
    RETURN QUERY SELECT 'DENY'::text,'TENANT_MISMATCH'::text; RETURN;
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.interior_projects WHERE id=p_project_id AND tenant_id=p_tenant_id
  ) THEN
    RETURN QUERY SELECT 'DENY'::text,'TENANT_MISMATCH'::text; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id=p_permission_id) THEN
    RETURN QUERY SELECT 'DENY'::text,'INVALID_CONTEXT'::text; RETURN;
  END IF;
  IF public.interior_has_permission(p_permission_id,p_tenant_id,p_project_id,p_branch_id) THEN
    IF EXISTS (SELECT 1 FROM public.interior_user_permission_grants g
               WHERE g.tenant_id=p_tenant_id AND g.user_id=auth.uid()
                 AND g.permission_id=p_permission_id AND g.status='ACTIVE') THEN
      RETURN QUERY SELECT 'ALLOW'::text,'AUTHORIZED'::text;
    ELSE
      RETURN QUERY SELECT 'ALLOW'::text,'AUTHORIZED'::text;
    END IF;
  ELSE
    RETURN QUERY SELECT 'DENY'::text,'NO_GRANT'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_is_owner(p_tenant_id uuid,p_user_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interior_user_roles ur
    WHERE ur.tenant_id=p_tenant_id AND ur.user_id=coalesce(p_user_id,auth.uid())
      AND ur.role_key='OWNER' AND ur.scope_type='TENANT' AND ur.status='ACTIVE'
  ) AND public.interior_actor_tenant()=p_tenant_id
$$;

CREATE OR REPLACE FUNCTION public.interior_actor_can_manage_roles(p_tenant_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN RETURN false; END IF;
  IF public.interior_is_owner(p_tenant_id,v_user_id) THEN RETURN true; END IF;
  RETURN public.interior_has_permission('interior:roles:assign',p_tenant_id,NULL,NULL)
    AND EXISTS (SELECT 1 FROM public.interior_user_roles ur
                WHERE ur.tenant_id=p_tenant_id AND ur.user_id=v_user_id
                  AND ur.role_key='ADMIN' AND ur.scope_type='TENANT' AND ur.status='ACTIVE');
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_create_project(
  p_code text,p_name text,p_customer_id text,p_customer_name text,p_customer_phone text,
  p_site_address text,p_project_type text,p_estimated_budget numeric,
  p_target_completion_date date,p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(status text,reason text,project_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_actor_name text;
  v_project_id uuid;
  v_project_snapshot jsonb;
  v_self_scope boolean;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF nullif(trim(p_code),'') IS NULL OR nullif(trim(p_name),'') IS NULL
     OR nullif(trim(p_customer_id),'') IS NULL OR p_estimated_budget IS NULL OR p_estimated_budget<0
     OR p_target_completion_date IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_PROJECT_INPUT'::text,NULL::uuid; RETURN;
  END IF;
  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_units b WHERE b.id=p_branch_id AND b.tenant_id=v_tenant
      AND b.unit_type='branch' AND b.is_active
  ) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_BRANCH'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:project:create',v_tenant,NULL,p_branch_id) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_CREATE_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT actor.full_name INTO v_actor_name FROM public.platform_current_actor_profile() actor
  WHERE actor.id=v_actor;
  INSERT INTO public.interior_projects(
    tenant_id,code,name,customer_id,customer_name,customer_phone,site_address,
    project_type,status,estimated_budget,target_completion_date,lead_architect_id,
    lead_architect_name,branch_id
  ) VALUES (
    v_tenant,trim(p_code),trim(p_name),trim(p_customer_id),coalesce(nullif(trim(p_customer_name),''),trim(p_customer_id)),
    coalesce(p_customer_phone,''),coalesce(p_site_address,''),coalesce(nullif(trim(p_project_type),''),'residential_villa'),
    'concept_design',p_estimated_budget,p_target_completion_date,v_actor::text,coalesce(nullif(trim(v_actor_name),''),'Interior staff'),p_branch_id
  ) RETURNING id INTO v_project_id;
  v_self_scope:=EXISTS (
    SELECT 1 FROM public.interior_user_roles ur
    JOIN public.interior_role_permissions rp ON rp.role_key=ur.role_key
    WHERE ur.tenant_id=v_tenant AND ur.user_id=v_actor AND ur.status='ACTIVE'
      AND ur.scope_type='SELF' AND rp.permission_id='interior:project:create'
  ) OR EXISTS (
    SELECT 1 FROM public.interior_user_permission_grants g
    WHERE g.tenant_id=v_tenant AND g.user_id=v_actor AND g.status='ACTIVE'
      AND g.scope_type='SELF' AND g.permission_id='interior:project:create'
  );
  IF v_self_scope THEN
    INSERT INTO public.interior_user_project_assignments(tenant_id,project_id,user_id,assigned_by)
    VALUES(v_tenant,v_project_id,v_actor,v_actor);
  END IF;
  SELECT to_jsonb(p) INTO v_project_snapshot FROM public.interior_projects p
  WHERE p.id=v_project_id AND p.tenant_id=v_tenant;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_projects',v_project_id,'INSERT',NULL,v_project_snapshot,v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'PROJECT_CREATED'::text,v_project_id;
EXCEPTION WHEN unique_violation THEN
  RETURN QUERY SELECT 'DENIED'::text,'PROJECT_CODE_ALREADY_EXISTS'::text,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_approve_boq(p_boq_id uuid)
RETURNS TABLE(status text,reason text,boq_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_boq public.interior_boqs%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT * INTO v_boq FROM public.interior_boqs b
  WHERE b.id=p_boq_id AND b.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:boq:approve',v_tenant,v_boq.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_APPROVAL_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF v_boq.status NOT IN ('draft','review') OR v_boq.prepared_by_user_id IS NULL
     OR v_boq.prepared_by_user_id=v_actor THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_CREATOR_CANNOT_APPROVE_OR_STATE_NOT_APPROVABLE'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_design_revisions r
    WHERE r.id=v_boq.design_revision_id AND r.project_id=v_boq.project_id
      AND r.tenant_id=v_tenant AND r.status='approved') THEN
    RETURN QUERY SELECT 'DENIED'::text,'APPROVED_DESIGN_REVISION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  UPDATE public.interior_boqs SET status='approved',approved_by_user_id=v_actor,updated_at=statement_timestamp()
  WHERE id=v_boq.id AND tenant_id=v_tenant;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_boqs',v_boq.id,'APPROVE',to_jsonb(v_boq),
    jsonb_build_object('id',v_boq.id,'status','approved','approved_by_user_id',v_actor),v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'BOQ_APPROVED'::text,v_boq.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_approve_design_revision(
  p_revision_id uuid,p_approval_notes text DEFAULT NULL
)
RETURNS TABLE(status text,reason text,revision_id uuid,approved_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_revision public.interior_design_revisions%ROWTYPE;
  v_approved_at timestamptz:=statement_timestamp();
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF p_revision_id IS NULL OR (p_approval_notes IS NOT NULL AND length(trim(p_approval_notes))>2000) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_APPROVAL_INPUT'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  SELECT * INTO v_revision FROM public.interior_design_revisions r
  WHERE r.id=p_revision_id AND r.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_NOT_FOUND'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:design:approve',v_tenant,v_revision.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGN_APPROVAL_PERMISSION_REQUIRED'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.status='approved' THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_ALREADY_APPROVED'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.status NOT IN ('draft','in_review','client_review') THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_STATE_NOT_APPROVABLE'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.submitted_by_user_id IS NOT NULL AND v_revision.submitted_by_user_id=v_actor THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGNER_CANNOT_APPROVE_OWN_REVISION'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  UPDATE public.interior_design_revisions SET
    status='approved',
    approved_by=v_actor::text,
    approved_at=v_approved_at,
    approved_by_user_id=v_actor,
    change_summary=coalesce(nullif(trim(p_approval_notes),''),v_revision.change_summary,'Approved for production')
  WHERE id=v_revision.id AND tenant_id=v_tenant;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_design_revisions',v_revision.id,'APPROVE',to_jsonb(v_revision),
    jsonb_build_object('id',v_revision.id,'status','approved','approved_by_user_id',v_actor,'approved_at',v_approved_at),
    v_actor,v_approved_at);
  RETURN QUERY SELECT 'COMMITTED'::text,'DESIGN_REVISION_APPROVED'::text,v_revision.id,v_approved_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_create_design_revision(
  p_project_id uuid,p_title text,p_version_number integer
)
RETURNS TABLE(status text,reason text,revision_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_revision_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_version_number IS NULL OR p_version_number<1
    OR p_version_number>10000 OR p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 300 THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_REVISION_INPUT'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p
    WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:design:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGN_CREATE_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  BEGIN
    INSERT INTO public.interior_design_revisions(
      tenant_id,project_id,version_number,title,status,submitted_by,submitted_by_user_id,submitted_at
    ) VALUES (v_tenant,p_project_id,p_version_number,trim(p_title),'draft',v_actor::text,v_actor,statement_timestamp())
    RETURNING id INTO v_revision_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_NUMBER_ALREADY_EXISTS'::text,NULL::uuid;
    RETURN;
  END;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_design_revisions',v_revision_id,'CREATE',NULL,
    jsonb_build_object('project_id',p_project_id,'version_number',p_version_number,'title',trim(p_title),'status','draft'),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'DESIGN_REVISION_CREATED'::text,v_revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_register_invited_user(
  p_user_id uuid,p_full_name text,p_role_key text,p_scope_type text,p_scope_id uuid DEFAULT NULL
)
RETURNS TABLE(status text,reason text,user_id uuid,assignment_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_email text;
  v_is_owner boolean;
  v_assignment_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_actor_can_manage_roles(v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'USER_MANAGEMENT_DENIED'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF p_user_id IS NULL OR nullif(trim(p_full_name),'') IS NULL OR p_role_key IS NULL
     OR p_scope_type IS NULL OR p_scope_type NOT IN ('TENANT','BRANCH','PROJECT','SELF')
     OR NOT EXISTS(SELECT 1 FROM public.interior_roles r WHERE r.role_key=p_role_key) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_USER_ROLE_OR_SCOPE'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  v_is_owner:=public.interior_is_owner(v_tenant,v_actor);
  IF p_role_key='OWNER' AND (NOT v_is_owner OR p_scope_type<>'TENANT') THEN
    RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY_TENANT_SCOPE'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF NOT v_is_owner AND NOT EXISTS (
    SELECT 1 FROM public.interior_admin_role_delegations d
    WHERE d.tenant_id=v_tenant AND d.admin_user_id=v_actor AND d.role_key=p_role_key AND d.status='ACTIVE'
  ) THEN
    RETURN QUERY SELECT 'DENIED'::text,'ROLE_NOT_DELEGATED'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF (p_scope_type IN ('TENANT','SELF') AND p_scope_id IS NOT NULL)
     OR (p_scope_type='BRANCH' AND NOT EXISTS (
       SELECT 1 FROM public.org_units b WHERE b.id=p_scope_id AND b.tenant_id=v_tenant
         AND b.unit_type='branch' AND b.is_active
     ))
     OR (p_scope_type='PROJECT' AND NOT EXISTS (
       SELECT 1 FROM public.interior_projects p WHERE p.id=p_scope_id AND p.tenant_id=v_tenant
     )) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  SELECT au.email INTO v_email FROM auth.users au
  WHERE au.id=p_user_id AND au.invited_at IS NOT NULL AND au.deleted_at IS NULL
    AND (au.banned_until IS NULL OR au.banned_until<=now());
  IF v_email IS NULL OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id) THEN
    RETURN QUERY SELECT 'DENIED'::text,'AUTH_INVITATION_MISSING_OR_PROFILE_EXISTS'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.users(id,email,full_name,role,status,tenant_id)
  VALUES(p_user_id,lower(v_email),trim(p_full_name),'ktv','active',v_tenant);
  INSERT INTO public.interior_user_roles(tenant_id,user_id,role_key,scope_type,scope_id,granted_by)
  VALUES(v_tenant,p_user_id,p_role_key,p_scope_type,p_scope_id,v_actor) RETURNING id INTO v_assignment_id;
  INSERT INTO public.interior_permission_audit_logs(
    tenant_id,actor_user_id,target_user_id,event_type,assignment_id,role_key,scope_type,scope_id,after_state
  ) VALUES(v_tenant,v_actor,p_user_id,'USER_INVITED_AND_ROLE_GRANTED',v_assignment_id,p_role_key,p_scope_type,p_scope_id,
    jsonb_build_object('status','ACTIVE','role_key',p_role_key,'scope_type',p_scope_type,'scope_id',p_scope_id));
  RETURN QUERY SELECT 'COMMITTED'::text,'INVITED_AND_ASSIGNED'::text,p_user_id,v_assignment_id;
EXCEPTION WHEN unique_violation THEN
  RETURN QUERY SELECT 'DENIED'::text,'USER_OR_ROLE_ALREADY_EXISTS'::text,NULL::uuid,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_set_project_branch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_units b
    WHERE b.id=NEW.branch_id AND b.tenant_id=NEW.tenant_id
      AND b.unit_type='branch' AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Interior branch must be active and belong to the project tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_assign_project_branch(
  p_project_id uuid,p_branch_id uuid
)
RETURNS TABLE(status text,reason text,project_id uuid,branch_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_old_branch uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'BRANCH_MANAGEMENT_DENIED'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  SELECT p.branch_id INTO v_old_branch FROM public.interior_projects p
  WHERE p.id=p_project_id AND p.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_units b WHERE b.id=p_branch_id AND b.tenant_id=v_tenant
      AND b.unit_type='branch' AND b.is_active
  ) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_BRANCH'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:branch:manage',v_tenant,NULL,NULL)
     AND NOT (v_old_branch IS NOT NULL AND public.interior_has_permission('interior:branch:manage',v_tenant,NULL,v_old_branch))
     AND NOT (p_branch_id IS NOT NULL AND public.interior_has_permission('interior:branch:manage',v_tenant,NULL,p_branch_id)) THEN
    RETURN QUERY SELECT 'DENIED'::text,'BRANCH_MANAGEMENT_DENIED'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  IF (v_old_branch IS NOT NULL AND NOT public.interior_has_permission('interior:branch:manage',v_tenant,NULL,v_old_branch))
     OR (p_branch_id IS NOT NULL AND NOT public.interior_has_permission('interior:branch:manage',v_tenant,NULL,p_branch_id)) THEN
    RETURN QUERY SELECT 'DENIED'::text,'BRANCH_SCOPE_DENIED'::text,NULL::uuid,NULL::uuid; RETURN;
  END IF;
  UPDATE public.interior_projects SET branch_id=p_branch_id
  WHERE id=p_project_id AND tenant_id=v_tenant;
  INSERT INTO public.interior_permission_audit_logs(
    tenant_id,actor_user_id,event_type,scope_type,scope_id,before_state,after_state
  ) VALUES (
    v_tenant,v_actor,'PROJECT_BRANCH_CHANGED','PROJECT',p_project_id,
    jsonb_build_object('branch_id',v_old_branch),jsonb_build_object('branch_id',p_branch_id)
  );
  RETURN QUERY SELECT 'COMMITTED'::text,'BRANCH_ASSIGNED'::text,p_project_id,p_branch_id;
END;
$$;
CREATE TRIGGER trg_interior_project_branch_guard
  BEFORE INSERT OR UPDATE OF branch_id,tenant_id ON public.interior_projects
  FOR EACH ROW EXECUTE FUNCTION public.interior_set_project_branch();

CREATE OR REPLACE FUNCTION public.interior_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN RAISE EXCEPTION 'Interior permission audit is append-only'; END; $$;
CREATE TRIGGER trg_interior_permission_audit_immutable
  BEFORE UPDATE OR DELETE ON public.interior_permission_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.interior_audit_immutable();

CREATE OR REPLACE FUNCTION public.interior_manage_user_role(
  p_operation text,
  p_target_user_id uuid,
  p_role_key text,
  p_scope_type text DEFAULT NULL,
  p_scope_id uuid DEFAULT NULL,
  p_assignment_id uuid DEFAULT NULL
)
RETURNS TABLE(status text,reason text,assignment_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid := public.interior_actor_tenant();
  v_target_status text;
  v_assignment public.interior_user_roles%ROWTYPE;
  v_is_owner boolean;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_actor_can_manage_roles(v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'ROLE_MANAGEMENT_DENIED'::text,NULL::uuid; RETURN;
  END IF;
  -- Serialize role lifecycle changes so concurrent owner revocations cannot
  -- each observe another active owner and leave the tenant without an OWNER.
  PERFORM 1 FROM public.tenants t WHERE t.id=v_tenant FOR UPDATE;
  v_is_owner := public.interior_is_owner(v_tenant,v_actor);
  IF p_operation='GRANT' THEN
    IF p_target_user_id IS NULL OR p_role_key IS NULL OR p_scope_type IS NULL
       OR p_scope_type NOT IN ('TENANT','BRANCH','PROJECT','SELF')
       OR (p_scope_type IN ('TENANT','SELF') AND p_scope_id IS NOT NULL)
       OR (p_scope_type IN ('BRANCH','PROJECT') AND p_scope_id IS NULL)
       OR NOT EXISTS (SELECT 1 FROM public.interior_roles WHERE role_key=p_role_key) THEN
      RETURN QUERY SELECT 'DENIED'::text,'INVALID_TARGET_OR_ROLE'::text,NULL::uuid; RETURN;
    END IF;
    IF p_role_key='OWNER' AND NOT v_is_owner THEN
      RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY'::text,NULL::uuid; RETURN;
    END IF;
    IF p_role_key='OWNER' AND p_scope_type<>'TENANT' THEN
      RETURN QUERY SELECT 'DENIED'::text,'OWNER_REQUIRES_TENANT_SCOPE'::text,NULL::uuid; RETURN;
    END IF;
    IF NOT v_is_owner AND p_target_user_id=v_actor THEN
      RETURN QUERY SELECT 'DENIED'::text,'ADMIN_SELF_ASSIGNMENT_DENIED'::text,NULL::uuid; RETURN;
    END IF;
    IF NOT v_is_owner AND NOT EXISTS (
      SELECT 1 FROM public.interior_admin_role_delegations d
      WHERE d.tenant_id=v_tenant AND d.admin_user_id=v_actor AND d.role_key=p_role_key AND d.status='ACTIVE'
    ) THEN
      RETURN QUERY SELECT 'DENIED'::text,'ROLE_NOT_DELEGATED'::text,NULL::uuid; RETURN;
    END IF;
    SELECT lower(u.status) INTO v_target_status FROM public.users u
    JOIN auth.users au ON au.id=u.id
    WHERE u.id=p_target_user_id AND u.tenant_id=v_tenant
      AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=now());
    IF v_target_status IS DISTINCT FROM 'active' THEN
      RETURN QUERY SELECT 'DENIED'::text,'TARGET_NOT_ACTIVE_IN_TENANT'::text,NULL::uuid; RETURN;
    END IF;
    IF p_scope_type IN ('TENANT','SELF') AND p_scope_id IS NOT NULL THEN
      RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid; RETURN;
    END IF;
    IF p_scope_type='BRANCH' AND NOT EXISTS (
      SELECT 1 FROM public.org_units b WHERE b.id=p_scope_id AND b.tenant_id=v_tenant
        AND b.unit_type='branch' AND b.is_active
    ) THEN
      RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid; RETURN;
    END IF;
    IF p_scope_type='PROJECT' AND NOT EXISTS (
      SELECT 1 FROM public.interior_projects p WHERE p.id=p_scope_id AND p.tenant_id=v_tenant
    ) THEN
      RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid; RETURN;
    END IF;
    INSERT INTO public.interior_user_roles(tenant_id,user_id,role_key,scope_type,scope_id,granted_by)
    VALUES (v_tenant,p_target_user_id,p_role_key,p_scope_type,p_scope_id,v_actor)
    RETURNING * INTO v_assignment;
    INSERT INTO public.interior_permission_audit_logs(
      tenant_id,actor_user_id,target_user_id,event_type,assignment_id,role_key,scope_type,scope_id,after_state
    ) VALUES (v_tenant,v_actor,p_target_user_id,'ROLE_GRANTED',v_assignment.id,p_role_key,p_scope_type,p_scope_id,
      jsonb_build_object('status','ACTIVE','role_key',p_role_key,'scope_type',p_scope_type,'scope_id',p_scope_id));
    RETURN QUERY SELECT 'COMMITTED'::text,'ROLE_GRANTED'::text,v_assignment.id; RETURN;
  ELSIF p_operation='REVOKE' THEN
    SELECT * INTO v_assignment FROM public.interior_user_roles
    WHERE id=p_assignment_id AND tenant_id=v_tenant AND status='ACTIVE' FOR UPDATE;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'DENIED'::text,'ASSIGNMENT_NOT_ACTIVE'::text,NULL::uuid; RETURN;
    END IF;
    IF v_assignment.role_key='OWNER' AND NOT v_is_owner THEN
      RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY'::text,NULL::uuid; RETURN;
    END IF;
    IF NOT v_is_owner AND NOT EXISTS (
      SELECT 1 FROM public.interior_admin_role_delegations d
      WHERE d.tenant_id=v_tenant AND d.admin_user_id=v_actor AND d.role_key=v_assignment.role_key AND d.status='ACTIVE'
    ) THEN
      RETURN QUERY SELECT 'DENIED'::text,'ROLE_NOT_DELEGATED'::text,NULL::uuid; RETURN;
    END IF;
    IF v_assignment.role_key='OWNER' AND NOT EXISTS (
      SELECT 1 FROM public.interior_user_roles ur
      WHERE ur.tenant_id=v_tenant AND ur.role_key='OWNER' AND ur.status='ACTIVE'
        AND ur.id<>v_assignment.id
    ) THEN
      RETURN QUERY SELECT 'DENIED'::text,'LAST_OWNER'::text,NULL::uuid; RETURN;
    END IF;
    UPDATE public.interior_user_roles SET status='REVOKED',revoked_by=v_actor,revoked_at=statement_timestamp()
    WHERE id=v_assignment.id;
    INSERT INTO public.interior_permission_audit_logs(
      tenant_id,actor_user_id,target_user_id,event_type,assignment_id,role_key,scope_type,scope_id,before_state,after_state
    ) VALUES (v_tenant,v_actor,v_assignment.user_id,'ROLE_REVOKED',v_assignment.id,v_assignment.role_key,
      v_assignment.scope_type,v_assignment.scope_id,
      jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','REVOKED'));
    RETURN QUERY SELECT 'COMMITTED'::text,'ROLE_REVOKED'::text,v_assignment.id; RETURN;
  ELSE
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_OPERATION'::text,NULL::uuid; RETURN;
  END IF;
EXCEPTION
  WHEN unique_violation THEN RETURN QUERY SELECT 'DENIED'::text,'ALREADY_ASSIGNED'::text,NULL::uuid;
  WHEN foreign_key_violation THEN RETURN QUERY SELECT 'DENIED'::text,'INVALID_TARGET_OR_SCOPE'::text,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_set_admin_role_delegation(
  p_admin_user_id uuid,p_role_key text,p_operation text
)
RETURNS TABLE(status text,reason text,delegation_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid:=public.interior_actor_tenant(); v_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_is_owner(v_tenant,v_actor) THEN
    RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY'::text,NULL::uuid; RETURN;
  END IF;
  IF p_role_key IS NULL OR p_role_key='OWNER' OR p_admin_user_id IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('GRANT','REVOKE')
     OR NOT EXISTS (SELECT 1 FROM public.interior_roles r WHERE r.role_key=p_role_key) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_DELEGATION'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_user_roles ur
    JOIN public.users u ON u.id=ur.user_id AND u.tenant_id=ur.tenant_id
    JOIN auth.users au ON au.id=u.id
    WHERE ur.tenant_id=v_tenant AND ur.user_id=p_admin_user_id AND ur.role_key='ADMIN'
      AND ur.scope_type='TENANT' AND ur.status='ACTIVE' AND u.status='active'
      AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=now())) THEN
    RETURN QUERY SELECT 'DENIED'::text,'TARGET_NOT_ACTIVE_ADMIN'::text,NULL::uuid; RETURN;
  END IF;
  IF p_operation='GRANT' THEN
    INSERT INTO public.interior_admin_role_delegations(tenant_id,admin_user_id,role_key,delegated_by)
    VALUES(v_tenant,p_admin_user_id,p_role_key,v_actor) RETURNING id INTO v_id;
    INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,role_key,after_state)
    VALUES(v_tenant,v_actor,p_admin_user_id,'ADMIN_ROLE_DELEGATED',p_role_key,jsonb_build_object('status','ACTIVE'));
    RETURN QUERY SELECT 'COMMITTED'::text,'DELEGATED'::text,v_id; RETURN;
  END IF;
  UPDATE public.interior_admin_role_delegations d
  SET status='REVOKED',revoked_by=v_actor,revoked_at=statement_timestamp()
  WHERE d.tenant_id=v_tenant AND d.admin_user_id=p_admin_user_id AND d.role_key=p_role_key AND d.status='ACTIVE'
  RETURNING d.id INTO v_id;
  IF v_id IS NULL THEN RETURN QUERY SELECT 'DENIED'::text,'DELEGATION_NOT_ACTIVE'::text,NULL::uuid; RETURN; END IF;
  INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,role_key,before_state,after_state)
  VALUES(v_tenant,v_actor,p_admin_user_id,'ADMIN_ROLE_DELEGATION_REVOKED',p_role_key,
    jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','REVOKED'));
  RETURN QUERY SELECT 'COMMITTED'::text,'REVOKED'::text,v_id;
EXCEPTION WHEN unique_violation THEN
  RETURN QUERY SELECT 'DENIED'::text,'ALREADY_DELEGATED'::text,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_assign_project_user(
  p_user_id uuid,p_project_id uuid,p_operation text
)
RETURNS TABLE(status text,reason text,assignment_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid:=public.interior_actor_tenant(); v_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_actor_can_manage_roles(v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'ROLE_MANAGEMENT_DENIED'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u JOIN auth.users au ON au.id=u.id
    WHERE u.id=p_user_id AND u.tenant_id=v_tenant AND u.status='active'
      AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=now()))
    OR NOT EXISTS (SELECT 1 FROM public.interior_projects p WHERE p.id=p_project_id AND p.tenant_id=v_tenant)
    OR p_operation IS NULL OR p_operation NOT IN ('GRANT','REVOKE') THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_TARGET_OR_PROJECT'::text,NULL::uuid; RETURN;
  END IF;
  IF p_operation='GRANT' THEN
    INSERT INTO public.interior_user_project_assignments(tenant_id,project_id,user_id,assigned_by)
    VALUES(v_tenant,p_project_id,p_user_id,v_actor) RETURNING id INTO v_id;
    INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,assignment_id,scope_type,scope_id,after_state)
    VALUES(v_tenant,v_actor,p_user_id,'PROJECT_ASSIGNED',v_id,'SELF',p_project_id,jsonb_build_object('status','ACTIVE'));
    RETURN QUERY SELECT 'COMMITTED'::text,'ASSIGNED'::text,v_id; RETURN;
  END IF;
  UPDATE public.interior_user_project_assignments a
  SET status='REVOKED',revoked_by=v_actor,revoked_at=statement_timestamp()
  WHERE a.tenant_id=v_tenant AND a.user_id=p_user_id AND a.project_id=p_project_id AND a.status='ACTIVE'
  RETURNING a.id INTO v_id;
  IF v_id IS NULL THEN RETURN QUERY SELECT 'DENIED'::text,'ASSIGNMENT_NOT_ACTIVE'::text,NULL::uuid; RETURN; END IF;
  INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,assignment_id,scope_type,scope_id,before_state,after_state)
  VALUES(v_tenant,v_actor,p_user_id,'PROJECT_ASSIGNMENT_REVOKED',v_id,'SELF',p_project_id,
    jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','REVOKED'));
  RETURN QUERY SELECT 'COMMITTED'::text,'REVOKED'::text,v_id;
EXCEPTION WHEN unique_violation THEN RETURN QUERY SELECT 'DENIED'::text,'ALREADY_ASSIGNED'::text,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_grant_direct_permission(
  p_target_user_id uuid,p_permission_id text,p_scope_type text,p_scope_id uuid DEFAULT NULL
)
RETURNS TABLE(status text,reason text,grant_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid:=public.interior_actor_tenant(); v_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_is_owner(v_tenant,v_actor) THEN
    RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY'::text,NULL::uuid; RETURN;
  END IF;
  IF p_permission_id IN ('interior:users:manage','interior:roles:assign','interior:roles:manage',
      'interior:company:manage','interior:branch:manage','interior:audit:read','interior:audit:read_limited')
     OR NOT EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id=p_permission_id)
     OR p_scope_type IS NULL OR p_scope_type NOT IN ('TENANT','BRANCH','PROJECT','SELF')
     OR (p_scope_type IN ('TENANT','SELF') AND p_scope_id IS NOT NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_DIRECT_GRANT'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u JOIN auth.users au ON au.id=u.id
    WHERE u.id=p_target_user_id AND u.tenant_id=v_tenant AND u.status='active'
      AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=now())) THEN
    RETURN QUERY SELECT 'DENIED'::text,'TARGET_NOT_ACTIVE_IN_TENANT'::text,NULL::uuid; RETURN;
  END IF;
  IF p_scope_type='BRANCH' AND NOT EXISTS (SELECT 1 FROM public.org_units b
    WHERE b.id=p_scope_id AND b.tenant_id=v_tenant AND b.unit_type='branch' AND b.is_active) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid; RETURN;
  END IF;
  IF p_scope_type='PROJECT' AND NOT EXISTS (SELECT 1 FROM public.interior_projects p
    WHERE p.id=p_scope_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_SCOPE'::text,NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.interior_user_permission_grants(tenant_id,user_id,permission_id,scope_type,scope_id,granted_by)
  VALUES(v_tenant,p_target_user_id,p_permission_id,p_scope_type,p_scope_id,v_actor) RETURNING id INTO v_id;
  INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,assignment_id,permission_id,scope_type,scope_id,after_state)
  VALUES(v_tenant,v_actor,p_target_user_id,'DIRECT_PERMISSION_GRANTED',v_id,p_permission_id,p_scope_type,p_scope_id,jsonb_build_object('status','ACTIVE'));
  RETURN QUERY SELECT 'COMMITTED'::text,'GRANTED'::text,v_id;
EXCEPTION WHEN unique_violation THEN RETURN QUERY SELECT 'DENIED'::text,'ALREADY_GRANTED'::text,NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_revoke_direct_permission(p_grant_id uuid)
RETURNS TABLE(status text,reason text,grant_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid:=public.interior_actor_tenant(); v_row public.interior_user_permission_grants%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT public.interior_is_owner(v_tenant,v_actor) THEN
    RETURN QUERY SELECT 'DENIED'::text,'OWNER_ONLY'::text,NULL::uuid; RETURN;
  END IF;
  SELECT * INTO v_row FROM public.interior_user_permission_grants
    WHERE id=p_grant_id AND tenant_id=v_tenant AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'DENIED'::text,'GRANT_NOT_ACTIVE'::text,NULL::uuid; RETURN; END IF;
  UPDATE public.interior_user_permission_grants SET status='REVOKED',revoked_by=v_actor,revoked_at=statement_timestamp()
    WHERE id=v_row.id;
  INSERT INTO public.interior_permission_audit_logs(tenant_id,actor_user_id,target_user_id,event_type,assignment_id,permission_id,scope_type,scope_id,before_state,after_state)
  VALUES(v_tenant,v_actor,v_row.user_id,'DIRECT_PERMISSION_REVOKED',v_row.id,v_row.permission_id,v_row.scope_type,v_row.scope_id,
    jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','REVOKED'));
  RETURN QUERY SELECT 'COMMITTED'::text,'REVOKED'::text,v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_list_users()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR NOT public.interior_has_permission('interior:users:read',v_tenant,NULL,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: interior users read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id',u.id,'email',u.email,'full_name',u.full_name,
    'status',CASE WHEN lower(u.status)='active' AND au.deleted_at IS NULL
      AND (au.banned_until IS NULL OR au.banned_until<=now()) THEN 'active' ELSE 'inactive' END,
    'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('assignment_id',ur.id,'role_key',ur.role_key,
      'scope_type',ur.scope_type,'scope_id',ur.scope_id,'status',ur.status) ORDER BY ur.role_key,ur.scope_type)
      FROM public.interior_user_roles ur WHERE ur.tenant_id=v_tenant AND ur.user_id=u.id), '[]'::jsonb),
    'project_ids',coalesce((SELECT jsonb_agg(a.project_id ORDER BY a.project_id)
      FROM public.interior_user_project_assignments a WHERE a.tenant_id=v_tenant AND a.user_id=u.id AND a.status='ACTIVE'), '[]'::jsonb),
    'direct_grants',coalesce((SELECT jsonb_agg(jsonb_build_object('grant_id',g.id,'permission_id',g.permission_id,
      'scope_type',g.scope_type,'scope_id',g.scope_id,'status',g.status) ORDER BY g.permission_id,g.scope_type)
      FROM public.interior_user_permission_grants g WHERE g.tenant_id=v_tenant AND g.user_id=u.id), '[]'::jsonb),
    'effective_permissions',CASE WHEN lower(u.status)='active' AND au.deleted_at IS NULL
      AND (au.banned_until IS NULL OR au.banned_until<=now()) THEN coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.permission_id,e.source)
      FROM (
        SELECT DISTINCT rp.permission_id,'ROLE'::text AS source,ur.role_key,ur.scope_type,ur.scope_id
        FROM public.interior_user_roles ur
        JOIN public.interior_role_permissions rp ON rp.role_key=ur.role_key
        WHERE ur.tenant_id=v_tenant AND ur.user_id=u.id AND ur.status='ACTIVE'
        UNION ALL
        SELECT g.permission_id,'DIRECT_GRANT'::text AS source,NULL::text AS role_key,g.scope_type,g.scope_id
        FROM public.interior_user_permission_grants g
        WHERE g.tenant_id=v_tenant AND g.user_id=u.id AND g.status='ACTIVE'
      ) e), '[]'::jsonb) ELSE '[]'::jsonb END,
    'admin_role_delegations',coalesce((SELECT jsonb_agg(jsonb_build_object('delegation_id',d.id,
      'role_key',d.role_key,'status',d.status) ORDER BY d.role_key)
      FROM public.interior_admin_role_delegations d WHERE d.tenant_id=v_tenant AND d.admin_user_id=u.id), '[]'::jsonb)
  ) ORDER BY u.full_name,u.email), '[]'::jsonb)
  INTO v_result
  FROM public.users u JOIN auth.users au ON au.id=u.id
  WHERE u.tenant_id=v_tenant;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_rbac_catalog()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant();
BEGIN
  IF v_tenant IS NULL OR NOT public.interior_has_permission('interior:roles:read',v_tenant,NULL,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: interior role catalog read is required';
  END IF;
  RETURN jsonb_build_object(
    'roles',(SELECT coalesce(jsonb_agg(jsonb_build_object('role_key',r.role_key,'display_name',r.display_name,
      'responsibility',r.responsibility,'permissions',(SELECT coalesce(jsonb_agg(rp.permission_id ORDER BY rp.permission_id),'[]'::jsonb)
        FROM public.interior_role_permissions rp WHERE rp.role_key=r.role_key)) ORDER BY r.role_key),'[]'::jsonb)
      FROM public.interior_roles r),
    'permissions',(SELECT coalesce(jsonb_agg(jsonb_build_object('permission_id',p.permission_id,'module_key',p.module_key,
      'action_key',p.action_key,'description',p.description,'sensitive',p.sensitive) ORDER BY p.module_key,p.action_key),'[]'::jsonb)
      FROM public.interior_permissions p),
    'branches',CASE WHEN public.interior_has_permission('interior:users:manage',v_tenant,NULL,NULL)
      THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'code',b.code) ORDER BY b.name),'[]'::jsonb)
        FROM public.org_units b WHERE b.tenant_id=v_tenant AND b.unit_type='branch' AND b.is_active)
      ELSE '[]'::jsonb END,
    'projects',CASE WHEN public.interior_has_permission('interior:users:manage',v_tenant,NULL,NULL)
      THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'code',p.code,'branch_id',p.branch_id) ORDER BY p.name),'[]'::jsonb)
        FROM public.interior_projects p WHERE p.tenant_id=v_tenant)
      ELSE '[]'::jsonb END,
    'is_owner',public.interior_is_owner(v_tenant,auth.uid()),
    'can_manage_branches',public.interior_has_permission('interior:branch:manage',v_tenant,NULL,NULL),
    'can_manage_users',public.interior_has_permission('interior:users:manage',v_tenant,NULL,NULL),
    'can_assign_roles',public.interior_actor_can_manage_roles(v_tenant)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_permission_audit(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_full boolean; v_limited boolean;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'AuthorizationViolation: active tenant is required'; END IF;
  v_full:=public.interior_has_permission('interior:audit:read',v_tenant,NULL,NULL);
  v_limited:=public.interior_has_permission('interior:audit:read_limited',v_tenant,NULL,NULL);
  IF NOT v_full AND NOT v_limited THEN RAISE EXCEPTION 'AuthorizationViolation: interior audit read is required'; END IF;
  IF v_full THEN
    RETURN (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.recorded_at DESC),'[]'::jsonb)
      FROM (SELECT id,actor_user_id,target_user_id,event_type,assignment_id,role_key,permission_id,
        scope_type,scope_id,before_state,after_state,recorded_at FROM public.interior_permission_audit_logs
        WHERE tenant_id=v_tenant ORDER BY recorded_at DESC LIMIT greatest(1,least(coalesce(p_limit,100),500))) a);
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) FROM (
    SELECT event_type,count(*)::integer AS count,max(recorded_at) AS latest_at
    FROM public.interior_permission_audit_logs WHERE tenant_id=v_tenant
    GROUP BY event_type ORDER BY event_type
  ) g);
END;
$$;

-- Action-aware RLS policies are permissive complements to the pre-existing
-- restrictive canonical-tenant policy. Direct table grants remain revoked.
DO $policies$
DECLARE r record; v_project_expr text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('interior_projects','interior:project:read','interior:project:create','interior:project:update','direct',NULL::text,'id',NULL::text,'branch_id'),
    ('interior_project_room_zones','interior:design:read','interior:design:create','interior:design:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_design_revisions','interior:design:read','interior:design:create','interior:design:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_design_assets','interior:design:read','interior:design:create','interior:design:update','design_asset',NULL::text,NULL::text,'revision_id',NULL::text),
    ('interior_design_material_specs','interior:design:read','interior:design:create','interior:design:update','design_material',NULL::text,NULL::text,'revision_id',NULL::text),
    ('interior_boqs','interior:boq:read','interior:boq:create','interior:boq:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_boq_items','interior:boq:read','interior:boq:create','interior:boq:update','boq_item',NULL::text,NULL::text,'boq_id',NULL::text),
    ('interior_quotations','interior:contract:read','interior:contract:create','interior:contract:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_contracts','interior:contract:read','interior:contract:create','interior:contract:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_payment_milestones','interior:finance:read','interior:payment:record','interior:payment:record','payment_milestone',NULL::text,NULL::text,'contract_id',NULL::text),
    ('interior_production_orders','interior:production:read','interior:production:create','interior:production:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_production_order_items','interior:production:read','interior:production:create','interior:production:update','production_item',NULL::text,NULL::text,'production_order_id',NULL::text),
    ('interior_site_installation_plans','interior:installation:read','interior:installation:create','interior:installation:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_site_room_installations','interior:installation:read','interior:installation:create','interior:installation:update','installation_item',NULL::text,NULL::text,'plan_id',NULL::text),
    ('interior_site_diaries','interior:installation:read','interior:installation:create','interior:installation:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_qc_punch_list_items','interior:qc:read','interior:qc:create','interior:qc:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_handover_dossiers','interior:delivery:read','interior:delivery:create','interior:delivery:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_warranty_certificates','interior:warranty:read','interior:warranty:create','interior:warranty:update','direct',NULL::text,'project_id',NULL::text,NULL::text),
    ('interior_warranty_service_tickets','interior:warranty:read','interior:warranty:create','interior:warranty:update','direct',NULL::text,'project_id',NULL::text,NULL::text)
  ) AS p(table_name,read_permission,create_permission,update_permission,resource_key,id_col,project_col,parent_col,branch_col)
  LOOP
    IF r.project_col IS NOT NULL THEN
      v_project_expr:=format('public.interior_resolve_project_id(tenant_id,%L,NULL,NULL,%I)',r.resource_key,r.project_col);
    ELSIF r.parent_col IS NOT NULL THEN
      v_project_expr:=format('public.interior_resolve_project_id(tenant_id,%L,NULL,%I,NULL)',r.resource_key,r.parent_col);
    ELSE
      v_project_expr:=format('public.interior_resolve_project_id(tenant_id,%L,%I,NULL,NULL)',r.resource_key,r.id_col);
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS interior_rbac_select ON public.%I',r.table_name);
    EXECUTE format('CREATE POLICY interior_rbac_select ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.interior_has_permission(%L,tenant_id,%s,%s))',
      r.table_name,r.read_permission,v_project_expr,
      CASE WHEN r.branch_col IS NULL THEN 'NULL::uuid' ELSE quote_ident(r.branch_col) END);
    EXECUTE format('DROP POLICY IF EXISTS interior_rbac_insert ON public.%I',r.table_name);
    EXECUTE format('CREATE POLICY interior_rbac_insert ON public.%I AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.interior_has_permission(%L,tenant_id,%s,%s))',
      r.table_name,r.create_permission,v_project_expr,
      CASE WHEN r.branch_col IS NULL THEN 'NULL::uuid' ELSE quote_ident(r.branch_col) END);
    EXECUTE format('DROP POLICY IF EXISTS interior_rbac_update ON public.%I',r.table_name);
    EXECUTE format('CREATE POLICY interior_rbac_update ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated USING (public.interior_has_permission(%L,tenant_id,%s,%s)) WITH CHECK (public.interior_has_permission(%L,tenant_id,%s,%s))',
      r.table_name,r.update_permission,v_project_expr,
      CASE WHEN r.branch_col IS NULL THEN 'NULL::uuid' ELSE quote_ident(r.branch_col) END,
      r.update_permission,v_project_expr,
      CASE WHEN r.branch_col IS NULL THEN 'NULL::uuid' ELSE quote_ident(r.branch_col) END);
    ALTER TABLE public.interior_projects ENABLE ROW LEVEL SECURITY;
  END LOOP;
END
$policies$;

CREATE OR REPLACE FUNCTION public.interior_guard_boq_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated Interior actor is required for BOQ writes';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.prepared_by_user_id:=auth.uid();
    NEW.approved_by_user_id:=NULL;
    IF NEW.status IN ('approved','locked_for_contract') THEN
      RAISE EXCEPTION 'AuthorizationViolation: BOQ must be drafted before separate approval or contract locking';
    END IF;
    RETURN NEW;
  END IF;
  NEW.prepared_by_user_id:=OLD.prepared_by_user_id;
  NEW.approved_by_user_id:=OLD.approved_by_user_id;
  IF OLD.status='locked_for_contract' THEN
    RAISE EXCEPTION 'AuthorizationViolation: locked BOQ is immutable';
  END IF;
  IF OLD.status='approved' AND NEW.status IS DISTINCT FROM 'locked_for_contract' THEN
    RAISE EXCEPTION 'AuthorizationViolation: approved BOQ can only be locked for a contract';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='approved' THEN
    IF auth.uid() IS NULL OR OLD.prepared_by_user_id IS NULL OR OLD.prepared_by_user_id=auth.uid()
       OR NOT public.interior_has_permission('interior:boq:approve',NEW.tenant_id,NEW.project_id,NULL) THEN
      RAISE EXCEPTION 'AuthorizationViolation: BOQ approver must have separate approval permission and differ from preparer';
    END IF;
    NEW.approved_by_user_id:=auth.uid();
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='locked_for_contract' THEN
    IF OLD.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'AuthorizationViolation: only an approved BOQ can be locked for a contract';
    END IF;
    IF NOT (
      public.interior_has_permission('interior:contract:create',NEW.tenant_id,NEW.project_id,NULL)
      OR public.interior_has_permission('interior:contract:update',NEW.tenant_id,NEW.project_id,NULL)
    ) THEN RAISE EXCEPTION 'AuthorizationViolation: contract action required to lock approved BOQ'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_interior_boq_approval
  BEFORE INSERT OR UPDATE ON public.interior_boqs
  FOR EACH ROW EXECUTE FUNCTION public.interior_guard_boq_approval();

DO $boq_rpc$
DECLARE
  v_definition text;
  v_needle text := 'public.platform_authorize_action(''interior:boq:write'', p_tenant_id, NULL)';
  v_replacement text := 'public.interior_authorize_action(''interior:boq:write'', p_tenant_id, (p_boq_header->>''project_id'')::uuid, NULL)';
  v_revision_needle text := 'AND project_id = v_project_id';
  v_revision_replacement text := 'AND project_id = v_project_id AND status = ''approved''';
  v_service_branch_needle text := 'ELSIF v_auth_role IS DISTINCT FROM ''service_role'' THEN';
  v_service_branch_replacement text := 'ELSIF v_auth_role = ''service_role'' THEN
        RAISE EXCEPTION ''AuthorizationViolation: service role cannot bypass Interior BOQ permissions'';
    ELSIF v_auth_role IS DISTINCT FROM ''authenticated'' THEN';
BEGIN
  v_definition:=pg_get_functiondef('public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid)'::regprocedure);
  IF position(v_needle IN v_definition)=0 OR position(v_revision_needle IN v_definition)=0
     OR position(v_service_branch_needle IN v_definition)=0 THEN
    RAISE EXCEPTION 'Interior BOQ RPC preflight mismatch; refusing to alter its authorization boundary';
  END IF;
  IF position(v_revision_needle IN substring(v_definition FROM position(v_revision_needle IN v_definition)+1))>0 THEN
    RAISE EXCEPTION 'Interior BOQ revision guard is ambiguous; refusing to alter its authorization boundary';
  END IF;
  v_definition:=replace(v_definition,v_needle,v_replacement);
  v_definition:=replace(v_definition,v_revision_needle,v_revision_replacement);
  v_definition:=replace(v_definition,v_service_branch_needle,v_service_branch_replacement);
  v_definition:=replace(v_definition,
    'TenantIsolationViolation: Revision % does not belong to Project % under Tenant %',
    'BOQPreconditionViolation: design revision must belong to project and tenant and be approved');
  EXECUTE v_definition;
END
$boq_rpc$;

DO $outbox_rpc$
DECLARE
  v_definition text;
  v_role_needle text := 'IF v_role IS NULL OR v_role NOT IN (''authenticated'', ''service_role'') THEN';
  v_role_replacement text := 'IF v_role IS DISTINCT FROM ''authenticated'' THEN';
  v_auth_needle text := 'public.platform_authorize_action(''interior:finance:write'', p_tenant_id, NULL) AS decision';
  v_auth_replacement text := 'public.interior_authorize_action(''interior:payment:record'', p_tenant_id, v_payload_project_id, NULL) AS decision';
BEGIN
  v_definition:=pg_get_functiondef('public.enqueue_interior_finance_event(uuid,text,text,text,jsonb)'::regprocedure);
  IF position(v_role_needle IN v_definition)=0 OR position(v_auth_needle IN v_definition)=0 THEN
    RAISE EXCEPTION 'Interior finance outbox authorization preflight mismatch';
  END IF;
  v_definition:=replace(v_definition,v_role_needle,v_role_replacement);
  v_definition:=replace(v_definition,'authenticated actor or trusted service role required','authenticated actor required');
  v_definition:=replace(v_definition,v_auth_needle,v_auth_replacement);
  EXECUTE v_definition;
END
$outbox_rpc$;

REVOKE ALL ON FUNCTION public.interior_actor_tenant() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_resolve_project_id(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_has_permission(text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_authorize_action(text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_authorize_project_list(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_authorize_customer_list(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_authorize_schedule_list(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_projects() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_is_owner(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_actor_can_manage_roles(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_set_project_branch() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_assign_project_branch(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_audit_immutable() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_manage_user_role(text,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_set_admin_role_delegation(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_assign_project_user(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_grant_direct_permission(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_revoke_direct_permission(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_users() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_rbac_catalog() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_permission_audit(integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_read_project(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_room_zones(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_design_revisions(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_installation_plans(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_site_diaries(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_list_qc_items(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_read_qc_item(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_update_qc_item(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_read_boqs(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_create_project(text,text,text,text,text,text,text,numeric,date,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_approve_boq(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_approve_design_revision(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_create_design_revision(uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_register_invited_user(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.enqueue_interior_finance_event(uuid,text,text,text,jsonb) FROM PUBLIC,anon,service_role;

GRANT EXECUTE ON FUNCTION public.interior_resolve_project_id(uuid,text,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_has_permission(text,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_authorize_action(text,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_authorize_project_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_authorize_customer_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_authorize_schedule_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_projects() TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_manage_user_role(text,uuid,text,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_set_admin_role_delegation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_assign_project_branch(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_assign_project_user(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_grant_direct_permission(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_revoke_direct_permission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_rbac_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_permission_audit(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_read_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_room_zones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_design_revisions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_installation_plans(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_site_diaries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_list_qc_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_read_qc_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_update_qc_item(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_read_boqs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_create_project(text,text,text,text,text,text,text,numeric,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_approve_boq(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_approve_design_revision(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_create_design_revision(uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interior_register_invited_user(uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_interior_boq_atomic(uuid,jsonb,jsonb,integer,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_interior_finance_event(uuid,text,text,text,jsonb) TO authenticated;

-- The user explicitly selected Production's sole active Interior account as
-- the first OWNER. Resolve that real account by the unique business tenant key;
-- abort rather than guessing if the roster changed after authorization.
DO $owner_bootstrap$
DECLARE
  v_tenant_id uuid;
  v_tenant_count integer;
  v_owner_count integer;
  v_owner_id uuid;
  v_assignment_id uuid;
BEGIN
  SELECT count(*)::integer,min(t.id::text)::uuid INTO v_tenant_count,v_tenant_id
  FROM public.tenants t
  WHERE t.product_key='bella_interior' AND t.name='Bella Interior (Demo)' AND t.status='active';
  IF v_tenant_count=0 THEN RETURN; END IF;
  IF v_tenant_count<>1 THEN RAISE EXCEPTION 'Interior OWNER bootstrap tenant is ambiguous'; END IF;
  SELECT count(*)::integer,min(u.id::text)::uuid INTO v_owner_count,v_owner_id
  FROM public.users u JOIN auth.users au ON au.id=u.id
  WHERE u.tenant_id=v_tenant_id AND lower(u.status)='active'
    AND au.deleted_at IS NULL AND (au.banned_until IS NULL OR au.banned_until<=now());
  IF v_owner_count<>1 OR v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Interior OWNER bootstrap expected exactly the explicitly selected active account';
  END IF;
  INSERT INTO public.interior_user_roles(tenant_id,user_id,role_key,scope_type,scope_id,granted_by)
  VALUES(v_tenant_id,v_owner_id,'OWNER','TENANT',NULL,v_owner_id)
  RETURNING id INTO v_assignment_id;
  INSERT INTO public.interior_permission_audit_logs(
    tenant_id,actor_user_id,target_user_id,event_type,assignment_id,role_key,scope_type,after_state
  ) VALUES(v_tenant_id,v_owner_id,v_owner_id,'OWNER_BOOTSTRAPPED_BY_EXPLICIT_PRODUCTION_AUTHORIZATION',
    v_assignment_id,'OWNER','TENANT',jsonb_build_object(
      'status','ACTIVE','scope_type','TENANT',
      'authorization','User explicitly selected the sole active Bella Interior Production account as initial OWNER'
    ));
END
$owner_bootstrap$;

COMMENT ON TABLE public.interior_roles IS 'Bella Interior official system roles; assignments and permissions are Product-local.';
COMMENT ON TABLE public.interior_user_roles IS 'Tenant-bound Interior role assignments with non-overridable scope and soft revocation.';
COMMENT ON TABLE public.interior_user_project_assignments IS 'Explicit same-tenant project membership used by SELF scope.';
COMMENT ON TABLE public.interior_permission_audit_logs IS 'Append-only audit of Interior role, scope, delegation, and direct permission changes.';
COMMENT ON COLUMN public.interior_projects.branch_id IS 'Optional active same-tenant org_units branch for Interior BRANCH scope.';

COMMIT;
