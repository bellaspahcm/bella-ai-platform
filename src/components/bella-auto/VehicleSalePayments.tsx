'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Loader2, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { salePaymentIntentSchema, salePaymentReceiptSchema, salePaymentStateSchema,
  type SalePaymentIntent, type SalePaymentState } from '@/modules/bella-auto/services/AutoMoveSalePaymentContract';

const collectionSchema = z.object({ duplicate: z.boolean(), receipt: salePaymentReceiptSchema, state: salePaymentStateSchema });
const money = (value: number) => `${value.toLocaleString('vi-VN')} VND`;
export function VehicleSalePayments({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<SalePaymentState | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [pendingData, setPendingData] = useState<SalePaymentIntent | null>(null);
  const intent = useRef<{ key: string; data: SalePaymentIntent } | null>(null);
  const storageKey = `automove-sale-payment:${bookingId}`;
  const endpoint = `/api/bella-auto/bookings/${bookingId}/sale-payments`;
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Không tải được trạng thái thanh toán.');
      const payload: unknown = await response.json();
      setState(z.object({ result: salePaymentStateSchema }).parse(payload).result);
    } catch { setState(null); setError('Không xác minh được dữ liệu thanh toán. Vui lòng tải lại.'); }
    finally { setBusy(false); }
  }, [endpoint]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        intent.current = z.object({ key: z.string().uuid(), data: salePaymentIntentSchema }).parse(JSON.parse(saved));
        setPendingData(intent.current.data);
        setPending(true);
      }
    } catch { sessionStorage.removeItem(storageKey); }
    void load();
  }, [load, storageKey]);

  async function collect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!intent.current) {
      const form = new FormData(event.currentTarget);
      const parsed = salePaymentIntentSchema.safeParse({ amount: Number(form.get('amount')), paymentMethod: form.get('paymentMethod'),
        transactionRef: String(form.get('transactionRef') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null });
      if (!parsed.success) { setError('Kiểm tra số tiền nguyên VND và mã giao dịch chuyển khoản/thẻ.'); return; }
      intent.current = { key: crypto.randomUUID(), data: parsed.data };
      try { sessionStorage.setItem(storageKey, JSON.stringify(intent.current)); }
      catch { intent.current = null; setError('Không lưu được khóa giao dịch an toàn trong phiên.'); return; }
    }
    setBusy(true); setPending(true); setPendingData(intent.current.data);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.current.key },
        body: JSON.stringify(intent.current.data) });
      if (!response.ok) {
        const failure = z.object({ code: z.string().optional() }).safeParse(await response.json());
        const code = failure.success ? failure.data.code : undefined;
        if (response.status < 500 && code && code !== 'PAYMENT_RETRY_REQUIRED') {
          intent.current = null; setPending(false); setPendingData(null); sessionStorage.removeItem(storageKey);
        }
        throw new Error(`Chưa xác nhận thu tiền. ${code || 'Tải lại trạng thái trước khi thử lại cùng yêu cầu.'}`);
      }
      const parsed = collectionSchema.parse(z.object({ result: z.unknown() }).parse(await response.json()).result);
      setState(parsed.state);
      setMessage(`${parsed.duplicate ? 'Đã đối chiếu receipt có sẵn' : 'Đã lưu receipt'}: ${money(parsed.receipt.amount)}.`);
      intent.current = null; setPending(false); setPendingData(null); sessionStorage.removeItem(storageKey);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Không xác minh được giao dịch.'); }
    finally { setBusy(false); }
  }
  const field = 'w-full min-w-0 rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900';
  return <section aria-label="Thanh toán sau bán" className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Thanh toán sau bán</h3>
      <button type="button" title="Tải lại thanh toán" aria-label="Tải lại thanh toán" disabled={busy} onClick={() => void load()} className="p-2"><RefreshCw size={16} /></button></div>
    {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
    {message && <p role="status" className="text-emerald-700 dark:text-emerald-400">{message}</p>}
    {busy && <Loader2 size={18} className="animate-spin" aria-label="Đang tải thanh toán" />}
    {state?.status === 'NOT_RECOGNIZED' && <p>Chưa có giao dịch bán xe được ghi nhận.</p>}
    {state && state.status !== 'NOT_RECOGNIZED' && <>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 break-words">
        <dt>Giá trị bán đã ghi nhận</dt><dd data-testid="settlement-sale">{money(state.saleAmount)}</dd>
        <dt>Cọc đã xác nhận</dt><dd>{money(state.depositReceived)}</dd>
        <dt>Đã thu sau bán</dt><dd data-testid="settlement-paid">{money(state.postSaleReceived)}</dd>
        <dt>Đã hoàn</dt><dd>{money(state.refundedTotal)}</dd>
        <dt>Thực thu sau hoàn</dt><dd>{money(state.totalReceived)}</dd>
        <dt>{state.outstanding < 0 ? 'Thực thu vượt giá trị bán' : 'Còn phải thu'}</dt><dd data-testid="settlement-outstanding">{money(Math.abs(state.outstanding))}</dd>
        <dt>Đối soát receipt nội bộ</dt><dd data-testid="settlement-reconciliation">{state.status === 'MATCHED' ? 'Khớp' : 'Sai lệch'}</dd>
      </dl>
      {state.issues.length > 0 && <p role="alert" className="text-red-700 dark:text-red-400">Chặn thu tiền: {state.issues.join(', ')}</p>}
      {(state.canCollect || pending) && <form key={state.receipts.length} aria-label="Thu tiền sau bán" onSubmit={event => void collect(event)} className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 dark:border-slate-800">
        <label>Số tiền sau bán (VND)<input aria-label="Số tiền sau bán (VND)" name="amount" required type="number" min="1" step="1" max={state.outstanding}
          disabled={busy || pending} defaultValue={pendingData?.amount ?? state.outstanding} className={field} /></label>
        <label>Phương thức thu<select aria-label="Phương thức thu" name="paymentMethod" defaultValue={pendingData?.paymentMethod ?? 'cash'} disabled={busy || pending} className={field}>
          <option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option><option value="card">Thẻ</option></select></label>
        <label>Mã giao dịch<input name="transactionRef" defaultValue={pendingData?.transactionRef ?? ''} maxLength={200} disabled={busy || pending} className={field} /></label>
        <label>Ghi chú receipt<input name="notes" defaultValue={pendingData?.notes ?? ''} maxLength={1000} disabled={busy || pending} className={field} /></label>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 font-semibold text-white disabled:opacity-50"><Banknote size={16} />{pending ? 'Thử lại cùng yêu cầu thu' : 'Xác nhận thu tiền sau bán'}</button>
      </form>}
      <ul aria-label="Receipt sau bán" className="divide-y divide-slate-200 dark:divide-slate-800">{state.receipts.map(row => <li key={row.id} className="space-y-1 py-2">
        <div className="flex flex-wrap justify-between gap-2"><strong>{money(row.amount)}</strong><span>{new Date(row.receivedAt).toLocaleString('vi-VN')}</span></div>
        <p className="break-all font-mono text-xs">{row.id}</p>{row.transactionRef && <p className="break-all">{row.transactionRef}</p>}
      </li>)}</ul>
    </>}
  </section>;
}
