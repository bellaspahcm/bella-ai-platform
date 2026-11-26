'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  User,
  ShieldCheck,
  Settings,
  LogOut,
  FolderKanban,
  Users,
  CheckCheck,
  Clock,
  Sparkles,
  ExternalLink,
  Eye,
  Check,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useOptionalUser } from '@/lib/user-context';
import { clearDashboardClientContextCache } from '@/lib/dashboard-client-context';
import {
  INTERIOR_ROLES,
  getInteriorRoleDisplayName,
  getSimulatedInteriorRole,
  setSimulatedInteriorRole,
  INTERIOR_ROLE_CHANGE_EVENT,
  type InteriorRoleKey,
} from '@/products/bella-interior/lib/interior-rbac-navigation';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: 'site' | 'commercial' | 'schedule';
  categoryLabel: string;
  badgeClass: string;
  timestamp: string;
  href: string;
  isRead: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Kiểm tra thi công E2E: Villa Sunrise',
    description: 'Cần xác nhận nhật ký công trường & nghiệm thu giai đoạn 2',
    category: 'site',
    categoryLabel: 'Công trường',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    timestamp: '15 phút trước',
    href: '/dashboard/interior/schedule',
    isRead: false,
  },
  {
    id: 'notif-2',
    title: 'Báo giá đề xuất: Shophouse Aqua City Riverside',
    description: 'Dự toán BOQ & hồ sơ bóc tách khối lượng đã sẵn sàng gửi khách hàng',
    category: 'commercial',
    categoryLabel: 'BOQ & Dự toán',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    timestamp: '1 giờ trước',
    href: '/dashboard/interior/boq',
    isRead: false,
  },
  {
    id: 'notif-3',
    title: 'Khảo sát công trình: Villa Saroma Sala',
    description: 'Lịch hẹn tư vấn & đo đạc hiện trạng lúc 09:00 sáng Thứ Ba',
    category: 'schedule',
    categoryLabel: 'Lịch hẹn',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    timestamp: '3 giờ trước',
    href: '/dashboard/interior/schedule',
    isRead: false,
  },
];

const INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY = 'bella_interior_read_notifications_v1';

interface InteriorUserBarProps {
  className?: string;
  align?: 'left' | 'right';
}

