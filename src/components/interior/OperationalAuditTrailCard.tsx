'use client';

import React from 'react';
import {
  History,
  User,
  UserCheck,
  Clock,
  CheckCircle2,
  Timer,
  PlayCircle,
} from 'lucide-react';
import {
  formatAuditTimestamp,
  computeOperationalLeadTime,
  type OperationalStatusHistoryEntry,
} from '@/products/bella-interior/lib/operational-audit-trail';

export interface OperationalAuditTrailCardProps {
  readonly createdAt?: string | null;
  readonly createdByName?: string | null;
  readonly startedAt?: string | null;
  readonly startedByName?: string | null;
  readonly completedAt?: string | null;
  readonly completedByName?: string | null;
  readonly executionDuration?: string | null;
  readonly statusHistory?: readonly OperationalStatusHistoryEntry[] | null;
  readonly title?: string;
  readonly status?: string;
  readonly className?: string;
}

export default function OperationalAuditTrailCard({
  createdAt,
  createdByName,
  startedAt,
  startedByName,
  completedAt,
  completedByName,
  executionDuration,
  statusHistory,
  title = 'Dấu vết thời gian &amp; Lịch sử phê duyệt',
  status,
  className = '',
}: OperationalAuditTrailCardProps) {
  const isCompleted =
    status === 'completed' ||
    status === 'handed_over' ||
    status === 'approved' ||
    status === 'resolved' ||
    Boolean(completedAt);

  const duration =
    executionDuration || computeOperationalLeadTime(startedAt || createdAt, completedAt);

  return (
    <div
      className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3.5 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
          <History className="w-4 h-4 text-indigo-500" />
          <span>{title}</span>
        </div>
        {duration && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
            <Timer className="w-3 h-3 text-indigo-500" />
            Lead time: {duration}
          </span>
        )}
      </div>

      {/* 3 Key Operational Lifecycle Milestones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Khởi tạo */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
            <User className="w-3 h-3 text-blue-500 shrink-0" />
            <span>Người khởi tạo</span>
          </div>
          <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
            {createdByName || 'Quản lý vận hành'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            <span className="truncate">{formatAuditTimestamp(createdAt)}</span>
          </div>
        </div>

        {/* 2. Bắt đầu / Tiếp nhận */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
            <PlayCircle className="w-3 h-3 text-amber-500 shrink-0" />
            <span>Người tiếp nhận / Bắt đầu</span>
          </div>
          <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
            {startedByName || (startedAt ? 'Nhân sự phụ trách' : '— (Theo quy trình)')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {startedAt ? formatAuditTimestamp(startedAt) : 'Chờ triển khai'}
            </span>
          </div>
        </div>

        {/* 3. Phê duyệt / Hoàn thành */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
            <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Người duyệt hoàn thành</span>
          </div>
          <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
            {isCompleted ? completedByName || 'Hội đồng nghiệm thu' : '— (Chờ duyệt)'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
            <span className="truncate">
              {completedAt ? formatAuditTimestamp(completedAt) : 'Chưa hoàn thành'}
            </span>
          </div>
        </div>
      </div>

      {/* Nhật ký chuyển bước (Activity Timeline) */}
      {statusHistory && statusHistory.length > 0 && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Nhật ký chuyển bước &amp; Xử lý:
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {statusHistory.map((h, hIdx) => {
              const isComp = h.action === 'completed' || h.action === 'approved';
              const isStart = h.action === 'started';
              const isReopen = h.action === 'reopened';
              const isReject = h.action === 'rejected';

              return (
                <div key={hIdx} className="flex items-start gap-2.5 text-[11px] leading-snug">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${
                      isComp
                        ? 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900'
                        : isStart
                        ? 'bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                        : isReopen
                        ? 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900'
                        : isReject
                        ? 'bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900'
                        : 'bg-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {h.actorName || 'Quản lý'}{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          (
                          {h.action === 'created'
                            ? 'Khởi tạo'
                            : h.action === 'completed'
                            ? 'Duyệt hoàn thành'
                            : h.action === 'approved'
                            ? 'Phê duyệt'
                            : h.action === 'started'
                            ? 'Bắt đầu xử lý'
                            : h.action === 'reopened'
                            ? 'Mở lại'
                            : h.action === 'rejected'
                            ? 'Từ chối'
                            : 'Cập nhật'}
                          )
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatAuditTimestamp(h.timestamp)}
                      </span>
                    </div>
                    {h.note && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {h.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
