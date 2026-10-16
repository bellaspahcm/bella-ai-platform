'use client';

import { cn } from '@/lib/utils';
import { adminOverrideAttendance } from '@/services/attendance-actions';
import { KtvAttendanceLog,KtvAttendanceSummary } from '@/types/domain';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'sonner';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface AttendanceCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKtv: KtvAttendanceSummary | null;
  onSaveSuccess: () => Promise<void>;
}

const attendanceStatusOptions = [
  { value: 'present', label: 'Đúng giờ (Có mặt)' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'absent', label: 'Vắng mặt (Nghỉ)' },
  { value: 'half_day', label: 'Nửa ngày' },
];

export default function AttendanceCalendar({
  isOpen,
  onClose,
  selectedKtv,
  onSaveSuccess,
}: AttendanceCalendarProps) {
  const vocab = useModuleVocabulary();
  const [selectedDayLog, setSelectedDayLog] = useState<{
    date: string;
    log: KtvAttendanceLog | null;
  } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'late' | 'absent' | 'half_day'>('present');
  const [overrideCheckin, setOverrideCheckin] = useState('');
  const [overrideCheckout, setOverrideCheckout] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !selectedKtv) return null;

  const now = new Date();
  const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Vietnam Timezone helper functions
  const toLocalISOString = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const tzOffset = 7 * 60; // Vietnam +7 hours in minutes
    const localTime = new Date(date.getTime() + tzOffset * 60 * 1000);
    return localTime.toISOString().substring(0, 16);
  };

  const formatTimeVN = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return 'Chưa ghi nhận';
    const date = new Date(dateInput);
    return date.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleDayClick = (dateStr: string, log: KtvAttendanceLog | undefined) => {
    setSelectedDayLog({
      date: dateStr,
      log: log || null
    });
    setOverrideStatus(log?.status || 'present');
    setOverrideCheckin(log?.checkin_time ? toLocalISOString(log.checkin_time) : '');
    setOverrideCheckout(log?.checkout_time ? toLocalISOString(log.checkout_time) : '');
  };

  const handleSaveOverride = async () => {
    if (!selectedKtv || !selectedDayLog) return;
    setIsSaving(true);
    const res = await adminOverrideAttendance({
      ktvId: selectedKtv.id,
      date: selectedDayLog.date,
      status: overrideStatus,
      checkinTime: overrideCheckin || undefined,
      checkoutTime: overrideCheckout || undefined
    });

    if (res.success) {
      toast.success('Cập nhật chấm công thành công!');
      await onSaveSuccess();
      setSelectedDayLog(null);
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl md:h-[min(600px,92vh)] md:flex-row md:rounded-[32px]"
      >
        {/* Left Panel: Calendar Grid */}
        <div className="flex-1 overflow-y-auto border-b border-slate-100 p-4 sm:p-6 md:border-b-0 md:border-r md:p-8">
          <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Chấm công: {selectedKtv.name}</h3>
            <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary">{currentMonthYear}</span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {/* Headers */}
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(h => (
              <div key={h} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">{h}</div>
            ))}
            
            {/* Generate Calendar Days */}
            {(() => {
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const firstDayIndex = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7; // Align Monday as 0
              
              const cells = [];
              for (let i = 0; i < firstDayIndex; i++) {
                cells.push(<div key={`empty-${i}`} className="aspect-square bg-slate-50/50 rounded-xl"></div>);
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const log = selectedKtv.logs?.find((a) => a.date === dateStr);
                
                let bgClass = "bg-slate-50 hover:bg-slate-100 text-slate-700";
                let dotColor = "";
                
                if (log?.status === 'present') { bgClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"; dotColor = "bg-emerald-500"; }
                else if (log?.status === 'late') { bgClass = "bg-amber-50 text-amber-700 hover:bg-amber-100"; dotColor = "bg-amber-500"; }
                else if (log?.status === 'absent') { bgClass = "bg-rose-50 text-rose-700 hover:bg-rose-100"; dotColor = "bg-rose-500"; }
                else if (log?.status === 'half_day') { bgClass = "bg-blue-50 text-blue-700 hover:bg-blue-100"; dotColor = "bg-blue-500"; }

                const isToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) === dateStr;

                cells.push(
                  <button
                    key={day}
                    onClick={() => handleDayClick(dateStr, log)}
                    data-testid="attendance-day-button"
                    data-date={dateStr}
                    className={cn(
                      "relative flex aspect-square flex-col justify-between rounded-xl p-2 font-black transition-all sm:rounded-2xl sm:p-3",
                      bgClass,
                      isToday && "ring-2 ring-primary"
                    )}
                  >
                    <span className="text-xs">{day}</span>
                    {log?.status && (
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)}></span>
                        <span className="text-[8px] uppercase tracking-tighter hidden md:inline">
                          {log.status === 'present' ? 'Đúng giờ' : log.status === 'late' ? 'Muộn' : log.status === 'half_day' ? 'Nửa ngày' : 'Nghỉ'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
        </div>

        {/* Right Panel: Detail & Override Form */}
        <div className="flex max-h-[42vh] w-full flex-col justify-between overflow-y-auto bg-slate-50 p-4 sm:p-6 md:max-h-none md:w-80 md:p-8">
          <div>
            <h4 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider text-xs text-slate-400">Chi tiết ngày chọn</h4>
            
            {selectedDayLog ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ngày</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(selectedDayLog.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {selectedDayLog.log && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Thời gian {vocab.worker.short} đã kích hoạt</p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế vào:</span>
                        <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkin_time)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Thực tế ra:</span>
                        <span className="text-slate-800">{formatTimeVN(selectedDayLog.log.checkout_time)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Trạng thái chấm công</label>
                  <PremiumSelect
                    options={attendanceStatusOptions}
                    value={overrideStatus}
                    onChange={value => setOverrideStatus(value as 'present' | 'late' | 'absent' | 'half_day')}
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian vào ca</label>
                  <input
                    type="datetime-local"
                    value={overrideCheckin}
                    onChange={e => setOverrideCheckin(e.target.value)}
                    data-testid="attendance-checkin-input"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời gian ra ca</label>
                  <input
                    type="datetime-local"
                    value={overrideCheckout}
                    onChange={e => setOverrideCheckout(e.target.value)}
                    data-testid="attendance-checkout-input"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium italic">Chọn một ngày trong lịch để xem chi tiết hoặc thay đổi dữ liệu chấm công</p>
            )}
          </div>

          <div className="mt-6 flex gap-3 md:mt-8">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              Đóng
            </button>
            {selectedDayLog && (
              <button
                onClick={handleSaveOverride}
                disabled={isSaving}
                data-testid="attendance-save-button"
                className="flex-1 py-3 bg-primary text-primary-foreground font-black rounded-xl text-xs uppercase tracking-wider hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu công'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
