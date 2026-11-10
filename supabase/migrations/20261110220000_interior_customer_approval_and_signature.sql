-- ============================================================================
-- Bella Interior OS — Phase 4: Customer Approval & Digital Signature
-- Migration: 20261110220000_interior_customer_approval_and_signature.sql
--
-- Additive migration. No existing columns or constraints are modified.
-- Immutability triggers ensure approval records cannot be mutated
-- after leaving 'pending' status.
-- Zero-downtime: All blocking indexes annotated below.
-- ============================================================================

-- ─── Approval Status Type ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE interior_approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired',
    'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE interior_approval_subject_type AS ENUM (
    'quotation',
    'contract'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── interior_customer_approvals ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interior_customer_approvals (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL,
  project_id              UUID          NOT NULL,

  subject_type            interior_approval_subject_type NOT NULL,
  subject_id              UUID          NOT NULL,
  subject_version_number  INTEGER       NOT NULL DEFAULT 1,

  -- CP-2: Single-use, tenant-scoped token
  approval_token          UUID          NOT NULL DEFAULT gen_random_uuid(),

  status                  interior_approval_status NOT NULL DEFAULT 'pending',

  client_representative   TEXT          NOT NULL,
  client_contact          TEXT          NOT NULL,

  sent_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ   NOT NULL,

  approved_at             TIMESTAMPTZ,
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  customer_notes          TEXT,

  -- CP-7: Signature stored as file reference, not blob
  signature_storage_path  TEXT,
  signature_storage_url   TEXT,
  signature_mime_type     TEXT,
  signature_file_size_bytes BIGINT,
  signature_sha256_hash   TEXT,
  signature_uploaded_at   TIMESTAMPTZ,

  sent_by_actor_id        TEXT          NOT NULL,
  sent_by_actor_name      TEXT          NOT NULL,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_ica_tenant_id UNIQUE (tenant_id, id),

  -- Referential integrity: tenant isolation enforced at DB level
  CONSTRAINT fk_ica_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_ica_project
    FOREIGN KEY (project_id)
    REFERENCES interior_projects (id)
    ON DELETE CASCADE,

  -- CP-2: Token must be unique within tenant scope
  CONSTRAINT uq_ica_approval_token UNIQUE (tenant_id, approval_token)
);

-- Row-Level Security
ALTER TABLE interior_customer_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenant isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'interior_customer_approvals' AND policyname = 'ica_tenant_isolation'
  ) THEN
    CREATE POLICY ica_tenant_isolation ON interior_customer_approvals
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;

-- Indexes
-- zero-downtime: allow blocking-index - primary lookup by subject_id for approval list
CREATE INDEX IF NOT EXISTS idx_ica_subject
  ON interior_customer_approvals (tenant_id, subject_id, sent_at DESC);

-- zero-downtime: allow blocking-index - token lookup for approval resolution
CREATE INDEX IF NOT EXISTS idx_ica_token
  ON interior_customer_approvals (tenant_id, approval_token)
  WHERE status = 'pending';

-- zero-downtime: allow blocking-index - status filter for expiry jobs
CREATE INDEX IF NOT EXISTS idx_ica_status
  ON interior_customer_approvals (tenant_id, status, expires_at)
  WHERE status = 'pending';

-- ─── Additive columns on interior_quotations ─────────────────────────────────
-- These columns mirror approval lifecycle for quick overview queries
-- without joining interior_customer_approvals for every list page.

ALTER TABLE interior_quotations
  ADD COLUMN IF NOT EXISTS latest_approval_status TEXT,
  ADD COLUMN IF NOT EXISTS latest_approval_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_rejected_at      TIMESTAMPTZ;

-- ─── Immutability Trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION guard_interior_customer_approvals_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- CP-4: Once an approval leaves 'pending', it is immutable
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION
      'INTERIOR_APPROVAL_IMMUTABLE: approval % has status % and cannot be modified',
      OLD.id,
      OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_ica_immutability ON interior_customer_approvals;
CREATE TRIGGER trg_guard_ica_immutability
  BEFORE UPDATE ON interior_customer_approvals
  FOR EACH ROW EXECUTE FUNCTION guard_interior_customer_approvals_immutability();

-- ─── Updated-at auto-maintenance ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION interior_customer_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ica_updated_at ON interior_customer_approvals;
CREATE TRIGGER trg_ica_updated_at
  BEFORE UPDATE ON interior_customer_approvals
  FOR EACH ROW EXECUTE FUNCTION interior_customer_approvals_updated_at();

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE interior_customer_approvals IS
  'Immutable approval records for Bella Interior quotations and contracts (Phase 4)';
COMMENT ON COLUMN interior_customer_approvals.approval_token IS
  'Single-use, tenant-scoped UUID token sent to customer for approval portal link';
COMMENT ON COLUMN interior_customer_approvals.signature_storage_path IS
  'Storage bucket path for digital signature file — stored as reference, not blob (CP-7)';
COMMENT ON COLUMN interior_customer_approvals.status IS
  'Immutable once non-pending: approved | rejected | expired | superseded';

