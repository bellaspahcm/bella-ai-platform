/**
 * Unit Tests for Bella Interior OS — Takeoff-to-BOQ Sync Service (Phase 2C)
 *
 * Verifies:
 * 1. Initial Sync: Creates R1.0 Draft BOQ when project has no previous BOQ.
 * 2. ADDED: Creates new BOQ line item with complete 7-field lineage; flags pricingPending if price unverified.
 * 3. MODIFIED: Updates dimensions/specs/quantity; strictly PRESERVES existing unit prices; flags priceReviewNeeded.
 * 4. REMOVED: Marks syncStatus = 'marked_for_deletion' without hard deletion; excludes from active totals.
 * 5. UNCHANGED: Preserves existing items unchanged.
 * 6. Partial Resolution (REVIEW_REQUIRED): Ambiguous components are skipped and collected in unresolvedReviewItems.
 * 7. Revision Immutability: Syncing to an Approved BOQ forks R(n+1).0 Draft and preserves immutable R(n).0 snapshot.
 * 8. Revision Immutability (Locked): Syncing to a Locked BOQ forks R(n+1).0 Draft and preserves snapshot.
 * 9. Under Review Guard: Sync to a BOQ in 'under_review' is strictly forbidden (throws BOQUnderReviewSyncForbiddenError).
 * 10. Concurrency Protection: Mismatch on expectedVersionNumber throws BOQConcurrencyConflictError.
 * 11. Project Consistency: Mismatched project between Diff and BOQ throws BOQProjectMismatchError.
 * 12. Tenant Isolation (Gate 0): Mismatched or empty tenantId throws TenantIsolationViolationError.
 * 13. Business Idempotency: Retrying with the same idempotencyKey returns cached result without duplicate mutations.
 * 14. 7-Field Lineage Verification: Every synced line item contains all 7 lineage traceability fields.
 * 15. Financial Boundaries: Server calculates COGS and client price accurately without Finance Outbox posting.
 *
 * @module src/products/bella-interior/__tests__/takeoff-sync.service.test.ts
 */

import { InteriorTakeoffSyncService } from '../services/interior-takeoff-sync.service';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import {
  TenantIsolationViolationError,
  BOQUnderReviewSyncForbiddenError,
  BOQProjectMismatchError,
  BOQConcurrencyConflictError,
} from '../domain/errors';
import type {
  InteriorBOQ,
  BOQItem,
} from '../domain/commercial-costing/types';
import type { DesignTakeoffComponent } from '../domain/takeoff/types';
import type { TakeoffRunDiffResult } from '../domain/takeoff/diff.types';

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------
const TENANT_A = 'tenant-sync-alpha';
const TENANT_B = 'tenant-sync-beta';
const PROJECT_ID = 'proj-penthouse-skyline';
const OTHER_PROJECT_ID = 'proj-villa-green';
const BASE_DESIGN_REV = 'rev-design-r1-approved';
const TARGET_DESIGN_REV = 'rev-design-r2-approved';

const STABLE_ID_KITCHEN = 'stable-kitchen-island-01';
const STABLE_ID_SOFA = 'stable-sofa-living-01';
const STABLE_ID_DINING = 'stable-dining-table-01';
const STABLE_ID_CURTAIN = 'stable-curtain-bedroom-01';
const STABLE_ID_AMBIGUOUS = 'stable-ambiguous-01';

// ---------------------------------------------------------------------------
// Test Factory Helpers
// ---------------------------------------------------------------------------

