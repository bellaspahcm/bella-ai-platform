-- Profile-only dependency projection for Preschool acceptance.
-- Exact source block: supabase/migrations/20260808000012_create_rule_engine_tables.sql
-- Only the enum is consumed by the canonical Education enrollment migration.
DO $$ BEGIN
  CREATE TYPE platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
