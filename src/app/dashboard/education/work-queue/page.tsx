'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, HeartPulse, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { QueueAction, QueueItem, QueuePage, QueueStatus, QueueView } from '@/products/bella-education/work-queue/work-queue.types';

const groups = [
  { value: 'absences', title: 'Duyệt nghỉ học', icon: FileText },
  { value: 'health', title: 'Sự cố sức khỏe', icon: HeartPulse },
  { value: 'parents', title: 'Yêu cầu phụ huynh', icon: MessageSquare },
] as const;
const outcomeLabel = { APPROVED: 'Đã duyệt nghỉ học', DECLINED: 'Đã từ chối nghỉ học', HANDLED: 'Đã ghi nhận xử lý', CLOSED: 'Đã đóng sự cố' };
const requestLabels: Record<string, string> = { ABSENCE_REQUEST: 'Đơn xin nghỉ học', MEDICATION_ADMIN_REQUEST: 'Yêu cầu về thuốc',
  CHANGE_PICKUP_PERSON: 'Thay đổi người đón', DIET_PREFERENCE_REQUEST: 'Yêu cầu dinh dưỡng', CLUB_REGISTRATION: 'Đăng ký câu lạc bộ',
  OVERDUE_PAYMENT_SLA: 'Học phí quá hạn' };
