-- PROPOSED / NOT_AUTHORIZED: only E2E bmnbqbcdbuklhopfbopv.
-- Remove only the exact owned, non-constraint canonical index, after target and
-- before/after metadata have been pinned by the approved runner.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $exact_owned_index$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
 OR NOT EXISTS (
  SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
  WHERE c.oid=to_regclass('public.idx_audit_logs_tenant_id')
   AND i.indrelid='public.audit_logs'::regclass AND i.indisvalid
   AND i.indisready AND NOT i.indisunique AND c.relowner='postgres'::regrole
   AND pg_get_indexdef(c.oid)='CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id)'
   AND NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=c.oid)
 ) THEN RAISE EXCEPTION 'AUDIT_INDEX_RECOVERY_DRIFT'; END IF;
END $exact_owned_index$;
DROP INDEX public.idx_audit_logs_tenant_id;
DO $absent$ BEGIN
 IF to_regclass('public.idx_audit_logs_tenant_id') IS NOT NULL
 THEN RAISE EXCEPTION 'AUDIT_INDEX_RECOVERY_FAILED'; END IF;
END $absent$;
SELECT 'EXACT_AUDIT_INDEX_REMOVAL_PASS' result;
ROLLBACK;
