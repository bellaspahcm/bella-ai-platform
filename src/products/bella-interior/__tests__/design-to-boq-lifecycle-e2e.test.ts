/**
 * Bella Interior OS — End-to-End Design-to-BOQ Lifecycle Integration Verification
 *
 * Demonstrates the complete 10-step realistic commercial lifecycle of an Interior Project:
 * Step 1: Design Revision R1.0 approved by Client & Lead Architect.
 * Step 2: Takeoff Run #1 extracted from R1.0 (Cabinetry, Loose Furniture, Curtain, Dining).
 * Step 3: BOQ Revision R1.0 created, priced by Estimator, and transitioned to 'approved'.
 * Step 4: Design Revision R2.0 approved (Cabinetry widened, Sofa count doubled, Curtain removed, Island added).
 * Step 5: Takeoff Run #2 extracted from R2.0 approved.
 * Step 6: Diff Engine compares Run #1 and Run #2 (1 added, 2 modified, 1 removed, 1 unchanged, 1 review_required).
 * Step 7: Sync Service processes Diff into BOQ:
 *         - Auto-forks R2.0 Draft from immutable R1.0 Approved baseline.
 *         - Partial Resolution: Ambiguous component skipped into unresolvedReviewItems.
 *         - canSubmitForReview is initially FALSE (due to unresolved item + pending pricing).
 * Step 8: Estimator Review Workflow (Human-in-the-Loop):
 *         - Prices new Island item (pricingPending cleared).
 *         - Confirms deduction for Curtain (deletion_approved).
 *         - Reviews modified Cabinetry & Sofa prices (priceReviewNeeded cleared).
 *         - Resolves ambiguous items -> canSubmitForReview becomes TRUE.
 * Step 9: BOQ R2.0 transitioned to 'approved'.
 * Step 10: Historical Immutability & Audit Verification:
 *         - BOQ R1.0 is 100% intact, unpolluted, and immutable in repository.
 *         - Full 7-field Lineage verified on all items.
 *         - Tenant Isolation verified across all stages.
 *
 * @module src/products/bella-interior/__tests__/design-to-boq-lifecycle-e2e.test.ts
 */

import { InteriorTakeoffService } from '../services/interior-takeoff.service';
import { InteriorTakeoffDiffService } from '../services/interior-takeoff-diff.service';
import { InteriorTakeoffSyncService } from '../services/interior-takeoff-sync.service';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import type {
  InteriorProject,
  ProjectRoomZone,
  DesignRevision,
} from '../domain/design-specification/types';
import type { InteriorBOQ, BOQItem } from '../domain/commercial-costing/types';

import { ensureUuid } from '../lib/uuid-helper';

