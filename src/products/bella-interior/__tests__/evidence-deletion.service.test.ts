import { executeEvidenceDeletion, type EvidenceDeletionStore, type EvidenceDeletionStorage } from '../services/evidence-deletion.service';

describe('evidence deletion coordination', () => {
  const requestId = 'request-1';
  const plan = { requestId, status: 'DELETE_PENDING' as const, mode: 'DELETE_OBJECT' as const,
    tenantId: 'tenant', projectId: 'project', bucketId: 'interior-site-evidence', storagePath: 'tenant/project/acceptance/file.pdf', objectPresent: true };
  let store: jest.Mocked<EvidenceDeletionStore>;
  let storage: jest.Mocked<EvidenceDeletionStorage>;
  beforeEach(() => {
    store = { prepare: jest.fn().mockResolvedValue(plan), finish: jest.fn().mockResolvedValue(undefined), fail: jest.fn().mockResolvedValue(undefined) };
    storage = { remove: jest.fn().mockResolvedValue(undefined) };
  });

  it('removes the object before finalizing metadata', async () => {
    await executeEvidenceDeletion(requestId, store, storage);
    expect(storage.remove).toHaveBeenCalledWith(plan.bucketId, plan.storagePath);
    expect(storage.remove.mock.invocationCallOrder[0]).toBeLessThan(store.finish.mock.invocationCallOrder[0]);
  });

  it('keeps a shared object while finalizing its reference', async () => {
    store.prepare.mockResolvedValue({ ...plan, mode: 'KEEP_OBJECT' });
    await executeEvidenceDeletion(requestId, store, storage);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith(requestId);
  });

  it('records a Storage failure and leaves metadata untouched', async () => {
    storage.remove.mockRejectedValue(new Error('Storage unavailable'));
    await expect(executeEvidenceDeletion(requestId, store, storage)).rejects.toMatchObject({ stage: 'STORAGE' });
    expect(store.fail).toHaveBeenCalledWith(requestId, 'STORAGE');
    expect(store.finish).not.toHaveBeenCalled();
  });

  it('records a metadata failure after Storage succeeds so the request can be retried', async () => {
    store.finish.mockRejectedValue(new Error('DB unavailable'));
    await expect(executeEvidenceDeletion(requestId, store, storage)).rejects.toMatchObject({ stage: 'FINALIZE' });
    expect(storage.remove).toHaveBeenCalled();
    expect(store.fail).toHaveBeenCalledWith(requestId, 'FINALIZE');
  });

  it('retries finalization without deleting again when Storage already removed the object', async () => {
    store.prepare.mockResolvedValue({ ...plan, objectPresent: false });
    await executeEvidenceDeletion(requestId, store, storage);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith(requestId);
  });

  it('treats an already completed request as idempotent', async () => {
    store.prepare.mockResolvedValue({ ...plan, status: 'DELETED' });
    await executeEvidenceDeletion(requestId, store, storage);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(store.finish).not.toHaveBeenCalled();
  });

  it('rejects a different request or a path outside the allowed bucket', async () => {
    store.prepare.mockResolvedValue({ ...plan, bucketId: 'another-bucket' });
    await expect(executeEvidenceDeletion(requestId, store, storage)).rejects.toMatchObject({ stage: 'PLAN' });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(store.finish).not.toHaveBeenCalled();
  });
});
