/**
 * Unit Tests for Bella Interior OS — Takeoff Staging & Review Domain Service (Phase 2A)
 *
 * Verifies:
 * 1. Approved Design Lock: Only allows takeoff from Design Revision with status 'approved'.
 * 2. Mandatory Room Zone Binding: Rejects floating components or invalid roomZoneId.
 * 3. Stable Component Identity: Inherited components strictly preserve stableComponentId.
 * 4. Category-Flexible Dimensions & Material Binding: Supports cabinetry, loose furniture, stone, etc.
 * 5. Estimator Review Workflow: Component review (pending -> verified / review_required).
 * 6. Completed Run Snapshot Immutability: Modifications fail closed once completed.
 * 7. Deduplication & Idempotency: Protects against retry duplication.
 * 8. Gate 0: Tenant Isolation across all operations.
 *
 * @module src/products/bella-interior/__tests__/takeoff-service.test.ts
 */

import { InteriorTakeoffService } from '../services/interior-takeoff.service';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import {
  TenantIsolationViolationError,
  ApprovedDesignLockViolationError,
  TakeoffRunNotFoundError,
  TakeoffRunImmutableError,
  TakeoffComponentNotFoundError,
  InvalidRoomZoneBindingError,
  TakeoffIncompleteReviewError,
} from '../domain/errors';
import type {
  InteriorProject,
  ProjectRoomZone,
  DesignRevision,
} from '../domain/design-specification/types';

