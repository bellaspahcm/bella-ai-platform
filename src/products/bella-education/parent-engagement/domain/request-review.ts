/** Product-local receipt. Legacy free-form notes remain readable and are preserved verbatim. */
export interface RequestReviewReceipt {
  format: 'preschool-work-queue-review';
  version: 1;
  outcome: 'APPROVED' | 'DECLINED' | 'HANDLED' | 'CLOSED';
  originalNotes: string | null;
  note: string;
  reviewedBy: string;
  reviewedAt: string;
}

export function readRequestReview(notes: string | null): RequestReviewReceipt | null {
  if (!notes) return null;
  try {
    const value: unknown = JSON.parse(notes);
    if (typeof value !== 'object' || value === null) return null;
    if (!('format' in value) || value.format !== 'preschool-work-queue-review'
      || !('version' in value) || value.version !== 1
      || !('outcome' in value) || !['APPROVED', 'DECLINED', 'HANDLED', 'CLOSED'].includes(String(value.outcome))
      || !('originalNotes' in value) || (value.originalNotes !== null && typeof value.originalNotes !== 'string')
      || !('note' in value) || typeof value.note !== 'string'
      || !('reviewedBy' in value) || typeof value.reviewedBy !== 'string'
      || !('reviewedAt' in value) || typeof value.reviewedAt !== 'string') return null;
    // Every field is validated above; rebuilding prevents unrecognized payload fields leaking to consumers.
    const outcome = value.outcome;
    if (outcome !== 'APPROVED' && outcome !== 'DECLINED' && outcome !== 'HANDLED' && outcome !== 'CLOSED') return null;
    return { format: 'preschool-work-queue-review', version: 1, outcome,
      originalNotes: value.originalNotes, note: value.note, reviewedBy: value.reviewedBy, reviewedAt: value.reviewedAt };
  } catch { return null; }
}

export function writeRequestReview(input: Omit<RequestReviewReceipt, 'format' | 'version'>): string {
  return JSON.stringify({ format: 'preschool-work-queue-review', version: 1, ...input });
}
