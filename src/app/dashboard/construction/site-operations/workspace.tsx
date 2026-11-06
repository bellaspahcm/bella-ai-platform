'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertTriangle, CalendarDays, Check, ClipboardList, LoaderCircle, Plus, RefreshCw, Save, X } from 'lucide-react';
import type {
  ConstructionActivityWorkPackageChoice,
  ConstructionIssue,
  ConstructionIssueStatus,
  ConstructionSiteActivityChoice,
  ConstructionSiteDiaryEntry,
} from '@/platform/construction/site-operations.contract';

interface SiteOperationsResponse {
  readonly success: true;
  readonly sites?: ConstructionSiteActivityChoice[];
  readonly site?: ConstructionSiteActivityChoice;
  readonly workPackages?: ConstructionActivityWorkPackageChoice[];
  readonly diaryEntries?: ConstructionSiteDiaryEntry[];
  readonly issues?: ConstructionIssue[];
  readonly currentUserId?: string;
}
interface DiaryDraft { entryDate: string; workPackageId: string; content: string }
interface IssueDraft { title: string; description: string; dueDate: string; diaryEntryId: string; workPackageId: string }
interface IssueEditDraft extends IssueDraft { issueId: string }
interface TransitionDraft { issueId: string; action: 'resolve' | 'reopen'; text: string }
type Tab = 'diary' | 'issues';

const emptyDiary: DiaryDraft = { entryDate: new Date().toISOString().slice(0, 10), workPackageId: '', content: '' };
const emptyIssue: IssueDraft = { title: '', description: '', dueDate: '', diaryEntryId: '', workPackageId: '' };
const statusLabels: Record<ConstructionIssueStatus, string> = {
  OPEN: 'Mới phát sinh', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã khắc phục', CLOSED: 'Đã đóng',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function requestJson(url: string, init?: RequestInit): Promise<SiteOperationsResponse> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || body.success !== true) {
    if (response.status === 403) throw new Error('Tài khoản chưa được cấp quyền cho Site hoặc thao tác này.');
    if (response.status === 404) throw new Error('Không tìm thấy Site hoặc bản ghi trong phạm vi được phép.');
    if (response.status === 400 || response.status === 422) throw new Error('Thông tin nhập chưa hợp lệ. Hãy kiểm tra các trường bắt buộc.');
    throw new Error('Không tải hoặc lưu được dữ liệu công trình. Vui lòng thử lại.');
  }
  return body as unknown as SiteOperationsResponse;
}

