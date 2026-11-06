'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HardHat,
  LoaderCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import {
  type ConstructionAssigneeChoice,
  type ConstructionProjectChoice,
  type ConstructionScheduleItem,
  type ConstructionSiteChoice,
  type ConstructionWorkPackageChoice,
  isRecord,
  parseScheduleItem,
} from '@/platform/construction/schedule.contract';

interface ScheduleResponse {
  readonly success: true;
  readonly projects?: ConstructionProjectChoice[];
  readonly sites?: ConstructionSiteChoice[];
  readonly workPackages?: ConstructionWorkPackageChoice[];
  readonly scheduleItems?: ConstructionScheduleItem[];
  readonly assignees?: ConstructionAssigneeChoice[];
  readonly canWrite?: boolean;
  readonly scheduleItem?: ConstructionScheduleItem;
}

interface Draft {
  title: string;
  baselineStartDate: string;
  baselineEndDate: string;
  responsibleUserId: string;
  predecessorScheduleItemId: string;
}

interface ProgressDraft {
  forecastStartDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  progressPercent: string;
  delayReason: string;
  responsibleUserId: string;
  predecessorScheduleItemId: string;
}

const blankDraft: Draft = {
  title: '', baselineStartDate: '', baselineEndDate: '', responsibleUserId: '', predecessorScheduleItemId: '',
};

function messageFor(code: string): string {
  if (code === 'CONSTRUCTION_ACCESS_DENIED') return 'Tài khoản chưa có quyền xem hoặc cập nhật tiến độ trong phạm vi này.';
  if (code === 'CONSTRUCTION_NOT_FOUND') return 'Không tìm thấy hạng mục trong phạm vi được phép.';
  if (code === 'CONSTRUCTION_INVALID_REQUEST') return 'Dữ liệu nhập chưa hợp lệ. Hãy kiểm tra các trường và khoảng ngày.';
  if (code === 'CONSTRUCTION_SCHEDULE_CONSTRAINT') return 'Không thể lưu: hãy kiểm tra người phụ trách và ngày bắt đầu so với công việc tiên quyết.';
  return 'Không tải hoặc lưu được dữ liệu tiến độ. Vui lòng thử lại.';
}

async function requestJson(url: string, init?: RequestInit): Promise<ScheduleResponse> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.success !== true) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'CONSTRUCTION_UNAVAILABLE';
    throw new Error(messageFor(code));
  }
  return payload as unknown as ScheduleResponse;
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function startProgressDraft(item: ConstructionScheduleItem): ProgressDraft {
  return {
    forecastStartDate: item.forecast_start_date,
    forecastEndDate: item.forecast_end_date,
    actualStartDate: item.actual_start_date ?? '',
    actualEndDate: item.actual_end_date ?? '',
    progressPercent: String(item.progress_percent),
    delayReason: item.delay_reason ?? '',
    responsibleUserId: item.responsible_user_id ?? '',
    predecessorScheduleItemId: item.predecessor_schedule_item_id ?? '',
  };
}

