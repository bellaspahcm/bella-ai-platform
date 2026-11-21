-- REVIEW CANDIDATE ONLY. PRODUCTION WRITE HOLD. DO NOT EXECUTE.
-- Proposed P2 CRM direct-table authorization. Do not run from this file.
-- Preconditions: compare these object definitions to live Production immediately before promotion.
BEGIN;

DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P2 requires a migration role able to assign reviewed SECURITY DEFINER ownership to postgres';
  END IF;
  IF to_regclass('public.interior_permissions') IS NULL
     OR to_regclass('public.interior_role_permissions') IS NULL
     OR to_regprocedure('public.interior_has_permission(text,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.interior_actor_tenant()') IS NULL
     OR to_regclass('public.interior_customers') IS NULL
     OR to_regclass('public.interior_customer_contacts') IS NULL
     OR to_regclass('public.interior_customer_addresses') IS NULL THEN
    RAISE EXCEPTION 'Production CRM/RBAC prerequisites differ from the reviewed catalog';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.interior_customers'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.interior_customer_contacts'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.interior_customer_addresses'::regclass) THEN
    RAISE EXCEPTION 'CRM RLS must remain enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='interior_customers' AND policyname='tenant_isolation_policy' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='interior_customer_contacts' AND policyname='tenant_isolation_policy' AND permissive='RESTRICTIVE')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='interior_customer_addresses' AND policyname='tenant_isolation_policy' AND permissive='RESTRICTIVE') THEN
    RAISE EXCEPTION 'Expected restrictive tenant guards were not found';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (
        'interior_customers','interior_customer_contacts','interior_customer_addresses'))<>15
     OR EXISTS (
       WITH expected(tablename,policyname,permissive,cmd,qual,with_check) AS (VALUES
         ('interior_customers','tenant_isolation_policy','RESTRICTIVE','ALL','(tenant_id = interior_actor_tenant())','(tenant_id = interior_actor_tenant())'),
         ('interior_customers','interior_customers_select','PERMISSIVE','SELECT','true',NULL),
         ('interior_customers','interior_customers_insert','PERMISSIVE','INSERT',NULL,'true'),
         ('interior_customers','interior_customers_update','PERMISSIVE','UPDATE','true','true'),
         ('interior_customers','interior_customers_delete','PERMISSIVE','DELETE','true',NULL),
         ('interior_customer_contacts','tenant_isolation_policy','RESTRICTIVE','ALL','(tenant_id = interior_actor_tenant())','(tenant_id = interior_actor_tenant())'),
         ('interior_customer_contacts','interior_customer_contacts_select','PERMISSIVE','SELECT','true',NULL),
         ('interior_customer_contacts','interior_customer_contacts_insert','PERMISSIVE','INSERT',NULL,'true'),
         ('interior_customer_contacts','interior_customer_contacts_update','PERMISSIVE','UPDATE','true','true'),
         ('interior_customer_contacts','interior_customer_contacts_delete','PERMISSIVE','DELETE','true',NULL),
         ('interior_customer_addresses','tenant_isolation_policy','RESTRICTIVE','ALL','(tenant_id = interior_actor_tenant())','(tenant_id = interior_actor_tenant())'),
         ('interior_customer_addresses','interior_customer_addresses_select','PERMISSIVE','SELECT','true',NULL),
         ('interior_customer_addresses','interior_customer_addresses_insert','PERMISSIVE','INSERT',NULL,'true'),
         ('interior_customer_addresses','interior_customer_addresses_update','PERMISSIVE','UPDATE','true','true'),
         ('interior_customer_addresses','interior_customer_addresses_delete','PERMISSIVE','DELETE','true',NULL)
       )
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>e.permissive OR p.roles::text<>'{authenticated}'
          OR p.cmd<>e.cmd OR p.qual IS DISTINCT FROM e.qual OR p.with_check IS DISTINCT FROM e.with_check
     ) THEN
    RAISE EXCEPTION 'Production CRM policy set differs from the reviewed tenant-only baseline';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid IN (
      'public.interior_customers'::regclass,
      'public.interior_customer_contacts'::regclass,
      'public.interior_customer_addresses'::regclass
    ) AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected explicit CRM column grants require review before replacement';
  END IF;
  IF EXISTS (
    WITH expected(table_name,expected_acl) AS (VALUES
      ('interior_customers','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arw/postgres}'),
      ('interior_customer_contacts','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arwd/postgres}'),
      ('interior_customer_addresses','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=arwd/postgres}')
    )
    SELECT 1 FROM expected e JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name)
    WHERE pg_get_userbyid(c.relowner)<>'postgres' OR c.relacl::text IS DISTINCT FROM e.expected_acl
  ) THEN
    RAISE EXCEPTION 'Production CRM table owner/grants differ from the captured catalog, including operational-role grants';
  END IF;
  IF NOT has_table_privilege('authenticated','public.interior_customers','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_customers','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_customers','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customers','DELETE')
     OR has_table_privilege('authenticated','public.interior_customers','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_customers','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_customers','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','UPDATE')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','DELETE')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','UPDATE')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','DELETE') THEN
    RAISE EXCEPTION 'Effective authenticated CRM table privileges differ from the captured Production baseline';
  END IF;
  IF has_table_privilege('authenticated','public.interior_customer_addresses','TRUNCATE')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','REFERENCES')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','TRIGGER') THEN
    RAISE EXCEPTION 'Effective authenticated CRM table privileges differ from the captured Production baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id IN (
      'interior:customer:create','interior:customer:update','interior:customer:merge',
      'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
      'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
      'interior:customer_address:update','interior:customer_address:delete'))
     OR EXISTS (SELECT 1 FROM public.interior_role_permissions WHERE permission_id IN (
      'interior:customer:create','interior:customer:update','interior:customer:merge',
      'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
      'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
      'interior:customer_address:update','interior:customer_address:delete')) THEN
    RAISE EXCEPTION 'CRM permission keys already exist; reconcile role ownership before applying this candidate';
  END IF;
  IF (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
      WHERE permission_id='interior:customer:read') IS DISTINCT FROM ARRAY['ADMIN','EXECUTIVE','OWNER','SALES']::text[] THEN
    RAISE EXCEPTION 'Production customer:read role audience differs from the captured mapping';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid)'::regprocedure
      AND md5(prosrc)='f746aff31b72248fbed7617b3f9af7b5'
      AND proowner='postgres'::regrole AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND COALESCE(proacl,acldefault('f',proowner))::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_generate_customer_code(uuid)'::regprocedure
      AND md5(prosrc)='176944fa24e9c06809060b4100689627'
      AND proowner='postgres'::regrole AND prosecdef
      AND proconfig @> ARRAY['search_path=""']::text[]
      AND COALESCE(proacl,acldefault('f',proowner))::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}') THEN
    RAISE EXCEPTION 'Production CRM RPC definitions, owners, SECURITY DEFINER config or ACLs differ from the captured rollback baseline';
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
  IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='interior_customers'
        AND t.tgname='trg_interior_prevent_customer_hard_delete' AND NOT t.tgisinternal
        AND pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_interior_prevent_customer_hard_delete BEFORE DELETE ON public.interior_customers FOR EACH ROW EXECUTE FUNCTION interior_prevent_customer_hard_delete()'
        AND t.tgfoid='public.interior_prevent_customer_hard_delete()'::regprocedure
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_proc WHERE oid='public.interior_prevent_customer_hard_delete()'::regprocedure
        AND md5(prosrc)='1a764862f4e730eafafce32ffedb4508'
        AND proowner='postgres'::regrole AND prosecdef
        AND COALESCE(proacl,acldefault('f',proowner))::text='{=X/postgres,postgres=X/postgres,service_role=X/postgres}'
        AND has_function_privilege('authenticated',oid,'EXECUTE')
    ) THEN
    RAISE EXCEPTION 'Production customer hard-delete guard/trigger differs from the captured baseline';
  END IF;
  IF to_regprocedure('public.interior_guard_customer_actor_fields()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
       AND tgname='trg_interior_guard_customer_actor_fields') THEN
    RAISE EXCEPTION 'Customer actor guard object already exists; compare its definition before replacement';
  END IF;
