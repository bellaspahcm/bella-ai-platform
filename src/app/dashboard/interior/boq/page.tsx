'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { BOQItemSpecifications, BOQStatus } from '@/products/bella-interior/domain/commercial-costing/types';

interface ProjectOption { id: string; code: string; name: string; status: string }
interface ProjectListResponse { success: boolean; data?: { projects?: ProjectOption[] } }
interface BOQItemRow {
  id: string;
  itemCode: string;
  itemName: string;
  roomZoneName: string;
  specifications: BOQItemSpecifications;
  unit: string;
  quantity: number;
  internalUnitCost?: number;
  internalTotalCost?: number;
  clientUnitPrice?: number;
  clientTotalPrice?: number;
  grossMarginAmount?: number;
  grossMarginPercent?: number;
}
interface BOQRow {
  id: string;
  boqNumber: string;
  versionNumber: number;
  status: BOQStatus;
  designRevisionId: string;
  items: BOQItemRow[];
  totalInternalCost?: number;
  totalClientPrice?: number;
  totalGrossMargin?: number;
  grossMarginPercent?: number;
}
interface BOQTotals { internalCost?: number; clientPrice?: number; grossMargin?: number }
interface BOQResponse { success: boolean; data?: { boqs?: BOQRow[]; total?: number; totals?: BOQTotals } }

const formatMoney = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
  : 'Không được phép xem';

export default function InteriorBOQPage() {
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [boqs, setBOQs] = useState<BOQRow[]>([]);
  const [totals, setTotals] = useState<BOQTotals>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/interior/projects', { cache: 'no-store' });
        const body = (await response.json()) as ProjectListResponse;
        if (!response.ok || !body.success || !Array.isArray(body.data?.projects)) {
          throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc dự án.' : 'Danh sách dự án chưa khả dụng.');
        }
        if (!active) return;
        setProjects(body.data.projects);
        const selected = body.data.projects.find((project) => project.id === requestedProjectId) ?? body.data.projects[0];
        if (selected) setProjectId(selected.id);
        else { setBOQs([]); setError(null); setLoading(false); }
      } catch (cause) {
        if (active) { setProjects([]); setBOQs([]); setError(cause instanceof Error ? cause.message : 'Không thể tải dự án.'); setLoading(false); }
      }
    };
    void loadProjects();
    return () => { active = false; };
  }, [requestedProjectId]);

  const loadBOQ = useCallback(async (selectedProjectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/interior/boq?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: 'no-store' });
      const body = (await response.json()) as BOQResponse;
      if (!response.ok || !body.success || !Array.isArray(body.data?.boqs)) {
        throw new Error(response.status === 403 ? 'Bạn chưa được cấp quyền đọc BOQ.' : 'BOQ chưa khả dụng cho dự án này.');
      }
      setBOQs(body.data.boqs);
      setTotals(body.data.totals ?? {});
    } catch (cause) {
      setBOQs([]);
      setTotals({});
      setError(cause instanceof Error ? cause.message : 'Không thể tải BOQ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (projectId) void loadBOQ(projectId); }, [loadBOQ, projectId]);

  const handleProjectChange = (nextId: string) => {
    setProjectId(nextId);
    const url = new URL(window.location.href);
    url.searchParams.set('projectId', nextId);
    window.history.replaceState({}, '', url.toString());
  };

  const selectedProject = projects.find((project) => project.id === projectId);

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800"><div><Link href="/dashboard/interior/projects" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Dự án</Link><h1 className="mt-2 text-2xl font-bold">BOQ &amp; Dự toán</h1><p className="mt-1 text-sm text-slate-500">Giá vốn và giá bán chỉ xuất hiện khi quyết định quyền tương ứng cho phép.</p></div><div className="flex items-center gap-2"><select aria-label="Chọn dự án" value={projectId ?? ''} onChange={(event) => handleProjectChange(event.target.value)} disabled={!projects.length} className="max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="" disabled>Chọn dự án</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.code})</option>)}</select><button type="button" onClick={() => { if (projectId) void loadBOQ(projectId); }} disabled={loading || !projectId} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button></div></header>
      {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">Đang tải BOQ…</p>
        : error ? <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Không hiển thị dữ liệu BOQ mẫu.</strong><p className="mt-1">{error}</p></div></div>
          : boqs.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"><FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">{selectedProject ? `Chưa có BOQ cho ${selectedProject.name}` : 'Chưa có BOQ'}</p><p className="mt-1 text-sm text-slate-500">Không có bản dự toán được lưu cho dự án đã chọn.</p></div>
            : <div className="space-y-5">{(typeof totals?.internalCost === 'number' || typeof totals?.clientPrice === 'number' || typeof totals?.grossMargin === 'number') && <section className="grid gap-3 sm:grid-cols-3">{typeof totals.internalCost === 'number' && <Metric label="Tổng giá vốn" value={formatMoney(totals.internalCost)} />}{typeof totals.clientPrice === 'number' && <Metric label="Tổng giá khách hàng" value={formatMoney(totals.clientPrice)} />}{typeof totals.grossMargin === 'number' && <Metric label="Lợi nhuận gộp" value={formatMoney(totals.grossMargin)} />}</section>}{boqs.map((boq) => <section key={boq.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800"><div><h2 className="font-semibold">{boq.boqNumber} · R{boq.versionNumber}</h2><p className="text-xs text-slate-500">Revision thiết kế {boq.designRevisionId}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{boq.status}</span></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Mã / hạng mục</th><th className="px-4 py-3">Khu vực</th><th className="px-4 py-3">Quy cách</th><th className="px-4 py-3">SL</th><th className="px-4 py-3">Giá vốn</th><th className="px-4 py-3">Giá khách hàng</th><th className="px-4 py-3">Biên lợi nhuận</th></tr></thead><tbody>{boq.items.map((item) => <tr key={item.id} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="px-4 py-3"><strong>{item.itemName}</strong><p className="text-xs text-slate-500">{item.itemCode}</p></td><td className="px-4 py-3">{item.roomZoneName}</td><td className="px-4 py-3 text-xs"><p>{item.specifications.carcassMaterial}</p><p>{item.specifications.doorFrontMaterial}</p><p>{item.specifications.surfaceFinish}</p><p>{item.specifications.hardwareSpec}</p></td><td className="px-4 py-3">{item.quantity} {item.unit}</td><td className="px-4 py-3">{formatMoney(item.internalTotalCost)}</td><td className="px-4 py-3">{formatMoney(item.clientTotalPrice)}</td><td className="px-4 py-3">{typeof item.grossMarginPercent === 'number' ? `${item.grossMarginPercent}%` : 'Không được phép xem'}</td></tr>)}</tbody></table></div><footer className="grid gap-3 border-t border-slate-200 p-4 text-sm sm:grid-cols-4 dark:border-slate-800"><Metric label="Tổng giá vốn" value={formatMoney(boq.totalInternalCost)} /><Metric label="Tổng giá khách hàng" value={formatMoney(boq.totalClientPrice)} /><Metric label="Lợi nhuận gộp" value={formatMoney(boq.totalGrossMargin)} /><Metric label="Biên lợi nhuận" value={typeof boq.grossMarginPercent === 'number' ? `${boq.grossMarginPercent}%` : 'Không được phép xem'} /></footer></section>)}</div>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
