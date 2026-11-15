

-- ══════════════════════════════════════════════════════════════
-- SECTION 0: Pre-flight assertions
-- ══════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- 0a. Double-apply guard
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261113165251') THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M1 (20261113165251) already in ledger. Double-apply prevented.';
  END IF;
  -- 0b. M12 must exist on Production
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='interior_create_quotation_snapshot') THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: interior_create_quotation_snapshot not found. Unexpected state.';
  END IF;
  -- 0c. M13 must exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='interior_create_customer_approval_request') THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: interior_create_customer_approval_request not found. Unexpected state.';
  END IF;
  -- 0d. M12 in ledger
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261115020234') THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M12 (20261115020234) not in ledger. Apply history inconsistent.';
  END IF;
  -- 0e. M13 in ledger
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261115021131') THEN
    RAISE EXCEPTION 'WRAPPER_ABORT: M13 (20261115021131) not in ledger. Apply history inconsistent.';
  END IF;
  RAISE NOTICE 'SECTION 0 PASS: pre-flight OK at %', clock_timestamp();
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Apply M1 verbatim
-- Source: 20261113165251_interior_commercial_transaction_engine.sql
-- SHA-256: 3CC7F26E293746BF337DDA8FA75A6EE690CB1BEBC0C0132659865BF67F0663FB
-- 1996 lines | 91855 bytes
-- After this section: interior_create_quotation_snapshot and
-- interior_create_customer_approval_request temporarily at M1 (old) version.
-- Section 2+3 immediately restore them.
-- ══════════════════════════════════════════════════════════════
