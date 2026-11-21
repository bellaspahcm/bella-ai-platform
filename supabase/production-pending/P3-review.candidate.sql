-- REVIEW CANDIDATE ONLY. PRODUCTION WRITE HOLD. DO NOT EXECUTE.
-- Proposed P3 O4 action authorization and approval integrity. No Storage DDL.
BEGIN;

DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P3 requires a migration role able to assign reviewed SECURITY DEFINER ownership to postgres';
  END IF;
  IF to_regclass('public.interior_permissions') IS NULL
     OR to_regclass('public.interior_role_permissions') IS NULL
     OR to_regprocedure('public.interior_has_permission(text,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.interior_actor_tenant()') IS NULL
     OR to_regclass('public.interior_projects') IS NULL
     OR to_regclass('public.interior_acceptance_campaigns') IS NULL
     OR to_regclass('public.interior_acceptance_sessions') IS NULL
     OR to_regclass('public.interior_acceptance_notes') IS NULL
     OR to_regclass('public.interior_acceptance_evidence_objects') IS NULL THEN
    RAISE EXCEPTION 'Production O4/RBAC prerequisites differ from the reviewed catalog';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('interior_acceptance_campaigns','interior_acceptance_sessions',
        'interior_acceptance_notes','interior_acceptance_evidence_objects') AND NOT c.relrowsecurity)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (
        'interior_acceptance_campaigns','interior_acceptance_sessions','interior_acceptance_notes',
        'interior_acceptance_evidence_objects'))<>4
     OR EXISTS (
       WITH expected(tablename,policyname) AS (VALUES
         ('interior_acceptance_campaigns','interior_acceptance_campaigns_tenant_isolation'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_tenant_isolation'),
         ('interior_acceptance_notes','interior_acceptance_notes_tenant_isolation'),
         ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_tenant_isolation')
       )
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>'PERMISSIVE' OR p.roles::text<>'{authenticated}'
          OR p.cmd<>'ALL' OR p.qual IS DISTINCT FROM '(tenant_id = interior_actor_tenant())'
          OR p.with_check IS DISTINCT FROM '(tenant_id = interior_actor_tenant())'
     ) THEN
    RAISE EXCEPTION 'Production O4 policy set differs from the reviewed tenant-only baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_acceptance_campaigns c
      LEFT JOIN public.interior_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id WHERE p.id IS NULL)
     OR EXISTS (SELECT 1 FROM public.interior_acceptance_sessions s
      LEFT JOIN public.interior_acceptance_campaigns c ON c.id=s.campaign_id AND c.tenant_id=s.tenant_id
      LEFT JOIN public.interior_projects p ON p.id=s.project_id AND p.tenant_id=s.tenant_id
      WHERE c.id IS NULL OR p.id IS NULL OR c.project_id IS DISTINCT FROM s.project_id)
     OR EXISTS (SELECT 1 FROM public.interior_acceptance_notes n
      LEFT JOIN public.interior_acceptance_sessions s ON s.id=n.session_id AND s.tenant_id=n.tenant_id
      WHERE s.id IS NULL)
     OR EXISTS (SELECT 1 FROM public.interior_acceptance_evidence_objects e
      LEFT JOIN public.interior_acceptance_sessions s ON s.id=e.session_id AND s.tenant_id=e.tenant_id
      WHERE s.id IS NULL) THEN
    RAISE EXCEPTION 'Existing O4 rows contain a tenant-parent mismatch; resolve without deleting data before adding composite FKs';
  END IF;
  IF (SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN (
        'interior_acceptance_campaigns','interior_acceptance_sessions',
        'interior_acceptance_notes','interior_acceptance_evidence_objects') AND con.contype='f')<>16
     OR EXISTS (
       WITH expected(table_name,constraint_name,definition) AS (VALUES
         ('interior_acceptance_campaigns','interior_acceptance_campaigns_created_by_user_id_fkey','FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL'),
         ('interior_acceptance_campaigns','interior_acceptance_campaigns_project_id_fkey','FOREIGN KEY (project_id) REFERENCES interior_projects(id) ON DELETE CASCADE'),
         ('interior_acceptance_campaigns','interior_acceptance_campaigns_tenant_id_fkey','FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_approved_by_actor_id_fkey','FOREIGN KEY (approved_by_actor_id) REFERENCES auth.users(id) ON DELETE SET NULL'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_campaign_id_fkey','FOREIGN KEY (campaign_id) REFERENCES interior_acceptance_campaigns(id) ON DELETE CASCADE'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_project_id_fkey','FOREIGN KEY (project_id) REFERENCES interior_projects(id) ON DELETE CASCADE'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_recorder_actor_id_fkey','FOREIGN KEY (recorder_actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT'),
         ('interior_acceptance_sessions','interior_acceptance_sessions_tenant_id_fkey','FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'),
         ('interior_acceptance_notes','interior_acceptance_notes_created_by_user_id_fkey','FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT'),
         ('interior_acceptance_notes','interior_acceptance_notes_related_boq_item_id_fkey','FOREIGN KEY (related_boq_item_id) REFERENCES interior_boq_items(id) ON DELETE SET NULL'),
         ('interior_acceptance_notes','interior_acceptance_notes_session_id_fkey','FOREIGN KEY (session_id) REFERENCES interior_acceptance_sessions(id) ON DELETE CASCADE'),
         ('interior_acceptance_notes','interior_acceptance_notes_tenant_id_fkey','FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'),
         ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_note_id_fkey','FOREIGN KEY (note_id) REFERENCES interior_acceptance_notes(id) ON DELETE SET NULL'),
         ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_session_id_fkey','FOREIGN KEY (session_id) REFERENCES interior_acceptance_sessions(id) ON DELETE CASCADE'),
         ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_tenant_id_fkey','FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'),
         ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_uploaded_by_user_id_fkey','FOREIGN KEY (uploaded_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT')
       )
       SELECT 1 FROM expected e LEFT JOIN pg_constraint con
         ON con.conrelid=to_regclass('public.'||e.table_name) AND con.conname=e.constraint_name
       WHERE con.oid IS NULL OR NOT con.convalidated
         OR pg_get_constraintdef(con.oid) IS DISTINCT FROM e.definition
     ) THEN
    RAISE EXCEPTION 'Production O4 legacy foreign keys differ from the captured cascade/retention baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN (
        'interior_acceptance_campaigns','interior_acceptance_sessions',
        'interior_acceptance_notes','interior_acceptance_evidence_objects') AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'Unexpected Production O4 trigger requires review before replacement';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid IN (
      'public.interior_acceptance_campaigns'::regclass,
      'public.interior_acceptance_sessions'::regclass,
      'public.interior_acceptance_notes'::regclass,
      'public.interior_acceptance_evidence_objects'::regclass
    ) AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected explicit O4 column grants require review before replacement';
  END IF;
  IF EXISTS (
    WITH expected(table_name,expected_acl) AS (VALUES
      ('interior_acceptance_campaigns','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arw/postgres}'),
      ('interior_acceptance_sessions','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arw/postgres}'),
      ('interior_acceptance_notes','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arw/postgres}'),
      ('interior_acceptance_evidence_objects','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=ar/postgres}')
    )
    SELECT 1 FROM expected e JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name)
    WHERE pg_get_userbyid(c.relowner)<>'postgres' OR c.relacl::text IS DISTINCT FROM e.expected_acl
  ) THEN
    RAISE EXCEPTION 'Production O4 table owner/grants differ from the captured catalog, including operational-role grants';
  END IF;
  IF NOT has_table_privilege('authenticated','public.interior_acceptance_campaigns','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_campaigns','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_campaigns','UPDATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_campaigns','DELETE')
     OR has_table_privilege('authenticated','public.interior_acceptance_campaigns','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_campaigns','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_acceptance_campaigns','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_sessions','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_sessions','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_sessions','UPDATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_sessions','DELETE')
     OR has_table_privilege('authenticated','public.interior_acceptance_sessions','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_sessions','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_acceptance_sessions','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_notes','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_notes','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_notes','UPDATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_notes','DELETE')
     OR has_table_privilege('authenticated','public.interior_acceptance_notes','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_notes','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_acceptance_notes','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','INSERT')
     OR has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','UPDATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','DELETE')
     OR has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_acceptance_evidence_objects','TRIGGER') THEN
    RAISE EXCEPTION 'Effective authenticated O4 table privileges differ from the captured Production baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id IN (
      'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
      'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
      'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
      'interior:acceptance_evidence:upload','interior:acceptance:approve'))
     OR EXISTS (SELECT 1 FROM public.interior_role_permissions WHERE permission_id IN (
      'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
      'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
      'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
      'interior:acceptance_evidence:upload','interior:acceptance:approve')) THEN
    RAISE EXCEPTION 'O4 permission keys already exist; reconcile role ownership before applying this candidate';
  END IF;
  IF (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:delivery:read') IS DISTINCT FROM ARRAY[
          'ACCOUNTANT','ADMIN','DESIGNER','EXECUTIVE','OWNER','PM','PRODUCTION_MANAGER','QC','SALES','SITE_MANAGER','WARRANTY']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:qc:read') IS DISTINCT FROM ARRAY[
          'ACCOUNTANT','ADMIN','DESIGNER','EXECUTIVE','OWNER','PM','PRODUCTION_MANAGER','QC','SALES','SITE_MANAGER','WARRANTY']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:delivery:create') IS DISTINCT FROM ARRAY[
          'ADMIN','OWNER','PM','PRODUCTION_MANAGER','SITE_MANAGER']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:delivery:update') IS DISTINCT FROM ARRAY[
          'ADMIN','OWNER','PM','PRODUCTION_MANAGER','SITE_MANAGER']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:qc:create') IS DISTINCT FROM ARRAY[
          'ADMIN','OWNER','PM','PRODUCTION_MANAGER','QC','SITE_MANAGER']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:qc:update') IS DISTINCT FROM ARRAY[
          'ADMIN','OWNER','PM','PRODUCTION_MANAGER','QC','SITE_MANAGER']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:handover:approve') IS DISTINCT FROM ARRAY['OWNER','PM']::text[] THEN
    RAISE EXCEPTION 'Production delivery/QC/approval role mappings differ from the captured permission model';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_resolve_project_id(uuid,text,uuid,uuid,uuid)'::regprocedure
      AND md5(prosrc)='c724f4f0316d99fd9148cc9cdd828eb2'
      AND proowner='postgres'::regrole AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND COALESCE(proacl,acldefault('f',proowner))::text='{postgres=X/postgres,authenticated=X/postgres}') THEN
    RAISE EXCEPTION 'Production project resolver definition, owner, SECURITY DEFINER config or ACL differs from the captured rollback baseline';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_actor_tenant()'::regprocedure
      AND md5(prosrc)='05be874ba11de5da34780b9017d21e28'
      AND proowner='postgres'::regrole AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND COALESCE(proacl,acldefault('f',proowner))::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_has_permission(text,uuid,uuid,uuid)'::regprocedure
      AND md5(prosrc)='07b00d5331387e5f81b43e6acd3e1a06'
      AND proowner='postgres'::regrole AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND COALESCE(proacl,acldefault('f',proowner))::text='{postgres=X/postgres,authenticated=X/postgres}') THEN
    RAISE EXCEPTION 'Production RBAC helper definitions, owners, SECURITY DEFINER config or ACLs differ from the captured baseline';
  END IF;
  IF to_regclass('public.interior_acceptance_approval_audit') IS NOT NULL
     OR to_regprocedure('public.interior_guard_acceptance_session_update()') IS NOT NULL
     OR to_regprocedure('public.interior_recalculate_acceptance_documentation()') IS NOT NULL
     OR to_regprocedure('public.interior_user_has_permission(uuid,text,uuid,uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)') IS NOT NULL
     OR to_regprocedure('public.interior_decide_acceptance_session(uuid,text,text,text)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
       'trg_interior_guard_acceptance_session_update','trg_interior_acceptance_documentation_status'))
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN (
       'fk_interior_acceptance_campaigns_tenant_project','fk_interior_acceptance_sessions_tenant_campaign',
       'fk_interior_acceptance_sessions_campaign_project','fk_interior_acceptance_sessions_tenant_project',
       'fk_interior_acceptance_notes_tenant_session','fk_interior_acceptance_evidence_tenant_session',
       'fk_interior_acceptance_approval_audit_session'))
     OR EXISTS (SELECT 1 FROM pg_class WHERE relname IN (
       'uq_interior_projects_tenant_id_id','uq_interior_acceptance_campaigns_tenant_id_id',
       'uq_interior_acceptance_campaigns_tenant_id_project','uq_interior_acceptance_sessions_tenant_id_id',
       'idx_interior_acceptance_approval_audit_session')) THEN
    RAISE EXCEPTION 'O4 helper, audit, constraint, or index object already exists; compare definitions before replacement';
  END IF;
