/**
 * Unit Tests for Bella Interior OS — Takeoff Diff Engine (Phase 2B)
 *
 * Verifies:
 * 1. UNCHANGED: Identical component in both runs → unchanged
 * 2. ADDED: stableComponentId only in targetRun → added
 * 3. REMOVED: stableComponentId only in baseRun → removed
 * 4. MODIFIED (cabinetry): dimension width/depth/height change > 50mm → modified
 * 5. UNCHANGED (cabinetry small change): dimension change ≤ 50mm → unchanged (tolerance)
 * 6. MODIFIED (loose_furniture): quantity change → modified
 * 7. MODIFIED (loose_furniture): upholsteryMaterialName change → modified
 * 8. MODIFIED (all): unit change → modified
 * 9. MODIFIED (cabinetry): carcassMaterialName change → modified
 * 10. REVIEW_REQUIRED: Duplicate stableComponentId within same run → ambiguous
 * 11. Tenant Isolation: Tenant B cannot access Tenant A's runs
 * 12. Cross-project diff rejected: Runs from different projects throw error
 * 13. Base run not found: throws TakeoffRunNotFoundError
 * 14. Target run not found: throws TakeoffRunNotFoundError
 * 15. Accurate summary counts (addedCount, modifiedCount, removedCount, etc.)
 * 16. Mixed diff: Multiple change types in single computation
 * 17. Category change → modified
 *
 * @module src/products/bella-interior/__tests__/takeoff-diff.service.test.ts
 */

import { InteriorTakeoffDiffService } from '../services/interior-takeoff-diff.service';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import {
  TenantIsolationViolationError,
  TakeoffRunNotFoundError,
  TakeoffDiffRunMismatchError,
} from '../domain/errors';
import type { InteriorProject, ProjectRoomZone, DesignRevision } from '../domain/design-specification/types';
import type { DesignTakeoffRun, DesignTakeoffComponent } from '../domain/takeoff/types';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TENANT_A = 'tenant-diff-alpha';
const TENANT_B = 'tenant-diff-beta';
const PROJECT_ID = 'proj-diff-villa';
const PROJECT_B_ID = 'proj-diff-other';
const DESIGN_REV_R1 = 'rev-design-r1-approved';
const DESIGN_REV_R2 = 'rev-design-r2-approved';

// Stable IDs — these are the persistent identities used for matching
const STABLE_ID_SOFA = 'stable-sofa-living-01';
const STABLE_ID_KITCHEN_CABINET = 'stable-kitchen-cabinet-lower-01';
const STABLE_ID_CURTAIN = 'stable-curtain-master-01';
const STABLE_ID_WARDROBE = 'stable-wardrobe-bedroom-01';
const STABLE_ID_ADDED_IN_R2 = 'stable-island-kitchen-new';
const STABLE_ID_AMBIGUOUS = 'stable-ambiguous-duplicate';

// ---------------------------------------------------------------------------
// Test factory helpers
// ---------------------------------------------------------------------------

function makeProject(tenantId: string, projectId: string): InteriorProject {
  return {
    id: projectId,
    tenantId,
    code: `INT-${projectId}`,
    name: `Test Project ${projectId}`,
    customerId: 'cust-test',
    customerName: 'Test Customer',
    customerPhone: '0901234567',
    siteAddress: 'TP.HCM',
    projectType: 'residential_villa',
    status: 'technical_design',
    estimatedBudget: 1000000000,
    targetCompletionDate: '2027-01-01',
    leadArchitectId: 'arch-test',
    leadArchitectName: 'KTS. Test',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };
}

function makeZone(tenantId: string, projectId: string, zoneId: string): ProjectRoomZone {
  return {
    id: zoneId,
    tenantId,
    projectId,
    code: `RZ-${zoneId.toUpperCase()}`,
    name: `Khu vực ${zoneId}`,
    floor: 1,
    areaSquareMeters: 30,
  };
}

