-- Enforce the canonical assignment lifecycle invariant identified in independent SQL review.
-- This applies only to rows using the Preschool canonical course namespace; legacy rows are unchanged.
-- Scope: clean disposable local/E2E provisioning only; no shared or Production database apply.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
LOCK TABLE public.teacher_assignments IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regclass('public.teacher_assignments') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.teacher_assignments'::regclass
        AND attname='canonical_course_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.teacher_assignments'::regclass
        AND attname='canonical_teacher_confirmation_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_CANONICAL_PROFILE_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.teacher_assignments
    WHERE canonical_course_id IS NOT NULL AND status='terminated' AND effective_end_date IS NULL)
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_TERMINATION_DATE_REVIEW_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.teacher_assignments'::regclass
      AND conname='teacher_assignments_canonical_termination_end_date_required')
  THEN RAISE EXCEPTION 'PRESCHOOL_TEACHER_TERMINATION_GUARD_ALREADY_PRESENT'; END IF;
END $$;

ALTER TABLE public.teacher_assignments
  ADD CONSTRAINT teacher_assignments_canonical_termination_end_date_required
  CHECK (canonical_course_id IS NULL OR status <> 'terminated' OR effective_end_date IS NOT NULL);
COMMENT ON CONSTRAINT teacher_assignments_canonical_termination_end_date_required
  ON public.teacher_assignments IS
  'Canonical Preschool assignments retain an explicit end date when terminated; legacy assignment rows are unaffected.';

COMMIT;
