'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  Play,
  Clock,
  Eye,
  X,
  AlertTriangle,
  Timer,
  ExternalLink
} from 'lucide-react';
import { getOutboxEvents, replayOutboxEvent } from '@/services/accounting-actions';
import { toast } from 'sonner';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type OutboxEventRow = Awaited<ReturnType<typeof getOutboxEvents>>[number];
type OutboxFilters = NonNullable<Parameters<typeof getOutboxEvents>[0]>;
type OutboxStatusFilter = 'ALL' | NonNullable<OutboxFilters['status']>;

const statuses: { value: OutboxStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'TẤT CẢ EVENTS' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'PROCESSING', label: 'PROCESSING' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'DEAD', label: 'DEAD' },
];

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'w-max min-w-[92rem] border-collapse whitespace-nowrap';
const stickyHeaderCellClassName =
  'bg-slate-50 dark:bg-[#11100F]';
const stickyBodyCellClassName =
  'bg-inherit';

export default function OutboxMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<OutboxEventRow[]>([]);
  const [activeTab, setActiveTab] = useState<OutboxStatusFilter>('ALL');

  // Payload viewer state
  const [viewingPayload, setViewingPayload] = useState<OutboxEventRow['payload'] | null>(null);

  const fetchOutbox = useCallback(async () => {
    setRefreshing(true);
    try {
      const filters: OutboxFilters = {};
      if (activeTab !== 'ALL') {
        filters.status = activeTab;
      }
      const data = await getOutboxEvents(filters);
      setEvents(data || []);
    } catch (err: unknown) {
      console.error('Error fetching outbox queue:', err);
      toast.error('Không thể tải danh sách hàng đợi Outbox.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchOutbox();
    });
  }, [fetchOutbox]);

  usePageRefresh(fetchOutbox);

  const handleReplay = async (outboxId: string, eventType: string) => {
    setRefreshing(true);
    try {
      const res = await replayOutboxEvent(outboxId);
      if (res.success) {
        toast.success(res.message || `Đã xử lý replay cho sự kiện "${eventType}" thành công!`);
        await fetchOutbox();
      } else {
        toast.error(`Không thể xếp lịch hạch toán lại cho sự kiện "${eventType}".`);
      }
    } catch (err: unknown) {
      console.error('Replay failed:', err);
      toast.error(getErrorMessage(err, 'Lỗi khi gửi yêu cầu hạch toán lại.'));
    } finally {
      setRefreshing(false);
    }
  };

  const summary = events.reduce(
    (acc, event) => {
      if (event.status === 'PENDING') acc.pending += 1;
      if (event.status === 'PROCESSING') acc.processing += 1;
      if (event.status === 'FAILED') acc.failed += 1;
      if (event.status === 'DEAD') acc.dead += 1;
      if (event.is_stale) acc.stale += 1;
      if (event.replay_state === 'ready') acc.replayable += 1;
      return acc;
    },
    { pending: 0, processing: 0, failed: 0, dead: 0, stale: 0, replayable: 0 }
  );

  return (
    <div className="space-y-8 relative">
      {/* Synchronization loader */}
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang đồng bộ queue...</span>
        </div>
      )}

      {/* ── FILTER TABS ── */}
      <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm dark:border-[#3E3A35]/30 dark:bg-[#1C1B19] sm:w-fit">
        {statuses.map((s) => (
          <button 
            key={s.value}
            onClick={() => setActiveTab(s.value)}
            className={`px-4 py-2.5 rounded-xl text-3xs font-black uppercase tracking-widest transition-all shrink-0 cursor-pointer ${
              activeTab === s.value 
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-[#EFE9E1]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── QUEUE LIST TABLE ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          { label: 'Đang chờ', value: summary.pending, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Đang xử lý', value: summary.processing, tone: 'bg-yellow-50 text-yellow-600' },
          { label: 'Tạm lỗi', value: summary.failed, tone: 'bg-amber-50 text-amber-600' },
          { label: 'Kẹt nặng', value: summary.dead, tone: 'bg-red-50 text-red-600' },
          { label: 'Bị treo', value: summary.stale, tone: 'bg-fuchsia-50 text-fuchsia-600' },
          { label: 'Replay được', value: summary.replayable, tone: 'bg-emerald-50 text-emerald-600' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-[#3E3A35]/50 dark:bg-[#1C1B19]"
          >
            <p className="text-4xs font-black uppercase tracking-widest text-slate-400 dark:text-[#CDBCAB]/60">{item.label}</p>
            <div className={`mt-2 inline-flex min-w-12 items-center justify-center rounded-xl px-3 py-1.5 text-sm font-black ${item.tone}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-3 mb-6 border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4 md:flex-row md:items-center md:justify-between">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-5.5 h-5.5 text-primary" />
            Bảng Giám sát Hàng đợi Hạch toán (Transactional Outbox Queue)
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
              Tổng cộng: <span className="text-slate-900 dark:text-[#EFE9E1] font-black">{events.length}</span> events
            </span>
            <button
              onClick={fetchOutbox}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-3xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-100 disabled:opacity-60 dark:border-[#3E3A35] dark:bg-[#11100F] dark:text-[#CDBCAB]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : events.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3 animate-pulse" />
            <p className="font-extrabold uppercase text-xs tracking-wider">Hàng đợi trống. Toàn bộ sự kiện đã hạch toán!</p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr className="text-left bg-slate-50/50 dark:bg-[#11100F]/40 border-b border-slate-100 dark:border-[#3E3A35]/30">
                  <th className={`${stickyHeaderCellClassName} px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest`}>Loại Sự kiện (Event)</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Chứng từ Gốc (Ref)</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Chẩn đoán</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Lần thử lại</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Lỗi chi tiết (Last Error)</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#3E3A35]/20">
                {events.map((ev) => {
                  const isDead = ev.status === 'DEAD';
                  const isFailed = ev.status === 'FAILED';
                  const canReplay = (isDead || isFailed) && ev.replay_state === 'ready';

                  const statusColors: Record<string, string> = {
                    'PENDING': 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100/50',
                    'PROCESSING': 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100/50',
                    'COMPLETED': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100/50',
                    'FAILED': 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100/50',
                    'DEAD': 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100/50 animate-pulse',
                  };

                  return (
                    <motion.tr 
                      key={ev.id} 
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.01)' }}
                      className="hover:bg-slate-50/20 dark:hover:bg-[#11100F]/10 transition-colors"
                    >
                      <td className={`${stickyBodyCellClassName} px-6 py-4`}>
                        <div className="max-w-[18rem]">
                          <p className="text-xs font-black text-slate-800 dark:text-[#EFE9E1] leading-snug">{ev.event_type}</p>
                          <span className="text-4xs font-mono text-slate-400 dark:text-[#CDBCAB]/40 mt-1 block">ID: {ev.id}</span>
                          {ev.journal_reference_type && (
                            <span className="mt-1 block text-4xs font-bold text-slate-400 dark:text-[#CDBCAB]/45">
                              Journal ref: {ev.journal_reference_type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-0.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-none rounded text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/70 uppercase tracking-widest w-fit">
                            {ev.reference_type}
                          </span>
                          <span className="text-4xs font-mono text-slate-400 dark:text-[#CDBCAB]/40 truncate block max-w-40">
                            {ev.reference_id}
                          </span>
                          {ev.origin_href && (
                            <Link
                              href={ev.origin_href}
                              className="inline-flex w-fit items-center gap-1 text-4xs font-black uppercase tracking-widest text-primary hover:text-primary-hover"
                            >
                              Mở nguồn
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-[16rem] flex-col gap-1.5">
                          <span className={`inline-flex w-fit items-center gap-1 rounded-lg px-2.5 py-1 text-4xs font-black uppercase tracking-widest ${
                            ev.error_category === 'none'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {ev.error_category !== 'none' && <AlertTriangle className="h-3 w-3" />}
                            {ev.error_category_label}
                          </span>
                          <span className={`inline-flex w-fit items-center gap-1 rounded-lg px-2.5 py-1 text-4xs font-black uppercase tracking-widest ${
                            ev.is_stale ? 'bg-fuchsia-50 text-fuchsia-600' : 'bg-slate-50 text-slate-400'
                          }`}>
                            <Timer className="h-3 w-3" />
                            {ev.age_minutes} phút {ev.is_stale ? 'treo' : 'tuổi'}
                          </span>
                          <span className="whitespace-normal text-4xs font-bold leading-snug text-slate-400 dark:text-[#CDBCAB]/45">
                            {ev.replay_reason}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-black text-slate-700 dark:text-[#CDBCAB]/90 font-mono">
                        {ev.retry_count} / {ev.max_retries}
                      </td>
                      <td className="px-6 py-4">
                        {ev.last_error ? (
                          <p className="line-clamp-3 w-[22rem] whitespace-normal break-words rounded-lg border border-red-100/30 bg-red-50/30 p-2.5 text-3xs font-extrabold leading-snug text-red-500 dark:border-none dark:bg-red-950/10">
                            {ev.last_error}
                          </p>
                        ) : (
                          <span className="text-3xs font-bold text-slate-300">—</span>
                        )}
                        {ev.next_retry_at && (isFailed || ev.status === 'PENDING') && (
                          <span className="mt-1 flex items-center gap-1 text-4xs font-bold text-slate-400 dark:text-[#CDBCAB]/45">
                            <Clock className="w-3 h-3 text-slate-300" />
                            Đến hạn: {new Date(ev.next_retry_at).toLocaleTimeString('vi-VN')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-4xs font-black uppercase tracking-wider border ${statusColors[ev.status]}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Payload */}
                          <button 
                            onClick={() => setViewingPayload(ev.payload)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#3E3A35] dark:hover:bg-[#3E3A35]/80 text-slate-700 dark:text-[#CDBCAB] px-3 py-1.5 rounded-xl text-3xs font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Payload
                          </button>

                          {/* Replay */}
                          {canReplay && (
                            <button 
                              onClick={() => handleReplay(ev.id, ev.event_type)}
                              className="inline-flex items-center gap-1 bg-primary hover:bg-primary-hover text-primary-foreground px-3.5 py-1.5 rounded-xl text-3xs font-black uppercase tracking-widest transition-all cursor-pointer border-none active:scale-95 shadow-sm shadow-primary/20 dark:shadow-none"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              Replay
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── VIEW JSON PAYLOAD DIALOG MODAL ── */}
      <AnimatePresence>
        {viewingPayload !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPayload(null)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35] shadow-2xl p-5 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-hidden relative z-10 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
                <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide">Chi tiết Event Payload</h4>
                <button 
                  onClick={() => setViewingPayload(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#11100F] text-slate-400 hover:text-slate-600 transition-colors border-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pretty JSON codebox */}
              <div className="bg-slate-900 dark:bg-[#11100F] p-4 sm:p-5 rounded-2xl border border-slate-950 dark:border-none overflow-auto max-h-[58vh]">
                <pre className="min-w-max font-mono text-2xs text-emerald-400 leading-normal">
                  {JSON.stringify(viewingPayload, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={() => setViewingPayload(null)}
                  className="w-full bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer border-none sm:w-auto"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
