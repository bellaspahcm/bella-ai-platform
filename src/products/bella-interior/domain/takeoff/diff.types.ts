/**
 * Bella Interior OS — Takeoff Diff Engine Types
 *
 * Defines domain types for comparing two TakeoffRuns linked to different
 * Design Revisions. The Diff Engine is strictly Interior-only — it is NOT
 * a general Platform abstraction.
 *
 * Key principles:
 * 1. Identity matching is ALWAYS by stableComponentId — never by name or code.
 * 2. REVIEW_REQUIRED is emitted whenever stableComponentId cannot be
 *    conclusively resolved. The engine must NEVER guess ADDED or REMOVED.
 * 3. Category-specific sensitivity rules are applied for MODIFIED detection:
 *    - cabinetry  : dimension change > 50 mm in any axis → MODIFIED
 *    - loose_furniture : quantity or upholstery change → MODIFIED
 *    - all categories: unit change or significant material change → MODIFIED
 * 4. The Diff Engine has NO side-effects on BOQ (Phase 2C scope boundary).
 *
 * @module src/products/bella-interior/domain/takeoff/diff.types
 */

import type { DesignTakeoffComponent } from './types';

/**
 * Result type for each component position in a diff computation.
 *
 * - `added`           : stableComponentId exists only in targetRun (new component)
 * - `removed`         : stableComponentId exists only in baseRun (deleted component)
 * - `modified`        : stableComponentId in both runs but meaningful field(s) changed
 * - `unchanged`       : stableComponentId in both runs, no meaningful field changed
 * - `review_required` : stableComponentId ambiguous — Estimator must resolve manually
 */
export type DiffChangeType =
  | 'added'
  | 'modified'
  | 'removed'
  | 'unchanged'
  | 'review_required';

/**
 * A single field-level change within a component.
 */
export interface ComponentFieldDiff {
  readonly fieldName: 'quantity' | 'dimensions' | 'materials' | 'unit' | 'category';
  readonly oldValue: string;
  readonly newValue: string;
  readonly impactDescription: string;
}

/**
 * Diff result for one component matched by stableComponentId.
 */
export interface ComponentDiffItem {
  /** The stable identity shared across both runs (or just one run for added/removed). */
  readonly stableComponentId: string;
  readonly changeType: DiffChangeType;
  /** Field-level changes. Empty for `unchanged`, `added`, `removed`, and `review_required`. */
  readonly changes: readonly ComponentFieldDiff[];
  /** Component from the base run (undefined for `added`). */
  readonly baseComponent?: DesignTakeoffComponent;
  /** Component from the target run (undefined for `removed`). */
  readonly targetComponent?: DesignTakeoffComponent;
  /**
   * Human-readable reason why REVIEW_REQUIRED was assigned.
   * Only present when changeType === 'review_required'.
   */
  readonly reviewReason?: string;
}

/**
 * Aggregated result of a full Diff computation between two TakeoffRuns.
 */
export interface TakeoffRunDiffResult {
  readonly baseRunId: string;
  readonly targetRunId: string;
  readonly baseDesignRevisionId: string;
  readonly targetDesignRevisionId: string;
  readonly addedCount: number;
  readonly modifiedCount: number;
  readonly removedCount: number;
  readonly unchangedCount: number;
  readonly reviewRequiredCount: number;
  readonly items: readonly ComponentDiffItem[];
  /** ISO-8601 timestamp — when this diff result was computed. */
  readonly computedAt: string;
}

/**
 * Input required to trigger a Diff computation.
 */
export interface ComputeDiffInput {
  readonly tenantId: string;
  readonly baseRunId: string;
  readonly targetRunId: string;
}
