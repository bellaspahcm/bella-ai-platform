-- REVIEW ONLY. Restores schema objects introduced by P5; does not restore data.
-- Apply only after checking the objects still match P5 and recording any changes.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P5 rollback requires a role able to remove postgres-owned functions and catalog objects';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND t.tgfoid='public.interior_crm_touch_updated_at()'::regprocedure
        AND t.tgtype=19 AND t.tgenabled='O'
        AND (c.relname,t.tgname) IN (
          ('interior_customer_contacts','trg_interior_customer_contacts_updated_at'),
          ('interior_customer_addresses','trg_interior_customer_addresses_updated_at'),
          ('interior_acceptance_campaigns','trg_interior_acceptance_campaigns_updated_at'),
          ('interior_acceptance_sessions','trg_interior_acceptance_sessions_updated_at'),
          ('interior_acceptance_notes','trg_interior_acceptance_notes_updated_at')) )<>5
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_crm_touch_updated_at()'::regprocedure
        AND proowner='postgres'::regrole AND NOT prosecdef
        AND NOT has_function_privilege('authenticated',oid,'EXECUTE')
        AND NOT has_function_privilege('anon',oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',oid,'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'))
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_set_primary_contact(uuid,uuid)'::regprocedure
        AND proowner='postgres'::regrole AND prosecdef
        AND proconfig @> ARRAY['search_path=""']::text[]
        AND has_function_privilege('authenticated',oid,'EXECUTE')
        AND NOT has_function_privilege('anon',oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',oid,'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'))
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.interior_set_default_address(uuid,uuid)'::regprocedure
        AND proowner='postgres'::regrole AND prosecdef
        AND proconfig @> ARRAY['search_path=""']::text[]
        AND has_function_privilege('authenticated',oid,'EXECUTE')
        AND NOT has_function_privilege('anon',oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',oid,'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE')) THEN
    RAISE EXCEPTION 'P5 rollback objects differ from the reviewed candidate; compare current definitions before proceeding';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i
      WHERE i.indexrelid='public.uq_interior_customer_contacts_one_primary'::regclass
        AND i.indisunique AND i.indisvalid AND i.indpred IS NOT NULL
        AND pg_get_expr(i.indpred,i.indrelid)='is_primary'
        AND pg_get_indexdef(i.indexrelid) LIKE '%(tenant_id, customer_id)%')
     OR NOT EXISTS (SELECT 1 FROM pg_index i
      WHERE i.indexrelid='public.uq_interior_customer_addresses_one_default'::regclass
        AND i.indisunique AND i.indisvalid AND i.indpred IS NOT NULL
        AND pg_get_expr(i.indpred,i.indrelid)='is_default'
        AND pg_get_indexdef(i.indexrelid) LIKE '%(tenant_id, customer_id)%') THEN
    RAISE EXCEPTION 'P5 primary/default indexes differ from the reviewed candidate';
  END IF;
  IF has_table_privilege('authenticated','public.interior_customer_contacts','UPDATE')
     OR has_table_privilege('authenticated','public.interior_customer_addresses','UPDATE')
     OR has_column_privilege('authenticated','public.interior_customer_contacts','is_primary','UPDATE')
     OR has_column_privilege('authenticated','public.interior_customer_addresses','is_default','UPDATE') THEN
    RAISE EXCEPTION 'P5 rollback requires the post-P5 narrowed flag grants; reconcile application release and live ACL first';
  END IF;
END
$preflight$;

-- These column grants assume P2 remains in effect. Reconcile live ACLs first.
GRANT UPDATE(is_primary) ON TABLE public.interior_customer_contacts TO authenticated;
GRANT UPDATE(is_default) ON TABLE public.interior_customer_addresses TO authenticated;
DROP FUNCTION IF EXISTS public.interior_set_primary_contact(uuid,uuid);
DROP FUNCTION IF EXISTS public.interior_set_default_address(uuid,uuid);
DROP TRIGGER IF EXISTS trg_interior_customer_contacts_updated_at ON public.interior_customer_contacts;
DROP TRIGGER IF EXISTS trg_interior_customer_addresses_updated_at ON public.interior_customer_addresses;
DROP TRIGGER IF EXISTS trg_interior_acceptance_campaigns_updated_at ON public.interior_acceptance_campaigns;
DROP TRIGGER IF EXISTS trg_interior_acceptance_sessions_updated_at ON public.interior_acceptance_sessions;
DROP TRIGGER IF EXISTS trg_interior_acceptance_notes_updated_at ON public.interior_acceptance_notes;
DROP FUNCTION IF EXISTS public.interior_crm_touch_updated_at();
DROP INDEX IF EXISTS public.uq_interior_customer_contacts_one_primary;
DROP INDEX IF EXISTS public.uq_interior_customer_addresses_one_default;
COMMIT;
