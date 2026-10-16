-- ============================================================================
-- Policy registry user identity forward migration
-- Scope: AutoMove active global accounting policy resolution only.
-- Non-goals: no public.profiles compatibility table, no policy_history lifecycle,
-- no Finance ledger posting, no tenant-specific policy assignment.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'policy_registry forward migration requires public.users as canonical actor identity.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  tenant_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  parent_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID,
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  owner_department TEXT,
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_decisions INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  avg_confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_decision_at TIMESTAMPTZ
);

ALTER TABLE public.policy_registry
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS policy_id TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_version TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID,
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS owner_department TEXT,
  ADD COLUMN IF NOT EXISTS business_owner TEXT,
  ADD COLUMN IF NOT EXISTS business_owner_email TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner_email TEXT,
  ADD COLUMN IF NOT EXISTS review_date DATE,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS expire_date DATE,
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_decisions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_approvals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rejections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_confidence NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_decision_at TIMESTAMPTZ;

DO $$
DECLARE
  legacy_profile_fk TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT constraint_info.conname
      INTO legacy_profile_fk
      FROM pg_constraint constraint_info
     WHERE constraint_info.conrelid = 'public.policy_registry'::regclass
       AND constraint_info.confrelid = 'public.profiles'::regclass
       AND constraint_info.contype = 'f'
     LIMIT 1;

    IF legacy_profile_fk IS NOT NULL THEN
      RAISE EXCEPTION 'policy_registry still has legacy public.profiles foreign key %. Resolve identity ownership before applying this forward migration.', legacy_profile_fk;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_pkey'
  ) THEN
    ALTER TABLE public.policy_registry ADD CONSTRAINT policy_registry_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND contype = 'u'
       AND conkey = ARRAY[
         (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.policy_registry'::regclass AND attname = 'policy_id'),
         (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.policy_registry'::regclass AND attname = 'version')
       ]::int2[]
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_policy_version_key UNIQUE (policy_id, version);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_status_check'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_status_check
      CHECK (status IN ('draft', 'active', 'deprecated', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_version_check'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_version_check
      CHECK (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_created_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_created_by_users_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_updated_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_updated_by_users_fkey
      FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_published_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_published_by_users_fkey
      FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.policy_registry'::regclass
       AND conname = 'policy_registry_deleted_by_users_fkey'
  ) THEN
    ALTER TABLE public.policy_registry
      ADD CONSTRAINT policy_registry_deleted_by_users_fkey
      FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- zero-downtime: allow blocking-index - new forward-compatible registry lookup index for additive table
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_registry_one_active
  ON public.policy_registry (policy_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- zero-downtime: allow blocking-index - new forward-compatible active policy lookup index for additive table
CREATE INDEX IF NOT EXISTS idx_policy_registry_active_lookup
  ON public.policy_registry (policy_id, effective_date, expire_date)
  WHERE status = 'active' AND is_active = true AND deleted_at IS NULL;

ALTER TABLE public.policy_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'policy_registry'
       AND policyname = 'policy_registry_read_active_global_accounting_policy'
  ) THEN
    CREATE POLICY "policy_registry_read_active_global_accounting_policy"
      ON public.policy_registry
      FOR SELECT TO authenticated
      USING (
        tenant_id IS NULL
        AND status = 'active'
        AND is_active = true
        AND deleted_at IS NULL
      );
  END IF;
END $$;

REVOKE ALL ON TABLE public.policy_registry FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_registry FROM anon;
REVOKE ALL ON TABLE public.policy_registry FROM authenticated;
GRANT SELECT ON TABLE public.policy_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.policy_registry TO service_role;

DO $$
DECLARE
  conflicting_policy RECORD;
BEGIN
  SELECT policy_id, version, status, is_active, tenant_id, deleted_at
    INTO conflicting_policy
    FROM public.policy_registry
   WHERE policy_id = 'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY'
     AND version = '1.0.0'
   LIMIT 1;

  IF FOUND THEN
    IF conflicting_policy.status <> 'active'
       OR conflicting_policy.is_active IS DISTINCT FROM true
       OR conflicting_policy.tenant_id IS NOT NULL
       OR conflicting_policy.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Existing AutoMove accounting policy v1 conflicts with approved active global policy semantics.';
    END IF;
  ELSE
    INSERT INTO public.policy_registry (
      policy_id,
      version,
      name,
      description,
      status,
      category,
      tenant_id,
      is_active,
      effective_date,
      expire_date,
      owner_department,
      business_owner,
      technical_owner,
      config,
      metadata
    )
    VALUES (
      'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY',
      '1.0.0',
      'AutoMove Vehicle Sale Accounting Policy v1',
      'Approved v1 policy identity for trusted AutoMove vehicle sale revenue recognition resolution. Ledger posting remains outside this migration.',
      'active',
      'accounting',
      NULL,
      true,
      DATE '2026-01-01',
      NULL,
      'Finance',
      'Bella AutoMove',
      'Bella Platform',
      jsonb_build_object(
        'scope', 'vehicle_sale_revenue_recognition',
        'currency_code', 'VND',
        'ledger_posting_authorized', false,
        'finance_ledger_posting', 'NOT_AUTHORIZED'
      ),
      jsonb_build_object(
        'approval_scope', 'ACCOUNTING_POLICY_V1_PROPOSED_DEFAULTS',
        'historical_policy_immutability', 'REQUIRED',
        'trusted_policy_resolution', 'REQUIRED',
        'production_mutation', 'NOT_AUTHORIZED'
      )
    );
  END IF;
END $$;

COMMENT ON TABLE public.policy_registry IS
  'Forward-compatible trusted policy registry for active global AutoMove accounting policy resolution. Actor identity references public.users; public.profiles is not part of this contract.';

COMMENT ON POLICY "policy_registry_read_active_global_accounting_policy" ON public.policy_registry IS
  'Authenticated users may read only active non-deleted global policies. Policy writes remain service-role/governance controlled.';
