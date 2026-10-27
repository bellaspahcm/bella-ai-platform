-- Profile-only projection of the source-traced post-R3 schema required by the
-- Preschool roster caller. This is not the R3 data migration and does not claim
-- that migration 20260912000000 ran.
-- Source: supabase/migrations/20260912000000_r3_education_identity_cutover.sql
-- Exact source sections: R3.1 (nullable column), R3.4 (RESTRICT FK), R3.8 (index).
-- Excluded: 848-row sealed-mapping preflight/backfill and all data assertions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'party_id'
  ) THEN
    ALTER TABLE students ADD COLUMN party_id UUID;
    RAISE NOTICE 'Profile projection: added nullable students.party_id';
  ELSE
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_STUDENTS_PARTY_ID_ALREADY_PRESENT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'students'
      AND constraint_name = 'students_party_id_fkey'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_party_id_fkey
      FOREIGN KEY (party_id)
      REFERENCES party_parties(id)
      ON DELETE RESTRICT;
  ELSE
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_STUDENTS_PARTY_FK_ALREADY_PRESENT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND indexname = 'idx_students_party_id'
  ) THEN
    CREATE INDEX idx_students_party_id ON students(party_id);
  ELSE
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_STUDENTS_PARTY_INDEX_ALREADY_PRESENT';
  END IF;
END $$;
