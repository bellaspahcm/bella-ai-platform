"""Build local review candidates; never executes SQL or touches a database."""
from pathlib import Path

root = Path(__file__).resolve().parent


def body(name):
    text = (root / name).read_text(encoding='utf-8')
    return text.split('/*\n', 1)[1].rsplit('\n*/', 1)[0]


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Expected exactly one occurrence: {old[:90]!r}')
    return text.replace(old, new, 1)


p2 = body('P2-crm-action-authorization.sql.draft')
merge = (root / 'baseline-interior_execute_customer_merge.sql.txt').read_text(encoding='utf-8')
merge = replace_once(merge, "IF auth.role() = 'authenticated' THEN", "IF COALESCE(auth.jwt()->>'role','') = 'authenticated' THEN")
merge = replace_once(merge, "    v_effective_tenant := v_auth_tenant;\n    -- Strictly override actor_id with verified auth.uid()", "    IF auth.uid() IS NULL OR NOT COALESCE(public.interior_has_permission('interior:customer:merge', v_auth_tenant, NULL, NULL),false) THEN\n      RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer:merge';\n    END IF;\n    v_effective_tenant := v_auth_tenant;\n    -- Strictly override actor_id with verified auth.uid()")
merge = replace_once(merge, '  v_target public.interior_customers%ROWTYPE;\n', '  v_target public.interior_customers%ROWTYPE;\n  v_merge_log public.interior_customer_merge_logs%ROWTYPE;\n')
# The trusted service path cannot establish an authenticated actor from context.
# Disallow it for this sensitive RPC until a separately authorized server contract exists.
start = merge.index("  ELSIF auth.role() = 'service_role' THEN")
end = merge.index("  ELSE\n    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';", start)
merge = merge[:start] + merge[end:]
merge = replace_once(merge, '  -- 5. Reassign Contacts', "  IF EXISTS (SELECT 1 FROM public.interior_customer_contacts WHERE tenant_id=v_effective_tenant AND customer_id=p_source_customer_id AND is_primary)\n     AND EXISTS (SELECT 1 FROM public.interior_customer_contacts WHERE tenant_id=v_effective_tenant AND customer_id=p_target_customer_id AND is_primary) THEN\n    RAISE EXCEPTION 'CUSTOMER_MERGE_PRIMARY_CONTACT_CONFLICT';\n  END IF;\n  IF EXISTS (SELECT 1 FROM public.interior_customer_addresses WHERE tenant_id=v_effective_tenant AND customer_id=p_source_customer_id AND is_default)\n     AND EXISTS (SELECT 1 FROM public.interior_customer_addresses WHERE tenant_id=v_effective_tenant AND customer_id=p_target_customer_id AND is_default) THEN\n    RAISE EXCEPTION 'CUSTOMER_MERGE_DEFAULT_ADDRESS_CONFLICT';\n  END IF;\n\n  -- 5. Reassign Contacts")
merge = replace_once(merge, '  -- 9. Mark Source Customer as Merged', "  PERFORM set_config('bella.interior.customer_merge','on',true);\n  -- 9. Mark Source Customer as Merged")
merge = replace_once(merge, '    v_addresses_transferred,\n    statement_timestamp()\n  );\n\n  RETURN jsonb_build_object(', '    v_addresses_transferred,\n    statement_timestamp()\n  ) RETURNING * INTO v_merge_log;\n\n  RETURN jsonb_build_object(')
merge = replace_once(merge, "    'canonicalId', p_target_customer_id\n", "    'canonicalId', p_target_customer_id,\n    'mergeLog', to_jsonb(v_merge_log)\n")
marker = '-- HELD: before P2 is promoted,'
p2 = p2[:p2.index(marker)] + merge.rstrip() + ";\nREVOKE ALL ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,service_role,authenticated;\nGRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) TO authenticated;\nINSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES ('OWNER','interior:customer:merge'),('ADMIN','interior:customer:merge') ON CONFLICT DO NOTHING;\n\nCOMMIT;\n"
p2 = replace_once(p2, "IF NOT public.interior_has_permission('interior:customer:create',v_auth_tenant,NULL,NULL) THEN", "IF NOT COALESCE(public.interior_has_permission('interior:customer:create',v_auth_tenant,NULL,NULL),false) THEN")

