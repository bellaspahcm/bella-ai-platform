'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCheck, 
  DollarSign, 
  Building2, 
  Activity, 
  Megaphone,
  LineChart
} from 'lucide-react';

// Import sub-pages directly
import CustomerIntelligencePage from '../customer-intelligence/page';
import FinancePage from '../finance/page';
import HRIntelligencePage from '../hr/page';
import OperationsIntelligencePage from '../operations/page';
import MarketingDashboardWrapper from '../marketing/page';

const TABS = [
  { id: 'customer', label: 'Khách hàng', icon: UserCheck, component: CustomerIntelligencePage },
  { id: 'finance', label: 'Tài chính', icon: DollarSign, component: FinancePage },
  { id: 'hr', label: 'Nhân sự', icon: Building2, component: HRIntelligencePage },
  { id: 'operations', label: 'Vận hành', icon: Activity, component: OperationsIntelligencePage },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, component: MarketingDashboardWrapper },
];

export default function AnalyticsCenterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return TABS.some(t => t.id === tabParam) ? (tabParam as string) : 'customer';
  });

  // Sync state with URL search param
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tabId);
      router.push(`/dashboard/analytics?${params.toString()}`);
    });
  };

  // Sync tab state when URL changes (e.g. browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && TABS.some(t => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || CustomerIntelligencePage;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/30">
      {/* Analytics Hub Header & Tab Switcher */}
      <div className="bg-white border-b border-slate-100 px-6 sm:px-10 py-5 shrink-0 relative z-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <LineChart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trung tâm Phân tích</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Hệ thống báo cáo thông minh & Phân tích nghiệp vụ</p>
            </div>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                  isActive 
                    ? 'text-primary-foreground'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/80'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-analytics-tab"
                    className="absolute inset-0 bg-primary rounded-xl shadow-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 w-4 h-4" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        {isPending && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          </div>
        )}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