export default function InteriorUserBar({ className = '', align = 'right' }: InteriorUserBarProps) {
  const router = useRouter();
  const userContext = useOptionalUser();
  const currentUser = userContext?.user;

  // Real auth state
  const [sessionEmail, setSessionEmail] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionRole, setSessionRole] = useState<string>('');

  // Dropdown states
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [simulatedRole, setSimulatedRoleState] = useState<InteriorRoleKey | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSimulatedRoleState(getSimulatedInteriorRole());
    const handleRoleChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ role: InteriorRoleKey | null }>;
      setSimulatedRoleState(customEvt.detail?.role ?? null);
    };
    window.addEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
    return () => window.removeEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleChange);
  }, []);

  // Load current user from session / context
  useEffect(() => {
    async function loadAuth() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const authUser = data?.session?.user;
        if (authUser) {
          setSessionEmail(authUser.email || '');
          const metadata = authUser.user_metadata || {};
          const name = metadata.full_name || metadata.name || authUser.email?.split('@')[0] || '';
          setSessionName(name);
          setSessionRole(metadata.role || 'Quản trị viên');
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadAuth();
  }, []);

  // Compute final display values
  const displayName =
    currentUser?.full_name ||
    sessionName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '') ||
    (sessionEmail ? sessionEmail.split('@')[0] : '') ||
    'Quản trị viên';

  const displayEmail = currentUser?.email || sessionEmail || 'admin@bellaspa.vn';

  const roleRaw = currentUser?.role || sessionRole || 'admin';
  const displayRole = simulatedRole
    ? `${getInteriorRoleDisplayName(simulatedRole)} (Mô phỏng)`
    : getInteriorRoleDisplayName(roleRaw);

  // Compute avatar initials
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'AD';

  // Unread notifications count
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Hydrate read notification IDs from localStorage on mount (preserves read status across F5)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const readIds: string[] = JSON.parse(stored);
        if (Array.isArray(readIds) && readIds.length > 0) {
          const readSet = new Set(readIds);
          setNotifications((prev) =>
            prev.map((n) => ({
              ...n,
              isRead: readSet.has(n.id),
            }))
          );
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const allRead = prev.map((n) => ({ ...n, isRead: true }));
      try {
        const allIds = allRead.map((n) => n.id);
        localStorage.setItem(INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(allIds));
      } catch {
        // Ignore localStorage write errors
      }
      return allRead;
    });
  }, []);

  const handleResetNotifications = useCallback(() => {
    try {
      localStorage.removeItem(INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    setNotifications(DEFAULT_NOTIFICATIONS);
  }, []);

  const handleNotificationClick = (id: string, href: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      try {
        const stored = localStorage.getItem(INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY);
        const readIds: string[] = stored ? JSON.parse(stored) : [];
        if (!readIds.includes(id)) {
          readIds.push(id);
          localStorage.setItem(INTERIOR_READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(readIds));
        }
      } catch {
        // Ignore localStorage write errors
      }
      return updated;
    });
    setIsNotifOpen(false);
    router.push(href);
  };

  // Close menus on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (roleSwitcherRef.current && !roleSwitcherRef.current.contains(event.target as Node)) {
        setIsRoleSwitcherOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNotifOpen(false);
        setIsUserMenuOpen(false);
        setIsRoleSwitcherOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Logout handler
  const handleLogout = async () => {
    try {
      clearDashboardClientContextCache();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      {/* ─── 00. ROLE SWITCHER (RBAC SIMULATOR) ─── */}
      <div className="relative" ref={roleSwitcherRef}>
        <button
          type="button"
          onClick={() => {
            setIsRoleSwitcherOpen((prev) => !prev);
            setIsNotifOpen(false);
            setIsUserMenuOpen(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-xs transition-all cursor-pointer font-medium ${
            simulatedRole
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Chuyển đổi góc nhìn vai trò (RBAC Simulator)"
        >
          <Eye className={`w-3.5 h-3.5 ${simulatedRole ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <span className="font-bold text-xs whitespace-nowrap">
            {simulatedRole ? `Góc nhìn: ${getInteriorRoleDisplayName(simulatedRole)}` : 'Góc nhìn vai trò'}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isRoleSwitcherOpen ? 'rotate-180' : ''}`} />
        </button>

        {isRoleSwitcherOpen && (
          <div
            className={`absolute mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {/* Header */}
            <div className="p-3.5 px-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">
                  Mô phỏng góc nhìn RBAC
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Xem trước menu và giao diện thực tế từng vai trò
                </span>
              </div>
              {simulatedRole && (
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedInteriorRole(null);
                    setIsRoleSwitcherOpen(false);
                  }}
                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại
                </button>
              )}
            </div>

            {/* Roles List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
              {INTERIOR_ROLES.map((r) => {
                const isSelected = simulatedRole ? simulatedRole === r.roleKey : (r.roleKey === 'OWNER' || r.roleKey === 'ADMIN');
                return (
                  <button
                    key={r.roleKey}
                    type="button"
                    onClick={() => {
                      if (r.roleKey === 'OWNER' || r.roleKey === 'ADMIN') {
                        setSimulatedInteriorRole(null);
                      } else {
                        setSimulatedInteriorRole(r.roleKey);
                      }
                      setIsRoleSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                          {r.displayName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {r.badgeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {r.shortDesc}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-2.5 px-3 bg-slate-50/60 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Đang chọn: <strong>{simulatedRole ? getInteriorRoleDisplayName(simulatedRole) : 'Toàn quyền (Admin)'}</strong></span>
              {simulatedRole && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Đang mô phỏng</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 01. NOTIFICATION BELL WITH INTERACTIVE POPOVER ─── */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => {
            setIsNotifOpen((prev) => !prev);
            setIsUserMenuOpen(false);
            setIsRoleSwitcherOpen(false);
          }}
          className={`relative p-2 rounded-xl border transition-colors cursor-pointer ${
            isNotifOpen
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          aria-label="Thông báo điều hành"
          title="Thông báo điều hành"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {isNotifOpen && (
          <div
            className={`absolute mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {/* Popover Header */}
            <div className="p-3.5 px-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  Thông báo điều hành
                </span>
                {unreadCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">
                    {unreadCount} mới
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px]">
                    Đã đọc hết
                  </span>
                )}
              </div>

              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Đánh dấu đã đọc
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetNotifications}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Đặt lại trạng thái chưa đọc để kiểm tra"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại chưa đọc
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item.id, item.href)}
                  className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-start gap-3 ${
                    !item.isRead ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        !item.isRead ? 'bg-blue-500' : 'bg-transparent'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeClass}`}
                      >
                        {item.categoryLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {item.timestamp}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1 line-clamp-1">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Popover Footer */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-center">
              <Link
                href="/dashboard/interior/schedule"
                onClick={() => setIsNotifOpen(false)}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Xem lịch làm việc &amp; công việc cần chú ý</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ─── 02. USER PROFILE DROPDOWN ─── */}
      <div className="relative" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsUserMenuOpen((prev) => !prev);
            setIsNotifOpen(false);
            setIsRoleSwitcherOpen(false);
          }}
          className={`flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl border transition-colors cursor-pointer ${
            isUserMenuOpen
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80'
          }`}
          aria-label="Menu tài khoản người dùng"
        >
          {/* Avatar Initials Badge (Clean SVG, No Broken Images) */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {initials}
          </div>

          <div className="hidden sm:block text-left">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 block max-w-[140px] truncate leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight">
              {displayRole}
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              isUserMenuOpen ? 'rotate-180 text-amber-600' : ''
            }`}
          />
        </button>

        {isUserMenuOpen && (
          <div
            className={`absolute mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {/* User Details Header */}
            <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {displayEmail}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold border border-amber-200/80 dark:border-amber-900/60">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {displayRole}
                </span>
                <span className="text-[10px] text-slate-400">Bella Interior OS</span>
              </div>
            </div>

            {/* Navigation Shortcuts */}
            <div className="py-1">
              <Link
                href="/dashboard/interior/roles"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phân quyền &amp; Vai trò</span>
              </Link>

              <Link
                href="/dashboard/interior/projects"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <FolderKanban className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Danh mục dự án</span>
              </Link>

              <Link
                href="/dashboard/interior/customers"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Khách hàng CRM</span>
              </Link>

              <Link
                href="/dashboard/interior/settings"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span>Cài đặt hệ thống</span>
              </Link>
            </div>

            {/* Logout Action */}
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left font-medium"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