END
$preflight$;

INSERT INTO public.interior_permissions(permission_id,module_key,action_key,description,sensitive) VALUES
  ('interior:customer:create','customer','CREATE','Tạo hồ sơ khách hàng',false),
  ('interior:customer:update','customer','UPDATE','Cập nhật hồ sơ khách hàng',false),
  ('interior:customer:merge','customer','MERGE','Gộp hồ sơ khách hàng',true),
  ('interior:customer_contact:read','customer_contact','READ','Xem liên hệ khách hàng',false),
  ('interior:customer_contact:create','customer_contact','CREATE','Tạo liên hệ khách hàng',false),
  ('interior:customer_contact:update','customer_contact','UPDATE','Cập nhật liên hệ khách hàng',false),
  ('interior:customer_contact:delete','customer_contact','DELETE','Xóa liên hệ khách hàng',true),
  ('interior:customer_address:read','customer_address','READ','Xem địa chỉ khách hàng',false),
  ('interior:customer_address:create','customer_address','CREATE','Tạo địa chỉ khách hàng',false),
  ('interior:customer_address:update','customer_address','UPDATE','Cập nhật địa chỉ khách hàng',false),
  ('interior:customer_address:delete','customer_address','DELETE','Xóa địa chỉ khách hàng',true)
ON CONFLICT (permission_id) DO NOTHING;

