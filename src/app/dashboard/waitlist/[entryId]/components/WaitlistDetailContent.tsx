'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Bell, Check, X, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { WaitlistStatusBadge } from '../../components/WaitlistStatusBadge';
import { WaitlistDetailCards } from './WaitlistDetailCards';
import { WaitlistPriorityBreakdown } from './WaitlistPriorityBreakdown';
import { WaitlistPositionTimeline } from './WaitlistPositionTimeline';
import { WaitlistNotificationHistory } from './WaitlistNotificationHistory';
import type { WaitlistEntry, WaitlistNotificationLog } from '@/types/waitlist';

interface WaitlistDetailContentProps {
  entryId: string;
}

export function WaitlistDetailContent({ entryId }: WaitlistDetailContentProps) {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const tenantId = user?.tenant_id || '';

  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [notifications, setNotifications] = useState<WaitlistNotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchEntry = useCallback(async () => {
    if (!entryId) return;
    if (!tenantId) {
      setError('Không tìm thấy thông tin chi nhánh');
      setIsLoading(false);
      return;
    }

    const loadingFlag = entry ? setIsSyncing : setIsLoading;
    loadingFlag(true);
    setError(null);

    try {
      const response = await fetch(`/api/waitlist/${entryId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Không tìm thấy thông tin khách hàng trong danh sách chờ');
        }
        throw new Error('Không thể tải thông tin');
      }

      const data = await response.json();
      setEntry(data.entry);

      // Fetch notification logs
      try {
        const notifResponse = await fetch(`/api/waitlist/${entryId}/notifications`);
        if (notifResponse.ok) {
          const notifData = await notifResponse.json();
          setNotifications(notifData.notifications || []);
        }
      } catch (notifErr) {
        console.error('Error fetching notifications:', notifErr);
        // Non-critical, keep notifications empty
        setNotifications([]);
      }
    } catch (err: unknown) {
      console.error('Error fetching waitlist entry:', err);
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [entryId, tenantId, entry]);

  useEffect(() => {
    if (isUserLoading) return;
    void fetchEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, tenantId, isUserLoading]);

  usePageRefresh(fetchEntry);

  // Actions
  const handleNotify = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'notified' }),
      });

      if (!response.ok) {
        throw new Error('Không thể gửi thông báo');
      }

      toast.success('Đã gửi thông báo đến khách hàng');
      await fetchEntry();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi gửi thông báo');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  const handleMarkReserved = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reserved' }),
      });

      if (!response.ok) {
        throw new Error('Không thể đánh dấu giữ chỗ');
      }

      toast.success('Đã đánh dấu giữ chỗ cho khách hàng');
      await fetchEntry();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi đánh dấu');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  const handleConvert = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entryId}/convert`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể chuyển đổi sang lịch hẹn');
      }

      toast.success('Đã chuyển đổi sang lịch hẹn thành công');
      await fetchEntry();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi chuyển đổi');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  const handleCancel = async () => {
    const reason = prompt('Lý do hủy (tùy chọn):');

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/waitlist/${entryId}?reason=${encodeURIComponent(reason || 'Không ghi rõ')}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể hủy');
      }

      toast.success('Đã xóa khỏi danh sách chờ');
      router.push('/dashboard/waitlist');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi hủy');
    } finally {
      setIsProcessing(false);
      setIsActionsOpen(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
            Đang tải thông tin...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !entry) {
    return (
      <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
        <div className="rounded-[2rem] border border-red-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="mb-2 text-lg font-bold text-red-900">Không thể tải thông tin</p>
          <p className="mb-4 text-sm text-red-600">{error || 'Không tìm thấy thông tin'}</p>
          <button
            onClick={() => router.push('/dashboard/waitlist')}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 relative">
      {/* Loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/waitlist')}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách chờ
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Vị trí #{entry.position || '?'}
          </h1>
          <WaitlistStatusBadge status={entry.status} size="md" />
        </div>

        {/* Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsActionsOpen(!isActionsOpen)}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <MoreVertical className="h-4 w-4" />
            Thao tác
          </button>

          {isActionsOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsActionsOpen(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {entry.status === 'active' && (
                  <button
                    onClick={handleNotify}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4" />
                    Gửi thông báo
                  </button>
                )}

                {entry.status === 'notified' && (
                  <button
                    onClick={handleMarkReserved}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Edit className="h-4 w-4" />
                    Đánh dấu giữ chỗ
                  </button>
                )}

                {(entry.status === 'active' || entry.status === 'notified' || entry.status === 'reserved') && (
                  <button
                    onClick={handleConvert}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Chuyển sang lịch hẹn
                  </button>
                )}

                {entry.status !== 'cancelled' && entry.status !== 'converted' && (
                  <button
                    onClick={handleCancel}
                    disabled={isProcessing}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Hủy
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Customer & Service Cards */}
        <WaitlistDetailCards entry={entry} />

        {/* Priority Breakdown */}
        <WaitlistPriorityBreakdown entry={entry} />

        {/* Position Timeline */}
        <WaitlistPositionTimeline entry={entry} />

        {/* Notification History */}
        <WaitlistNotificationHistory notifications={notifications} />
      </div>
    </div>
  );
}
