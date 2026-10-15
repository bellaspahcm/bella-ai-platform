'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Check, FileCheck, FileText, Loader2, Truck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { VehicleSalePayments } from './VehicleSalePayments';
import { VehicleSaleSettlement } from './VehicleSaleSettlement';
import { VehicleSaleRecognitionAdjustments } from './VehicleSaleRecognitionAdjustments';

interface DocumentRef { bucket: string; path: string; sha256: string }
interface Snapshot { id: string; reviewHash: string; status: 'draft' | 'approved'; sale_price: number; discount_amount: number; cost_basis: number; sale_document: DocumentRef; cost_document: DocumentRef }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Phản hồi không hợp lệ.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Phản hồi không hợp lệ.');
  return value;
}
function documentRef(value: unknown): DocumentRef {
  const row = record(value);
  return { bucket: string(row.bucket), path: string(row.path), sha256: string(row.sha256) };
}
function snapshotRow(value: unknown): Snapshot | null {
  if (value === null) return null;
  const row = record(value);
  if (row.status !== 'draft' && row.status !== 'approved') throw new Error('Trạng thái hồ sơ không hợp lệ.');
  return { id: string(row.id), reviewHash:string(row.reviewHash), status: row.status, sale_price: Number(row.sale_price),
    discount_amount: Number(row.discount_amount), cost_basis: Number(row.cost_basis),
    sale_document: documentRef(row.sale_document), cost_document: documentRef(row.cost_document) };
}