-- Proposed additions only; do not delete existing role-permission rows.
INSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES
  ('OWNER','interior:customer:create'),('OWNER','interior:customer:update'),
  ('OWNER','interior:customer_contact:read'),('OWNER','interior:customer_contact:create'),
  ('OWNER','interior:customer_contact:update'),('OWNER','interior:customer_contact:delete'),
  ('OWNER','interior:customer_address:read'),('OWNER','interior:customer_address:create'),
  ('OWNER','interior:customer_address:update'),('OWNER','interior:customer_address:delete'),
  ('ADMIN','interior:customer:create'),('ADMIN','interior:customer:update'),
  ('ADMIN','interior:customer_contact:read'),('ADMIN','interior:customer_contact:create'),
  ('ADMIN','interior:customer_contact:update'),('ADMIN','interior:customer_address:read'),
  ('ADMIN','interior:customer_address:create'),('ADMIN','interior:customer_address:update'),
  ('SALES','interior:customer:create'),('SALES','interior:customer:update'),
  ('SALES','interior:customer_contact:create'),('SALES','interior:customer_contact:update'),
  ('SALES','interior:customer_address:create'),('SALES','interior:customer_address:update')
ON CONFLICT DO NOTHING;

-- Preserve the current customer:read audience for contact/address reads.
INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT rp.role_key, map.permission_id
FROM public.interior_role_permissions rp
JOIN (VALUES
  ('interior:customer_contact:read'),('interior:customer_address:read')
) AS map(permission_id) ON true
WHERE rp.permission_id='interior:customer:read'
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS interior_customers_delete ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_select ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_insert ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_update ON public.interior_customers;
CREATE POLICY interior_customers_select ON public.interior_customers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:customer:read',tenant_id,NULL,NULL));
CREATE POLICY interior_customers_insert ON public.interior_customers
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer:create',tenant_id,NULL,NULL));
CREATE POLICY interior_customers_update ON public.interior_customers
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.interior_has_permission('interior:customer:update',tenant_id,NULL,NULL))
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer:update',tenant_id,NULL,NULL));
DROP POLICY IF EXISTS interior_customer_contacts_select ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_insert ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_update ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_delete ON public.interior_customer_contacts;
CREATE POLICY interior_customer_contacts_select ON public.interior_customer_contacts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:customer_contact:read',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_contacts_insert ON public.interior_customer_contacts
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer_contact:create',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_contacts_update ON public.interior_customer_contacts
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.interior_has_permission('interior:customer_contact:update',tenant_id,NULL,NULL))
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer_contact:update',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_contacts_delete ON public.interior_customer_contacts
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.interior_has_permission('interior:customer_contact:delete',tenant_id,NULL,NULL));

DROP POLICY IF EXISTS interior_customer_addresses_select ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_insert ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_update ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_delete ON public.interior_customer_addresses;
CREATE POLICY interior_customer_addresses_select ON public.interior_customer_addresses
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:customer_address:read',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_addresses_insert ON public.interior_customer_addresses
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer_address:create',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_addresses_update ON public.interior_customer_addresses
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.interior_has_permission('interior:customer_address:update',tenant_id,NULL,NULL))
  WITH CHECK (tenant_id=public.interior_actor_tenant()
    AND public.interior_has_permission('interior:customer_address:update',tenant_id,NULL,NULL));
CREATE POLICY interior_customer_addresses_delete ON public.interior_customer_addresses
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.interior_has_permission('interior:customer_address:delete',tenant_id,NULL,NULL));

-- Remove broad table ACLs, then restore read and the minimum repository columns.
REVOKE ALL ON TABLE public.interior_customers FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.interior_customer_contacts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.interior_customer_addresses FROM PUBLIC,anon,authenticated;
-- Production currently grants authenticated no hard DELETE on customers.
-- Keep archive/update available and preserve the existing hard-delete guard.
GRANT SELECT ON TABLE public.interior_customers TO authenticated;
GRANT INSERT(id,tenant_id,code,name,legal_name,tax_code,type,tier,primary_phone,primary_email,notes,assigned_staff_id)
  ON TABLE public.interior_customers TO authenticated;