END
$preflight$;

INSERT INTO public.interior_permissions(permission_id,module_key,action_key,description,sensitive) VALUES
  ('interior:acceptance_campaign:read','acceptance_campaign','READ','Xem chiến dịch nghiệm thu',false),
  ('interior:acceptance_campaign:create','acceptance_campaign','CREATE','Tạo chiến dịch nghiệm thu',false),
  ('interior:acceptance_campaign:update','acceptance_campaign','UPDATE','Cập nhật chiến dịch nghiệm thu',false),
  ('interior:acceptance_session:read','acceptance_session','READ','Xem phiên nghiệm thu',false),
  ('interior:acceptance_session:create','acceptance_session','CREATE','Tạo phiên nghiệm thu',false),
  ('interior:acceptance_session:update','acceptance_session','UPDATE','Cập nhật kết quả kiểm tra',false),
  ('interior:acceptance_note:read','acceptance_note','READ','Xem ghi chú nghiệm thu',false),
  ('interior:acceptance_note:create','acceptance_note','CREATE','Tạo ghi chú nghiệm thu',false),
  ('interior:acceptance_evidence:read','acceptance_evidence','READ','Xem bằng chứng nghiệm thu',false),
  ('interior:acceptance_evidence:upload','acceptance_evidence','UPLOAD','Tải bằng chứng nghiệm thu lên',true),
  ('interior:acceptance:approve','acceptance','APPROVE','Quyết định phê duyệt nghiệm thu',true)
