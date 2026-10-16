'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-client';
import { recognitionAdjustmentEntrySchema, recognitionAdjustmentIntentSchema, recognitionAdjustmentStateSchema,
  type RecognitionAdjustmentIntent, type RecognitionAdjustmentState } from '@/modules/bella-auto/services/AutoMoveRecognitionAdjustmentContract';
import { settlementDocumentSchema } from '@/modules/bella-auto/services/AutoMoveSettlementContract';

const pendingSchema = z.object({ key: z.string().uuid(), data: recognitionAdjustmentIntentSchema });
const resultSchema = z.object({ duplicate: z.boolean(), entry: recognitionAdjustmentEntrySchema, state: recognitionAdjustmentStateSchema });
const money = (amount: number) => `${amount.toLocaleString('vi-VN')} VND`;

export function VehicleSaleRecognitionAdjustments({ bookingId, tenantId, onChanged, onReversed }: {
  bookingId: string; tenantId: string; onChanged: () => void; onReversed: (value: boolean) => void;
}) {
  const [state, setState] = useState<RecognitionAdjustmentState | null>(null), [mode, setMode] = useState<'price' | 'cost' | 'reverse'>('price');
  const [document, setDocument] = useState<z.infer<typeof settlementDocumentSchema> | null>(null);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<RecognitionAdjustmentIntent | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const intent = useRef<z.infer<typeof pendingSchema> | null>(null);
  const endpoint = `/api/bella-auto/bookings/${bookingId}/recognition-adjustments`, storageKey = `automove-adjustment:${bookingId}`;
  const install = useCallback((value: RecognitionAdjustmentState) => { setState(value); onReversed(value.reversed); }, [onReversed]);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        setState(null);
        const failure = z.object({ code: z.string().optional() }).safeParse(await response.json());
        if (response.status === 409 && failure.success && failure.data.code === 'ADJUSTMENT_RECOGNITION_REQUIRED') return;
        throw new Error('Không xác minh được quyền hoặc lịch sử điều chỉnh.');
      }
      install(z.object({ result: recognitionAdjustmentStateSchema }).parse(await response.json()).result);
    } catch (caught: unknown) { setState(null); setError(caught instanceof Error ? caught.message : 'Không tải được điều chỉnh.'); }
    finally { setBusy(false); }
  }, [endpoint, install]);
  useEffect(() => {
    try { const value = sessionStorage.getItem(storageKey); if (value) { intent.current = pendingSchema.parse(JSON.parse(value)); setPending(intent.current.data); setMode(intent.current.data.action); } }
    catch { sessionStorage.removeItem(storageKey); }
    void load();
  }, [load, storageKey]);
  async function upload(file?: File) {
    if (!file) return; setBusy(true); setError(''); setDocument(null);
    try {
      const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }[file.type];
      if (!extension || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Chứng từ PDF, JPEG hoặc PNG, tối đa 20 MB.');
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
      const reference = { bucket: 'automove-sale-documents' as const, path: `${tenantId}/${crypto.randomUUID()}.${extension}`, sha256 };
      if ((await createClient().storage.from(reference.bucket).upload(reference.path, file, { upsert: false, contentType: file.type })).error) throw new Error('Không tải được chứng từ.');
      setDocument(reference);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Không tải được chứng từ.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!intent.current) {
      const form = new FormData(event.currentTarget);
      const parsed = recognitionAdjustmentIntentSchema.safeParse({ action: mode, revision: state?.revision, reason: form.get('reason'), document,
        confirmed: form.get('confirmed') === 'on', ...(mode === 'reverse' ? {} : { delta: Number(form.get('delta')) }) });
      if (!parsed.success) { setError('Kiểm tra số tiền delta, chứng từ, lý do và xác nhận.'); return; }
      intent.current = { key: crypto.randomUUID(), data: parsed.data };
      try { sessionStorage.setItem(storageKey, JSON.stringify(intent.current)); }
      catch { intent.current = null; setError('Không lưu được khóa giao dịch.'); return; }
    }
    setPending(intent.current.data); setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.current.key }, body: JSON.stringify(intent.current.data) });
      if (!response.ok) {
        const failure = z.object({ code: z.string().optional() }).safeParse(await response.json()), code = failure.success ? failure.data.code : undefined;
        if (response.status < 500 && code && code !== 'ADJUSTMENT_RETRY_REQUIRED') { intent.current = null; setPending(null); sessionStorage.removeItem(storageKey); }
        throw new Error(`Chưa xác nhận điều chỉnh. ${code || 'Thử lại cùng yêu cầu.'}`);
      }
      const result = resultSchema.parse(z.object({ result: z.unknown() }).parse(await response.json()).result);
      install(result.state); onChanged(); setMessage(`${result.duplicate ? 'Đã đối chiếu điều chỉnh có sẵn' : 'Đã lưu điều chỉnh'}: ${result.entry.id}`);
      intent.current = null; setPending(null); setDocument(null); sessionStorage.removeItem(storageKey);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Không xác minh được điều chỉnh.'); }
    finally { setBusy(false); }
  }
  const field = 'w-full min-w-0 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900';
  return <section aria-label="Điều chỉnh và đảo ghi nhận" className="mt-5 min-w-0 space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Điều chỉnh và đảo ghi nhận</h3>
      <button type="button" title="Tải lại điều chỉnh" aria-label="Tải lại điều chỉnh" disabled={busy} onClick={() => void load()} className="p-2"><RefreshCw size={16} /></button></div>
    {error && <p role="alert" className="break-words text-red-700 dark:text-red-400">{error}</p>}
    {message && <p role="status" className="break-all text-emerald-700 dark:text-emerald-400">{message}</p>}
    {!state && !error && <p>Chưa có ghi nhận đủ điều kiện điều chỉnh.</p>}
    {state && <>
      <dl className="grid grid-cols-2 gap-2 break-words"><dt>Giá bán sau điều chỉnh</dt><dd data-testid="adjusted-sale">{money(state.salePrice)}</dd>
        <dt>Giá vốn sau điều chỉnh</dt><dd data-testid="adjusted-cost">{money(state.costBasis)}</dd>
        <dt>Ghi nhận</dt><dd data-testid="recognition-adjustment-status">{state.reversed ? 'Đã đảo ghi nhận' : 'Đang hiệu lực'}</dd></dl>
      {(!state.reversed || pending) && <form key={state.entries.length} aria-label="Xác nhận điều chỉnh ghi nhận" onSubmit={event => void submit(event)} className="grid min-w-0 grid-cols-1 gap-3">
        <fieldset disabled={busy || !!pending} className="flex min-w-0 flex-wrap gap-3">{(['price', 'cost', 'reverse'] as const).map(value =>
          <label key={value} className="flex items-center gap-1"><input type="radio" name="adjustmentMode" checked={mode === value} onChange={() => setMode(value)} />{value === 'price' ? 'Giá bán' : value === 'cost' ? 'Giá vốn' : 'Đảo ghi nhận'}</label>)}</fieldset>
        {(pending?.action ?? mode) !== 'reverse' && <label className="min-w-0">Delta (VND)<input aria-label="Delta (VND)" name="delta" type="number" step="1" required disabled={busy || !!pending} defaultValue={pending && pending.action !== 'reverse' ? pending.delta : undefined} className={field} /></label>}
        <label className="min-w-0">Lý do điều chỉnh<input aria-label="Lý do điều chỉnh" name="reason" required maxLength={1000} disabled={busy || !!pending} defaultValue={pending?.reason} className={field} /></label>
        <label className="min-w-0 space-y-2"><span className="flex items-center gap-2"><FileUp size={16} />Chứng từ điều chỉnh</span>
          <input aria-label="Chứng từ điều chỉnh" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy || !!pending} className="max-w-full" onChange={event => void upload(event.target.files?.[0])} />
          {(document || pending) && <span className="block text-emerald-700 dark:text-emerald-400">Đã tải chứng từ điều chỉnh</span>}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required disabled={busy || !!pending} defaultChecked={!!pending} />Tôi xác nhận chứng từ và tác động điều chỉnh ghi nhận.</label>
        <button type="submit" disabled={busy || (!pending && !document)} className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
          {(pending?.action ?? mode) === 'reverse' ? <RotateCcw size={16} /> : <Save size={16} />}{pending ? 'Thử lại cùng yêu cầu điều chỉnh' : mode === 'reverse' ? 'Xác nhận đảo ghi nhận' : 'Xác nhận điều chỉnh'}</button>
      </form>}
      <ul aria-label="Lịch sử điều chỉnh" className="divide-y divide-slate-200 dark:divide-slate-800">{state.entries.map(row => <li key={row.id} className="space-y-1 py-2">
        <strong>{row.type === 'sale_revenue_reversed' ? 'Đảo ghi nhận' : row.type === 'cost_basis_adjusted' ? 'Điều chỉnh giá vốn' : 'Điều chỉnh giá bán'}</strong>
        <p>{money(row.saleDelta)} / {money(row.costDelta)}</p><p className="break-words">{row.reason}</p><p className="break-all font-mono text-xs">{row.id}</p>
      </li>)}</ul>
    </>}
  </section>;
}
