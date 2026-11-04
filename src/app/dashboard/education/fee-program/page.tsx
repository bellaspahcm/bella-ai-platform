'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type FeeType = { id: string; code: string; display_name: string; status: 'ACTIVE' | 'INACTIVE' };
type Item = { id: string; display_name: string };
type ItemVersion = { id: string; fee_item_id: string; fee_type_code: string; amount: number | null; currency: string | null; status: string; fee_item_name_snapshot: string | null };
type Program = { id: string; display_name: string; status: string };
type Version = { id: string; fee_program_id: string; billing_period_policy_version_id: string | null; status: string; published_at: string | null };
type Membership = { program_version_id: string; fee_item_version_id: string };
type State = { types: FeeType[]; items: Item[]; itemVersions: ItemVersion[]; programs: Program[]; versions: Version[]; membership: Membership[] };
const empty: State = { types: [], items: [], itemVersions: [], programs: [], versions: [], membership: [] };
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const button = 'rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isState(value: unknown): value is State {
  if (!isRecord(value)) return false;
  const optionalString = (v: unknown) => v === null || typeof v === 'string';
  return Array.isArray(value.types) && value.types.every((v: unknown) => isRecord(v) && typeof v.id === 'string' && typeof v.code === 'string' && typeof v.display_name === 'string' && (v.status === 'ACTIVE' || v.status === 'INACTIVE'))
    && Array.isArray(value.items) && value.items.every((v: unknown) => isRecord(v) && typeof v.id === 'string' && typeof v.display_name === 'string')
    && Array.isArray(value.itemVersions) && value.itemVersions.every((v: unknown) => isRecord(v) && typeof v.id === 'string' && typeof v.fee_item_id === 'string' && typeof v.fee_type_code === 'string' && (v.amount === null || typeof v.amount === 'number') && optionalString(v.currency) && typeof v.status === 'string' && optionalString(v.fee_item_name_snapshot))
    && Array.isArray(value.programs) && value.programs.every((v: unknown) => isRecord(v) && typeof v.id === 'string' && typeof v.display_name === 'string' && typeof v.status === 'string')
    && Array.isArray(value.versions) && value.versions.every((v: unknown) => isRecord(v) && typeof v.id === 'string' && typeof v.fee_program_id === 'string' && optionalString(v.billing_period_policy_version_id) && typeof v.status === 'string' && optionalString(v.published_at))
    && Array.isArray(value.membership) && value.membership.every((v: unknown) => isRecord(v) && typeof v.program_version_id === 'string' && typeof v.fee_item_version_id === 'string');
}

