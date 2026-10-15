'use client';

import { Calendar as CalendarIcon, CalendarDays, Plus } from 'lucide-react';

import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

export type BookingsViewMode = 'calendar' | 'timeline';

type BookingsPageHeaderProps = {
  view: BookingsViewMode;
  surface?: 'schedule' | 'pos';
  onViewChange: (view: BookingsViewMode) => void;
  onCreateClick: () => void;
  tenantModuleKey: TenantModuleKey | null;
};

export function BookingsPageHeader({
  view,
  surface = 'schedule',
  onViewChange,
  onCreateClick,
  tenantModuleKey,
}: BookingsPageHeaderProps) {
  const isPosSurface = surface === 'pos';
  const vocab = useModuleVocabulary(tenantModuleKey);

  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {isPosSurface ? 'POS / In bill' : 'Lịch hẹn'}
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          {isPosSurface
            ? 'Mở lịch hẹn, chọn ca và in bill thanh toán K80'
            : `Điều phối và theo dõi lịch ${vocab.service.singular.toLowerCase()}`}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex w-full justify-center rounded-2xl border border-slate-200/50 bg-slate-100 p-1 shadow-inner sm:w-auto sm:justify-start">
          <button
            onClick={() => onViewChange('timeline')}
            type="button"
            className={`flex-1 sm:flex-initial flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${
              view === 'timeline'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>Timeline {vocab.worker.short}</span>
          </button>
          <button
            onClick={() => onViewChange('calendar')}
            type="button"
            className={`flex-1 sm:flex-initial flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${
              view === 'calendar'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            <span>Lịch tháng</span>
          </button>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          <div className="shrink-0">
            <PremiumExportButton />
          </div>
          <button
            type="button"
            onClick={onCreateClick}
            className="flex min-h-12 flex-grow items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95 dark:shadow-none sm:flex-initial sm:px-6"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}