p3 = body('P3-o4-action-approval.sql.draft')
resolver = (root / 'baseline-interior_resolve_project_id.sql.txt').read_text(encoding='utf-8')
resolver = replace_once(resolver, "    ELSE\n      RETURN NULL;", "    WHEN 'acceptance_session' THEN\n      SELECT project_id INTO v_project_id FROM public.interior_acceptance_sessions WHERE id=p_resource_id AND tenant_id=p_tenant_id;\n    ELSE\n      RETURN NULL;")
p3 = replace_once(p3, '-- Tenant-qualified references preserve the existing ON DELETE CASCADE behavior.', resolver.rstrip() + ';\n\n-- Tenant-qualified references preserve the existing ON DELETE CASCADE behavior.')
p3 = replace_once(p3, 'WHERE c.id IS NULL OR p.id IS NULL)', 'WHERE c.id IS NULL OR p.id IS NULL OR c.project_id IS DISTINCT FROM s.project_id)')
p3 = replace_once(p3, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_sessions_tenant_id_id', 'CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_campaigns_tenant_id_project\n  ON public.interior_acceptance_campaigns(tenant_id,id,project_id);\nCREATE UNIQUE INDEX IF NOT EXISTS uq_interior_acceptance_sessions_tenant_id_id')
p3 = replace_once(p3, "IF NOT public.interior_has_permission('interior:acceptance:approve',v_tenant,v_session.project_id,NULL) THEN", "IF NOT COALESCE(public.interior_has_permission('interior:acceptance:approve',v_tenant,v_session.project_id,NULL),false) THEN")
p3 = replace_once(p3, "IF OLD.approval_status<>'PENDING' AND NEW.approval_notes IS DISTINCT FROM OLD.approval_notes THEN", "IF OLD.approval_status<>'PENDING' AND (NEW.approval_notes IS DISTINCT FROM OLD.approval_notes OR NEW.inspection_result IS DISTINCT FROM OLD.inspection_result) THEN")
p3 = replace_once(p3, "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass\n      AND conname='fk_interior_acceptance_sessions_tenant_project')", "  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass\n      AND conname='fk_interior_acceptance_sessions_campaign_project') THEN\n    ALTER TABLE public.interior_acceptance_sessions ADD CONSTRAINT fk_interior_acceptance_sessions_campaign_project\n      FOREIGN KEY (tenant_id,campaign_id,project_id) REFERENCES public.interior_acceptance_campaigns(tenant_id,id,project_id) ON DELETE CASCADE;\n  END IF;\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.interior_acceptance_sessions'::regclass\n      AND conname='fk_interior_acceptance_sessions_tenant_project')")

p5 = body('P5-timestamp-and-primary-integrity.sql.draft')
p5 = replace_once(p5, '-- HELD:', "REVOKE UPDATE(is_primary) ON TABLE public.interior_customer_contacts FROM authenticated;\nREVOKE UPDATE(is_default) ON TABLE public.interior_customer_addresses FROM authenticated;\n\n-- HELD:")
p5 = p5[:p5.index('-- HELD:')] + (root / 'P5-switch-functions.sql.txt').read_text(encoding='utf-8') + '\nCOMMIT;\n'
for filename, sql in [('P2-review.candidate.sql',p2),('P3-review.candidate.sql',p3),('P5-review.candidate.sql',p5)]:
    (root / filename).write_text('-- REVIEW CANDIDATE ONLY. PRODUCTION WRITE HOLD. DO NOT EXECUTE.\n' + sql, encoding='utf-8')

p2_rollback = r'''-- REVIEW ROLLBACK ONLY. Run only after an explicitly authorized P2 rollback decision.
-- Reopens the Production tenant-only CRM policy baseline. Roll back the matching app release too.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P2 rollback requires a role able to restore postgres-owned functions and catalog objects';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('interior_customers','interior_customer_contacts','interior_customer_addresses'))<>14
     OR EXISTS (WITH expected(tablename,policyname,cmd) AS (VALUES
       ('interior_customers','interior_customers_select','SELECT'),
       ('interior_customers','interior_customers_insert','INSERT'),
       ('interior_customers','interior_customers_update','UPDATE'),
       ('interior_customer_contacts','interior_customer_contacts_select','SELECT'),
       ('interior_customer_contacts','interior_customer_contacts_insert','INSERT'),
       ('interior_customer_contacts','interior_customer_contacts_update','UPDATE'),
       ('interior_customer_contacts','interior_customer_contacts_delete','DELETE'),
       ('interior_customer_addresses','interior_customer_addresses_select','SELECT'),
       ('interior_customer_addresses','interior_customer_addresses_insert','INSERT'),
       ('interior_customer_addresses','interior_customer_addresses_update','UPDATE'),
       ('interior_customer_addresses','interior_customer_addresses_delete','DELETE'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>'PERMISSIVE'
         OR p.roles::text<>'{authenticated}' OR p.cmd<>e.cmd)
     OR EXISTS (WITH expected(tablename,policyname) AS (VALUES
       ('interior_customers','tenant_isolation_policy'),
       ('interior_customer_contacts','tenant_isolation_policy'),
       ('interior_customer_addresses','tenant_isolation_policy'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.permissive<>'RESTRICTIVE' OR p.cmd<>'ALL')
     OR has_table_privilege('authenticated','public.interior_customers','DELETE')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_contacts','is_primary','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_addresses','is_default','UPDATE')
     OR to_regprocedure('public.interior_guard_customer_actor_fields()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname='trg_interior_guard_customer_actor_fields') THEN
    RAISE EXCEPTION 'P2 rollback preconditions do not match the reviewed P2 state';
  END IF;
END
$preflight$;

DROP POLICY IF EXISTS interior_customers_select ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_insert ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_update ON public.interior_customers;
DROP POLICY IF EXISTS interior_customers_delete ON public.interior_customers;
CREATE POLICY interior_customers_select ON public.interior_customers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customers_insert ON public.interior_customers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customers_update ON public.interior_customers AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS interior_customer_contacts_select ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_insert ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_update ON public.interior_customer_contacts;
DROP POLICY IF EXISTS interior_customer_contacts_delete ON public.interior_customer_contacts;
CREATE POLICY interior_customer_contacts_select ON public.interior_customer_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customer_contacts_insert ON public.interior_customer_contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customer_contacts_update ON public.interior_customer_contacts AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY interior_customer_contacts_delete ON public.interior_customer_contacts AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS interior_customer_addresses_select ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_insert ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_update ON public.interior_customer_addresses;
DROP POLICY IF EXISTS interior_customer_addresses_delete ON public.interior_customer_addresses;
CREATE POLICY interior_customer_addresses_select ON public.interior_customer_addresses AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY interior_customer_addresses_insert ON public.interior_customer_addresses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY interior_customer_addresses_update ON public.interior_customer_addresses AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY interior_customer_addresses_delete ON public.interior_customer_addresses AS PERMISSIVE FOR DELETE TO authenticated USING (true);

GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_customers TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.interior_customer_contacts TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.interior_customer_addresses TO authenticated;
REVOKE INSERT(id,tenant_id,code,name,legal_name,tax_code,type,tier,primary_phone,primary_email,notes,assigned_staff_id),
  UPDATE(name,legal_name,tax_code,type,tier,profile_status,primary_phone,primary_email,notes,assigned_staff_id)
  ON TABLE public.interior_customers FROM authenticated;
REVOKE INSERT(tenant_id,customer_id,name,role,phone,email,position,is_primary),
  UPDATE(name,role,phone,email,position,is_primary)
  ON TABLE public.interior_customer_contacts FROM authenticated;
REVOKE INSERT(tenant_id,customer_id,address_type,full_address,ward,district,city,is_default),
  UPDATE(address_type,full_address,ward,district,city,is_default)
  ON TABLE public.interior_customer_addresses FROM authenticated;
DROP TRIGGER IF EXISTS trg_interior_guard_customer_actor_fields ON public.interior_customers;
DROP FUNCTION IF EXISTS public.interior_guard_customer_actor_fields();

-- Captured directly from Production before P2.
--BASELINE_MERGE_FUNCTION
--BASELINE_CODE_FUNCTION
REVOKE ALL ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(uuid,uuid,uuid,text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.interior_generate_customer_code(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_generate_customer_code(uuid) TO authenticated,service_role;

DELETE FROM public.interior_role_permissions WHERE permission_id IN (
  'interior:customer:create','interior:customer:update','interior:customer:merge',
  'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
  'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
  'interior:customer_address:update','interior:customer_address:delete');
DELETE FROM public.interior_permissions WHERE permission_id IN (
  'interior:customer:create','interior:customer:update','interior:customer:merge',
  'interior:customer_contact:read','interior:customer_contact:create','interior:customer_contact:update',
  'interior:customer_contact:delete','interior:customer_address:read','interior:customer_address:create',
  'interior:customer_address:update','interior:customer_address:delete');
COMMIT;
'''
p2_rollback = p2_rollback.replace('--BASELINE_MERGE_FUNCTION',
    (root / 'baseline-interior_execute_customer_merge.sql.txt').read_text(encoding='utf-8').rstrip() + ';')
p2_rollback = p2_rollback.replace('--BASELINE_CODE_FUNCTION',
    (root / 'baseline-interior_generate_customer_code.sql.txt').read_text(encoding='utf-8').rstrip() + ';')
(root / 'P2-rollback.review.sql').write_text(p2_rollback, encoding='utf-8')

p3_rollback = r'''-- REVIEW ROLLBACK ONLY. Run only after an explicitly authorized P3 rollback decision.
-- Restores tenant-only O4 policies and broad authenticated table grants. Business/audit rows are never deleted.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P3 rollback requires a role able to restore postgres-owned functions and catalog objects';
  END IF;
  IF to_regprocedure('public.interior_decide_acceptance_session(uuid,text,text,text)') IS NULL
     OR to_regprocedure('public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)') IS NULL
     OR to_regprocedure('public.interior_user_has_permission(uuid,text,uuid,uuid,uuid)') IS NULL
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (
       'interior_acceptance_campaigns','interior_acceptance_sessions',
       'interior_acceptance_notes','interior_acceptance_evidence_objects'))<>13
     OR EXISTS (WITH expected(tablename,policyname,cmd,permissive) AS (VALUES
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_update','UPDATE','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_update','UPDATE','PERMISSIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_read','SELECT','PERMISSIVE'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.cmd<>e.cmd OR p.permissive<>e.permissive
         OR p.roles::text<>'{authenticated}')
     OR NOT EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id='interior:acceptance_evidence:upload')
     OR NOT EXISTS (SELECT 1 FROM public.interior_role_permissions WHERE permission_id='interior:acceptance_evidence:upload') THEN
    RAISE EXCEPTION 'P3 rollback preconditions do not match the reviewed P3 state';
  END IF;
END
$preflight$;

DROP POLICY IF EXISTS interior_acceptance_campaigns_read ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_create ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_update ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns;
CREATE POLICY interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_sessions_read ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_create ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_update ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions;
CREATE POLICY interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_notes_read ON public.interior_acceptance_notes;
DROP POLICY IF EXISTS interior_acceptance_notes_create ON public.interior_acceptance_notes;
DROP POLICY IF EXISTS interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes;
CREATE POLICY interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_evidence_objects_read ON public.interior_acceptance_evidence_objects;
DROP POLICY IF EXISTS interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects;
CREATE POLICY interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_campaigns TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_notes TO authenticated;
GRANT SELECT,INSERT ON TABLE public.interior_acceptance_evidence_objects TO authenticated;
REVOKE INSERT(id,tenant_id,project_id,campaign_code,campaign_name,description,created_by_user_id),
  UPDATE(campaign_name,description) ON TABLE public.interior_acceptance_campaigns FROM authenticated;
REVOKE INSERT(id,tenant_id,campaign_id,project_id,session_code,session_type,inspection_scope,inspection_date,
  recorder_actor_id,customer_representative,customer_contact,related_boq_item_ids,inspection_result),
  UPDATE(inspection_result,approval_notes) ON TABLE public.interior_acceptance_sessions FROM authenticated;
REVOKE INSERT(id,tenant_id,session_id,category,severity,assessment_status,description,related_boq_item_id,
  remediation_plan,assigned_fixer,target_deadline,remediation_status,routed_entity_type,routed_entity_id,created_by_user_id)
  ON TABLE public.interior_acceptance_notes FROM authenticated;

DROP TRIGGER IF EXISTS trg_interior_guard_acceptance_session_update ON public.interior_acceptance_sessions;
DROP FUNCTION IF EXISTS public.interior_guard_acceptance_session_update();
DROP TRIGGER IF EXISTS trg_interior_acceptance_documentation_status ON public.interior_acceptance_evidence_objects;
DROP FUNCTION IF EXISTS public.interior_recalculate_acceptance_documentation();
DROP FUNCTION IF EXISTS public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer);
DROP FUNCTION IF EXISTS public.interior_user_has_permission(uuid,text,uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.interior_decide_acceptance_session(uuid,text,text,text);

ALTER TABLE public.interior_acceptance_evidence_objects DROP CONSTRAINT IF EXISTS fk_interior_acceptance_evidence_tenant_session;
ALTER TABLE public.interior_acceptance_notes DROP CONSTRAINT IF EXISTS fk_interior_acceptance_notes_tenant_session;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_tenant_project;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_campaign_project;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_tenant_campaign;
ALTER TABLE public.interior_acceptance_campaigns DROP CONSTRAINT IF EXISTS fk_interior_acceptance_campaigns_tenant_project;
DROP INDEX IF EXISTS public.uq_interior_acceptance_sessions_tenant_id_id;
DROP INDEX IF EXISTS public.uq_interior_acceptance_campaigns_tenant_id_project;
DROP INDEX IF EXISTS public.uq_interior_acceptance_campaigns_tenant_id_id;
DROP INDEX IF EXISTS public.uq_interior_projects_tenant_id_id;

-- Restore the captured resolver. No records are rewritten by this rollback.
--BASELINE_PROJECT_RESOLVER

DELETE FROM public.interior_role_permissions WHERE permission_id IN (
  'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
  'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
  'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
  'interior:acceptance_evidence:upload','interior:acceptance:approve');
DELETE FROM public.interior_permissions WHERE permission_id IN (
  'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
  'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
  'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
  'interior:acceptance_evidence:upload','interior:acceptance:approve');

-- Preserve non-empty approval history. The table is dropped only when it has no rows.
DO $preserve_audit$
BEGIN
  IF to_regclass('public.interior_acceptance_approval_audit') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.interior_acceptance_approval_audit) THEN
    DROP TABLE public.interior_acceptance_approval_audit;
  END IF;
END
$preserve_audit$;
COMMIT;
'''
p3_rollback = p3_rollback.replace('--BASELINE_PROJECT_RESOLVER',
    (root / 'baseline-interior_resolve_project_id.sql.txt').read_text(encoding='utf-8').rstrip() + ';')
(root / 'P3-rollback.review.sql').write_text(p3_rollback, encoding='utf-8')
