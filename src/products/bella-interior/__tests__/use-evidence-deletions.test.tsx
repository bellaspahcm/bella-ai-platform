/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEvidenceDeletions } from '../lib/use-evidence-deletions';

describe('evidence deletion controls', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('requires the reason, contract reference and confirmation before creating a request', async () => {
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST' ? { ok: true } : { ok: true, json: async () => ({ data: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(window, 'prompt').mockReturnValueOnce('Tệp sai').mockReturnValueOnce('Đã đối chiếu hợp đồng');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useEvidenceDeletions(projectId, jest.fn()));
    await waitFor(() => expect(result.current.allowed).toBe(true));
    await act(async () => { await result.current.requestDeletion('O4', 'evidence-1'); });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toEqual(expect.objectContaining({
      action: 'request', projectId, kind: 'O4', recordId: 'evidence-1',
      reason: 'Tệp sai', contractReviewReference: 'Đã đối chiếu hợp đồng', contractReviewed: true,
    }));
  });

  it('does not execute when contract confirmation is declined', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useEvidenceDeletions(projectId, jest.fn()));
    await waitFor(() => expect(result.current.allowed).toBe(true));
    await act(async () => { await result.current.execute('request-1'); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
