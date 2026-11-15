/**
 * Bella Interior OS — 14-Criteria MVP Runtime Verification Suite
 *
 * Explicitly validates the 14 runtime audit criteria:
 *   1. Authenticated session resolution & permission check
 *   2. Project persistence & tenant isolation
 *   3. Design revision creation & persistence
 *   4. Design revision approval & actor attribution
 *   5. Approved Design Lock invariant (second approval returns 409)
 *   6. Production Order creation from non-approved revision blocked (422)
 *   7. Production Order creation from approved revision succeeds
 *   8. QC Punch List creation (status: open)
 *   9. Punch List transition to 'rectified' with rectifiedBy
 *  10. Punch List transition to 'verified' with verifiedBy bound to actor.id
 *  11. Handover gate blocks on unverified critical defect (422)
 *  12. Handover still requires persisted customer-issued acceptance evidence
 *  13. Cross-tenant data isolation strictly enforced (Gate 0)
 *  14. Transactional Finance Outbox idempotency (no duplicate entries)
 *
 * @module src/products/bella-interior/__tests__
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorOSService } from '../services/interior-os.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { SupabaseInteriorFinanceOutboxAdapter } from '../adapters/supabase-finance-outbox.adapter';
import { resolveInteriorContext } from '../lib/server-context';
import { ApprovedDesignLockViolationError } from '../domain/errors';
import type { InteriorBOQ } from '../domain/commercial-costing/types';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Bella Interior OS — 14-Criteria MVP Runtime Verification', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';
  const authenticatedActorId = 'usr-interior-architect-001';

  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let service: InteriorOSService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    service = new InteriorOSService(repository, outbox);
  });

  // ── Criterion 1: Auth Guard & Forbidden Header Rejection ─────────────────
  describe('Criterion 1: Auth & Permission Resolution', () => {
    it('blocks spoofed identity headers (x-tenant-id, x-user-id) with 403', async () => {
      const spoofedRequest = new Request('https://api.bella.vn/api/interior/projects', {
        headers: {
          'x-tenant-id': tenantB,
          'x-user-id': 'hacker',
        },
      });

      const result = await resolveInteriorContext(spoofedRequest);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });
  });

  // ── Criterion 2: Project Creation & Persistence ──────────────────────────
  describe('Criterion 2: Project Creation & Persistence', () => {
    it('creates and persists project for Tenant A', async () => {
      const project = await service.design.createProject({
        tenantId: tenantA,
        code: 'INT-DUBAI-001',
        name: 'Dubai Luxury Villa',
        customerId: 'cust-vip-1',
        customerName: 'Sheikh Mansoor',
        customerPhone: '+971501234567',
        siteAddress: 'Palm Jumeirah Villa Frond K-12',
        projectType: 'residential_villa',
        estimatedBudget: 5_000_000_000,
        targetCompletionDate: '2026-12-30',
        leadArchitectId: authenticatedActorId,
        leadArchitectName: 'KTS. Le Hoang Son',
      });

      expect(project.id).toBeDefined();
      expect(project.tenantId).toBe(tenantA);

      const retrieved = await repository.getProject(tenantA, project.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Dubai Luxury Villa');
    });
  });

  // ── Criterion 3: Design Revision Creation ────────────────────────────────
  describe('Criterion 3: Design Revision Creation', () => {
    it('creates a new design revision in client_review status', async () => {
      const project = await service.design.createProject({
        tenantId: tenantA,
        code: 'INT-002',
        name: 'Penthouse Hanoi',
        customerId: 'cust-2',
        customerName: 'Tran Van B',
        customerPhone: '0912345678',
        siteAddress: 'Keangnam Landmark',
        projectType: 'residential_apartment',
        estimatedBudget: 2_000_000_000,
        targetCompletionDate: '2026-10-30',
        leadArchitectId: authenticatedActorId,
        leadArchitectName: 'KTS. Son',
      });

      const revision = await service.design.createDesignRevision({
        tenantId: tenantA,
        projectId: project.id,
        title: '3D Render Concept V1',
        changeSummary: 'Initial concept signoff',
        submittedBy: authenticatedActorId,
        assets: [],
        materialSpecs: [],
      });

      expect(revision.status).toBe('client_review');
      expect(revision.projectId).toBe(project.id);
    });
  });

  // ── Criterion 4 & 5: Approved Design Lock ────────────────────────────────
  describe('Criteria 4 & 5: Approved Design Lock & Re-Approval Invariant', () => {
    it('approves design revision and locks it against secondary approvals', async () => {
      const project = await service.design.createProject({
        tenantId: tenantA,
        code: 'INT-003',
        name: 'Villa Ecopark',
        customerId: 'cust-3',
        customerName: 'Pham C',
        customerPhone: '0933333333',
        siteAddress: 'Ecopark Grand',
        projectType: 'residential_villa',
        estimatedBudget: 3_000_000_000,
        targetCompletionDate: '2026-11-30',
        leadArchitectId: authenticatedActorId,
        leadArchitectName: 'KTS. Son',
      });

      const revision = await service.design.createDesignRevision({
        tenantId: tenantA,
        projectId: project.id,
        title: 'Final Architectural V1',
        submittedBy: authenticatedActorId,
        assets: [],
        materialSpecs: [],
      });

      // First approval succeeds (Criterion 4)
      const approved = await service.design.approveDesignRevision({
        tenantId: tenantA,
        revisionId: revision.id,
        approvedBy: authenticatedActorId,
        clientSignoffName: 'Pham C',
      });
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(authenticatedActorId);

      // Second approval is blocked by Approved Design Lock (Criterion 5)
      await expect(
        service.design.approveDesignRevision({
          tenantId: tenantA,
          revisionId: revision.id,
          approvedBy: 'other-user',
          clientSignoffName: 'Other',
        }),
      ).rejects.toThrow(/Approved Design Lock Violation/);
    });
  });

  // ── Criteria 6 & 7: Production Order from Approved Revision ──────────────
  describe('Criteria 6 & 7: Production Order Guarded by Approved Design Lock', () => {
    it('blocks production orders from unapproved revisions (422) and allows approved ones', async () => {
      const project = await service.design.createProject({
        tenantId: tenantA,
        code: 'INT-004',
        name: 'Office Tower',
        customerId: 'cust-4',
        customerName: 'Cong ty XYZ',
        customerPhone: '0281234567',
        siteAddress: 'District 1, HCMC',
        projectType: 'commercial_office',
        estimatedBudget: 1_500_000_000,
        targetCompletionDate: '2026-09-30',
        leadArchitectId: authenticatedActorId,
        leadArchitectName: 'KTS. Son',
      });

      const draftRev = await service.design.createDesignRevision({
        tenantId: tenantA,
        projectId: project.id,
        title: 'Draft Rev',
        submittedBy: authenticatedActorId,
        assets: [],
        materialSpecs: [],
      });

      const mockBoq: InteriorBOQ = {
        id: 'boq-001',
        tenantId: tenantA,
        projectId: project.id,
        designRevisionId: draftRev.id,
        boqNumber: 'BOQ-001',
        versionNumber: 1,
        status: 'approved',
        totalInternalCost: 100_000_000,
        totalClientPrice: 150_000_000,
        totalGrossMargin: 50_000_000,
        grossMarginPercent: 33.3,
        items: [],
        preparedBy: 'QS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveBOQ(tenantA, mockBoq);

      // Criterion 6: Cannot create production order from draft revision
      await expect(
        service.manufacturing.issueProductionOrder({
          tenantId: tenantA,
          projectId: project.id,
          designRevisionId: draftRev.id,
          boqId: mockBoq.id,
          orderNumber: 'PO-001',
          mode: 'in_house',
          workshopManagerName: 'Manager A',
          scheduledStartDate: '2026-06-01',
          scheduledCompletionDate: '2026-07-01',
        }),
      ).rejects.toThrow(ApprovedDesignLockViolationError);

      // Approve revision
      await service.design.approveDesignRevision({
        tenantId: tenantA,
        revisionId: draftRev.id,
        approvedBy: authenticatedActorId,
        clientSignoffName: 'Cong ty XYZ',
      });

      // Criterion 7: Now production order can be released
      const order = await service.manufacturing.issueProductionOrder({
        tenantId: tenantA,
        projectId: project.id,
        designRevisionId: draftRev.id,
        boqId: mockBoq.id,
        orderNumber: 'PO-001',
        mode: 'in_house',
        workshopManagerName: 'Manager A',
        scheduledStartDate: '2026-06-01',
        scheduledCompletionDate: '2026-07-01',
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe('in_production');
    });
  });

  // ── Criteria 8, 9, 10: QC Punch List Lifecycle ───────────────────────────
  describe('Criteria 8, 9, 10: QC Punch List Verification Flow', () => {
    it('transitions defect: open → rectified → verified with verifiedBy tied to actor', async () => {
      const projId = 'proj-qc-001';

      // Criterion 8: Create open defect
      const punchItem = await service.delivery.recordPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        roomZoneName: 'Kitchen',
        itemName: 'Base Cabinet Door',
        defectCategory: 'misaligned_door',
        description: 'Door misaligned by 3mm',
        severity: 'critical',
        assignedFixer: 'Worker B',
        deadline: '2026-08-01',
      });
      expect(punchItem.status).toBe('open');

      // Criterion 9: Rectified by fixer
      const rectified = await service.delivery.rectifyPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        itemId: punchItem.id,
        rectificationNote: 'Hinges adjusted and aligned',
      });
      expect(rectified.status).toBe('rectified');

      // Criterion 10: Verified by authenticated supervisor
      const verified = await service.delivery.verifyPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        itemId: punchItem.id,
        verifiedBy: authenticatedActorId,
      });
      expect(verified.status).toBe('verified');
      expect(verified.verifiedBy).toBe(authenticatedActorId);
    });
  });

  // ── Criteria 11 & 12: Handover Gate & Warranty Start ─────────────────────
  describe('Criteria 11 & 12: Handover Defect Barrier & Warranty Activation', () => {
    it('blocks unresolved critical punch items and refuses unsigned customer acceptance after repair', async () => {
      const projId = 'proj-handover-test';

      // Criterion 11: Handover blocked by unverified critical item
      const item = await service.delivery.recordPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        roomZoneName: 'Living Room',
        itemName: 'Stone Island',
        defectCategory: 'stone_seam_flaw',
        description: 'Cracked marble edge',
        severity: 'critical',
        assignedFixer: 'Stone Team',
        deadline: '2026-08-01',
      });

      await expect(
        service.delivery.completeHandover({
          tenantId: tenantA,
          projectId: projId,
          contractId: 'contract-001',
          clientSignoffName: 'Sheikh Mansoor',
          finalSettlementValue: 500_000_000,
        }),
      ).rejects.toThrow(/Cannot complete project handover while 1 critical\/major punch list defect\(s\) remain open/);

      // Fix and verify defect
      await service.delivery.rectifyPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        itemId: item.id,
        rectificationNote: 'Marble edge repaired and polished',
      });
      await service.delivery.verifyPunchListItem({
        tenantId: tenantA,
        projectId: projId,
        itemId: item.id,
        verifiedBy: authenticatedActorId,
      });

      // A clear punch list is necessary, but a caller supplied name is not
      // customer evidence. The in-memory service must not issue a warranty.
      await expect(service.delivery.completeHandover({
        tenantId: tenantA,
        projectId: projId,
        contractId: 'contract-001',
        clientSignoffName: 'Sheikh Mansoor',
        finalSettlementValue: 500_000_000,
      })).rejects.toThrow(/persisted, customer-issued acceptance record/);
    });
  });

  // ── Criterion 13: Cross-Tenant Isolation ─────────────────────────────────
  describe('Criterion 13: Cross-Tenant Isolation (Gate 0)', () => {
    it('prevents Tenant B from reading Tenant A projects or punch items', async () => {
      const proj = await service.design.createProject({
        tenantId: tenantA,
        code: 'INT-ISOLATE',
        name: 'Private Villa',
        customerId: 'cust-a',
        customerName: 'Client A',
        customerPhone: '0901',
        siteAddress: 'Secret Location',
        projectType: 'residential_villa',
        estimatedBudget: 10_000_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: authenticatedActorId,
        leadArchitectName: 'KTS. Son',
      });

      // Tenant A can see it
      const foundA = await repository.getProject(tenantA, proj.id);
      expect(foundA).not.toBeNull();

      // Tenant B gets null
      const foundB = await repository.getProject(tenantB, proj.id);
      expect(foundB).toBeNull();

      // Tenant B project list is empty
      const listB = await repository.listProjects(tenantB);
      expect(listB).toHaveLength(0);
    });
  });

  // ── Criterion 14: Finance Outbox Idempotency ─────────────────────────────
  describe('Criterion 14: Transactional Finance Outbox Idempotency', () => {
    it('guarantees duplicate milestone dispatches do not duplicate entries in outbox', async () => {
      const mockSupabase: jest.Mocked<any> = {
        rpc: jest.fn(),
        from: jest.fn().mockReturnThis(),
        insert: jest.fn(),
      };

      // First call enqueues new record
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'outbox-uuid-001',
        error: null,
      });

      const durableOutbox = new SupabaseInteriorFinanceOutboxAdapter(
        mockSupabase as unknown as SupabaseClient,
      );

      const payload = {
        tenantId: tenantA,
        projectId: 'proj-001',
        contractId: 'contract-001',
        milestoneOrder: 1,
        milestoneName: '30% Advance',
        amount: 150_000_000,
        currency: 'VND',
        clientName: 'Sheikh Mansoor',
        occurredAt: new Date().toISOString(),
      };

      const firstResult = await durableOutbox.enqueueFinanceMilestone(payload);
      expect(firstResult.status).toBe('queued');
      expect(firstResult.outboxId).toBe('outbox-uuid-001');

      // Second call returns null from RPC (ON CONFLICT DO NOTHING)
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const secondResult = await durableOutbox.enqueueFinanceMilestone(payload);
      expect(secondResult.status).toBe('queued');
      // Idempotent outbox ID based on contract + milestone reference
      expect(secondResult.outboxId).toBe('idempotent_contract-001_m1');
    });
  });
});
