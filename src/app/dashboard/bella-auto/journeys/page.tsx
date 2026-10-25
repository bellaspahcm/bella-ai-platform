'use client';

import { useState } from 'react';
import { Activity, Layers, Flame, Zap, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type JourneyView = 'funnel' | 'heatmap' | 'timeline';

const JOURNEY_TABS: Array<{ key: JourneyView; label: string; icon: LucideIcon; description: string }> = [
  {
    key: 'funnel',
    label: 'Phễu Chuyển Đổi',
    icon: Layers,
    description: 'Phễu chuyển đổi chưa kết nối dữ liệu hành trình. Chưa có số liệu chuyển đổi để hiển thị.',
  },
  {
    key: 'heatmap',
    label: 'Biểu Đồ Tắc Nghẽn',
    icon: Flame,
    description: 'Biểu đồ tắc nghẽn chưa kết nối dữ liệu vận hành. Chưa thể xác định thời gian chờ hoặc cảnh báo SLA.',
  },
  {
    key: 'timeline',
    label: 'Timeline CEO View',
    icon: Activity,
    description: 'Timeline chưa kết nối lịch sử sự kiện của khách hàng. Chưa có hành trình để hiển thị.',
  },
];

export default function CustomerJourneyPage() {
  const [activeTab, setActiveTab] = useState<JourneyView>('funnel');

  return (
    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/15 dark:from-indigo-500/20 dark:to-purple-500/5 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">Hành Trình Khách Hàng &amp; SLA Engine</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Theo dõi hành trình khách hàng và thời hạn xử lý</p>
          </div>
        </div>
        <button
          disabled
          aria-describedby="journey-sla-unavailable"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md shrink-0"
        >
          <Zap className="w-4 h-4" />
          Quét &amp; Đồng Bộ SLA
        </button>
      </div>

      <Alert id="journey-sla-unavailable">
        <AlertTitle>Giám sát SLA chưa sẵn sàng</AlertTitle>
        <AlertDescription>Chức năng quét và đồng bộ SLA chưa được kết nối. Chưa thể xác nhận kết quả quét hoặc thời hạn xử lý từ màn hình này.</AlertDescription>
      </Alert>

      <div className="flex justify-start overflow-x-auto">
        <nav aria-label="Các góc nhìn hành trình" className="flex p-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl gap-1.5 shadow-sm">
          {JOURNEY_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                aria-pressed={activeTab === tab.key}
                aria-controls={`journey-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 shrink-0 ${
                  activeTab === tab.key
                    ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20 dark:border-slate-800/30'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {JOURNEY_TABS.filter(tab => tab.key === activeTab).map(tab => (
        <section key={tab.key} id={`journey-${tab.key}`} aria-label={tab.label} className="bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{tab.label}</h2>
          {tab.key === 'timeline' && (
            <div className="mb-4 space-y-2">
              <label htmlFor="journey-customer" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Xem hành trình</label>
              <select id="journey-customer" disabled aria-describedby="journey-timeline-unavailable" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <option>Chưa có dữ liệu khách hàng để chọn</option>
              </select>
            </div>
          )}
          <Alert id={`journey-${tab.key}-unavailable`}>
            <AlertTitle>Dữ liệu hành trình chưa sẵn sàng</AlertTitle>
            <AlertDescription>{tab.description}</AlertDescription>
          </Alert>
        </section>
      ))}
    </div>
  );
}
