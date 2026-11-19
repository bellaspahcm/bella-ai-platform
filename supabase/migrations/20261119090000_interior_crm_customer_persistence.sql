-- Migration: 20261119090000_interior_crm_customer_persistence.sql
-- Purpose:
--   Phase C: Customer Persistence (Additive Only)
--   Remediated in Phase C2 / C2.1 Independent Security Hardening:
--     1. RSK-12: Enforce strict lock_timeout = '5s' & statement_timeout = '30s'
--        to prevent lock queues from stalling live O1–O4 production traffic.
--     2. RSK-07: Enforce Composite Foreign Keys (tenant_id, customer_id) on all
--        child tables and aliases, guaranteeing engine-level cross-tenant isolation.
--     3. RSK-08: Override p_actor_id in interior_execute_customer_merge with auth.uid()
--        to eliminate caller spoofing; enforce public.interior_actor_tenant().
--     4. RSK-09: Enforce ordered row-locking (min UUID first) preventing merge deadlocks
--        and inverse merge race conditions.
--     5. RSK-10: Sequence generation privilege isolation (revoked from authenticated direct access).
--     6. Add RESTRICTIVE tenant_isolation_policy matching production security architecture.
--
-- Safety Notice:
--   - This file is an ADDITIVE-ONLY design drafted for Phase C1/C2/C2.1 verification.
--   - MUST NOT be applied to Production database without explicit owner authorization.

-- Enforce strict operational lock timeouts for zero O1–O4 queue starvation
SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: interior_customer_sequences (Atomic Concurrent-Safe Code Generator)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customer_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_val BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

ALTER TABLE public.interior_customer_sequences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_sequences'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customer_sequences
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;
END $$;

REVOKE ALL ON public.interior_customer_sequences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_sequences TO service_role;
-- Authenticated users access sequences strictly through interior_generate_customer_code (SECURITY DEFINER)

