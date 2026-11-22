'use client';

import { useCallback, useEffect, useState } from 'react';

type PendingEvidenceDeletion = {
  requestId: string;
  kind: 'O3' | 'O4';
  recordId: string;
  storagePath: string;
  status: 'DELETE_PENDING' | 'DELETE_FAILED';
};

/** The server decides whether the current actor may manage requests. */
export function useEvidenceDeletions(projectId: string | undefined, onDeleted: () => void) {
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<PendingEvidenceDeletion[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) { setAllowed(false); setPending([]); return; }
    try {
      const response = await fetch(`/api/interior/delivery/evidence-deletions?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      if (!response.ok) { setAllowed(false); setPending([]); return; }
      const body: unknown = await response.json();
      if (typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
        setAllowed(false); setPending([]); return;
      }
      setPending(body.data.filter((row: unknown): row is PendingEvidenceDeletion => {
        if (typeof row !== 'object' || row === null) return false;
        const item = row as Record<string, unknown>;
        return typeof item.requestId === 'string' && typeof item.recordId === 'string' && typeof item.storagePath === 'string'
          && (item.kind === 'O3' || item.kind === 'O4')
          && (item.status === 'DELETE_PENDING' || item.status === 'DELETE_FAILED');
      }));
      setAllowed(true);
    } catch { setAllowed(false); setPending([]); }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const requestDeletion = useCallback(async (kind: 'O3' | 'O4', recordId: string, photoIndex?: number) => {
    if (!projectId || busy) return;
    const reason = window.prompt('Lý do yêu cầu xóa bằng chứng:');
    if (!reason?.trim()) return;
    const contractReviewReference = window.prompt('Ghi lại căn cứ đã kiểm tra nghĩa vụ hợp đồng, pháp lý và lưu trữ hồ sơ:');
    if (!contractReviewReference?.trim()) return;
    if (!window.confirm('Xác nhận bạn đã kiểm tra nghĩa vụ hợp đồng, pháp lý và lưu trữ hồ sơ cho yêu cầu này?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/interior/delivery/evidence-deletions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', projectId, kind, recordId, photoIndex,
          reason, contractReviewReference, contractReviewed: true }),
      });
      setMessage(response.ok ? 'Đã ghi nhận yêu cầu xóa. Xác nhận thực hiện trong danh sách chờ.' : 'Không thể ghi nhận yêu cầu xóa.');
    } catch { setMessage('Không thể ghi nhận yêu cầu xóa.'); }
    finally { setBusy(false); await refresh(); }
  }, [projectId, busy, refresh]);

  const execute = useCallback(async (requestId: string) => {
    if (!projectId || busy || !window.confirm('Xác nhận đã kiểm tra nghĩa vụ hợp đồng, pháp lý và lưu trữ hồ sơ, và thực hiện xóa bằng chứng này?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/interior/delivery/evidence-deletions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', projectId, requestId, contractReviewed: true }),
      });
      if (response.ok) setMessage('Đã xóa bằng chứng khỏi hồ sơ. Tệp dùng chung được giữ lại nếu còn tham chiếu.');
      else setMessage('Chưa xác nhận được kết quả. Kiểm tra danh sách và thử lại nếu yêu cầu còn chờ.');
    } catch { setMessage('Chưa xác nhận được kết quả. Kiểm tra danh sách và thử lại nếu yêu cầu còn chờ.'); }
    finally { setBusy(false); await refresh(); onDeleted(); }
  }, [projectId, busy, refresh, onDeleted]);

  return { allowed, pending, message, busy, requestDeletion, execute };
}
