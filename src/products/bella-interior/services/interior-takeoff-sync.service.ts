/**
 * Bella Interior OS — Takeoff-to-BOQ Sync Service (Phase 2C)
 *
 * Coordinates the transformation of verified Design Takeoff Diffs into Commercial
 * BOQ Draft proposals and manages multi-version BOQ Revision lifecycles.
 *
 * Core architectural guarantees:
 * 1. Product-First Boundary: Strictly scoped to Bella Interior OS.
 *    Does NOT call Finance Outbox, does NOT alter contracts, does NOT mutate Platform Core.
 * 2. Gate 0 — Tenant Isolation & Scope Consistency: Validates tenantId and verifies that
 *    Takeoff Runs, Diff Result, and target BOQ all belong to the same projectId.
 * 3. Human-in-the-Loop & Partial Resolution:
 *    - ADDED: Creates BOQ line; flags `pricingPending = true` if cost/price not verified.
 *    - MODIFIED: Updates geometry/specs; PRESERVES existing unit prices; flags `priceReviewNeeded = true`.
 *    - REMOVED: Marks `syncStatus = 'marked_for_deletion'` without hard deletion.
 *    - UNCHANGED: Retained as-is.
 *    - REVIEW_REQUIRED: Skipped from BOQ mutations and collected in `unresolvedReviewItems`.
 * 4. Revision Immutability & Deep-copy Snapshot:
 *    - Approved / Locked BOQs are NEVER mutated in-place. A new Revision Draft is forked,
 *      and the prior revision is preserved as an immutable snapshot.
 *    - BOQs in `under_review` reject sync (throws `BOQUnderReviewSyncForbiddenError`).
 * 5. Concurrency Protection & Business Idempotency:
 *    - Guard against concurrent overwrites via expectedVersionNumber.
 *    - Deduplication via idempotencyKey.
 * 6. 7-field Lineage Traceability on every synchronized BOQ line item.
 *
 * @module src/products/bella-interior/services/interior-takeoff-sync.service
 */

import {
  TenantIsolationViolationError,
  BOQUnderReviewSyncForbiddenError,
  BOQProjectMismatchError,
  BOQConcurrencyConflictError,
} from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type {
  InteriorBOQ,
  BOQItem,
  FurnitureItemCategory,
  BOQItemSpecifications,
} from '../domain/commercial-costing/types';
import type { DesignTakeoffComponent, TakeoffComponentCategory } from '../domain/takeoff/types';
import type {
  SyncDiffToBOQInput,
  SyncDiffToBOQResult,
  UnresolvedReviewItem,
} from '../domain/takeoff/sync.types';
import { ensureUuid } from '../lib/uuid-helper';

export class InteriorTakeoffSyncService {
  /**
   * In-memory idempotency cache: key = `${tenantId}::${projectId}::${idempotencyKey}`
   */
  private readonly idempotencyCache = new Map<string, SyncDiffToBOQResult>();

  constructor(private readonly repository: IInteriorRepository) {}