describe('InteriorTakeoffService — Phase 2A (Structured Takeoff & Review)', () => {
  const TENANT_A = 'tenant-interior-alpha';
  const TENANT_B = 'tenant-interior-beta';
  const PROJECT_ID = 'proj-villa-sunrise';

  let repository: InMemoryInteriorRepository;
  let takeoffService: InteriorTakeoffService;

  // Canonical Seed Data
  const sampleProject: InteriorProject = {
    id: PROJECT_ID,
    tenantId: TENANT_A,
    code: 'INT-2024-001',
    name: 'Villa Sunrise Renovation',
    customerId: 'cust-suncasa',
    customerName: 'SunCasa Group',
    customerPhone: '0901234567',
    siteAddress: 'Quận 7, TP.HCM',
    projectType: 'residential_villa',
    status: 'technical_design',
    estimatedBudget: 3500000000,
    targetCompletionDate: '2026-12-31',
    leadArchitectId: 'arch-hoang-long',
    leadArchitectName: 'KTS. Hoàng Long',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-06T10:00:00Z',
  };

  const livingRoomZone: ProjectRoomZone = {
    id: 'zone-living',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    code: 'RZ-LIVING',
    name: 'Phòng khách',
    floor: 1,
    areaSquareMeters: 45,
  };

  const kitchenZone: ProjectRoomZone = {
    id: 'zone-kitchen',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    code: 'RZ-KITCHEN',
    name: 'Bếp + Ăn',
    floor: 1,
    areaSquareMeters: 30,
  };

  const approvedRevisionR1: DesignRevision = {
    id: 'rev-design-r1',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    versionNumber: 1,
    title: 'Phương án thiết kế R1.0 — Đã duyệt',
    status: 'approved',
    submittedBy: 'KTS. Hoàng Long',
    submittedAt: '2026-11-05T09:00:00Z',
    approvedBy: 'Trần Thị Mai',
    approvedAt: '2026-11-06T14:00:00Z',
    assets: [],
    materialSpecs: [],
  };

  const draftRevisionR2: DesignRevision = {
    id: 'rev-design-r2-draft',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    versionNumber: 2,
    title: 'Phương án điều chỉnh R2.0 — Đang vẽ',
    status: 'draft',
    submittedBy: 'KTS. Hoàng Long',
    submittedAt: '2026-11-07T09:00:00Z',
    assets: [],
    materialSpecs: [],
  };

  const inReviewRevisionR2: DesignRevision = {
    id: 'rev-design-r2-in-review',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    versionNumber: 2,
    title: 'Phương án điều chỉnh R2.0 — Chờ khách duyệt',
    status: 'in_review',
    submittedBy: 'KTS. Hoàng Long',
    submittedAt: '2026-11-07T10:00:00Z',
    assets: [],
    materialSpecs: [],
  };

  const approvedRevisionR2: DesignRevision = {
    id: 'rev-design-r2-approved',
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    versionNumber: 2,
    title: 'Phương án điều chỉnh R2.0 — Đã duyệt',
    status: 'approved',
    submittedBy: 'KTS. Hoàng Long',
    submittedAt: '2026-11-07T11:00:00Z',
    approvedBy: 'Trần Thị Mai',
    approvedAt: '2026-11-07T15:00:00Z',
    assets: [],
    materialSpecs: [],
  };

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    takeoffService = new InteriorTakeoffService(repository);

    // Seed baseline project, zones, and revisions
    await repository.saveProject(TENANT_A, sampleProject);
    await repository.saveRoomZone(TENANT_A, livingRoomZone);
    await repository.saveRoomZone(TENANT_A, kitchenZone);
    await repository.saveDesignRevision(TENANT_A, approvedRevisionR1);
    await repository.saveDesignRevision(TENANT_A, draftRevisionR2);
    await repository.saveDesignRevision(TENANT_A, inReviewRevisionR2);
    await repository.saveDesignRevision(TENANT_A, approvedRevisionR2);
  });

  describe('1. Approved Design Lock Enforcement', () => {
    it('should reject takeoff initialization if design revision is in draft status', async () => {
      await expect(
        takeoffService.initializeTakeoffRun({
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          designRevisionId: draftRevisionR2.id,
          title: 'Takeoff Thử Nghiệm',
          preparedBy: 'QS. Nguyễn Văn Quang',
        }),
      ).rejects.toThrow(ApprovedDesignLockViolationError);
    });

    it('should reject takeoff initialization if design revision is in in_review status', async () => {
      await expect(
        takeoffService.initializeTakeoffRun({
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          designRevisionId: inReviewRevisionR2.id,
          title: 'Takeoff Chờ Duyệt',
          preparedBy: 'QS. Nguyễn Văn Quang',
        }),
      ).rejects.toThrow(ApprovedDesignLockViolationError);
    });

    it('should allow takeoff initialization when design revision is approved', async () => {
      const run = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Bóc tách cấu kiện đợt 1 (R1.0)',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });

      expect(run).toBeDefined();
      expect(run.id).toBeDefined();
      expect(run.status).toBe('draft');
      expect(run.isImmutable).toBe(false);
      expect(run.runNumber).toBe(1);
      expect(run.designRevisionId).toBe(approvedRevisionR1.id);
      expect(run.totalComponentsCount).toBe(0);
    });
  });

  describe('2. Mandatory Room Zone Binding Enforcement', () => {
    let runId: string;

    beforeEach(async () => {
      const run = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Bóc tách R1.0',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });
      runId = run.id;
    });

    it('should successfully bind component to valid project room zone (Phòng khách)', async () => {
      const comp = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-SF-01',
        componentName: 'Sofa cao cấp 3 chỗ',
        category: 'loose_furniture',
        dimensions: { width: 2400, depth: 900, height: 850 },
        specifications: {
          frameMaterialName: 'Gỗ sồi tự nhiên',
          upholsteryMaterialName: 'Da bò Ý cao cấp',
          surfaceFinish: 'Sơn bóng mờ 50%',
        },
        unit: 'bộ',
        quantity: 1,
      });

      expect(comp.id).toBeDefined();
      expect(comp.roomZoneId).toBe(livingRoomZone.id);
      expect(comp.roomZoneName).toBe('Phòng khách');
      expect(comp.stableComponentId).toBeDefined();
      expect(comp.reviewStatus).toBe('pending');
    });

    it('should reject component addition if roomZoneId does not exist in the project', async () => {
      await expect(
        takeoffService.addTakeoffComponent(TENANT_A, {
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          takeoffRunId: runId,
          roomZoneId: 'non-existent-zone-uuid',
          componentCode: 'FLOATING-01',
          componentName: 'Cấu kiện không gian trôi nổi',
          category: 'cabinetry',
          unit: 'cái',
          quantity: 1,
        }),
      ).rejects.toThrow(InvalidRoomZoneBindingError);
    });

    it('should reject updating component to a non-existent roomZoneId', async () => {
      const comp = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-TB-01',
        componentName: 'Bàn trà phòng khách',
        category: 'loose_furniture',
        unit: 'cái',
        quantity: 1,
      });

      await expect(
        takeoffService.updateTakeoffComponent(TENANT_A, runId, comp.id, {
          roomZoneId: 'invalid-zone-uuid',
        }),
      ).rejects.toThrow(InvalidRoomZoneBindingError);
    });
  });

  describe('3. Category-Flexible Dimensions & Material Specifications', () => {
    let runId: string;

    beforeEach(async () => {
      const run = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Bóc tách R1.0',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });
      runId = run.id;
    });

    it('should support Cabinetry with Carcass, Door Front, and mm dimensions', async () => {
      const kitchenCabinet = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: kitchenZone.id,
        componentCode: 'BEP-TBD-01',
        componentName: 'Tủ bếp dưới chữ L',
        category: 'cabinetry',
        dimensions: { width: 4500, depth: 600, height: 860 },
        specifications: {
          carcassMaterialName: 'MDF chống ẩm lõi xanh An Cường',
          doorFrontMaterialName: 'Cánh MDF phủ Acrylic bóng gương',
          surfaceFinish: 'Melamine MS 440 EV',
          hardwareSpec: 'Ray hộp Blum Legrabox + Bản lề Blum Clip Top 110',
        },
        unit: 'md',
        quantity: 4.5,
        estimatedUnitCost: 4500000,
        targetUnitPrice: 6200000,
      });

      expect(kitchenCabinet.category).toBe('cabinetry');
      expect(kitchenCabinet.dimensions.width).toBe(4500);
      expect(kitchenCabinet.specifications.carcassMaterialName).toBe('MDF chống ẩm lõi xanh An Cường');
      expect(kitchenCabinet.specifications.doorFrontMaterialName).toBe('Cánh MDF phủ Acrylic bóng gương');
      expect(kitchenCabinet.unit).toBe('md');
      expect(kitchenCabinet.quantity).toBe(4.5);
    });

    it('should support Loose Furniture without forcing carcass/door front schema', async () => {
      const roundTable = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-BT-02',
        componentName: 'Bàn trà tròn mặt đá',
        category: 'loose_furniture',
        dimensions: {
          diameter: 900,
          height: 450,
          customDimensionText: 'D900 x H450 mm',
        },
        specifications: {
          frameMaterialName: 'Chân inox 304 mạ PVD vàng xước',
          tabletopMaterialName: 'Đá thạch anh nhân tạo Vicostone Nero Marquina',
          surfaceFinish: 'PVD Gold Satin',
        },
        unit: 'cái',
        quantity: 1,
      });

      expect(roundTable.category).toBe('loose_furniture');
      expect(roundTable.dimensions.diameter).toBe(900);
      expect(roundTable.dimensions.width).toBeUndefined(); // Không ép buộc width
      expect(roundTable.specifications.carcassMaterialName).toBeUndefined(); // Không ép buộc thùng tủ
      expect(roundTable.specifications.tabletopMaterialName).toContain('Vicostone');
    });

    it('should support Wall Paneling with thickness and m² unit', async () => {
      const wallPanel = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-VOP-01',
        componentName: 'Vách nan gỗ ốp sau sofa',
        category: 'wall_paneling',
        dimensions: {
          width: 3800,
          height: 2700,
          thickness: 18,
          customDimensionText: '3.8m x 2.7m x 18mm',
        },
        specifications: {
          frameMaterialName: 'Khung xương sắt hộp 20x20',
          surfaceFinish: 'Veneer sồi tự nhiên sơn màu óc chó',
        },
        unit: 'm2',
        quantity: 10.26,
      });

      expect(wallPanel.category).toBe('wall_paneling');
      expect(wallPanel.dimensions.thickness).toBe(18);
      expect(wallPanel.unit).toBe('m2');
      expect(wallPanel.quantity).toBe(10.26);
    });
  });

  describe('4. Stable Component Identity & Clone Invariance', () => {
    let run1Id: string;
    let sofaStableId: string;
    let tableStableId: string;

    beforeEach(async () => {
      const run1 = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Run 1 — Thiết kế R1.0',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });
      run1Id = run1.id;

      const comp1 = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: run1Id,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-SF-01',
        componentName: 'Sofa da bò Ý',
        category: 'loose_furniture',
        unit: 'bộ',
        quantity: 1,
      });
      sofaStableId = comp1.stableComponentId;

      const comp2 = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: run1Id,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-BT-01',
        componentName: 'Bàn trà chữ nhật',
        category: 'loose_furniture',
        unit: 'cái',
        quantity: 1,
      });
      tableStableId = comp2.stableComponentId;
    });

    it('should preserve stableComponentId across component updates in the same run', async () => {
      const run = await takeoffService.getTakeoffRun(TENANT_A, run1Id);
      const sofa = run!.components.find((c) => c.componentCode === 'PK-SF-01')!;

      const updatedSofa = await takeoffService.updateTakeoffComponent(TENANT_A, run1Id, sofa.id, {
        componentName: 'Sofa da bò Ý (Đổi màu nâu sô cô la)',
        quantity: 1,
      });

      expect(updatedSofa.stableComponentId).toBe(sofaStableId);
      expect(updatedSofa.componentName).toBe('Sofa da bò Ý (Đổi màu nâu sô cô la)');
    });

    it('should preserve exact stableComponentId when cloning Run for a new approved Design Revision', async () => {
      // Complete review on Run 1
      const run1 = await takeoffService.getTakeoffRun(TENANT_A, run1Id);
      for (const c of run1!.components) {
        await takeoffService.reviewTakeoffComponent(TENANT_A, run1Id, c.id, {
          status: 'verified',
          reviewerName: 'Estimator Chief',
        });
      }
      await takeoffService.completeTakeoffRun(TENANT_A, run1Id, 'Estimator Chief');

      // Clone Run 1 into Run 2 for approved Revision R2.0
      const run2 = await takeoffService.cloneTakeoffRun({
        tenantId: TENANT_A,
        sourceRunId: run1Id,
        targetDesignRevisionId: approvedRevisionR2.id,
        newTitle: 'Run 2 — Kế thừa cho Thiết kế R2.0',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });

      expect(run2.id).not.toBe(run1Id);
      expect(run2.runNumber).toBe(2);
      expect(run2.parentRunId).toBe(run1Id);
      expect(run2.designRevisionId).toBe(approvedRevisionR2.id);
      expect(run2.status).toBe('draft');
      expect(run2.isImmutable).toBe(false);
      expect(run2.components.length).toBe(2);

      // Verify each inherited component gets a new row record id but EXACT SAME stableComponentId
      const inheritedSofa = run2.components.find((c) => c.componentCode === 'PK-SF-01')!;
      const inheritedTable = run2.components.find((c) => c.componentCode === 'PK-BT-01')!;

      expect(inheritedSofa.stableComponentId).toBe(sofaStableId);
      expect(inheritedTable.stableComponentId).toBe(tableStableId);

      // Unique record ID per snapshot
      const sourceSofa = run1!.components.find((c) => c.componentCode === 'PK-SF-01')!;
      expect(inheritedSofa.id).not.toBe(sourceSofa.id);
    });

    it('should assign a brand new stableComponentId when adding a brand new component to cloned Run 2', async () => {
      // Re-review and complete Run 1
      const run1 = await takeoffService.getTakeoffRun(TENANT_A, run1Id);
      for (const c of run1!.components) {
        await takeoffService.reviewTakeoffComponent(TENANT_A, run1Id, c.id, {
          status: 'verified',
          reviewerName: 'Estimator Chief',
        });
      }
      await takeoffService.completeTakeoffRun(TENANT_A, run1Id, 'Estimator Chief');

      const run2 = await takeoffService.cloneTakeoffRun({
        tenantId: TENANT_A,
        sourceRunId: run1Id,
        targetDesignRevisionId: approvedRevisionR2.id,
        newTitle: 'Run 2 — R2.0',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });

      // Add new console table in Run 2
      const newConsole = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: run2.id,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-CS-01',
        componentName: 'Bàn console sảnh vào',
        category: 'loose_furniture',
        unit: 'cái',
        quantity: 1,
      });

      expect(newConsole.stableComponentId).toBeDefined();
      expect(newConsole.stableComponentId).not.toBe(sofaStableId);
      expect(newConsole.stableComponentId).not.toBe(tableStableId);
    });
  });

  describe('5. Estimator Review Workflow & Summary Counters', () => {
    let runId: string;
    let sofaId: string;
    let tableId: string;

    beforeEach(async () => {
      const run = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Run Review Test',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });
      runId = run.id;

      const comp1 = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-SF-01',
        componentName: 'Sofa da bò Ý',
        category: 'loose_furniture',
        unit: 'bộ',
        quantity: 1,
      });
      sofaId = comp1.id;

      const comp2 = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-BT-01',
        componentName: 'Bàn trà chữ nhật',
        category: 'loose_furniture',
        unit: 'cái',
        quantity: 1,
      });
      tableId = comp2.id;
    });

    it('should initialize components in pending review status and compute accurate initial counts', async () => {
      const run = await takeoffService.getTakeoffRun(TENANT_A, runId);
      expect(run!.totalComponentsCount).toBe(2);
      expect(run!.pendingReviewCount).toBe(2);
      expect(run!.verifiedCount).toBe(0);
      expect(run!.reviewRequiredCount).toBe(0);
    });

    it('should update counters dynamically when components are verified or flagged for review', async () => {
      // Verify component 1 (Sofa)
      await takeoffService.reviewTakeoffComponent(TENANT_A, runId, sofaId, {
        status: 'verified',
        reviewerName: 'QS. Nguyễn Văn Quang',
        reviewNotes: 'Đã đối soát đúng bản vẽ kỹ thuật 2D',
      });

      let run = await takeoffService.getTakeoffRun(TENANT_A, runId);
      expect(run!.pendingReviewCount).toBe(1);
      expect(run!.verifiedCount).toBe(1);
      expect(run!.reviewRequiredCount).toBe(0);

      // Flag component 2 (Table) as review_required
      await takeoffService.reviewTakeoffComponent(TENANT_A, runId, tableId, {
        status: 'review_required',
        reviewerName: 'QS. Nguyễn Văn Quang',
        reviewNotes: 'KTS chưa bổ sung mặt cắt đá tự nhiên',
      });

      run = await takeoffService.getTakeoffRun(TENANT_A, runId);
      expect(run!.pendingReviewCount).toBe(0);
      expect(run!.verifiedCount).toBe(1);
      expect(run!.reviewRequiredCount).toBe(1);
    });
  });

  describe('6. Completed Run Snapshot Immutability', () => {
    let runId: string;
    let sofaId: string;

    beforeEach(async () => {
      const run = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Run Immutability Test',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });
      runId = run.id;

      const comp = await takeoffService.addTakeoffComponent(TENANT_A, {
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        takeoffRunId: runId,
        roomZoneId: livingRoomZone.id,
        componentCode: 'PK-SF-01',
        componentName: 'Sofa da bò Ý',
        category: 'loose_furniture',
        unit: 'bộ',
        quantity: 1,
      });
      sofaId = comp.id;
    });

    it('should reject completing the Run if any component is still pending review', async () => {
      await expect(
        takeoffService.completeTakeoffRun(TENANT_A, runId, 'Chief QS'),
      ).rejects.toThrow(TakeoffIncompleteReviewError);
    });

    it('should freeze the Run upon completion and fail closed on all modification attempts', async () => {
      // 1. Verify component
      await takeoffService.reviewTakeoffComponent(TENANT_A, runId, sofaId, {
        status: 'verified',
        reviewerName: 'Chief QS',
      });

      // 2. Complete run
      const completedRun = await takeoffService.completeTakeoffRun(TENANT_A, runId, 'Chief QS');
      expect(completedRun.status).toBe('completed');
      expect(completedRun.isImmutable).toBe(true);
      expect(completedRun.completedBy).toBe('Chief QS');
      expect(completedRun.completedAt).toBeDefined();

      // 3. Attempting to add component must throw TakeoffRunImmutableError
      await expect(
        takeoffService.addTakeoffComponent(TENANT_A, {
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          takeoffRunId: runId,
          roomZoneId: livingRoomZone.id,
          componentCode: 'PK-NEW-01',
          componentName: 'Cố tình thêm vào bản đã chốt',
          category: 'loose_furniture',
          unit: 'cái',
          quantity: 1,
        }),
      ).rejects.toThrow(TakeoffRunImmutableError);

      // 4. Attempting to update component must throw TakeoffRunImmutableError
      await expect(
        takeoffService.updateTakeoffComponent(TENANT_A, runId, sofaId, {
          componentName: 'Cố tình sửa tên',
        }),
      ).rejects.toThrow(TakeoffRunImmutableError);

      // 5. Attempting to delete component must throw TakeoffRunImmutableError
      await expect(
        takeoffService.deleteTakeoffComponent(TENANT_A, runId, sofaId),
      ).rejects.toThrow(TakeoffRunImmutableError);

      // 6. Attempting to review component in completed run must throw TakeoffRunImmutableError
      await expect(
        takeoffService.reviewTakeoffComponent(TENANT_A, runId, sofaId, {
          status: 'pending',
          reviewerName: 'Chief QS',
        }),
      ).rejects.toThrow(TakeoffRunImmutableError);
    });

    it('should guarantee repository deep copy snapshot isolation (external mutation immunity)', async () => {
      await takeoffService.reviewTakeoffComponent(TENANT_A, runId, sofaId, {
        status: 'verified',
        reviewerName: 'Chief QS',
      });
      await takeoffService.completeTakeoffRun(TENANT_A, runId, 'Chief QS');

      const runBefore = await takeoffService.getTakeoffRun(TENANT_A, runId);
      const sofaBefore = runBefore!.components[0];

      // Clone run to create Run 2
      const run2 = await takeoffService.cloneTakeoffRun({
        tenantId: TENANT_A,
        sourceRunId: runId,
        targetDesignRevisionId: approvedRevisionR2.id,
        newTitle: 'Run 2 Draft',
        preparedBy: 'QS. Nguyễn Văn Quang',
      });

      // Modify component in Run 2
      const sofaInRun2 = run2.components[0];
      await takeoffService.updateTakeoffComponent(TENANT_A, run2.id, sofaInRun2.id, {
        componentName: 'Sofa biến đổi ở Run 2',
      });

      // Verify Run 1 component remains 100% untouched
      const runAfter = await takeoffService.getTakeoffRun(TENANT_A, runId);
      expect(runAfter!.components[0].componentName).toBe(sofaBefore.componentName);
      expect(runAfter!.components[0].componentName).toBe('Sofa da bò Ý');
    });
  });

  describe('7. Deduplication & Idempotency', () => {
    it('should return existing run when initializeTakeoffRun is called with duplicate idempotencyKey', async () => {
      const run1 = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Bóc tách lần 1',
        preparedBy: 'QS. Nguyễn Văn Quang',
        idempotencyKey: 'idemp-key-takeoff-001',
      });

      const run2 = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Bóc tách lần 1 (Retry do mạng rớt)',
        preparedBy: 'QS. Nguyễn Văn Quang',
        idempotencyKey: 'idemp-key-takeoff-001',
      });

      expect(run2.id).toBe(run1.id);
      expect(run2.title).toBe(run1.title);

      const allRuns = await takeoffService.listTakeoffRuns(TENANT_A, PROJECT_ID);
      expect(allRuns.length).toBe(1);
    });
  });

  describe('8. Gate 0: Tenant Isolation Verification', () => {
    it('should reject operations with missing or empty tenantId', async () => {
      await expect(
        takeoffService.initializeTakeoffRun({
          tenantId: '',
          projectId: PROJECT_ID,
          designRevisionId: approvedRevisionR1.id,
          title: 'Tampering Attempt',
          preparedBy: 'Attacker',
        }),
      ).rejects.toThrow(TenantIsolationViolationError);

      await expect(
        takeoffService.getTakeoffRun('', 'run-id'),
      ).rejects.toThrow(TenantIsolationViolationError);

      await expect(
        takeoffService.listTakeoffRuns('', PROJECT_ID),
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    it('should strictly isolate runs between Tenant A and Tenant B', async () => {
      const runA = await takeoffService.initializeTakeoffRun({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        designRevisionId: approvedRevisionR1.id,
        title: 'Tenant A Run',
        preparedBy: 'QS Alpha',
      });

      // Tenant B queries the same run ID -> must return null
      const runForB = await takeoffService.getTakeoffRun(TENANT_B, runA.id);
      expect(runForB).toBeNull();

      // Tenant B queries project runs -> must return empty
      const listForB = await takeoffService.listTakeoffRuns(TENANT_B, PROJECT_ID);
      expect(listForB).toEqual([]);
    });
  });
});