function displayDate(value: string | null): string {
  if (!value) return 'Chưa đặt hạn';
  const parts = value.slice(0, 10).split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function creatorLabel(userId: string, currentUserId: string | undefined): string {
  return userId === currentUserId ? 'Bạn' : 'Tài khoản ' + userId.slice(0, 8);
}

function ActionButton({
  children, onClick, type = 'button', disabled = false, primary = false,
}: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; primary?: boolean }) {
  return <button
    className={'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ' + (primary ? 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400')}
    disabled={disabled} onClick={onClick} type={type}>{children}</button>;
}

const controlClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

export default function ConstructionSiteOperationsWorkspace() {
  const [sites, setSites] = useState<ConstructionSiteActivityChoice[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedSite, setSelectedSite] = useState<ConstructionSiteActivityChoice | null>(null);
  const [workPackages, setWorkPackages] = useState<ConstructionActivityWorkPackageChoice[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<ConstructionSiteDiaryEntry[]>([]);
  const [issues, setIssues] = useState<ConstructionIssue[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [tab, setTab] = useState<Tab>('diary');
  const [diaryDraft, setDiaryDraft] = useState<DiaryDraft>(emptyDiary);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(emptyIssue);
  const [editingIssue, setEditingIssue] = useState<IssueEditDraft | null>(null);
  const [transitionDraft, setTransitionDraft] = useState<TransitionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson('/api/construction/site-operations');
      const rows = result.sites ?? [];
      setSites(rows);
      setSelectedSiteId((current) => current && rows.some((site) => site.id === current) ? current : (rows[0]?.id ?? ''));
    } catch (cause) {
      setSites([]);
      setSelectedSiteId('');
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách công trường.');
    } finally { setLoading(false); }
  }, []);

  const loadSiteData = useCallback(async (siteId: string) => {
    const currentRequest = ++requestId.current;
    if (!siteId) {
      setSelectedSite(null); setWorkPackages([]); setDiaryEntries([]); setIssues([]); setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    try {
      const result = await requestJson('/api/construction/site-operations?site_id=' + encodeURIComponent(siteId));
      if (currentRequest !== requestId.current) return;
      setSelectedSite(result.site ?? null);
      setWorkPackages(result.workPackages ?? []);
      setDiaryEntries(result.diaryEntries ?? []);
      setIssues(result.issues ?? []);
      setCurrentUserId(result.currentUserId);
      setEditingDiaryId(null); setEditingIssue(null); setTransitionDraft(null);
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setSelectedSite(null); setWorkPackages([]); setDiaryEntries([]); setIssues([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu của công trường.');
    } finally { if (currentRequest === requestId.current) setLoading(false); }
  }, []);

  useEffect(() => { void loadSites(); }, [loadSites]);
  useEffect(() => {
    setDiaryDraft({ ...emptyDiary, entryDate: new Date().toISOString().slice(0, 10) });
    setIssueDraft(emptyIssue); setNotice(null);
    void loadSiteData(selectedSiteId);
  }, [selectedSiteId, loadSiteData]);

  async function submitDiary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSiteId || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const payload = editingDiaryId
        ? { kind: 'diary', siteId: selectedSiteId, entryId: editingDiaryId, entryDate: diaryDraft.entryDate, workPackageId: diaryDraft.workPackageId || null, content: diaryDraft.content }
        : { kind: 'diary', siteId: selectedSiteId, entryDate: diaryDraft.entryDate, workPackageId: diaryDraft.workPackageId || null, content: diaryDraft.content };
      await requestJson('/api/construction/site-operations', {
        method: editingDiaryId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      setNotice(editingDiaryId ? 'Đã cập nhật nhật ký thi công.' : 'Đã ghi nhật ký thi công.');
      setDiaryDraft({ ...emptyDiary, entryDate: new Date().toISOString().slice(0, 10) }); setEditingDiaryId(null);
      await loadSiteData(selectedSiteId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được nhật ký thi công.'); }
    finally { setBusy(false); }
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSiteId || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const fields = editingIssue ?? issueDraft;
      const payload = editingIssue
        ? { kind: 'issue', siteId: selectedSiteId, issueId: editingIssue.issueId, action: 'update', title: fields.title, description: fields.description, dueDate: fields.dueDate || null, diaryEntryId: fields.diaryEntryId || null, workPackageId: fields.workPackageId || null }
        : { kind: 'issue', siteId: selectedSiteId, title: fields.title, description: fields.description, dueDate: fields.dueDate || null, diaryEntryId: fields.diaryEntryId || null, workPackageId: fields.workPackageId || null };
      await requestJson('/api/construction/site-operations', {
        method: editingIssue ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      setNotice(editingIssue ? 'Đã cập nhật vấn đề công trình.' : 'Đã ghi nhận vấn đề công trình.');
      setIssueDraft(emptyIssue); setEditingIssue(null);
      await loadSiteData(selectedSiteId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được vấn đề công trình.'); }
    finally { setBusy(false); }
  }

  async function transition(issueId: string, action: 'start' | 'resolve' | 'close' | 'reopen', text = '') {
    if (!selectedSiteId || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const body: Record<string, string> = { kind: 'issue', siteId: selectedSiteId, issueId, action };
      if (action === 'resolve') body.resolutionResult = text;
      if (action === 'reopen') body.reopenReason = text;
      await requestJson('/api/construction/site-operations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setNotice(action === 'resolve' ? 'Đã xác nhận khắc phục.' : action === 'reopen' ? 'Đã mở lại vấn đề.' : action === 'close' ? 'Đã đóng vấn đề.' : 'Đã chuyển sang đang xử lý.');
      setTransitionDraft(null);
      await loadSiteData(selectedSiteId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái vấn đề.'); }
    finally { setBusy(false); }
  }

  const selectedLabel = selectedSite ? selectedSite.site_code + ' · ' + selectedSite.name : '';
  const canCreateDiary = selectedSite?.can_create_diary === true;
  const canUpdateDiary = selectedSite?.can_update_diary === true;
  const canCreateIssue = selectedSite?.can_create_issue === true;
  const canUpdateIssue = selectedSite?.can_update_issue === true;

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Construction OS</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Nhật ký &amp; Vấn đề công trình</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Ghi nhận hoạt động tại công trường và theo dõi vấn đề đến khi xử lý xong.</p>
      </div>
      <div className="flex items-end gap-2">
        <label className="min-w-64 text-sm font-medium text-slate-700">Công trường
          <select className={controlClass} value={selectedSiteId} disabled={busy} onChange={(event) => setSelectedSiteId(event.target.value)}>
            <option value="">Chọn công trường</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.site_code} · {site.name}</option>)}
          </select>
        </label>
        <ActionButton onClick={() => { void (selectedSiteId ? loadSiteData(selectedSiteId) : loadSites()); }} disabled={loading}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Làm mới
        </ActionButton>
      </div>
    </header>

    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

    <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Chức năng công trường">
      <button className={'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ' + (tab === 'diary' ? 'border-slate-900 text-slate-950' : 'border-transparent text-slate-500')} onClick={() => setTab('diary')} role="tab" aria-selected={tab === 'diary'} type="button"><CalendarDays className="h-4 w-4" /> Nhật ký thi công</button>
      <button className={'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ' + (tab === 'issues' ? 'border-slate-900 text-slate-950' : 'border-transparent text-slate-500')} onClick={() => setTab('issues')} role="tab" aria-selected={tab === 'issues'} type="button"><ClipboardList className="h-4 w-4" /> Vấn đề công trình</button>
    </div>

    {!selectedSiteId && !loading && <EmptyState title="Chưa có công trường trong phạm vi quyền của bạn" detail="Danh sách chỉ hiển thị Site thuộc Tenant và Org Unit được phép truy cập." />}
    {selectedSite && selectedSite.id === selectedSiteId && <section aria-label={(tab === 'diary' ? 'Nhật ký tại ' : 'Vấn đề tại ') + selectedLabel} className="space-y-5">
      {tab === 'diary' ? <>
        {(canCreateDiary || editingDiaryId) && <form onSubmit={submitDiary} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editingDiaryId ? 'Sửa nhật ký' : 'Ghi nhật ký thi công'}</h2><p className="mt-1 text-sm text-slate-500">{selectedLabel} · Tác giả lấy từ phiên đăng nhập.</p></div>{editingDiaryId && <ActionButton onClick={() => { setEditingDiaryId(null); setDiaryDraft({ ...emptyDiary, entryDate: new Date().toISOString().slice(0, 10) }); }}><X className="h-4 w-4" /> Hủy</ActionButton>}</div>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <label className="text-sm font-medium text-slate-700">Ngày thi công tại Site<input className={controlClass} type="date" required value={diaryDraft.entryDate} onChange={(event) => setDiaryDraft({ ...diaryDraft, entryDate: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Gói công việc (không bắt buộc)<select className={controlClass} value={diaryDraft.workPackageId} onChange={(event) => setDiaryDraft({ ...diaryDraft, workPackageId: event.target.value })}><option value="">Không liên kết gói công việc</option>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.work_package_code} · {item.name}</option>)}</select></label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">Nội dung nhật ký<textarea className={controlClass + ' min-h-32'} required maxLength={10000} value={diaryDraft.content} onChange={(event) => setDiaryDraft({ ...diaryDraft, content: event.target.value })} placeholder="Diễn biến và hoạt động thi công trong ngày..." /></label>
          <div className="mt-4 flex justify-end"><ActionButton type="submit" primary disabled={busy || loading}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingDiaryId ? 'Lưu thay đổi' : 'Lưu nhật ký'}</ActionButton></div>
        </form>}
        <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Nhật ký tại {selectedSite.name}</h2><span className="text-sm text-slate-500">{diaryEntries.length} bản ghi</span></div>
          {loading ? <LoadingState /> : diaryEntries.length === 0 ? <EmptyState title="Chưa có nhật ký" detail="Khi có ghi nhận thi công, các bản ghi sẽ xuất hiện tại đây." /> : diaryEntries.map((entry) => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays className="h-4 w-4 text-slate-500" />Ngày thi công {displayDate(entry.entry_date)}</div><p className="mt-1 text-xs text-slate-500">Người ghi: {creatorLabel(entry.author_user_id, currentUserId)}{entry.work_package_id ? ' · Gói ' + (workPackages.find((item) => item.id === entry.work_package_id)?.work_package_code ?? 'đã liên kết') : ''}</p></div>{canUpdateDiary && !editingDiaryId && <ActionButton onClick={() => { setEditingDiaryId(entry.id); setDiaryDraft({ entryDate: entry.entry_date, workPackageId: entry.work_package_id ?? '', content: entry.content }); }}>Chỉnh sửa</ActionButton>}</div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.content}</p>
          </article>)}
        </div>
      </> : <>
        {(canCreateIssue || editingIssue) && <form onSubmit={submitIssue} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editingIssue ? 'Sửa vấn đề' : 'Ghi nhận vấn đề'}</h2><p className="mt-1 text-sm text-slate-500">{selectedLabel} · Có thể ghi trực tiếp, không cần nhật ký.</p></div>{editingIssue && <ActionButton onClick={() => setEditingIssue(null)}><X className="h-4 w-4" /> Hủy</ActionButton>}</div>
          <label className="block text-sm font-medium text-slate-700">Tiêu đề<input className={controlClass} required maxLength={250} value={editingIssue?.title ?? issueDraft.title} onChange={(event) => editingIssue ? setEditingIssue({ ...editingIssue, title: event.target.value }) : setIssueDraft({ ...issueDraft, title: event.target.value })} /></label>
          <label className="mt-4 block text-sm font-medium text-slate-700">Mô tả vấn đề<textarea className={controlClass + ' min-h-28'} required maxLength={10000} value={editingIssue?.description ?? issueDraft.description} onChange={(event) => editingIssue ? setEditingIssue({ ...editingIssue, description: event.target.value }) : setIssueDraft({ ...issueDraft, description: event.target.value })} /></label>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Hạn xử lý (không bắt buộc)<input className={controlClass} type="date" value={editingIssue?.dueDate ?? issueDraft.dueDate} onChange={(event) => editingIssue ? setEditingIssue({ ...editingIssue, dueDate: event.target.value }) : setIssueDraft({ ...issueDraft, dueDate: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-700">Nhật ký liên quan<select className={controlClass} value={editingIssue?.diaryEntryId ?? issueDraft.diaryEntryId} onChange={(event) => editingIssue ? setEditingIssue({ ...editingIssue, diaryEntryId: event.target.value }) : setIssueDraft({ ...issueDraft, diaryEntryId: event.target.value })}><option value="">Không liên kết nhật ký</option>{diaryEntries.map((entry) => <option key={entry.id} value={entry.id}>{displayDate(entry.entry_date)} · {entry.content.slice(0, 60)}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Gói công việc<select className={controlClass} value={editingIssue?.workPackageId ?? issueDraft.workPackageId} onChange={(event) => editingIssue ? setEditingIssue({ ...editingIssue, workPackageId: event.target.value }) : setIssueDraft({ ...issueDraft, workPackageId: event.target.value })}><option value="">Không liên kết gói công việc</option>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.work_package_code} · {item.name}</option>)}</select></label>
          </div>
          <div className="mt-4 flex justify-end"><ActionButton type="submit" primary disabled={busy || loading}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingIssue ? 'Lưu thay đổi' : 'Tạo vấn đề'}</ActionButton></div>
        </form>}
        <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Vấn đề tại {selectedSite.name}</h2><span className="text-sm text-slate-500">{issues.length} vấn đề</span></div>
          {loading ? <LoadingState /> : issues.length === 0 ? <EmptyState title="Chưa có vấn đề" detail="Các vấn đề phát sinh tại Site sẽ được theo dõi đến khi đóng." /> : issues.map((issue) => <article key={issue.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-slate-900">{issue.title}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[issue.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{issue.description}</p><p className="mt-3 text-xs text-slate-500">Tạo bởi {creatorLabel(issue.created_by, currentUserId)} · Hạn: {displayDate(issue.due_date)}{issue.work_package_id ? ' · Gói ' + (workPackages.find((item) => item.id === issue.work_package_id)?.work_package_code ?? 'đã liên kết') : ''}{issue.diary_entry_id ? ' · Có liên kết nhật ký' : ''}</p>{issue.resolution_result && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Kết quả khắc phục:</strong> {issue.resolution_result}</p>}{issue.reopen_reason && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Lý do mở lại:</strong> {issue.reopen_reason}</p>}</div>
              <div className="flex flex-wrap gap-2">{canUpdateIssue && (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') && !editingIssue && <ActionButton onClick={() => setEditingIssue({ issueId: issue.id, title: issue.title, description: issue.description, dueDate: issue.due_date ?? '', diaryEntryId: issue.diary_entry_id ?? '', workPackageId: issue.work_package_id ?? '' })}>Sửa</ActionButton>}{issue.status === 'OPEN' && selectedSite.can_update_issue && <ActionButton onClick={() => { void transition(issue.id, 'start'); }}>Bắt đầu xử lý</ActionButton>}{(issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') && selectedSite.can_resolve_issue && <ActionButton onClick={() => setTransitionDraft({ issueId: issue.id, action: 'resolve', text: '' })}>Xác nhận khắc phục</ActionButton>}{issue.status === 'RESOLVED' && selectedSite.can_close_issue && <ActionButton onClick={() => { void transition(issue.id, 'close'); }}>Đóng vấn đề</ActionButton>}{(issue.status === 'RESOLVED' || issue.status === 'CLOSED') && selectedSite.can_reopen_issue && <ActionButton onClick={() => setTransitionDraft({ issueId: issue.id, action: 'reopen', text: '' })}>Mở lại</ActionButton>}</div>
            </div>
            {transitionDraft?.issueId === issue.id && <form onSubmit={(event) => { event.preventDefault(); void transition(issue.id, transitionDraft.action, transitionDraft.text); }} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><label className="block text-sm font-medium text-slate-700">{transitionDraft.action === 'resolve' ? 'Kết quả khắc phục' : 'Lý do mở lại'}<textarea className={controlClass + ' min-h-24'} required maxLength={5000} value={transitionDraft.text} onChange={(event) => setTransitionDraft({ ...transitionDraft, text: event.target.value })} /></label><div className="mt-3 flex justify-end gap-2"><ActionButton onClick={() => setTransitionDraft(null)}><X className="h-4 w-4" /> Hủy</ActionButton><ActionButton type="submit" primary disabled={busy}><Check className="h-4 w-4" /> Xác nhận</ActionButton></div></form>}
          </article>)}
        </div>
      </>}
    </section>}
  </main>;
}

function LoadingState() {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải dữ liệu...</div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><ClipboardList className="mx-auto h-7 w-7 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}
