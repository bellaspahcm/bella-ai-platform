'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import type { SiteInstallationPlan } from '@/products/bella-interior/domain/manufacturing-install/types';

interface ScheduleReadResponse {
  success: boolean;
  data?: { plans?: SiteInstallationPlan[]; total?: number };
}

export default function InteriorSchedulePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [plans, setPlans] = useState<SiteInstallationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const response = await fetch(`/api/interior/schedule${query}`, { cache: 'no-store' });
      const body = (await response.json()) as ScheduleReadResponse;
      if (!response.ok || !body.success || !Array.isArray(body.data?.plans)) {
        throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc lịch thi công.' : 'Dữ liệu lịch thi công chưa khả dụng.');
      }
      setPlans(body.data.plans);
    } catch (cause) {
      setPlans([]);
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu lịch thi công.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <Link href="/dashboard/interior/projects" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Dự án Interior</Link>
          <h1 className="mt-2 text-2xl font-bold">Kế hoạch thi công</h1>
          <p className="mt-1 text-sm text-slate-500">Các kế hoạch thực tế được đọc từ tenant hiện tại.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải dữ liệu…</p>
      ) : error ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Không hiển thị lịch mẫu.</strong><p className="mt-1">{error}</p></div></div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"><CalendarDays className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">Chưa có kế hoạch thi công</p><p className="mt-1 text-sm text-slate-500">Danh sách trống theo dữ liệu hiện có của tenant.</p></div>
      ) : (
        <section aria-label="Kế hoạch thi công" className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{plan.planNumber}</h2><p className="mt-1 text-xs text-slate-500">Dự án {plan.projectId}</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">{plan.overallProgressPercent}%</span></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Giám sát</dt><dd>{plan.siteSupervisorName}</dd></div><div><dt className="text-xs text-slate-500">Thời gian</dt><dd>{plan.scheduledStartDate} — {plan.scheduledEndDate}</dd></div></dl>
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800"><p className="mb-2 text-xs font-semibold text-slate-500">Khu vực ({plan.rooms.length})</p>{plan.rooms.length ? <ul className="space-y-2">{plan.rooms.map((room) => <li key={room.id} className="flex items-center justify-between gap-3 text-sm"><span>{room.roomZoneName}</span><span className="text-xs text-slate-500">{room.status.replaceAll('_', ' ')} · {room.progressPercent}%</span></li>)}</ul> : <p className="text-sm text-slate-500">Chưa gắn khu vực.</p>}</div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
