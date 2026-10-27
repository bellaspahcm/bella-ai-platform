'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, LayoutDashboard, TrendingUp, Award, Activity, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXPERIENCE_TABS = [
  { key: 'overview', label: 'Tổng quan', icon: LayoutDashboard, actions: [], description: 'Chỉ số tổng quan và xu hướng trải nghiệm chưa kết nối dữ liệu khảo sát thực tế.' },
  { key: 'nps', label: 'NPS', icon: TrendingUp, actions: ['Gọi ngay'], description: 'Chưa kết nối kết quả khảo sát NPS để tính điểm và xu hướng.' },
  { key: 'csi', label: 'CSI', icon: Award, actions: ['Liên hệ khắc phục'], description: 'Chưa kết nối kết quả khảo sát CSI để hiển thị mức độ hài lòng.' },
  { key: 'health', label: 'Sức khỏe KH', icon: Activity, actions: ['Tạo kế hoạch chăm sóc'], description: 'Chưa có dữ liệu vận hành để xác định điểm sức khỏe hoặc rủi ro của khách hàng.' },
  { key: 'actions', label: 'Hành động', icon: Zap, actions: ['Thực hiện'], description: 'Next Best Actions và Lost Analysis chưa kết nối dữ liệu vận hành. Chưa có gợi ý hoặc kết quả phân tích để xử lý.' },
];

export function ExperienceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-8" data-auto-layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>Cập nhật lần cuối:</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">Chưa cập nhật</span>
        </div>
        <Button variant="outline" size="sm" disabled aria-describedby="experience-unavailable" className="rounded-xl text-xs font-bold">
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Làm mới dữ liệu
        </Button>
      </div>

      <Alert id="experience-unavailable">
        <AlertTitle>Dữ liệu trải nghiệm chưa sẵn sàng</AlertTitle>
        <AlertDescription>Các báo cáo trải nghiệm chưa kết nối nguồn dữ liệu vận hành. Chức năng làm mới hiện chưa khả dụng.</AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-start">
          <div className="p-1.5 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm inline-flex max-w-full overflow-x-auto">
            <TabsList className="inline-flex items-center justify-start bg-transparent p-0 gap-1.5 h-auto w-auto group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:w-auto border-none shadow-none" aria-label="Báo cáo trải nghiệm">
              {EXPERIENCE_TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="inline-flex items-center justify-center gap-2 h-10 py-2 w-32 sm:w-36 md:w-40 rounded-xl text-xs font-bold transition-all after:hidden after:content-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer shrink-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        {EXPERIENCE_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="outline-none">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">{tab.label}</h2>
              <Alert id={`experience-${tab.key}-unavailable`}>
                <AlertTitle>Báo cáo chưa khả dụng</AlertTitle>
                <AlertDescription>{tab.description}</AlertDescription>
              </Alert>
              {tab.actions.map(action => (
                <Button key={action} variant="outline" disabled aria-describedby={`experience-${tab.key}-unavailable`} className="mt-4">
                  {action}
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
