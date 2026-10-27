'use client';

import { useEffect, useRef, useState } from 'react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { isPortalIssuerContext, type PortalIssuerContext } from '@/products/bella-education/parent-portal/domain/parent-portal.types';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export default function PortalAccessLink({ tenantId, courseId, studentPartyId }: {
  readonly tenantId: string; readonly courseId: string; readonly studentPartyId: string;
}) {
  const [context, setContext] = useState<PortalIssuerContext | null>(null);
  const [guardian, setGuardian] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Đang kiểm tra quyền cấp liên kết phụ huynh…');
  const binding = `${tenantId}/${courseId}/${studentPartyId}`;
  const activeBinding = useRef(binding);
  const [loadedBinding, setLoadedBinding] = useState('');
  const ready = loadedBinding === binding && context !== null;

  useEffect(() => {
    activeBinding.current = binding;
    let active = true;
    const controller = new AbortController();
    setContext(null); setGuardian(''); setUrl(''); setLoadedBinding(''); setBusy(false);
    void (async () => {
      try {
        const response = await fetch(`/api/education/portal/token?${new URLSearchParams({ courseId, studentPartyId })}`, { cache: 'no-store', signal: controller.signal });
        const json: unknown = await response.json();
        if (!response.ok || !record(json) || json.success !== true || !isPortalIssuerContext(json.data)
          || json.data.tenantId !== tenantId || json.data.courseId !== courseId || json.data.studentPartyId !== studentPartyId) throw new Error('UNAVAILABLE');
        if (active) { setContext(json.data); setLoadedBinding(binding); setNotice('Chọn rõ người giám hộ để cấp liên kết chỉ đọc, có hiệu lực tối đa 24 giờ.'); }
      } catch {
        if (active) setNotice('Chưa thể cấp liên kết phụ huynh. Cần Admin và người giám hộ hợp lệ trong lớp được cấp quyền.');
      }
    })();
    return () => { active = false; activeBinding.current = ''; controller.abort(); };
  }, [binding, tenantId, courseId, studentPartyId]);

  async function issue() {
    if (!ready || busy || !context.guardians.some(g => g.guardianPartyId === guardian)) return;
    setBusy(true); setUrl(''); setNotice('Đang xác minh lại quyền cấp liên kết…');
    try {
      const response = await fetch('/api/education/portal/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ courseId, studentPartyId, guardianPartyId: guardian }),
      });
      const json: unknown = await response.json();
      if (activeBinding.current !== binding) return;
      if (!response.ok || !record(json) || json.success !== true || json.expiresInSeconds !== 86400
        || typeof json.portalUrl !== 'string' || !/^\/portal\/education\/[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(json.portalUrl)) throw new Error('UNAVAILABLE');
      setUrl(json.portalUrl); setNotice('Đã cấp liên kết chỉ đọc cho người giám hộ đã chọn. Liên kết hết hạn trong 24 giờ.');
    } catch { if (activeBinding.current === binding) setNotice('Không cấp được liên kết. Hãy kiểm tra lại quyền và người giám hộ; chưa có liên kết mới.'); }
    finally { if (activeBinding.current === binding) setBusy(false); }
  }

  return <section aria-label="Liên kết phụ huynh" className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
    <h3 className="font-bold">Portal phụ huynh</h3>
    <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{notice}</p>
    {ready && <PremiumSelect ariaLabel="Người giám hộ" label="Người giám hộ" value={guardian}
      placeholder="Chọn người giám hộ" options={context.guardians.map(g => ({ value: g.guardianPartyId, label: g.guardianLabel }))}
      disabled={busy} onChange={value => { setGuardian(value); setUrl(''); setNotice('Đã chọn người giám hộ. Chưa cấp liên kết mới; hãy bấm Cấp liên kết phụ huynh.'); }} />}
    <button type="button" disabled={!ready || !guardian || busy} onClick={() => void issue()}
      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Đang cấp liên kết…' : 'Cấp liên kết phụ huynh'}</button>
    {ready && url && <a href={url} target="_blank" rel="noopener noreferrer" className="ml-3 text-sm font-semibold underline">Mở Portal phụ huynh</a>}
  </section>;
}
