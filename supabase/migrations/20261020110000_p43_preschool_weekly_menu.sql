-- ============================================================================
-- BELLA PRESCHOOL OS: P4.3 PREVIEW & MASTER WEEKLY NUTRITION MENU SCHEMA
-- Migration: 20261020110000_p43_preschool_weekly_menu.sql
-- Description:
--   1. edu_weekly_menus: Canonical institutional weekly nutrition menus per tenant/week
--   2. edu_weekly_menu_days: Granular daily breakdown (Mon-Fri) with meals and calories
--   3. Row Level Security & Indexes for tenant isolation (Gate 0 / P0)
-- ============================================================================

-- 1. Weekly Menus Master
CREATE TABLE IF NOT EXISTS public.edu_weekly_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    week_number INT NOT NULL,
    year INT NOT NULL DEFAULT 2026,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    age_group VARCHAR(50) NOT NULL DEFAULT 'ALL', -- ALL, NURSERY, TODDLER, KINDY_1, KINDY_2
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    notes TEXT,
    created_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_weekly_menu UNIQUE (tenant_id, year, week_number, age_group)
);

-- 2. Weekly Menu Daily Breakdown
CREATE TABLE IF NOT EXISTS public.edu_weekly_menu_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES public.edu_weekly_menus(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')),
    menu_date DATE NOT NULL,
    summary_dishes TEXT NOT NULL,
    calories_kcal INT DEFAULT 650,
    meals_payload JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_menu_day UNIQUE (tenant_id, menu_id, day_of_week)
);

-- 3. High Performance Indexes
-- zero-downtime: allow blocking-index - new empty table, no existing rows, lock contention impossible
CREATE INDEX IF NOT EXISTS idx_edu_weekly_menus_tenant_lookup 
    ON public.edu_weekly_menus(tenant_id, year, week_number, status);

-- zero-downtime: allow blocking-index - new empty table, no existing rows, lock contention impossible
CREATE INDEX IF NOT EXISTS idx_edu_weekly_menu_days_lookup 
    ON public.edu_weekly_menu_days(tenant_id, menu_id, menu_date);

-- 4. Row Level Security (Tenant Isolation Guard - Gate 0 / P0)
ALTER TABLE public.edu_weekly_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_weekly_menu_days ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_weekly_menus') THEN
        CREATE POLICY tenant_isolation_edu_weekly_menus ON public.edu_weekly_menus 
        FOR ALL USING (
            tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid 
            OR current_setting('role', true) = 'service_role'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_weekly_menu_days') THEN
        CREATE POLICY tenant_isolation_edu_weekly_menu_days ON public.edu_weekly_menu_days 
        FOR ALL USING (
            tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid 
            OR current_setting('role', true) = 'service_role'
        );
    END IF;
END $$;
