-- ============================================================
-- BELLA Interior Commercial — M1 Deployment Wrapper (Option D)
-- Final Audit Version
-- ============================================================
-- Migration:  20261113165251_interior_commercial_transaction_engine.sql
-- Strategy:   Wrapper Transaction — atomic apply M1 + restore M12 + restore M13
-- Author:     Deployment Agent (AI-assisted)
-- Date:       2026-11-15
-- Status:     PENDING OWNER DEPLOYMENT APPROVAL — DO NOT EXECUTE ON PRODUCTION
-- Production: lvnvkpyxtuilhrabtlwv (ap-southeast-1)
-- ============================================================
-- SOURCE CHECKSUMS (SHA-256, computed 2026-11-15T21:01 +07:00):
--   M1  (20261113165251): 3CC7F26E293746BF337DDA8FA75A6EE690CB1BEBC0C0132659865BF67F0663FB
--   M12 (20261115020234): DAF3D18CC39516A4235FBC5C233C64D43D18BAAA57BF79A3ACE5FFD1D457F0DC
--   M13 (20261115021131): 34B4912BB46B32CD201CA5E73ED4890354B31176BE853FA56B6707725ED1CD54
-- SOURCE LINE COUNTS:
--   M1:  1996 lines, 91855 bytes
--   M12:  255 lines, 12671 bytes
--   M13:   91 lines,  4854 bytes
-- ============================================================
-- EXECUTION INSTRUCTIONS:
--   Execute this ENTIRE file in a single psql session:
--     psql "$DATABASE_URL" \
--       --set ON_ERROR_STOP=on \
--       --file=supabase/scripts/m1_wrapper_window_b.sql \
--       2>&1 | tee m1_window_b_$(date +%Y%m%dT%H%M%S).log
--   DO NOT split across multiple execute_sql calls.
-- ROLLBACK GUARANTEE:
--   lock_timeout=5s, statement_timeout=120s, ON_ERROR_STOP
--   Any RAISE EXCEPTION → entire transaction rolls back
--   COMMIT only reached if ALL sections succeed
-- PRE-FLIGHT CHECKLIST (complete before psql execution):
--   [ ] Production backup taken within last 24 hours
--   [ ] Maintenance window active, no application traffic
--   [ ] DATABASE_URL is for project lvnvkpyxtuilhrabtlwv
--   [ ] Confirm M1 not in supabase_migrations.schema_migrations
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