ON CONFLICT (permission_id) DO NOTHING;

-- Additive mappings based on the directly observed Production role matrix.
INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT 'OWNER', permission_id FROM public.interior_permissions
WHERE permission_id IN (
 'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
 'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
 'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
 'interior:acceptance_evidence:upload','interior:acceptance:approve')
ON CONFLICT DO NOTHING;
INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT rp.role_key, map.permission_id
FROM public.interior_role_permissions rp
JOIN (VALUES
 ('interior:delivery:read','interior:acceptance_campaign:read'),
 ('interior:delivery:read','interior:acceptance_session:read'),
 ('interior:delivery:read','interior:acceptance_note:read'),
 ('interior:delivery:read','interior:acceptance_evidence:read'),
 ('interior:qc:read','interior:acceptance_campaign:read'),
 ('interior:qc:read','interior:acceptance_session:read'),
 ('interior:qc:read','interior:acceptance_note:read'),
 ('interior:qc:read','interior:acceptance_evidence:read'),
 ('interior:delivery:create','interior:acceptance_campaign:create'),
 ('interior:delivery:update','interior:acceptance_campaign:update'),
 ('interior:delivery:create','interior:acceptance_session:create'),
 ('interior:qc:create','interior:acceptance_session:create'),
 ('interior:delivery:update','interior:acceptance_session:update'),
 ('interior:qc:update','interior:acceptance_session:update'),
 ('interior:delivery:create','interior:acceptance_note:create'),
 ('interior:qc:create','interior:acceptance_note:create'),
 ('interior:delivery:create','interior:acceptance_evidence:upload'),
 ('interior:qc:create','interior:acceptance_evidence:upload'),
 ('interior:handover:approve','interior:acceptance:approve')
) AS map(source_permission,permission_id) ON map.source_permission=rp.permission_id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.interior_resolve_project_id(p_tenant_id uuid, p_resource_key text, p_resource_id uuid DEFAULT NULL::uuid, p_parent_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    WHEN 'acceptance_session' THEN
      SELECT project_id INTO v_project_id FROM public.interior_acceptance_sessions WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    ELSE
      RETURN NULL;
  END CASE;
  RETURN v_project_id;
END;
$function$;

-- Tenant-qualified references preserve the existing ON DELETE CASCADE behavior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_projects_tenant_id_id
  ON public.interior_projects(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_campaigns_tenant_id_id
  ON public.interior_acceptance_campaigns(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_campaigns_tenant_id_project
  ON public.interior_acceptance_campaigns(tenant_id,id,project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_sessions_tenant_id_id
  ON public.interior_acceptance_sessions(tenant_id,id);
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_campaigns'::regclass
      AND conname='fk_interior_acceptance_campaigns_tenant_project') THEN
    ALTER TABLE public.interior_acceptance_campaigns
      ADD CONSTRAINT fk_interior_acceptance_campaigns_tenant_project
      FOREIGN KEY (tenant_id,project_id) REFERENCES public.interior_projects(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass
      AND conname='fk_interior_acceptance_sessions_tenant_campaign') THEN
    ALTER TABLE public.interior_acceptance_sessions
      ADD CONSTRAINT fk_interior_acceptance_sessions_tenant_campaign
      FOREIGN KEY (tenant_id,campaign_id) REFERENCES public.interior_acceptance_campaigns(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass
      AND conname='fk_interior_acceptance_sessions_campaign_project') THEN
    ALTER TABLE public.interior_acceptance_sessions ADD CONSTRAINT fk_interior_acceptance_sessions_campaign_project
      FOREIGN KEY (tenant_id,campaign_id,project_id) REFERENCES public.interior_acceptance_campaigns(tenant_id,id,project_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass
      AND conname='fk_interior_acceptance_sessions_tenant_project') THEN
    ALTER TABLE public.interior_acceptance_sessions
      ADD CONSTRAINT fk_interior_acceptance_sessions_tenant_project
      FOREIGN KEY (tenant_id,project_id) REFERENCES public.interior_projects(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_notes'::regclass
      AND conname='fk_interior_acceptance_notes_tenant_session') THEN
    ALTER TABLE public.interior_acceptance_notes
      ADD CONSTRAINT fk_interior_acceptance_notes_tenant_session
      FOREIGN KEY (tenant_id,session_id) REFERENCES public.interior_acceptance_sessions(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_evidence_objects'::regclass
      AND conname='fk_interior_acceptance_evidence_tenant_session') THEN
    ALTER TABLE public.interior_acceptance_evidence_objects
      ADD CONSTRAINT fk_interior_acceptance_evidence_tenant_session
      FOREIGN KEY (tenant_id,session_id) REFERENCES public.interior_acceptance_sessions(tenant_id,id) ON DELETE CASCADE;
  END IF;
END
$constraints$;

DROP POLICY IF EXISTS interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns;
CREATE POLICY interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
DROP POLICY IF EXISTS interior_acceptance_campaigns_read ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_create ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_update ON public.interior_acceptance_campaigns;
CREATE POLICY interior_acceptance_campaigns_read ON public.interior_acceptance_campaigns
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:acceptance_campaign:read',tenant_id,project_id,NULL));
CREATE POLICY interior_acceptance_campaigns_create ON public.interior_acceptance_campaigns
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((created_by_user_id IS NULL OR created_by_user_id=auth.uid())
    AND public.interior_has_permission('interior:acceptance_campaign:create',tenant_id,project_id,NULL));
CREATE POLICY interior_acceptance_campaigns_update ON public.interior_acceptance_campaigns
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.interior_has_permission('interior:acceptance_campaign:update',tenant_id,project_id,NULL))
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:acceptance_campaign:update',tenant_id,project_id,NULL));
REVOKE ALL ON TABLE public.interior_acceptance_campaigns FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.interior_acceptance_campaigns TO authenticated;
GRANT INSERT(id,tenant_id,project_id,campaign_code,campaign_name,description,created_by_user_id)
  ON TABLE public.interior_acceptance_campaigns TO authenticated;
GRANT UPDATE(campaign_name,description) ON TABLE public.interior_acceptance_campaigns TO authenticated;

DROP POLICY IF EXISTS interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions;
CREATE POLICY interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
DROP POLICY IF EXISTS interior_acceptance_sessions_read ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_create ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_update ON public.interior_acceptance_sessions;
CREATE POLICY interior_acceptance_sessions_read ON public.interior_acceptance_sessions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:acceptance_session:read',tenant_id,project_id,NULL));
CREATE POLICY interior_acceptance_sessions_create ON public.interior_acceptance_sessions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (recorder_actor_id=auth.uid()
    AND public.interior_has_permission('interior:acceptance_session:create',tenant_id,project_id,NULL));
CREATE POLICY interior_acceptance_sessions_update ON public.interior_acceptance_sessions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.interior_has_permission('interior:acceptance_session:update',tenant_id,project_id,NULL))
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:acceptance_session:update',tenant_id,project_id,NULL));
REVOKE ALL ON TABLE public.interior_acceptance_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.interior_acceptance_sessions TO authenticated;
GRANT INSERT(id,tenant_id,campaign_id,project_id,session_code,session_type,inspection_scope,inspection_date,
  recorder_actor_id,customer_representative,customer_contact,related_boq_item_ids,inspection_result)
  ON TABLE public.interior_acceptance_sessions TO authenticated;
GRANT UPDATE(inspection_result,approval_notes) ON TABLE public.interior_acceptance_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_guard_acceptance_session_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF OLD.approval_status<>'PENDING' AND (NEW.approval_notes IS DISTINCT FROM OLD.approval_notes OR NEW.inspection_result IS DISTINCT FROM OLD.inspection_result) THEN
    RAISE EXCEPTION 'ACCEPTANCE_DECISION_NOTES_IMMUTABLE';
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.interior_guard_acceptance_session_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_guard_acceptance_session_update() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_interior_guard_acceptance_session_update ON public.interior_acceptance_sessions;
CREATE TRIGGER trg_interior_guard_acceptance_session_update
  BEFORE UPDATE ON public.interior_acceptance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.interior_guard_acceptance_session_update();

DROP POLICY IF EXISTS interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes;
CREATE POLICY interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
DROP POLICY IF EXISTS interior_acceptance_notes_read ON public.interior_acceptance_notes;
DROP POLICY IF EXISTS interior_acceptance_notes_create ON public.interior_acceptance_notes;
CREATE POLICY interior_acceptance_notes_read ON public.interior_acceptance_notes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interior_acceptance_sessions s
    WHERE s.id=interior_acceptance_notes.session_id AND s.tenant_id=interior_acceptance_notes.tenant_id
      AND public.interior_has_permission('interior:acceptance_note:read',interior_acceptance_notes.tenant_id,s.project_id,NULL)));
