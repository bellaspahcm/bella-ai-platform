'use client';

import { createClient } from '@/lib/supabase-client';
import { resolvePackageName } from '@bella/shared';
import { cn } from '@/lib/utils';
import { 
  completeSession, 
  getSessionsWithDetails, 
  reusePackage, 
  syncBookingProgress 
} from '@/core/services/order';
import { getPendingLeaveRequests } from '@/services/attendance-actions';
import { useUser } from '@/lib/user-context';
import { useProgressiveLoad } from '@/hooks/useProgressiveLoad';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  AlertCircle, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Download, 
  Filter, 
  Flower2, 
  Grid, 
  List, 
  Loader2, 
  Plus, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  UserCircle, 
  Users 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import { LeaveRequest, SessionBooking } from './types';
import dynamic from 'next/dynamic';
import { SessionCard } from './components/SessionCard';

const LeaveApprovalModal = dynamic(
  () => import('./components/LeaveApprovalModal').then(m => m.LeaveApprovalModal),
  { ssr: false }
);

const SessionLogsDetailsModal = dynamic(
  () => import('./components/SessionLogsDetailsModal').then(m => m.SessionLogsDetailsModal),
  { ssr: false }
);

const BookingModal = dynamic(
  () => import('@/components/features/BookingModal').then(m => m.BookingModal),
  { ssr: false }
);

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function SessionsContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBookingId = searchParams.get('bookingId') || '';
  const initialSearch = searchParams.get('search') || '';

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'attention'>('all');
  
  const [sessions, setSessions] = useState<SessionBooking[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SessionBooking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isReusingId, setIsReusingId] = useState<string | null>(null);

  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const vocab = useModuleVocabulary(tenantModuleKey);

  // Admin Leave Approval States
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [isLeavesOpen, setIsLeavesOpen] = useState(false);

  const loadPendingLeaves = useCallback(async () => {
    try {
      const leaves = await getPendingLeaveRequests() as LeaveRequest[];
      setPendingLeaves(leaves);
    } catch (err: unknown) {
      console.error("Failed to load pending leaves:", err);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await getSessionsWithDetails() as SessionBooking[];
      setSessions(data || []);
      
      // Auto-open modal if bookingId parameter is provided
      if (initialBookingId && data?.length) {
        const target = data.find(b => b.id === initialBookingId);
        if (target) {
          setSelectedBooking(target);
        }
      }
      return data;
    } catch (error: unknown) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      toast.error('Không thể tải danh sách thẻ liệu trình: ' + getErrorMessage(error));
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, [initialBookingId]);

  const { criticalReady } = useProgressiveLoad({
    critical: async () => {
      await loadSessions();
    },
    secondary: async () => {
      if (user?.role?.toLowerCase() === 'admin') {
        await loadPendingLeaves();
      }
    },
    deps: [loadSessions, loadPendingLeaves, user],
  });

  const handleSoftRefresh = useCallback(async () => {
    await Promise.all([
      loadSessions(),
      refreshTenantModuleKey(),
      user?.role?.toLowerCase() === 'admin' ? loadPendingLeaves() : Promise.resolve(),
    ]);
  }, [loadPendingLeaves, loadSessions, refreshTenantModuleKey, user]);

  usePageRefresh(handleSoftRefresh);

  const handleCloseModal = () => {
    setSelectedBooking(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('bookingId');
    const newPath = params.toString() ? `/dashboard/sessions?${params.toString()}` : '/dashboard/sessions';
    router.replace(newPath, { scroll: false });
  };

  // Quick progress update handler for SessionCard
  const handleUpdateProgress = async (bookingId: string, quickNote: string) => {
    if (updatingId) return;
    setUpdatingId(bookingId);
    
    try {
      const targetBooking = sessions.find(s => s.id === bookingId);
      if (!targetBooking) return;

      const logs = targetBooking.session_logs || [];
      const nextSession = logs.find(l => l.status === 'scheduled');

      if (!nextSession) {
        toast.error('Không tìm thấy buổi hẹn tiếp theo để cập nhật!');
        return;
      }

      await completeSession(nextSession.id, bookingId, quickNote || undefined);
      toast.success(`Đã cập nhật thành công buổi ${(targetBooking.completed_sessions || 0) + 1}!`);
      await loadSessions();
    } catch (err: unknown) {
      console.error('Failed to update progress:', err);
      toast.error('Lỗi cập nhật buổi: ' + getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  // Quick package reuse handler for SessionCard
  const handleReusePackage = async (bookingId: string, customerName: string) => {
    if (isReusingId) return;
    const confirm = window.confirm(`Bạn có chắc chắn muốn tái sử dụng / gia hạn gói dịch vụ cho ${customerName}?`);
    if (!confirm) return;

    setIsReusingId(bookingId);
    try {
      const result = await reusePackage(bookingId);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Đã tái sử dụng gói cho ${customerName} thành công!`);
        await loadSessions();
      }
    } catch (err: unknown) {
      console.error('Failed to reuse package:', err);
      toast.error('Lỗi tái sử dụng gói');
    } finally {
      setIsReusingId(null);
    }
  };

  // Filtered Sessions calculation
  const filteredSessions = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    return sessions.filter((booking) => {
      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const motherName = booking.customers?.name_mother?.toLowerCase() || '';
        const babyName = booking.customers?.name_baby?.toLowerCase() || '';
        const phone = booking.customers?.phone?.toLowerCase() || '';
        const pkgName = (booking.package_name || '').toLowerCase();
        const bookingNum = (booking.booking_number || '').toLowerCase();
        const ktvName = (booking.assigned_ktv_name || '').toLowerCase();

        const match = motherName.includes(q) || babyName.includes(q) || phone.includes(q) || pkgName.includes(q) || bookingNum.includes(q) || ktvName.includes(q);
        if (!match) return false;
      }

      // Status Filter
      const completedCount = Number(booking.completed_sessions) || 0;
      const totalCount = Number(booking.total_sessions) || 15;
      const isCompleted = completedCount >= totalCount;
      const hasNoKtv = !booking.assigned_ktv_id && !isCompleted;
      const isOverdue = !isCompleted && booking.status !== 'cancelled' && !!booking.next_session_date && booking.next_session_date < today;

      if (statusFilter === 'in_progress') {
        return !isCompleted && booking.status !== 'cancelled';
      }
      if (statusFilter === 'completed') {
        return isCompleted;
      }
      if (statusFilter === 'attention') {
        return hasNoKtv || isOverdue;
      }

      return true;
    });
  }, [searchQuery, sessions, statusFilter]);

  // Statistics counters
  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    let total = sessions.length;
    let inProgress = 0;
    let completed = 0;
    let attention = 0;

    sessions.forEach(b => {
      const done = (Number(b.completed_sessions) || 0) >= (Number(b.total_sessions) || 15);
      if (done) {
        completed++;
      } else if (b.status !== 'cancelled') {
        inProgress++;
      }

      const noKtv = !b.assigned_ktv_id && !done;
      const overdue = !done && b.status !== 'cancelled' && !!b.next_session_date && b.next_session_date < today;
      if (noKtv || overdue) {
        attention++;
      }
    });

    return { total, inProgress, completed, attention };
  }, [sessions]);

  const userRole = user?.role?.toLowerCase() === 'admin' ? 'admin' : 'KTV';

  return (
    <div className="flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 md:p-8 relative">
      {/* Sync indicator */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Thẻ liệu trình</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Quản lý thẻ liệu trình, tiến độ làm và nhật ký điều trị từng khách hàng
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'cards'
                  ? "bg-white text-slate-900 shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Grid className="w-3.5 h-3.5 text-primary" />
              <span>Dạng Thẻ Premium</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'table'
                  ? "bg-white text-slate-900 shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List className="w-3.5 h-3.5 text-primary" />
              <span>Dạng Bảng</span>
            </button>
          </div>

          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs hover:bg-primary-hover transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thẻ liệu trình mới</span>
          </button>
        </div>
      </div>

      {/* ── Summary KPI Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter('all')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl bg-white border shadow-sm cursor-pointer transition-all hover:scale-[1.02]",
            statusFilter === 'all' ? "border-primary ring-2 ring-primary/10" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest">Tổng số thẻ</span>
            <Flower2 className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Toàn bộ hồ sơ liệu trình</p>
        </div>

        <div 
          onClick={() => setStatusFilter('in_progress')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl bg-white border shadow-sm cursor-pointer transition-all hover:scale-[1.02]",
            statusFilter === 'in_progress' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang thực hiện</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.inProgress}</p>
          <p className="text-[10px] font-bold text-emerald-700/70 mt-1">Đang đi liệu trình</p>
        </div>

        <div 
          onClick={() => setStatusFilter('completed')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl bg-white border shadow-sm cursor-pointer transition-all hover:scale-[1.02]",
            statusFilter === 'completed' ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đã hoàn thành</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600">{stats.completed}</p>
          <p className="text-[10px] font-bold text-blue-700/70 mt-1">Đã xong đủ số buổi</p>
        </div>

        <div 
          onClick={() => setStatusFilter('attention')}
          className={cn(
            "p-4 sm:p-5 rounded-2xl bg-white border shadow-sm cursor-pointer transition-all hover:scale-[1.02]",
            statusFilter === 'attention' ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cần chú ý</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{stats.attention}</p>
          <p className="text-[10px] font-bold text-amber-700/70 mt-1">Chưa phân KTV hoặc trễ lịch</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, SĐT, tên thẻ liệu trình, mã thẻ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[11px] font-black transition-all",
              statusFilter === 'all'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Tất cả ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[11px] font-black transition-all",
              statusFilter === 'in_progress'
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            Đang làm ({stats.inProgress})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[11px] font-black transition-all",
              statusFilter === 'completed'
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            )}
          >
            Hoàn thành ({stats.completed})
          </button>
          <button
            onClick={() => setStatusFilter('attention')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[11px] font-black transition-all",
              statusFilter === 'attention'
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            )}
          >
            Cần chú ý ({stats.attention})
          </button>
        </div>
      </div>

      {/* ── Active View Rendering ── */}
      {!criticalReady ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm my-8">
          <Flower2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Không tìm thấy thẻ liệu trình phù hợp</h3>
          <p className="text-xs font-bold text-slate-500 mt-1 max-w-md mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác để xem thêm thẻ liệu trình của khách hàng.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Premium Card Grid View */
        <div className="space-y-4">
          {filteredSessions.map((booking, idx) => (
            <SessionCard
              key={booking.id}
              booking={booking}
              idx={idx}
              userRole={userRole}
              tenantModuleKey={tenantModuleKey}
              updatingId={updatingId}
              isReusingId={isReusingId}
              onSelect={() => setSelectedBooking(booking)}
              onUpdateProgress={handleUpdateProgress}
              onReusePackage={handleReusePackage}
            />
          ))}
        </div>
      ) : (
        /* Sleek Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">Khách hàng</th>
                  <th className="p-4">Thẻ liệu trình</th>
                  <th className="p-4">Tiến độ</th>
                  <th className="p-4">KTV Phụ trách</th>
                  <th className="p-4">Buổi hẹn tiếp theo</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 pr-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {filteredSessions.map((booking) => {
                  const completedCount = Number(booking.completed_sessions) || 0;
                  const totalCount = Number(booking.total_sessions) || 15;
                  const isCompleted = completedCount >= totalCount;
                  const progress = (completedCount / Math.max(1, totalCount)) * 100;
                  const hasKtv = !!booking.assigned_ktv_id;

                  return (
                    <tr 
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                            {booking.customers?.name_mother?.[0] || 'K'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{booking.customers?.name_mother || 'Khách hàng'}</p>
                            <p className="text-[10px] font-bold text-slate-400">{booking.customers?.phone || '---'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-black text-slate-900">{resolvePackageName(booking)}</p>
                        <p className="text-[10px] font-bold text-slate-400">{booking.booking_number}</p>
                      </td>

                      <td className="p-4 min-w-[160px]">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-900 mb-1">
                          <span>{completedCount}/{totalCount} buổi</span>
                          <span className="text-[10px] text-slate-400">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all", isCompleted ? "bg-emerald-500" : "bg-emerald-600")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          hasKtv ? "bg-slate-100 text-slate-800" : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}>
                          {booking.assigned_ktv_name || 'Chưa phân công'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600">
                        {booking.next_session_date || '---'}
                      </td>

                      <td className="p-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          booking.status === 'cancelled'
                            ? "bg-rose-50 text-rose-600 border-rose-100"
                            : isCompleted
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {booking.status === 'cancelled' ? 'Đã hủy' : isCompleted ? 'Hoàn thành' : 'Đang làm'}
                        </span>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-wider hover:bg-primary-hover transition-all"
                          >
                            Chi tiết
                          </button>
                          {booking.customers?.id && (
                            <Link
                              href={`/dashboard/customers/${booking.customers.id}?bookingId=${booking.id}`}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider transition-all"
                            >
                              Hồ sơ
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <SessionLogsDetailsModal
        isOpen={!!selectedBooking}
        activeBooking={selectedBooking}
        onClose={handleCloseModal}
        onSuccess={loadSessions}
        userRole={userRole}
        tenantModuleKey={tenantModuleKey}
      />

      {/* Leave Approval Panel */}
      <LeaveApprovalModal
        isOpen={isLeavesOpen}
        onClose={() => {
          setIsLeavesOpen(false);
          loadPendingLeaves();
        }}
        onSuccess={loadSessions}
        userRole={userRole}
      />

      {/* Booking / Package Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={loadSessions}
      />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 p-10 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
