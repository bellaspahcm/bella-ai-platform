'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Calendar,
  Layers,
  ClipboardList,
  FileText,
  CreditCard,
  Wrench,
  Building2,
  ShieldCheck,
  Award,
  BarChart3,
  Settings,
  UserCheck,
  ShieldAlert,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useUser } from '@/lib/user-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'QUẢN LÝ DỰ ÁN',
    items: [
      { label: 'Danh sách dự án', href: '/dashboard/interior#projects', icon: FolderKanban },
      { label: 'Khách hàng', href: '/dashboard/interior/customers', icon: Users },
      { label: 'Lịch công việc', href: '/dashboard/interior/schedule', icon: Calendar },
    ],
  },
  {
    title: 'THIẾT KẾ & THƯƠNG MẠI',
    items: [
      { label: 'Design Studio', href: '/dashboard/interior/design', icon: Layers },
      { label: 'BOQ & Dự toán', href: '/dashboard/interior/boq', icon: ClipboardList },
      { label: 'Báo giá & Hợp đồng', href: '/dashboard/interior/contracts', icon: FileText },
      { label: 'Thanh toán', href: '/dashboard/interior/finance', icon: CreditCard },
    ],
  },
  {
    title: 'SẢN XUẤT & THI CÔNG',
    items: [
      { label: 'Sản xuất xưởng', href: '/dashboard/interior/production', icon: Wrench },
      { label: 'Thi công lắp đặt', href: '/dashboard/interior/installation', icon: Building2 },
      { label: 'QC & Nghiệm thu', href: '/dashboard/interior/qc-handover', icon: ShieldCheck },
      { label: 'Bảo hành', href: '/dashboard/interior/warranty', icon: Award },
    ],
  },
  {
    title: 'QUẢN TRỊ',
    items: [
      { label: 'Báo cáo', href: '/dashboard/interior/finance', icon: BarChart3 },
      { label: 'Cài đặt', href: '/dashboard/interior/settings', icon: Settings },
      { label: 'Tài khoản người dùng', href: '/dashboard/interior/users', icon: UserCheck },
      { label: 'Vai trò và quyền hạn', href: '/dashboard/interior/roles', icon: ShieldAlert },
    ],
  },
];

export default function InteriorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('theme-change'));
  };

  const handleLogout = () => {
    document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    import('@/lib/supabase-client')
      .then((m) => {
        const s = m.getSupabase();
        s.auth.signOut().finally(() => {
          window.location.href = '/login';
        });
      })
      .catch(() => {
        window.location.href = '/login';
      });
  };

  function isItemActive(href: string): boolean {
    if (href === '/dashboard/interior' || href === '/dashboard/interior#projects') {
      return pathname === '/dashboard/interior';
    }
    return pathname.startsWith(href);
  }

  const userName = (user && 'full_name' in user && typeof user.full_name === 'string' && user.full_name) ? user.full_name : 'Nguyễn Thị Mai';
  const userRole = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Project Manager';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden antialiased">
      {/* ─── SIDEBAR (Desktop & Mobile Drawer) ─────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 px-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <Link href="/dashboard/interior" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 flex items-center justify-center text-white shadow-md shadow-amber-950/20 font-black text-xl tracking-tight transition-transform group-hover:scale-105">
              B
            </div>
            <div>
              <p className="font-extrabold text-[15px] tracking-tight leading-tight text-slate-900 dark:text-white uppercase">
                Bella Interior
              </p>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
                Project Management Suite
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {/* Overview Link */}
          <div>
            <Link
              href="/dashboard/interior"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                pathname === '/dashboard/interior'
                  ? 'bg-[#1B365D] text-white shadow-sm dark:bg-blue-600'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${pathname === '/dashboard/interior' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>Tổng quan</span>
            </Link>
          </div>

          {/* Nav Groups */}
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3.5 text-[10px] font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const active = isItemActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        active
                          ? 'bg-[#1B365D] text-white shadow-sm font-semibold dark:bg-blue-600'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mini Promo Card */}
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[12px] font-bold text-amber-900 dark:text-amber-300">Bella Interior OS</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/90">Build Better Spaces</p>
            </div>
            <Link
              href="/dashboard/interior#projects"
              className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
              title="Khám phá"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </nav>

        {/* Profile Card & Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white dark:ring-slate-800 flex-shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {userRole}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ─── MAIN CONTENT VIEWPORT ────────────────────────────────────── */}
      <div className="flex-1 md:pl-64 xl:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Global Header Bar */}
        <header className="h-16 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 z-20">
          {/* Mobile hamburger + Search input */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search Box with Ctrl+K */}
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm dự án, khách hàng, công việc... (Ctrl + K)"
                className="w-full pl-9 pr-16 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all shadow-2xs"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/70 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-colors"
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              aria-label="Đổi giao diện"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/70 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-colors relative"
                aria-label="Thông báo"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              </button>
            </div>

            {/* User Mini Avatar Header */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-slate-800 shadow-2xs">
                {userName.charAt(0)}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {userName}
                </p>
                <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {userRole}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Children Page */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {children}
        </main>
      </div>
    </div>
  );
}