CREATE POLICY interior_acceptance_notes_create ON public.interior_acceptance_notes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.interior_acceptance_sessions s
    WHERE s.id=interior_acceptance_notes.session_id AND s.tenant_id=interior_acceptance_notes.tenant_id
      AND public.interior_has_permission('interior:acceptance_note:create',interior_acceptance_notes.tenant_id,s.project_id,NULL)
      AND (interior_acceptance_notes.assessment_status<>'DEFECT_REMEDIATION_REQUIRED'
        OR public.interior_has_permission('interior:acceptance_session:update',interior_acceptance_notes.tenant_id,s.project_id,NULL))));
REVOKE ALL ON TABLE public.interior_acceptance_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.interior_acceptance_notes TO authenticated;
GRANT INSERT(id,tenant_id,session_id,category,severity,assessment_status,description,related_boq_item_id,
  remediation_plan,assigned_fixer,target_deadline,remediation_status,routed_entity_type,routed_entity_id,created_by_user_id)
  ON TABLE public.interior_acceptance_notes TO authenticated;

DROP POLICY IF EXISTS interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects;
CREATE POLICY interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
DROP POLICY IF EXISTS interior_acceptance_evidence_objects_read ON public.interior_acceptance_evidence_objects;
CREATE POLICY interior_acceptance_evidence_objects_read ON public.interior_acceptance_evidence_objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interior_acceptance_sessions s
    WHERE s.id=interior_acceptance_evidence_objects.session_id
      AND s.tenant_id=interior_acceptance_evidence_objects.tenant_id
      AND public.interior_has_permission('interior:acceptance_evidence:read',interior_acceptance_evidence_objects.tenant_id,s.project_id,NULL)));
