BEGIN;

-- Product-owned immutable admission intent. No duplicate Student/Enrollment entities.
CREATE SEQUENCE IF NOT EXISTS public.preschool_admission_student_code_seq START WITH 1000000000000;
CREATE TABLE IF NOT EXISTS public.preschool_admission_operations (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  operation_key uuid NOT NULL,
  actor_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  student_code text NOT NULL,
  enrollment_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,operation_key),
  UNIQUE(tenant_id,student_code),
  UNIQUE(tenant_id,enrollment_request_id)
);
ALTER TABLE public.preschool_admission_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preschool_admission_operations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.preschool_admission_student_code_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.preschool_admission_operations TO service_role;

COMMENT ON TABLE public.preschool_admission_operations IS
  'Preschool immutable admission request and stable allocated keys; canonical entities and relations must be read on every resume.';

COMMIT;
