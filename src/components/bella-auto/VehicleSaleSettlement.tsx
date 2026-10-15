'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, RefreshCw, Undo2, XCircle } from 'lucide-react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-client';
import { settlementActionSchema, settlementDocumentSchema, settlementIntentSchema, settlementStateSchema,
  type SettlementIntent, type SettlementState } from '@/modules/bella-auto/services/AutoMoveSettlementContract';

type Document = z.infer<typeof settlementDocumentSchema>;
const pendingSchema = z.object({ key: z.string().uuid(), data: settlementIntentSchema });
const resultSchema = z.object({ duplicate: z.boolean(), action: settlementActionSchema, state: settlementStateSchema });
const money = (value: number) => `${value.toLocaleString('vi-VN')} VND`;

export function VehicleSaleSettlement({ bookingId, tenantId, onChanged, onClosed }: {
  bookingId: string; tenantId: string; onChanged: () => void; onClosed: (closed: boolean) => void;
}) {
  const [state, setState] = useState<SettlementState | null>(null);
  const [mode, setMode] = useState<'refund' | 'cancel'>('refund');
  const [document, setDocument] = useState<Document | null>(null);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<SettlementIntent | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const intent = useRef<z.infer<typeof pendingSchema> | null>(null);
  const endpoint = `/api/bella-auto/bookings/${bookingId}/settlement`;
  const storageKey = `automove-settlement:${bookingId}`;
  const install = useCallback((next: SettlementState) => { setState(next); onClosed(next.bookingStatus === 'cancelled'); }, [onClosed]);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không xác minh được lịch sử hoàn/hủy.');
      install(z.object({ result: settlementStateSchema }).parse(await response.json()).result);
    } catch (caught: unknown) { setState(null); setError(caught instanceof Error ? caught.message : 'Không tải được lịch sử.'); }
    finally { setBusy(false); }
  }, [endpoint, install]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) { intent.current = pendingSchema.parse(JSON.parse(stored)); setPending(intent.current.data); setMode(intent.current.data.action); }
    } catch { sessionStorage.removeItem(storageKey); }
    void load();
  }, [load, storageKey]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[file.type];
      if (!extension || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Chứng từ PDF, JPEG hoặc PNG, tối đa 20 MB.');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
      const reference: Document = { bucket: 'automove-sale-documents', path: `${tenantId}/${crypto.randomUUID()}.${extension}`, sha256: hash };
      const uploaded = await createClient().storage.from(reference.bucket).upload(reference.path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) throw new Error('Không tải được chứng từ.');
      setDocument(reference);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Không tải được chứng từ.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!intent.current) {
      const data = new FormData(event.currentTarget);
      const selected = state?.receipts.find(receipt => `${receipt.type}:${receipt.id}` === data.get('receipt'));
      const parsed = settlementIntentSchema.safeParse({ action: mode, reason: data.get('reason'), document,
        confirmed: data.get('confirmed') === 'on', ...(mode === 'refund' ? {
          receiptType: selected?.type, receiptId: selected?.id, amount: Number(data.get('amount')),
        } : {}) });
      if (!parsed.success) { setError('Kiểm tra chứng từ, xác nhận, lý do và receipt gốc.'); return; }
      intent.current = { key: crypto.randomUUID(), data: parsed.data };
      try { sessionStorage.setItem(storageKey, JSON.stringify(intent.current)); }
      catch { intent.current = null; setError('Không lưu được khóa giao dịch.'); return; }
    }
    setPending(intent.current.data); setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.current.key }, body: JSON.stringify(intent.current.data) });
      if (!response.ok) {
        const failure = z.object({ code: z.string().optional() }).safeParse(await response.json());
        const code = failure.success ? failure.data.code : undefined;
        if (response.status < 500 && code && code !== 'SETTLEMENT_RETRY_REQUIRED') {
          intent.current = null; setPending(null); sessionStorage.removeItem(storageKey);
        }
        throw new Error(`Chưa xác nhận giao dịch. ${code || 'Tải lại và thử lại cùng yêu cầu.'}`);
      }
      const result = resultSchema.parse(z.object({ result: z.unknown() }).parse(await response.json()).result);
      install(result.state); onChanged();
      setMessage(`${result.duplicate ? 'Đã đối chiếu giao dịch có sẵn' : 'Đã lưu giao dịch'}: ${result.action.id}`);
      intent.current = null; setPending(null); setDocument(null); sessionStorage.removeItem(storageKey);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Không xác minh được giao dịch.'); }
    finally { setBusy(false); }
  }
  const field = 'w-full min-w-0 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900';
  return <section aria-label="Hoàn tiền và hủy giao dịch" className="mt-5 min-w-0 space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Hoàn tiền và hủy giao dịch</h3>
      <button type="button" title="Tải lại hoàn/hủy" aria-label="Tải lại hoàn/hủy" disabled={busy} onClick={() => void load()} className="p-2"><RefreshCw size={16} /></button></div>
    {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
    {message && <p role="status" className="break-all text-emerald-700 dark:text-emerald-400">{message}</p>}
    {state && <>
      <dl className="grid grid-cols-2 gap-2 break-words"><dt>Trạng thái booking</dt><dd data-testid="refund-booking-status">{state.bookingStatus}</dd>
        <dt>Tổng đã thu</dt><dd>{money(state.grossReceived)}</dd><dt>Đã hoàn</dt><dd data-testid="refund-total">{money(state.refunded)}</dd>
        <dt>Thực thu sau hoàn</dt><dd data-testid="refund-net">{money(state.netReceived)}</dd></dl>
      {state.issues.length > 0 && <p role="alert">{state.issues.join(', ')}</p>}
      <form key={state.actions.length} aria-label="Ghi nhận hoàn hoặc hủy" onSubmit={event => void submit(event)} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset disabled={busy || !!pending} className="flex min-w-0 flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-1"><input type="radio" name="settlementMode" checked={mode === 'refund'} onChange={() => setMode('refund')} />Hoàn tiền</label>
          <label className="flex items-center gap-1"><input type="radio" name="settlementMode" checked={mode === 'cancel'} onChange={() => setMode('cancel')} />Hủy giao dịch</label>
        </fieldset>
        {(pending?.action ?? mode) === 'refund' && <>
          <label className="min-w-0">Receipt gốc<select aria-label="Receipt gốc" name="receipt" disabled={busy || !!pending} className={field} required>
            {state.receipts.filter(row => row.refundable > 0).map(row => <option key={row.id} value={`${row.type}:${row.id}`}>{row.type === 'deposit' ? 'Cọc' : 'Sau bán'} · {row.id} · {money(row.refundable)}</option>)}
          </select></label>
          <label className="min-w-0">Số tiền hoàn (VND)<input aria-label="Số tiền hoàn (VND)" name="amount" type="number" min="1" step="1" required defaultValue={pending?.action === 'refund' ? pending.amount : undefined} disabled={busy || !!pending} className={field} /></label>
        </>}
        <label className="min-w-0 sm:col-span-2">Lý do hoàn/hủy<input name="reason" aria-label="Lý do hoàn/hủy" required maxLength={1000} defaultValue={pending?.reason} disabled={busy || !!pending} className={field} /></label>
        <label className="min-w-0 space-y-2 sm:col-span-2"><span className="flex items-center gap-2"><FileUp size={16} />Chứng từ xác nhận hoàn/hủy</span>
          <input aria-label="Chứng từ xác nhận hoàn/hủy" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy || !!pending} onChange={event => void upload(event.target.files?.[0])} className="max-w-full" />
          {(document || pending) && <span className="block text-emerald-700 dark:text-emerald-400">Đã tải chứng từ hoàn/hủy</span>}</label>
        <label className="flex items-start gap-2 sm:col-span-2"><input name="confirmed" type="checkbox" required disabled={busy || !!pending} defaultChecked={!!pending} />Tôi xác nhận chứng từ và giao dịch hoàn/hủy thực tế.</label>
        <button type="submit" disabled={busy || !!state.issues.length || (!pending && (!document || (mode === 'cancel' && !state.canCancel)))} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-2">
          {(pending?.action ?? mode) === 'refund' ? <Undo2 size={16} /> : <XCircle size={16} />}{pending ? 'Thử lại cùng yêu cầu hoàn/hủy' : mode === 'refund' ? 'Xác nhận hoàn tiền' : 'Xác nhận hủy giao dịch'}
        </button>
      </form>
      <ul aria-label="Lịch sử hoàn/hủy" className="divide-y divide-slate-200 dark:divide-slate-800">{state.actions.map(row => <li key={row.id} className="space-y-1 py-2">
        <strong>{row.action === 'refund' ? `Hoàn ${money(row.amount)}` : 'Đã hủy giao dịch'}</strong><p className="break-words">{row.reason}</p>
        <p className="break-all font-mono text-xs">{row.id}</p><p>{new Date(row.createdAt).toLocaleString('vi-VN')}</p>
      </li>)}</ul>
    </>}
  </section>;
}
