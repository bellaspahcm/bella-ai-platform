/**
 * Bella Interior OS — Unified Operational Audit Trail & Performance Lead Time Domain Utility
 *
 * Provides standardized lifecycle timestamp tracking, actor identification,
 * status transition history recording, and lead time/SLA calculation across
 * all interior operational entities (Projects, BOQ, Contracts, Production Orders,
 * Room Installations, QC Punch List, Warranty Tickets, Payment Milestones).
 *
 * @module src/products/bella-interior/lib/operational-audit-trail
 */

export type OperationalAction =
  | 'created'
  | 'started'
  | 'completed'
  | 'approved'
  | 'reopened'
  | 'rejected'
  | 'updated'
  | 'create'
  | 'start'
  | 'complete'
  | 'approve'
  | 'reopen'
  | 'reject'
  | 'transition';

export interface OperationalStatusHistoryEntry {
  readonly action: OperationalAction;
  readonly fromStatus?: string | null;
  readonly toStatus: string;
  readonly timestamp: string;
  readonly actorId?: string | null;
  readonly actorName?: string | null;
  readonly note?: string | null;
}

export interface OperationalAuditFields {
  readonly createdAt?: string | null;
  readonly createdByName?: string | null;
  readonly startedAt?: string | null;
  readonly startedByName?: string | null;
  readonly completedAt?: string | null;
  readonly completedByName?: string | null;
  readonly executionDuration?: string | null;
  readonly statusHistory?: readonly OperationalStatusHistoryEntry[];
}

/**
 * Calculates human-readable lead time between two ISO timestamp strings.
 * Used for SLA compliance and operational efficiency analysis.
 */
export function computeOperationalLeadTime(
  startIso?: string | null,
  endIso?: string | null,
): string | null {
  if (!startIso) return null;
  const startTime = new Date(startIso).getTime();
  const endTime = endIso ? new Date(endIso).getTime() : Date.now();
  if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) return null;

  const diffMinutes = Math.floor((endTime - startTime) / (1000 * 60));
  if (diffMinutes < 1) return '< 1 phút';
  if (diffMinutes < 60) return `${diffMinutes} phút`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remMinutes > 0 ? `${diffHours} giờ ${remMinutes} phút` : `${diffHours} giờ`;
  }
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return remHours > 0 ? `${diffDays} ngày ${remHours} giờ` : `${diffDays} ngày`;
}

/**
 * Formats ISO timestamp to Vietnamese display format: "HH:mm ngày dd/MM/yyyy".
 */
export function formatAuditTimestamp(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ngày ${day}/${month}/${year}`;
  } catch {
    return isoStr;
  }
}

/**
 * Creates the initial creation audit entry for an operational entity.
 */
export function buildInitialHistoryEntry(params: {
  readonly toStatus: string;
  readonly timestamp?: string;
  readonly actorId?: string | null;
  readonly actorName?: string | null;
  readonly note?: string | null;
}): OperationalStatusHistoryEntry {
  return {
    action: 'created',
    fromStatus: null,
    toStatus: params.toStatus,
    timestamp: params.timestamp || new Date().toISOString(),
    actorId: params.actorId ?? null,
    actorName: params.actorName || 'Quản lý vận hành',
    note: params.note || 'Khởi tạo hồ sơ vận hành',
  };
}

/**
 * Appends a new status transition entry to an existing history array.
 */
export function appendStatusTransition(
  existingHistory: unknown,
  newEntry: Omit<OperationalStatusHistoryEntry, 'timestamp'> & { readonly timestamp?: string },
): OperationalStatusHistoryEntry[] {
  const currentList: OperationalStatusHistoryEntry[] = Array.isArray(existingHistory)
    ? (existingHistory as OperationalStatusHistoryEntry[])
    : [];
  return [
    ...currentList,
    {
      ...newEntry,
      timestamp: newEntry.timestamp || new Date().toISOString(),
    },
  ];
}
