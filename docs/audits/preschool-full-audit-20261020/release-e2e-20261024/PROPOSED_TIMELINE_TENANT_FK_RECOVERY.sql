-- PROPOSED / NOT_AUTHORIZED. Only exact E2E FK, preserving original CASCADE.
-- Full Timeline metadata pin must be checked by the separately reviewed runner.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $before$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.timeline_events'::regclass
   AND conname='timeline_events_tenant_id_fkey'
   AND pg_get_constraintdef(oid,true)='FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT'
   AND convalidated AND NOT condeferrable AND NOT condeferred)
 THEN RAISE EXCEPTION 'EXACT_TIMELINE_RECOVERY_POST_STATE_REQUIRED'; END IF;
END $before$;
ALTER TABLE public.timeline_events DROP CONSTRAINT timeline_events_tenant_id_fkey;
ALTER TABLE public.timeline_events ADD CONSTRAINT timeline_events_tenant_id_fkey
 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
DO $after$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.timeline_events'::regclass
   AND conname='timeline_events_tenant_id_fkey'
   AND pg_get_constraintdef(oid,true)='FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'
   AND convalidated AND NOT condeferrable AND NOT condeferred)
 THEN RAISE EXCEPTION 'TIMELINE_EXACT_FK_RECOVERY_FAILED'; END IF;
END $after$;
SELECT 'TIMELINE_TENANT_FK_EXACT_RECOVERY_PASS' result;
ROLLBACK;
