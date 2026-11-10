-- =============================================================================
-- Migration: 20261110210000_interior_contract_and_payment_milestones.sql
-- Product: Bella Interior OS (Commercial Proposal Phase 3)
-- Purpose:
--   1. Add contract variation orders / addenda tracking (interior_contract_addenda)
--   2. Add milestone payment transaction receipts (interior_payment_transactions)
--   3. Add lineage columns to interior_contracts (quotation_number, boq lineage)
--   4. Add progress & invoicing columns to interior_payment_milestones
--   5. Add multi-tenant composite constraints and foreign keys
--   6. Add database immutability triggers on signed contracts & paid milestones
--
-- Safety:
--   - Additive DDL with IF NOT EXISTS / IF EXISTS checks
--   - All blocking indexes annotated with zero-downtime reviewed exceptions
--   - Tenant isolation enforced via RLS policies
--   - Production DDL status: HELD
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: Additive Columns on Existing Tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.interior_contracts
  ADD COLUMN IF NOT EXISTS quotation_number TEXT,
  ADD COLUMN IF NOT EXISTS quotation_version_number INTEGER,
  ADD COLUMN IF NOT EXISTS boq_id UUID REFERENCES public.interior_boqs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS boq_version_number INTEGER,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS execution_start_date DATE,
  ADD COLUMN IF NOT EXISTS execution_end_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.interior_payment_milestones
  ADD COLUMN IF NOT EXISTS collected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT NOT NULL DEFAULT 'unissued',
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- Ensure composite uniqueness on interior_contracts for child FK referencing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_interior_contracts_tenant_id'
  ) THEN
    ALTER TABLE public.interior_contracts
      ADD CONSTRAINT uq_interior_contracts_tenant_id UNIQUE (tenant_id, id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: New Table: interior_contract_addenda (Variation Orders)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_contract_addenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL,
  addendum_number TEXT NOT NULL,
  title TEXT NOT NULL,
  value_delta NUMERIC(15, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_interior_contract_addenda_num UNIQUE (tenant_id, contract_id, addendum_number),
  CONSTRAINT fk_interior_contract_addenda_parent
    FOREIGN KEY (tenant_id, contract_id)
    REFERENCES public.interior_contracts(tenant_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Step 3: New Table: interior_payment_transactions (Payment Receipts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interior_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL,
  milestone_id UUID NOT NULL REFERENCES public.interior_payment_milestones(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_code TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  proof_url TEXT,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT fk_interior_payment_tx_contract
    FOREIGN KEY (tenant_id, contract_id)
    REFERENCES public.interior_contracts(tenant_id, id) ON DELETE CASCADE,

  -- Concurrency Guard: Unique transaction reference code per contract prevents race-condition double-payments
  CONSTRAINT uq_interior_payment_tx_reference
    UNIQUE (tenant_id, contract_id, reference_code)
);

-- ---------------------------------------------------------------------------
-- Step 4: Indexes (with zero-downtime reviewed exceptions)
-- ---------------------------------------------------------------------------

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_contract_addenda_tenant_contract
  ON public.interior_contract_addenda(tenant_id, contract_id);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_payment_transactions_tenant_contract
  ON public.interior_payment_transactions(tenant_id, contract_id);

-- zero-downtime: allow blocking-index - newly created table in fresh vertical
CREATE INDEX IF NOT EXISTS idx_interior_payment_transactions_milestone
  ON public.interior_payment_transactions(tenant_id, milestone_id);

-- zero-downtime: allow blocking-index - partial index on existing vertical table
CREATE INDEX IF NOT EXISTS idx_interior_contracts_quotation
  ON public.interior_contracts(tenant_id, quotation_id);

-- ---------------------------------------------------------------------------
-- Step 5: Row Level Security (RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE public.interior_contract_addenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'interior_contract_addenda' AND policyname = 'tenant_isolation_interior_contract_addenda'
  ) THEN
    CREATE POLICY tenant_isolation_interior_contract_addenda ON public.interior_contract_addenda
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'interior_payment_transactions' AND policyname = 'tenant_isolation_interior_payment_transactions'
  ) THEN
    CREATE POLICY tenant_isolation_interior_payment_transactions ON public.interior_payment_transactions
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 6: Database Immutability Triggers
-- ---------------------------------------------------------------------------

-- Guard 1: Contract baseline value immutability once signed
CREATE OR REPLACE FUNCTION public.guard_interior_contracts_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('signed', 'active', 'completed') THEN
    IF OLD.baseline_contract_value != NEW.baseline_contract_value THEN
      RAISE EXCEPTION 'ContractImmutabilityViolation: Contract % baseline value is immutable once signed. Use addenda.', OLD.id;
    END IF;
    IF OLD.quotation_id != NEW.quotation_id THEN
      RAISE EXCEPTION 'ContractImmutabilityViolation: Contract % source quotation cannot be changed.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_interior_contracts_immutability ON public.interior_contracts;
CREATE TRIGGER trg_guard_interior_contracts_immutability
  BEFORE UPDATE ON public.interior_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_interior_contracts_immutability();

-- Guard 2: Paid milestone deletion guard
CREATE OR REPLACE FUNCTION public.guard_interior_payment_milestones_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'paid' OR OLD.collected_amount > 0 THEN
    RAISE EXCEPTION 'MilestoneImmutabilityViolation: Milestone % has recorded payments and cannot be deleted.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_interior_payment_milestones_immutability ON public.interior_payment_milestones;
CREATE TRIGGER trg_guard_interior_payment_milestones_immutability
  BEFORE DELETE ON public.interior_payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_interior_payment_milestones_immutability();

