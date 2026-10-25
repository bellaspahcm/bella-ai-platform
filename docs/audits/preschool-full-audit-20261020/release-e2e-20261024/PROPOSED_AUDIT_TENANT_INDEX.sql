-- PROPOSED / NOT_AUTHORIZED: E2E bmnbqbcdbuklhopfbopv only.
-- Source: supabase/migrations/20260514000001_audit_logs.sql line16.
-- No table/ACL/RLS/trigger/row change. Default ROLLBACK; review/rehearsal before COMMIT.
BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='50s';
DO $pre$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR to_regclass('public.idx_audit_logs_tenant_id') IS NOT NULL THEN RAISE EXCEPTION 'AUDIT_INDEX_BASELINE_OR_TARGET_DRIFT'; END IF; END $pre$;
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
DO $post$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.oid='public.idx_audit_logs_tenant_id'::regclass AND i.indrelid='public.audit_logs'::regclass AND i.indisvalid AND i.indisready AND NOT i.indisunique AND pg_get_indexdef(c.oid)='CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id)') THEN RAISE EXCEPTION 'AUDIT_INDEX_POSTCONDITION_FAILED'; END IF; END $post$;
SELECT 'CANONICAL_AUDIT_TENANT_INDEX_POST_PASS' result; ROLLBACK;