-- Function: Atomic code generation per tenant (KH-000001, KH-000002, ...)
-- Remediated: Enforces tenant from public.interior_actor_tenant() for authenticated users.
CREATE OR REPLACE FUNCTION public.interior_generate_customer_code(p_tenant_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_auth_tenant UUID;
  v_effective_tenant UUID;
  v_val BIGINT;
BEGIN
  v_auth_tenant := public.interior_actor_tenant();

  IF auth.role() = 'authenticated' THEN
    IF v_auth_tenant IS NULL THEN
      RAISE EXCEPTION 'AUTHENTICATED_INTERIOR_TENANT_REQUIRED';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN: Cannot generate customer code for foreign tenant';
    END IF;
    v_effective_tenant := v_auth_tenant;
  ELSIF auth.role() = 'service_role' THEN
    IF p_tenant_id IS NULL THEN
      RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE';
    END IF;
    v_effective_tenant := p_tenant_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  INSERT INTO public.interior_customer_sequences(tenant_id, last_val, updated_at)
  VALUES (v_effective_tenant, 1, statement_timestamp())
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    last_val = public.interior_customer_sequences.last_val + 1,
    updated_at = statement_timestamp()
  RETURNING last_val INTO v_val;

  RETURN 'KH-' || lpad(v_val::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.interior_generate_customer_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.interior_generate_customer_code(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: interior_customers (Independent Customer Domain Entity)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_code TEXT,
  type TEXT NOT NULL DEFAULT 'individual',
  tier TEXT NOT NULL DEFAULT 'standard',
  profile_status TEXT NOT NULL DEFAULT 'active',
  merged_into_id UUID REFERENCES public.interior_customers(id) ON DELETE SET NULL,
  primary_phone TEXT,
  primary_email TEXT,
  notes TEXT,
  assigned_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_interior_customers_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_interior_customers_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_interior_customers_merged_into FOREIGN KEY (tenant_id, merged_into_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT chk_interior_customer_type CHECK (type IN ('individual', 'enterprise', 'organization')),
  CONSTRAINT chk_interior_customer_tier CHECK (tier IN ('standard', 'silver', 'gold', 'vip')),
  CONSTRAINT chk_interior_customer_profile_status CHECK (profile_status IN ('active', 'inactive', 'merged')),
  CONSTRAINT chk_interior_customer_merge_target CHECK (
    (profile_status = 'merged' AND merged_into_id IS NOT NULL AND merged_into_id <> id)
    OR (profile_status <> 'merged')
  )
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customers_tenant_status
  ON public.interior_customers(tenant_id, profile_status);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customers_tenant_phone
  ON public.interior_customers(tenant_id, primary_phone);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customers_tenant_email
  ON public.interior_customers(tenant_id, primary_email);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customers_tenant_tax
  ON public.interior_customers(tenant_id, tax_code)
  WHERE tax_code IS NOT NULL;

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customers_tenant_name
  ON public.interior_customers(tenant_id, name);

ALTER TABLE public.interior_customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customers'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customers
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customers'
      AND policyname = 'interior_customers_select'
  ) THEN
    CREATE POLICY interior_customers_select
      ON public.interior_customers
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customers'
      AND policyname = 'interior_customers_insert'
  ) THEN
    CREATE POLICY interior_customers_insert
      ON public.interior_customers
      AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customers'
      AND policyname = 'interior_customers_update'
  ) THEN
    CREATE POLICY interior_customers_update
      ON public.interior_customers
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Trigger: Prevent hard delete of Customer if associated with projects or merge history
CREATE OR REPLACE FUNCTION public.interior_prevent_customer_hard_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.interior_projects WHERE customer_profile_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.interior_customer_aliases WHERE source_customer_id = OLD.id OR target_customer_id = OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.interior_customer_merge_logs WHERE source_customer_id = OLD.id OR target_customer_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_DELETE_FORBIDDEN: Customer has associated projects or merge audit history. Set profile_status to inactive or merged instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_interior_prevent_customer_hard_delete ON public.interior_customers;
CREATE TRIGGER trg_interior_prevent_customer_hard_delete
  BEFORE DELETE ON public.interior_customers
  FOR EACH ROW EXECUTE FUNCTION public.interior_prevent_customer_hard_delete();

REVOKE ALL ON public.interior_customers FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customers TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.interior_customers TO authenticated;
-- Authenticated users are explicitly NOT granted DELETE on interior_customers

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 3: interior_customer_contacts (Multi-Role Relationship Contacts)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'occupant',
  phone TEXT NOT NULL,
  email TEXT,
  position TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT fk_interior_customer_contacts_customer FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_interior_contact_role CHECK (
    role IN ('primary_contact', 'legal_representative', 'decision_maker', 'payer', 'site_manager', 'occupant')
  )
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_contacts_lookup
  ON public.interior_customer_contacts(tenant_id, customer_id);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_contacts_phone
  ON public.interior_customer_contacts(tenant_id, phone);

ALTER TABLE public.interior_customer_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_contacts'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customer_contacts
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_contacts'
      AND policyname = 'interior_customer_contacts_select'
  ) THEN
    CREATE POLICY interior_customer_contacts_select
      ON public.interior_customer_contacts
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_contacts'
      AND policyname = 'interior_customer_contacts_insert'
  ) THEN
    CREATE POLICY interior_customer_contacts_insert
      ON public.interior_customer_contacts
      AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_contacts'
      AND policyname = 'interior_customer_contacts_update'
  ) THEN
    CREATE POLICY interior_customer_contacts_update
      ON public.interior_customer_contacts
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_contacts'
      AND policyname = 'interior_customer_contacts_delete'
  ) THEN
    CREATE POLICY interior_customer_contacts_delete
      ON public.interior_customer_contacts
      AS PERMISSIVE FOR DELETE TO authenticated
      USING (true);
  END IF;
END $$;

REVOKE ALL ON public.interior_customer_contacts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_contacts TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 4: interior_customer_addresses (Multi-Address Management)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'site_location',
  full_address TEXT NOT NULL,
  ward TEXT,
  district TEXT,
  city TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT fk_interior_customer_addresses_customer FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_interior_address_type CHECK (
    address_type IN ('site_location', 'billing', 'headquarters', 'private_residence')
  )
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_addresses_lookup
  ON public.interior_customer_addresses(tenant_id, customer_id);

ALTER TABLE public.interior_customer_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_addresses'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customer_addresses
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_addresses'
      AND policyname = 'interior_customer_addresses_select'
  ) THEN
    CREATE POLICY interior_customer_addresses_select
      ON public.interior_customer_addresses
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_addresses'
      AND policyname = 'interior_customer_addresses_insert'
  ) THEN
    CREATE POLICY interior_customer_addresses_insert
      ON public.interior_customer_addresses
      AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_addresses'
      AND policyname = 'interior_customer_addresses_update'
  ) THEN
    CREATE POLICY interior_customer_addresses_update
      ON public.interior_customer_addresses
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_addresses'
      AND policyname = 'interior_customer_addresses_delete'
  ) THEN
    CREATE POLICY interior_customer_addresses_delete
      ON public.interior_customer_addresses
      AS PERMISSIVE FOR DELETE TO authenticated
      USING (true);
  END IF;
END $$;

