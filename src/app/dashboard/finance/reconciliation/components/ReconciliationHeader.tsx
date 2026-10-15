'use client';

import { RefreshCw, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

type ReconciliationHeaderProps = {
  filterDate: string;
  isLoading: boolean;
  onFilterDateChange: (value: string) => void;
  onRefresh: () => void;
};

export function ReconciliationHeader({
  filterDate,
  isLoading,
  onFilterDateChange,
  onRefresh,
}: ReconciliationHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-primary/80 mb-2">
          <ShieldAlert className="w-5 h-5" />
          <span className="text-sm font-black uppercase tracking-widest">Trung tâm Giám sát</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Đối soát Tài chính</h1>
        <p className="text-slate-500 mt-2 font-medium">Tự động phát hiện công nợ, tiền treo và chênh lệch doanh thu</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
        <div className="flex w-full min-w-0 flex-col gap-1.5 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm transition-all hover:border-slate-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">LỌC NGÀY:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(event) => onFilterDateChange(event.target.value)}
            className="w-full min-w-[11rem] bg-transparent border-none p-0 pr-9 text-sm font-black text-slate-700 focus:ring-0 outline-none cursor-pointer"
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex w-full sm:w-auto justify-center items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-2xl font-black text-sm hover:bg-primary-hover transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          QUÉT LẠI
        </button>
      </div>
    </div>
  );
}
