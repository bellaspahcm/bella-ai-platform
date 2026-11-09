'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Building2, RefreshCw } from 'lucide-react';

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  status: string;
  customerName: string | null;
  estimatedBudget: number | null;
  targetCompletionDate: string;
  leadArchitectName: string;
}

interface ProjectsResponse {
  success: boolean;
  data?: { projects?: ProjectRow[]; total?: number };
}

export default function InteriorDashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/interior/projects', { cache: 'no-store' });
      const body = (await response.json()) as ProjectsResponse;
      if (!response.ok || !body.success || !Array.isArray(body.data?.projects)) {
        throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc danh sách dự án.' : 'Danh sách dự án chưa khả dụng.');
      }
      setProjects(body.data.projects);
    } catch (cause) {
      setProjects([]);
      setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách dự án.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Bella Interior</p><h1 className="mt-1 text-2xl font-bold">Tổng quan dự án</h1><p className="mt-1 text-sm text-slate-500">Dữ liệu được đọc theo quyền và tenant hiện tại.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </header>
      {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">Đang tải dự án…</p>
        : error ? <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Không hiển thị dữ liệu mẫu.</strong><p className="mt-1">{error}</p></div></div>
          : projects.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"><Building2 className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">Chưa có dự án</p><p className="mt-1 text-sm text-slate-500">Danh sách trống theo dữ liệu hiện có của tenant.</p></div>
            : <section aria-label="Dự án trong tenant" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{project.code}</p><h2 className="mt-1 font-semibold">{project.name}</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{project.status}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Khách hàng</dt><dd>{project.customerName ?? 'Không được phép xem'}</dd></div><div><dt className="text-xs text-slate-500">Ngân sách</dt><dd>{typeof project.estimatedBudget === 'number' ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(project.estimatedBudget) : 'Không được phép xem'}</dd></div><div><dt className="text-xs text-slate-500">Ngày hoàn thành</dt><dd>{project.targetCompletionDate || '—'}</dd></div><div><dt className="text-xs text-slate-500">Chủ trì</dt><dd>{project.leadArchitectName || '—'}</dd></div></dl><nav className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-800"><Link className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400" href={`/dashboard/interior/projects/${project.id}`}>Chi tiết <ArrowRight className="h-3.5 w-3.5" /></Link><Link className="text-emerald-700 hover:underline dark:text-emerald-400" href={`/dashboard/interior/design?projectId=${encodeURIComponent(project.id)}`}>Thiết kế</Link><Link className="text-emerald-700 hover:underline dark:text-emerald-400" href={`/dashboard/interior/boq?projectId=${encodeURIComponent(project.id)}`}>BOQ</Link></nav></article>)}</section>}
    </main>
  );
}
