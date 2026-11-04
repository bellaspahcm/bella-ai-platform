-- ============================================================================
-- BELLA PRESCHOOL OS: CURRICULUM, LESSON PLANS & SUBJECTS SCHEMA
-- Migration: 20261031163000_preschool_curriculum_and_lesson_plans.sql
-- Description:
--   1. edu_curriculums: Master institutional educational frameworks & subject catalogs
--   2. edu_lesson_plans: Structured daily & weekly lesson plans with objectives, materials,
--      and multi-step activity procedures per class / subject domain
--   3. Row Level Security & Indexes for Gate 0 / P0 Tenant Isolation
-- ============================================================================

BEGIN;

-- 1. Curriculums & Subject Frameworks Master
CREATE TABLE IF NOT EXISTS public.edu_curriculums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    age_group VARCHAR(50) NOT NULL DEFAULT 'ALL', -- ALL, NURSERY, TODDLER, KINDY_1, KINDY_2
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    total_weeks INT NOT NULL DEFAULT 35,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    subjects_payload JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_curriculum_code UNIQUE (tenant_id, code)
);

-- 2. Lesson Plans Master
CREATE TABLE IF NOT EXISTS public.edu_lesson_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    curriculum_id UUID REFERENCES public.edu_curriculums(id) ON DELETE SET NULL,
    course_id UUID REFERENCES public.edu_courses(id) ON DELETE SET NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    week_number INT NOT NULL,
    year INT NOT NULL DEFAULT 2026,
    age_group VARCHAR(50) NOT NULL DEFAULT 'ALL',
    theme VARCHAR(255) NOT NULL,
    subject_domain VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    planned_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    objectives_payload JSONB DEFAULT '{"knowledge": "", "skills": "", "attitude": ""}'::jsonb,
    materials TEXT,
    activity_steps_payload JSONB DEFAULT '[]'::jsonb,
    teacher_notes TEXT,
    created_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Performance Indexes
-- zero-downtime: allow blocking-index - New table created in this same migration; no existing data or concurrent writes at migration time
CREATE INDEX IF NOT EXISTS idx_edu_curriculums_lookup
    ON public.edu_curriculums(tenant_id, status, academic_year);

-- zero-downtime: allow blocking-index - New table created in this same migration; no existing data or concurrent writes at migration time
CREATE INDEX IF NOT EXISTS idx_edu_lesson_plans_lookup
    ON public.edu_lesson_plans(tenant_id, year, week_number, status);

-- zero-downtime: allow blocking-index - New table created in this same migration; no existing data or concurrent writes at migration time
CREATE INDEX IF NOT EXISTS idx_edu_lesson_plans_class_date
    ON public.edu_lesson_plans(tenant_id, course_id, planned_date);

-- 4. Row Level Security (Tenant Isolation Guard - Gate 0 / P0)
ALTER TABLE public.edu_curriculums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_lesson_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_curriculums') THEN
        CREATE POLICY tenant_isolation_edu_curriculums ON public.edu_curriculums
        FOR ALL USING (
            tenant_id = public.get_auth_tenant_id()
            OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
            OR current_setting('role', true) = 'service_role'
        )
        WITH CHECK (
            tenant_id = public.get_auth_tenant_id()
            OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
            OR current_setting('role', true) = 'service_role'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_lesson_plans') THEN
        CREATE POLICY tenant_isolation_edu_lesson_plans ON public.edu_lesson_plans
        FOR ALL USING (
            tenant_id = public.get_auth_tenant_id()
            OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
            OR current_setting('role', true) = 'service_role'
        )
        WITH CHECK (
            tenant_id = public.get_auth_tenant_id()
            OR tenant_id = (current_setting('app.current_tenant_id', true))::uuid
            OR current_setting('role', true) = 'service_role'
        );
    END IF;
END $$;

COMMIT;

