-- E2E only bmnbqbcdbuklhopfbopv; guarded recovery to original FK only.
-- Executor owns target/baseline guards, transaction, rehearsal and recovery.
ALTER TABLE public.timeline_events
  DROP CONSTRAINT timeline_events_primary_party_id_fkey,
  ADD CONSTRAINT timeline_events_primary_party_id_fkey
    FOREIGN KEY (primary_party_id) REFERENCES public.party_parties(id) ON DELETE CASCADE;
