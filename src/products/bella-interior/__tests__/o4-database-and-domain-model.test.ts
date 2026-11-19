/**
 * Bella Interior OS — Batch O4 Database & Domain Model Verification Test
 *
 * Verifies Workstream O4-B deliverables:
 * 1. Migration DDL: 20261118120000_interior_o4_acceptance_campaign_and_evidence.sql
 * 2. Four new additive tables:
 *    - public.interior_acceptance_campaigns
 *    - public.interior_acceptance_sessions
 *    - public.interior_acceptance_notes
 *    - public.interior_acceptance_evidence_objects
 * 3. Three Independent State Dimensions (inspection_result, approval_status, documentation_status).
 * 4. Seven note categories and specialized work routing schema constraints.
 * 5. Immutable evidence versioning and server SHA-256 regex constraints.
 * 6. Tenant isolation and Row Level Security (RLS) policies.
 * 7. Domain Invariant Guards (documentation never blocks approval, approval never auto-closes defects).
 *
 * @module src/products/bella-interior/__tests__
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canApproveSessionWithDocumentation,
  doesApprovalCloseRemediation,
  isZeroDefectAssessment,
  isRemediationClosed,
  type AcceptanceApprovalStatus,
  type DocumentationStatus,
  type RemediationStatus,
  type AssessmentStatus,
} from '../domain/acceptance-handover.types';

describe('Bella Interior O4: Database & Domain Model Contract (O4-B)', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20261118120000_interior_o4_acceptance_campaign_and_evidence.sql'
  );

  let migrationSql: string;

  beforeAll(() => {
    expect(existsSync(migrationPath)).toBe(true);
    migrationSql = readFileSync(migrationPath, 'utf8');
  });

  describe('Part 1: Migration Structure & Zero-Downtime Envelope', () => {
    it('contains no intermediate transaction boundaries (BEGIN/COMMIT/ROLLBACK)', () => {
      // In PostgreSQL, migration runner provides the transaction envelope.
      // DDL files must not contain un-nested BEGIN; or COMMIT; statements.
      const lines = migrationSql.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Allow DO $$ BEGIN, but disallow standalone transaction commands
        expect(trimmed).not.toMatch(/^BEGIN\s*;/i);
        expect(trimmed).not.toMatch(/^COMMIT\s*;/i);
        expect(trimmed).not.toMatch(/^ROLLBACK\s*;/i);
        expect(trimmed).not.toMatch(/^SAVEPOINT\s+/i);
      }
    });

    it('declares zero-downtime allow comments for all newly added indexes', () => {
      const indexMatches = migrationSql.match(/CREATE INDEX IF NOT EXISTS/g) || [];
      expect(indexMatches.length).toBe(6);

      const zeroDowntimeComments = migrationSql.match(/-- zero-downtime: allow blocking-index/g) || [];
      expect(zeroDowntimeComments.length).toBe(6);
    });
  });

  describe('Part 2: Four Additive Domain Tables', () => {
    it('creates public.interior_acceptance_campaigns with tenant and project foreign keys', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.interior_acceptance_campaigns');
      expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('campaign_code TEXT NOT NULL');
      expect(migrationSql).toContain('uq_interior_acceptance_campaign_code UNIQUE (tenant_id, project_id, campaign_code)');
    });

    it('creates public.interior_acceptance_sessions with the three independent state dimensions', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.interior_acceptance_sessions');
      expect(migrationSql).toContain('campaign_id UUID NOT NULL REFERENCES public.interior_acceptance_campaigns(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('project_id UUID NOT NULL REFERENCES public.interior_projects(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('session_code TEXT NOT NULL');
      expect(migrationSql).toContain('inspection_scope TEXT NOT NULL');
      expect(migrationSql).toContain('inspection_date DATE NOT NULL');

      // The 3 Mandatory Independent State Dimensions:
      expect(migrationSql).toContain("inspection_result TEXT NOT NULL DEFAULT 'PENDING_REMEDIATION'");
      expect(migrationSql).toContain("approval_status TEXT NOT NULL DEFAULT 'PENDING'");
      expect(migrationSql).toContain("documentation_status TEXT NOT NULL DEFAULT 'NONE'");

      // Constraints:
      expect(migrationSql).toContain(
        "CHECK (session_type IN ('ROOM_BY_ROOM', 'ITEM_BASED', 'DELIVERY_BATCH', 'POST_REMEDIATION', 'FINAL_HANDOVER'))"
      );
      expect(migrationSql).toContain(
        "CHECK (inspection_result IN ('ACCEPTED_WITHOUT_ISSUES', 'ACCEPTED_WITH_REMARKS', 'PENDING_REMEDIATION'))"
      );
      expect(migrationSql).toContain(
        "CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))"
      );
      expect(migrationSql).toContain(
        "CHECK (documentation_status IN ('NONE', 'PARTIAL', 'COMPLETE'))"
      );
    });

    it('creates public.interior_acceptance_notes with 7 categories and routing foreign keys', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.interior_acceptance_notes');
      expect(migrationSql).toContain('session_id UUID NOT NULL REFERENCES public.interior_acceptance_sessions(id) ON DELETE CASCADE');
      expect(migrationSql).toContain(
        "CHECK (category IN ('QUALITY_ISSUE', 'INSTALLATION_ISSUE', 'CUSTOMER_REQUEST', 'MISSING_ITEM', 'DAMAGE', 'FOLLOW_UP', 'GENERAL_NOTE'))"
      );
      expect(migrationSql).toContain(
        "CHECK (severity IN ('low', 'medium', 'high', 'critical'))"
      );
      expect(migrationSql).toContain(
        "CHECK (assessment_status IN ('NO_ISSUES', 'MINOR_MONITORING', 'DEFECT_REMEDIATION_REQUIRED', 'INCOMPLETE_ITEMS'))"
      );
      expect(migrationSql).toContain(
        "CHECK (remediation_status IN ('OPEN', 'IN_PROGRESS', 'READY_FOR_REINSPECTION', 'VERIFIED', 'CLOSED'))"
      );
      expect(migrationSql).toContain(
        "CHECK (routed_entity_type IS NULL OR routed_entity_type IN ('punch_list', 'warranty_ticket', 'replenishment', 'change_order', 're_inspection', 'crm_note'))"
      );
    });

    it('creates public.interior_acceptance_evidence_objects with server SHA-256 and immutable versioning', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.interior_acceptance_evidence_objects');
      expect(migrationSql).toContain('session_id UUID NOT NULL REFERENCES public.interior_acceptance_sessions(id) ON DELETE CASCADE');
      expect(migrationSql).toContain('sha256_hash TEXT NOT NULL');
      expect(migrationSql).toContain("CHECK (sha256_hash ~ '^[0-9a-f]{64}$')");
      expect(migrationSql).toContain('CHECK (file_size_bytes BETWEEN 1 AND 10485760)');
      expect(migrationSql).toContain('version INTEGER NOT NULL DEFAULT 1');
      expect(migrationSql).toContain('uq_interior_evidence_session_path_version UNIQUE (tenant_id, session_id, storage_path, version)');
      expect(migrationSql).toContain(
        "CHECK (evidence_category IN ('OVERALL', 'DETAIL', 'COMPLETED_PRODUCT', 'CUSTOMER_SIGNOFF', 'REMEDIATION_PROOF'))"
      );
    });
  });

  describe('Part 3: Tenant Isolation & Security Access Control', () => {
    it('enables RLS and binds isolation policies to public.interior_actor_tenant() on all 4 tables', () => {
      const tables = [
        'interior_acceptance_campaigns',
        'interior_acceptance_sessions',
        'interior_acceptance_notes',
        'interior_acceptance_evidence_objects',
      ];

      for (const table of tables) {
        expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        expect(migrationSql).toContain(`policyname = '${table}_tenant_isolation'`);
        expect(migrationSql).toContain(`USING (tenant_id = public.interior_actor_tenant())`);
        expect(migrationSql).toContain(`WITH CHECK (tenant_id = public.interior_actor_tenant())`);
        expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon;`);
        expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO service_role;`);
        expect(migrationSql).toContain(`ON public.${table} TO authenticated;`);
      }
    });
  });

  describe('Part 4: Domain Invariant Guards', () => {
    it('invariant: documentation_status never blocks approval_status by itself', () => {
      const docStatuses: DocumentationStatus[] = ['NONE', 'PARTIAL', 'COMPLETE'];
      const approval: AcceptanceApprovalStatus = 'APPROVED';

      for (const doc of docStatuses) {
        expect(canApproveSessionWithDocumentation(approval, doc)).toBe(true);
      }
    });

    it('invariant: manager APPROVED never automatically marks remediation as CLOSED', () => {
      const currentRemediations: RemediationStatus[] = ['OPEN', 'IN_PROGRESS', 'READY_FOR_REINSPECTION'];
      const approval: AcceptanceApprovalStatus = 'APPROVED';

      for (const rem of currentRemediations) {
        const resultingRemediation = doesApprovalCloseRemediation(approval, rem);
        expect(resultingRemediation).toBe(rem);
        expect(resultingRemediation).not.toBe('CLOSED');
      }
    });

    it('invariant: zero defect assessment is strictly NO_ISSUES', () => {
      expect(isZeroDefectAssessment('NO_ISSUES')).toBe(true);
      expect(isZeroDefectAssessment('MINOR_MONITORING')).toBe(false);
      expect(isZeroDefectAssessment('DEFECT_REMEDIATION_REQUIRED')).toBe(false);
      expect(isZeroDefectAssessment('INCOMPLETE_ITEMS')).toBe(false);
    });

    it('invariant: remediation is only verified closed when status is strictly CLOSED', () => {
      expect(isRemediationClosed('CLOSED')).toBe(true);
      expect(isRemediationClosed('VERIFIED')).toBe(false);
      expect(isRemediationClosed('READY_FOR_REINSPECTION')).toBe(false);
      expect(isRemediationClosed('IN_PROGRESS')).toBe(false);
      expect(isRemediationClosed('OPEN')).toBe(false);
    });
  });
});
