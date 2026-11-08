/**
 * Bella Interior OS — Takeoff-to-BOQ Sync Domain Types (Phase 2C)
 *
 * Defines contracts for transforming verified Takeoff Diffs into commercial
 * BOQ Draft proposals and Revision management.
 *
 * Implements:
 * 1. Partial Resolution: Distinct handling of ADDED, MODIFIED, REMOVED, UNCHANGED, and REVIEW_REQUIRED
 * 2. 7-field Lineage traceability contract
 * 3. Human-in-the-Loop review flags (pricingPending, priceReviewNeeded)
 * 4. Idempotency & Concurrency protection
 * 5. Revision Immutability & Deep-copy Snapshot
 *
 * @module src/products/bella-interior/domain/takeoff/sync.types
 */

import type { InteriorBOQ, BOQItemSyncStatus, BOQItemLineage } from '../commercial-costing/types';
import type { DesignTakeoffComponent } from './types';
import type { TakeoffRunDiffResult } from './diff.types';

export { BOQItemSyncStatus, BOQItemLineage };

/**
 * An item requiring manual Estimator resolution that cannot be automatically
 * synced to the commercial BOQ.
 */
export interface UnresolvedReviewItem {
  readonly stableComponentId: string;
  readonly reason: string;
  readonly baseComponent?: DesignTakeoffComponent;
  readonly targetComponent?: DesignTakeoffComponent;
}

/**
 * Input DTO for syncing a Takeoff Diff into a Commercial BOQ.
 */
export interface SyncDiffToBOQInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly diffResult: TakeoffRunDiffResult;
  readonly actorName: string;
  /** If specified, sync targets this specific BOQ. Otherwise finds latest by project. */
  readonly targetBOQId?: string;
  /** Concurrency guard: expected versionNumber of target BOQ. Throws if mismatch. */
  readonly expectedVersionNumber?: number;
  /** Deduplication key to prevent redundant duplicate sync batches. */
  readonly idempotencyKey?: string;
  /** Default unit cost if added component has no estimated cost (defaults to 0). */
  readonly defaultUnitCost?: number;
  /** Default client price if added component has no target price (defaults to 0). */
  readonly defaultClientPrice?: number;
}

/**
 * Output DTO returned upon completing a Sync operation.
 */
export interface SyncDiffToBOQResult {
  /** The resulting BOQ (either updated Draft or newly created Draft revision). */
  readonly boq: InteriorBOQ;
  /** Whether a new revision was forked from an approved/locked baseline. */
  readonly isNewRevision: boolean;
  /** Immutable deep-copy snapshot of the previous revision if a new revision was forked. */
  readonly previousRevisionSnapshot?: InteriorBOQ;
  /** Number of newly added items applied to BOQ. */
  readonly appliedAddedCount: number;
  /** Number of modified items updated in BOQ. */
  readonly appliedModifiedCount: number;
  /** Number of items marked for deletion/deduction in BOQ. */
  readonly appliedRemovedCount: number;
  /** Number of items copied unchanged. */
  readonly appliedUnchangedCount: number;
  /** Unresolved items that were skipped and require manual Estimator resolution. */
  readonly unresolvedReviewItems: readonly UnresolvedReviewItem[];
  /** Whether the BOQ is ready to be submitted for approval (false if unresolved or pending price). */
  readonly canSubmitForReview: boolean;
  /** ISO-8601 timestamp when sync was executed. */
  readonly syncedAt: string;
  /** Idempotency key if provided. */
  readonly idempotencyKey?: string;
}

