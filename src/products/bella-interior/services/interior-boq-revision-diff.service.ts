/**
 * Bella Interior OS — BOQ Revision Diff Service
 *
 * Compares two BOQ revision snapshots item-by-item using `stableComponentId`
 * as the cross-revision identity key (same contract as Takeoff canonical diff).
 *
 * Financial fields are included in the output but access to `financialDelta`
 * must be gated at the API layer by commercial authorization.
 *
 * @module src/products/bella-interior/services/interior-boq-revision-diff.service
 */

import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { BOQItem } from '../domain/commercial-costing/types';
import type {
  BOQRevisionDiffResult,
  BOQRevisionDiffItem,
  BOQItemFieldDelta,
  BOQRevisionDiffChangeType,
  BOQRevisionFinancialDelta,
} from '../domain/commercial-costing/boq-version-diff.types';
import { TenantIsolationViolationError } from '../domain/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVND(val: number): string {
  return `${Math.round(val).toLocaleString('en-US')} đ`;
}

function formatDelta(val: number): string {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  return `${sign}${Math.round(abs).toLocaleString('en-US')} đ`;
}

type ItemSnapshot = Pick<
  BOQItem,
  | 'quantity'
  | 'unit'
  | 'internalUnitCost'
  | 'internalTotalCost'
  | 'clientUnitPrice'
  | 'clientTotalPrice'
  | 'grossMarginAmount'
  | 'grossMarginPercent'
>;

function extractSnapshot(item: BOQItem): ItemSnapshot {
  return {
    quantity: item.quantity,
    unit: item.unit,
    internalUnitCost: item.internalUnitCost,
    internalTotalCost: item.internalTotalCost,
    clientUnitPrice: item.clientUnitPrice,
    clientTotalPrice: item.clientTotalPrice,
    grossMarginAmount: item.grossMarginAmount,
    grossMarginPercent: item.grossMarginPercent,
  };
}

function computeFieldDeltas(base: BOQItem, target: BOQItem): BOQItemFieldDelta[] {
  const deltas: BOQItemFieldDelta[] = [];

  if (base.quantity !== target.quantity) {
    deltas.push({ field: 'quantity', before: base.quantity, after: target.quantity });
  }
  if (base.unit !== target.unit) {
    deltas.push({ field: 'unit', before: base.unit, after: target.unit });
  }
  if (base.internalUnitCost !== target.internalUnitCost) {
    deltas.push({ field: 'internalUnitCost', before: base.internalUnitCost, after: target.internalUnitCost });
  }
  if (base.clientUnitPrice !== target.clientUnitPrice) {
    deltas.push({ field: 'clientUnitPrice', before: base.clientUnitPrice, after: target.clientUnitPrice });
  }
  if (base.itemName !== target.itemName) {
    deltas.push({ field: 'itemName', before: base.itemName, after: target.itemName });
  }

  // Specifications — compare JSON representation for structural changes
  const baseSpec = JSON.stringify(base.specifications);
  const targetSpec = JSON.stringify(target.specifications);
  if (baseSpec !== targetSpec) {
    deltas.push({ field: 'specifications', before: baseSpec, after: targetSpec });
  }

  return deltas;
}

