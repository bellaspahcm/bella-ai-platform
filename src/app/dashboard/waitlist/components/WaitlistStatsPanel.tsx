'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bell, CalendarCheck, TrendingUp } from 'lucide-react';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

interface WaitlistStats {
  total_entries: number;
  active_entries: number;
  notified_entries: number;
  converted_entries: number;
  conversion_rate: number;
  avg_wait_minutes: number;
}

interface WaitlistStatsPanelProps {
  tenantId: string;
}

export function WaitlistStatsPanel({ tenantId }: WaitlistStatsPanelProps) {
  const { tenantModuleKey } = useTenantModuleKey();
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!tenantId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/waitlist/stats?tenant_id=${tenantId}&period=month`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err: unknown) {
        console.error('Error fetching waitlist stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchStats();
  }, [tenantId]);

  // Determine styling based on tenant module
  const getThemeConfig = (moduleKey: TenantModuleKey | null) => {
    switch (moduleKey) {
      case 'beauty_spa':
      case 'babycare':
        return {
          cardBg: 'bg-card shadow-sm shadow-primary/5',
          borderColor: 'border-primary/20 border-[1.5px]',
          hoverBorder: 'hover:border-primary/60',
          hoverGlow: 'hover:shadow-lg hover:shadow-primary/15',
          iconBg: 'bg-primary/10 text-primary',
          accentText: 'text-primary',
        };
      case 'industrial_cleaning':
        return {
          cardBg: 'bg-sky-50/10 dark:bg-[#0C3776]/10',
          borderColor: 'border-sky-100/50 dark:border-sky-800/30',
          hoverBorder: 'hover:border-sky-300/80 dark:hover:border-sky-700/80',
          hoverGlow: 'hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]',
          iconBg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
          accentText: 'text-sky-700 dark:text-sky-300',
        };
      default:
        return {
          cardBg: 'bg-white dark:bg-[#1c1b19] shadow-[0_10px_25px_-5px_rgba(244,63,94,0.06)]',
          borderColor: 'border-rose-500/22 dark:border-rose-800/50 border-[1.5px]',
          hoverBorder: 'hover:border-rose-500/60 dark:hover:border-rose-400/60',
          hoverGlow: 'hover:shadow-[0_20px_40px_-10px_rgba(244,63,94,0.18)]',
          iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
          accentText: 'text-rose-700 dark:text-rose-300',
        };
    }
  };

  const theme = getThemeConfig(tenantModuleKey);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`h-24 rounded-2xl border ${theme.borderColor} ${theme.cardBg} backdrop-blur-md p-4 animate-pulse flex items-center justify-between`}
          >
            <div className="space-y-2">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-6 w-12 bg-slate-300 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      title: 'Đang chờ',
      value: stats?.active_entries ?? 0,
      icon: Clock,
      description: 'Khách hàng trong hàng đợi',
    },
    {
      title: 'Đã thông báo',
      value: stats?.notified_entries ?? 0,
      icon: Bell,
      description: 'Đã gửi tin nhắn nhắc hẹn',
    },
    {
      title: 'Đã đặt lịch',
      value: stats?.converted_entries ?? 0,
      icon: CalendarCheck,
      description: 'Chuyển đổi thành công',
    },
    {
      title: 'Tỷ lệ chuyển đổi',
      value: `${Math.round(stats?.conversion_rate ?? 0)}%`,
      icon: TrendingUp,
      description: 'Hiệu suất hàng chờ',
    },
  ];

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.1 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
    >
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={idx}
            variants={cardVariants}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`group rounded-2xl border ${theme.borderColor} ${theme.cardBg} ${theme.hoverBorder} ${theme.hoverGlow} p-4 transition-all duration-300 flex items-center justify-between cursor-pointer`}
          >
            <div className="text-left min-w-0 flex-1 pr-2">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {item.title}
              </p>
              <h3 className={`text-2xl font-black ${theme.accentText} mt-1 font-mono tracking-tight`}>
                {item.value}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {item.description}
              </p>
            </div>
            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${theme.iconBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-5 h-5" />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