export default function ConstructionScheduleWorkspace() {
  const [projects, setProjects] = useState<ConstructionProjectChoice[]>([]);
  const [sites, setSites] = useState<ConstructionSiteChoice[]>([]);
  const [workPackages, setWorkPackages] = useState<ConstructionWorkPackageChoice[]>([]);
  const [items, setItems] = useState<ConstructionScheduleItem[]>([]);
  const [assignees, setAssignees] = useState<ConstructionAssigneeChoice[]>([]);
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [workPackageId, setWorkPackageId] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState<ProgressDraft | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scheduleRequest = useRef(0);
  const selectedScope = useRef({ siteId, workPackageId });
  useLayoutEffect(() => {
    selectedScope.current = { siteId, workPackageId };
    ++scheduleRequest.current;
  }, [siteId, workPackageId]);
  const invalidateSchedule = useCallback(() => { ++scheduleRequest.current; }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson('/api/construction/schedule');
      const rows = result.projects;
      if (!rows) throw new Error('Không nhận được danh sách dự án thi công hợp lệ.');
      setProjects(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dự án thi công.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  useEffect(() => {
    let active = true;
    setSites([]);
    setSiteId('');
    setWorkPackages([]);
    setWorkPackageId('');
    setItems([]);
    setAssignees([]);
    setCanWrite(false);
    setError(null);
    if (!projectId) return () => { active = false; };
    setLoading(true);
    void requestJson(`/api/construction/schedule?project_id=${encodeURIComponent(projectId)}`)
      .then((result) => {
        if (active) setSites(result.sites ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được công trường.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setWorkPackages([]);
    setWorkPackageId('');
    setItems([]);
    setAssignees([]);
    setCanWrite(false);
    setError(null);
    if (!siteId) return () => { active = false; };
    setLoading(true);
    void requestJson(`/api/construction/schedule?site_id=${encodeURIComponent(siteId)}`)
      .then((result) => {
        if (active) setWorkPackages(result.workPackages ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được gói công việc.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId]);

  const loadSchedule = useCallback(async (selectedSiteId: string, selectedWorkPackageId: string) => {
    const requestId = ++scheduleRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson(
        `/api/construction/schedule?site_id=${encodeURIComponent(selectedSiteId)}&work_package_id=${encodeURIComponent(selectedWorkPackageId)}`,
      );
      if (requestId !== scheduleRequest.current) return;
      setItems(result.scheduleItems ?? []);
      setAssignees(result.assignees ?? []);
      setCanWrite(result.canWrite === true);
      setEditingId(null);
      setProgressDraft(null);
    } catch (cause) {
      if (requestId !== scheduleRequest.current) return;
      setItems([]);
      setAssignees([]);
      setCanWrite(false);
      setError(cause instanceof Error ? cause.message : 'Không tải được tiến độ công việc.');
    } finally {
      if (requestId === scheduleRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    invalidateSchedule();
    setItems([]);
    setAssignees([]);
    setCanWrite(false);
    setShowCreate(false);
    setDraft(blankDraft);
    setNotice(null);
    setEditingId(null);
    setProgressDraft(null);
    if (!siteId || !workPackageId) {
      setLoading(false);
      return;
    }
    void loadSchedule(siteId, workPackageId);
    return invalidateSchedule;
  }, [siteId, workPackageId, loadSchedule, invalidateSchedule]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const averageProgress = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.progress_percent, 0) / items.length)
    : 0;
  const completeCount = items.filter((item) => item.progress_percent === 100).length;
  const delayedCount = items.filter((item) => item.forecast_end_date > item.baseline_end_date).length;
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedSite = sites.find((site) => site.id === siteId);
  const selectedWorkPackage = workPackages.find((workPackage) => workPackage.id === workPackageId);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workPackageId || busy) return;
    const predecessor = items.find((item) => item.id === draft.predecessorScheduleItemId);
    if (predecessor && draft.baselineStartDate < predecessor.forecast_end_date) {
      setError('Ngày bắt đầu kế hoạch phải bằng hoặc sau ngày dự báo kết thúc của công việc tiên quyết.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestJson('/api/construction/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workPackageId,
          title: draft.title.trim(),
          baselineStartDate: draft.baselineStartDate,
          baselineEndDate: draft.baselineEndDate,
          responsibleUserId: draft.responsibleUserId || null,
          predecessorScheduleItemId: draft.predecessorScheduleItemId || null,
        }),
      });
      const item = result.scheduleItem;
      if (!item || !parseScheduleItem(item)) throw new Error('Không nhận được bản ghi tiến độ sau khi lưu.');
      if (selectedScope.current.siteId !== siteId || selectedScope.current.workPackageId !== workPackageId) return;
      setDraft(blankDraft);
      setShowCreate(false);
      setNotice('Đã tạo công việc và tải lại dữ liệu đã lưu.');
      await loadSchedule(siteId, workPackageId);
    } catch (cause) {
      if (selectedScope.current.siteId === siteId && selectedScope.current.workPackageId === workPackageId) {
        setError(cause instanceof Error ? cause.message : 'Không tạo được công việc.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitProgress(event: FormEvent<HTMLFormElement>, item: ConstructionScheduleItem) {
    event.preventDefault();
    if (!progressDraft || busy) return;
    const predecessor = items.find((candidate) => candidate.id === progressDraft.predecessorScheduleItemId);
    if (predecessor && progressDraft.forecastStartDate < predecessor.forecast_end_date) {
      setError('Ngày dự báo bắt đầu phải bằng hoặc sau ngày dự báo kết thúc của công việc tiên quyết.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await requestJson('/api/construction/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleItemId: item.id,
          forecastStartDate: progressDraft.forecastStartDate,
          forecastEndDate: progressDraft.forecastEndDate,
          actualStartDate: progressDraft.actualStartDate || null,
          actualEndDate: progressDraft.actualEndDate || null,
          progressPercent: Number(progressDraft.progressPercent),
          delayReason: progressDraft.delayReason.trim() || null,
          responsibleUserId: progressDraft.responsibleUserId || null,
          predecessorScheduleItemId: progressDraft.predecessorScheduleItemId || null,
        }),
      });
      if (selectedScope.current.siteId !== siteId || selectedScope.current.workPackageId !== workPackageId) return;
      setNotice('Đã cập nhật tiến độ và tải lại dữ liệu đã lưu.');
      await loadSchedule(siteId, workPackageId);
    } catch (cause) {
      if (selectedScope.current.siteId === siteId && selectedScope.current.workPackageId === workPackageId) {
        setError(cause instanceof Error ? cause.message : 'Không cập nhật được tiến độ.');
      }
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item: ConstructionScheduleItem) {
    setEditingId(item.id);
    setProgressDraft(startProgressDraft(item));
    setError(null);
  }

  function updateProgressDraft<K extends keyof ProgressDraft>(key: K, value: ProgressDraft[K]) {
    setProgressDraft((current) => current ? { ...current, [key]: value } : current);
  }

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';
  const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <HardHat className="h-4 w-4" /> Construction OS
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lịch thi công &amp; tiến độ</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Theo dõi kế hoạch gốc, dự báo, ngày thực tế và phần trăm hoàn thành theo gói công việc. Kế hoạch gốc được giữ làm mốc; cập nhật điều chỉnh dự báo và thực tế.
            </p>
          </div>
          <button type="button" onClick={() => { if (siteId && workPackageId) void loadSchedule(siteId, workPackageId); else void loadProjects(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" /> Làm mới
          </button>
        </header>

        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
          <label>
            <span className={labelClass}>Dự án</span>
            <select className={fieldClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Chọn dự án</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.name}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Công trường</span>
            <select className={fieldClass} value={siteId} disabled={!projectId} onChange={(event) => setSiteId(event.target.value)}>
              <option value="">Chọn công trường</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.site_code} · {site.name}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Gói công việc</span>
            <select className={fieldClass} value={workPackageId} disabled={!siteId} onChange={(event) => setWorkPackageId(event.target.value)}>
              <option value="">Chọn gói công việc</option>
              {workPackages.map((workPackage) => <option key={workPackage.id} value={workPackage.id}>{workPackage.work_package_code} · {workPackage.name}</option>)}
            </select>
          </label>
        </section>

        {workPackageId && <section aria-label="Tổng quan tiến độ" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<CalendarDays className="h-5 w-5" />} label="Công việc" value={String(items.length)} detail="Trong gói công việc đã chọn" />
          <Metric icon={<TrendingUp className="h-5 w-5" />} label="Tiến độ bình quân" value={`${averageProgress}%`} detail="Trung bình các công việc" />
          <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Hoàn tất" value={`${completeCount}/${items.length}`} detail="Công việc đạt 100%" />
          <Metric icon={<Clock3 className="h-5 w-5" />} label="Dự báo trễ" value={String(delayedCount)} detail="Dự báo kết thúc sau kế hoạch gốc" tone={delayedCount > 0 ? 'warning' : 'default'} />
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold">Công việc theo kế hoạch</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {selectedProject?.name ?? 'Chưa chọn dự án'}{selectedSite ? ` / ${selectedSite.name}` : ''}{selectedWorkPackage ? ` / ${selectedWorkPackage.name}` : ''}
              </p>
            </div>
            {workPackageId && canWrite && <button type="button" onClick={() => { setShowCreate((shown) => !shown); setError(null); }} className={buttonClass}>
              <Plus className="h-4 w-4" /> Thêm công việc
            </button>}
          </div>

          {showCreate && canWrite && <form onSubmit={submitCreate} className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50 md:grid-cols-2 xl:grid-cols-3">
            <label className="md:col-span-2 xl:col-span-3"><span className={labelClass}>Tên công việc</span><input required maxLength={180} className={fieldClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ví dụ: Hoàn thiện hệ thống điện tầng 2" /></label>
            <label><span className={labelClass}>Kế hoạch gốc · bắt đầu</span><input required type="date" className={fieldClass} value={draft.baselineStartDate} onChange={(event) => setDraft({ ...draft, baselineStartDate: event.target.value })} /></label>
            <label><span className={labelClass}>Kế hoạch gốc · kết thúc</span><input required type="date" className={fieldClass} value={draft.baselineEndDate} onChange={(event) => setDraft({ ...draft, baselineEndDate: event.target.value })} /></label>
            <label><span className={labelClass}>Người phụ trách</span><select className={fieldClass} value={draft.responsibleUserId} onChange={(event) => setDraft({ ...draft, responsibleUserId: event.target.value })}><option value="">Chưa phân công</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <label className="md:col-span-2 xl:col-span-2"><span className={labelClass}>Công việc tiên quyết · cùng gói</span><select className={fieldClass} value={draft.predecessorScheduleItemId} onChange={(event) => setDraft({ ...draft, predecessorScheduleItemId: event.target.value })}><option value="">Không có</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <div className="flex items-end gap-2"><button disabled={busy} className={buttonClass}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Tạo kế hoạch</button><button type="button" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { setShowCreate(false); setDraft(blankDraft); setError(null); }}>Hủy</button></div>
          </form>}

          {!workPackageId ? <EmptyState title="Chọn gói công việc" detail="Chọn dự án, công trường và gói công việc để xem lịch và tiến độ đã lưu." />
            : loading ? <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tải dữ liệu Construction…</div>
              : items.length === 0 ? <EmptyState title="Chưa có công việc trong kế hoạch" detail={canWrite ? 'Tạo công việc đầu tiên để ghi nhận kế hoạch gốc.' : 'Tài khoản của bạn chưa có quyền tạo lịch trong gói công việc này.'} />
                : <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item) => {
                    const predecessor = item.predecessor_schedule_item_id ? itemById.get(item.predecessor_schedule_item_id) : undefined;
                    const assignee = item.responsible_user_id ? assignees.find((person) => person.id === item.responsible_user_id) : undefined;
                    const isDelayed = item.forecast_end_date > item.baseline_end_date;
                    return <article key={item.id} className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{item.title}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDelayed ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{isDelayed ? 'Dự báo trễ kế hoạch' : 'Trong kế hoạch'}</span>
                          </div>
                          <div className="grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                            <DatePair label="Kế hoạch gốc" value={`${dateLabel(item.baseline_start_date)} – ${dateLabel(item.baseline_end_date)}`} />
                            <DatePair label="Dự báo mới nhất" value={`${dateLabel(item.forecast_start_date)} – ${dateLabel(item.forecast_end_date)}`} />
                            <DatePair label="Thực tế" value={`${dateLabel(item.actual_start_date)} – ${dateLabel(item.actual_end_date)}`} />
                            <div><span className="block text-slate-500 dark:text-slate-400">Phụ trách / tiên quyết</span><span className="mt-1 flex flex-wrap items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200"><UserRound className="h-3.5 w-3.5" />{assignee?.full_name ?? (item.responsible_user_id ? 'Người dùng trong tenant' : 'Chưa phân công')}<span className="mx-1 text-slate-300">·</span>{predecessor?.title ?? (item.predecessor_schedule_item_id ? 'Công việc tiên quyết' : 'Không có')}</span></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${item.progress_percent}%` }} /></div>
                            <span className="w-12 text-right text-sm font-bold tabular-nums">{item.progress_percent}%</span>
                          </div>
                          {item.delay_reason && <p className="text-xs text-amber-800 dark:text-amber-200">Lý do chậm: {item.delay_reason}</p>}
                        </div>
                        {canWrite && <button type="button" onClick={() => beginEdit(item)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cập nhật tiến độ</button>}
                      </div>
                      {editingId === item.id && progressDraft && <form onSubmit={(event) => void submitProgress(event, item)} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60 md:grid-cols-2 xl:grid-cols-4">
                        <label><span className={labelClass}>Dự báo · bắt đầu</span><input required type="date" className={fieldClass} value={progressDraft.forecastStartDate} onChange={(event) => updateProgressDraft('forecastStartDate', event.target.value)} /></label>
                        <label><span className={labelClass}>Dự báo · kết thúc</span><input required type="date" className={fieldClass} value={progressDraft.forecastEndDate} onChange={(event) => updateProgressDraft('forecastEndDate', event.target.value)} /></label>
                        <label><span className={labelClass}>Thực tế · bắt đầu</span><input type="date" className={fieldClass} value={progressDraft.actualStartDate} onChange={(event) => updateProgressDraft('actualStartDate', event.target.value)} /></label>
                        <label><span className={labelClass}>Thực tế · kết thúc</span><input type="date" className={fieldClass} value={progressDraft.actualEndDate} onChange={(event) => updateProgressDraft('actualEndDate', event.target.value)} /></label>
                        <label><span className={labelClass}>Hoàn thành (%)</span><input required type="number" min="0" max="100" step="0.01" className={fieldClass} value={progressDraft.progressPercent} onChange={(event) => updateProgressDraft('progressPercent', event.target.value)} /></label>
                        <label><span className={labelClass}>Người phụ trách</span><select className={fieldClass} value={progressDraft.responsibleUserId} onChange={(event) => updateProgressDraft('responsibleUserId', event.target.value)}><option value="">Chưa phân công</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
                        <label className="xl:col-span-2"><span className={labelClass}>Công việc tiên quyết · cùng gói</span><select className={fieldClass} value={progressDraft.predecessorScheduleItemId} onChange={(event) => updateProgressDraft('predecessorScheduleItemId', event.target.value)}><option value="">Không có</option>{items.filter((candidate) => candidate.id !== item.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select></label>
                        <label className="md:col-span-2 xl:col-span-3"><span className={labelClass}>Lý do chậm (nếu có)</span><input maxLength={1000} className={fieldClass} value={progressDraft.delayReason} onChange={(event) => updateProgressDraft('delayReason', event.target.value)} /></label>
                        <div className="flex items-end gap-2"><button disabled={busy} className={buttonClass}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Lưu cập nhật</button><button type="button" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { setEditingId(null); setProgressDraft(null); }}>Hủy</button></div>
                      </form>}
                    </article>;
                  })}
                </div>}
        </section>
        {workPackageId && !canWrite && !loading && !error && <p className="text-xs text-slate-500 dark:text-slate-400">Bạn có thể xem dữ liệu được phép truy cập. Để thêm hoặc cập nhật, cần direct grant `construction:work_package:write` trong tenant / Org Unit phù hợp.</p>}
        {!loading && projects.length === 0 && !error && <EmptyState title="Chưa có dự án Construction được cấp quyền" detail="Khi tenant có Project, Site và Work Package hợp lệ cùng quyền đọc, các lựa chọn sẽ hiển thị ở đây." />}
      </div>
    </main>
  );
}

function Metric({ icon, label, value, detail, tone = 'default' }: { icon: ReactNode; label: string; value: string; detail: string; tone?: 'default' | 'warning' }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${tone === 'warning' ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
    <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span><span className={tone === 'warning' ? 'text-amber-600 dark:text-amber-300' : 'text-blue-600 dark:text-blue-300'}>{icon}</span></div>
    <div className="mt-3 text-2xl font-bold tabular-nums">{value}</div>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
  </div>;
}

function DatePair({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-slate-500 dark:text-slate-400">{label}</span><span className="mt-1 block font-medium text-slate-700 dark:text-slate-200">{value}</span></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="flex flex-col items-center px-5 py-14 text-center">
    <div className="mb-3 rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><CalendarDays className="h-6 w-6" /></div>
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{detail}</p>
  </div>;
}