REVOKE ALL ON TABLE public.interior_acceptance_evidence_objects FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.interior_acceptance_evidence_objects TO authenticated;

-- Preserve O4 documentation status when an authorized evidence row is inserted.
CREATE OR REPLACE FUNCTION public.interior_recalculate_acceptance_documentation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_status text;
BEGIN
  SELECT CASE
    WHEN bool_or(evidence_category='CUSTOMER_SIGNOFF')
      AND bool_or(evidence_category IN ('OVERALL','DETAIL','COMPLETED_PRODUCT')) THEN 'COMPLETE'
    WHEN bool_or(evidence_category='CUSTOMER_SIGNOFF')
      OR bool_or(evidence_category IN ('OVERALL','DETAIL','COMPLETED_PRODUCT')) THEN 'PARTIAL'
    ELSE 'NONE'
  END INTO v_status
  FROM public.interior_acceptance_evidence_objects
  WHERE tenant_id=NEW.tenant_id AND session_id=NEW.session_id;
  UPDATE public.interior_acceptance_sessions
    SET documentation_status=COALESCE(v_status,'NONE'),updated_at=statement_timestamp()
    WHERE tenant_id=NEW.tenant_id AND id=NEW.session_id;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.interior_recalculate_acceptance_documentation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_recalculate_acceptance_documentation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_interior_acceptance_documentation_status
  AFTER INSERT ON public.interior_acceptance_evidence_objects
  FOR EACH ROW EXECUTE FUNCTION public.interior_recalculate_acceptance_documentation();

