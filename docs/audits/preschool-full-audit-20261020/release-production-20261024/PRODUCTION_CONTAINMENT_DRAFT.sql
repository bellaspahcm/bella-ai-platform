-- PROPOSED / NOT_AUTHORIZED / NOT_READY_FOR_EXECUTION.
-- Exact Production target lvnvkpyxtuilhrabtlwv; not E2E SQL replay.
-- Prepared from fresh read-only Production metadata 2026-10-24T01:28:23.311Z.
-- Source security reconciliation, restore proof and Human GO remain missing.
-- Unconditional hold precedes every DDL statement. There is no apply runner.
BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; SET LOCAL search_path=pg_catalog,public;
DO $not_authorized$ BEGIN RAISE EXCEPTION 'PRESCHOOL_PRODUCTION_DRAFT_NOT_AUTHORIZED_OR_COMPLETE'; END $not_authorized$;
REVOKE ALL PRIVILEGES ON TABLE public."edu_attendance" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."edu_courses" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."edu_daily_care_records" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."edu_daily_care_sessions" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."edu_enrollments" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."party_parties" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."party_relationships" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."tenants" FROM anon,PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."users" FROM anon,PUBLIC;
REVOKE TRUNCATE ON TABLE public."edu_attendance" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."edu_courses" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."edu_daily_care_records" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."edu_daily_care_sessions" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."edu_enrollments" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."org_units" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."party_parties" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."party_relationships" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."students" FROM authenticated;
REVOKE TRUNCATE ON TABLE public."tenants" FROM authenticated;
-- No non-anonymous grants other than authenticated TRUNCATE may be removed by this module.
-- Static direct ACL revokes do not prove effective privileges or authenticated compatibility.
ROLLBACK;