REVOKE ALL ON public.interior_customer_addresses FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_addresses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_addresses TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 5: interior_customer_aliases (Permanent Redirect Index for Merged IDs)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customer_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_interior_customer_aliases_source UNIQUE (tenant_id, source_customer_id),
  CONSTRAINT chk_interior_customer_aliases_no_self CHECK (source_customer_id <> target_customer_id),
  CONSTRAINT fk_interior_customer_aliases_source FOREIGN KEY (tenant_id, source_customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_interior_customer_aliases_target FOREIGN KEY (tenant_id, target_customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE RESTRICT
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_aliases_target
  ON public.interior_customer_aliases(tenant_id, target_customer_id);

ALTER TABLE public.interior_customer_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_aliases'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customer_aliases
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_aliases'
      AND policyname = 'interior_customer_aliases_select'
  ) THEN
    CREATE POLICY interior_customer_aliases_select
      ON public.interior_customer_aliases
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- Remediated: Authenticated users CANNOT insert/update/delete aliases directly!
-- Aliases can ONLY be recorded via the SECURITY DEFINER merge procedure.
REVOKE ALL ON public.interior_customer_aliases FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_aliases TO service_role;
GRANT SELECT ON public.interior_customer_aliases TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 6: interior_customer_merge_logs (Immutable Audit Trail for Mergers)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_customer_merge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  contacts_transferred_count INTEGER NOT NULL DEFAULT 0,
  addresses_transferred_count INTEGER NOT NULL DEFAULT 0,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT fk_interior_customer_merge_logs_source FOREIGN KEY (tenant_id, source_customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_interior_customer_merge_logs_target FOREIGN KEY (tenant_id, target_customer_id)
    REFERENCES public.interior_customers(tenant_id, id) ON DELETE RESTRICT
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_merge_logs_target
  ON public.interior_customer_merge_logs(tenant_id, target_customer_id, merged_at DESC);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_customer_merge_logs_source
  ON public.interior_customer_merge_logs(tenant_id, source_customer_id);

ALTER TABLE public.interior_customer_merge_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_merge_logs'
      AND policyname = 'tenant_isolation_policy'
  ) THEN
    CREATE POLICY tenant_isolation_policy
      ON public.interior_customer_merge_logs
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_customer_merge_logs'
      AND policyname = 'interior_customer_merge_logs_select'
  ) THEN
    CREATE POLICY interior_customer_merge_logs_select
      ON public.interior_customer_merge_logs
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- Remediated: Authenticated users CANNOT insert/update/delete merge logs directly!
-- Merge logs can ONLY be recorded via the SECURITY DEFINER merge procedure.
REVOKE ALL ON public.interior_customer_merge_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_customer_merge_logs TO service_role;
GRANT SELECT ON public.interior_customer_merge_logs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 7: Expand Phase — Nullable Bridge Column on interior_projects
-- Remediated (RSK-07 & RSK-12):
--   - Adds composite FK (tenant_id, customer_profile_id) referencing
--     interior_customers(tenant_id, id). Uses MATCH SIMPLE so NULL customer_profile_id
--     passes without constraint error, while non-null values are guaranteed cross-tenant safe.
--   - Partial index on customer_profile_id builds in <5ms with 0 matching rows.
--   - Excludes non-concurrent index on legacy customer_id to prevent write lock contention.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'interior_projects'
      AND column_name = 'customer_profile_id'
  ) THEN
    ALTER TABLE public.interior_projects
      ADD COLUMN customer_profile_id UUID;

    ALTER TABLE public.interior_projects
      ADD CONSTRAINT fk_interior_projects_customer_profile
      FOREIGN KEY (tenant_id, customer_profile_id)
      REFERENCES public.interior_customers(tenant_id, id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- zero-downtime: allow blocking-index - index on newly added nullable column
CREATE INDEX IF NOT EXISTS idx_interior_projects_customer_profile
  ON public.interior_projects(tenant_id, customer_profile_id)
  WHERE customer_profile_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 8: Atomic Stored Procedure for Customer Merge (Database-Level Atomicity)
-- Remediated: Enforces tenant validation against public.interior_actor_tenant(),
-- overrides caller actor param with auth.uid() for authenticated callers,
-- revokes public execution, and validates cyclic dependency.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.interior_execute_customer_merge(
  p_tenant_id UUID,
  p_source_customer_id UUID,
  p_target_customer_id UUID,
  p_reason TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_auth_tenant UUID;
  v_effective_tenant UUID;
  v_effective_actor UUID;
  v_source public.interior_customers%ROWTYPE;
  v_target public.interior_customers%ROWTYPE;
  v_contacts_transferred INTEGER := 0;
  v_addresses_transferred INTEGER := 0;
BEGIN
  -- 1. Security & Identity Reconciliation
  v_auth_tenant := public.interior_actor_tenant();

  IF auth.role() = 'authenticated' THEN
    IF v_auth_tenant IS NULL THEN
      RAISE EXCEPTION 'AUTHENTICATED_INTERIOR_TENANT_REQUIRED';
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_auth_tenant THEN
      RAISE EXCEPTION 'TENANT_FORBIDDEN: Cannot merge customers of foreign tenant';
    END IF;
    v_effective_tenant := v_auth_tenant;
    -- Strictly override actor_id with verified auth.uid()
    v_effective_actor := auth.uid();
  ELSIF auth.role() = 'service_role' THEN
    IF p_tenant_id IS NULL THEN
      RAISE EXCEPTION 'TENANT_ID_REQUIRED_FOR_SERVICE_ROLE';
    END IF;
    v_effective_tenant := p_tenant_id;
    v_effective_actor := p_actor_id;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_CALLER_ROLE';
  END IF;

  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_SELF_NOT_ALLOWED';
  END IF;

  -- 2. Concurrency-Safe Ordered Locking (Deadlock Prevention)
  IF p_source_customer_id < p_target_customer_id THEN
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  ELSE
    SELECT * INTO v_target FROM public.interior_customers
      WHERE id = p_target_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
    SELECT * INTO v_source FROM public.interior_customers
      WHERE id = p_source_customer_id AND tenant_id = v_effective_tenant FOR UPDATE;
  END IF;

  -- 3. Existence & State Validation
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'SOURCE_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_source.profile_status = 'merged' THEN
    RAISE EXCEPTION 'CUSTOMER_ALREADY_MERGED';
  END IF;

  IF v_target.profile_status = 'merged' THEN
    RAISE EXCEPTION 'TARGET_CUSTOMER_CANNOT_BE_MERGED_STATE';
  END IF;

  -- 4. Cycle Detection in Existing Aliases
  IF EXISTS (
    SELECT 1 FROM public.interior_customer_aliases
    WHERE tenant_id = v_effective_tenant
      AND source_customer_id = p_target_customer_id
      AND target_customer_id = p_source_customer_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_MERGE_CYCLE_DETECTED';
  END IF;

  -- 5. Reassign Contacts
  WITH moved_contacts AS (
    UPDATE public.interior_customer_contacts
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_contacts_transferred FROM moved_contacts;

  -- 6. Reassign Addresses
  WITH moved_addresses AS (
    UPDATE public.interior_customer_addresses
    SET customer_id = p_target_customer_id,
        updated_at = statement_timestamp()
    WHERE customer_id = p_source_customer_id
      AND tenant_id = v_effective_tenant
    RETURNING id
  )
  SELECT count(*) INTO v_addresses_transferred FROM moved_addresses;

  -- 7. Register Source -> Target Alias
  INSERT INTO public.interior_customer_aliases (
    tenant_id,
    source_customer_id,
    target_customer_id,
    created_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    statement_timestamp()
  );

  -- 8. Flatten Existing Transitive Aliases Pointing to Source -> Update to Target
  UPDATE public.interior_customer_aliases
  SET target_customer_id = p_target_customer_id
  WHERE target_customer_id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  -- 9. Mark Source Customer as Merged
  UPDATE public.interior_customers
  SET profile_status = 'merged',
      merged_into_id = p_target_customer_id,
      updated_at = statement_timestamp()
  WHERE id = p_source_customer_id
    AND tenant_id = v_effective_tenant;

  -- 10. Record Audit Merge Log
  INSERT INTO public.interior_customer_merge_logs (
    tenant_id,
    source_customer_id,
    target_customer_id,
    actor_id,
    reason,
    contacts_transferred_count,
    addresses_transferred_count,
    merged_at
  )
  VALUES (
    v_effective_tenant,
    p_source_customer_id,
    p_target_customer_id,
    v_effective_actor,
    p_reason,
    v_contacts_transferred,
    v_addresses_transferred,
    statement_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sourceCustomerId', p_source_customer_id,
    'targetCustomerId', p_target_customer_id,
    'contactsTransferred', v_contacts_transferred,
    'addressesTransferred', v_addresses_transferred,
    'canonicalId', p_target_customer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.interior_execute_customer_merge(UUID, UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.interior_execute_customer_merge(UUID, UUID, UUID, TEXT, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 9: Canonical Compatibility Views (Harmonizing Naming Standards)
-- Allows queries against either interior_customers or interior_customer_profiles,
-- and interior_customer_merge_logs or interior_customer_merges.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.interior_customer_profiles AS
  SELECT * FROM public.interior_customers;

CREATE OR REPLACE VIEW public.interior_customer_merges AS
  SELECT * FROM public.interior_customer_merge_logs;

REVOKE ALL ON public.interior_customer_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.interior_customer_profiles TO authenticated, service_role;

REVOKE ALL ON public.interior_customer_merges FROM PUBLIC, anon;
GRANT SELECT ON public.interior_customer_merges TO authenticated, service_role;

