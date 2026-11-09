'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Layers, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DesignRevision } from '@/products/bella-interior/domain/design-specification/types';

interface DesignReadResponse {
  success: boolean;
  data?: {
    revisions?: DesignRevision[];
  };
}

export default function InteriorMaterialsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [revisions, setRevisions] = useState<DesignRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const materialSpecs = useMemo(
    () => revisions.flatMap((revision) => revision.materialSpecs),
    [revisions],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!projectId) {
        setRevisions([]);
        setError('Chọn dự án từ danh sách để xem dữ liệu vật liệu đã lưu.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/interior/design?projectId=${encodeURIComponent(projectId)}`, {
          cache: 'no-store',
        });
        const body = (await response.json()) as DesignReadResponse;
        if (!response.ok || !body.success || !Array.isArray(body.data?.revisions)) {
          throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc thiết kế.' : 'Dữ liệu vật liệu chưa khả dụng.');
        }
        if (active) setRevisions(body.data.revisions);
      } catch (cause) {
        if (active) {
          setRevisions([]);
          setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu vật liệu.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [projectId]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <Link href="/dashboard/interior/projects" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Dự án Interior</Link>
          <h1 className="mt-2 text-2xl font-bold">Vật liệu &amp; Spec</h1>
          <p className="mt-1 text-sm text-slate-500">Dữ liệu lấy từ revision thiết kế đã lưu trong tenant hiện tại.</p>
        </div>
        <Layers className="h-8 w-8 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      </header>

      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải dữ liệu…</p>
      ) : error ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><strong>Không hiển thị dữ liệu mẫu.</strong><p className="mt-1">{error}</p></div>
        </div>
      ) : materialSpecs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-semibold">Chưa có vật liệu được lưu</p>
          <p className="mt-1 text-sm text-slate-500">Danh sách trống theo dữ liệu hiện có của dự án.</p>
        </div>
      ) : (
        <section aria-label="Vật liệu đã lưu" className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr><th className="px-4 py-3">Vật liệu</th><th className="px-4 py-3">Nhóm</th><th className="px-4 py-3">Thương hiệu / mã</th><th className="px-4 py-3">Mô tả</th><th className="px-4 py-3">Trạng thái</th></tr>
            </thead>
            <tbody>
              {materialSpecs.map((spec) => (
                <tr key={spec.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium">{spec.name}</td><td className="px-4 py-3">{spec.itemCategory}</td><td className="px-4 py-3">{spec.brand} · {spec.code}</td><td className="px-4 py-3">{spec.specDescription}</td><td className="px-4 py-3">{spec.approvedForUse ? 'Đã duyệt sử dụng' : 'Tham khảo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