-- Service-role upload metadata is allowed only for an active authenticated actor
-- who holds the project-scoped upload permission.
CREATE OR REPLACE FUNCTION public.interior_user_has_permission(
  p_actor_id uuid,p_permission_id text,p_tenant_id uuid,p_project_id uuid DEFAULT NULL,p_branch_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_previous_claims text:=current_setting('request.jwt.claims',true);
  v_previous_sub text:=current_setting('request.jwt.claim.sub',true);
  v_previous_role text:=current_setting('request.jwt.claim.role',true);
  v_allowed boolean:=false;
BEGIN
  IF COALESCE(auth.jwt()->>'role','')<>'service_role' OR p_actor_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u JOIN auth.users au ON au.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND lower(u.status)='active' AND au.deleted_at IS NULL
      AND (au.banned_until IS NULL OR au.banned_until<=now())
  ) THEN RETURN false; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_actor_id::text,'role','authenticated','aud','authenticated'
  )::text,true);
  PERFORM set_config('request.jwt.claim.sub',p_actor_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  v_allowed:=public.interior_has_permission(p_permission_id,p_tenant_id,p_project_id,p_branch_id);
  PERFORM set_config('request.jwt.claims',COALESCE(v_previous_claims,''),true);
  PERFORM set_config('request.jwt.claim.sub',COALESCE(v_previous_sub,''),true);
  PERFORM set_config('request.jwt.claim.role',COALESCE(v_previous_role,''),true);
  RETURN COALESCE(v_allowed,false);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claims',COALESCE(v_previous_claims,''),true);
  PERFORM set_config('request.jwt.claim.sub',COALESCE(v_previous_sub,''),true);
  PERFORM set_config('request.jwt.claim.role',COALESCE(v_previous_role,''),true);
  RETURN false;
END;
$$;
ALTER FUNCTION public.interior_user_has_permission(uuid,text,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_user_has_permission(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_user_has_permission(uuid,text,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.interior_record_acceptance_evidence(
  p_tenant_id uuid,p_actor_id uuid,p_session_id uuid,p_note_id uuid,p_evidence_category text,p_bucket_id text,p_storage_path text,
  p_file_name text,p_file_size_bytes bigint,p_mime_type text,p_sha256_hash text,p_version integer
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=p_tenant_id; v_actor uuid:=p_actor_id;
  v_session public.interior_acceptance_sessions%ROWTYPE;
  v_evidence public.interior_acceptance_evidence_objects%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt()->>'role','')<>'service_role' OR v_actor IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'TRUSTED_EVIDENCE_CALLER_REQUIRED';
  END IF;
  SELECT * INTO v_session FROM public.interior_acceptance_sessions
    WHERE id=p_session_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCEPTANCE_SESSION_NOT_FOUND'; END IF;
  IF NOT public.interior_user_has_permission(v_actor,'interior:acceptance_evidence:upload',v_tenant,v_session.project_id,NULL) THEN
    RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:acceptance_evidence:upload';
  END IF;
  IF p_bucket_id IS DISTINCT FROM 'interior-site-evidence' THEN RAISE EXCEPTION 'ACCEPTANCE_BUCKET_FORBIDDEN'; END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE
    v_tenant::text||'/'||v_session.project_id::text||'/acceptance/'||v_session.id::text||'/%'
    OR position('..' IN p_storage_path)>0 THEN RAISE EXCEPTION 'ACCEPTANCE_STORAGE_PATH_FORBIDDEN'; END IF;
  IF p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_SIZE_INVALID';
  END IF;
  IF p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp','image/heic','application/pdf') THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_MIME_INVALID';
  END IF;
  IF p_sha256_hash IS NULL OR p_sha256_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_HASH_INVALID';
  END IF;
  IF p_version IS NULL OR p_version<1 OR p_evidence_category IS NULL OR
     p_evidence_category NOT IN ('OVERALL','DETAIL','COMPLETED_PRODUCT','CUSTOMER_SIGNOFF','REMEDIATION_PROOF') THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_METADATA_INVALID';
  END IF;
  IF p_file_name IS NULL OR length(p_file_name)>120 OR position('/' IN p_file_name)>0
     OR position(chr(92) IN p_file_name)>0 OR p_file_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_FILENAME_INVALID';
  END IF;
  IF p_note_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.interior_acceptance_notes n
    WHERE n.id=p_note_id AND n.tenant_id=v_tenant AND n.session_id=v_session.id
  ) THEN RAISE EXCEPTION 'ACCEPTANCE_NOTE_NOT_FOUND'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id=p_bucket_id AND o.name=p_storage_path) THEN
    RAISE EXCEPTION 'ACCEPTANCE_STORAGE_OBJECT_NOT_FOUND';
  END IF;
  INSERT INTO public.interior_acceptance_evidence_objects(
    tenant_id,session_id,note_id,evidence_category,bucket_id,storage_path,file_name,file_size_bytes,mime_type,
    sha256_hash,version,uploaded_by_user_id,uploaded_at
  ) VALUES(v_tenant,v_session.id,p_note_id,p_evidence_category,p_bucket_id,p_storage_path,p_file_name,
    p_file_size_bytes,p_mime_type,p_sha256_hash,p_version,v_actor,statement_timestamp())
  RETURNING * INTO v_evidence;
  RETURN to_jsonb(v_evidence);
END;
$$;
ALTER FUNCTION public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.interior_acceptance_approval_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  prior_status text NOT NULL CHECK (prior_status='PENDING'),
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  approval_notes text,
  rejection_reason text,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT fk_interior_acceptance_approval_audit_session FOREIGN KEY (tenant_id,session_id)
    REFERENCES public.interior_acceptance_sessions(tenant_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.interior_acceptance_approval_audit OWNER TO postgres;
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_approval_audit_session
  ON public.interior_acceptance_approval_audit(tenant_id,session_id,recorded_at DESC);
ALTER TABLE public.interior_acceptance_approval_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interior_acceptance_approval_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON TABLE public.interior_acceptance_approval_audit TO service_role;

-- Approval status and actor are written only through this actor-derived RPC.
CREATE OR REPLACE FUNCTION public.interior_decide_acceptance_session(
  p_session_id uuid,p_decision text,p_approval_notes text DEFAULT NULL,p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid; v_actor uuid:=auth.uid(); v_session public.interior_acceptance_sessions%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR COALESCE(auth.jwt()->>'role','')<>'authenticated' THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  v_tenant:=public.interior_actor_tenant();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'INTERIOR_TENANT_REQUIRED'; END IF;
  SELECT * INTO v_session FROM public.interior_acceptance_sessions
    WHERE id=p_session_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCEPTANCE_SESSION_NOT_FOUND'; END IF;
  IF NOT COALESCE(public.interior_has_permission('interior:acceptance:approve',v_tenant,v_session.project_id,NULL),false) THEN
    RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:acceptance:approve';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'INVALID_ACCEPTANCE_DECISION'; END IF;
  IF v_session.approval_status<>'PENDING' THEN RAISE EXCEPTION 'ACCEPTANCE_SESSION_ALREADY_DECIDED'; END IF;
  IF p_decision='REJECTED' AND NULLIF(btrim(p_rejection_reason),'') IS NULL THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;
  UPDATE public.interior_acceptance_sessions SET
    approval_status=p_decision,approved_by_actor_id=v_actor,approved_at=statement_timestamp(),
    approval_notes=NULLIF(btrim(p_approval_notes),''),
    rejection_reason=CASE WHEN p_decision='REJECTED' THEN NULLIF(btrim(p_rejection_reason),'') ELSE NULL END,
    updated_at=statement_timestamp()
  WHERE id=v_session.id AND tenant_id=v_tenant RETURNING * INTO v_session;
  INSERT INTO public.interior_acceptance_approval_audit(tenant_id,session_id,actor_id,prior_status,decision,
    approval_notes,rejection_reason)
  VALUES(v_tenant,v_session.id,v_actor,'PENDING',p_decision,v_session.approval_notes,v_session.rejection_reason);
  RETURN to_jsonb(v_session);
END;
$$;
ALTER FUNCTION public.interior_decide_acceptance_session(uuid,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_decide_acceptance_session(uuid,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.interior_decide_acceptance_session(uuid,text,text,text) TO authenticated;

COMMIT;