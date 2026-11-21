/** Coordinates an authorized deletion across the database and private Storage. */
export type EvidenceDeletionPlan = {
  readonly requestId: string;
  readonly status: 'DELETE_PENDING' | 'DELETED';
  readonly mode: 'KEEP_OBJECT' | 'DELETE_OBJECT';
  readonly tenantId: string;
  readonly projectId: string;
  readonly bucketId: string;
  readonly storagePath: string;
  readonly objectPresent: boolean;
};

export interface EvidenceDeletionStore {
  /** Must persist the attempt and authorize the actor against the current record. */
  prepare(requestId: string): Promise<EvidenceDeletionPlan>;
  /** Must recheck object state and update metadata, document status and audit atomically. */
  finish(requestId: string): Promise<void>;
  /** Records a retryable failure; does not remove evidence metadata. */
  fail(requestId: string, stage: 'STORAGE' | 'FINALIZE'): Promise<void>;
}

export interface EvidenceDeletionStorage {
  remove(bucketId: string, storagePath: string): Promise<void>;
}

export class EvidenceDeletionError extends Error {
  constructor(readonly stage: 'PLAN' | 'STORAGE' | 'FINALIZE') {
    super(`EVIDENCE_DELETE_${stage}_FAILED`);
  }
}

/** Never finalizes metadata until Storage has succeeded or the object is shared. */
export async function executeEvidenceDeletion(
  requestId: string,
  store: EvidenceDeletionStore,
  storage: EvidenceDeletionStorage,
): Promise<void> {
  const plan = await store.prepare(requestId);
  const prefix = `${plan.tenantId}/${plan.projectId}/`;
  if (plan.requestId !== requestId || plan.bucketId !== 'interior-site-evidence'
    || !plan.tenantId || !plan.projectId || !plan.storagePath.startsWith(prefix)
    || plan.storagePath.length === prefix.length || plan.storagePath.includes('..') || plan.storagePath.includes('\\')
    || !['DELETE_PENDING', 'DELETED'].includes(plan.status)
    || !['KEEP_OBJECT', 'DELETE_OBJECT'].includes(plan.mode) || typeof plan.objectPresent !== 'boolean') {
    throw new EvidenceDeletionError('PLAN');
  }
  if (plan.status === 'DELETED') return;

  if (plan.mode === 'DELETE_OBJECT' && plan.objectPresent) {
    try {
      await storage.remove(plan.bucketId, plan.storagePath);
    } catch {
      await store.fail(requestId, 'STORAGE').catch(() => undefined);
      throw new EvidenceDeletionError('STORAGE');
    }
  }

  try {
    await store.finish(requestId);
  } catch {
    // If recording the failure also fails, the persisted pending request remains retryable.
    await store.fail(requestId, 'FINALIZE').catch(() => undefined);
    throw new EvidenceDeletionError('FINALIZE');
  }
}