function makeRevision(tenantId: string, projectId: string, revId: string): DesignRevision {
  return {
    id: revId,
    tenantId,
    projectId,
    versionNumber: 1,
    title: `Thiết kế ${revId}`,
    status: 'approved',
    submittedBy: 'KTS. Test',
    submittedAt: '2026-11-01T08:00:00Z',
    approvedBy: 'PM Test',
    approvedAt: '2026-11-01T10:00:00Z',
    assets: [],
    materialSpecs: [],
  };
}

function makeComponent(overrides: Partial<DesignTakeoffComponent> & {
  stableComponentId: string;
  takeoffRunId: string;
}): DesignTakeoffComponent {
  return {
    id: `comp-${overrides.stableComponentId}-${overrides.takeoffRunId}`,
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    designRevisionId: DESIGN_REV_R1,
    roomZoneId: 'zone-living',
    roomZoneName: 'Phòng khách',
    componentCode: 'TEST-01',
    componentName: 'Test Component',
    category: 'loose_furniture',
    dimensions: { unit: 'mm', width: 2000, depth: 900, height: 800 },
    specifications: {},
    unit: 'bộ',
    quantity: 1,
    reviewStatus: 'verified',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function makeRun(
  runId: string,
  tenantId: string,
  projectId: string,
  designRevisionId: string,
  components: DesignTakeoffComponent[]
): DesignTakeoffRun {
  return {
    id: runId,
    tenantId,
    projectId,
    designRevisionId,
    runNumber: 1,
    title: `Takeoff Run ${runId}`,
    status: 'completed',
    isImmutable: true,
    preparedBy: 'QS. Tester',
    totalComponentsCount: components.length,
    pendingReviewCount: 0,
    verifiedCount: components.length,
    reviewRequiredCount: 0,
    components,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('InteriorTakeoffDiffService — Phase 2B (Diff Engine)', () => {
  let repository: InMemoryInteriorRepository;
  let diffService: InteriorTakeoffDiffService;

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    diffService = new InteriorTakeoffDiffService(repository);

    // Seed Tenant A infrastructure
    await repository.saveProject(TENANT_A, makeProject(TENANT_A, PROJECT_ID));
    await repository.saveRoomZone(TENANT_A, makeZone(TENANT_A, PROJECT_ID, 'zone-living'));
    await repository.saveRoomZone(TENANT_A, makeZone(TENANT_A, PROJECT_ID, 'zone-kitchen'));
    await repository.saveDesignRevision(TENANT_A, makeRevision(TENANT_A, PROJECT_ID, DESIGN_REV_R1));
    await repository.saveDesignRevision(TENANT_A, makeRevision(TENANT_A, PROJECT_ID, DESIGN_REV_R2));

    // Seed Tenant B infrastructure (for isolation test)
    await repository.saveProject(TENANT_B, makeProject(TENANT_B, PROJECT_B_ID));
    await repository.saveDesignRevision(TENANT_B, makeRevision(TENANT_B, PROJECT_B_ID, 'rev-b-r1'));
  });

  // =========================================================================
  // Test 1: UNCHANGED — Identical components in both runs
  // =========================================================================
  it('1. should return UNCHANGED for a component that is identical in both runs', async () => {
    const component = makeComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-base',
      category: 'loose_furniture',
      quantity: 1,
      unit: 'bộ',
      dimensions: { unit: 'mm', width: 2400, depth: 900, height: 850 },
      specifications: { upholsteryMaterialName: 'Da thật Ý nhập khẩu' },
    });
    const componentTarget = { ...component, takeoffRunId: 'run-target', id: `comp-${STABLE_ID_SOFA}-run-target` };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [component]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [componentTarget]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_SOFA);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('unchanged');
    expect(item!.changes).toHaveLength(0);
    expect(result.unchangedCount).toBe(1);
    expect(result.addedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
    expect(result.removedCount).toBe(0);
  });

  // =========================================================================
  // Test 2: ADDED — stableComponentId only in targetRun
  // =========================================================================
  it('2. should return ADDED for a component present only in target run', async () => {
    const baseComponent = makeComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-base',
    });
    const addedComponent = makeComponent({
      stableComponentId: STABLE_ID_ADDED_IN_R2,
      takeoffRunId: 'run-target',
      componentName: 'Bàn đảo bếp mới',
      category: 'stone_work',
    });
    const sofaTarget = { ...baseComponent, takeoffRunId: 'run-target', id: `comp-${STABLE_ID_SOFA}-run-target` };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComponent]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [sofaTarget, addedComponent]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const addedItem = result.items.find(i => i.stableComponentId === STABLE_ID_ADDED_IN_R2);
    expect(addedItem).toBeDefined();
    expect(addedItem!.changeType).toBe('added');
    expect(addedItem!.targetComponent).toBeDefined();
    expect(addedItem!.baseComponent).toBeUndefined();
    expect(result.addedCount).toBe(1);
    expect(result.unchangedCount).toBe(1);
  });

  // =========================================================================
  // Test 3: REMOVED — stableComponentId only in baseRun
  // =========================================================================
  it('3. should return REMOVED for a component present only in base run', async () => {
    const sofaBase = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-base' });
    const curtainBase = makeComponent({ stableComponentId: STABLE_ID_CURTAIN, takeoffRunId: 'run-base', category: 'curtain_soft' });
    const sofaTarget = { ...sofaBase, takeoffRunId: 'run-target', id: `comp-${STABLE_ID_SOFA}-run-target` };
    // Curtain is NOT in target → removed

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [sofaBase, curtainBase]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [sofaTarget]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const removedItem = result.items.find(i => i.stableComponentId === STABLE_ID_CURTAIN);
    expect(removedItem).toBeDefined();
    expect(removedItem!.changeType).toBe('removed');
    expect(removedItem!.baseComponent).toBeDefined();
    expect(removedItem!.targetComponent).toBeUndefined();
    expect(result.removedCount).toBe(1);
    expect(result.unchangedCount).toBe(1);
  });

  // =========================================================================
  // Test 4: MODIFIED (cabinetry) — dimension width change > 50mm
  // =========================================================================
  it('4. should return MODIFIED for cabinetry component with width change > 50mm', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_KITCHEN_CABINET,
      takeoffRunId: 'run-base',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
      specifications: { carcassMaterialName: 'MDF An Cường chống ẩm' },
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_KITCHEN_CABINET}-run-target`,
      dimensions: { unit: 'mm', width: 3000, depth: 600, height: 850 }, // +600mm > 50mm threshold
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_KITCHEN_CABINET);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const dimDiff = item!.changes.find(c => c.fieldName === 'dimensions');
    expect(dimDiff).toBeDefined();
    expect(dimDiff!.impactDescription).toContain('2400');
    expect(dimDiff!.impactDescription).toContain('3000');
    expect(result.modifiedCount).toBe(1);
  });

  // =========================================================================
  // Test 5: UNCHANGED (cabinetry) — dimension change ≤ 50mm (tolerance)
  // =========================================================================
  it('5. should return UNCHANGED for cabinetry dimension change ≤ 50mm (within tolerance)', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_KITCHEN_CABINET,
      takeoffRunId: 'run-base',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
      specifications: { carcassMaterialName: 'MDF An Cường chống ẩm' },
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_KITCHEN_CABINET}-run-target`,
      dimensions: { unit: 'mm', width: 2430, depth: 600, height: 850 }, // +30mm ≤ 50mm — within tolerance
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_KITCHEN_CABINET);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('unchanged');
    expect(item!.changes).toHaveLength(0);
    expect(result.unchangedCount).toBe(1);
    expect(result.modifiedCount).toBe(0);
  });

  // =========================================================================
  // Test 6: MODIFIED (loose_furniture) — quantity change
  // =========================================================================
  it('6. should return MODIFIED for loose_furniture with quantity change', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-base',
      category: 'loose_furniture',
      quantity: 1,
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_SOFA}-run-target`,
      quantity: 2, // Changed from 1 to 2
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_SOFA);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const qtyDiff = item!.changes.find(c => c.fieldName === 'quantity');
    expect(qtyDiff).toBeDefined();
    expect(qtyDiff!.oldValue).toBe('1');
    expect(qtyDiff!.newValue).toBe('2');
    expect(result.modifiedCount).toBe(1);
  });

  // =========================================================================
  // Test 7: MODIFIED (loose_furniture) — upholsteryMaterialName change
  // =========================================================================
  it('7. should return MODIFIED for loose_furniture with upholstery material change', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-base',
      category: 'loose_furniture',
      specifications: { upholsteryMaterialName: 'Da thật Ý nhập khẩu' },
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_SOFA}-run-target`,
      specifications: { upholsteryMaterialName: 'Nỉ Hàn Quốc cao cấp' }, // Changed
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_SOFA);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const matDiff = item!.changes.find(c => c.fieldName === 'materials');
    expect(matDiff).toBeDefined();
    expect(matDiff!.impactDescription).toContain('Da thật Ý');
    expect(matDiff!.impactDescription).toContain('Nỉ Hàn Quốc');
    expect(result.modifiedCount).toBe(1);
  });

  // =========================================================================
  // Test 8: MODIFIED (all categories) — unit change
  // =========================================================================
  it('8. should return MODIFIED for any category with unit change', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_WARDROBE,
      takeoffRunId: 'run-base',
      category: 'cabinetry',
      unit: 'bộ',
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_WARDROBE}-run-target`,
      unit: 'cái', // Changed
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_WARDROBE);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const unitDiff = item!.changes.find(c => c.fieldName === 'unit');
    expect(unitDiff).toBeDefined();
    expect(unitDiff!.oldValue).toBe('bộ');
    expect(unitDiff!.newValue).toBe('cái');
  });

  // =========================================================================
  // Test 9: MODIFIED (cabinetry) — carcassMaterialName change
  // =========================================================================
  it('9. should return MODIFIED for cabinetry with carcass material change', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_KITCHEN_CABINET,
      takeoffRunId: 'run-base',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
      specifications: { carcassMaterialName: 'MDF An Cường chống ẩm 18mm' },
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_KITCHEN_CABINET}-run-target`,
      specifications: { carcassMaterialName: 'Plywood Birch 18mm nhập khẩu' }, // Changed
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_KITCHEN_CABINET);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const matDiff = item!.changes.find(c => c.fieldName === 'materials');
    expect(matDiff).toBeDefined();
    expect(matDiff!.impactDescription).toContain('MDF An Cường');
    expect(matDiff!.impactDescription).toContain('Plywood Birch');
  });

  // =========================================================================
  // Test 10: REVIEW_REQUIRED — Duplicate stableComponentId within one run
  // =========================================================================
  it('10. should return REVIEW_REQUIRED when stableComponentId is duplicated in a run (ambiguity)', async () => {
    // Simulate a data quality issue: same stableComponentId appears twice in base run
    const dup1 = makeComponent({
      stableComponentId: STABLE_ID_AMBIGUOUS,
      takeoffRunId: 'run-base',
      id: 'comp-ambiguous-1',
      componentName: 'Duplicate record A',
    });
    const dup2: DesignTakeoffComponent = {
      ...dup1,
      id: 'comp-ambiguous-2',
      componentName: 'Duplicate record B',
    };
    const targetComp = makeComponent({
      stableComponentId: STABLE_ID_AMBIGUOUS,
      takeoffRunId: 'run-target',
      componentName: 'Target version',
    });

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [dup1, dup2]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_AMBIGUOUS);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('review_required');
    expect(item!.reviewReason).toBeDefined();
    expect(item!.reviewReason).toContain('Duplicate');
    expect(result.reviewRequiredCount).toBe(1);
  });

  // =========================================================================
  // Test 11: Tenant Isolation — Tenant B cannot access Tenant A's runs
  // =========================================================================
  it('11. should enforce tenant isolation: Tenant B cannot access Tenant A runs', async () => {
    const component = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-tenantA' });
    const baseRun = makeRun('run-tenantA-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [component]);
    const targetRun = makeRun('run-tenantA-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [component]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    // Tenant B attempts to access Tenant A's runs
    await expect(
      diffService.computeDiff({
        tenantId: TENANT_B,
        baseRunId: 'run-tenantA-base',
        targetRunId: 'run-tenantA-target',
      })
    ).rejects.toThrow(TakeoffRunNotFoundError);
  });

  // =========================================================================
  // Test 12: Cross-project diff rejected
  // =========================================================================
  it('12. should throw TakeoffDiffRunMismatchError when runs belong to different projects', async () => {
    const compA = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-projA' });
    const compB: DesignTakeoffComponent = {
      ...compA,
      projectId: PROJECT_B_ID,
      takeoffRunId: 'run-projB',
      id: 'comp-sofa-projB',
    };

    const runA = makeRun('run-projA', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [compA]);
    // Run B belongs to PROJECT_B_ID but under same tenant for this test
    const runB: DesignTakeoffRun = {
      ...makeRun('run-projB', TENANT_A, PROJECT_B_ID, 'rev-b-r1', [compB]),
      tenantId: TENANT_A,
      projectId: PROJECT_B_ID,
    };

    await repository.saveTakeoffRun(TENANT_A, runA);
    await repository.saveTakeoffRun(TENANT_A, runB);

    await expect(
      diffService.computeDiff({
        tenantId: TENANT_A,
        baseRunId: 'run-projA',
        targetRunId: 'run-projB',
      })
    ).rejects.toThrow(TakeoffDiffRunMismatchError);
  });

  // =========================================================================
  // Test 13: Base run not found
  // =========================================================================
  it('13. should throw TakeoffRunNotFoundError when base run does not exist', async () => {
    const targetComp = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-target' });
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    await expect(
      diffService.computeDiff({
        tenantId: TENANT_A,
        baseRunId: 'non-existent-base-run',
        targetRunId: 'run-target',
      })
    ).rejects.toThrow(TakeoffRunNotFoundError);
  });

  // =========================================================================
  // Test 14: Target run not found
  // =========================================================================
  it('14. should throw TakeoffRunNotFoundError when target run does not exist', async () => {
    const baseComp = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-base' });
    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    await repository.saveTakeoffRun(TENANT_A, baseRun);

    await expect(
      diffService.computeDiff({
        tenantId: TENANT_A,
        baseRunId: 'run-base',
        targetRunId: 'non-existent-target-run',
      })
    ).rejects.toThrow(TakeoffRunNotFoundError);
  });

  // =========================================================================
  // Test 15: Empty tenantId throws TenantIsolationViolationError
  // =========================================================================
  it('15. should throw TenantIsolationViolationError when tenantId is empty', async () => {
    await expect(
      diffService.computeDiff({
        tenantId: '',
        baseRunId: 'any-run',
        targetRunId: 'any-run-2',
      })
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  // =========================================================================
  // Test 16: Accurate summary counts — mixed diff
  // =========================================================================
  it('16. should produce accurate summary counts for a mixed diff result', async () => {
    // Base run: sofa (unchanged), cabinet (modified), curtain (removed)
    // Target run: sofa (unchanged), cabinet-modified, wardrobe (added)
    const sofaBase = makeComponent({ stableComponentId: STABLE_ID_SOFA, takeoffRunId: 'run-base', category: 'loose_furniture', quantity: 2 });
    const cabinetBase = makeComponent({ stableComponentId: STABLE_ID_KITCHEN_CABINET, takeoffRunId: 'run-base', category: 'cabinetry', dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 }, specifications: {} });
    const curtainBase = makeComponent({ stableComponentId: STABLE_ID_CURTAIN, takeoffRunId: 'run-base', category: 'curtain_soft' });

    const sofaTarget: DesignTakeoffComponent = { ...sofaBase, takeoffRunId: 'run-target', id: 'comp-sofa-target' };
    const cabinetTarget: DesignTakeoffComponent = {
      ...cabinetBase,
      takeoffRunId: 'run-target',
      id: 'comp-cabinet-target',
      dimensions: { unit: 'mm', width: 3200, depth: 600, height: 850 }, // +800mm > 50mm → MODIFIED
    };
    const wardrobeAdded = makeComponent({ stableComponentId: STABLE_ID_WARDROBE, takeoffRunId: 'run-target', category: 'cabinetry' });

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [sofaBase, cabinetBase, curtainBase]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [sofaTarget, cabinetTarget, wardrobeAdded]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    expect(result.addedCount).toBe(1);     // wardrobe
    expect(result.modifiedCount).toBe(1);  // cabinet (width +800mm)
    expect(result.removedCount).toBe(1);   // curtain
    expect(result.unchangedCount).toBe(1); // sofa
    expect(result.reviewRequiredCount).toBe(0);
    expect(result.items).toHaveLength(4);
    expect(result.baseRunId).toBe('run-base');
    expect(result.targetRunId).toBe('run-target');
    expect(result.baseDesignRevisionId).toBe(DESIGN_REV_R1);
    expect(result.targetDesignRevisionId).toBe(DESIGN_REV_R2);
    expect(result.computedAt).toBeTruthy();
  });

  // =========================================================================
  // Test 17: Category change → MODIFIED
  // =========================================================================
  it('17. should return MODIFIED when component category changes between runs', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_WARDROBE,
      takeoffRunId: 'run-base',
      category: 'loose_furniture',
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: `comp-${STABLE_ID_WARDROBE}-target`,
      category: 'cabinetry', // Category changed
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_WARDROBE);
    expect(item).toBeDefined();
    expect(item!.changeType).toBe('modified');
    const catDiff = item!.changes.find(c => c.fieldName === 'category');
    expect(catDiff).toBeDefined();
    expect(catDiff!.oldValue).toBe('loose_furniture');
    expect(catDiff!.newValue).toBe('cabinetry');
  });

  // =========================================================================
  // Test 18: Empty runs → empty diff result with zero counts
  // =========================================================================
  it('18. should return empty diff result when both runs have no components', async () => {
    const baseRun = makeRun('run-empty-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, []);
    const targetRun = makeRun('run-empty-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, []);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-empty-base',
      targetRunId: 'run-empty-target',
    });

    expect(result.addedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.unchangedCount).toBe(0);
    expect(result.reviewRequiredCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  // =========================================================================
  // Test 19: Cabinetry dimension exactly at 50mm threshold → UNCHANGED (boundary)
  // =========================================================================
  it('19. should return UNCHANGED for cabinetry dimension change exactly at 50mm threshold (boundary)', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_KITCHEN_CABINET,
      takeoffRunId: 'run-base',
      category: 'cabinetry',
      dimensions: { unit: 'mm', width: 2400, depth: 600, height: 850 },
      specifications: {},
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: 'comp-cabinet-target',
      dimensions: { unit: 'mm', width: 2450, depth: 600, height: 850 }, // exactly 50mm — NOT > 50mm
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_KITCHEN_CABINET);
    expect(item!.changeType).toBe('unchanged'); // 50mm exactly is NOT > 50mm
  });

  // =========================================================================
  // Test 20: surfaceFinish change → MODIFIED (all categories)
  // =========================================================================
  it('20. should return MODIFIED for surface finish change (all categories)', async () => {
    const baseComp = makeComponent({
      stableComponentId: STABLE_ID_WARDROBE,
      takeoffRunId: 'run-base',
      category: 'wall_paneling',
      specifications: { surfaceFinish: 'Sơn PU Inchem trắng ngà' },
    });
    const targetComp: DesignTakeoffComponent = {
      ...baseComp,
      takeoffRunId: 'run-target',
      id: 'comp-wardrobe-target',
      specifications: { surfaceFinish: 'Acrylic bóng gương' }, // Changed
    };

    const baseRun = makeRun('run-base', TENANT_A, PROJECT_ID, DESIGN_REV_R1, [baseComp]);
    const targetRun = makeRun('run-target', TENANT_A, PROJECT_ID, DESIGN_REV_R2, [targetComp]);

    await repository.saveTakeoffRun(TENANT_A, baseRun);
    await repository.saveTakeoffRun(TENANT_A, targetRun);

    const result = await diffService.computeDiff({
      tenantId: TENANT_A,
      baseRunId: 'run-base',
      targetRunId: 'run-target',
    });

    const item = result.items.find(i => i.stableComponentId === STABLE_ID_WARDROBE);
    expect(item!.changeType).toBe('modified');
    const matDiff = item!.changes.find(c => c.fieldName === 'materials');
    expect(matDiff).toBeDefined();
    expect(matDiff!.impactDescription).toContain('Sơn PU Inchem');
    expect(matDiff!.impactDescription).toContain('Acrylic bóng gương');
  });
});
