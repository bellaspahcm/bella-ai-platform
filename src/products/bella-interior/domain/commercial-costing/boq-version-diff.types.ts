/**
 * Bella Interior OS — BOQ Revision Diff Domain Types
 *
 * Defines the contracts for comparing two BOQ revision snapshots item-by-item.
 * Items are matched by `stableComponentId` (same identity contract as Takeoff diff).
 * Financial delta fields (COGS, price, margin) are INTERNAL — must not be exposed
 * beyond the authorized commercial boundary.
 *
 * @module src/products/bella-interior/domain/commercial-costing/boq-version-diff.types
 */

import type { BOQItem, BOQItemLineage } from './types';

// ---------------------------------------------------------------------------
// Per-item diff classification
// ---------------------------------------------------------------------------

export type BOQRevisionDiffChangeType = 'added' | 'modified' | 'removed' | 'unchanged';

/**
 * Field-level before/after record for a modified BOQ item.
 * Only populated for items classified as 'modified'.
 */
export interface BOQItemFieldDelta {
  readonly field: string;
  readonly before: number | string | null;
  readonly after: number | string | null;
}

/**
 * A single BOQ item as it appears in a diff result.
 * Contains snapshot of the relevant version's data plus change metadata.
 */
export interface BOQRevisionDiffItem {
  /** Stable cross-revision identity — matches stableComponentId from Takeoff canonical */
  readonly stableComponentId: string;
  /** BOQ item ID in the target revision (null for 'removed' items) */
  readonly targetItemId: string | null;
  /** BOQ item ID in the base revision (null for 'added' items) */
  readonly baseItemId: string | null;
  readonly changeType: BOQRevisionDiffChangeType;
  readonly itemName: string;
  readonly roomZoneName: string;
  readonly category: string;
  /** Field-level deltas — only populated when changeType === 'modified' */
  readonly fieldDeltas?: readonly BOQItemFieldDelta[];
  /** Snapshot of target item data (null for 'removed') */
  readonly targetItem?: Pick<
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
  /** Snapshot of base item data (null for 'added') */
  readonly baseItem?: Pick<
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
  /** Lineage of the target item (tracing back to Takeoff and Design Revision) */
  readonly targetLineage?: BOQItemLineage;
}

// ---------------------------------------------------------------------------
// Financial summary delta
// ---------------------------------------------------------------------------

/**
 * Aggregate financial delta between two BOQ revisions.
 * Access restricted to roles with commercial authorization.
 */
export interface BOQRevisionFinancialDelta {
  /** Change in total COGS (internal cost) */
  readonly totalCogsDelta: number;
  readonly totalCogsDeltaFormatted: string;
  /** Change in total client price */
  readonly totalPriceDelta: number;
  readonly totalPriceDeltaFormatted: string;
  /** Change in gross margin amount */
  readonly totalMarginDelta: number;
  readonly totalMarginDeltaFormatted: string;
  /** Change in gross margin percent (percentage points) */
  readonly marginPercentDelta: number;
}

// ---------------------------------------------------------------------------
// Full revision diff result
// ---------------------------------------------------------------------------

export interface BOQRevisionDiffMetadata {
  readonly tenantId: string;
  readonly projectId: string;
  readonly baseBoqId: string;
  readonly baseVersionNumber: number;
  readonly baseBoqNumber: string;
  readonly targetBoqId: string;
  readonly targetVersionNumber: number;
  readonly targetBoqNumber: string;
  readonly computedAt: string; // ISO-8601
  readonly forkedFromBoqId: string | null; // null if base is not the direct parent of target
}

export interface BOQRevisionDiffResult {
  readonly metadata: BOQRevisionDiffMetadata;
  readonly added: readonly BOQRevisionDiffItem[];
  readonly modified: readonly BOQRevisionDiffItem[];
  readonly removed: readonly BOQRevisionDiffItem[];
  readonly unchanged: readonly BOQRevisionDiffItem[];
  /** Summary counts */
  readonly summary: {
    readonly addedCount: number;
    readonly modifiedCount: number;
    readonly removedCount: number;
    readonly unchangedCount: number;
    readonly totalItems: number;
  };
  /** Financial delta — requires commercial authorization to access */
  readonly financialDelta: BOQRevisionFinancialDelta;
}

// ---------------------------------------------------------------------------
// BOQ Version History item (for listing all revisions of a project)
// ---------------------------------------------------------------------------

export interface BOQVersionHistoryItem {
  readonly boqId: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly boqNumber: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly forkedFromBoqId: string | null;
  readonly forkedFromVersionNumber: number | null;
  readonly snapshotSealedAt: string | null;   // ISO-8601, null if not yet sealed
  readonly releaseNotes: string | null;
  readonly preparedBy: string;
  readonly createdAt: string;
  readonly totalClientPrice: number;
  readonly totalInternalCost: number;
  readonly totalGrossMargin: number;
  readonly grossMarginPercent: number;
  readonly itemCount: number;
}

// ---------------------------------------------------------------------------
// Fork input
// ---------------------------------------------------------------------------

export interface ForkBOQRevisionInput {
  /** ID of the source BOQ to fork from (must be 'approved' or 'locked_for_contract') */
  readonly sourceBOQId: string;
  /** Actor performing the fork (for audit trail) */
  readonly actorId: string;
  readonly actorName?: string;
  /** Optional release notes for the new revision */
  readonly releaseNotes?: string;
  /** Optional idempotency key */
  readonly idempotencyKey?: string;
}