GRANT UPDATE(name,legal_name,tax_code,type,tier,profile_status,primary_phone,primary_email,notes,assigned_staff_id)
  ON TABLE public.interior_customers TO authenticated;
GRANT SELECT,DELETE ON TABLE public.interior_customer_contacts TO authenticated;
GRANT INSERT(tenant_id,customer_id,name,role,phone,email,position,is_primary)
  ON TABLE public.interior_customer_contacts TO authenticated;
GRANT UPDATE(name,role,phone,email,position,is_primary)
  ON TABLE public.interior_customer_contacts TO authenticated;
GRANT SELECT,DELETE ON TABLE public.interior_customer_addresses TO authenticated;
GRANT INSERT(tenant_id,customer_id,address_type,full_address,ward,district,city,is_default)
  ON TABLE public.interior_customer_addresses TO authenticated;
GRANT UPDATE(address_type,full_address,ward,district,city,is_default)
  ON TABLE public.interior_customer_addresses TO authenticated;

-- Preserve the repository's supported profile_status update while protecting
-- merge-only transitions and assigned-staff tenant integrity.
CREATE OR REPLACE FUNCTION public.interior_guard_customer_actor_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role','')='authenticated' THEN
    IF NEW.tenant_id IS DISTINCT FROM public.interior_actor_tenant() THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN';
    END IF;
    IF NEW.assigned_staff_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id=NEW.assigned_staff_id AND u.tenant_id=NEW.tenant_id
    ) THEN RAISE EXCEPTION 'CUSTOMER_ASSIGNED_STAFF_TENANT_MISMATCH'; END IF;
    IF TG_OP='INSERT' THEN
      NEW.profile_status:='active';
      NEW.merged_into_id:=NULL;
    ELSE
      IF OLD.profile_status='merged' AND NEW.profile_status IS DISTINCT FROM 'merged' THEN
        RAISE EXCEPTION 'CUSTOMER_MERGE_STATE_IMMUTABLE';
      END IF;
      IF NEW.profile_status='merged' AND OLD.profile_status IS DISTINCT FROM 'merged'
         AND current_setting('bella.interior.customer_merge',true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'CUSTOMER_MERGE_REQUIRES_MERGE_ACTION';
      END IF;
    END IF;
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_guard_customer_actor_fields() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.interior_guard_customer_actor_fields() OWNER TO postgres;
DROP TRIGGER IF EXISTS trg_interior_guard_customer_actor_fields ON public.interior_customers;
CREATE TRIGGER trg_interior_guard_customer_actor_fields
  BEFORE INSERT OR UPDATE ON public.interior_customers
  FOR EACH ROW EXECUTE FUNCTION public.interior_guard_customer_actor_fields();

CREATE OR REPLACE FUNCTION public.interior_generate_customer_code(p_tenant_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_role text:=COALESCE(auth.jwt()->>'role','');
  v_auth_tenant uuid;
  v_effective_tenant uuid;
  v_val bigint;
BEGIN
  v_auth_tenant:=public.interior_actor_tenant();
  IF v_role='authenticated' THEN
    IF v_auth_tenant IS NULL OR (p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant) THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN';
    END IF;
    IF NOT COALESCE(public.interior_has_permission('interior:customer:create',v_auth_tenant,NULL,NULL),false) THEN
      RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer:create';
    END IF;
    v_effective_tenant:=v_auth_tenant;
  ELSIF v_role='service_role' THEN
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE'; END IF;
    v_effective_tenant:=p_tenant_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  INSERT INTO public.interior_customer_sequences(tenant_id,last_val,updated_at)
  VALUES(v_effective_tenant,1,statement_timestamp())
  ON CONFLICT (tenant_id) DO UPDATE SET
    last_val=public.interior_customer_sequences.last_val+1,updated_at=statement_timestamp()
  RETURNING last_val INTO v_val;
  RETURN 'KH-'||lpad(v_val::text,6,'0');
END;
$$;
REVOKE ALL ON FUNCTION public.interior_generate_customer_code(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_generate_customer_code(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.interior_execute_customer_merge(p_tenant_id uuid, p_source_customer_id uuid, p_target_customer_id uuid, p_reason text, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_auth_tenant UUID;
  v_effective_tenant UUID;
  v_effective_actor UUID;
  v_source public.interior_customers%ROWTYPE;
  v_target public.interior_customers%ROWTYPE;
  v_merge_log public.interior_customer_merge_logs%ROWTYPE;
  v_contacts_transferred INTEGER := 0;
  v_addresses_transferred INTEGER := 0;
BEGIN
  -- 1. Security & Identity Reconciliation
  v_auth_tenant := public.interior_actor_tenant();

  IF COALESCE(auth.jwt()->>'role','') = 'authenticated' THEN
    IF v_auth_tenant IS NULL THEN
      RAISE EXCEPTION 'AUTHENTICATED_INTERIOR_TENANT_REQUIRED';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN: Cannot merge customers of foreign tenant';
    END IF;
    IF auth.uid() IS NULL OR NOT COALESCE(public.interior_has_permission('interior:customer:merge', v_auth_tenant, NULL, NULL),false) THEN
      RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer:merge';
    END IF;
    v_effective_tenant := v_auth_tenant;
    -- Strictly override actor_id with verified auth.uid()
    v_effective_actor := auth.uid();
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_SELF_NOT_ALLOWED';
  END IF;

  -- 2. Concurrency-Safe Ordered Locking (Deadlock Prevention)
  IF p_source_customer_id < p_target_customer_id THEN
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  ELSE
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  END IF;

  -- 3. Existence & State Validation
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'SOURCE_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_source.profile_status = 'merged' THEN
    RAISE EXCEPTION 'CUSTOMER_ALREADY_MERGED';
  END IF;

  IF v_target.profile_status = 'merged' THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_CANNOT_BE_MERGED_STATE';
  END IF;

  -- 4. Cycle Detection in Existing Aliases
  IF EXISTS (
    SELECT 1 FROM public.interior_customer_aliases
    WHERE tenant_id = v_effective_tenant
      AND source_customer_id = p_target_customer_id
      AND target_customer_id = p_source_customer_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_CYCLE_DETECTED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.interior_customer_contacts WHERE tenant_id=v_effective_tenant AND customer_id=p_source_customer_id AND is_primary)
     AND EXISTS (SELECT 1 FROM public.interior_customer_contacts WHERE tenant_id=v_effective_tenant AND customer_id=p_target_customer_id AND is_primary) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_PRIMARY_CONTACT_CONFLICT';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_customer_addresses WHERE tenant_id=v_effective_tenant AND customer_id=p_source_customer_id AND is_default)
     AND EXISTS (SELECT 1 FROM public.interior_customer_addresses WHERE tenant_id=v_effective_tenant AND customer_id=p_target_customer_id AND is_default) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_DEFAULT_ADDRESS_CONFLICT';
  END IF;

  -- 5. Reassign Contacts
  WITH moved_contacts AS (
    UPDATE public.interior_customer_contacts
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_contacts_transferred FROM moved_contacts;

  -- 6. Reassign Addresses
  WITH moved_addresses AS (
    UPDATE public.interior_customer_addresses
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_addresses_transferred FROM moved_addresses;

  -- 7. Register Source -> Target Alias
  INSERT INTO public.interior_customer_aliases (
    tenant_id,
    source_customer_id,
    target_customer_id,
    created_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    statement_timestamp()
  );

  -- 8. Flatten Existing Transitive Aliases Pointing to Source -> Update to Target
  UPDATE public.interior_customer_aliases
  SET target_customer_id = p_target_customer_id
  WHERE target_customer_id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  PERFORM set_config('bella.interior.customer_merge','on',true);
  -- 9. Mark Source Customer as Merged
  UPDATE public.interior_customers
  SET profile_status = 'merged',
      merged_into_id = p_target_customer_id,
      updated_at = statement_timestamp()
  WHERE id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  -- 10. Record Audit Merge Log
  INSERT INTO public.interior_customer_merge_logs (
    tenant_id,
    source_customer_id,
    target_customer_id,
    actor_id,
    reason,
    contacts_transferred_count,
    addresses_transferred_count,
    merged_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    v_effective_actor,
    p_reason,
    v_contacts_transferred,
    v_addresses_transferred,
    statement_timestamp()
  ) RETURNING * INTO v_merge_log;

  RETURN jsonb_build_object(
    'success', true,
    'sourceCustomerId', p_source_customer_id,
    'targetCustomerId', p_target_customer_id,
    'contactsTransferred', v_contacts_transferred,
    'addressesTransferred', v_addresses_transferred,
    'canonicalId', p_target_customer_id,
    'mergeLog', to_jsonb(v_merge_log)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,service_role,authenticated;
GRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) TO authenticated;
INSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES ('OWNER','interior:customer:merge'),('ADMIN','interior:customer:merge') ON CONFLICT DO NOTHING;

COMMIT;
