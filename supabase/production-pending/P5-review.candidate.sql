-- REVIEW CANDIDATE ONLY. PRODUCTION WRITE HOLD. DO NOT EXECUTE.
-- Proposed P5 database-owned timestamps and one-primary/default invariants.
-- Recheck counts, grants and trigger/function definitions immediately before promotion.
BEGIN;

DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P5 requires a migration role able to assign reviewed SECURITY DEFINER ownership to postgres';
  END IF;
  IF to_regclass('public.interior_customer_contacts') IS NULL
     OR to_regclass('public.interior_customer_addresses') IS NULL
     OR to_regclass('public.interior_acceptance_campaigns') IS NULL
     OR to_regclass('public.interior_acceptance_sessions') IS NULL
     OR to_regclass('public.interior_acceptance_notes') IS NULL THEN
    RAISE EXCEPTION 'Production timestamp/CRM prerequisites differ from reviewed catalog';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_customer_contacts WHERE is_primary
      GROUP BY tenant_id,customer_id HAVING count(*)>1)
     OR EXISTS (SELECT 1 FROM public.interior_customer_addresses WHERE is_default
      GROUP BY tenant_id,customer_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate primary/default rows require an explicit, non-destructive resolution';
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
  IF EXISTS (
    WITH expected(table_name,expected_acl) AS (VALUES
      ('interior_customer_contacts','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=rd/postgres}'),
      ('interior_customer_addresses','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,bella_developer=r/postgres,bella_migration_executor=arwdDxtm/postgres,verification_executor=r/postgres,authenticated=rd/postgres}')
    )
    SELECT 1 FROM expected e JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name)
    WHERE pg_get_userbyid(c.relowner)<>'postgres' OR c.relacl::text IS DISTINCT FROM e.expected_acl
  ) THEN
    RAISE EXCEPTION 'P5 requires the reviewed P2 grants and operational-role ACLs on contacts and addresses';
  END IF;
  IF has_table_privilege('authenticated','public.interior_customer_contacts','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_contacts','is_primary','UPDATE')
     OR NOT has_column_privilege('authenticated','public.interior_customer_addresses','is_default','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customer_contacts','INSERT')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','INSERT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_contacts','DELETE')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','SELECT')
     OR NOT has_table_privilege('authenticated','public.interior_customer_addresses','DELETE')
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:customer_contact:update') IS DISTINCT FROM ARRAY['ADMIN','OWNER','SALES']::text[]
     OR (SELECT array_agg(role_key::text ORDER BY role_key::text) FROM public.interior_role_permissions
        WHERE permission_id='interior:customer_address:update') IS DISTINCT FROM ARRAY['ADMIN','OWNER','SALES']::text[] THEN
    RAISE EXCEPTION 'P5 requires P2 column-scoped flag grants and CRM update role mappings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.oid='public.interior_acceptance_sessions'::regclass
        AND t.tgname='trg_interior_guard_acceptance_session_update' AND NOT t.tgisinternal
        AND pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_interior_guard_acceptance_session_update BEFORE UPDATE ON public.interior_acceptance_sessions FOR EACH ROW EXECUTE FUNCTION interior_guard_acceptance_session_update()') THEN
    RAISE EXCEPTION 'P5 expects the reviewed P3 acceptance-session guard trigger before adding timestamp triggers';
  END IF;
  IF to_regprocedure('public.interior_crm_touch_updated_at()') IS NOT NULL
     OR to_regprocedure('public.interior_set_primary_contact(uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.interior_set_default_address(uuid,uuid)') IS NOT NULL
     OR to_regclass('public.uq_interior_customer_contacts_one_primary') IS NOT NULL
     OR to_regclass('public.uq_interior_customer_addresses_one_default') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
       'trg_interior_customer_contacts_updated_at',
       'trg_interior_customer_addresses_updated_at',
       'trg_interior_acceptance_campaigns_updated_at',
       'trg_interior_acceptance_sessions_updated_at',
       'trg_interior_acceptance_notes_updated_at'
     )) THEN
    RAISE EXCEPTION 'P5 object name already exists; compare its exact definition before promotion';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.interior_crm_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.interior_crm_touch_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_crm_touch_updated_at() FROM PUBLIC,anon,authenticated,service_role;

DROP TRIGGER IF EXISTS trg_interior_customer_contacts_updated_at ON public.interior_customer_contacts;
CREATE TRIGGER trg_interior_customer_contacts_updated_at
  BEFORE UPDATE ON public.interior_customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_interior_customer_addresses_updated_at ON public.interior_customer_addresses;
