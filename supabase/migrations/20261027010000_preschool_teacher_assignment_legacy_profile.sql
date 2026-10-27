-- Owner-approved forward provisioning for the existing legacy teacher_assignments profile.
-- Source SQL: implementation-artifacts/preschool-classroom-operations/teacher-design/010-existing-legacy-expand.sql
-- Scope: clean disposable local/E2E provisioning only; no shared or Production database apply.
-- Run only after actual FK/ACL/policy/index/data fingerprint review; OpenAPI is insufficient.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE v_local smallint; v_remote smallint;
BEGIN
  IF to_regclass('public.teacher_assignments') IS NULL
     OR to_regclass('public.courses') IS NULL THEN
    RAISE EXCEPTION 'TEACHER_EXISTING_LEGACY_PROFILE_REQUIRED';
  END IF;
  SELECT attnum INTO v_local FROM pg_catalog.pg_attribute
    WHERE attrelid='public.teacher_assignments'::regclass AND attname='course_id'
      AND atttypid='uuid'::regtype AND NOT attisdropped;
  SELECT attnum INTO v_remote FROM pg_catalog.pg_attribute
    WHERE attrelid='public.courses'::regclass AND attname='course_id'
      AND atttypid='uuid'::regtype AND NOT attisdropped;
  IF v_local IS NULL OR v_remote IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid='public.teacher_assignments'::regclass
      AND c.confrelid='public.courses'::regclass AND c.contype='f'
      AND c.conkey=ARRAY[v_local] AND c.confkey=ARRAY[v_remote] AND c.convalidated
  ) THEN RAISE EXCEPTION 'TEACHER_LEGACY_FK_PROFILE_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.teacher_assignments'::regclass
      AND attname='canonical_course_id' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'TEACHER_ALREADY_EXPANDED_REVIEW_HISTORY'; END IF;
  IF EXISTS (SELECT 1 FROM public.teacher_assignments
    WHERE course_id IS NULL OR tenant_id IS NULL OR teacher_party_id IS NULL)
  THEN RAISE EXCEPTION 'TEACHER_EXISTING_IDENTITY_INVALID'; END IF;
END $$;

LOCK TABLE public.teacher_assignments IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.teacher_assignments ADD COLUMN canonical_course_id uuid NULL
  REFERENCES public.edu_courses(id) ON DELETE RESTRICT;
ALTER TABLE public.teacher_assignments ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.teacher_assignments ADD CONSTRAINT teacher_assignments_one_course_identity
  CHECK (num_nonnulls(course_id,canonical_course_id)=1);
-- Existing legacy FK, ACL and indexes are deliberately untouched.
COMMIT;