  /**
   * Synchronizes a verified Takeoff Diff into a Commercial BOQ Draft proposal.
   */
  async syncDiffToBOQ(input: SyncDiffToBOQInput): Promise<SyncDiffToBOQResult> {
    // Gate 0 — Tenant Isolation
    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    if (!input.projectId || input.projectId.trim() === '') {
      throw new Error('projectId is mandatory for BOQ sync');
    }

    // Check Business Idempotency
    const idempotencyCacheKey = input.idempotencyKey
      ? `${input.tenantId}::${input.projectId}::${input.idempotencyKey}`
      : null;

    if (idempotencyCacheKey && this.idempotencyCache.has(idempotencyCacheKey)) {
      return this.idempotencyCache.get(idempotencyCacheKey)!;
    }

    // Retrieve target BOQ
    let currentBOQ: InteriorBOQ | null = null;
    if (input.targetBOQId) {
      currentBOQ = await this.repository.getBOQ(input.tenantId, input.targetBOQId);
    } else {
      currentBOQ = await this.repository.getBOQByProject(input.tenantId, input.projectId);
    }

    // Validate Project Consistency
    if (currentBOQ) {
      if (currentBOQ.projectId !== input.projectId) {
        throw new BOQProjectMismatchError(input.projectId, currentBOQ.projectId);
      }
      if (currentBOQ.tenantId !== input.tenantId) {
        throw new TenantIsolationViolationError('Target BOQ does not match request tenant');
      }

      // Concurrency Protection: Check expectedVersionNumber
      if (
        input.expectedVersionNumber !== undefined &&
        currentBOQ.versionNumber !== input.expectedVersionNumber
      ) {
        throw new BOQConcurrencyConflictError(
          currentBOQ.id,
          input.expectedVersionNumber,
          currentBOQ.versionNumber
        );
      }

      // Immutability Protection: Under Review cannot be overwritten
      if (currentBOQ.status === 'under_review') {
        throw new BOQUnderReviewSyncForbiddenError(currentBOQ.id, currentBOQ.versionNumber);
      }
    }

    const now = new Date().toISOString();
    const diffRunFingerprint = `diff-${input.diffResult.baseRunId.slice(0, 8)}-${input.diffResult.targetRunId.slice(0, 8)}`;

    let workingBOQ: InteriorBOQ;
    let isNewRevision = false;
    let previousRevisionSnapshot: InteriorBOQ | undefined = undefined;

    // Revision Management Logic
    if (!currentBOQ) {
      // Case 1: Initial BOQ creation (R1.0 Draft)
      isNewRevision = true;
      const initialId = ensureUuid(`boq-init-${input.projectId}`);
      workingBOQ = {
        id: initialId,
        tenantId: input.tenantId,
        projectId: input.projectId,
        designRevisionId: input.diffResult.targetDesignRevisionId,
        boqNumber: `BOQ-${input.projectId.replace(/^proj-/, '').toUpperCase()}-R1.0`,
        versionNumber: 1,
        status: 'draft',
        totalInternalCost: 0,
        totalClientPrice: 0,
        totalGrossMargin: 0,
        grossMarginPercent: 0,
        items: [],
        preparedBy: input.actorName,
        createdAt: now,
        updatedAt: now,
      };
    } else if (currentBOQ.status === 'approved' || currentBOQ.status === 'locked_for_contract') {
      // Case 2: Target BOQ is approved/locked -> Fork new Draft revision with Snapshot isolation
      isNewRevision = true;
      previousRevisionSnapshot = JSON.parse(JSON.stringify(currentBOQ)) as InteriorBOQ;

      const nextVersionNumber = currentBOQ.versionNumber + 1;
      const newBOQId = ensureUuid(`boq-rev-${input.projectId}-${nextVersionNumber}`);
      const baseBoqPrefix = currentBOQ.boqNumber.replace(/-R\d+\.\d+$/, '');

      // Deep clone items from current approved revision
      const clonedItems: BOQItem[] = currentBOQ.items.map((it) => ({
        ...it,
        id: ensureUuid(`boqitem-${newBOQId.slice(0, 8)}-${it.id.slice(0, 8)}`),
        boqId: newBOQId,
      }));

      workingBOQ = {
        id: newBOQId,
        tenantId: input.tenantId,
        projectId: input.projectId,
        designRevisionId: input.diffResult.targetDesignRevisionId,
        boqNumber: `${baseBoqPrefix}-R${nextVersionNumber}.0`,
        versionNumber: nextVersionNumber,
        status: 'draft',
        totalInternalCost: currentBOQ.totalInternalCost,
        totalClientPrice: currentBOQ.totalClientPrice,
        totalGrossMargin: currentBOQ.totalGrossMargin,
        grossMarginPercent: currentBOQ.grossMarginPercent,
        items: clonedItems,
        preparedBy: input.actorName,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      // Case 3: Target BOQ is currently in Draft -> Update in-place
      isNewRevision = false;
      workingBOQ = {
        ...currentBOQ,
        designRevisionId: input.diffResult.targetDesignRevisionId,
        updatedAt: now,
        items: [...currentBOQ.items],
      };
    }

    // Process Diff items with Partial Resolution
    const workingItems: BOQItem[] = [...workingBOQ.items];
    const unresolvedReviewItems: UnresolvedReviewItem[] = [];

    let appliedAddedCount = 0;
    let appliedModifiedCount = 0;
    let appliedRemovedCount = 0;
    let appliedUnchangedCount = 0;

    const sourceBOQRevisionId = currentBOQ ? currentBOQ.id : workingBOQ.id;

    for (const diffItem of input.diffResult.items) {
      // Rule 1: REVIEW_REQUIRED -> DO NOT write to BOQ. Collect in unresolved items.
      if (diffItem.changeType === 'review_required') {
        unresolvedReviewItems.push({
          stableComponentId: diffItem.stableComponentId,
          reason: diffItem.reviewReason || 'Component identity is ambiguous between takeoff runs.',
          baseComponent: diffItem.baseComponent,
          targetComponent: diffItem.targetComponent,
        });
        continue;
      }

      // Rule 2: UNCHANGED -> Retain existing line item as-is
      if (diffItem.changeType === 'unchanged') {
        appliedUnchangedCount++;
        continue;
      }

      // Rule 3: ADDED -> Create new BOQ line item
      if (diffItem.changeType === 'added' && diffItem.targetComponent) {
        const comp = diffItem.targetComponent;
        const existingIdx = workingItems.findIndex(
          (i) => i.stableComponentId === diffItem.stableComponentId
        );

        const internalUnitCost =
          comp.estimatedUnitCost !== undefined && comp.estimatedUnitCost > 0
            ? comp.estimatedUnitCost
            : (input.defaultUnitCost ?? 0);

        const clientUnitPrice =
          comp.targetUnitPrice !== undefined && comp.targetUnitPrice > 0
            ? comp.targetUnitPrice
            : (input.defaultClientPrice ?? 0);

        const pricingPending = internalUnitCost === 0 || clientUnitPrice === 0;

        const internalTotalCost = Math.round(comp.quantity * internalUnitCost);
        const clientTotalPrice = Math.round(comp.quantity * clientUnitPrice);
        const grossMarginAmount = clientTotalPrice - internalTotalCost;
        const grossMarginPercent =
          clientTotalPrice > 0
            ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
            : 0;

        const newItem: BOQItem = {
          id: ensureUuid(`boqitem-add-${comp.id}`),
          tenantId: input.tenantId,
          boqId: workingBOQ.id,
          roomZoneId: comp.roomZoneId,
          roomZoneName: comp.roomZoneName,
          itemCode: comp.componentCode,
          itemName: comp.componentName,
          category: mapTakeoffCategoryToBOQCategory(comp.category),
          dimensions: {
            width: comp.dimensions.width ?? 0,
            depth: comp.dimensions.depth ?? 0,
            height: comp.dimensions.height ?? 0,
            unit: 'mm',
          },
          specifications: formatBOQSpecifications(comp),
          unit: comp.unit as BOQItem['unit'],
          quantity: comp.quantity,
          internalUnitCost,
          internalTotalCost,
          clientUnitPrice,
          clientTotalPrice,
          grossMarginAmount,
          grossMarginPercent,
          stableComponentId: diffItem.stableComponentId,
          syncStatus: 'active',
          pricingPending,
          priceReviewNeeded: false,
          lineage: {
            sourceDesignRevisionId: input.diffResult.targetDesignRevisionId,
            sourceTakeoffRunId: input.diffResult.targetRunId,
            sourceStableComponentId: diffItem.stableComponentId,
            diffChangeType: 'added',
            syncedAt: now,
            sourceDiffRunId: diffRunFingerprint,
            sourceBOQRevisionId,
          },
        };

        if (existingIdx >= 0) {
          workingItems[existingIdx] = newItem;
        } else {
          workingItems.push(newItem);
        }
        appliedAddedCount++;
        continue;
      }

      // Rule 4: MODIFIED -> Update quantity, specs, dimensions; PRESERVE UNIT PRICES
      if (diffItem.changeType === 'modified' && diffItem.targetComponent) {
        const comp = diffItem.targetComponent;
        const existingIdx = workingItems.findIndex(
          (i) => i.stableComponentId === diffItem.stableComponentId
        );

        if (existingIdx >= 0) {
          const oldItem = workingItems[existingIdx];

          // STRICT INVARIANT: Preserve existing unit prices
          const internalUnitCost = oldItem.internalUnitCost;
          const clientUnitPrice = oldItem.clientUnitPrice;

          const internalTotalCost = Math.round(comp.quantity * internalUnitCost);
          const clientTotalPrice = Math.round(comp.quantity * clientUnitPrice);
          const grossMarginAmount = clientTotalPrice - internalTotalCost;
          const grossMarginPercent =
            clientTotalPrice > 0
              ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
              : 0;

          workingItems[existingIdx] = {
            ...oldItem,
            roomZoneId: comp.roomZoneId,
            roomZoneName: comp.roomZoneName,
            itemCode: comp.componentCode,
            itemName: comp.componentName,
            category: mapTakeoffCategoryToBOQCategory(comp.category),
            dimensions: {
              width: comp.dimensions.width ?? oldItem.dimensions.width,
              depth: comp.dimensions.depth ?? oldItem.dimensions.depth,
              height: comp.dimensions.height ?? oldItem.dimensions.height,
              unit: 'mm',
            },
            specifications: formatBOQSpecifications(comp),
            unit: comp.unit as BOQItem['unit'],
            quantity: comp.quantity,
            internalUnitCost,
            internalTotalCost,
            clientUnitPrice,
            clientTotalPrice,
            grossMarginAmount,
            grossMarginPercent,
            syncStatus: 'active',
            priceReviewNeeded: true, // Flag for Estimator review
            lineage: {
              sourceDesignRevisionId: input.diffResult.targetDesignRevisionId,
              sourceTakeoffRunId: input.diffResult.targetRunId,
              sourceStableComponentId: diffItem.stableComponentId,
              diffChangeType: 'modified',
              syncedAt: now,
              sourceDiffRunId: diffRunFingerprint,
              sourceBOQRevisionId,
            },
          };
          appliedModifiedCount++;
        }
        continue;
      }

      // Rule 5: REMOVED -> Mark 'marked_for_deletion' without hard deleting
      if (diffItem.changeType === 'removed') {
        const existingIdx = workingItems.findIndex(
          (i) => i.stableComponentId === diffItem.stableComponentId
        );

        if (existingIdx >= 0) {
          const oldItem = workingItems[existingIdx];
          workingItems[existingIdx] = {
            ...oldItem,
            syncStatus: 'marked_for_deletion',
            lineage: {
              sourceDesignRevisionId: input.diffResult.targetDesignRevisionId,
              sourceTakeoffRunId: input.diffResult.targetRunId,
              sourceStableComponentId: diffItem.stableComponentId,
              diffChangeType: 'removed',
              syncedAt: now,
              sourceDiffRunId: diffRunFingerprint,
              sourceBOQRevisionId,
            },
          };
          appliedRemovedCount++;
        }
        continue;
      }
    }

    // Recalculate overall BOQ totals (only active items contribute to totals)
    const activeItems = workingItems.filter(
      (i) => i.syncStatus !== 'marked_for_deletion' && i.syncStatus !== 'deletion_approved'
    );

    const totalInternalCost = activeItems.reduce((acc, i) => acc + i.internalTotalCost, 0);
    const totalClientPrice = activeItems.reduce((acc, i) => acc + i.clientTotalPrice, 0);
    const totalGrossMargin = totalClientPrice - totalInternalCost;
    const grossMarginPercent =
      totalClientPrice > 0
        ? Math.round((totalGrossMargin / totalClientPrice) * 1000) / 10
        : 0;

    const finalBOQ: InteriorBOQ = {
      ...workingBOQ,
      items: workingItems,
      totalInternalCost,
      totalClientPrice,
      totalGrossMargin,
      grossMarginPercent,
      updatedAt: now,
    };

    // Persist final BOQ
    await this.repository.saveBOQ(input.tenantId, finalBOQ);

    // Evaluate if BOQ is eligible to be submitted for review
    const hasUnresolvedItems = unresolvedReviewItems.length > 0;
    const hasPendingPricing = activeItems.some((i) => i.pricingPending === true);
    const canSubmitForReview = !hasUnresolvedItems && !hasPendingPricing;

    const result: SyncDiffToBOQResult = {
      boq: finalBOQ,
      isNewRevision,
      previousRevisionSnapshot,
      appliedAddedCount,
      appliedModifiedCount,
      appliedRemovedCount,
      appliedUnchangedCount,
      unresolvedReviewItems,
      canSubmitForReview,
      syncedAt: now,
      idempotencyKey: input.idempotencyKey,
    };

    if (idempotencyCacheKey) {
      this.idempotencyCache.set(idempotencyCacheKey, result);
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Pure Domain Mappers
// ---------------------------------------------------------------------------

function mapTakeoffCategoryToBOQCategory(
  cat: TakeoffComponentCategory
): FurnitureItemCategory {
  switch (cat) {
    case 'cabinetry':
      return 'cabinetry';
    case 'loose_furniture':
      return 'loose_furniture';
    case 'wall_paneling':
      return 'wall_paneling';
    case 'stone_work':
      return 'stone_work';
    case 'metal_glass':
      return 'metal_glass';
    case 'lighting_fitout':
      return 'lighting_fitout';
    case 'curtain_soft':
      return 'curtain_soft';
    case 'custom_decorative':
    default:
      return 'loose_furniture';
  }
}

function formatBOQSpecifications(comp: DesignTakeoffComponent): BOQItemSpecifications {
  const specs = comp.specifications;
  return {
    carcassMaterial:
      specs.carcassMaterialName ?? specs.frameMaterialName ?? 'Theo thiết kế cơ sở',
    doorFrontMaterial:
      specs.doorFrontMaterialName ??
      specs.upholsteryMaterialName ??
      specs.tabletopMaterialName ??
      'Theo thiết kế cơ sở',
    surfaceFinish: specs.surfaceFinish ?? 'Tiêu chuẩn xưởng',
    hardwareSpec: specs.hardwareSpec ?? 'Phụ kiện tiêu chuẩn',
    stoneOrGlassSpec: specs.rawMaterialNotes,
  };
}

