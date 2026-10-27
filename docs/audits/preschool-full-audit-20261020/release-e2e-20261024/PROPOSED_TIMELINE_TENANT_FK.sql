-- PROPOSED / NOT_AUTHORIZED. E2E bmnbqbcdbuklhopfbopv only.
-- One owning-scope decision: preserve immutable Timeline on tenant deletion.
-- No rule/trigger/row/ACL/function or other FK change. Default ROLLBACK.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $before$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'EXACT_E2E_DATABASE_ROLE_REQUIRED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.timeline_events'::regclass
   AND conname='timeline_events_tenant_id_fkey'
   AND pg_get_constraintdef(oid,true)='FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'
   AND convalidated AND NOT condeferrable AND NOT condeferred)
 OR NOT EXISTS(SELECT 1 FROM pg_rewrite
  WHERE ev_class='public.timeline_events'::regclass AND rulename='timeline_events_no_delete'
   AND pg_get_ruledef(oid)=E'CREATE RULE timeline_events_no_delete AS\n    ON DELETE TO public.timeline_events DO INSTEAD NOTHING;')
 THEN RAISE EXCEPTION 'EXACT_TIMELINE_RECOVERY_BASELINE_REQUIRED'; END IF;
END $before$;
ALTER TABLE public.timeline_events DROP CONSTRAINT timeline_events_tenant_id_fkey;
ALTER TABLE public.timeline_events ADD CONSTRAINT timeline_events_tenant_id_fkey
 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
DO $after$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.timeline_events'::regclass
   AND conname='timeline_events_tenant_id_fkey'
   AND pg_get_constraintdef(oid,true)='FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT'
   AND convalidated AND NOT condeferrable AND NOT condeferred)
 THEN RAISE EXCEPTION 'TIMELINE_RESTRICT_POSTCONDITION_FAILED'; END IF;
END $after$;
SELECT 'PROPOSED_TIMELINE_TENANT_RESTRICT_POST_PASS' result;
ROLLBACK;
