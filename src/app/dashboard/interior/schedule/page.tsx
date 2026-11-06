'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Plus, Clock, CheckCircle2, AlertCircle, ArrowLeft, Building2 } from 'lucide-react';

interface TaskSchedule {
  id: string;
  projectName: string;
  taskTitle: string;
  category: 'design' | 'workshop' | 'site' | 'handover';
  date: string;
  time: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const SCHEDULE_TASKS: TaskSchedule[] = [
  {
    id: 's-1',
    projectName: 'Villa Ciputra Giai Đoạn 2',
    taskTitle: 'Chốt phương án duyệt bản vẽ Rev #2 với gia chủ',
    category: 'design',
    date: 'Hôm nay',
    time: '14:00 - 15:30',
    assignedTo: 'KTS. Hoàng Long',
    status: 'pending',
  },
  {
    id: 's-2',
    projectName: 'Dubai Luxury Villa Fitout',
    taskTitle: 'Nghiệm thu đóng gói tủ bếp gỗ óc chó tại Xưởng số 1',
    category: 'workshop',
    date: 'Ngày mai',
    time: '09:00 - 11:30',
    assignedTo: 'Quản đốc Trần Tuấn',
    status: 'in_progress',
  },
  {
    id: 's-3',
    projectName: 'Penthouse Metropolis Liễu Giai',
    taskTitle: 'Ký biên bản bàn giao và kích hoạt bảo hành phụ kiện Hafele',
    category: 'handover',
    date: '10/11/2026',
    time: '10:00 - 12:00',
    assignedTo: 'PM. Nguyễn Thị Mai',
    status: 'pending',
  },
  {
    id: 's-4',
    projectName: 'Duplex Aqua Bay Ecopark',
    taskTitle: 'Bóc tách khối lượng BOQ & dự toán phần hoàn thiện sàn gỗ',
    category: 'design',
    date: '11/11/2026',
    time: '15:00 - 17:00',
    assignedTo: 'QS. Đặng Văn Nam',
    status: 'pending',
  },
];

export default function SchedulePage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-600" />
            Lịch công việc &amp; Tiến độ dự án
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi phân bổ lịch khảo sát, nghiệm thu xưởng và lắp đặt công trình
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo lịch hẹn mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCHEDULE_TASKS.map((task) => (
          <div
            key={task.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {task.projectName}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                {task.date} · {task.time}
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
              {task.taskTitle}
            </h3>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              <span>Phụ trách: <strong className="text-slate-700 dark:text-slate-300">{task.assignedTo}</strong></span>
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                <Building2 className="w-3.5 h-3.5" />
                {task.category === 'workshop' ? 'Xưởng sản xuất' : task.category === 'site' ? 'Công trường' : task.category === 'handover' ? 'Bàn giao' : 'Thiết kế'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