function FeeTypeEditor({ type, busy, save }: { type: FeeType; busy: boolean; save: (event: FormEvent, action: string, values: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(type.display_name);
  const [status, setStatus] = useState(type.status);
  return <form className="space-y-2 rounded-lg bg-slate-50 p-3" onSubmit={(event) => void save(event, 'update_type', { id: type.id, name, status })}>
    <p className="font-medium">{type.code}</p>
    <label className="block">Tên loại phí<input className={field} value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label className="block">Trạng thái<select className={field} value={status} onChange={(event) => setStatus(event.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')}><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option></select></label>
    <button className={button} disabled={busy}>Lưu loại phí</button>
  </form>;
}

export default function FeeProgramPage() {
  const [data, setData] = useState<State>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemId, setItemId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [programName, setProgramName] = useState('');
  const [programId, setProgramId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [itemVersionId, setItemVersionId] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/education/fee-program', { cache: 'no-store' });
    const payload: unknown = await res.json();
    if (!res.ok || !isRecord(payload) || !isState(payload.data)) {
      throw new Error('Không thể tải cấu hình phí. Vui lòng kiểm tra quyền và thử lại.');
    }
    setData(payload.data);
    setReady(true);
  }, []);

  useEffect(() => { void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không thể tải cấu hình phí.')); }, [load]);

  async function submit(event: FormEvent, action: string, values: Record<string, unknown>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/education/fee-program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      if (!res.ok) throw new Error('Không thể lưu hoặc publish. Kiểm tra thông tin, quyền và trạng thái phiên bản.');
      try { await load(); } catch { throw new Error('Đã ghi dữ liệu nhưng chưa tải lại được. Vui lòng tải lại trang trước khi thử tiếp.'); }
      setMessage('Đã lưu và tải lại dữ liệu.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể lưu cấu hình.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-900">
    <Link href="/dashboard/education/finance" className="text-indigo-700 underline">← Tài chính</Link>
    <header><h1 className="text-2xl font-bold">Chương trình phí</h1><p className="mt-2">Quản lý mã phí và phiên bản cấu hình của trường.</p></header>
    <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Chính sách kỳ thu chưa cấu hình. Các phiên bản này chưa sẵn sàng để tính học phí.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    {!ready ? !error && <p>Đang tải cấu hình…</p> : <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border p-4"><h2 className="text-lg font-semibold">Loại phí cố định</h2>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'create_type', { code: typeCode, name: typeName })}>
          <label className="block">Mã loại phí<input className={field} value={typeCode} onChange={(e) => setTypeCode(e.target.value)} required pattern="[A-Z][A-Z0-9_]{0,79}" /></label>
          <label className="block">Tên loại phí<input className={field} value={typeName} onChange={(e) => setTypeName(e.target.value)} required /></label><button className={button} disabled={busy}>Tạo loại phí</button>
        </form>
        <ul className="space-y-2">{data.types.map((type) => <li key={type.id}><FeeTypeEditor type={type} busy={busy} save={submit} /></li>)}</ul>
      </section>
      <section className="space-y-3 rounded-xl border p-4"><h2 className="text-lg font-semibold">Khoản phí</h2>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'create_item', { name: itemName })}><label className="block">Tên khoản phí<input className={field} value={itemName} onChange={(e) => setItemName(e.target.value)} required /></label><button className={button} disabled={busy}>Tạo khoản phí</button></form>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'create_item_version', { itemId, typeCode: selectedType, amount: Number(amount), currency })}>
          <h3 className="font-medium">Tạo phiên bản khoản phí</h3>
          <label className="block">Khoản phí<select aria-label="Khoản phí" className={field} value={itemId} onChange={(e) => setItemId(e.target.value)} required><option value="">Chọn khoản phí</option>{data.items.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
          <label className="block">Loại phí<select aria-label="Loại phí" className={field} value={selectedType} onChange={(e) => setSelectedType(e.target.value)} required><option value="">Chọn loại phí</option>{data.types.filter((type) => type.status === 'ACTIVE').map((type) => <option key={type.id} value={type.code}>{type.display_name} ({type.code})</option>)}</select></label>
          <label className="block">Số tiền<input className={field} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          <label className="block">Mã tiền tệ<input className={field} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} pattern="[A-Z]{3}" required /></label><button className={button} disabled={busy}>Tạo phiên bản phí</button>
        </form>
        <ul>{data.itemVersions.map((item) => <li key={item.id}>{item.fee_item_name_snapshot ?? data.items.find((entry) => entry.id === item.fee_item_id)?.display_name ?? item.fee_item_id}: {item.amount} {item.currency} — {item.status}</li>)}</ul>
      </section>
      <section className="space-y-3 rounded-xl border p-4"><h2 className="text-lg font-semibold">Chương trình phí</h2>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'create_program', { name: programName })}><label className="block">Tên chương trình<input className={field} value={programName} onChange={(e) => setProgramName(e.target.value)} required /></label><button className={button} disabled={busy}>Tạo chương trình</button></form>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'create_version', { programId })}><label className="block">Chương trình<select aria-label="Chương trình" className={field} value={programId} onChange={(e) => setProgramId(e.target.value)} required><option value="">Chọn chương trình</option>{data.programs.filter((program) => program.status === 'ACTIVE').map((program) => <option key={program.id} value={program.id}>{program.display_name}</option>)}</select></label><button className={button} disabled={busy}>Tạo phiên bản chương trình</button></form>
        <form className="space-y-2" onSubmit={(e) => void submit(e, 'add_item', { versionId, itemVersionId })}>
          <label className="block">Phiên bản nháp<select aria-label="Phiên bản nháp" className={field} value={versionId} onChange={(e) => setVersionId(e.target.value)} required><option value="">Chọn phiên bản</option>{data.versions.filter((version) => version.status === 'DRAFT').map((version) => <option key={version.id} value={version.id}>{data.programs.find((program) => program.id === version.fee_program_id)?.display_name} — {version.id}</option>)}</select></label>
          <label className="block">Phiên bản phí<select aria-label="Phiên bản phí" className={field} value={itemVersionId} onChange={(e) => setItemVersionId(e.target.value)} required><option value="">Chọn phiên bản phí</option>{data.itemVersions.map((item) => <option key={item.id} value={item.id}>{item.fee_item_name_snapshot ?? data.items.find((entry) => entry.id === item.fee_item_id)?.display_name} — {item.amount} {item.currency} — {item.id}</option>)}</select></label><button className={button} disabled={busy}>Thêm phí vào phiên bản</button>
        </form>
      </section>
      <section className="space-y-3 rounded-xl border p-4"><h2 className="text-lg font-semibold">Phiên bản chương trình</h2>
        {data.versions.length === 0 && <p>Chưa có phiên bản.</p>}
        <ul className="space-y-4">{data.versions.map((version) => <li key={version.id} className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{data.programs.find((program) => program.id === version.fee_program_id)?.display_name ?? 'Chương trình'} — {version.status}</p><p className="break-all text-sm">{version.id}</p><p className="text-sm text-amber-800">{version.billing_period_policy_version_id === null ? 'POLICY_PENDING — Chờ cấu hình kỳ thu' : 'Đã có tham chiếu chính sách kỳ thu'}</p><p className="text-sm">{data.membership.filter((link) => link.program_version_id === version.id).length} khoản phí</p>{version.status === 'DRAFT' && <form onSubmit={(e) => void submit(e, 'publish', { versionId: version.id })}><button className={button} disabled={busy}>Publish phiên bản</button></form>}</li>)}</ul>
      </section>
    </div>}
  </main>;
}