export function VehicleSaleChainDialog({ bookingId, bookingNumber, tenantId, onClose }: {
  bookingId: string; bookingNumber: string; tenantId: string; onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settlementVersion, setSettlementVersion] = useState(0), [closed, setClosed] = useState(false);
  const [reversed, setReversed] = useState(false);
  const settlementChanged = useCallback(() => setSettlementVersion(value => value + 1), []);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [vehicleStatus, setVehicleStatus] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verifiedHash, setVerifiedHash] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Partial<Record<'sale' | 'cost',DocumentRef>>>({});
  const [editing, setEditing] = useState(false);
  const verified = snapshot !== null && verifiedHash === snapshot.reviewHash;
  const installSnapshot = useCallback((value:unknown) => {
    const next = snapshotRow(value);
    setSnapshot(next);
    setVerifiedHash(previous => next && previous === next.reviewHash ? previous : null);
  },[]);

  const api = useCallback(async (action: string, body?: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`/api/bella-auto/sales-chain/${action}${body === undefined ? `?bookingId=${encodeURIComponent(bookingId)}` : ''}`,
      body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = record(await response.json());
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thực hiện được thao tác.');
    return record(payload.result);
  }, [bookingId]);
  async function load() {
    const data = await api('state');
    installSnapshot(data.snapshot);
    setEvidenceId(data.handoverEvidenceId === null ? null : string(data.handoverEvidenceId));
    setVehicleStatus(string(data.vehicleStatus));
  }
  useEffect(() => {
    let mounted = true;
    api('state').then(data => {
      if (!mounted) return;
      installSnapshot(data.snapshot);
      setEvidenceId(data.handoverEvidenceId === null ? null : string(data.handoverEvidenceId));
      setVehicleStatus(string(data.vehicleStatus));
    }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Không tải được hồ sơ.'); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, [api,installSnapshot]);

  async function run(action: string, body: unknown, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await api(action, body); await load(); setMessage(success); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Không thực hiện được thao tác.'); }
    finally { setBusy(false); }
  }
  async function openDocument(document: DocumentRef) {
    const { data, error: storageError } = await createClient().storage.from(document.bucket).createSignedUrl(document.path, 60);
    if (storageError || !data) { setError('Không truy cập được chứng từ.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function uploadDocument(prefix: 'sale' | 'cost', file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[file.type];
      if (!extension || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Chứng từ phải là PDF, JPEG hoặc PNG, tối đa 20 MB.');
      const bytes = await file.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte => byte.toString(16).padStart(2,'0')).join('');
      const reference = { bucket: 'automove-sale-documents', path: `${tenantId}/${crypto.randomUUID()}.${extension}`, sha256: hash };
      const { error: uploadError } = await createClient().storage.from(reference.bucket).upload(reference.path,file,{ upsert: false, contentType: file.type });
      if (uploadError) throw new Error('Không tải được chứng từ lên kho dữ liệu.');
      setDocuments(previous => ({ ...previous, [prefix]: reference }));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Không tải được chứng từ.'); }
    finally { setBusy(false); }
  }
  function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!documents.sale || !documents.cost) { setError('Cần đủ hai chứng từ.'); return; }
    const values = { salePrice: Number(data.get('salePrice')), discountAmount: Number(data.get('discountAmount')),
      costBasis: Number(data.get('costBasis')), saleDocument: documents.sale, costDocument: documents.cost };
    void run(snapshot ? 'draft-update' : 'snapshot', snapshot ? {snapshotId:snapshot.id,...values} : {bookingId,...values}, 'Đã lưu hồ sơ nháp.');
    setEditing(false); setVerifiedHash(null);
  }
  const field = 'w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
  const button = 'inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40';
  return <Dialog open onClose={() => { if (!busy) onClose(); }} className="relative z-50">
    <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
      <Dialog.Panel className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-950 dark:text-white">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Dialog.Title className="text-lg font-semibold">Hồ sơ bán xe · {bookingNumber}</Dialog.Title>
          <button type="button" onClick={onClose} disabled={busy} title="Đóng" aria-label="Đóng" className="p-2"><X size={18} /></button>
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {message && <p role="status" className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
        {!closed && (!snapshot || (editing && snapshot.status === 'draft')) && vehicleStatus && <form onSubmit={createDraft} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['salePrice','Giá bán (VND)'],['discountAmount','Chiết khấu (VND)'],['costBasis','Giá vốn (VND)']].map(([name,label]) =>
              <label key={name} className="text-sm">{label}<input name={name} type="number" required min={name === 'salePrice' ? 1 : 0} step="1"
                defaultValue={snapshot ? {salePrice:snapshot.sale_price,discountAmount:snapshot.discount_amount,costBasis:snapshot.cost_basis}[name] : name === 'discountAmount' ? 0 : undefined} className={field} /></label>)}
          </div>
          {(['sale','cost'] as const).map(prefix => <fieldset key={prefix} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <legend className="text-sm font-semibold">{prefix === 'sale' ? 'Chứng từ bán xe' : 'Chứng từ giá vốn'}</legend>
            <input type="file" aria-label={prefix === 'sale' ? 'Chứng từ bán xe' : 'Chứng từ giá vốn'} disabled={busy} accept="application/pdf,image/jpeg,image/png"
              onChange={event => void uploadDocument(prefix,event.target.files?.[0])} className="max-w-full text-sm" />
            {documents[prefix] && <p className="text-sm text-emerald-700 dark:text-emerald-400">Đã tải chứng từ</p>}
          </fieldset>)}
          <button type="submit" disabled={busy || !documents.sale || !documents.cost} className={button}><FileText size={16} />Lưu hồ sơ nháp</button>
        </form>}
        {snapshot && <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt>Trạng thái</dt><dd>{snapshot.status === 'approved' ? 'Đã duyệt' : 'Nháp'}</dd>
            <dt>Giá bán</dt><dd>{snapshot.sale_price.toLocaleString('vi-VN')} VND</dd>
            <dt>Chiết khấu</dt><dd>{snapshot.discount_amount.toLocaleString('vi-VN')} VND</dd>
            <dt>Giá vốn</dt><dd>{snapshot.cost_basis.toLocaleString('vi-VN')} VND</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="inline-flex items-center gap-2 text-sm underline" onClick={() => void openDocument(snapshot.sale_document)}><FileText size={16} />Chứng từ bán xe</button>
            <button type="button" className="inline-flex items-center gap-2 text-sm underline" onClick={() => void openDocument(snapshot.cost_document)}><FileText size={16} />Chứng từ giá vốn</button>
          </div>
          {snapshot.status === 'draft' && !closed && <>
            <button type="button" disabled={busy} className={button} onClick={() => {
              setDocuments({sale:snapshot.sale_document,cost:snapshot.cost_document});setEditing(true);setVerifiedHash(null);
            }}><FileText size={16} />Sửa hồ sơ nháp</button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={event => setVerifiedHash(event.target.checked ? snapshot.reviewHash : null)} />Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.</label>
            <button type="button" disabled={busy || !verified || editing} className={button} onClick={() => void run('approve',{ snapshotId: snapshot.id, documentsVerified: true, reviewHash:snapshot.reviewHash },'Đã duyệt snapshot tài chính.')}><FileCheck size={16} />Duyệt snapshot</button>
          </>}
        </div>}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" disabled={busy || closed || !['allocated','delivered'].includes(vehicleStatus)} className={button} onClick={() => void run('handover',{ bookingId },'Đã lưu bằng chứng bàn giao.')}><Truck size={16} />{evidenceId ? 'Xác nhận lại bàn giao' : 'Xác nhận bàn giao'}</button>
          <button type="button" disabled={busy || closed || reversed || !evidenceId || snapshot?.status !== 'approved'} className={button} onClick={() => snapshot && evidenceId && void run('recognize',{ snapshotId: snapshot.id, handoverEvidenceId: evidenceId },'Đã ghi nhận doanh thu bán xe.')}><Check size={16} />Ghi nhận doanh thu</button>
          {busy && <Loader2 className="animate-spin" size={20} aria-label="Đang xử lý" />}
        </div>
        {snapshot?.status === 'approved' && <VehicleSalePayments key={`${snapshot.id}:${message}:${settlementVersion}`} bookingId={bookingId} />}
        <VehicleSaleSettlement bookingId={bookingId} tenantId={tenantId} onChanged={settlementChanged} onClosed={setClosed} />
        {snapshot?.status === 'approved' && <VehicleSaleRecognitionAdjustments key={`${snapshot.id}:${message}`} bookingId={bookingId} tenantId={tenantId} onChanged={settlementChanged} onReversed={setReversed} />}
      </Dialog.Panel>
    </div>
  </Dialog>;
}
