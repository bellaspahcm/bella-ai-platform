'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, CheckCircle2, Lightbulb, Search, X, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { getDashboardWidgetAlerts } from '@/components/common/dashboard-widget-actions';
import type { DashboardAlert } from '@/core/services/analytics/dashboard-actions';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '@/core/services/notification/notification-actions';
import { createClient } from '@/lib/supabase-client';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';

type AdminNotificationBellProps = {
  position?: 'top' | 'bottom';
  className?: string;
};

type PopoverPlacement = 'top' | 'bottom' | 'inset';

// Unique identifier helper for alerts (dynamic & static)
const getAlertKey = (alert: DashboardAlert) => {
  if (alert.isAppNotification && alert.id) return alert.id;
  return `${alert.type}_${alert.title}_${alert.timestamp}_${alert.link || ''}`;
};

export default function AdminNotificationBell({ position = 'bottom', className }: AdminNotificationBellProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAllNotificationsOpen, setIsAllNotificationsOpen] = useState(false);
  
  // Coordinates for Portal positioning
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number }>({ 
    top: 0, 
    left: 0, 
    width: 0, 
    height: 0 
  });

  // States for All Notifications Modal
  const [notifSearch, setNotifSearch] = useState('');
  const [notifTab, setNotifTab] = useState('all');

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getDashboardWidgetAlerts();
      setAlerts(data || []);
    } catch (error) {
      console.warn('Dashboard alerts are temporarily unavailable in bell component:', error);
      setAlerts([]);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchAlerts();
    }, 500);
  }, [fetchAlerts]);

  // Recalculate dimensions for floating portal dropdown
  const updateCoords = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }
  }, []);

  const handleBellToggle = useCallback(() => {
    updateCoords();
    setIsOpen((current) => !current);
    requestAnimationFrame(updateCoords);
  }, [updateCoords]);

  useEffect(() => {
    setIsMounted(true);
    
    // Load dismissed alerts from localStorage
    try {
      const saved = localStorage.getItem('bella_dismissed_alerts');
      if (saved) {
        setDismissedKeys(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse dismissed alerts keys:', e);
    }

    void fetchAlerts();

    // Setup realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('admin-bell-realtime-' + Math.random().toString(36).substring(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => {
        scheduleRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts, scheduleRefresh]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords]);

  const handleMarkAllRead = async () => {
    try {
      // 1. Save all current alerts keys into dismissed keys to clear local UI count
      const allKeys = alerts.map(getAlertKey);
      const updatedDismissed = Array.from(new Set([...dismissedKeys, ...allKeys]));
      setDismissedKeys(updatedDismissed);
      localStorage.setItem('bella_dismissed_alerts', JSON.stringify(updatedDismissed));

      // 2. Fire backend marking for static notifications
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        toast.success('Đã đánh dấu tất cả là đã đọc');
        void fetchAlerts();
      } else {
        toast.error(result.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Có lỗi xảy ra khi xử lý');
    }
  };

  const handleNotificationClick = async (alert: DashboardAlert) => {
    // 1. Mark as read locally immediately
    const key = getAlertKey(alert);
    if (!dismissedKeys.includes(key)) {
      const updatedDismissed = [...dismissedKeys, key];
      setDismissedKeys(updatedDismissed);
      localStorage.setItem('bella_dismissed_alerts', JSON.stringify(updatedDismissed));
    }

    // 2. Mark static notifications on backend
    if (alert.isAppNotification && alert.id) {
      const result = await markNotificationAsRead(alert.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
    }

    // 3. Navigate
    if (alert.link) {
      router.push(alert.link);
      setIsOpen(false);
      setIsAllNotificationsOpen(false);
    }
  };

  if (!isMounted) return null;

  // Active alerts are alerts not marked as read (dismissed)
  const activeAlerts = alerts.filter(alert => !dismissedKeys.includes(getAlertKey(alert)));
  const unreadCount = activeAlerts.length;
  const hasUnread = unreadCount > 0;

  // Compute portal positioning inline styles dynamically
  const getPopoverLayout = (): { styles: React.CSSProperties; placement: PopoverPlacement } => {
    if (typeof window === 'undefined') {
      return { styles: {}, placement: position };
    }

    const isMobile = window.innerWidth < 768;
    const popoverWidth = 512; // Wider & taller PC popover width (32rem)
    const spacing = 8;
    const viewportPadding = 16;
    const maxViewportHeight = isMobile ? window.innerHeight * 0.72 : window.innerHeight * 0.7;
    const belowTop = coords.top + coords.height + spacing;
    const belowAvailable = Math.max(0, window.innerHeight - belowTop - viewportPadding);
    const aboveBottom = window.innerHeight - coords.top + spacing;
    const aboveAvailable = Math.max(0, coords.top - spacing - viewportPadding);
    const shouldOpenAbove = position === 'top' || (position === 'bottom' && belowAvailable < 280 && aboveAvailable > belowAvailable);
    const maxHeight = Math.min(maxViewportHeight, shouldOpenAbove ? aboveAvailable : belowAvailable);
    const needsInsetLayout = maxHeight < 320;

    if (needsInsetLayout) {
      return {
        placement: 'inset',
        styles: {
          position: 'fixed',
          top: `${viewportPadding}px`,
          bottom: `${viewportPadding}px`,
          left: isMobile ? `${viewportPadding}px` : `${Math.max(viewportPadding, Math.min(coords.left + coords.width - popoverWidth, window.innerWidth - popoverWidth - viewportPadding))}px`,
          right: isMobile ? `${viewportPadding}px` : undefined,
          width: isMobile ? 'auto' : `${popoverWidth}px`,
          maxHeight: `${Math.max(0, window.innerHeight - viewportPadding * 2)}px`,
          transformOrigin: 'top right',
          zIndex: 9999,
        },
      };
    }
    
    if (isMobile) {
      return {
        placement: shouldOpenAbove ? 'top' : 'bottom',
        styles: {
          position: 'fixed',
          left: '16px',
          right: '16px',
          width: 'auto',
          maxHeight: `${maxHeight}px`,
          transformOrigin: shouldOpenAbove ? 'bottom right' : 'top right',
          zIndex: 9999,
          ...(shouldOpenAbove
            ? { bottom: `${aboveBottom}px` }
            : { top: `${belowTop}px` })
        },
      };
    }
    
    const preferredLeft = coords.left + coords.width - popoverWidth;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding);
    const clampedLeft = Math.min(Math.max(viewportPadding, preferredLeft), maxLeft);
    const bottomTop = coords.top + coords.height + spacing;
    const topBottom = window.innerHeight - coords.top + spacing;

    return {
      placement: shouldOpenAbove ? 'top' : 'bottom',
      styles: {
        position: 'fixed',
        width: `${popoverWidth}px`,
        maxHeight: `${maxHeight}px`,
        transformOrigin: shouldOpenAbove ? 'bottom right' : 'top right',
        zIndex: 9999,
        ...(shouldOpenAbove
          ? {
              bottom: `${topBottom}px`,
              left: `${clampedLeft}px`,
            }
          : {
              top: `${bottomTop}px`,
              left: `${clampedLeft}px`,
            })
      },
    };
  };

  const popoverLayout = isOpen
    ? getPopoverLayout()
    : { styles: {}, placement: position as PopoverPlacement };
  const popoverAnimationY = popoverLayout.placement === 'top' ? -15 : 15;

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        ref={buttonRef}
        onClick={handleBellToggle}
        aria-label="Thông báo hệ thống"
        title="Cảnh báo hệ thống & bảo mật toàn sàn"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 relative z-10 ${
          isOpen
            ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200'
            : hasUnread
              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-md shadow-rose-100/50'
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
        }`}
      >
        {hasUnread && !isOpen && (
          <span className="absolute inset-0 rounded-xl bg-rose-400/30 animate-ping pointer-events-none" />
        )}

        <Bell className={`pointer-events-none w-5 h-5 ${hasUnread && !isOpen ? 'animate-bounce text-rose-600' : ''}`} />

        {hasUnread && (
          <span className="pointer-events-none absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse z-20">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Render Dropdown using Portals to prevent sidebar clipping overflow-hidden bugs */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: popoverAnimationY, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: popoverAnimationY, scale: 0.95 }}
            style={popoverLayout.styles}
            onClick={(event) => event.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 md:p-6 overflow-hidden origin-top flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black uppercase tracking-widest text-xs md:text-sm text-slate-900">Thông báo</h3>
                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-black rounded-full uppercase">
                  {unreadCount} Mới
                </span>
              </div>
              {hasUnread && (
                <button 
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-wider"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>
            
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleNotificationClick(alert)}
                    className={`p-3.5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left ${
                      alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200' :
                      alert.type === 'success' ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200' :
                      'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                        alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {alert.icon === 'alert' ? <AlertTriangle className="w-5 h-5" /> :
                         alert.icon === 'checkCircle' ? <CheckCircle2 className="w-5 h-5" /> :
                         <Lightbulb className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-extrabold text-xs md:text-sm text-slate-900 truncate">{alert.title}</h4>
                          {alert.timestamp && alert.timestamp > 0 && (
                            <span className="text-[9px] text-slate-400 shrink-0 font-bold italic">
                              {new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium line-clamp-3">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center">
                  <span className="text-3xl mb-3 block">🎉</span>
                  <p className="text-slate-400 font-bold text-xs italic">Tuyệt vời! Không có thông báo mới nào chưa đọc</p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsAllNotificationsOpen(true);
              }}
              className="w-full mt-4 py-3 text-[11px] font-black uppercase text-rose-600 hover:bg-rose-50 rounded-2xl border border-rose-200 hover:border-rose-300 transition-all tracking-widest text-center shrink-0"
            >
              Xem tất cả thông báo
            </button>
          </motion.div>
        </>,
        document.body
      )}

      {/* Xem tất cả thông báo Modal - Standalone Portal Component */}
      {isMounted && createPortal(
        <AllNotificationsModal
          isOpen={isAllNotificationsOpen}
          onClose={() => setIsAllNotificationsOpen(false)}
          alerts={alerts}
          dismissedKeys={dismissedKeys}
          hasUnread={hasUnread}
          notifSearch={notifSearch}
          setNotifSearch={setNotifSearch}
          notifTab={notifTab}
          setNotifTab={setNotifTab}
          handleMarkAllRead={handleMarkAllRead}
          handleNotificationClick={handleNotificationClick}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Standalone Modal Component (avoids AnimatePresence+Portal conflict) ───────
type AllNotificationsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  alerts: import('@/core/services/analytics/dashboard-actions').DashboardAlert[];
  dismissedKeys: string[];
  hasUnread: boolean;
  notifSearch: string;
  setNotifSearch: (v: string) => void;
  notifTab: string;
  setNotifTab: (v: string) => void;
  handleMarkAllRead: () => void;
  handleNotificationClick: (alert: import('@/core/services/analytics/dashboard-actions').DashboardAlert) => void;
};

function AllNotificationsModal({
  isOpen,
  onClose,
  alerts,
  dismissedKeys,
  hasUnread,
  notifSearch,
  setNotifSearch,
  notifTab,
  setNotifTab,
  handleMarkAllRead,
  handleNotificationClick,
}: AllNotificationsModalProps) {
  const [visible, setVisible] = React.useState(false);
  const { tenantModuleKey } = useTenantModuleKey();

  const tabs = React.useMemo(() => {
    if (tenantModuleKey === 'real_estate') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'success', label: 'Phân phối Lead' },
        { id: 'warning', label: 'Quá hạn SLA' },
        { id: 'info', label: 'Tin tức / Khác' },
      ];
    }
    if (tenantModuleKey === 'industrial_cleaning') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'success', label: 'Hoàn thành ca' },
        { id: 'warning', label: 'Ca trễ giờ' },
        { id: 'info', label: 'Yêu cầu / Khác' },
      ];
    }
    return [
      { id: 'all', label: 'Tất cả' },
      { id: 'success', label: 'Hoàn thành ca' },
      { id: 'warning', label: 'Buổi quá hạn' },
      { id: 'info', label: 'Gói sắp hết / Khác' },
    ];
  }, [tenantModuleKey]);

  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = (alert.title + ' ' + alert.message).toLowerCase().includes(notifSearch.toLowerCase());
    const matchesTab = notifTab === 'all' || alert.type === notifTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ transition: 'opacity 200ms ease', opacity: visible ? 1 : 0 }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-md"
      />

      {/* Modal Panel */}
      <div
        className="bg-white rounded-[2.5rem] shadow-2xl border border-pink-100 p-6 md:p-8 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative z-10"
        style={{
          transition: 'opacity 200ms ease, transform 200ms ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-inner">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Tất cả thông báo</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Tìm kiếm và đối soát nhanh các sự kiện</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1.5 text-xs font-black uppercase text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-200 transition-all active:scale-95"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Đánh dấu tất cả đã đọc</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Tabs */}
        <div className="space-y-4 mb-6 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung thông báo..."
              value={notifSearch}
              onChange={(e) => setNotifSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-rose-50 focus:border-rose-300 outline-none transition-all font-medium text-sm text-slate-800"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setNotifTab(tab.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 border ${
                  notifTab === tab.id
                    ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200'
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification list (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4 pb-2">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert, idx) => {
              const isRead = dismissedKeys.includes(getAlertKey(alert));
              return (
                <div
                  key={idx}
                  onClick={() => handleNotificationClick(alert)}
                  className={`p-5 rounded-3xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex gap-4 hover:shadow-md ${
                    isRead
                      ? 'opacity-60 bg-slate-50/30 border-slate-100 hover:border-slate-200/50'
                      : alert.type === 'warning' ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200'
                      : alert.type === 'success' ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
                      : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    isRead ? 'bg-slate-100 text-slate-400'
                      : alert.type === 'warning' ? 'bg-amber-100 text-amber-600'
                      : alert.type === 'success' ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {alert.icon === 'alert' ? <AlertTriangle className="w-6 h-6" /> :
                     alert.icon === 'checkCircle' ? <CheckCircle2 className="w-6 h-6" /> :
                     <Lightbulb className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm md:text-base text-slate-900 truncate">{alert.title}</h4>
                        {isRead && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-bold rounded-md">Đã đọc</span>
                        )}
                      </div>
                      {alert.timestamp && alert.timestamp > 0 && (
                        <span className="text-[11px] text-slate-400 shrink-0 font-bold italic">
                          {new Date(alert.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(alert.timestamp).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-semibold">{alert.message}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center">
              <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4 animate-bounce" />
              <p className="text-slate-400 font-extrabold italic text-sm">Không tìm thấy thông báo nào</p>
              <p className="text-slate-300 text-xs mt-1">Vui lòng thay đổi từ khóa hoặc bộ lọc</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