CREATE TRIGGER trg_interior_customer_addresses_updated_at
  BEFORE UPDATE ON public.interior_customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_interior_acceptance_campaigns_updated_at ON public.interior_acceptance_campaigns;
CREATE TRIGGER trg_interior_acceptance_campaigns_updated_at
  BEFORE UPDATE ON public.interior_acceptance_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_interior_acceptance_sessions_updated_at ON public.interior_acceptance_sessions;
CREATE TRIGGER trg_interior_acceptance_sessions_updated_at
  BEFORE UPDATE ON public.interior_acceptance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();
DROP TRIGGER IF EXISTS trg_interior_acceptance_notes_updated_at ON public.interior_acceptance_notes;
CREATE TRIGGER trg_interior_acceptance_notes_updated_at
  BEFORE UPDATE ON public.interior_acceptance_notes
  FOR EACH ROW EXECUTE FUNCTION public.interior_crm_touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_customer_contacts_one_primary
  ON public.interior_customer_contacts(tenant_id,customer_id) WHERE is_primary;
CREATE UNIQUE INDEX IF NOT EXISTS uq_interior_customer_addresses_one_default
  ON public.interior_customer_addresses(tenant_id,customer_id) WHERE is_default;

REVOKE UPDATE(is_primary) ON TABLE public.interior_customer_contacts FROM authenticated;
REVOKE UPDATE(is_default) ON TABLE public.interior_customer_addresses FROM authenticated;

-- Explicit switch operations serialize on the parent customer and commit atomically.
-- A NULL target clears the current flag; creation never calls these functions.
CREATE OR REPLACE FUNCTION public.interior_set_primary_contact(p_customer_id uuid,p_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR COALESCE(auth.jwt()->>'role','')<>'authenticated'
     OR NOT COALESCE(public.interior_has_permission('interior:customer_contact:update',v_tenant,NULL,NULL),false) THEN
    RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer_contact:update';
  END IF;
  PERFORM 1 FROM public.interior_customers WHERE id=p_customer_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
  IF p_contact_id IS NOT NULL THEN
    PERFORM 1 FROM public.interior_customer_contacts
      WHERE id=p_contact_id AND tenant_id=v_tenant AND customer_id=p_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_NOT_FOUND'; END IF;
  END IF;
  UPDATE public.interior_customer_contacts
    SET is_primary=false
    WHERE tenant_id=v_tenant AND customer_id=p_customer_id
      AND is_primary AND (p_contact_id IS NULL OR id<>p_contact_id);
  IF p_contact_id IS NOT NULL THEN
    UPDATE public.interior_customer_contacts
      SET is_primary=true
      WHERE id=p_contact_id AND tenant_id=v_tenant AND customer_id=p_customer_id;
  END IF;
END;
$$;
ALTER FUNCTION public.interior_set_primary_contact(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_set_primary_contact(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_set_primary_contact(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.interior_set_default_address(p_customer_id uuid,p_address_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR COALESCE(auth.jwt()->>'role','')<>'authenticated'
     OR NOT COALESCE(public.interior_has_permission('interior:customer_address:update',v_tenant,NULL,NULL),false) THEN
    RAISE EXCEPTION 'INTERIOR_PERMISSION_DENIED: interior:customer_address:update';
  END IF;
  PERFORM 1 FROM public.interior_customers WHERE id=p_customer_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
  IF p_address_id IS NOT NULL THEN
    PERFORM 1 FROM public.interior_customer_addresses
      WHERE id=p_address_id AND tenant_id=v_tenant AND customer_id=p_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ADDRESS_NOT_FOUND'; END IF;
  END IF;
  UPDATE public.interior_customer_addresses
    SET is_default=false
    WHERE tenant_id=v_tenant AND customer_id=p_customer_id
      AND is_default AND (p_address_id IS NULL OR id<>p_address_id);
  IF p_address_id IS NOT NULL THEN
    UPDATE public.interior_customer_addresses
      SET is_default=true
      WHERE id=p_address_id AND tenant_id=v_tenant AND customer_id=p_customer_id;
  END IF;
END;
$$;
ALTER FUNCTION public.interior_set_default_address(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.interior_set_default_address(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_set_default_address(uuid,uuid) TO authenticated;

COMMIT;
