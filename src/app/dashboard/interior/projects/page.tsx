'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw, Search } from 'lucide-react';

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

export default function InteriorProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    if (!normalized) return projects;
    return projects.filter((project) => `${project.code} ${project.name} ${project.status}`.toLocaleLowerCase('vi').includes(normalized));
  }, [projects, query]);

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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800"><div><Link href="/dashboard/interior" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Bella Interior</Link><h1 className="mt-2 text-2xl font-bold">Danh mục dự án</h1><p className="mt-1 text-sm text-slate-500">Chỉ hiển thị trường được API cho phép theo quyền hiện tại.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button></header>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Tìm theo mã, tên hoặc trạng thái" /></label>
      {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">Đang tải dự án…</p>
        : error ? <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Không hiển thị dữ liệu mẫu.</strong><p className="mt-1">{error}</p></div></div>
          : visibleProjects.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{projects.length ? 'Không tìm thấy dự án phù hợp.' : 'Chưa có dự án trong tenant hiện tại.'}</div>
            : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Dự án</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Ngân sách</th><th className="px-4 py-3">Hoàn thành dự kiến</th><th className="px-4 py-3">Chủ trì</th><th className="px-4 py-3">Mở</th></tr></thead><tbody>{visibleProjects.map((project) => <tr key={project.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3"><Link className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" href={`/dashboard/interior/projects/${project.id}`}>{project.name}</Link><p className="text-xs text-slate-500">{project.code}</p></td><td className="px-4 py-3">{project.status}</td><td className="px-4 py-3">{project.customerName ?? 'Không được phép xem'}</td><td className="px-4 py-3">{typeof project.estimatedBudget === 'number' ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(project.estimatedBudget) : 'Không được phép xem'}</td><td className="px-4 py-3">{project.targetCompletionDate || '—'}</td><td className="px-4 py-3">{project.leadArchitectName || '—'}</td><td className="px-4 py-3"><Link aria-label={`Mở ${project.code}`} href={`/dashboard/interior/projects/${project.id}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400">Chi tiết <ArrowRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody></table></div>}
    </main>
  );
}
