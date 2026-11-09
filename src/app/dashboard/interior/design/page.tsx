'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, FileText, RefreshCw, Ruler } from 'lucide-react';
import type { DesignRevision, ProjectRoomZone } from '@/products/bella-interior/domain/design-specification/types';

interface DesignReadResponse {
  success: boolean;
  data?: {
    revisions?: DesignRevision[];
    roomZones?: ProjectRoomZone[];
  };
}

export default function InteriorDesignPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [revisions, setRevisions] = useState<DesignRevision[]>([]);
  const [roomZones, setRoomZones] = useState<ProjectRoomZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!projectId) {
      setRevisions([]);
      setRoomZones([]);
      setError('Thiếu projectId. Mở Thiết kế từ một dự án đã được cấp quyền.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/interior/design?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      const body = (await response.json()) as DesignReadResponse;
      if (!response.ok || !body.success || !Array.isArray(body.data?.revisions) || !Array.isArray(body.data?.roomZones)) {
        throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc dữ liệu thiết kế.' : 'Dữ liệu thiết kế chưa khả dụng.');
      }
      setRevisions(body.data.revisions);
      setRoomZones(body.data.roomZones);
    } catch (cause) {
      setRevisions([]);
      setRoomZones([]);
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu thiết kế.');
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
          <h1 className="mt-2 text-2xl font-bold">Thiết kế &amp; Revision</h1>
          <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị revision và khu vực đã lưu trong tenant hiện tại.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || !projectId} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải dữ liệu…</p>
      ) : error ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Không hiển thị dữ liệu mẫu.</strong><p className="mt-1">{error}</p></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-5 w-5" /> Revision thiết kế ({revisions.length})</h2>
            {revisions.length === 0 ? <p className="mt-4 text-sm text-slate-500">Chưa có revision được lưu.</p> : (
              <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                {revisions.map((revision) => (
                  <li key={revision.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{revision.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">v{revision.versionNumber} · {revision.status}</span></div>
                    <p className="mt-1 text-xs text-slate-500">Gửi lúc {new Date(revision.submittedAt).toLocaleString('vi-VN')}</p>
                    {revision.changeSummary && <p className="mt-2 text-sm">{revision.changeSummary}</p>}
                    <p className="mt-2 text-xs text-slate-500">{revision.assets.length} tài sản · {revision.materialSpecs.length} spec vật liệu</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 font-semibold"><Ruler className="h-5 w-5" /> Khu vực dự án ({roomZones.length})</h2>
            {roomZones.length === 0 ? <p className="mt-4 text-sm text-slate-500">Chưa có khu vực được lưu.</p> : (
              <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                {roomZones.map((zone) => <li key={zone.id} className="flex items-center justify-between gap-4 py-3"><div><strong>{zone.name}</strong><p className="text-xs text-slate-500">{zone.code}</p></div><span className="text-sm text-slate-500">Tầng {zone.floor}{zone.areaSquareMeters ? ` · ${zone.areaSquareMeters} m²` : ''}</span></li>)}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
