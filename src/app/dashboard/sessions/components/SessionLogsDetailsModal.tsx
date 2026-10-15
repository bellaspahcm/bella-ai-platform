'use client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { createClient } from '@/lib/supabase-client';
import { cn, formatViDate } from '@/lib/utils';
import { reusePackage,syncBookingProgress } from '@/core/services/order';
import {
addExtraSession,
getSessionLogs,
rescheduleSession,
updateSessionLog
} from '@/core/services/order';
import { motion } from 'framer-motion';
import {
AlertCircle,
Calendar,
CheckCircle2,
Clock,
FileEdit,
Flower2,
History,
Loader2,
PlusCircle,
RotateCcw,
Save,
ShieldCheck,
Star,
TrendingUp,
UserCircle,
X,
XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { toast } from 'sonner';
import { SessionBooking,SessionLog } from '../types';
import { KtvSuggestionPanel } from './KtvSuggestionPanel';

function getErrorMessage(error: unknown, fallback = 'Khong ro nguyen nhan') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

interface SessionLogsDetailsModalProps {
  isOpen: boolean;
  activeBooking: SessionBooking | null;
  onClose: () => void;
  onSuccess?: () => void; // Callback to refresh main sessions list
  userRole: 'KTV' | 'admin' | '';
  tenantModuleKey: TenantModuleKey | null;
}

export function SessionLogsDetailsModal({ 
  isOpen, 
  activeBooking, 
  onClose, 
  onSuccess,
  userRole,
  tenantModuleKey,
}: SessionLogsDetailsModalProps) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  const workUnitLabel = vocab.workUnit.singular.toLowerCase();
  const [selectedSessionLog, setSelectedSessionLog] = useState<SessionLog | null>(null);
  const [currentNote, setCurrentNote] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [originalDateString, setOriginalDateString] = useState<string | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isReusingId, setIsReusingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const formatGps = (lat: number | null, lon: number | null) => {
    if (lat === null || lon === null) return null;
    return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  };

  const calendarCells = useMemo(() => {
    if (!sessionLogs || sessionLogs.length === 0) return [];
    
    // Fallback: If a log is missing assigned_date, just render consecutively
    const hasMissingDates = sessionLogs.some(log => !log.assigned_date);
    if (hasMissingDates) return sessionLogs;

    const cells: (SessionLog | { isGap: boolean; dateString: string })[] = [];
    
    // Sort logs by date to ensure proper calendar chronological progression
    const sortedLogs = [...sessionLogs].sort((a, b) => {
      return new Date(a.assigned_date!).getTime() - new Date(b.assigned_date!).getTime();
    });

    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];

    const start = new Date(firstLog.assigned_date!);
    start.setHours(0, 0, 0, 0);
    const end = new Date(lastLog.assigned_date!);
    end.setHours(0, 0, 0, 0);

    // Map by YYYY-MM-DD for O(1) day check
    const logMap = new Map<string, SessionLog>();
    sortedLogs.forEach(log => {
      logMap.set(log.assigned_date!, log);
    });

    const current = new Date(start);
    let safetyCounter = 0;
    while (current <= end && safetyCounter < 365) {
      safetyCounter++;
      const dateStr = current.toLocaleDateString('sv-SE');
      const log = logMap.get(dateStr);
      if (log) {
        cells.push(log);
      } else {
        cells.push({ isGap: true, dateString: dateStr });
      }
      current.setDate(current.getDate() + 1);
    }

    // Safe fallback to avoid browser crash on database typos (e.g. year 2099)
    if (safetyCounter >= 365) {
      return sessionLogs;
    }

    return cells;
  }, [sessionLogs]);

  const fetchSessionLogs = useCallback(async (bookingId: string) => {
    setIsLoadingLogs(true);
    try {
      // Auto-sync progress count whenever modal opens
      syncBookingProgress(bookingId).then(res => {
        if (res?.synced && onSuccess) {
          onSuccess(); // Reload list to reflect synced count
        }
      });

      const logs = await getSessionLogs(bookingId) as SessionLog[];
      setSessionLogs(logs);
      
      // Select the first scheduled session or the last completed one by default
      const nextScheduled = logs.find((log) => log.status === 'scheduled');
      if (nextScheduled) {
        setSelectedSessionLog(nextScheduled);
        setCurrentNote(nextScheduled.notes || '');
      } else if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        setSelectedSessionLog(lastLog);
        setCurrentNote(lastLog.notes || '');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error(`Không thể tải lịch trình ${getModuleVocabulary(tenantModuleKey).workUnit.singular.toLowerCase()}`);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [onSuccess, tenantModuleKey, setCurrentNote, setSelectedSessionLog]);

  const activeBookingId = activeBooking?.id;

  useEffect(() => {
    if (!isOpen || !activeBookingId) {
      setSelectedSessionLog(null);
      setSessionLogs([]);
      setCurrentNote('');
      setSelectedDate('');
      setSelectedTime('');
      setSelectedStatus('');
      setOriginalDateString(null);
      return;
    }

    fetchSessionLogs(activeBookingId);

    // Real-time subscription optimized for this booking's logs with debouncing to prevent event storms during bulk updates
    const supabase = createClient();
    let debounceTimer: NodeJS.Timeout;

    const channel = supabase
      .channel(`modal-realtime-${activeBookingId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'session_logs',
        filter: `booking_id=eq.${activeBookingId}`
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchSessionLogs(activeBookingId);
        }, 300);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [isOpen, activeBookingId, fetchSessionLogs]);

  useEffect(() => {
    if (selectedSessionLog) {
      setCurrentNote(selectedSessionLog.notes || '');
      // DEFAULT TO TODAY IF NO ASSIGNED DATE (Using local time)
      const todayLocal = new Date().toLocaleDateString('sv-SE');
      setSelectedDate(selectedSessionLog.assigned_date || todayLocal);
      setSelectedTime(selectedSessionLog.assigned_time || '');
      setSelectedStatus(selectedSessionLog.status || 'scheduled');
      setOriginalDateString(selectedSessionLog.assigned_date || todayLocal);
    }
  }, [selectedSessionLog]);

  const handleSaveFullUpdate = async (forcedStatus?: string) => {
    if (isSavingNote) return;
    if (!selectedSessionLog || !activeBooking) return;
    
    const finalStatus = (forcedStatus || selectedStatus) as 'scheduled' | 'completed' | 'cancelled' | 'in_progress';
    
    if (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status)) {
      toast.error(`${vocab.workUnit.singular} này đã hoàn thành hoặc bị hủy. Chỉ Quản trị viên mới có quyền điều chỉnh lịch sử!`);
      return;
    }

    setIsSavingNote(true);
    try {
      // Detect date change for rescheduling
      const dateChanged = selectedDate && originalDateString && selectedDate !== originalDateString;
      
      if (dateChanged && finalStatus === 'scheduled') {
        const rescheduleResult = await rescheduleSession(selectedSessionLog.id, selectedDate);
        if (rescheduleResult.error) {
          toast.error('Lỗi dời lịch: ' + rescheduleResult.error);
          setIsSavingNote(false);
          return;
        }
        toast.success('Đã tự động dời lịch các buổi tiếp theo!');
      }

      const updates = {
        notes: currentNote || null,
        assigned_date: selectedDate || null,
        assigned_time: selectedTime || null,
        status: finalStatus,
        completed_date: finalStatus === 'completed' ? (selectedSessionLog.completed_date || new Date().toISOString()) : null
      };

      const result = await updateSessionLog(selectedSessionLog.id, updates);
      
      if (result.data) {
        toast.success(`Đã cập nhật trạng thái ${workUnitLabel} thành công!`);
        if (onSuccess) {
          onSuccess();
        }
        await fetchSessionLogs(activeBooking.id);
      } else if (result.error) {
        toast.error('Lỗi lưu thay đổi: ' + result.error);
      }
    } catch (error: unknown) {
      console.error('Update failed:', error);
      toast.error('Lỗi hệ thống: ' + getErrorMessage(error, 'Không rõ nguyên nhân'));
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: 'scheduled' | 'cancelled') => {
    if (isSavingNote) return;
    if (!selectedSessionLog || !activeBooking) return;
    if (userRole !== 'admin') return;

    setIsSavingNote(true);
    try {
      const updates = {
        status: newStatus,
        completed_date: null, // always clear completed_date when restoring/cancelling
      };

      const result = await updateSessionLog(selectedSessionLog.id, updates);

      if (result.data) {
        toast.success(newStatus === 'scheduled' ? `Đã khôi phục ${workUnitLabel} thành công!` : `Đã hủy ${workUnitLabel} thành công!`);
        if (onSuccess) {
          onSuccess();
        }
        await fetchSessionLogs(activeBooking.id);
      } else if (result.error) {
        toast.error('Lỗi: ' + result.error);
      }
    } catch (error: unknown) {
      console.error('Status change failed:', error);
      toast.error('Lỗi: ' + getErrorMessage(error, 'Không rõ'));
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleReusePackage = async (bookingId: string, customerName: string) => {
    if (!bookingId || isReusingId) return;

    const confirm = window.confirm(`Bạn có chắc chắn muốn tái sử dụng gói dịch vụ nhanh cho khách hàng ${customerName}?`);
    if (!confirm) return;
    
    setIsReusingId(bookingId);
    try {
      const result = await reusePackage(bookingId);
      if ('error' in result && result.error) {
        toast.error('Lỗi: ' + result.error);
      } else if ('data' in result && result.data) {
        toast.success(`Đã tái sử dụng gói cho ${customerName} thành công!`);
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (error) {
      console.error('Reuse failed:', error);
      toast.error('Có lỗi xảy ra khi xử lý');
    } finally {
      setIsReusingId(null);
    }
  };

  const handleAddExtraSession = async (bookingId: string) => {
    if (isSyncing) return;
    if (!window.confirm(`Bạn có muốn thêm một ${workUnitLabel} bổ sung vào gói này không?`)) return;
    
    setIsSyncing(true);
    try {
      const result = await addExtraSession(bookingId);
      if (result.success) {
        toast.success(`Đã thêm ${workUnitLabel} bổ sung thành công!`);
        if (onSuccess) {
          onSuccess();
        }
        await fetchSessionLogs(bookingId);
      } else {
        toast.error('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Add extra session failed:', error);
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen || !activeBooking) return null;

  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const customerHeaderLabel = `${customerLabels.customerPrefix}: ${activeBooking.customers?.name_mother || 'Khách hàng'}${activeBooking.customers?.name_baby ? ` - ${customerLabels.secondaryPrefix}: ${activeBooking.customers.name_baby}` : ''}`;
  const sessionHeaderTitle = vocab.booking.singular;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white"
      >
        {/* Modal Header */}
        <div className="p-5 md:p-8 md:pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-4 md:gap-5 min-w-0">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
              <Flower2 className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight break-words">
                {sessionHeaderTitle}: {customerHeaderLabel}
              </h2>
              <p className="mt-2 md:mt-0 text-slate-500 font-bold uppercase text-[9px] md:text-[10px] tracking-[0.16em] md:tracking-[0.2em] flex flex-wrap items-center gap-x-2 gap-y-1 md:gap-3">
                <span className="text-primary">{activeBooking.package_name}</span>
                <span className="text-slate-300">•</span>
                <span>{vocab.worker.short}: {activeBooking.assigned_ktv_name}</span>
                <span className="text-slate-300">•</span>
                <span>Tiến độ: {activeBooking.completed_sessions || 0}/{activeBooking.total_sessions || 15}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl border font-black text-[9px] md:text-[10px] uppercase tracking-widest",
              userRole === 'admin' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
            )}>
              {userRole === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <UserCircle className="w-3 h-3" />}
              Quyền: {userRole}
            </div>
            <Link
              href={`/dashboard/customers/${activeBooking.customers?.id}?bookingId=${activeBooking.id}`}
              className="px-3 md:px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary-hover shadow-lg shadow-primary/20 dark:shadow-none active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <UserCircle className="w-3.5 h-3.5" /> Hồ sơ
            </Link>
            <button 
              onClick={onClose}
              className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shrink-0"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Left: Info & Notes */}
            <div className="order-2 lg:order-1 lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-primary" /> 
                  {selectedSessionLog ? `Cập nhật buổi ${selectedSessionLog.session_number}/${activeBooking.total_sessions || 21}` : 'Hành trình chăm sóc'}
                </h3>
                
                <div className="space-y-4">
                  {!selectedSessionLog ? (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                      <div className="flex flex-col items-center text-center py-4">
                        <History className="w-10 h-10 text-amber-400 mb-4 opacity-50" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Thông tin buổi trước</h4>
                        {(() => {
                          const completedLogs = (sessionLogs || [])
                            .filter((l) => l.status === 'completed')
                            .sort((a, b2) => (b2.session_number || 0) - (a.session_number || 0));
                          const lastLog = completedLogs[0];
                          if (lastLog) {
                            return (
                              <>
                                <p className="text-[10px] font-bold text-slate-500 italic mb-4">&quot;{lastLog.notes || 'Không có ghi chú'}&quot;</p>
                                <div className={cn(
                                  "bg-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest text-primary shadow-sm border",
                                  tenantModuleKey === 'beauty_spa' ? "border-emerald-100" : "border-pink-50"
                                )}>
                                  Đã làm buổi {lastLog.session_number} vào {lastLog.completed_date || lastLog.assigned_date || 'N/A'}
                                </div>
                              </>
                            );
                          }
                          return <p className="text-[10px] font-bold text-slate-400 italic">Chưa có lịch sử chăm sóc</p>;
                        })()}
                        <p className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Chọn một buổi trong lịch trình để cập nhật tiếp</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Ngày dự kiến
                          </label>
                          <div className="relative flex items-center rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-primary/20">
                            <input 
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              disabled={!selectedSessionLog || (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status))}
                              className="w-full py-3 px-4 bg-transparent border-none outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Giờ hẹn
                          </label>
                          <div className="relative flex items-center rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-primary/20">
                            <input 
                              type="time"
                              value={selectedTime}
                              onChange={(e) => setSelectedTime(e.target.value)}
                              disabled={!selectedSessionLog || (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status))}
                              className="w-full py-3 px-4 bg-transparent border-none outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Trạng thái</label>
                        <PremiumSelect
                          value={selectedStatus}
                          options={[
                            { value: 'scheduled', label: 'Đã lên lịch', icon: <Clock className="w-4 h-4" /> },
                            { value: 'completed', label: 'Đã hoàn thành', icon: <CheckCircle2 className="w-4 h-4" /> },
                            { value: 'cancelled', label: 'Đã hủy', icon: <X className="w-4 h-4" /> }
                          ]}
                          onChange={(value) => setSelectedStatus(value)}
                          disabled={!selectedSessionLog || (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status))}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nội dung & Tiến độ {workUnitLabel}</label>
                        <textarea 
                          placeholder="Hôm nay khách hàng thế nào? Các bước kỹ thuật đã thực hiện, lưu ý cho buổi sau..."
                          value={currentNote}
                          onChange={(e) => setCurrentNote(e.target.value)}
                          disabled={!selectedSessionLog || (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status))}
                          className="w-full h-32 p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 placeholder:text-slate-300 resize-none transition-all disabled:opacity-50 text-xs shadow-inner"
                        />
                      </div>
                      
                      {selectedSessionLog.status === 'completed' && (
                        <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-5 rounded-2xl border border-emerald-100/60 shadow-sm space-y-4 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100/70 flex items-center justify-center text-emerald-600 shadow-sm">
                              <UserCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.15em] leading-none mb-1">Kỹ thuật viên thực hiện</p>
                              <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                {selectedSessionLog.ktv?.full_name || 'KTV hệ thống'}
                                {selectedSessionLog.completed_by_ktv_id && selectedSessionLog.completed_by_ktv_id !== activeBooking.assigned_ktv_id && (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 leading-none">
                                    🔄 Làm thay
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          <div className="border-t border-emerald-100/50 pt-3.5 grid grid-cols-2 gap-4">
                            <div className="bg-white/60 p-2.5 rounded-xl border border-emerald-100/40">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Giờ Check-in thực tế
                              </p>
                              <p className="text-xs font-black text-slate-700">
                                {selectedSessionLog.start_time ? (
                                  (() => {
                                    const d = new Date(selectedSessionLog.start_time);
                                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                  })()
                                ) : 'Không ghi nhận (admin cập nhật)'}
                              </p>
                            </div>
                            <div className="bg-white/60 p-2.5 rounded-xl border border-emerald-100/40">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Giờ Check-out thực tế
                              </p>
                              <p className="text-xs font-black text-slate-700">
                                {selectedSessionLog.end_time ? (
                                  (() => {
                                    const d = new Date(selectedSessionLog.end_time);
                                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                  })()
                                ) : 'Không ghi nhận (admin cập nhật)'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {([
                              {
                                label: 'GPS Check-in',
                                lat: selectedSessionLog.checkin_lat,
                                lon: selectedSessionLog.checkin_lon,
                                tone: 'emerald'
                              },
                              {
                                label: 'GPS Check-out',
                                lat: selectedSessionLog.checkout_lat,
                                lon: selectedSessionLog.checkout_lon,
                                tone: 'rose'
                              }
                            ] as const).map((gps) => {
                              const coords = formatGps(gps.lat, gps.lon);
                              return (
                                <div key={gps.label} className="bg-white/60 p-2.5 rounded-xl border border-emerald-100/40 min-w-0">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      gps.tone === 'emerald' ? "bg-emerald-500" : "bg-rose-500"
                                    )}></span>
                                    {gps.label}
                                  </p>
                                  {coords ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${gps.lat},${gps.lon}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-[10px] font-mono font-black text-slate-700 truncate hover:text-primary transition-colors"
                                      title={coords}
                                    >
                                      {coords}
                                    </a>
                                  ) : (
                                    <p className="text-[10px] font-black text-slate-400">Không có GPS</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {selectedSessionLog.start_time && selectedSessionLog.end_time && (
                            <div className="space-y-3">
                              <div className="bg-emerald-500/10 rounded-xl px-4 py-3 flex items-center justify-between border border-emerald-500/10 shadow-inner">
                                <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Thời lượng thực tế:</span>
                                <span className="text-xs font-black text-emerald-800 bg-white/80 px-2 py-0.5 rounded-md shadow-sm border border-emerald-100">
                                  {(() => {
                                    const diff = new Date(selectedSessionLog.end_time!).getTime() - new Date(selectedSessionLog.start_time!).getTime();
                                    const minutes = Math.max(1, Math.floor(diff / 60000));
                                    return `${minutes} phút`;
                                  })()}
                                </span>
                              </div>

                              {/* Cảnh báo độ lệch thời gian check-in/check-out của KTV */}
                              {selectedSessionLog.duration_warning_type && selectedSessionLog.duration_warning_type !== 'normal' && (
                                <div className={cn(
                                  "rounded-xl px-4 py-3 border text-xs font-bold space-y-1 shadow-sm",
                                  selectedSessionLog.duration_warning_type === 'under_time' 
                                    ? "bg-rose-50 border-rose-100 text-rose-800" 
                                    : "bg-amber-50 border-amber-100 text-amber-800"
                                  )}>
                                  <div className="flex items-center gap-1.5 font-black uppercase text-[9px] tracking-wider">
                                    {selectedSessionLog.duration_warning_type === 'under_time' ? (
                                      <>⚠️ Cảnh báo thiếu thời gian</>
                                    ) : (
                                      <>⏰ Cảnh báo quá giờ</>
                                    )}
                                  </div>
                                  <p className="text-[11px] leading-normal font-bold">
                                    {selectedSessionLog.duration_warning_type === 'under_time' ? (
                                      <>
                                        Làm chưa đủ thời gian gói liệu trình (thiếu {Math.abs(selectedSessionLog.time_deviation || 0)} phút)
                                      </>
                                    ) : (
                                      <>
                                        Làm quá thời gian quy định của gói (quá {selectedSessionLog.time_deviation || 0} phút)
                                      </>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                    Quy định: {selectedSessionLog.standard_duration || 60} phút | Thực tế: {selectedSessionLog.actual_duration || 0} phút
                                  </p>
                                  
                                  {selectedSessionLog.duration_warning_type === 'under_time' && selectedSessionLog.ktv_checkout_note && (
                                    <div className="mt-2 pt-2 border-t border-rose-200/50 text-[11px] text-rose-700 italic">
                                      <span className="font-black not-italic block uppercase text-[8px] text-rose-600 tracking-wider mb-0.5">Lý do KTV báo cáo:</span>
                                      &quot;{selectedSessionLog.ktv_checkout_note}&quot;
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedSessionLog.status === 'completed' && (
                        <div className={cn(
                          "p-5 rounded-2xl border shadow-sm space-y-3.5 mb-2 transition-all duration-300",
                          selectedSessionLog.rating && selectedSessionLog.rating > 0 
                            ? "bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-yellow-50/30 border-amber-100/60 shadow-amber-50/50" 
                            : "bg-slate-50 border-slate-100"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm",
                                selectedSessionLog.rating && selectedSessionLog.rating > 0 
                                  ? "bg-amber-100/70 text-amber-600 animate-pulse" 
                                  : "bg-slate-200/70 text-slate-400"
                              )}>
                                <Star className={cn("w-4 h-4", selectedSessionLog.rating && selectedSessionLog.rating > 0 && "fill-current")} />
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">Đánh giá từ khách hàng</p>
                                <h4 className="text-xs font-black text-slate-800">
                                  {selectedSessionLog.rating && selectedSessionLog.rating > 0 
                                    ? "Đã gửi qua Portal" 
                                    : "Chưa gửi đánh giá"}
                                </h4>
                              </div>
                            </div>

                            {selectedSessionLog.rating && selectedSessionLog.rating > 0 && (
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <Star 
                                    key={idx} 
                                    className={cn(
                                      "w-3.5 h-3.5",
                                      idx < (selectedSessionLog.rating || 0) 
                                        ? "text-amber-500 fill-amber-500" 
                                        : "text-slate-200"
                                    )} 
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          {selectedSessionLog.rating && selectedSessionLog.rating > 0 ? (
                            <div className="bg-white/80 p-3.5 rounded-xl border border-amber-100/40 shadow-inner">
                              <p className="text-xs font-bold text-slate-700 italic leading-relaxed">
                                &quot;{selectedSessionLog.rating_comment || 'Không có ý kiến đóng góp thêm'}&quot;
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] font-semibold text-slate-400 italic">
                              Khách hàng chưa thực hiện đánh giá qua Portal liên kết của buổi chăm sóc này.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleSaveFullUpdate()}
                      disabled={isSavingNote || !selectedSessionLog || (userRole !== 'admin' && !['scheduled', 'in_progress'].includes(selectedSessionLog.status))}
                      className={cn(
                        "w-full mt-2 bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] dark:shadow-none flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                      )}
                    >
                      {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                      Cập nhật thông tin
                    </button>

                    {userRole === 'admin' && selectedSessionLog && !['scheduled', 'in_progress'].includes(selectedSessionLog.status) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button 
                          onClick={() => handleStatusChange('scheduled')}
                          disabled={isSavingNote}
                          className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Khôi phục buổi
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc muốn hủy ${workUnitLabel} này?`)) {
                              handleStatusChange('cancelled');
                            }
                          }}
                          disabled={isSavingNote}
                          className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Hủy buổi này
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {userRole === 'admin' && (
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-200">
                  <div className="flex items-center gap-3 text-amber-700 font-black uppercase text-[10px] tracking-widest mb-2">
                    <AlertCircle className="w-4 h-4" /> Chế độ Admin
                  </div>
                  <p className="text-[11px] font-bold text-amber-600 leading-relaxed">
                    Bạn có quyền chỉnh sửa lịch sử và {vocab.workUnit.plural.toLowerCase()} đã hoàn thành. Hãy cẩn trọng khi thay đổi dữ liệu.
                  </p>
                </div>
              )}

              <div className="luxury-card-pink p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Tóm tắt tiến độ</h3>
                  {(activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 21) && (
                    <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Done</span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-6 relative z-10">
                  <div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm">
                    <p className="text-[9px] opacity-60 font-black uppercase tracking-widest mb-1">Hoàn thành</p>
                    <p className="text-3xl font-black text-slate-900">{activeBooking.completed_sessions || 0}</p>
                  </div>
                  <div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm relative group">
                    <p className="text-[9px] opacity-60 font-black uppercase tracking-widest mb-1">Tổng cộng</p>
                    <p className="text-3xl font-black text-slate-900">{activeBooking.total_sessions || 15}</p>
                    {userRole === 'admin' && (
                      <button 
                        onClick={() => handleAddExtraSession(activeBooking.id)}
                        disabled={isSyncing}
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-lg text-primary hover:bg-primary hover:text-primary-foreground transition-all opacity-0 group-hover:opacity-100 shadow-sm disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-white/80 disabled:hover:text-primary"
                        title={isSyncing ? "Đang thêm buổi bổ sung" : "Thêm buổi bổ sung"}
                      >
                        {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 relative z-10">
                  <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${((activeBooking.completed_sessions || 0) / (activeBooking.total_sessions || 15)) * 100}%` }}
                    />
                  </div>
                </div>

                {(activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 21) && (
                   <button 
                    onClick={() => handleReusePackage(activeBooking.id, customerHeaderLabel)}
                    disabled={isReusingId === activeBooking.id}
                    className="w-full mt-6 bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all relative z-10"
                  >
                    {isReusingId === activeBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} 
                    Tái sử dụng gói nhanh
                  </button>
                )}
              </div>
            </div>

            {/* Right: Calendar Grid */}
            <div className="order-1 lg:order-2 lg:col-span-2 space-y-6">
              <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-5 md:mb-8">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary" /> Lịch trình
                  </h3>
                  <div className="flex gap-2 md:gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-black uppercase text-slate-400">Xong</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 session-status-dot-cancelled bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                      <span className="text-[10px] font-black uppercase text-slate-400">Hủy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      <span className="text-[10px] font-black uppercase text-slate-400">Hôm nay</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 md:gap-3">
                  {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                    <div key={day} className="text-center py-2">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</span>
                    </div>
                  ))}
                  
                  {isLoadingLogs ? (
                    <div className="col-span-7 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-xs font-bold text-slate-400">Đang tải lịch trình...</p>
                    </div>
                  ) : sessionLogs.length > 0 ? (
                    <>
                      {/* Empty placeholders to align with day of week */}
                      {Array.from({ 
                        length: sessionLogs[0]?.assigned_date ? new Date(sessionLogs[0].assigned_date).getDay() : 0 
                      }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}
                      
                      {calendarCells.map((cell) => {
                        if ('isGap' in cell && cell.isGap) {
                          return (
                            <div 
                              key={`gap-${cell.dateString}`}
                              className="aspect-square rounded-2xl flex flex-col items-center justify-center border border-dashed border-slate-100 bg-slate-50/10 text-slate-300/40 select-none cursor-default"
                              title={`Ngày nghỉ/trống (${cell.dateString})`}
                            >
                              <span className="text-[10px] font-black opacity-30">•</span>
                            </div>
                          );
                        }

                        const log = cell as SessionLog;
                        const status = log.status;
                        const isUpdating = isSyncing && selectedSessionLog?.id === log.id;
                        const logIndex = sessionLogs.findIndex(l => l.id === log.id);
                        const nextScheduledIndex = sessionLogs.findIndex(l => l.status === 'scheduled');
                        const isNextToRun = status === 'scheduled' && logIndex === nextScheduledIndex;
                        const canEdit = userRole === 'admin' || isNextToRun;
                        const isReassigned = log.completed_by_ktv_id && log.completed_by_ktv_id !== activeBooking.assigned_ktv_id;

                        return (
                          <div 
                            key={log.id} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionLog(log);
                              setCurrentNote(log.notes || '');
                            }}
                            className={cn(
                              "aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all cursor-pointer group relative overflow-hidden",
                              status === 'completed' ? 'bg-emerald-500 border-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                              status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 shadow-sm session-status-badge-cancelled' :
                              isNextToRun ? 'bg-amber-50 border-amber-300 text-amber-600 ring-4 ring-amber-50 shadow-lg' :
                              'bg-slate-50/50 border-slate-100 text-slate-300 hover:bg-slate-100',
                              selectedSessionLog?.id === log.id && "ring-2 ring-primary border-primary/50 shadow-inner",
                              !canEdit && status === 'scheduled' && "grayscale opacity-50",
                              isUpdating && "animate-pulse"
                            )}
                          >
                            {isNextToRun && (
                              <div className="absolute top-0 right-0 m-2 flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                              </div>
                            )}
                            {isReassigned && (
                              <div className="absolute top-1.5 left-1.5 text-[8px] filter drop-shadow-sm select-none" title="Có KTV làm thay">
                                🔄
                              </div>
                            )}
                            <span className={cn("text-xs font-black mb-1", status === 'completed' ? "text-white" : "text-slate-900")}>
                              {log.session_number}
                            </span>
                            {status !== 'scheduled' && (
                              <p className={cn("text-[8px] font-black uppercase", status === 'completed' ? "text-white/90" : "opacity-60")}>
                                {status === 'completed' ? 'Xong' : 'Hủy'}
                              </p>
                            )}
                            {isNextToRun && (
                              <p className="text-[8px] font-black uppercase text-amber-600">Làm ngay</p>
                            )}
                            
                            <div className="absolute inset-0 bg-primary text-primary-foreground p-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center z-20">
                              <p className="text-[9px] font-black uppercase mb-0.5 text-primary-foreground leading-tight">{vocab.workUnit.singular} {log.session_number}</p>
                              <p className="text-[8px] font-bold opacity-90 mb-1 text-primary-foreground leading-tight">{log.assigned_date ? formatViDate(log.assigned_date) : 'Chưa hẹn'}</p>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSessionLog(log);
                                }}
                                className="bg-primary-foreground text-primary px-2 py-1 rounded-lg text-[8px] font-black uppercase mt-0.5 transition-colors shadow-sm hover:opacity-90"
                              >
                                Cập nhật
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="col-span-7 py-20 text-center italic text-slate-400 font-bold">
                      Chưa khởi tạo lịch trình cho hợp đồng này
                    </div>
                  )}
                </div>
              </div>

              {/* AI suggestion panel here! Only for admin */}
              {userRole === 'admin' && (
                <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100">
                  <KtvSuggestionPanel
                    bookingId={activeBooking.id}
                    tenantId={activeBooking.tenant_id}
                    requestedDate={selectedDate || new Date().toLocaleDateString('sv-SE')}
                    requestedStartTime={selectedTime || '09:00'}
                    durationMinutes={selectedSessionLog?.standard_duration || 60}
                    onKtvAssigned={async (ktvId, ktvName) => {
                      if (onSuccess) {
                        onSuccess();
                      }
                      await fetchSessionLogs(activeBooking.id);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
