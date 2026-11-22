-- Bella Interior CRM and O4 action authorization hardening.
-- Additive, product-local security changes; no Production execution is implied.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.interior_permissions') IS NULL
     OR to_regclass('public.interior_role_permissions') IS NULL
     OR to_regprocedure('public.interior_has_permission(text,uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.interior_actor_tenant()') IS NULL THEN
    RAISE EXCEPTION 'Interior RBAC prerequisites are missing';
  END IF;
  IF to_regclass('public.interior_customers') IS NULL
     OR to_regclass('public.interior_customer_contacts') IS NULL
     OR to_regclass('public.interior_customer_addresses') IS NULL
     OR to_regclass('public.interior_acceptance_campaigns') IS NULL
     OR to_regclass('public.interior_acceptance_sessions') IS NULL
     OR to_regclass('public.interior_acceptance_notes') IS NULL
     OR to_regclass('public.interior_acceptance_evidence_objects') IS NULL THEN
    RAISE EXCEPTION 'Interior CRM/O4 tables are missing';
  END IF;
END
$preflight$;

DO $storage_bucket$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='interior-site-evidence') THEN
    RAISE EXCEPTION 'Interior evidence Storage bucket is missing';
  END IF;
  UPDATE storage.buckets
  SET public=false,
      file_size_limit=10485760,
      allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']::text[]
  WHERE id='interior-site-evidence';
END
$storage_bucket$;

-- Action catalog. Existing customer:read and handover:approve remain intact.
INSERT INTO public.interior_permissions(permission_id,module_key,action_key,description,sensitive) VALUES
  ('interior:customer:create','customer','CREATE','Tạo hồ sơ khách hàng',false),
  ('interior:customer:update','customer','UPDATE','Cập nhật hồ sơ khách hàng',false),
  ('interior:customer:delete','customer','DELETE','Xóa hồ sơ khách hàng',true),
  ('interior:customer:merge','customer','MERGE','Gộp hồ sơ khách hàng',true),
  ('interior:customer_contact:read','customer_contact','READ','Xem liên hệ khách hàng',false),
  ('interior:customer_contact:create','customer_contact','CREATE','Tạo liên hệ khách hàng',false),
  ('interior:customer_contact:update','customer_contact','UPDATE','Cập nhật liên hệ khách hàng',false),
  ('interior:customer_contact:delete','customer_contact','DELETE','Xóa liên hệ khách hàng',true),
  ('interior:customer_address:read','customer_address','READ','Xem địa chỉ khách hàng',false),
  ('interior:customer_address:create','customer_address','CREATE','Tạo địa chỉ khách hàng',false),
  ('interior:customer_address:update','customer_address','UPDATE','Cập nhật địa chỉ khách hàng',false),
  ('interior:customer_address:delete','customer_address','DELETE','Xóa địa chỉ khách hàng',true),
  ('interior:acceptance_campaign:read','acceptance_campaign','READ','Xem chiến dịch nghiệm thu',false),
  ('interior:acceptance_campaign:create','acceptance_campaign','CREATE','Tạo chiến dịch nghiệm thu',false),
  ('interior:acceptance_campaign:update','acceptance_campaign','UPDATE','Cập nhật chiến dịch nghiệm thu',false),
  ('interior:acceptance_session:read','acceptance_session','READ','Xem phiên nghiệm thu',false),
  ('interior:acceptance_session:create','acceptance_session','CREATE','Tạo phiên nghiệm thu',false),
  ('interior:acceptance_session:update','acceptance_session','UPDATE','Cập nhật kết quả kiểm tra',false),
  ('interior:acceptance_note:read','acceptance_note','READ','Xem ghi chú nghiệm thu',false),
  ('interior:acceptance_note:create','acceptance_note','CREATE','Tạo ghi chú nghiệm thu',false),
  ('interior:acceptance_evidence:read','acceptance_evidence','READ','Xem bằng chứng nghiệm thu',false),
  ('interior:acceptance_evidence:upload','acceptance_evidence','UPLOAD','Tải bằng chứng nghiệm thu',false),
  ('interior:acceptance:approve','acceptance','APPROVE','Quyết định phê duyệt nghiệm thu',true)
