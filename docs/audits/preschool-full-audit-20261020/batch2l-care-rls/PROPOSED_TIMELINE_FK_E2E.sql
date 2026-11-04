-- REVIEW-ONLY, NOT AUTHORIZED. Wrapper must obtain distinct owner scope.
-- Exact target bmnbqbcdbuklhopfbopv; never production.
-- Default ROLLBACK. A reviewed executor must separately prove target, snapshots,
-- rehearsal, empty/linked-party behavior, drift guards and recovery before commit.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $proposal$
DECLARE
  rules_before jsonb;
BEGIN
  IF current_setting('app.bella_timeline_fk_scope', true)
      IS DISTINCT FROM 'APPROVED_E2E_BMNB_TIMELINE_FK_RESTRICT_ONLY' THEN
    RAISE EXCEPTION 'SEPARATE_TIMELINE_E2E_SCOPE_REQUIRED';
  END IF;
  LOCK TABLE public.party_parties, public.timeline_events IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.timeline_events'::regclass
      AND conname = 'timeline_events_primary_party_id_fkey'
      AND convalidated AND NOT condeferrable
      AND pg_get_constraintdef(oid, true) =
        'FOREIGN KEY (primary_party_id) REFERENCES party_parties(id) ON DELETE CASCADE'
  ) THEN RAISE EXCEPTION 'TIMELINE_FK_BASELINE_DRIFT'; END IF;
  SELECT jsonb_agg(jsonb_build_object('name', rulename, 'definition', definition)
    ORDER BY rulename) INTO rules_before
  FROM pg_rules WHERE schemaname='public' AND tablename='timeline_events';
  IF (SELECT count(*) FROM pg_rules WHERE schemaname='public'
      AND tablename='timeline_events'
      AND rulename IN ('timeline_events_no_update','timeline_events_no_delete')) <> 2
  THEN RAISE EXCEPTION 'TIMELINE_IMMUTABILITY_BASELINE_MISSING'; END IF;
  ALTER TABLE public.timeline_events
    DROP CONSTRAINT timeline_events_primary_party_id_fkey,
    ADD CONSTRAINT timeline_events_primary_party_id_fkey
      FOREIGN KEY (primary_party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT;
  IF (SELECT jsonb_agg(jsonb_build_object('name', rulename, 'definition', definition)
        ORDER BY rulename) FROM pg_rules
      WHERE schemaname='public' AND tablename='timeline_events') IS DISTINCT FROM rules_before
  THEN RAISE EXCEPTION 'TIMELINE_IMMUTABILITY_CHANGED'; END IF;
END
$proposal$;
ROLLBACK;
