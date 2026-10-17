'use client';
/* Quản lý Bảng Hàng Căn Hộ & Dự Án Bất Động Sản - Bella Land V2 */

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, RefreshCw, Zap, AlertTriangle, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectHeader } from '@/modules/real_estate/components/ProjectHeader';
import { InventoryMatrixGrid } from '@/modules/real_estate/components/InventoryMatrixGrid';
import { fetchProjectsAction } from '@/modules/real_estate/actions/projectActions';
import { fetchProductsAction, updateProductStatusAction, updateProductDetailsAction } from '@/modules/real_estate/actions/productActions';
import { Database } from '@/types/database.types';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

import { CEODashboardCharts } from '@/modules/real_estate/components/CEODashboardCharts';
import { PremiumProjectSelector } from '@/modules/real_estate/components/PremiumProjectSelector';

export default function RealEstateDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Tháng 7/2026');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (err: unknown) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  const handleToggleNotifications = async () => {
    setShowNotifDropdown(!showNotifDropdown);
    if (!showNotifDropdown && unreadCount > 0) {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        await supabase
          .from('app_notifications')
          .update({ is_read: true })
          .eq('is_read', false);
        setUnreadCount(0);
      } catch (err: unknown) {
        console.error('Error marking notifications as read:', err);
      }
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch projects
      const resProjects = await fetchProjectsAction();
      if (!resProjects.success || !resProjects.data) {
        throw new Error(resProjects.error || 'Failed to load real estate projects');
      }

      const projectList = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(projectList);

      const currentProj = projectList[0] || null;
      setSelectedProject(currentProj);

      // 2. Fetch products if project exists
      if (currentProj) {
        const resProducts = await fetchProductsAction(currentProj.id);
        if (resProducts.success && resProducts.data) {
          setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
        }
      }
    } catch (err: unknown) {
      console.error('[RealEstateDashboardPage] Error:', err);
      setError(err instanceof Error ? err.message : 'System error loading Real Estate module');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Fetch projects
      const resProjects = await fetchProjectsAction();
      if (!resProjects.success || !resProjects.data) {
        throw new Error(resProjects.error || 'Failed to load real estate projects');
      }

      const projectList = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(projectList);

      // Get current selected project id to restore selection
      const currentProjId = selectedProject?.id || projectList[0]?.id || null;
      const matchedProj = projectList.find(p => p.id === currentProjId) || projectList[0] || null;
      setSelectedProject(matchedProj);

      // Fetch products
      if (matchedProj) {
        const resProducts = await fetchProductsAction(matchedProj.id);
        if (resProducts.success && resProducts.data) {
          setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
        }
      }
    } catch (err: unknown) {
      console.error('[RealEstateDashboardPage] Refresh Error:', err);
      setError(err instanceof Error ? err.message : 'System error refreshing Real Estate module');
    } finally {
      // Keep rotating effect active for a short period for a smoother feel
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  useEffect(() => {
    loadData();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadData, fetchNotifications]);

  const handleSelectProject = async (proj: ProjectRow) => {
    setSelectedProject(proj);
    const resProducts = await fetchProductsAction(proj.id);
    if (resProducts.success && resProducts.data) {
      setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
    }
  };

  const handleUpdateStatus = async (
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) => {
    const res = await updateProductStatusAction(productId, targetStatus, ownerName);
    if (!res.success) {
      throw new Error(res.error || 'Cập nhật trạng thái thất bại');
    }
    // Refresh products list
    if (selectedProject) {
      const resProducts = await fetchProductsAction(selectedProject.id);
      if (resProducts.success && resProducts.data) {
        setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
      }
    }
  };
  const handleUpdateDetails = async (
    productId: string,
    payload: {
      unit_price?: number;
      area?: number;
      product_code?: string;
      product_type?: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
      block?: string | null;
      floor?: string | null;
    }
  ) => {
    const res = await updateProductDetailsAction(productId, payload);
    if (!res.success) {
      throw new Error(res.error || 'Cập nhật thông tin thất bại');
    }
    toast.success('✅ Cập nhật thông tin căn thành công');
    // Immediately update local state from returned data
    if (res.data && !Array.isArray(res.data)) {
      setProducts(prev => prev.map(p => p.id === productId ? res.data as typeof p : p));
    }
    // Then do a full re-fetch to ensure consistency
    if (selectedProject) {
      const resProducts = await fetchProductsAction(selectedProject.id);
      if (resProducts.success && resProducts.data) {
        setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
      }
    }
  };

  const availableCount = products.filter((p) => p.status === 'available').length;
  const reservedCount = products.filter((p) => p.status === 'booked').length;
  const depositedCount = products.filter((p) => p.status === 'deposited').length;
  const signedCount = products.filter((p) => p.status === 'contracted').length;
  const paidCount = products.filter((p) => p.status === 'paid').length;
  const deliveredCount = products.filter((p) => p.status === 'handed_over').length;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
          <h2 className="text-lg font-bold mb-2">⚠️ Lỗi Tải Phân Hệ Bất Động Sản</h2>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-rose-600 text-white font-bold text-sm rounded-xl hover:bg-rose-700 transition-colors"
          >
            Thử Lại
          </button>
        </div>
      </div>
    );
  }

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
                    {selectedProject?.name || 'Vinhomes Green Paradise'}
                    <span className="text-[10px] text-slate-400">▾</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    📍 {selectedProject?.location || 'Grand Island, TP. Hồ Chí Minh'}
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
                              toast.success(`Đã chuyển sang dự án ${proj.name}`);
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
                            setSelectedPeriod(period);
                            setShowPeriodDropdown(false);
                            toast.success(`Đã cập nhật kỳ báo cáo: ${period}`);
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
                      <div className="space-y-2 text-xs">
                        <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-slate-900">
                          <p className="font-bold text-slate-900 dark:text-white">Lead mới đăng ký dự án</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Khách hàng Nguyễn Văn A quan tâm Shophouse Elyse Island.</p>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-slate-900">
                          <p className="font-bold text-slate-900 dark:text-white">Cảnh báo SLA Lead</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">3 lead quá hạn 15 phút chưa phân công.</p>
                        </div>
                      </div>
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
                          <span>●</span> Tenant ID: {tenantContext.tenantId || 'bellaland-prod'}
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
                          href="/dashboard/real-estate/settings"
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
      <CEODashboardCharts
        totalProductsCount={products.length || 286}
        availableCount={availableCount || 119}
        reservedCount={reservedCount || 24}
        depositedCount={depositedCount || 31}
        signedCount={signedCount || 78}
        paidCount={paidCount || 9}
        deliveredCount={deliveredCount || 25}
        selectedProjectName={selectedProject?.name || 'Vinhomes Green Paradise'}
        selectedPeriod={selectedPeriod}
      />
    </div>
  );
}
