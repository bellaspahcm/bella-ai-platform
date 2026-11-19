-- Migration: 20261118120000_interior_o4_acceptance_campaign_and_evidence.sql
-- Purpose:
--   1. Create public.interior_acceptance_campaigns for multi-campaign acceptance programs.
--   2. Create public.interior_acceptance_sessions with three independent state dimensions:
--      inspection_result, approval_status, documentation_status.
--   3. Create public.interior_acceptance_notes supporting 7 categories and specialized work routing.
--   4. Create public.interior_acceptance_evidence_objects with server-verified SHA-256 and immutable versioning.
--   5. Enforce Row-Level Security (RLS) and Tenant Isolation across all 4 additive tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: interior_acceptance_campaigns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_acceptance_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
  campaign_code TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  description TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_interior_acceptance_campaign_code UNIQUE (tenant_id, project_id, campaign_code)
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_campaigns_lookup
  ON public.interior_acceptance_campaigns(tenant_id, project_id, created_at DESC);

ALTER TABLE public.interior_acceptance_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_acceptance_campaigns'
      AND policyname = 'interior_acceptance_campaigns_tenant_isolation'
  ) THEN
    CREATE POLICY interior_acceptance_campaigns_tenant_isolation
      ON public.interior_acceptance_campaigns
      FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;
END $$;

REVOKE ALL ON public.interior_acceptance_campaigns FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_acceptance_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.interior_acceptance_campaigns TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: interior_acceptance_sessions (Three Independent State Dimensions)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_acceptance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.interior_acceptance_campaigns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,
  session_type TEXT NOT NULL,
  inspection_scope TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  recorder_actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_representative TEXT NOT NULL,
  customer_contact TEXT,
  related_boq_item_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  inspection_result TEXT NOT NULL DEFAULT 'PENDING_REMEDIATION',
  approval_status TEXT NOT NULL DEFAULT 'PENDING',
  documentation_status TEXT NOT NULL DEFAULT 'NONE',
  approved_by_actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_interior_acceptance_session_code UNIQUE (tenant_id, project_id, session_code),
  CONSTRAINT chk_interior_session_type
    CHECK (session_type IN ('ROOM_BY_ROOM', 'ITEM_BASED', 'DELIVERY_BATCH', 'POST_REMEDIATION', 'FINAL_HANDOVER')),
  CONSTRAINT chk_interior_session_inspection_result
    CHECK (inspection_result IN ('ACCEPTED_WITHOUT_ISSUES', 'ACCEPTED_WITH_REMARKS', 'PENDING_REMEDIATION')),
  CONSTRAINT chk_interior_session_approval_status
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT chk_interior_session_documentation_status
    CHECK (documentation_status IN ('NONE', 'PARTIAL', 'COMPLETE'))
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_sessions_lookup
  ON public.interior_acceptance_sessions(tenant_id, project_id, campaign_id, created_at DESC);

-- zero-downtime: allow blocking-index - state filtering index
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_sessions_states
  ON public.interior_acceptance_sessions(tenant_id, approval_status, documentation_status);

ALTER TABLE public.interior_acceptance_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_acceptance_sessions'
      AND policyname = 'interior_acceptance_sessions_tenant_isolation'
  ) THEN
    CREATE POLICY interior_acceptance_sessions_tenant_isolation
      ON public.interior_acceptance_sessions
      FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;
END $$;

REVOKE ALL ON public.interior_acceptance_sessions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_acceptance_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.interior_acceptance_sessions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 3: interior_acceptance_notes (7 Categories & Specialized Work Routing)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_acceptance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.interior_acceptance_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  assessment_status TEXT NOT NULL DEFAULT 'NO_ISSUES',
  description TEXT NOT NULL,
  related_boq_item_id UUID REFERENCES public.interior_boq_items(id) ON DELETE SET NULL,
  remediation_plan TEXT,
  assigned_fixer TEXT,
  target_deadline DATE,
  remediation_status TEXT NOT NULL DEFAULT 'OPEN',
  routed_entity_type TEXT,
  routed_entity_id UUID,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT chk_interior_note_category
    CHECK (category IN ('QUALITY_ISSUE', 'INSTALLATION_ISSUE', 'CUSTOMER_REQUEST', 'MISSING_ITEM', 'DAMAGE', 'FOLLOW_UP', 'GENERAL_NOTE')),
  CONSTRAINT chk_interior_note_severity
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_interior_note_assessment_status
    CHECK (assessment_status IN ('NO_ISSUES', 'MINOR_MONITORING', 'DEFECT_REMEDIATION_REQUIRED', 'INCOMPLETE_ITEMS')),
  CONSTRAINT chk_interior_note_remediation_status
    CHECK (remediation_status IN ('OPEN', 'IN_PROGRESS', 'READY_FOR_REINSPECTION', 'VERIFIED', 'CLOSED')),
  CONSTRAINT chk_interior_note_routed_type
    CHECK (routed_entity_type IS NULL OR routed_entity_type IN ('punch_list', 'warranty_ticket', 'replenishment', 'change_order', 're_inspection', 'crm_note'))
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_notes_session
  ON public.interior_acceptance_notes(tenant_id, session_id, category);

-- zero-downtime: allow blocking-index - routing tracking index
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_notes_routing
  ON public.interior_acceptance_notes(tenant_id, routed_entity_type, routed_entity_id)
  WHERE routed_entity_id IS NOT NULL;

ALTER TABLE public.interior_acceptance_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_acceptance_notes'
      AND policyname = 'interior_acceptance_notes_tenant_isolation'
  ) THEN
    CREATE POLICY interior_acceptance_notes_tenant_isolation
      ON public.interior_acceptance_notes
      FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;
END $$;

REVOKE ALL ON public.interior_acceptance_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_acceptance_notes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.interior_acceptance_notes TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part 4: interior_acceptance_evidence_objects (Immutable Versioning & Server SHA-256)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interior_acceptance_evidence_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.interior_acceptance_sessions(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.interior_acceptance_notes(id) ON DELETE SET NULL,
  evidence_category TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT uq_interior_evidence_session_path_version UNIQUE (tenant_id, session_id, storage_path, version),
  CONSTRAINT chk_interior_evidence_category
    CHECK (evidence_category IN ('OVERALL', 'DETAIL', 'COMPLETED_PRODUCT', 'CUSTOMER_SIGNOFF', 'REMEDIATION_PROOF')),
  CONSTRAINT chk_interior_evidence_sha256
    CHECK (sha256_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_interior_evidence_size
    CHECK (file_size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT chk_interior_evidence_version
    CHECK (version >= 1)
);

-- zero-downtime: allow blocking-index - newly created table in fresh batch
CREATE INDEX IF NOT EXISTS idx_interior_acceptance_evidence_session
  ON public.interior_acceptance_evidence_objects(tenant_id, session_id, evidence_category);

ALTER TABLE public.interior_acceptance_evidence_objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interior_acceptance_evidence_objects'
      AND policyname = 'interior_acceptance_evidence_objects_tenant_isolation'
  ) THEN
    CREATE POLICY interior_acceptance_evidence_objects_tenant_isolation
      ON public.interior_acceptance_evidence_objects
      FOR ALL TO authenticated
      USING (tenant_id = public.interior_actor_tenant())
      WITH CHECK (tenant_id = public.interior_actor_tenant());
  END IF;
END $$;

REVOKE ALL ON public.interior_acceptance_evidence_objects FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interior_acceptance_evidence_objects TO service_role;
GRANT SELECT, INSERT ON public.interior_acceptance_evidence_objects TO authenticated;
