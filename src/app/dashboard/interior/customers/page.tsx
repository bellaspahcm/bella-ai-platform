'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Search, Users } from 'lucide-react';

interface CustomerRow {
  id: string;
  name: string;
  projectCount: number;
}

interface CustomersResponse {
  success: boolean;
  data?: { customers?: CustomerRow[]; total?: number };
}

export default function InteriorCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visibleCustomers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return normalized ? customers.filter((customer) => customer.name.toLocaleLowerCase('vi').includes(normalized)) : customers;
  }, [customers, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/interior/customers', { cache: 'no-store' });
      const body = (await response.json()) as CustomersResponse;
      if (!response.ok || !body.success || !Array.isArray(body.data?.customers)) {
        throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc khách hàng.' : 'Danh sách khách hàng chưa khả dụng.');
      }
      setCustomers(body.data.customers);
    } catch (cause) {
      setCustomers([]);
      setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800"><div><Link href="/dashboard/interior" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Bella Interior</Link><h1 className="mt-2 text-2xl font-bold">Khách hàng</h1><p className="mt-1 text-sm text-slate-500">Danh sách lấy từ dự án thuộc tenant hiện tại.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button></header>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Tìm khách hàng" /></label>
      {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">Đang tải khách hàng…</p>
        : error ? <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Không hiển thị dữ liệu mẫu.</strong><p className="mt-1">{error}</p></div></div>
          : visibleCustomers.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"><Users className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">{customers.length ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng trong tenant hiện tại.'}</p></div>
            : <section aria-label="Khách hàng trong tenant" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleCustomers.map((customer) => <article key={customer.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">{customer.name}</h2><p className="mt-1 text-sm text-slate-500">{customer.projectCount} dự án</p></article>)}</section>}
    </main>
  );
}
