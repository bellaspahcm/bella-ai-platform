'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  BookOpen,
  Calendar,
  Activity,
  PenTool,
  BarChart3,
  GitCompareArrows,
  ClipboardCheck,
  ShieldCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccountingNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type AccountingNavGroup = AccountingNavItem & {
  items: AccountingNavItem[];
};

const navGroups: AccountingNavGroup[] = [
  {
    label: 'Tổng quan',
    href: '/dashboard/accounting',
    icon: Scale,
    items: [
      { label: 'Tổng quan', href: '/dashboard/accounting', icon: Scale },
    ],
  },
  {
    label: 'Sổ cái',
    href: '/dashboard/accounting/journals',
    icon: Activity,
    items: [
      { label: 'Nhật ký chung', href: '/dashboard/accounting/journals', icon: Activity },
      { label: 'Bút toán thủ công', href: '/dashboard/accounting/manual-entry', icon: PenTool },
    ],
  },
  {
    label: 'Kỳ & khóa sổ',
    href: '/dashboard/accounting/periods',
    icon: Calendar,
    items: [
      { label: 'Kỳ kế toán', href: '/dashboard/accounting/periods', icon: Calendar },
      { label: 'Sức khỏe sổ', href: '/dashboard/accounting/health', icon: ShieldCheck },
      { label: 'Hàng chờ hạch toán', href: '/dashboard/accounting/outbox', icon: Activity },
    ],
  },
  {
    label: 'Đối soát',
    href: '/dashboard/accounting/reconciliation',
    icon: GitCompareArrows,
    items: [
      { label: 'Đối soát chéo', href: '/dashboard/accounting/reconciliation', icon: GitCompareArrows },
      { label: 'Đối soát lương', href: '/dashboard/accounting/salary-reconciliation', icon: GitCompareArrows },
    ],
  },
  {
    label: 'Báo cáo',
    href: '/dashboard/accounting/reports',
    icon: BarChart3,
    items: [
      { label: 'Báo cáo tài chính', href: '/dashboard/accounting/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Thiết lập',
    href: '/dashboard/accounting/chart-of-accounts',
    icon: BookOpen,
    items: [
      { label: 'Hệ thống tài khoản (COA)', href: '/dashboard/accounting/chart-of-accounts', icon: BookOpen },
      { label: 'Sẵn sàng dữ liệu', href: '/dashboard/accounting/readiness', icon: ClipboardCheck },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, group: AccountingNavGroup) {
  if (group.href === '/dashboard/accounting') {
    return pathname === group.href;
  }

  return group.items.some((item) => isRouteActive(pathname, item.href));
}

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeGroup = navGroups.find((group) => isGroupActive(pathname, group)) || navGroups[0];
  const activeItem = navItems.find((item) => isRouteActive(pathname, item.href)) || activeGroup.items[0];
  const ActiveIcon = activeItem.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-[#11100F] overflow-auto">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 dark:bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Sub-Navigation Header Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 dark:bg-[#11100F]/80 border-b border-primary/15 dark:border-[#3E3A35]/50 px-6 py-4 shrink-0 transition-colors duration-300">
        <div className="flex flex-col gap-4 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="w-full lg:w-auto">
              <h1 className="text-xl sm:text-2xl font-black text-[#4C243B] dark:text-[#EFE9E1] tracking-tight uppercase flex items-center gap-2.5 whitespace-nowrap">
                <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-primary shrink-0" />
                Kế toán sổ cái
              </h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mt-1 whitespace-nowrap">
                Quản trị tài chính chuẩn Thông tư 133
              </p>
            </div>

            {/* Mobile Navigation Dropdown Select */}
            <div className="block md:hidden w-full mt-2 relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block mb-2">
                Danh mục phân hệ
              </label>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300 bg-white dark:bg-[#1E1C1A] border-primary/15 dark:border-[#3E3A35] text-slate-800 dark:text-[#EFE9E1] shadow-sm hover:shadow-md active:scale-[0.98] outline-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ActiveIcon className="w-4 h-4 text-primary dark:text-primary shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider truncate">
                    {activeGroup.label} / {activeItem.label}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-slate-400 dark:text-[#CDBCAB]/60 transition-transform duration-300 shrink-0",
                  isOpen && "rotate-180 text-primary dark:text-primary"
                )} />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-0 right-0 z-50 mt-2 bg-white dark:bg-[#1E1C1A] border border-primary/15 dark:border-[#3E3A35] rounded-2xl shadow-xl overflow-hidden py-2"
                  >
                    <div className="max-h-[360px] overflow-y-auto">
                      {navGroups.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                          <div key={group.label} className="py-1">
                            <div className="px-5 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary border-t border-slate-50 dark:border-zinc-800 first:border-0 pt-3 first:pt-1">
                              <GroupIcon className="w-3.5 h-3.5 text-primary dark:text-primary shrink-0" />
                              {group.label}
                            </div>
                            {group.items.map((item) => {
                              const isActive = isRouteActive(pathname, item.href);
                              const ItemIcon = item.icon;
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setIsOpen(false)}
                                  className={cn(
                                    "w-full flex items-center justify-between pl-9 pr-5 py-2.5 text-left transition-colors",
                                    isActive
                                      ? "bg-primary/10 text-primary font-black"
                                      : "text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#11100F] hover:text-slate-900 dark:hover:text-[#EFE9E1]"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <ItemIcon className={cn(
                                      "w-3.5 h-3.5 transition-colors shrink-0",
                                      isActive ? "text-primary dark:text-primary" : "text-slate-400 dark:text-[#CDBCAB]/60"
                                    )} />
                                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                                      {item.label}
                                    </span>
                                  </div>
                                  {isActive && (
                                    <Check className="w-4 h-4 text-primary dark:text-primary shrink-0" />
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Navigation Groups */}
            <nav className="hidden md:flex md:flex-nowrap items-center gap-1 mt-6 lg:mt-0 w-full lg:w-auto overflow-x-auto [scrollbar-width:none] &::-webkit-scrollbar{display:none} whitespace-nowrap">
              {navGroups.map((group) => {
                const isActive = isGroupActive(pathname, group);
                const GroupIcon = group.icon;
                return (
                  <Link key={group.href} href={group.href} className="relative block shrink-0 w-full md:w-auto">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all relative z-10 cursor-pointer w-full justify-start whitespace-nowrap",
                      isActive
                        ? "text-primary dark:text-[#EFE9E1]"
                        : "text-slate-500 hover:text-primary dark:text-[#CDBCAB]/80 dark:hover:text-[#EFE9E1]"
                    )}>
                      <GroupIcon className={cn(
                        "w-3.5 h-3.5 transition-colors shrink-0",
                        isActive ? "text-primary dark:text-primary" : "text-slate-400 dark:text-[#CDBCAB]/60"
                      )} />
                      <span className="truncate">{group.label}</span>

                      {isActive && (
                        <motion.div
                          layoutId="active-accounting-nav-group"
                          className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl shadow-sm -z-10"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {activeGroup.items.length > 1 && (
            <nav className="hidden md:flex items-center gap-1.5 border-t border-primary/15 dark:border-[#3E3A35]/50 pt-3">
              {activeGroup.items.map((item) => {
                const isActive = isRouteActive(pathname, item.href);
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                      isActive
                        ? "text-primary dark:text-[#EFE9E1]"
                        : "text-slate-400 hover:text-primary dark:text-[#CDBCAB]/60 dark:hover:text-[#EFE9E1]"
                    )}
                  >
                    <ItemIcon className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      isActive ? "text-primary dark:text-primary" : "text-slate-400 dark:text-[#CDBCAB]/60"
                    )} />
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="active-accounting-nav-item"
                          className="absolute inset-0 rounded-lg bg-primary/10 -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Main content body container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full min-w-0 relative z-10">
        {children}
      </main>
    </div>
  );
}
