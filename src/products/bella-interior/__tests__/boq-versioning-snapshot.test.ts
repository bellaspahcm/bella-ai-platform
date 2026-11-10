/**
 * Bella Interior OS — BOQ Versioning & Snapshotting — Unit Tests (Phase 1)
 *
 * Tests the full BOQ versioning lifecycle:
 * - Fork V1 → V2 (creates correct version numbers and boq_number)
 * - V1 snapshot immutability after fork (cannot mutate items or header)
 * - BOQ Revision Diff (compareRevisions): added, modified, removed, unchanged
 * - Lineage traceability: V2 items trace to same stableComponentId as V1
 * - Tenant isolation on fork (cannot fork another tenant's BOQ)
 * - Fork guard: cannot fork a draft or under_review BOQ
 * - Version history listing (ascending order, lineage metadata)
 * - Financial delta computation
 *
 * @module src/products/bella-interior/__tests__/boq-versioning-snapshot.test.ts
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorBOQRevisionDiffService } from '../services/interior-boq-revision-diff.service';
import type { InteriorBOQ, BOQItem } from '../domain/commercial-costing/types';
import type { BOQItemLineage } from '../domain/commercial-costing/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-0001-0000-000000000001';
const TENANT_B = 'tenant-bbb-0001-0000-000000000002';
const PROJECT_ID = 'proj-1111-0000-0000-000000000001';
const DESIGN_REV_ID = 'rev-9999-0000-0000-000000000001';
const ACTOR_ID = 'user-aaaa-0000-0000-000000000001';

function makeLineage(itemId: string): BOQItemLineage {
  return {
    sourceDesignRevisionId: DESIGN_REV_ID,
    sourceTakeoffRunId: 'run-1111-0000-0000-000000000001',
    sourceStableComponentId: itemId, // stableComponentId == itemId for fixtures
    diffChangeType: 'added',
    syncedAt: '2026-11-09T10:00:00.000Z',
    sourceDiffRunId: 'diff-run-001',
    sourceBOQRevisionId: 'boq-v1-0001',
  };
}

function makeItem(overrides: Partial<BOQItem> & { stableComponentId: string }): BOQItem {
  return {
    id: `item-${overrides.stableComponentId}`,
    tenantId: TENANT_A,
    boqId: 'boq-v1-0001',
    roomZoneId: 'zone-living',
    roomZoneName: 'Phòng khách',
    itemCode: `CODE-${overrides.stableComponentId}`,
    itemName: `Hạng mục ${overrides.stableComponentId}`,
    category: 'cabinetry',
    dimensions: { width: 2000, depth: 600, height: 850, unit: 'mm' },
    specifications: {
      carcassMaterial: 'MDF chống ẩm',
      doorFrontMaterial: 'Acrylic bóng',
      surfaceFinish: 'PU bóng',
      hardwareSpec: 'Blum Clip Top',
    },
    unit: 'bộ',
    quantity: 1,
    internalUnitCost: 10_000_000,
    internalTotalCost: 10_000_000,
    clientUnitPrice: 15_000_000,
    clientTotalPrice: 15_000_000,
    grossMarginAmount: 5_000_000,
    grossMarginPercent: 33.3,
    lineage: makeLineage(overrides.stableComponentId),
    syncStatus: 'active',
    ...overrides,
  };
}

function makeApprovedBOQ(id: string, versionNumber: number, items: BOQItem[]): InteriorBOQ {
  const totalInternal = items.reduce((s, i) => s + i.internalTotalCost, 0);
  const totalClient   = items.reduce((s, i) => s + i.clientTotalPrice, 0);
  const totalMargin   = totalClient - totalInternal;
  return {
    id,
    tenantId: TENANT_A,
    projectId: PROJECT_ID,
    designRevisionId: DESIGN_REV_ID,
    boqNumber: `BOQ-INT-PROJ-V${versionNumber}`,
    versionNumber,
    status: 'approved',
    totalInternalCost: totalInternal,
    totalClientPrice: totalClient,
    totalGrossMargin: totalMargin,
    grossMarginPercent: totalClient > 0 ? Math.round((totalMargin / totalClient) * 1000) / 10 : 0,
    items,
    preparedBy: 'estimator@bellaspa.vn',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function buildRepoWithV1(items: BOQItem[]): Promise<{ repo: InMemoryInteriorRepository; v1: InteriorBOQ }> {
  const repo = new InMemoryInteriorRepository();
  const v1 = makeApprovedBOQ('boq-v1-0001', 1, items);
  await repo.saveBOQ(TENANT_A, v1);
  return { repo, v1 };
}

// ---------------------------------------------------------------------------
// Tests: forkBOQRevision
// ---------------------------------------------------------------------------

describe('InMemoryInteriorRepository.forkBOQRevision', () => {
  const item1 = makeItem({ stableComponentId: 'comp-sofa-001', quantity: 1, internalUnitCost: 10_000_000, internalTotalCost: 10_000_000, clientUnitPrice: 15_000_000, clientTotalPrice: 15_000_000, grossMarginAmount: 5_000_000, grossMarginPercent: 33.3 });
  const item2 = makeItem({ stableComponentId: 'comp-table-002', quantity: 2, internalUnitCost: 5_000_000, internalTotalCost: 10_000_000, clientUnitPrice: 7_000_000, clientTotalPrice: 14_000_000, grossMarginAmount: 4_000_000, grossMarginPercent: 28.6 });

  test('forks approved BOQ into new draft with version_number + 1', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1, item2]);
    const v2 = await repo.forkBOQRevision(TENANT_A, {
      sourceBOQId: v1.id,
      actorId: ACTOR_ID,
      releaseNotes: 'Design change: sofa replaced',
    });

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe('draft');
    expect(v2.projectId).toBe(PROJECT_ID);
    expect(v2.tenantId).toBe(TENANT_A);
  });

  test('new BOQ number carries -V2 suffix', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });
    expect(v2.boqNumber).toBe('BOQ-INT-PROJ-V2');
  });

  test('forked_from_boq_id on V2 points to V1', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });
    const extended = v2 as typeof v2 & { forkedFromBoqId?: string | null };
    expect(extended.forkedFromBoqId).toBe(v1.id);
  });

  test('new draft BOQ inherits all items from V1 (deep copy)', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1, item2]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });
    expect(v2.items).toHaveLength(2);
    // Items have new IDs but same stableComponentId
    const stableIds = v2.items.map((i) => i.stableComponentId);
    expect(stableIds).toContain(item1.stableComponentId);
    expect(stableIds).toContain(item2.stableComponentId);
    // Items have different IDs than source
    const v2ItemIds = new Set(v2.items.map((i) => i.id));
    expect(v2ItemIds.has(item1.id)).toBe(false);
    expect(v2ItemIds.has(item2.id)).toBe(false);
  });

  test('7th lineage field: sourceBOQRevisionId set to original item ID', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });
    const v2Item = v2.items.find((i) => i.stableComponentId === item1.stableComponentId)!;
    expect(v2Item.lineage?.sourceBOQRevisionId).toBe(item1.id);
  });

  test('source V1 snapshot_sealed_at is set after fork', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });
    const sealedV1 = await repo.getBOQ(TENANT_A, v1.id) as InteriorBOQ & { snapshotSealedAt?: string | null };
    expect(sealedV1?.snapshotSealedAt).toBeTruthy();
  });

  test('release_notes stored on new draft', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, {
      sourceBOQId: v1.id,
      actorId: ACTOR_ID,
      releaseNotes: 'Changed sofa to sectional',
    }) as InteriorBOQ & { releaseNotes?: string | null };
    expect(v2.releaseNotes).toBe('Changed sofa to sectional');
  });

  test('GUARD: cannot fork a draft BOQ', async () => {
    const repo = new InMemoryInteriorRepository();
    const draftBOQ: InteriorBOQ = {
      ...makeApprovedBOQ('boq-draft-001', 1, [item1]),
      status: 'draft',
    };
    await repo.saveBOQ(TENANT_A, draftBOQ);
    await expect(
      repo.forkBOQRevision(TENANT_A, { sourceBOQId: 'boq-draft-001', actorId: ACTOR_ID })
    ).rejects.toThrow('BOQForkViolation');
  });

  test('GUARD: cannot fork an under_review BOQ', async () => {
    const repo = new InMemoryInteriorRepository();
    const reviewBOQ: InteriorBOQ = {
      ...makeApprovedBOQ('boq-review-001', 1, [item1]),
      status: 'under_review',
    };
    await repo.saveBOQ(TENANT_A, reviewBOQ);
    await expect(
      repo.forkBOQRevision(TENANT_A, { sourceBOQId: 'boq-review-001', actorId: ACTOR_ID })
    ).rejects.toThrow('BOQForkViolation');
  });

  test('GUARD: tenant isolation — cannot fork another tenant BOQ', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    // TENANT_B tries to fork TENANT_A's BOQ
    await expect(
      repo.forkBOQRevision(TENANT_B, { sourceBOQId: v1.id, actorId: ACTOR_ID })
    ).rejects.toThrow('BOQNotFound');
  });

  test('GUARD: source BOQ not found', async () => {
    const { repo } = await buildRepoWithV1([item1]);
    await expect(
      repo.forkBOQRevision(TENANT_A, { sourceBOQId: 'boq-nonexistent', actorId: ACTOR_ID })
    ).rejects.toThrow('BOQNotFound');
  });

  test('can fork locked_for_contract BOQ', async () => {
    const repo = new InMemoryInteriorRepository();
    const lockedBOQ: InteriorBOQ = {
      ...makeApprovedBOQ('boq-locked-001', 1, [item1]),
      status: 'locked_for_contract',
    };
    await repo.saveBOQ(TENANT_A, lockedBOQ);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: 'boq-locked-001', actorId: ACTOR_ID });
    expect(v2.status).toBe('draft');
    expect(v2.versionNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: V1 Snapshot Immutability after fork
// ---------------------------------------------------------------------------

describe('BOQ snapshot immutability after fork', () => {
  const item1 = makeItem({ stableComponentId: 'comp-wardrobe-001' });

  test('V1 items cannot be modified after fork (immutability guard)', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    // Attempt to saveBOQ on V1 (approved) with changed content — must fail
    const mutatedV1: InteriorBOQ = {
      ...v1,
      items: v1.items.map((i) => ({ ...i, quantity: 999 })),
    };
    await expect(repo.saveBOQ(TENANT_A, mutatedV1)).rejects.toThrow(/Immutability/i);
  });

  test('V2 modifications do not affect V1 snapshot', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    // Modify V2 by saving new version
    const modifiedV2: InteriorBOQ = {
      ...v2,
      items: v2.items.map((i) => ({ ...i, quantity: 999 })),
    };
    await repo.saveBOQ(TENANT_A, modifiedV2);

    // V1 must be unchanged
    const reloadedV1 = await repo.getBOQ(TENANT_A, v1.id);
    expect(reloadedV1?.items[0].quantity).toBe(item1.quantity);
  });
});

// ---------------------------------------------------------------------------
// Tests: BOQ Revision Diff — compareRevisions
// ---------------------------------------------------------------------------

describe('InteriorBOQRevisionDiffService.compareRevisions', () => {
  const baseItem1 = makeItem({ stableComponentId: 'comp-sofa-001', quantity: 1, clientUnitPrice: 15_000_000, clientTotalPrice: 15_000_000, internalUnitCost: 10_000_000, internalTotalCost: 10_000_000, grossMarginAmount: 5_000_000, grossMarginPercent: 33.3 });
  const baseItem2 = makeItem({ stableComponentId: 'comp-table-002', quantity: 2, clientUnitPrice: 7_000_000, clientTotalPrice: 14_000_000, internalUnitCost: 5_000_000, internalTotalCost: 10_000_000, grossMarginAmount: 4_000_000, grossMarginPercent: 28.6 });
  const baseItem3 = makeItem({ stableComponentId: 'comp-wardrobe-003', quantity: 1, clientUnitPrice: 20_000_000, clientTotalPrice: 20_000_000, internalUnitCost: 14_000_000, internalTotalCost: 14_000_000, grossMarginAmount: 6_000_000, grossMarginPercent: 30.0 });

  async function buildDiffRepoWithTwoRevisions(): Promise<{
    repo: InMemoryInteriorRepository;
    svc: InteriorBOQRevisionDiffService;
    baseBoqId: string;
    targetBoqId: string;
  }> {
    const repo = new InMemoryInteriorRepository();
    const svc  = new InteriorBOQRevisionDiffService(repo);

    // V1: items 1, 2, 3 (approved)
    const v1 = makeApprovedBOQ('boq-v1-diff', 1, [baseItem1, baseItem2, baseItem3]);
    await repo.saveBOQ(TENANT_A, v1);

    // Fork to V2 (draft)
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    // Modify V2: change quantity on item1, remove item3, add new item4
    const newItem4 = makeItem({ stableComponentId: 'comp-newchair-004', id: 'item-comp-newchair-004', boqId: v2.id, quantity: 4, clientUnitPrice: 3_000_000, clientTotalPrice: 12_000_000, internalUnitCost: 2_000_000, internalTotalCost: 8_000_000, grossMarginAmount: 4_000_000, grossMarginPercent: 33.3 });
    const v2Modified: InteriorBOQ = {
      ...v2,
      status: 'draft',
      items: [
        // item1 modified: quantity 1→3
        { ...v2.items.find((i) => i.stableComponentId === 'comp-sofa-001')!, quantity: 3, internalTotalCost: 30_000_000, clientTotalPrice: 45_000_000, grossMarginAmount: 15_000_000 },
        // item2 unchanged
        v2.items.find((i) => i.stableComponentId === 'comp-table-002')!,
        // item3 removed (not included)
        // item4 added
        newItem4,
      ],
      totalInternalCost: 30_000_000 + 10_000_000 + 8_000_000,
      totalClientPrice: 45_000_000 + 14_000_000 + 12_000_000,
      totalGrossMargin: 71_000_000 - 48_000_000,
      grossMarginPercent: 32.4,
    };
    await repo.saveBOQ(TENANT_A, v2Modified);

    return { repo, svc, baseBoqId: v1.id, targetBoqId: v2.id };
  }

  test('compareRevisions returns correct added/modified/removed/unchanged counts', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    expect(result.summary.addedCount).toBe(1);    // comp-newchair-004
    expect(result.summary.modifiedCount).toBe(1); // comp-sofa-001 (qty changed)
    expect(result.summary.removedCount).toBe(1);  // comp-wardrobe-003
    expect(result.summary.unchangedCount).toBe(1);// comp-table-002
    expect(result.summary.totalItems).toBe(4);
  });

  test('modified item has correct fieldDeltas (quantity)', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    const modified = result.modified.find((i) => i.stableComponentId === 'comp-sofa-001');
    expect(modified).toBeDefined();
    const qtyDelta = modified!.fieldDeltas?.find((d) => d.field === 'quantity');
    expect(qtyDelta).toBeDefined();
    expect(qtyDelta!.before).toBe(1);
    expect(qtyDelta!.after).toBe(3);
  });

  test('added item has null baseItemId', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    const added = result.added.find((i) => i.stableComponentId === 'comp-newchair-004');
    expect(added).toBeDefined();
    expect(added!.baseItemId).toBeNull();
    expect(added!.targetItemId).toBeTruthy();
  });

  test('removed item has null targetItemId', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    const removed = result.removed.find((i) => i.stableComponentId === 'comp-wardrobe-003');
    expect(removed).toBeDefined();
    expect(removed!.targetItemId).toBeNull();
    expect(removed!.baseItemId).toBeTruthy();
  });

  test('financial delta is computed correctly', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    // Base: totalClientPrice = 15M + 14M + 20M = 49M
    // Target: totalClientPrice = 45M + 14M + 12M = 71M → delta = +22M
    expect(result.financialDelta.totalPriceDelta).toBeGreaterThan(0);
  });

  test('metadata has correct boq numbers and project ID', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    const result = await svc.compareRevisions(TENANT_A, baseBoqId, targetBoqId);
    expect(result.metadata.baseVersionNumber).toBe(1);
    expect(result.metadata.targetVersionNumber).toBe(2);
    expect(result.metadata.projectId).toBe(PROJECT_ID);
  });

  test('GUARD: cannot compare BOQs with same ID', async () => {
    const { svc, baseBoqId } = await buildDiffRepoWithTwoRevisions();
    await expect(
      svc.compareRevisions(TENANT_A, baseBoqId, baseBoqId)
    ).rejects.toThrow('BOQDiffError');
  });

  test('GUARD: tenant isolation — cannot compare BOQ from other tenant', async () => {
    const { svc, baseBoqId, targetBoqId } = await buildDiffRepoWithTwoRevisions();
    await expect(
      svc.compareRevisions(TENANT_B, baseBoqId, targetBoqId)
    ).rejects.toThrow('BOQDiffError');
  });
});

// ---------------------------------------------------------------------------
// Tests: listBOQVersionHistory
// ---------------------------------------------------------------------------

describe('InMemoryInteriorRepository.listBOQVersionHistory', () => {
  const item1 = makeItem({ stableComponentId: 'comp-sofa-001' });

  test('returns empty array when no BOQ exists for project', async () => {
    const repo = new InMemoryInteriorRepository();
    const history = await repo.listBOQVersionHistory(TENANT_A, PROJECT_ID);
    expect(history).toHaveLength(0);
  });

  test('returns V1 without fork metadata when no fork has occurred', async () => {
    const { repo } = await buildRepoWithV1([item1]);
    const history = await repo.listBOQVersionHistory(TENANT_A, PROJECT_ID);
    expect(history).toHaveLength(1);
    expect(history[0].versionNumber).toBe(1);
    expect(history[0].forkedFromBoqId).toBeNull();
    expect(history[0].snapshotSealedAt).toBeNull();
  });

  test('after fork: returns V1 (sealed) and V2 (draft) in ascending order', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID, releaseNotes: 'First revision' });
    const history = await repo.listBOQVersionHistory(TENANT_A, PROJECT_ID);

    expect(history).toHaveLength(2);
    expect(history[0].versionNumber).toBe(1);
    expect(history[1].versionNumber).toBe(2);
    // V1 should be sealed
    expect(history[0].snapshotSealedAt).toBeTruthy();
    // V2 should point back to V1
    expect(history[1].forkedFromBoqId).toBe(v1.id);
    expect(history[1].forkedFromVersionNumber).toBe(1);
    expect(history[1].releaseNotes).toBe('First revision');
  });

  test('item count is correct for each version', async () => {
    const item2 = makeItem({ stableComponentId: 'comp-table-002' });
    const { repo, v1 } = await buildRepoWithV1([item1, item2]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    const history = await repo.listBOQVersionHistory(TENANT_A, PROJECT_ID);
    const v1History = history.find((h) => h.versionNumber === 1);
    const v2History = history.find((h) => h.versionNumber === 2);
    expect(v1History?.itemCount).toBe(2);
    expect(v2History?.itemCount).toBe(2);
  });

  test('GUARD: tenant isolation — does not leak other tenant history', async () => {
    const { repo, v1 } = await buildRepoWithV1([item1]);
    await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    const historyB = await repo.listBOQVersionHistory(TENANT_B, PROJECT_ID);
    expect(historyB).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Lineage traceability — BOQ V2 items trace to same stableComponentId
// ---------------------------------------------------------------------------

describe('BOQ lineage traceability across revisions', () => {
  test('V2 items preserve stableComponentId from V1 (Takeoff canonical)', async () => {
    const item1 = makeItem({ stableComponentId: 'comp-canonical-001' });
    const item2 = makeItem({ stableComponentId: 'comp-canonical-002' });
    const { repo, v1 } = await buildRepoWithV1([item1, item2]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    const v1StableIds = new Set(v1.items.map((i) => i.stableComponentId));
    const v2StableIds = new Set(v2.items.map((i) => i.stableComponentId));
    for (const sid of v1StableIds) {
      expect(v2StableIds.has(sid)).toBe(true);
    }
  });

  test('V2 items have lineage.sourceBOQRevisionId pointing to V1 item IDs', async () => {
    const item1 = makeItem({ stableComponentId: 'comp-canonical-003' });
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    const v2Item = v2.items.find((i) => i.stableComponentId === 'comp-canonical-003')!;
    expect(v2Item.lineage?.sourceBOQRevisionId).toBe(item1.id);
  });

  test('V2 items preserve sourceDesignRevisionId lineage from original design', async () => {
    const item1 = makeItem({ stableComponentId: 'comp-canonical-004' });
    const { repo, v1 } = await buildRepoWithV1([item1]);
    const v2 = await repo.forkBOQRevision(TENANT_A, { sourceBOQId: v1.id, actorId: ACTOR_ID });

    const v2Item = v2.items.find((i) => i.stableComponentId === 'comp-canonical-004')!;
    expect(v2Item.lineage?.sourceDesignRevisionId).toBe(DESIGN_REV_ID);
  });
});

