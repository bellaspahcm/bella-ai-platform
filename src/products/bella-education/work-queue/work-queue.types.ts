import type { RequestReviewReceipt } from '../parent-engagement/domain/request-review';

export type QueueView = 'absences' | 'health' | 'parents';
export type QueueStatus = 'open' | 'history' | 'all';
export type QueueAction = 'approve' | 'decline' | 'resolve' | 'close';
export interface QueueCommand { view: QueueView; id: string; action: QueueAction; note: string; expectedUpdatedAt: string }
export interface QueueQuery { view: QueueView; status: QueueStatus; page: number }
export interface QueueItem {
  id: string;
  view: QueueView;
  type: string;
  status: string;
  severity: string;
  studentId: string;
  studentName: string | null;
  studentCode: string | null;
  guardianName: string | null;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  actionTaken: string | null;
  contextNotes: string | null;
  review: RequestReviewReceipt | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  escalationRequired: boolean;
  acknowledgedAt: string | null;
  parentNotifiedAt: string | null;
  financeOnly: boolean;
}
export interface QueuePage { items: QueueItem[]; total: number; page: number; pageSize: number; pages: number }
export class QueueError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export const QUEUE_PAGE_SIZE = 20;
export const EXCLUDED_PARENT_TYPES = ['ABSENCE_REQUEST', 'RATIO_SHORTAGE', 'SAFETY_DEFECT'];

export function matchesRequestView(type: string, view: QueueView): boolean {
  return view === 'absences' ? type === 'ABSENCE_REQUEST'
    : view === 'parents' && !EXCLUDED_PARENT_TYPES.includes(type);
}