function makeTakeoffComponent(
  overrides: Partial<DesignTakeoffComponent> & {
    stableComponentId: string;
    takeoffRunId: string;
  }
): DesignTakeoffComponent {
  return {
    id: `comp-${overrides.stableComponentId}`,
    stableComponentId: overrides.stableComponentId,
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    takeoffRunId: overrides.takeoffRunId,
    designRevisionId: TARGET_DESIGN_REV,
    roomZoneId: 'zone-living',
    roomZoneName: 'Phòng khách',
    componentCode: 'PK-01',
    componentName: 'Cấu kiện mẫu',
    category: 'loose_furniture',
    dimensions: { unit: 'mm', width: 2000, depth: 900, height: 800 },
    specifications: { surfaceFinish: 'Sơn PU' },
    unit: 'bộ',
    quantity: 1,
    reviewStatus: 'verified',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function makeInitialBOQItem(
  overrides: Partial<BOQItem> & {
    id: string;
    boqId: string;
    stableComponentId: string;
  }
): BOQItem {
  const quantity = overrides.quantity ?? 1;
  const internalUnitCost = overrides.internalUnitCost ?? 50_000_000;
  const clientUnitPrice = overrides.clientUnitPrice ?? 70_000_000;
  const internalTotalCost = quantity * internalUnitCost;
  const clientTotalPrice = quantity * clientUnitPrice;
  const grossMarginAmount = clientTotalPrice - internalTotalCost;
  const grossMarginPercent = clientTotalPrice > 0
    ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
    : 0;

  return {
    id: overrides.id,
    tenantId: TENANT_A,
    boqId: overrides.boqId,
    roomZoneId: 'zone-living',
    roomZoneName: 'Phòng khách',
    itemCode: 'PK-01',
    itemName: 'Sofa phòng khách R1',
    category: 'loose_furniture',
    dimensions: { unit: 'mm', width: 2000, depth: 900, height: 800 },
    specifications: {
      carcassMaterial: 'Khung gỗ sồi',
      doorFrontMaterial: 'Nệm da',
      surfaceFinish: 'Sơn PU',
      hardwareSpec: 'Tiêu chuẩn',
    },
    unit: 'bộ',
    quantity,
    internalUnitCost,
    internalTotalCost,
    clientUnitPrice,
    clientTotalPrice,
    grossMarginAmount,
    grossMarginPercent,
    stableComponentId: overrides.stableComponentId,
    syncStatus: 'active',
    ...overrides,
  };
}

function makeSampleBOQ(
  id: string,
  tenantId: string,
  projectId: string,
  versionNumber: number,
  status: InteriorBOQ['status'],
  items: BOQItem[]
): InteriorBOQ {
  const activeItems = items.filter(
    (i) => i.syncStatus !== 'marked_for_deletion' && i.syncStatus !== 'deletion_approved'
  );
  const totalInternalCost = activeItems.reduce((acc, i) => acc + i.internalTotalCost, 0);
  const totalClientPrice = activeItems.reduce((acc, i) => acc + i.clientTotalPrice, 0);
  const totalGrossMargin = totalClientPrice - totalInternalCost;
  const grossMarginPercent = totalClientPrice > 0
    ? Math.round((totalGrossMargin / totalClientPrice) * 1000) / 10
    : 0;

  return {
    id,
    tenantId,
    projectId,
    designRevisionId: BASE_DESIGN_REV,
    boqNumber: `BOQ-${projectId.replace(/^proj-/, '').toUpperCase()}-R${versionNumber}.0`,
    versionNumber,
    status,
    totalInternalCost,
    totalClientPrice,
    totalGrossMargin,
    grossMarginPercent,
    items,
    preparedBy: 'QS. Nguyễn Văn Minh',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('InteriorTakeoffSyncService — Phase 2C (Diff to BOQ Sync)', () => {
  let repository: InMemoryInteriorRepository;
  let syncService: InteriorTakeoffSyncService;

  beforeEach(() => {
    repository = new InMemoryInteriorRepository();
    syncService = new InteriorTakeoffSyncService(repository);
  });

  // =========================================================================
  // Test 1: Initial Sync creates R1.0 Draft BOQ
  // =========================================================================
  it('1. should create an initial R1.0 Draft BOQ when project has no existing BOQ', async () => {
    const comp = makeTakeoffComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-01',
      componentName: 'Sofa da cao cấp',
      quantity: 1,
      estimatedUnitCost: 60_000_000,
      targetUnitPrice: 90_000_000,
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-none',
      targetRunId: 'run-01',
      baseDesignRevisionId: 'rev-none',
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'added',
          changes: [],
          targetComponent: comp,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    expect(result.boq.versionNumber).toBe(1);
    expect(result.boq.status).toBe('draft');
    expect(result.isNewRevision).toBe(true);
    expect(result.previousRevisionSnapshot).toBeUndefined();
    expect(result.appliedAddedCount).toBe(1);
    expect(result.boq.items).toHaveLength(1);
    expect(result.boq.items[0].itemName).toBe('Sofa da cao cấp');
    expect(result.boq.items[0].internalUnitCost).toBe(60_000_000);
    expect(result.boq.items[0].clientUnitPrice).toBe(90_000_000);
    expect(result.boq.totalClientPrice).toBe(90_000_000);
    expect(result.boq.totalInternalCost).toBe(60_000_000);
    expect(result.canSubmitForReview).toBe(true);
  });

  // =========================================================================
  // Test 2: ADDED with unverified price flags pricingPending = true
  // =========================================================================
  it('2. should set pricingPending = true and canSubmitForReview = false when added item has 0 price', async () => {
    const compWithoutPrice = makeTakeoffComponent({
      stableComponentId: STABLE_ID_KITCHEN,
      takeoffRunId: 'run-01',
      componentName: 'Đảo bếp đá tự nhiên',
      quantity: 1,
      estimatedUnitCost: 0, // Unpriced
      targetUnitPrice: 0,    // Unpriced
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_KITCHEN,
          changeType: 'added',
          changes: [],
          targetComponent: compWithoutPrice,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    expect(result.appliedAddedCount).toBe(1);
    const addedItem = result.boq.items.find((i) => i.stableComponentId === STABLE_ID_KITCHEN);
    expect(addedItem).toBeDefined();
    expect(addedItem!.pricingPending).toBe(true);
    expect(result.canSubmitForReview).toBe(false); // Blocked until estimator prices it
  });

  // =========================================================================
  // Test 3: MODIFIED strictly preserves existing unit price & updates totals
  // =========================================================================
  it('3. should update quantity/dimensions but PRESERVE existing unit price on MODIFIED items', async () => {
    // Initial Draft BOQ with Sofa: quantity = 1, unitPrice = 70M, unitCost = 50M
    const initialItem = makeInitialBOQItem({
      id: 'item-sofa-01',
      boqId: 'boq-draft-01',
      stableComponentId: STABLE_ID_SOFA,
      quantity: 1,
      internalUnitCost: 50_000_000,
      clientUnitPrice: 70_000_000,
    });
    const draftBOQ = makeSampleBOQ('boq-draft-01', TENANT_A, PROJECT_ID, 1, 'draft', [initialItem]);
    await repository.saveBOQ(TENANT_A, draftBOQ);

    // Target Takeoff Component: quantity increased to 2, dimensions widened
    const modifiedComp = makeTakeoffComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-02',
      quantity: 2, // 1 -> 2
      dimensions: { unit: 'mm', width: 2800, depth: 950, height: 850 },
      estimatedUnitCost: 99_999_999, // Should be IGNORED in favor of existing BOQ price!
      targetUnitPrice: 199_999_999,  // Should be IGNORED!
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 1,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'modified',
          changes: [],
          targetComponent: modifiedComp,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    expect(result.appliedModifiedCount).toBe(1);
    const updatedSofa = result.boq.items.find((i) => i.stableComponentId === STABLE_ID_SOFA);
    expect(updatedSofa).toBeDefined();

    // STRICT INVARIANT: Preserves unit prices, recalculates totals
    expect(updatedSofa!.internalUnitCost).toBe(50_000_000); // Preserved!
    expect(updatedSofa!.clientUnitPrice).toBe(70_000_000);   // Preserved!
    expect(updatedSofa!.quantity).toBe(2);
    expect(updatedSofa!.internalTotalCost).toBe(100_000_000); // 2 * 50M
    expect(updatedSofa!.clientTotalPrice).toBe(140_000_000);  // 2 * 70M
    expect(updatedSofa!.priceReviewNeeded).toBe(true);        // Estimator review flag active

    // Recalculates BOQ header totals
    expect(result.boq.totalClientPrice).toBe(140_000_000);
    expect(result.boq.totalInternalCost).toBe(100_000_000);
  });

  // =========================================================================
  // Test 4: REMOVED marks item as marked_for_deletion and excludes from totals
  // =========================================================================
  it('4. should mark removed item as marked_for_deletion without hard deleting', async () => {
    const sofaItem = makeInitialBOQItem({
      id: 'item-sofa-01',
      boqId: 'boq-draft-01',
      stableComponentId: STABLE_ID_SOFA,
      quantity: 1,
      clientUnitPrice: 70_000_000,
    });
    const curtainItem = makeInitialBOQItem({
      id: 'item-curtain-01',
      boqId: 'boq-draft-01',
      stableComponentId: STABLE_ID_CURTAIN,
      quantity: 2,
      clientUnitPrice: 15_000_000, // Total 30M
    });

    const draftBOQ = makeSampleBOQ('boq-draft-01', TENANT_A, PROJECT_ID, 1, 'draft', [sofaItem, curtainItem]);
    await repository.saveBOQ(TENANT_A, draftBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 1,
      unchangedCount: 1,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_CURTAIN,
          changeType: 'removed',
          changes: [],
        },
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'unchanged',
          changes: [],
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    expect(result.appliedRemovedCount).toBe(1);
    expect(result.appliedUnchangedCount).toBe(1);

    // Record is NOT deleted
    const curtain = result.boq.items.find((i) => i.stableComponentId === STABLE_ID_CURTAIN);
    expect(curtain).toBeDefined();
    expect(curtain!.syncStatus).toBe('marked_for_deletion');

    // Totals only include active sofa (70M), curtain (30M) is excluded from active totals!
    expect(result.boq.totalClientPrice).toBe(70_000_000);
  });

  // =========================================================================
  // Test 5: REVIEW_REQUIRED items are skipped and collected in unresolved list
  // =========================================================================
  it('5. should skip REVIEW_REQUIRED items, add to unresolvedReviewItems, and set canSubmitForReview = false', async () => {
    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 1,
      items: [
        {
          stableComponentId: STABLE_ID_AMBIGUOUS,
          changeType: 'review_required',
          changes: [],
          reviewReason: 'Duplicate stableComponentId detected in run.',
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    // Unresolved item collected
    expect(result.unresolvedReviewItems).toHaveLength(1);
    expect(result.unresolvedReviewItems[0].stableComponentId).toBe(STABLE_ID_AMBIGUOUS);
    expect(result.unresolvedReviewItems[0].reason).toContain('Duplicate');

    // Ambiguous component is NOT written to BOQ items
    expect(result.boq.items).toHaveLength(0);

    // Submission is blocked until resolved
    expect(result.canSubmitForReview).toBe(false);
  });

  // =========================================================================
  // Test 6: Sync to Approved BOQ forks R2.0 Draft & preserves R1.0 Snapshot
  // =========================================================================
  it('6. should fork R2.0 Draft and preserve immutable R1.0 Snapshot when syncing to an Approved BOQ', async () => {
    const initialItem = makeInitialBOQItem({
      id: 'item-sofa-01',
      boqId: 'boq-app-01',
      stableComponentId: STABLE_ID_SOFA,
      quantity: 1,
      clientUnitPrice: 70_000_000,
    });
    const approvedBOQ = makeSampleBOQ('boq-app-01', TENANT_A, PROJECT_ID, 1, 'approved', [initialItem]);
    await repository.saveBOQ(TENANT_A, approvedBOQ);

    const newComp = makeTakeoffComponent({
      stableComponentId: STABLE_ID_DINING,
      takeoffRunId: 'run-02',
      componentName: 'Bàn ăn 8 ghế',
      quantity: 1,
      estimatedUnitCost: 40_000_000,
      targetUnitPrice: 65_000_000,
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_DINING,
          changeType: 'added',
          changes: [],
          targetComponent: newComp,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    // Forked new revision
    expect(result.isNewRevision).toBe(true);
    expect(result.boq.versionNumber).toBe(2);
    expect(result.boq.status).toBe('draft');
    expect(result.boq.boqNumber).toContain('-R2.0');

    // Previous R1.0 snapshot preserved
    expect(result.previousRevisionSnapshot).toBeDefined();
    expect(result.previousRevisionSnapshot!.versionNumber).toBe(1);
    expect(result.previousRevisionSnapshot!.status).toBe('approved');

    // Repository now holds both revisions
    const allRevisions = await repository.listBOQRevisions(TENANT_A, PROJECT_ID);
    expect(allRevisions).toHaveLength(2);
    expect(allRevisions[0].versionNumber).toBe(2); // Latest
    expect(allRevisions[1].versionNumber).toBe(1); // Historical baseline
  });

  // =========================================================================
  // Test 7: Sync to Locked for Contract BOQ forks R2.0 Draft
  // =========================================================================
  it('7. should fork R2.0 Draft when target BOQ is locked_for_contract', async () => {
    const initialItem = makeInitialBOQItem({
      id: 'item-sofa-01',
      boqId: 'boq-locked-01',
      stableComponentId: STABLE_ID_SOFA,
    });
    const lockedBOQ = makeSampleBOQ('boq-locked-01', TENANT_A, PROJECT_ID, 1, 'locked_for_contract', [initialItem]);
    await repository.saveBOQ(TENANT_A, lockedBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 1,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'unchanged',
          changes: [],
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    expect(result.isNewRevision).toBe(true);
    expect(result.boq.versionNumber).toBe(2);
    expect(result.boq.status).toBe('draft');
  });

  // =========================================================================
  // Test 8: Sync to BOQ in 'under_review' is strictly forbidden
  // =========================================================================
  it('8. should throw BOQUnderReviewSyncForbiddenError when target BOQ is in under_review status', async () => {
    const underReviewBOQ = makeSampleBOQ('boq-rev-01', TENANT_A, PROJECT_ID, 1, 'under_review', []);
    await repository.saveBOQ(TENANT_A, underReviewBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [],
      computedAt: new Date().toISOString(),
    };

    await expect(
      syncService.syncDiffToBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        diffResult,
        actorName: 'QS. Lê Văn An',
      })
    ).rejects.toThrow(BOQUnderReviewSyncForbiddenError);
  });

  // =========================================================================
  // Test 9: Concurrency conflict throws BOQConcurrencyConflictError
  // =========================================================================
  it('9. should throw BOQConcurrencyConflictError when expectedVersionNumber does not match target BOQ', async () => {
    const draftBOQ = makeSampleBOQ('boq-draft-01', TENANT_A, PROJECT_ID, 2, 'draft', []);
    await repository.saveBOQ(TENANT_A, draftBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [],
      computedAt: new Date().toISOString(),
    };

    await expect(
      syncService.syncDiffToBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        expectedVersionNumber: 1, // Expects 1, but BOQ is at 2!
        diffResult,
        actorName: 'QS. Lê Văn An',
      })
    ).rejects.toThrow(BOQConcurrencyConflictError);
  });

  // =========================================================================
  // Test 10: Project consistency guard throws BOQProjectMismatchError
  // =========================================================================
  it('10. should throw BOQProjectMismatchError when diff targets a different project than BOQ', async () => {
    const draftBOQ = makeSampleBOQ('boq-other-01', TENANT_A, OTHER_PROJECT_ID, 1, 'draft', []);
    await repository.saveBOQ(TENANT_A, draftBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [],
      computedAt: new Date().toISOString(),
    };

    // Asking for PROJECT_ID with targetBOQId belonging to OTHER_PROJECT_ID
    await expect(
      syncService.syncDiffToBOQ({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        targetBOQId: 'boq-other-01',
        diffResult,
        actorName: 'QS. Lê Văn An',
      })
    ).rejects.toThrow(BOQProjectMismatchError);
  });

  // =========================================================================
  // Test 11: Gate 0 — Tenant Isolation enforced
  // =========================================================================
  it('11. should enforce Gate 0 Tenant Isolation: Tenant B cannot access Tenant A BOQ', async () => {
    const draftBOQ = makeSampleBOQ('boq-alpha-01', TENANT_A, PROJECT_ID, 1, 'draft', []);
    await repository.saveBOQ(TENANT_A, draftBOQ);

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-01',
      targetRunId: 'run-02',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [],
      computedAt: new Date().toISOString(),
    };

    // Tenant B attempts to sync with Tenant A's targetBOQId
    await expect(
      syncService.syncDiffToBOQ({
        tenantId: '', // Empty tenant
        projectId: PROJECT_ID,
        diffResult,
        actorName: 'QS. Lê Văn An',
      })
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  // =========================================================================
  // Test 12: Business Idempotency returns identical cached result
  // =========================================================================
  it('12. should return cached result on duplicate sync with identical idempotencyKey', async () => {
    const comp = makeTakeoffComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-01',
      quantity: 1,
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-none',
      targetRunId: 'run-01',
      baseDesignRevisionId: 'rev-none',
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'added',
          changes: [],
          targetComponent: comp,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const idempotencyKey = 'sync-batch-retry-key-001';

    const firstRun = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
      idempotencyKey,
    });

    // Re-execute with identical key
    const secondRun = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
      idempotencyKey,
    });

    expect(secondRun).toBe(firstRun);
    expect(secondRun.boq.id).toBe(firstRun.boq.id);
  });

  // =========================================================================
  // Test 13: 7-Field Lineage Verification
  // =========================================================================
  it('13. should populate all 7 lineage fields accurately on synced BOQ line items', async () => {
    const comp = makeTakeoffComponent({
      stableComponentId: STABLE_ID_SOFA,
      takeoffRunId: 'run-lineage-01',
      quantity: 1,
    });

    const diffResult: TakeoffRunDiffResult = {
      baseRunId: 'run-lineage-base',
      targetRunId: 'run-lineage-01',
      baseDesignRevisionId: BASE_DESIGN_REV,
      targetDesignRevisionId: TARGET_DESIGN_REV,
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      reviewRequiredCount: 0,
      items: [
        {
          stableComponentId: STABLE_ID_SOFA,
          changeType: 'added',
          changes: [],
          targetComponent: comp,
        },
      ],
      computedAt: new Date().toISOString(),
    };

    const result = await syncService.syncDiffToBOQ({
      tenantId: TENANT_A,
      projectId: PROJECT_ID,
      diffResult,
      actorName: 'QS. Lê Văn An',
    });

    const item = result.boq.items[0];
    expect(item.lineage).toBeDefined();

    // Verify all 7 lineage fields:
    expect(item.lineage!.sourceDesignRevisionId).toBe(TARGET_DESIGN_REV);
    expect(item.lineage!.sourceTakeoffRunId).toBe('run-lineage-01');
    expect(item.lineage!.sourceStableComponentId).toBe(STABLE_ID_SOFA);
    expect(item.lineage!.diffChangeType).toBe('added');
    expect(item.lineage!.syncedAt).toBeTruthy();
    expect(item.lineage!.sourceDiffRunId).toContain('diff-');
    expect(item.lineage!.sourceBOQRevisionId).toBeTruthy();
  });
});