const statusLabel: Record<string, string> = { OPEN: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý', CLOSED: 'Đã đóng', BYPASSED: 'Đã bỏ qua' };
function date(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? value : instant.toLocaleString('vi-VN');
}
type Reply = { success?: boolean; error?: string; item?: QueueItem } & Partial<QueuePage>;

function ReviewHistory({ item }: { item: QueueItem }) {
  if (!item.review && !item.resolvedAt && !item.resolvedBy) return null;
  return <div className="rounded-xl bg-muted/60 p-4 text-sm space-y-1">
    <p className="font-semibold">{item.review ? outcomeLabel[item.review.outcome] : statusLabel[item.status] ?? item.status}</p>
    {item.review && <p className="whitespace-pre-wrap break-words">{item.review.note}</p>}
    <p className="text-muted-foreground">Thời điểm: {date(item.resolvedAt)} · Người xử lý: {item.resolvedBy ?? 'Chưa ghi nhận'}</p>
  </div>;
}

function WorkQueue() {
  const params = useSearchParams();
  const view: QueueView = params.get('view') === 'health' ? 'health' : params.get('view') === 'parents' ? 'parents' : 'absences';
  const [status, setStatus] = useState<QueueStatus>('open');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<QueuePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [requiresReload, setRequiresReload] = useState(false);
  const [saved, setSaved] = useState<QueueItem | null>(null);
  const contextKey = `${view}:${status}:${page}`;
  const contextRef = useRef(contextKey);
  useEffect(() => { contextRef.current = contextKey; }, [contextKey]);

  useEffect(() => { setStatus('open'); setPage(1); setSelectedId(null); setSaved(null); setSaveError(''); }, [view]);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    fetch(`/api/education/work-queue?view=${view}&status=${status}&page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload: Reply = await response.json();
        if (!response.ok || !payload.success || !payload.items || payload.total === undefined || payload.page === undefined
          || payload.pages === undefined || payload.pageSize === undefined) throw new Error(payload.error ?? 'Không thể tải danh sách.');
        if (current) {
          setData({ items: payload.items, total: payload.total, page: payload.page, pages: payload.pages, pageSize: payload.pageSize });
          setRequiresReload(false); setSaveError('');
        }
      })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [view, status, page, reload]);

  async function submit(item: QueueItem, action: QueueAction) {
    if (requiresReload || saving) return;
    const note = (drafts[item.id] ?? '').trim();
    if (!note) { setSaveError('Vui lòng nhập ghi chú xử lý.'); return; }
    const submittedContext = contextKey;
    setSaving(true); setSaveError(''); setSaved(null);
    try {
      const response = await fetch('/api/education/work-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: item.view, id: item.id, action, note, expectedUpdatedAt: item.updatedAt }) });
      const payload: Reply = await response.json();
      if (!response.ok || !payload.success || !payload.item || payload.item.id !== item.id || !payload.item.review
        || payload.item.status === 'OPEN') throw new Error(payload.error ?? 'Chưa xác minh được kết quả đã lưu. Vui lòng tải lại.');
      if (contextRef.current === submittedContext) {
        setSaved(payload.item); setSelectedId(null);
        setDrafts(previous => { const next = { ...previous }; delete next[item.id]; return next; });
        setReload(value => value + 1);
      }
    } catch (reason) {
      if (contextRef.current === submittedContext) {
        setRequiresReload(true);
        setSaveError(reason instanceof Error ? reason.message : 'Không nhận được kết quả xử lý.');
      }
    } finally { setSaving(false); }
  }

  const title = groups.find(group => group.value === view)?.title;
  return <div className="preschool-ui w-full min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8 text-foreground">
    <header className="space-y-3">
      <Link href="/dashboard/education" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="size-4" />Tổng quan Preschool</Link>
      <h1 className="text-2xl font-bold">Xử lý yêu cầu và sự cố</h1>
      <p className="text-sm text-muted-foreground">Dữ liệu của trường hiện tại. Kết quả xử lý được lưu cùng người thực hiện và thời điểm.</p>
    </header>
    <nav aria-label="Nhóm cần xử lý" className="flex flex-wrap gap-2">
      {groups.map(({ value, title: label, icon: Icon }) => <Link key={value} href={`/dashboard/education/work-queue?view=${value}`}
        aria-current={view === value ? 'page' : undefined} aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${view === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>
        <Icon className="size-4" />{label}</Link>)}
    </nav>
    <section aria-labelledby="queue-title" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div><h2 id="queue-title" className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">
          {view === 'absences' ? 'Duyệt hoặc từ chối đơn nghỉ học. Quyết định này không thay đổi điểm danh.'
            : view === 'health' ? 'Xem hồ sơ và ghi nhận đóng sự cố. Không thay thế việc chăm sóc hoặc điều trị.'
              : 'Ghi nhận kết quả xử lý; không tự thực hiện cấp thuốc, đổi người đón, đăng ký CLB hoặc thanh toán.'}</p></div>
        <Button variant="outline" onClick={() => setReload(value => value + 1)} disabled={saving || loading}><RefreshCw className="size-4" />Tải lại</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <label className="flex items-center gap-2 text-sm font-medium">Trạng thái
          <select aria-label="Trạng thái xử lý" className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            value={status} disabled={saving} onChange={event => {
              const next = event.target.value;
              if (next === 'open' || next === 'history' || next === 'all') setStatus(next);
              setPage(1); setSelectedId(null); setSaveError('');
            }}>
            <option value="open">Chờ xử lý</option><option value="history">Lịch sử đã xử lý</option><option value="all">Tất cả</option>
          </select></label>
        <span className="text-sm text-muted-foreground">{data ? `${data.total} hồ sơ · Trang ${data.page}/${data.pages}` : '—'}</span>
      </div>
      {saved && <div role="status" className="m-5 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" />Đã lưu kết quả xử lý — {saved.studentName ?? saved.studentId}</p>
        <ReviewHistory item={saved} /></div>}
      {saveError && <p role="alert" className="m-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{saveError} Ghi chú bạn nhập vẫn được giữ lại.{requiresReload && ' Hãy tải lại hồ sơ để kiểm tra kết quả trước khi thử lại.'}</p>}
      {loading && <p role="status" className="p-8 text-muted-foreground">Đang tải hồ sơ…</p>}
      {!loading && error && <div className="p-6 space-y-3"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={() => setReload(value => value + 1)}>Thử tải lại</Button></div>}
      {!loading && !error && data?.items.length === 0 && <p className="p-8 text-muted-foreground">Không có hồ sơ trong nhóm và trạng thái này.</p>}
      {!loading && !error && data && <div className="divide-y divide-border">{data.items.map(item => {
        const blocked = item.view === 'health' && item.escalationRequired && !item.acknowledgedAt;
        return <article key={item.id} aria-labelledby={`record-${item.id}`} className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div>
            <h3 id={`record-${item.id}`} className="font-bold">{item.studentName ?? 'Chưa đối chiếu được tên trẻ'}{item.studentCode ? ` · ${item.studentCode}` : ''}</h3>
            <p className="text-sm text-muted-foreground">{requestLabels[item.type] ?? item.type} · {date(item.createdAt)}</p>
            <p className="mt-1 text-xs break-all text-muted-foreground">Mã hồ sơ: {item.id} · Mã trẻ: {item.studentId}</p>
          </div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{item.review ? outcomeLabel[item.review.outcome] : statusLabel[item.status] ?? item.status}</span></div>
          {item.view !== 'health' && <p className="text-sm">Phụ huynh: <span className="font-medium">{item.guardianName ?? 'Chưa đối chiếu được danh tính'}</span></p>}
          <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.view === 'health' ? 'Nội dung sự cố' : 'Nội dung yêu cầu gốc'}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.description ?? 'Chưa ghi nhận nội dung.'}</p></div>
          {item.view === 'health' && <div className="space-y-2 text-sm">
            <p>Mức độ: <strong>{item.severity}</strong></p><p className="whitespace-pre-wrap break-words">Đã thực hiện: {item.actionTaken ?? 'Chưa ghi nhận'}</p>
            {item.contextNotes && <p className="whitespace-pre-wrap break-words">Ghi chú trước đó: {item.contextNotes}</p>}
            <p>Thông báo phụ huynh: {date(item.parentNotifiedAt)}</p><p>Xác nhận phụ huynh: {date(item.acknowledgedAt)}</p>
            {blocked && <p className="rounded-lg bg-destructive/10 p-3 text-destructive">Cần xác nhận phụ huynh đã lưu trong hồ sơ trước khi đóng sự cố này.</p>}</div>}
          <ReviewHistory item={item} />
          {item.financeOnly ? <Link href="/dashboard/education/finance?tab=debts" className="inline-flex text-sm font-semibold text-primary hover:underline">Xử lý tại Tài chính → Công nợ</Link>
            : item.status === 'OPEN' && (selectedId === item.id ? <div className="space-y-3">
              <label className="block text-sm font-semibold" htmlFor={`note-${item.id}`}>Ghi chú xử lý <span className="text-muted-foreground">(bắt buộc)</span></label>
              <textarea id={`note-${item.id}`} value={drafts[item.id] ?? ''} maxLength={4000} disabled={saving} rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onChange={event => setDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} />
              <div className="flex flex-wrap gap-2">
                {item.view === 'absences' ? <><Button disabled={saving || requiresReload} onClick={() => submit(item, 'approve')}>Duyệt nghỉ học</Button>
                  <Button variant="destructive" disabled={saving || requiresReload} onClick={() => submit(item, 'decline')}>Từ chối đơn</Button></>
                  : <Button disabled={saving || requiresReload || blocked} onClick={() => submit(item, item.view === 'health' ? 'close' : 'resolve')}>{item.view === 'health' ? 'Lưu và đóng sự cố' : 'Lưu kết quả xử lý'}</Button>}
                <Button variant="outline" disabled={saving} onClick={() => { setSelectedId(null); if (!requiresReload) setSaveError(''); }}>Thu gọn</Button>
                {saving && <span role="status" className="self-center text-sm text-muted-foreground">Đang lưu…</span>}
              </div></div> : <Button variant="outline" disabled={saving || blocked} onClick={() => { setSelectedId(item.id); if (!requiresReload) setSaveError(''); }}>{item.view === 'absences' ? 'Xem và duyệt đơn' : 'Ghi nhận xử lý'}</Button>)}
        </article>;
      })}</div>}
      {data && !loading && !error && <div className="flex items-center justify-between gap-4 border-t border-border p-5 text-sm">
        <span className="text-muted-foreground">Hiển thị {data.items.length}/{data.total} hồ sơ phù hợp</span><div className="flex gap-2">
          <Button variant="outline" disabled={saving || data.page <= 1} onClick={() => setPage(data.page - 1)}>Trang trước</Button>
          <Button variant="outline" disabled={saving || data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Trang sau</Button></div></div>}
    </section>
  </div>;
}
export default function PreschoolWorkQueuePage() {
  return <Suspense fallback={<p role="status" className="p-8">Đang tải hồ sơ…</p>}><WorkQueue /></Suspense>;
}
