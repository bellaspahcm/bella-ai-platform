-- REVIEW DRAFT ONLY. Not approved/applied. Explicit EMPTY E2E canonical-only profile.
-- This is NOT a Production migration and does NOT claim legacy compatibility proof.
-- It never maps legacy course_id to courses.id or adds a shadow legacy course.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
BEGIN
  IF to_regclass('public.teacher_assignments') IS NOT NULL
    OR to_regclass('public.courses') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.courses'::regclass AND attname='id'
        AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='public.courses'::regclass AND attname='course_id' AND NOT attisdropped)
  THEN RAISE EXCEPTION 'TEACHER_EMPTY_E2E_PROFILE_REQUIRED'; END IF;
END $$;
CREATE TABLE public.teacher_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_id uuid NULL,
  canonical_course_id uuid NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  teacher_party_id uuid NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK(role IN('lead_teacher','co_teacher','assistant','substitute')),
  academic_year text NOT NULL,
  effective_start_date date NOT NULL,
  effective_end_date date NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT teacher_assignments_one_course_identity CHECK(num_nonnulls(course_id,canonical_course_id)=1),
  CONSTRAINT teacher_assignments_e2e_legacy_unavailable CHECK(course_id IS NULL),
  CONSTRAINT teacher_assignments_dates_check CHECK(effective_end_date IS NULL OR effective_end_date>=effective_start_date)
);
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_assignments FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.teacher_assignments IS
  'Existing Education assignment aggregate storage; this EMPTY E2E profile supports canonical_course_id only. Legacy course_id writes deliberately unavailable, never aliased to courses.id.';
COMMIT;