ON CONFLICT (permission_id) DO NOTHING;

-- Owner receives the new actions. Other roles inherit only the nearest existing
-- product responsibilities; approval remains limited to existing handover approvers.
INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT 'OWNER',permission_id FROM public.interior_permissions
WHERE permission_id IN (
  'interior:customer:create','interior:customer:update','interior:customer:delete','interior:customer:merge',
  'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update','interior:customer_contact:delete',
  'interior:customer_address:read','interior:customer_address:create','interior:customer_address:update','interior:customer_address:delete',
  'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
  'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
  'interior:acceptance_note:read','interior:acceptance_note:create',
  'interior:acceptance_evidence:read','interior:acceptance_evidence:upload','interior:acceptance:approve'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES
  ('ADMIN','interior:customer:create'),('ADMIN','interior:customer:update'),('ADMIN','interior:customer:merge'),
  ('ADMIN','interior:customer_contact:read'),('ADMIN','interior:customer_contact:create'),('ADMIN','interior:customer_contact:update'),
  ('ADMIN','interior:customer_address:read'),('ADMIN','interior:customer_address:create'),('ADMIN','interior:customer_address:update'),
  ('SALES','interior:customer:create'),('SALES','interior:customer:update'),
  ('SALES','interior:customer_contact:read'),('SALES','interior:customer_contact:create'),('SALES','interior:customer_contact:update'),
  ('SALES','interior:customer_address:read'),('SALES','interior:customer_address:create'),('SALES','interior:customer_address:update')
ON CONFLICT DO NOTHING;

INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT rp.role_key, target.permission_id
FROM public.interior_role_permissions rp
JOIN (VALUES
  ('interior:customer:read','interior:customer_contact:read'),
  ('interior:customer:read','interior:customer_address:read')
) AS target(source_permission,permission_id) ON target.source_permission=rp.permission_id
ON CONFLICT DO NOTHING;

INSERT INTO public.interior_role_permissions(role_key,permission_id)
SELECT rp.role_key,target.permission_id
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
) AS target(source_permission,permission_id) ON target.source_permission=rp.permission_id
ON CONFLICT DO NOTHING;

-- Preserve project-scoped RBAC for nested acceptance routes addressed by session id.
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
  IF p_tenant_id IS NULL OR public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN RETURN NULL; END IF;
  IF p_project_id IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.interior_projects WHERE id=p_project_id AND tenant_id=p_tenant_id;
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
      SELECT project_id INTO v_project_id FROM public.interior_acceptance_sessions
      WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    ELSE RETURN NULL;
  END CASE;
  RETURN v_project_id;
END;
$$;

-- CRM RLS: retain the restrictive tenant guard and replace permissive true policies.
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
CREATE POLICY interior_customers_delete ON public.interior_customers
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.interior_has_permission('interior:customer:delete',tenant_id,NULL,NULL));
REVOKE ALL ON public.interior_customers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.interior_customers TO authenticated;
GRANT INSERT(id,tenant_id,code,name,legal_name,tax_code,type,tier,primary_phone,primary_email,notes,assigned_staff_id)
  ON public.interior_customers TO authenticated;
GRANT UPDATE(name,legal_name,tax_code,type,tier,profile_status,primary_phone,primary_email,notes,assigned_staff_id)
  ON public.interior_customers TO authenticated;
GRANT DELETE ON public.interior_customers TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_customers TO service_role;

CREATE OR REPLACE FUNCTION public.interior_guard_customer_actor_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.tenant_id IS DISTINCT FROM public.interior_actor_tenant() THEN RAISE EXCEPTION 'TENANT_FORBIDDEN'; END IF;
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
DROP TRIGGER IF EXISTS trg_interior_guard_customer_actor_fields ON public.interior_customers;
CREATE TRIGGER trg_interior_guard_customer_actor_fields
  BEFORE INSERT OR UPDATE ON public.interior_customers
  FOR EACH ROW EXECUTE FUNCTION public.interior_guard_customer_actor_fields();

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
REVOKE ALL ON public.interior_customer_contacts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.interior_customer_contacts TO authenticated;
GRANT UPDATE(name,role,phone,email,position,is_primary) ON public.interior_customer_contacts TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_customer_contacts TO service_role;

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
REVOKE ALL ON public.interior_customer_addresses FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.interior_customer_addresses TO authenticated;
GRANT UPDATE(address_type,full_address,ward,district,city,is_default) ON public.interior_customer_addresses TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_customer_addresses TO service_role;

