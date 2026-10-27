'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, GitFork, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';

interface Branch {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
}

type BranchView =
  | { readonly status: 'loading' }
  | { readonly status: 'denied' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly branches: readonly Branch[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBranches(value: unknown): Branch[] | null {
  if (!Array.isArray(value)) return null;
  const branches: Branch[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string'
      || (item.code !== undefined && typeof item.code !== 'string')) return null;
    branches.push({ id: item.id, name: item.name, ...(typeof item.code === 'string' ? { code: item.code } : {}) });
  }
  return branches;
}

function branchErrorMessage(code: unknown): string {
  if (code === 'PRESCHOOL_CHAIN_BRANCH_CODE_CONFLICT') return 'Mã chi nhánh này đã được sử dụng trong trường.';
  if (code === 'PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED') return 'Tài khoản hiện tại không có quyền quản lý chi nhánh.';
  if (code === 'PRESCHOOL_CHAIN_BRANCH_INVALID_REQUEST') return 'Tên hoặc mã chi nhánh chưa hợp lệ.';
  return 'Chưa thể lưu chi nhánh. Vui lòng tải lại và thử lại.';
}

export default function BranchManagementWorkspace() {
  const [view, setView] = useState<BranchView>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const submitLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setView({ status: 'loading' });
    void fetch('/api/education/branches/manage', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      const payload: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setView({ status: 'denied' });
          return;
        }
        throw new Error('BRANCH_LIST_UNAVAILABLE');
      }
      if (!isRecord(payload) || payload.success !== true) throw new Error('BRANCH_LIST_UNAVAILABLE');
      const branches = parseBranches(payload.branches);
      if (!branches || !Number.isInteger(payload.count) || payload.count !== branches.length) {
        throw new Error('BRANCH_LIST_INVALID');
      }
      if (!controller.signal.aborted) setView({ status: 'ready', branches });
    }).catch(() => {
      if (!controller.signal.aborted) setView({ status: 'error' });
    });
    return () => controller.abort();
  }, [refreshKey]);

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || saving) return;
    submitLock.current = true;
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const normalizedName = name.trim();
      const normalizedCode = code.trim();
      const response = await fetch('/api/education/branches/manage', {
        method: 'POST',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName, ...(normalizedCode ? { code: normalizedCode } : {}) }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || payload.success !== true || !isRecord(payload.branch)
        || typeof payload.branch.id !== 'string' || typeof payload.branch.name !== 'string') {
        setFormError(branchErrorMessage(isRecord(payload) ? payload.error : undefined));
        return;
      }
      setName('');
      setCode('');
      setShowForm(false);
      setNotice(`Đã tạo chi nhánh ${payload.branch.name}.`);
      reload();
    } catch {
      setFormError('Không kết nối được với dịch vụ chi nhánh. Vui lòng thử lại.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  const visibleBranches = view.status === 'ready'
    ? view.branches.filter((branch) => `${branch.name} ${branch.code ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
    : [];

  return (
    <main className="w-full space-y-5 p-4 sm:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <Link href="/dashboard/education" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0e5c43] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Quay lại tổng quan
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[#0e5c43]">
              <GitFork className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Bella Preschool</p>
              <h1 className="text-2xl font-bold text-slate-900">Quản lý chi nhánh</h1>
              <p className="mt-1 text-sm text-slate-600">Danh sách chi nhánh đang hoạt động trong trường.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={reload} disabled={view.status === 'loading'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${view.status === 'loading' ? 'animate-spin' : ''}`} /> Tải lại
            </button>
            {view.status !== 'denied' && (
              <button type="button" onClick={() => { setShowForm((current) => !current); setFormError(''); }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e5c43] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4633]">
                {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showForm ? 'Đóng biểu mẫu' : 'Tạo chi nhánh'}
              </button>
            )}
          </div>
        </div>
      </header>

      {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</p>}

      {showForm && view.status !== 'denied' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Thông tin chi nhánh mới</h2>
            <p className="mt-1 text-sm text-slate-600">Thông tin được lưu vào danh mục đơn vị tổ chức của trường.</p>
          </div>
          <form onSubmit={createBranch} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Tên chi nhánh <span className="text-rose-600">*</span>
              <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)}
                autoComplete="organization" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Mã chi nhánh <span className="font-normal text-slate-500">(không bắt buộc)</span>
              <input maxLength={40} value={code} onChange={(event) => setCode(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
            {formError && <p role="alert" className="sm:col-span-2 flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" disabled={saving} onClick={() => { setShowForm(false); setFormError(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={saving || name.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e5c43] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a4633] disabled:cursor-not-allowed disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Đang lưu…' : 'Lưu chi nhánh'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chi nhánh của trường</h2>
            {view.status === 'ready' && <p className="mt-1 text-sm text-slate-600">Hiển thị {visibleBranches.length} / {view.branches.length} chi nhánh</p>}
          </div>
          {view.status === 'ready' && (
            <label className="relative block w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã chi nhánh"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
          )}
        </div>

        {view.status === 'loading' && <p className="py-8 text-center text-sm text-slate-500">Đang tải danh sách chi nhánh…</p>}
        {view.status === 'denied' && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">Tài khoản hiện tại không có quyền quản lý chi nhánh Preschool.</p>}
        {view.status === 'error' && <div className="rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-900"><p>Chưa tải được danh sách chi nhánh.</p><button type="button" onClick={reload} className="mt-2 font-semibold underline">Thử lại</button></div>}
        {view.status === 'ready' && visibleBranches.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">{view.branches.length === 0 ? 'Trường chưa có chi nhánh đang hoạt động.' : 'Không tìm thấy chi nhánh phù hợp.'}</p>
        )}
        {view.status === 'ready' && visibleBranches.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visibleBranches.map((branch) => (
              <li key={branch.id} className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-[#0e5c43]"><GitFork className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{branch.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">Mã chi nhánh: {branch.code || 'Chưa có mã'}</p>
                  </div>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Đang hoạt động</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