function determineChangeType(
  baseItem: BOQItem | undefined,
  targetItem: BOQItem | undefined,
): BOQRevisionDiffChangeType {
  if (!baseItem && targetItem) return 'added';
  if (baseItem && !targetItem) return 'removed';
  if (!baseItem || !targetItem) return 'unchanged'; // defensive — should not happen

  const delta = computeFieldDeltas(baseItem, targetItem);
  return delta.length > 0 ? 'modified' : 'unchanged';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InteriorBOQRevisionDiffService {
  constructor(private readonly repo: IInteriorRepository) {}

  /**
   * Compares two BOQ revisions item-by-item by `stableComponentId`.
   *
   * @param tenantId - Tenant isolation gate (Gate 0)
   * @param baseBoqId - ID of the base (older) BOQ revision
   * @param targetBoqId - ID of the target (newer) BOQ revision to compare against
   * @returns Full diff result with per-item classification and financial delta
   */
  async compareRevisions(
    tenantId: string,
    baseBoqId: string,
    targetBoqId: string,
  ): Promise<BOQRevisionDiffResult> {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError();
    }
    if (baseBoqId === targetBoqId) {
      throw new Error('BOQDiffError: Base and target BOQ IDs must be different.');
    }

    // Load both revisions — tenant isolation enforced by repository
    const [baseBOQ, targetBOQ] = await Promise.all([
      this.repo.getBOQ(tenantId, baseBoqId),
      this.repo.getBOQ(tenantId, targetBoqId),
    ]);

    if (!baseBOQ) {
      throw new Error(`BOQDiffError: Base BOQ "${baseBoqId}" not found for tenant "${tenantId}".`);
    }
    if (!targetBOQ) {
      throw new Error(`BOQDiffError: Target BOQ "${targetBoqId}" not found for tenant "${tenantId}".`);
    }

    // Build lookup maps keyed by stableComponentId
    // Items without stableComponentId are keyed by itemCode as fallback
    const baseMap = new Map<string, BOQItem>();
    for (const item of baseBOQ.items) {
      const key = item.stableComponentId ?? item.itemCode;
      baseMap.set(key, item);
    }

    const targetMap = new Map<string, BOQItem>();
    for (const item of targetBOQ.items) {
      const key = item.stableComponentId ?? item.itemCode;
      targetMap.set(key, item);
    }

    // All unique stable IDs across both revisions
    const allKeys = new Set<string>([...baseMap.keys(), ...targetMap.keys()]);

    const added: BOQRevisionDiffItem[] = [];
    const modified: BOQRevisionDiffItem[] = [];
    const removed: BOQRevisionDiffItem[] = [];
    const unchanged: BOQRevisionDiffItem[] = [];

    for (const stableId of allKeys) {
      const baseItem = baseMap.get(stableId);
      const targetItem = targetMap.get(stableId);
      const changeType = determineChangeType(baseItem, targetItem);
      const representativeItem = targetItem ?? baseItem!;

      const diffItem: BOQRevisionDiffItem = {
        stableComponentId: stableId,
        targetItemId: targetItem?.id ?? null,
        baseItemId: baseItem?.id ?? null,
        changeType,
        itemName: representativeItem.itemName,
        roomZoneName: representativeItem.roomZoneName,
        category: representativeItem.category,
        fieldDeltas: changeType === 'modified' && baseItem && targetItem
          ? computeFieldDeltas(baseItem, targetItem)
          : undefined,
        targetItem: targetItem ? extractSnapshot(targetItem) : undefined,
        baseItem: baseItem ? extractSnapshot(baseItem) : undefined,
        targetLineage: targetItem?.lineage,
      };

      switch (changeType) {
        case 'added':    added.push(diffItem);     break;
        case 'modified': modified.push(diffItem);  break;
        case 'removed':  removed.push(diffItem);   break;
        case 'unchanged': unchanged.push(diffItem); break;
      }
    }

    // Financial delta
    const baseTotalCogs  = baseBOQ.totalInternalCost;
    const baseTotal      = baseBOQ.totalClientPrice;
    const baseMargin     = baseBOQ.totalGrossMargin;

    const targetTotalCogs = targetBOQ.totalInternalCost;
    const targetTotal     = targetBOQ.totalClientPrice;
    const targetMargin    = targetBOQ.totalGrossMargin;

    const cogsDelta    = targetTotalCogs - baseTotalCogs;
    const priceDelta   = targetTotal - baseTotal;
    const marginDelta  = targetMargin - baseMargin;
    const marginPctDelta = targetBOQ.grossMarginPercent - baseBOQ.grossMarginPercent;

    const financialDelta: BOQRevisionFinancialDelta = {
      totalCogsDelta: cogsDelta,
      totalCogsDeltaFormatted: formatDelta(cogsDelta),
      totalPriceDelta: priceDelta,
      totalPriceDeltaFormatted: formatDelta(priceDelta),
      totalMarginDelta: marginDelta,
      totalMarginDeltaFormatted: formatDelta(marginDelta),
      marginPercentDelta: Math.round(marginPctDelta * 10) / 10,
    };

    return {
      metadata: {
        tenantId,
        projectId: baseBOQ.projectId,
        baseBoqId,
        baseVersionNumber: baseBOQ.versionNumber,
        baseBoqNumber: baseBOQ.boqNumber,
        targetBoqId,
        targetVersionNumber: targetBOQ.versionNumber,
        targetBoqNumber: targetBOQ.boqNumber,
        computedAt: new Date().toISOString(),
        forkedFromBoqId: (targetBOQ as unknown as { forkedFromBoqId?: string | null }).forkedFromBoqId ?? null,
      },
      added,
      modified,
      removed,
      unchanged,
      summary: {
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        unchangedCount: unchanged.length,
        totalItems: allKeys.size,
      },
      financialDelta,
    };
  }
}