DROP POLICY IF EXISTS interior_customer_aliases_select ON public.interior_customer_aliases;
CREATE POLICY interior_customer_aliases_select ON public.interior_customer_aliases
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:customer:read',tenant_id,NULL,NULL));
DROP POLICY IF EXISTS interior_customer_merge_logs_select ON public.interior_customer_merge_logs;
CREATE POLICY interior_customer_merge_logs_select ON public.interior_customer_merge_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.interior_has_permission('interior:customer:read',tenant_id,NULL,NULL));

CREATE OR REPLACE FUNCTION public.interior_generate_customer_code(p_tenant_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_auth_tenant UUID; v_effective_tenant UUID; v_val BIGINT;
BEGIN
  v_auth_tenant:=public.interior_actor_tenant();
  IF auth.role()='authenticated' THEN
    IF v_auth_tenant IS NULL OR (p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant) THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN';
    END IF;
    IF NOT public.interior_has_permission('interior:customer:create',v_auth_tenant,NULL,NULL) THEN
      RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer:create';
    END IF;
    v_effective_tenant:=v_auth_tenant;
  ELSIF auth.role()='service_role' THEN
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE'; END IF;
    v_effective_tenant:=p_tenant_id;
  ELSE RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;
  INSERT INTO public.interior_customer_sequences(tenant_id,last_val,updated_at)
  VALUES (v_effective_tenant,1,statement_timestamp())
  ON CONFLICT (tenant_id) DO UPDATE SET
    last_val=public.interior_customer_sequences.last_val+1,updated_at=statement_timestamp()
  RETURNING last_val INTO v_val;
  RETURN 'KH-'||lpad(v_val::text,6,'0');
END;
$$;
REVOKE ALL ON FUNCTION public.interior_generate_customer_code(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.interior_generate_customer_code(UUID) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.interior_execute_customer_merge(
  p_tenant_id UUID,p_source_customer_id UUID,p_target_customer_id UUID,p_reason TEXT,p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_auth_tenant UUID; v_effective_tenant UUID; v_effective_actor UUID;
  v_source public.interior_customers%ROWTYPE; v_target public.interior_customers%ROWTYPE;
  v_contacts_transferred INTEGER:=0; v_addresses_transferred INTEGER:=0;
BEGIN
  v_auth_tenant:=public.interior_actor_tenant();
  IF auth.role()='authenticated' THEN
    IF v_auth_tenant IS NULL OR (p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant) THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN';
    END IF;
    IF NOT public.interior_has_permission('interior:customer:merge',v_auth_tenant,NULL,NULL) THEN
      RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer:merge';
    END IF;
    v_effective_tenant:=v_auth_tenant; v_effective_actor:=auth.uid();
  ELSIF auth.role()='service_role' THEN
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE'; END IF;
    v_effective_tenant:=p_tenant_id; v_effective_actor:=p_actor_id;
  ELSE RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;
  IF p_source_customer_id=p_target_customer_id THEN RAISE EXCEPTION 'CUSTOMER_MERGE_SELF_NOT_ALLOWED'; END IF;
  IF p_source_customer_id<p_target_customer_id THEN
    SELECT * INTO v_source FROM public.interior_customers WHERE id=p_source_customer_id AND tenant_id=v_effective_tenant FOR UPDATE;
    SELECT * INTO v_target FROM public.interior_customers WHERE id=p_target_customer_id AND tenant_id=v_effective_tenant FOR UPDATE;
  ELSE
    SELECT * INTO v_target FROM public.interior_customers WHERE id=p_target_customer_id AND tenant_id=v_effective_tenant FOR UPDATE;
    SELECT * INTO v_source FROM public.interior_customers WHERE id=p_source_customer_id AND tenant_id=v_effective_tenant FOR UPDATE;
  END IF;
  IF v_source.id IS NULL THEN RAISE EXCEPTION 'SOURCE_CUSTOMER_NOT_FOUND'; END IF;
  IF v_target.id IS NULL THEN RAISE EXCEPTION 'TARGET_CUSTOMER_NOT_FOUND'; END IF;
  IF v_source.profile_status='merged' THEN RAISE EXCEPTION 'CUSTOMER_ALREADY_MERGED'; END IF;
  IF v_target.profile_status='merged' THEN RAISE EXCEPTION 'TARGET_CUSTOMER_CANNOT_BE_MERGED_STATE'; END IF;
  IF EXISTS (SELECT 1 FROM public.interior_customer_aliases WHERE tenant_id=v_effective_tenant
      AND source_customer_id=p_target_customer_id AND target_customer_id=p_source_customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_CYCLE_DETECTED';
  END IF;
  WITH moved AS (
    UPDATE public.interior_customer_contacts SET customer_id=p_target_customer_id,updated_at=statement_timestamp()
    WHERE customer_id=p_source_customer_id AND tenant_id=v_effective_tenant RETURNING id
  ) SELECT count(*) INTO v_contacts_transferred FROM moved;
  WITH moved AS (
    UPDATE public.interior_customer_addresses SET customer_id=p_target_customer_id,updated_at=statement_timestamp()
    WHERE customer_id=p_source_customer_id AND tenant_id=v_effective_tenant RETURNING id
  ) SELECT count(*) INTO v_addresses_transferred FROM moved;
  INSERT INTO public.interior_customer_aliases(tenant_id,source_customer_id,target_customer_id,created_at)
  VALUES(v_effective_tenant,p_source_customer_id,p_target_customer_id,statement_timestamp());
  UPDATE public.interior_customer_aliases SET target_customer_id=p_target_customer_id
    WHERE target_customer_id=p_source_customer_id AND tenant_id=v_effective_tenant;
  PERFORM set_config('bella.interior.customer_merge','on',true);
  UPDATE public.interior_customers SET profile_status='merged',merged_into_id=p_target_customer_id,updated_at=statement_timestamp()
    WHERE id=p_source_customer_id AND tenant_id=v_effective_tenant;
  INSERT INTO public.interior_customer_merge_logs(tenant_id,source_customer_id,target_customer_id,actor_id,reason,
    contacts_transferred_count,addresses_transferred_count,merged_at)
  VALUES(v_effective_tenant,p_source_customer_id,p_target_customer_id,v_effective_actor,p_reason,
    v_contacts_transferred,v_addresses_transferred,statement_timestamp());
  RETURN jsonb_build_object('success',true,'sourceCustomerId',p_source_customer_id,'targetCustomerId',p_target_customer_id,
    'contactsTransferred',v_contacts_transferred,'addressesTransferred',v_addresses_transferred,'canonicalId',p_target_customer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.interior_execute_customer_merge(UUID,UUID,UUID,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(UUID,UUID,UUID,TEXT,UUID) TO authenticated,service_role;

-- Tenant-qualified keys and references prevent cross-tenant parent links in O4.
-- zero-downtime: allow blocking-index - tenant-qualified unique index on interior_projects product table
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_projects_tenant_id_id ON public.interior_projects(tenant_id,id);
-- zero-downtime: allow blocking-index - tenant-qualified unique index on interior_acceptance_campaigns product table
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_campaigns_tenant_id_id ON public.interior_acceptance_campaigns(tenant_id,id);
-- zero-downtime: allow blocking-index - tenant-qualified unique index on interior_acceptance_sessions product table
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_sessions_tenant_id_id ON public.interior_acceptance_sessions(tenant_id,id);
-- zero-downtime: allow blocking-index - tenant-qualified unique index on interior_acceptance_notes product table
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_notes_tenant_id_id ON public.interior_acceptance_notes(tenant_id,id);
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_interior_acceptance_campaigns_tenant_project') THEN
    ALTER TABLE public.interior_acceptance_campaigns ADD CONSTRAINT fk_interior_acceptance_campaigns_tenant_project
      FOREIGN KEY (tenant_id,project_id) REFERENCES public.interior_projects(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_interior_acceptance_sessions_tenant_campaign') THEN
    ALTER TABLE public.interior_acceptance_sessions ADD CONSTRAINT fk_interior_acceptance_sessions_tenant_campaign
      FOREIGN KEY (tenant_id,campaign_id) REFERENCES public.interior_acceptance_campaigns(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_interior_acceptance_sessions_tenant_project') THEN
    ALTER TABLE public.interior_acceptance_sessions ADD CONSTRAINT fk_interior_acceptance_sessions_tenant_project
      FOREIGN KEY (tenant_id,project_id) REFERENCES public.interior_projects(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_interior_acceptance_notes_tenant_session') THEN
    ALTER TABLE public.interior_acceptance_notes ADD CONSTRAINT fk_interior_acceptance_notes_tenant_session
      FOREIGN KEY (tenant_id,session_id) REFERENCES public.interior_acceptance_sessions(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_interior_acceptance_evidence_tenant_session') THEN
    ALTER TABLE public.interior_acceptance_evidence_objects ADD CONSTRAINT fk_interior_acceptance_evidence_tenant_session
      FOREIGN KEY (tenant_id,session_id) REFERENCES public.interior_acceptance_sessions(tenant_id,id) ON DELETE CASCADE;
  END IF;
END
$constraints$;

-- O4 RLS has both a non-bypassable tenant guard and action-specific permissive policies.
DROP POLICY IF EXISTS interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns;
CREATE POLICY interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
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
  WITH CHECK (public.interior_has_permission('interior:acceptance_campaign:update',tenant_id,project_id,NULL));
REVOKE ALL ON public.interior_acceptance_campaigns FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.interior_acceptance_campaigns TO authenticated;
GRANT UPDATE(campaign_name,description) ON public.interior_acceptance_campaigns TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_acceptance_campaigns TO service_role;

DROP POLICY IF EXISTS interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions;
CREATE POLICY interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
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
  WITH CHECK (public.interior_has_permission('interior:acceptance_session:update',tenant_id,project_id,NULL));
REVOKE ALL ON public.interior_acceptance_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.interior_acceptance_sessions TO authenticated;
GRANT INSERT(id,tenant_id,campaign_id,project_id,session_code,session_type,inspection_scope,inspection_date,
  recorder_actor_id,customer_representative,customer_contact,related_boq_item_ids,inspection_result)
  ON public.interior_acceptance_sessions TO authenticated;
GRANT UPDATE(inspection_result,approval_notes) ON public.interior_acceptance_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_acceptance_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.interior_guard_acceptance_session_update()
RETURNS trigger
LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF OLD.approval_status<>'PENDING' AND NEW.approval_notes IS DISTINCT FROM OLD.approval_notes THEN
    RAISE EXCEPTION 'ACCEPTANCE_DECISION_NOTES_IMMUTABLE';
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_guard_acceptance_session_update() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_interior_guard_acceptance_session_update ON public.interior_acceptance_sessions;
CREATE TRIGGER trg_interior_guard_acceptance_session_update
  BEFORE UPDATE ON public.interior_acceptance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.interior_guard_acceptance_session_update();

DROP POLICY IF EXISTS interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes;
CREATE POLICY interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
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
REVOKE ALL ON public.interior_acceptance_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.interior_acceptance_notes TO authenticated;
GRANT INSERT(id,tenant_id,session_id,category,severity,assessment_status,description,related_boq_item_id,
  remediation_plan,assigned_fixer,target_deadline,remediation_status,routed_entity_type,routed_entity_id,created_by_user_id)
  ON public.interior_acceptance_notes TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_acceptance_notes TO service_role;

DROP POLICY IF EXISTS interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects;
CREATE POLICY interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id=public.interior_actor_tenant()) WITH CHECK (tenant_id=public.interior_actor_tenant());
CREATE POLICY interior_acceptance_evidence_objects_read ON public.interior_acceptance_evidence_objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interior_acceptance_sessions s
    WHERE s.id=interior_acceptance_evidence_objects.session_id
      AND s.tenant_id=interior_acceptance_evidence_objects.tenant_id
      AND public.interior_has_permission('interior:acceptance_evidence:read',interior_acceptance_evidence_objects.tenant_id,s.project_id,NULL)));
REVOKE ALL ON public.interior_acceptance_evidence_objects FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.interior_acceptance_evidence_objects TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interior_acceptance_evidence_objects TO service_role;

-- Approval is atomic, actor-derived, state-checked and auditable.
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
-- zero-downtime: allow blocking-index - newly created audit table in same migration
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_approval_audit_session
  ON public.interior_acceptance_approval_audit(tenant_id,session_id,recorded_at DESC);
ALTER TABLE public.interior_acceptance_approval_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interior_acceptance_approval_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.interior_acceptance_approval_audit TO service_role;

CREATE OR REPLACE FUNCTION public.interior_decide_acceptance_session(
  p_session_id uuid,p_decision text,p_approval_notes text DEFAULT NULL,p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid; v_actor uuid:=auth.uid(); v_session public.interior_acceptance_sessions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  v_tenant:=public.interior_actor_tenant();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'INTERIOR_TENANT_REQUIRED'; END IF;
  SELECT * INTO v_session FROM public.interior_acceptance_sessions
    WHERE id=p_session_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCEPTANCE_SESSION_NOT_FOUND'; END IF;
  IF NOT public.interior_has_permission('interior:acceptance:approve',v_tenant,v_session.project_id,NULL) THEN
    RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:acceptance:approve';
  END IF;
  IF p_decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'INVALID_ACCEPTANCE_DECISION'; END IF;
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
REVOKE ALL ON FUNCTION public.interior_decide_acceptance_session(uuid,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.interior_decide_acceptance_session(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_recalculate_acceptance_documentation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
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
  UPDATE public.interior_acceptance_sessions SET documentation_status=COALESCE(v_status,'NONE'),updated_at=statement_timestamp()
  WHERE tenant_id=NEW.tenant_id AND id=NEW.session_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interior_recalculate_acceptance_documentation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_interior_acceptance_documentation_status ON public.interior_acceptance_evidence_objects;
CREATE TRIGGER trg_interior_acceptance_documentation_status
  AFTER INSERT ON public.interior_acceptance_evidence_objects
  FOR EACH ROW EXECUTE FUNCTION public.interior_recalculate_acceptance_documentation();

-- Evidence metadata is append-only. The caller must own the upload permission,
-- and the path must reference an actual object uploaded to the private O3 bucket.
CREATE OR REPLACE FUNCTION public.interior_user_has_permission(
  p_actor_id uuid,p_permission_id text,p_tenant_id uuid,p_project_id uuid DEFAULT NULL,p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_previous_claims text:=current_setting('request.jwt.claims',true);
  v_previous_sub text:=current_setting('request.jwt.claim.sub',true);
  v_previous_role text:=current_setting('request.jwt.claim.role',true);
  v_allowed boolean:=false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL THEN RETURN false; END IF;
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
REVOKE ALL ON FUNCTION public.interior_user_has_permission(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_user_has_permission(uuid,text,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.interior_record_acceptance_evidence(
  p_tenant_id uuid,p_actor_id uuid,p_session_id uuid,p_note_id uuid,p_evidence_category text,p_bucket_id text,p_storage_path text,
  p_file_name text,p_file_size_bytes bigint,p_mime_type text,p_sha256_hash text,p_version integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid; v_actor uuid:=p_actor_id; v_session public.interior_acceptance_sessions%ROWTYPE;
  v_evidence public.interior_acceptance_evidence_objects%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR v_actor IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TRUSTED_EVIDENCE_CALLER_REQUIRED';
  END IF;
  v_tenant:=p_tenant_id;
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
  IF p_file_size_bytes NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_SIZE_INVALID'; END IF;
  IF p_mime_type NOT IN ('image/jpeg','image/png','image/webp','image/heic','application/pdf') THEN
    RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_MIME_INVALID';
  END IF;
  IF p_sha256_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'ACCEPTANCE_EVIDENCE_HASH_INVALID'; END IF;
  IF p_version<1 OR p_evidence_category NOT IN ('OVERALL','DETAIL','COMPLETED_PRODUCT','CUSTOMER_SIGNOFF','REMEDIATION_PROOF') THEN
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
REVOKE ALL ON FUNCTION public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)
  TO service_role;

COMMIT;
