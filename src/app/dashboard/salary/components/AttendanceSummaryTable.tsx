'use client';

import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { KtvAttendanceSummary } from '@/types/domain';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface AttendanceSummaryTableProps {
  attendanceData: KtvAttendanceSummary[];
  openKtvCalendar: (ktv: KtvAttendanceSummary) => void;
}

export default function AttendanceSummaryTable({
  attendanceData,
  openKtvCalendar,
}: AttendanceSummaryTableProps) {
  const vocab = useModuleVocabulary();

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm md:rounded-[40px]">
        <div className="flex flex-col gap-4 border-b border-slate-50 p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="flex items-center gap-3 text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
              <CalendarDays className="h-6 w-6 shrink-0 text-primary sm:h-8 sm:w-8" />
              Bảng tổng hợp công thực tế
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Giám sát chuyên chuyên cần, đi muộn, nghỉ phép và số ca hoàn thành
            </p>
          </div>
          
          <Link
            href="/dashboard/hr/leave-requests"
            className="flex items-center justify-center gap-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all self-start md:self-auto shadow-xs"
          >
            <CalendarDays className="w-4 h-4 text-rose-600" />
            <span>Duyệt nghỉ phép {vocab.worker.short}</span>
          </Link>
        </div>
        
        <div className="overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.32)]">
          <table className="bella-data-table min-w-[72rem] text-left">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px]">
                  Nhân viên
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Tổng công
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-emerald-600">
                  Đúng giờ
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-amber-600">
                  Đi muộn
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-rose-600">
                  Nghỉ
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] text-center">
                  Nửa ngày
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Lương cơ bản
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attendanceData.map((ktv, idx) => (
                <motion.tr
                  key={ktv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors"
                  data-testid="attendance-summary-row"
                  data-ktv-id={ktv.id}
                >
                  <td className="px-8 py-6 whitespace-nowrap" data-testid="attendance-employee-name">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                        {ktv.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{ktv.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{ktv.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-700" data-testid="attendance-total-days">
                    {ktv.totalDays}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-emerald-600" data-testid="attendance-present-days">
                    +{ktv.present}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-amber-600">
                    +{ktv.late}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-rose-500">
                    -{ktv.absent}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-orange-500">
                    -{ktv.halfDay}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-900">
                    {ktv.baseSalary ? `${ktv.baseSalary.toLocaleString()}đ` : 'Chưa thiết lập'}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap">
                    <button
                      onClick={() => openKtvCalendar(ktv)}
                      data-testid="attendance-open-calendar-button"
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Chi tiết & Sửa
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