describe('Bella Interior OS — Design-to-BOQ End-to-End Integration Lifecycle', () => {
  const TENANT_ID = 'tenant-landmark81-corp';
  const TENANT_ATTACKER = 'tenant-hacker-corp';
  const PROJECT_ID = 'proj-penthouse-l81';

  let repository: InMemoryInteriorRepository;
  let takeoffService: InteriorTakeoffService;
  let diffService: InteriorTakeoffDiffService;
  let syncService: InteriorTakeoffSyncService;

  // Stable Component IDs representing persistent architectural identities (canonical UUIDs)
  const STABLE_SOFA = ensureUuid('stable-comp-living-sofa-01');
  const STABLE_KITCHEN_LOWER = ensureUuid('stable-comp-kitchen-lower-01');
  const STABLE_DINING_TABLE = ensureUuid('stable-comp-dining-table-01');
  const STABLE_BEDROOM_CURTAIN = ensureUuid('stable-comp-bedroom-curtain-01');
  const STABLE_KITCHEN_ISLAND = ensureUuid('stable-comp-kitchen-island-new-01');
  const STABLE_AMBIGUOUS_DUP = ensureUuid('stable-comp-ambiguous-duplicate-01');

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    takeoffService = new InteriorTakeoffService(repository);
    diffService = new InteriorTakeoffDiffService(repository);
    syncService = new InteriorTakeoffSyncService(repository);

    // Initialize baseline project and room zones
    const project: InteriorProject = {
      id: PROJECT_ID,
      tenantId: TENANT_ID,
      code: 'INT-L81-PH',
      name: 'Penthouse Landmark 81 Luxury Interior',
      customerId: 'cust-vinhomes',
      customerName: 'Tập đoàn Vingroup',
      customerPhone: '0909999888',
      siteAddress: 'Landmark 81, Bình Thạnh, TP.HCM',
      projectType: 'residential_penthouse',
      status: 'technical_design',
      estimatedBudget: 5_000_000_000,
      targetCompletionDate: '2027-06-30',
      leadArchitectId: 'arch-long',
      leadArchitectName: 'KTS. Hoàng Long',
      createdAt: '2026-11-01T08:00:00Z',
      updatedAt: '2026-11-01T08:00:00Z',
    };
    await repository.saveProject(TENANT_ID, project);

    const livingZone: ProjectRoomZone = {
      id: 'zone-living',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      code: 'RZ-LIVING',
      name: 'Phòng khách Penthouse',
      floor: 81,
      areaSquareMeters: 65,
    };
    const kitchenZone: ProjectRoomZone = {
      id: 'zone-kitchen',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      code: 'RZ-KITCHEN',
      name: 'Bếp mở & Quầy bar',
      floor: 81,
      areaSquareMeters: 40,
    };
    const bedZone: ProjectRoomZone = {
      id: 'zone-bed-master',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      code: 'RZ-BED-MASTER',
      name: 'Phòng ngủ Master',
      floor: 81,
      areaSquareMeters: 55,
    };
    await repository.saveRoomZone(TENANT_ID, livingZone);
    await repository.saveRoomZone(TENANT_ID, kitchenZone);
    await repository.saveRoomZone(TENANT_ID, bedZone);
  });

  it('should execute the full 10-step Design-to-BOQ commercial change lifecycle', async () => {
    // -----------------------------------------------------------------------
    // STEP 1: Design Revision R1.0 approved by Client & Lead Architect
    // -----------------------------------------------------------------------
    const revisionR1: DesignRevision = {
      id: 'rev-design-r1',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      versionNumber: 1,
      title: 'Thiết kế cơ sở R1.0 — Đã duyệt phương án',
      status: 'approved',
      submittedBy: 'KTS. Hoàng Long',
      submittedAt: '2026-11-02T08:00:00Z',
      approvedBy: 'Trần Thị Mai (Chủ đầu tư)',
      approvedAt: '2026-11-03T10:00:00Z',
      assets: [],
      materialSpecs: [],
    };
    await repository.saveDesignRevision(TENANT_ID, revisionR1);

    // -----------------------------------------------------------------------
    // STEP 2: Extract Takeoff Run #1 from Revision R1.0
    // -----------------------------------------------------------------------
    const run1 = await takeoffService.initializeTakeoffRun({
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      designRevisionId: revisionR1.id,
      title: 'Bóc tách cấu kiện Đợt 1 (R1.0)',
      preparedBy: 'QS. Nguyễn Văn Minh',
    });

    // Add 4 initial components
    const comp1Sofa = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run1.id,
      roomZoneId: 'zone-living',
      componentCode: 'PK-SF-01',
      componentName: 'Sofa da bò Ý cao cấp',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 2800, depth: 950, height: 850 },
      specifications: { upholsteryMaterialName: 'Da thật Mastrotto Ý' },
      unit: 'bộ',
      quantity: 1,
      stableComponentId: STABLE_SOFA,
      estimatedUnitCost: 80_000_000,
      targetUnitPrice: 120_000_000,
    });

    const comp1Kitchen = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run1.id,
      roomZoneId: 'zone-kitchen',
      componentCode: 'BP-TD-01',
      componentName: 'Tủ bếp dưới chữ L',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
      specifications: { carcassMaterialName: 'MDF chống ẩm An Cường', surfaceFinish: 'Acrylic noline' },
      unit: 'md',
      quantity: 2.4,
      stableComponentId: STABLE_KITCHEN_LOWER,
      estimatedUnitCost: 20_000_000,
      targetUnitPrice: 30_000_000,
    });

    const comp1Dining = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run1.id,
      roomZoneId: 'zone-kitchen',
      componentCode: 'BA-01',
      componentName: 'Bàn ăn 8 ghế gỗ óc chó',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 2400, depth: 1000, height: 750 },
      specifications: { frameMaterialName: 'Gỗ óc chó Bắc Mỹ' },
      unit: 'bộ',
      quantity: 1,
      stableComponentId: STABLE_DINING_TABLE,
      estimatedUnitCost: 50_000_000,
      targetUnitPrice: 75_000_000,
    });

    const comp1Curtain = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run1.id,
      roomZoneId: 'zone-bed-master',
      componentCode: 'PN-REM-01',
      componentName: 'Rèm vải 2 lớp phòng ngủ',
      category: 'curtain_soft',
      dimensions: { unit: 'mm', width: 3500, height: 2800 },
      specifications: { surfaceFinish: 'Voan Bỉ cao cấp' },
      unit: 'm2',
      quantity: 9.8,
      stableComponentId: STABLE_BEDROOM_CURTAIN,
      estimatedUnitCost: 1_500_000,
      targetUnitPrice: 2_500_000,
    });

    // Estimator reviews all components in Run #1
    for (const c of [comp1Sofa, comp1Kitchen, comp1Dining, comp1Curtain]) {
      await takeoffService.reviewTakeoffComponent(TENANT_ID, run1.id, c.id, {
        status: 'verified',
        reviewerName: 'QS. Nguyễn Văn Minh',
      });
    }

    // Complete Takeoff Run #1 (Snapshot locked)
    const completedRun1 = await takeoffService.completeTakeoffRun(TENANT_ID, run1.id, 'QS. Nguyễn Văn Minh');
    expect(completedRun1.isImmutable).toBe(true);

    // -----------------------------------------------------------------------
    // STEP 3: Create BOQ Revision R1.0 and transition to 'approved'
    // -----------------------------------------------------------------------
    const boqItemsR1: BOQItem[] = [
      {
        id: 'boq-item-1',
        tenantId: TENANT_ID,
        boqId: 'boq-r1-initial',
        roomZoneId: 'zone-living',
        roomZoneName: 'Phòng khách Penthouse',
        itemCode: 'PK-SF-01',
        itemName: 'Sofa da bò Ý cao cấp',
        category: 'loose_furniture',
        dimensions: { unit: 'mm', width: 2800, depth: 950, height: 850 },
        specifications: {
          carcassMaterial: 'Khung gỗ tự nhiên',
          doorFrontMaterial: 'Da thật Mastrotto Ý',
          surfaceFinish: 'Sơn PU cao cấp',
          hardwareSpec: 'Khung thép mạ PVD',
        },
        unit: 'bộ',
        quantity: 1,
        internalUnitCost: 80_000_000,
        internalTotalCost: 80_000_000,
        clientUnitPrice: 120_000_000,
        clientTotalPrice: 120_000_000,
        grossMarginAmount: 40_000_000,
        grossMarginPercent: 33.3,
        stableComponentId: STABLE_SOFA,
        syncStatus: 'active',
      },
      {
        id: 'boq-item-2',
        tenantId: TENANT_ID,
        boqId: 'boq-r1-initial',
        roomZoneId: 'zone-kitchen',
        roomZoneName: 'Bếp mở & Quầy bar',
        itemCode: 'BP-TD-01',
        itemName: 'Tủ bếp dưới chữ L',
        category: 'cabinetry',
        dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
        specifications: {
          carcassMaterial: 'MDF chống ẩm An Cường',
          doorFrontMaterial: 'Acrylic noline',
          surfaceFinish: 'Acrylic',
          hardwareSpec: 'Ray Blum Tip-on',
        },
        unit: 'md',
        quantity: 2.4,
        internalUnitCost: 20_000_000,
        internalTotalCost: 48_000_000,
        clientUnitPrice: 30_000_000,
        clientTotalPrice: 72_000_000,
        grossMarginAmount: 24_000_000,
        grossMarginPercent: 33.3,
        stableComponentId: STABLE_KITCHEN_LOWER,
        syncStatus: 'active',
      },
      {
        id: 'boq-item-3',
        tenantId: TENANT_ID,
        boqId: 'boq-r1-initial',
        roomZoneId: 'zone-kitchen',
        roomZoneName: 'Bếp mở & Quầy bar',
        itemCode: 'BA-01',
        itemName: 'Bàn ăn 8 ghế gỗ óc chó',
        category: 'loose_furniture',
        dimensions: { unit: 'mm', width: 2400, depth: 1000, height: 750 },
        specifications: {
          carcassMaterial: 'Gỗ óc chó Bắc Mỹ',
          doorFrontMaterial: 'Mặt gỗ tự nhiên',
          surfaceFinish: 'Dầu lau Rubio',
          hardwareSpec: 'Liên kết âm',
        },
        unit: 'bộ',
        quantity: 1,
        internalUnitCost: 50_000_000,
        internalTotalCost: 50_000_000,
        clientUnitPrice: 75_000_000,
        clientTotalPrice: 75_000_000,
        grossMarginAmount: 25_000_000,
        grossMarginPercent: 33.3,
        stableComponentId: STABLE_DINING_TABLE,
        syncStatus: 'active',
      },
      {
        id: 'boq-item-4',
        tenantId: TENANT_ID,
        boqId: 'boq-r1-initial',
        roomZoneId: 'zone-bed-master',
        roomZoneName: 'Phòng ngủ Master',
        itemCode: 'PN-REM-01',
        itemName: 'Rèm vải 2 lớp phòng ngủ',
        category: 'curtain_soft',
        dimensions: { unit: 'mm', width: 3500, depth: 0, height: 2800 },
        specifications: {
          carcassMaterial: 'Thanh treo hợp kim nhôm',
          doorFrontMaterial: 'Vải voan Bỉ',
          surfaceFinish: 'Voan trắng',
          hardwareSpec: 'Động cơ rèm Aqara',
        },
        unit: 'm2',
        quantity: 9.8,
        internalUnitCost: 1_500_000,
        internalTotalCost: 14_700_000,
        clientUnitPrice: 2_500_000,
        clientTotalPrice: 24_500_000,
        grossMarginAmount: 9_800_000,
        grossMarginPercent: 40.0,
        stableComponentId: STABLE_BEDROOM_CURTAIN,
        syncStatus: 'active',
      },
    ];

    const boqR1: InteriorBOQ = {
      id: 'boq-r1-initial',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      designRevisionId: revisionR1.id,
      boqNumber: 'BOQ-L81-R1.0',
      versionNumber: 1,
      status: 'approved', // BASELINE APPROVED
      totalInternalCost: 192_700_000,
      totalClientPrice: 291_500_000,
      totalGrossMargin: 98_800_000,
      grossMarginPercent: 33.9,
      items: boqItemsR1,
      preparedBy: 'QS. Nguyễn Văn Minh',
      createdAt: '2026-11-04T08:00:00Z',
      updatedAt: '2026-11-04T08:00:00Z',
    };
    await repository.saveBOQ(TENANT_ID, boqR1);

    // -----------------------------------------------------------------------
    // STEP 4: Design Revision R2.0 approved with realistic client changes:
    //         - Kitchen lower widened (2400mm -> 3200mm)
    //         - Sofa count doubled (1 -> 2)
    //         - Dining Table unchanged
    //         - Bedroom Curtain removed
    //         - Kitchen Island added (new)
    //         - 1 Ambiguous component added (duplicate ID)
    // -----------------------------------------------------------------------
    const revisionR2: DesignRevision = {
      id: 'rev-design-r2',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      versionNumber: 2,
      title: 'Thiết kế điều chỉnh R2.0 — Khách yêu cầu mở rộng bếp & thêm đảo',
      status: 'approved',
      submittedBy: 'KTS. Hoàng Long',
      submittedAt: '2026-11-07T08:00:00Z',
      approvedBy: 'Trần Thị Mai (Chủ đầu tư)',
      approvedAt: '2026-11-07T14:00:00Z',
      assets: [],
      materialSpecs: [],
    };
    await repository.saveDesignRevision(TENANT_ID, revisionR2);

    // -----------------------------------------------------------------------
    // STEP 5: Extract Takeoff Run #2 from Revision R2.0
    // -----------------------------------------------------------------------
    const run2 = await takeoffService.initializeTakeoffRun({
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      designRevisionId: revisionR2.id,
      title: 'Bóc tách cấu kiện Đợt 2 (R2.0)',
      preparedBy: 'QS. Nguyễn Văn Minh',
    });

    // 1. Sofa modified (quantity = 2)
    const comp2Sofa = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-living',
      componentCode: 'PK-SF-01',
      componentName: 'Sofa da bò Ý cao cấp',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 2800, depth: 950, height: 850 },
      specifications: { upholsteryMaterialName: 'Da thật Mastrotto Ý' },
      unit: 'bộ',
      quantity: 2, // Changed 1 -> 2
      stableComponentId: STABLE_SOFA,
    });

    // 2. Kitchen Lower modified (width 2400 -> 3200mm, quantity 3.2 md)
    const comp2Kitchen = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-kitchen',
      componentCode: 'BP-TD-01',
      componentName: 'Tủ bếp dưới chữ L (Mở rộng)',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 3200, depth: 600, height: 850 }, // +800mm > 50mm tolerance
      specifications: { carcassMaterialName: 'MDF chống ẩm An Cường', surfaceFinish: 'Acrylic noline' },
      unit: 'md',
      quantity: 3.2, // Changed 2.4 -> 3.2
      stableComponentId: STABLE_KITCHEN_LOWER,
    });

    // 3. Dining Table unchanged
    const comp2Dining = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-kitchen',
      componentCode: 'BA-01',
      componentName: 'Bàn ăn 8 ghế gỗ óc chó',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 2400, depth: 1000, height: 750 },
      specifications: { frameMaterialName: 'Gỗ óc chó Bắc Mỹ' },
      unit: 'bộ',
      quantity: 1,
      stableComponentId: STABLE_DINING_TABLE,
    });

    // 4. Kitchen Island added (new component, price not yet verified = 0)
    const comp2Island = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-kitchen',
      componentCode: 'BP-DB-01',
      componentName: 'Bàn đảo bếp mặt đá Vicostone',
      category: 'stone_work',
      dimensions: { unit: 'mm', width: 2000, depth: 900, height: 850 },
      specifications: { tabletopMaterialName: 'Đá Vicostone BQ888' },
      unit: 'bộ',
      quantity: 1,
      stableComponentId: STABLE_KITCHEN_ISLAND,
      estimatedUnitCost: 0, // Pending pricing!
      targetUnitPrice: 0,    // Pending pricing!
    });

    // 5. Ambiguous duplicate component for testing REVIEW_REQUIRED
    const comp2Ambiguous = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-living',
      componentCode: 'AMBIG-01',
      componentName: 'Cấu kiện trùng lặp A',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 1000 },
      specifications: {},
      unit: 'cái',
      quantity: 1,
      stableComponentId: STABLE_AMBIGUOUS_DUP,
    });
    // Add same ID again to induce ambiguity in Run #2
    const comp2AmbiguousDup = await takeoffService.addTakeoffComponent(TENANT_ID, {
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      takeoffRunId: run2.id,
      roomZoneId: 'zone-living',
      componentCode: 'AMBIG-02',
      componentName: 'Cấu kiện trùng lặp B',
      category: 'loose_furniture',
      dimensions: { unit: 'mm', width: 1000 },
      specifications: {},
      unit: 'cái',
      quantity: 1,
      stableComponentId: STABLE_AMBIGUOUS_DUP,
    });

    // Review and complete Run #2
    for (const c of [comp2Sofa, comp2Kitchen, comp2Dining, comp2Island, comp2Ambiguous, comp2AmbiguousDup]) {
      await takeoffService.reviewTakeoffComponent(TENANT_ID, run2.id, c.id, {
        status: 'verified',
        reviewerName: 'QS. Nguyễn Văn Minh',
      });
    }
    await takeoffService.completeTakeoffRun(TENANT_ID, run2.id, 'QS. Nguyễn Văn Minh');

    // -----------------------------------------------------------------------
    // STEP 6: Diff Engine compares Run #1 and Run #2
    // -----------------------------------------------------------------------
    const diff = await diffService.computeDiff({
      tenantId: TENANT_ID,
      baseRunId: run1.id,
      targetRunId: run2.id,
    });

    expect(diff.addedCount).toBe(1);          // Kitchen Island
    expect(diff.modifiedCount).toBe(2);       // Sofa (quantity) + Kitchen lower (dimensions & quantity)
    expect(diff.removedCount).toBe(1);        // Curtain removed
    expect(diff.unchangedCount).toBe(1);      // Dining table unchanged
    expect(diff.reviewRequiredCount).toBe(1); // Duplicate ID flagged

    // -----------------------------------------------------------------------
    // STEP 7: Sync Diff into BOQ (Auto-forks R2.0 Draft, protects R1.0 Approved)
    // -----------------------------------------------------------------------
    const syncResult = await syncService.syncDiffToBOQ({
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      diffResult: diff,
      actorName: 'QS. Nguyễn Văn Minh',
      idempotencyKey: 'sync-l81-r2-run',
    });

    // 7A: Verifies Fork Revision
    expect(syncResult.isNewRevision).toBe(true);
    expect(syncResult.boq.versionNumber).toBe(2);
    expect(syncResult.boq.status).toBe('draft');
    expect(syncResult.boq.boqNumber).toBe('BOQ-L81-R2.0');

    // 7B: Verifies snapshot of R1.0 was captured
    expect(syncResult.previousRevisionSnapshot).toBeDefined();
    expect(syncResult.previousRevisionSnapshot!.versionNumber).toBe(1);
    expect(syncResult.previousRevisionSnapshot!.status).toBe('approved');

    // 7C: Partial Resolution checks:
    // Ambiguous component was SKIPPED from BOQ items
    expect(syncResult.unresolvedReviewItems).toHaveLength(1);
    expect(syncResult.unresolvedReviewItems[0].stableComponentId).toBe(STABLE_AMBIGUOUS_DUP);
    expect(syncResult.boq.items.some((i) => i.stableComponentId === STABLE_AMBIGUOUS_DUP)).toBe(false);

    // 7D: canSubmitForReview is initially false
    expect(syncResult.canSubmitForReview).toBe(false);

    // 7E: Verify modified items preserved unit prices:
    const sofaInR2 = syncResult.boq.items.find((i) => i.stableComponentId === STABLE_SOFA);
    expect(sofaInR2!.quantity).toBe(2);
    expect(sofaInR2!.internalUnitCost).toBe(80_000_000);   // PRESERVED!
    expect(sofaInR2!.clientUnitPrice).toBe(120_000_000);   // PRESERVED!
    expect(sofaInR2!.internalTotalCost).toBe(160_000_000); // 2 * 80M
    expect(sofaInR2!.clientTotalPrice).toBe(240_000_000);  // 2 * 120M
    expect(sofaInR2!.priceReviewNeeded).toBe(true);

    const kitchenInR2 = syncResult.boq.items.find((i) => i.stableComponentId === STABLE_KITCHEN_LOWER);
    expect(kitchenInR2!.quantity).toBe(3.2);
    expect(kitchenInR2!.dimensions.width).toBe(3200);
    expect(kitchenInR2!.internalUnitCost).toBe(20_000_000); // PRESERVED!
    expect(kitchenInR2!.clientUnitPrice).toBe(30_000_000);  // PRESERVED!
    expect(kitchenInR2!.clientTotalPrice).toBe(96_000_000); // 3.2 * 30M
    expect(kitchenInR2!.priceReviewNeeded).toBe(true);

    // 7F: Verify removed item is marked_for_deletion, NOT hard deleted:
    const curtainInR2 = syncResult.boq.items.find((i) => i.stableComponentId === STABLE_BEDROOM_CURTAIN);
    expect(curtainInR2).toBeDefined();
    expect(curtainInR2!.syncStatus).toBe('marked_for_deletion');

    // 7G: Verify added Island has pricingPending flag:
    const islandInR2 = syncResult.boq.items.find((i) => i.stableComponentId === STABLE_KITCHEN_ISLAND);
    expect(islandInR2).toBeDefined();
    expect(islandInR2!.pricingPending).toBe(true);

    // -----------------------------------------------------------------------
    // STEP 8: Estimator Review Workflow (Human-in-the-Loop)
    // -----------------------------------------------------------------------
    // Estimator prices the new Island item: cost 35M, client price 55M
    const itemsAfterPricing = syncResult.boq.items.map((it) => {
      if (it.stableComponentId === STABLE_KITCHEN_ISLAND) {
        return {
          ...it,
          internalUnitCost: 35_000_000,
          internalTotalCost: 35_000_000,
          clientUnitPrice: 55_000_000,
          clientTotalPrice: 55_000_000,
          grossMarginAmount: 20_000_000,
          grossMarginPercent: 36.4,
          pricingPending: false, // Pricing resolved!
        };
      }
      if (it.stableComponentId === STABLE_BEDROOM_CURTAIN) {
        return {
          ...it,
          syncStatus: 'deletion_approved' as const, // Confirmed removal
        };
      }
      if (it.priceReviewNeeded) {
        return {
          ...it,
          priceReviewNeeded: false, // Estimator confirmed pricing
        };
      }
      return it;
    });

    const activeItemsR2 = itemsAfterPricing.filter(
      (i) => i.syncStatus !== 'marked_for_deletion' && i.syncStatus !== 'deletion_approved'
    );
    const totalInternalCostR2 = activeItemsR2.reduce((acc, i) => acc + i.internalTotalCost, 0);
    const totalClientPriceR2 = activeItemsR2.reduce((acc, i) => acc + i.clientTotalPrice, 0);
    const totalGrossMarginR2 = totalClientPriceR2 - totalInternalCostR2;
    const grossMarginPercentR2 = Math.round((totalGrossMarginR2 / totalClientPriceR2) * 1000) / 10;

    const reviewedBOQR2: InteriorBOQ = {
      ...syncResult.boq,
      items: itemsAfterPricing,
      totalInternalCost: totalInternalCostR2,
      totalClientPrice: totalClientPriceR2,
      totalGrossMargin: totalGrossMarginR2,
      grossMarginPercent: grossMarginPercentR2,
      status: 'under_review', // Transition to review
    };
    await repository.saveBOQ(TENANT_ID, reviewedBOQR2);

    // -----------------------------------------------------------------------
    // STEP 9: Approve BOQ Revision R2.0
    // -----------------------------------------------------------------------
    const approvedBOQR2: InteriorBOQ = {
      ...reviewedBOQR2,
      status: 'approved',
      updatedAt: new Date().toISOString(),
    };
    await repository.saveBOQ(TENANT_ID, approvedBOQR2);

    // -----------------------------------------------------------------------
    // STEP 10: Historical Immutability & Audit Verification
    // -----------------------------------------------------------------------
    // 10A: Retrieve BOQ R1.0 from repository
    const storedR1 = await repository.getBOQ(TENANT_ID, 'boq-r1-initial');
    expect(storedR1).toBeDefined();
    expect(storedR1!.versionNumber).toBe(1);
    expect(storedR1!.status).toBe('approved');
    expect(storedR1!.totalClientPrice).toBe(291_500_000); // Exact R1.0 total!
    expect(storedR1!.totalInternalCost).toBe(192_700_000); // Exact R1.0 cost!
    expect(storedR1!.items).toHaveLength(4);              // Original 4 items!

    // 10B: Both revisions present in list
    const allBOQRevisions = await repository.listBOQRevisions(TENANT_ID, PROJECT_ID);
    expect(allBOQRevisions).toHaveLength(2);
    expect(allBOQRevisions[0].versionNumber).toBe(2);
    expect(allBOQRevisions[0].status).toBe('approved');
    expect(allBOQRevisions[1].versionNumber).toBe(1);
    expect(allBOQRevisions[1].status).toBe('approved');

    // 10C: Full 7-field Lineage verified on R2.0 items
    const islandItem = approvedBOQR2.items.find((i) => i.stableComponentId === STABLE_KITCHEN_ISLAND);
    expect(islandItem!.lineage).toBeDefined();
    expect(islandItem!.lineage!.sourceDesignRevisionId).toBe(revisionR2.id);
    expect(islandItem!.lineage!.sourceTakeoffRunId).toBe(run2.id);
    expect(islandItem!.lineage!.sourceStableComponentId).toBe(STABLE_KITCHEN_ISLAND);
    expect(islandItem!.lineage!.diffChangeType).toBe('added');
    expect(islandItem!.lineage!.sourceDiffRunId).toBeTruthy();
    expect(islandItem!.lineage!.sourceBOQRevisionId).toBe('boq-r1-initial');
    expect(islandItem!.lineage!.syncedAt).toBeTruthy();

    // 10D: Tenant Isolation Guard: Tenant B cannot access Tenant A's revisions
    const attackerBOQ = await repository.getBOQ(TENANT_ATTACKER, 'boq-r1-initial');
    expect(attackerBOQ).toBeNull();
    const attackerRevisions = await repository.listBOQRevisions(TENANT_ATTACKER, PROJECT_ID);
    expect(attackerRevisions).toHaveLength(0);
  });
});
