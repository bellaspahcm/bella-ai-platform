'use client';
/* Quản lý Bảng Hàng Căn Hộ & Dự Án Bất Động Sản - Bella Land V2 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, RefreshCw, Zap, AlertTriangle, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { fetchProjectsAction } from '@/modules/real_estate/actions/projectActions';
import { fetchProductsAction } from '@/modules/real_estate/actions/productActions';
import { Database } from '@/types/database.types';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

import { CEODashboardCharts } from '@/modules/real_estate/components/CEODashboardCharts';

export default function RealEstateDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();

  const requestId = useRef(0);
  const selectedProjectId = useRef<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  type AppNotification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  };

  // States for notifications & dropdowns
  const notificationVersion = useRef(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Tháng 7/2026');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    const version = ++notificationVersion.current;
    try {
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (version !== notificationVersion.current) return;
      if (error) throw new Error("NOTIFICATION_READ_FAILED");
      setNotificationError(null);
      if (data) {
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (err: unknown) {
      if (version === notificationVersion.current) { setNotifications([]); setUnreadCount(0); setNotificationError("Không thể tải thông báo."); }
    }
  }, []);

  const handleToggleNotifications = () => setShowNotifDropdown(open => !open);

  const readProducts = useCallback(async (project: ProjectRow, request: number) => {
    const result = await fetchProductsAction(project.id);
    if (request !== requestId.current) return;
    if (!result.success || !result.data) throw new Error(result.error || 'Không thể tải căn hộ');
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    setProducts(rows.filter(row => row.project_id === project.id));
  }, []);

  const loadData = useCallback(async () => {
    const request = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setProducts([]);
    setSelectedProject(null);
    setProjects([]);
    try {
      const result = await fetchProjectsAction();
      if (request !== requestId.current) return;
      if (!result.success || !result.data) throw new Error(result.error || 'Không thể tải dự án');
      const list = Array.isArray(result.data) ? result.data : [result.data];
      setProjects(list);
      const requestedId = selectedProjectId.current ?? new URLSearchParams(window.location.search).get('projectId');
      const project = requestedId !== null ? list.find(item => item.id === requestedId) : list[0];
      if (requestedId !== null && !project) throw new Error('Dự án không khả dụng trong danh sách được truy cập');
      setSelectedProject(project || null);
      selectedProjectId.current = project?.id ?? null;
      if (project) await readProducts(project, request);
    } catch (err: unknown) {
      if (request === requestId.current) {
        setProducts([]);
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
      }
    } finally {
      if (request === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [readProducts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadData();
  };

  const invalidateReads = useCallback(() => { ++requestId.current; ++notificationVersion.current; }, []);
  useEffect(() => {
    void loadData();
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => { clearInterval(interval); invalidateReads(); };
  }, [loadData, fetchNotifications, invalidateReads]);

  const handleSelectProject = async (candidate: ProjectRow) => {
    const request = ++requestId.current;
    setProducts([]);
    setError(null);
    setIsLoading(true);
    const project = projects.find(item => item.id === candidate.id) || null;
    setSelectedProject(project);
    selectedProjectId.current = project?.id ?? null;
    try {
      if (!project) throw new Error('Dự án không khả dụng trong danh sách được truy cập');
      await readProducts(project, request);
    } catch (err: unknown) {
      if (request === requestId.current) {
        setProducts([]);
        setError(err instanceof Error ? err.message : 'Không thể tải căn hộ');
      }
    } finally {
      if (request === requestId.current) { setIsLoading(false); setIsRefreshing(false); }
    }
  };

  const availableCount = products.filter((p) => p.status === 'available').length;
  const reservedCount = products.filter((p) => p.status === 'booked').length;
  const depositedCount = products.filter((p) => p.status === 'deposited').length;
  const signedCount = products.filter((p) => p.status === 'contracted').length;
  const paidCount = products.filter((p) => p.status === 'paid').length;
  const deliveredCount = products.filter((p) => p.status === 'handed_over').length;

  const monogram = user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. TOP LIGHT EXECUTIVE HEADER BANNER CARD (SHARED WITH PROJECTS PAGE BANNER) */}
      <div className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm min-h-[274px] flex items-center">
        {/* Shared Background Panorama Skyline Photo */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-2xl">
          <img
            src="/images/bella-land-hero-banner.png?v=9"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1477959858617-67f30ac4ce78?auto=format&fit=crop&w=1600&q=80";
            }}
            alt="Skyline Panorama"
            className="w-full h-full object-cover object-[center_50%] opacity-100 dark:opacity-90 rounded-2xl"
          />
        </div>

        <div className="relative z-10 w-full p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Title & Breadcrumbs */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              <span>Bella Land</span>
              <span>›</span>
              <span className="text-slate-900 dark:text-white font-extrabold">Tổng quan</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Tổng quan
            </h1>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
              Toàn cảnh hoạt động kinh doanh bất động sản
            </p>
          </div>

          {/* Right Context Controls & User Badge */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Context Project Selector Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                aria-label="Chọn dự án"
                aria-expanded={showProjectDropdown}
                onClick={() => {
                  setShowProjectDropdown(!showProjectDropdown);
                  setShowPeriodDropdown(false);
                  setShowNotifDropdown(false);
                  setShowUserDropdown(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs hover:border-blue-400 transition-all text-left active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  🏢
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                    {selectedProject?.name || 'Chưa chọn dự án'}
                    <span className="text-[10px] text-slate-400">▾</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    📍 {selectedProject?.location || 'Chưa cập nhật vị trí'}
                  </div>
                </div>
              </button>

              {showProjectDropdown && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowProjectDropdown(false)} />
                  <div className="absolute left-0 mt-2 z-[100] w-72 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 space-y-1">
                    <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn dự án kinh doanh</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full">{projects.length} dự án</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                      {projects.map((proj) => {
                        const isSelected = selectedProject?.id === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              handleSelectProject(proj);
                              setShowProjectDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="truncate">
                              <p className="font-bold text-slate-900 dark:text-white truncate">{proj.name}</p>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">📍 {proj.location || 'Chưa cập nhật vị trí'}</p>
                            </div>
                            {isSelected && <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm ml-2">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Month / Period Picker Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPeriodDropdown(!showPeriodDropdown);
                  setShowProjectDropdown(false);
                  setShowNotifDropdown(false);
                  setShowUserDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 hover:border-amber-400 rounded-xl shadow-2xs text-xs font-extrabold text-slate-800 dark:text-slate-200 transition-all active:scale-[0.98]"
              >
                <span>📅 {selectedPeriod}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {showPeriodDropdown && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowPeriodDropdown(false)} />
                  <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-2 space-y-1">
                    <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                      Kỳ báo cáo kinh doanh
                    </div>
                    {[
                      'Tháng 5/2026',
                      'Tháng 6/2026',
                      'Tháng 7/2026',
                      'Tháng 8/2026',
                      'Quý 3/2026',
                      'Năm 2026'
                    ].map((period) => {
                      const isSelected = selectedPeriod === period;
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => {

                            setShowPeriodDropdown(false);
                            toast.info("Chưa có dữ liệu lịch sử theo kỳ. Đang hiển thị kho căn hiện tại.");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{period}</span>
                          {isSelected && <span className="text-amber-600 font-extrabold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons: Refresh, Notif, User Menu */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                className="p-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs transition-all active:scale-95"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <div className="relative">
                <button
                  onClick={handleToggleNotifications}
                  className="relative p-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs transition-all active:scale-95"
                  title="Thông báo"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>

                {showNotifDropdown && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowNotifDropdown(false)} />
                    <div className="absolute right-0 mt-2 z-50 w-80 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-blue-600" /> Thông báo
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">System</span>
                      </div>
                      <div className="space-y-2 text-xs" aria-label="Danh sách thông báo">{notificationError ? <p role="alert">{notificationError}</p> : notifications.length === 0 ? <p>Chưa có thông báo.</p> : notifications.map(notification => <article key={notification.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900"><h4 className="font-bold">{notification.title}</h4><p>{notification.message}</p><time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString('vi-VN')}</time></article>)}</div>
                    </div>
                  </>
                )}
              </div>

              {/* User Profile Badge Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(!showUserDropdown);
                    setShowProjectDropdown(false);
                    setShowPeriodDropdown(false);
                    setShowNotifDropdown(false);
                  }}
                  className="flex items-center gap-2 pl-2 border-l border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-2.5 py-1 rounded-xl shadow-2xs hover:border-slate-400 transition-all active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {monogram}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      {user?.full_name || 'Quản Lý BĐS Bella Land'}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Quản trị viên
                    </div>
                  </div>
                </button>

                {showUserDropdown && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowUserDropdown(false)} />
                    <div className="absolute right-0 mt-2 z-50 w-64 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2 text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                        <p className="font-extrabold text-slate-900 dark:text-white">{user?.full_name || 'Quản Lý BĐS Bella Land'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user?.email || 'admin@bellaland.vn'}</p>
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md">
                          <span>●</span> Tenant ID: {tenantContext.tenantId || 'Chưa xác định'}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href="/dashboard/real-estate/people"
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          👥 Quản lý Nhân sự & Môi giới
                        </a>
                        <a
                          href="/dashboard/real-estate/admin"
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          ⚙️ Cấu hình hệ thống Bella Land
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            toast.info('Phiên làm việc Quản trị viên đang hoạt động an toàn');
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-rose-50 text-rose-600 rounded-xl font-semibold transition-colors"
                        >
                          🔒 Trạng thái Bảo mật Tenant
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE DASHBOARD CHARTS & PANELS (MATCHING REFERENCE IMAGE 1) */}
      {isLoading ? <p role="status">Đang tải dữ liệu…</p> : error ? <div role="alert">{error}<button onClick={loadData}>Thử Lại</button></div> : !selectedProject ? <p>Chưa có dự án được truy cập.</p> : <>
      {products.length === 0 && <p>Chưa có căn hộ nào được khai báo cho dự án này.</p>}
      <CEODashboardCharts
        units={products}
        selectedProjectId={selectedProject.id}
        totalProductsCount={products.length}
        availableCount={availableCount}
        reservedCount={reservedCount}
        depositedCount={depositedCount}
        signedCount={signedCount}
        paidCount={paidCount}
        deliveredCount={deliveredCount}
        selectedProjectName={selectedProject.name}
        selectedPeriod={selectedPeriod}
      />
      </>}
    </div>
  );
}
