/**
 * Bella Interior OS — Full Lifecycle Invariants & Architectural Regression Suite
 *
 * Verifies the 5 core architectural invariants across the complete 8-stage lifecycle:
 * 1. Deterministic Tenant Project Resolver (single auto-resolve vs multi-project AMBIGUOUS error)
 * 2. Approved Design Lock (mutation blocked in repo, production order gated)
 * 3. Open Critical Punch List Handover Block (delivery gate)
 * 4. Tenant Isolation across bounded contexts
 * 5. Analytics Services Read-Model Contract Verification
 *
 * @module src/products/bella-interior/__tests__
 */

import { resolveTenantProject } from '../lib/project-resolver';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { SupabaseInteriorRepository } from '../repositories/supabase.repository';
import { DesignSpecificationService } from '../services/design-specification.service';
import { ManufacturingInstallationService } from '../services/manufacturing-installation.service';
import { DeliveryAftercareService } from '../services/delivery-aftercare.service';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import {
  ApprovedDesignLockViolationError,
  OpenCriticalPunchListError,
  TenantIsolationViolationError,
} from '../domain/errors';
import { InteriorProductionAnalyticsService } from '../services/interior-production-analytics.service';
import { InteriorInstallationAnalyticsService } from '../services/interior-installation-analytics.service';
import { InteriorQCHandoverAnalyticsService } from '../services/interior-qc-handover-analytics.service';
import { InteriorWarrantyAnalyticsService } from '../services/interior-warranty-analytics.service';
import { InteriorFinanceAnalyticsService } from '../services/interior-finance-analytics.service';
import { InteriorReportsAnalyticsService } from '../services/interior-reports-analytics.service';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Bella Interior — Full Lifecycle Invariants', () => {
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const project1 = '33333333-3333-4333-8333-333333333333';
  const project2 = '44444444-4444-4444-8444-444444444444';

  describe('1. Deterministic Project Resolver Law', () => {
    it('returns error when tenant identifier is missing or invalid', async () => {
      const mockSupabase = {} as unknown as SupabaseClient;
      const res = await resolveTenantProject(mockSupabase, '');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('returns PROJECT_NOT_FOUND when explicit projectId does not exist in tenant', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;

      const res = await resolveTenantProject(mockSupabase, tenantA, project1);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('returns requested projectId when explicit projectId exists', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: project1 }, error: null }),
        }),
      } as unknown as SupabaseClient;

      const res = await resolveTenantProject(mockSupabase, tenantA, project1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.projectId).toBe(project1);
      }
    });

    it('auto-resolves project when tenant has EXACTLY ONE project and no param is provided', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [{ id: project1, name: 'Dự án Penthouse', code: 'INT-P1' }],
            error: null,
          }),
        }),
      } as unknown as SupabaseClient;

      const res = await resolveTenantProject(mockSupabase, tenantA);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.projectId).toBe(project1);
      }
    });

    it('returns AMBIGUOUS_PROJECT_SELECTION when tenant has MULTIPLE projects and no param is provided', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              { id: project1, name: 'Dự án Penthouse', code: 'INT-P1' },
              { id: project2, name: 'Biệt thự Gamuda', code: 'INT-P2' },
            ],
            error: null,
          }),
        }),
      } as unknown as SupabaseClient;

      const res = await resolveTenantProject(mockSupabase, tenantA);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('AMBIGUOUS_PROJECT_SELECTION');
        expect(res.availableProjects?.length).toBe(2);
      }
    });
  });

  describe('2. Approved Design Lock Invariant', () => {
    let repo: InMemoryInteriorRepository;
    let outbox: PlatformFinanceOutboxAdapter;
    let designService: DesignSpecificationService;
    let mfgService: ManufacturingInstallationService;

    beforeEach(() => {
      repo = new InMemoryInteriorRepository();
      outbox = new PlatformFinanceOutboxAdapter();
      designService = new DesignSpecificationService(repo, outbox);
      mfgService = new ManufacturingInstallationService(repo, outbox);
    });

    it('blocks issuing a Production Order when design revision is NOT approved', async () => {
      const project = await designService.createProject({
        tenantId: tenantA,
        code: 'INT-LOCK-01',
        name: 'The River Thủ Thiêm',
        customerId: 'cust-lock-1',
        customerName: 'Nguyễn Văn Nam',
        customerPhone: '0901234567',
        siteAddress: 'Quận 2, TP.HCM',
        projectType: 'residential_apartment',
        estimatedBudget: 850000000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS. Tuấn',
      });

      const revision = await designService.createDesignRevision({
        tenantId: tenantA,
        projectId: project.id,
        title: 'Bản vẽ 2D sơ bộ',
        submittedBy: 'KTS. Tuấn',
      });

      // Revision is in draft/review state, not approved
      await expect(
        mfgService.issueProductionOrder({
          tenantId: tenantA,
          projectId: project.id,
          designRevisionId: revision.id,
          boqId: 'boq-mock',
          orderNumber: 'LSX-2026-001',
          mode: 'in_house',
          workshopManagerName: 'Trần Văn Xưởng',
          scheduledStartDate: '2026-11-20',
          scheduledCompletionDate: '2026-12-10',
        })
      ).rejects.toThrow(ApprovedDesignLockViolationError);
    });

    it('enforces ApprovedDesignLockViolationError in SupabaseInteriorRepository.saveDesignRevision when updating approved revision', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockImplementation((fnName: string) => {
          if (fnName === 'interior_read_design_revision_commercial') {
            return Promise.resolve({
              data: {
                id: 'rev-approved-1',
                tenant_id: tenantA,
                project_id: project1,
                version_number: 1,
                title: 'Original Approved Revision',
                status: 'approved',
                submitted_by: 'KTS. Tuấn',
                submitted_at: '2026-11-15T00:00:00Z',
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'interior_projects') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: project1,
                  tenant_id: tenantA,
                  code: 'INT-P1',
                  name: 'Project 1',
                  status: 'in_progress',
                },
                error: null,
              }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      } as unknown as SupabaseClient;

      const supabaseRepo = new SupabaseInteriorRepository(mockSupabase);

      await expect(
        supabaseRepo.saveDesignRevision(tenantA, {
          id: 'rev-approved-1',
          tenantId: tenantA,
          projectId: project1,
          versionNumber: 1,
          title: 'Modified Approved Revision',
          status: 'approved',
          submittedBy: 'KTS. Tuấn',
          submittedAt: '2026-11-15T00:00:00Z',
          items: [],
          assets: [],
          materialSpecs: [],
        })
      ).rejects.toThrow(ApprovedDesignLockViolationError);
    });
  });

  describe('3. Open Critical Punch List Handover Invariant', () => {
    let repo: InMemoryInteriorRepository;
    let outbox: PlatformFinanceOutboxAdapter;
    let designService: DesignSpecificationService;
    let deliveryService: DeliveryAftercareService;

    beforeEach(() => {
      repo = new InMemoryInteriorRepository();
      outbox = new PlatformFinanceOutboxAdapter();
      designService = new DesignSpecificationService(repo, outbox);
      deliveryService = new DeliveryAftercareService(repo, outbox);
    });

    it('strictly blocks completeHandover if open critical defects remain', async () => {
      const project = await designService.createProject({
        tenantId: tenantA,
        code: 'INT-HO-01',
        name: 'The Metropole Thủ Thiêm',
        customerId: 'cust-ho-1',
        customerName: 'Trần Thị Thu',
        customerPhone: '0912345678',
        siteAddress: 'Quận 2, TP.HCM',
        projectType: 'residential_apartment',
        estimatedBudget: 1200000000,
        targetCompletionDate: '2026-12-15',
        leadArchitectId: 'arch-2',
        leadArchitectName: 'KTS. Hạnh',
      });

      // Record a critical defect
      await deliveryService.recordPunchListItem({
        tenantId: tenantA,
        projectId: project.id,
        roomZoneName: 'Phòng Khách',
        itemName: 'Hệ lam gỗ ốp tường',
        defectCategory: 'structural_alignment',
        description: 'Lam gỗ cong vênh 15mm, có nguy cơ bung nở',
        severity: 'critical',
        assignedFixer: 'Tổ thi công mộc',
        deadline: '2026-11-18',
      });

      // Attempting handover must throw OpenCriticalPunchListError
      await expect(
        deliveryService.completeHandover({
          tenantId: tenantA,
          projectId: project.id,
          contractId: 'contract-ho-1',
          clientSignoffName: 'Trần Thị Thu',
          finalSettlementValue: 1200000000,
        })
      ).rejects.toThrow(OpenCriticalPunchListError);
    });
  });

  describe('4. Tenant Isolation Invariant', () => {
    let repo: InMemoryInteriorRepository;
    let outbox: PlatformFinanceOutboxAdapter;
    let mfgService: ManufacturingInstallationService;
    let deliveryService: DeliveryAftercareService;

    beforeEach(() => {
      repo = new InMemoryInteriorRepository();
      outbox = new PlatformFinanceOutboxAdapter();
      mfgService = new ManufacturingInstallationService(repo, outbox);
      deliveryService = new DeliveryAftercareService(repo, outbox);
    });

    it('throws TenantIsolationViolationError when tenantId is empty or undefined', async () => {
      await expect(
        mfgService.issueProductionOrder({
          tenantId: '',
          projectId: project1,
          designRevisionId: 'rev-1',
          boqId: 'boq-1',
          orderNumber: 'LSX-001',
          mode: 'in_house',
          workshopManagerName: 'Manager',
          scheduledStartDate: '2026-11-20',
          scheduledCompletionDate: '2026-11-30',
        })
      ).rejects.toThrow(TenantIsolationViolationError);

      await expect(
        deliveryService.completeHandover({
          tenantId: '',
          projectId: project1,
          contractId: 'contract-1',
          clientSignoffName: 'Client',
          finalSettlementValue: 1000000,
        })
      ).rejects.toThrow(TenantIsolationViolationError);
    });
  });

  describe('5. Analytics Services Read-Model Contracts', () => {
    it('InteriorProductionAnalyticsService returns full canonical overview', () => {
      const overview = InteriorProductionAnalyticsService.getProductionOverview();
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.workflowStages).toBeInstanceOf(Array);
      expect(overview.workflowStages.length).toBe(7); // 7-stage cabinetry pipeline
      expect(overview.ordersTable).toBeDefined();
      expect(overview.ordersTable.rows).toBeInstanceOf(Array);
    });

    it('InteriorInstallationAnalyticsService returns full installation overview', () => {
      const overview = InteriorInstallationAnalyticsService.getInstallationOverview();
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.rooms).toBeInstanceOf(Array);
      expect(overview.timelineChart).toBeDefined();
    });

    it('InteriorQCHandoverAnalyticsService returns full QC/Handover overview', () => {
      const overview = InteriorQCHandoverAnalyticsService.getQCHandoverOverview();
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.availableProjects).toBeInstanceOf(Array);
      expect(overview.projectHeader).toBeDefined();
      expect(overview.table).toBeDefined();
    });

    it('InteriorWarrantyAnalyticsService returns warranty overview with active project', async () => {
      const overview = await InteriorWarrantyAnalyticsService.getWarrantyOverview(tenantA, 'INT-2024-001');
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.certificates).toBeInstanceOf(Array);
      expect(overview.availableProjects).toBeInstanceOf(Array);
    });

    it('InteriorFinanceAnalyticsService returns Phase 1 financial truth', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview('Quý 4/2026', '3_months');
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.projectPLBreakdown.projects).toBeInstanceOf(Array);
      expect(overview.cogsStructure).toBeDefined();
    });

    it('InteriorReportsAnalyticsService returns executive analytics dossier', async () => {
      const overview = await InteriorReportsAnalyticsService.getReportsOverview(tenantA, 'INT-2024-001', 'Tháng 10/2026');
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.trends).toBeDefined();
      expect(overview.costStructure).toBeDefined();
      expect(overview.availableProjects).toBeInstanceOf(Array);
    });
  });
});
