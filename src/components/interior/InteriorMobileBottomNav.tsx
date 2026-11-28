'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Calendar,
  Sparkles,
  Layers,
  ClipboardList,
  FileText,
  CircleDollarSign,
  Wrench,
  Package,
  Building2,
  Smartphone,
  ShieldCheck,
  Award,
  BarChart3,
  Wallet,
  Settings,
  LayoutGrid,
  X,
  Download,
  ExternalLink,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useOptionalUser } from '@/lib/user-context';
import { cn } from '@/lib/utils';
import {
  INTERIOR_ROLE_CHANGE_EVENT,
  getInteriorRoleDisplayName,
  getSimulatedInteriorRole,
  normalizeInteriorRoleKey,
  type InteriorRoleKey,
} from '@/products/bella-interior/lib/interior-rbac-navigation';
import {
  getInteriorBottomNavItems,
  getInteriorLaunchpadItems,
  isInteriorMobileShellPath,
  type InteriorPwaCapabilityFlags,
  type InteriorPwaModuleCategory,
  type InteriorPwaNavItem,
} from '@/products/bella-interior/lib/interior-pwa-navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface SelfAccessSummaryResponse {
  success?: boolean;
  data?: {
    primaryRoleKey?: InteriorRoleKey | null;
    directGrants?: Array<{ id: string }>;
    delegations?: Array<{ id: string }>;
    capabilities?: InteriorPwaCapabilityFlags;
  };
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  projects: FolderKanban,
  customers: Users,
  schedule: Calendar,
  'ai-copilot': Sparkles,
  design: Layers,
  boq: ClipboardList,
  contracts: FileText,
  finance: CircleDollarSign,
  production: Wrench,
  inventory: Package,
  installation: Building2,
  'site-diary': Smartphone,
  'qc-handover': ShieldCheck,
  warranty: Award,
  reports: BarChart3,
  accounting: Wallet,
  roles: Users,
  settings: Settings,
};

const CATEGORY_LABELS: Record<InteriorPwaModuleCategory, string> = {
  operations: 'Điều hành & Dự án',
  design_commercial: 'Thiết kế & Thương mại',
  production_site: 'Xưởng & Công trường',
  finance_admin: 'Tài chính & Quản trị',
};

const CATEGORY_ORDER: readonly InteriorPwaModuleCategory[] = [
  'production_site',
  'operations',
  'design_commercial',
  'finance_admin',
];

function isModuleActive(pathname: string, href: string): boolean {
  const cleanHref = href.split('?')[0];
  if (cleanHref === '/dashboard/interior') {
    return pathname === '/dashboard/interior';
  }
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

export default function InteriorMobileBottomNav() {
  const pathname = usePathname() ?? '';
  const userContext = useOptionalUser();
  const user = userContext?.user;
  const productKey = userContext?.product?.productKey ?? null;

  const isVisible = isInteriorMobileShellPath(pathname, productKey);

  const [simulatedRole, setSimulatedRoleState] = useState<InteriorRoleKey | null>(null);
  const [serverPrimaryRole, setServerPrimaryRole] = useState<InteriorRoleKey | null>(null);
  const [capabilities, setCapabilities] = useState<InteriorPwaCapabilityFlags | null>(null);
  const [grantsCount, setGrantsCount] = useState<number>(0);
  const [isLauncherOpen, setIsLauncherOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const loadSelfAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/interior/me/access', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as SelfAccessSummaryResponse;
      if (json.success && json.data) {
        setServerPrimaryRole(json.data.primaryRoleKey ?? null);
        setCapabilities(json.data.capabilities ?? null);
        setGrantsCount(
          (json.data.directGrants?.length ?? 0) + (json.data.delegations?.length ?? 0),
        );
      }
    } catch {
      // Keep graceful fallback to session/navigation role
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    setSimulatedRoleState(getSimulatedInteriorRole());
    void loadSelfAccess();

    const handleRoleEvent = (e: Event) => {
      const evt = e as CustomEvent<{ role?: InteriorRoleKey | null }>;
      setSimulatedRoleState(evt.detail?.role ?? getSimulatedInteriorRole());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bella_interior_simulated_role') {
        setSimulatedRoleState(getSimulatedInteriorRole());
      }
    };

    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleEvent);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener(INTERIOR_ROLE_CHANGE_EVENT, handleRoleEvent);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isVisible, loadSelfAccess]);

  useEffect(() => {
    setIsLauncherOpen(false);
  }, [pathname]);

  if (!isVisible) return null;

  const effectiveRole: InteriorRoleKey | null =
    simulatedRole
    ?? serverPrimaryRole
    ?? normalizeInteriorRoleKey(user?.role ?? null);

  // When simulating a role, omit personal server grants so the simulated UI reflects the simulated role cleanly.
  const effectiveCapabilities = simulatedRole ? null : capabilities;
  const primaryTabs = getInteriorBottomNavItems(effectiveRole, effectiveCapabilities);
  const allModules = getInteriorLaunchpadItems(effectiveRole, effectiveCapabilities);
  const canOpenStandaloneSitePwa = allModules.some((item) => item.id === 'site-diary');
  const roleLabel = effectiveRole ? getInteriorRoleDisplayName(effectiveRole) : 'Bella Interior';

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const renderIcon = (moduleId: string, className: string) => {
    const IconComponent = MODULE_ICONS[moduleId] ?? LayoutDashboard;
    return <IconComponent className={className} />;
  };

  return (
    <>
      {/* ── Mobile & Tablet Bottom App Navigation (lg:hidden) ── */}
      <nav
        aria-label="Điều hướng PWA Bella Interior"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-5 h-16 max-w-xl mx-auto px-1">
          {primaryTabs.map((item) => {
            const active = isModuleActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 rounded-xl transition-all active:scale-95',
                  active
                    ? 'text-emerald-700 dark:text-amber-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                )}
              >
                {active && (
                  <span className="absolute top-1 w-6 h-1 rounded-full bg-emerald-600 dark:bg-amber-400" />
                )}
                <div className="relative">
                  {renderIcon(item.id, cn('w-5 h-5', active && 'scale-105'))}
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-3 text-[8px] font-black px-1 py-0.2 rounded bg-emerald-600 text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight truncate max-w-full">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsLauncherOpen(true)}
            aria-expanded={isLauncherOpen}
            aria-label="Mở tất cả phân hệ Bella Interior"
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 rounded-xl transition-all active:scale-95',
              isLauncherOpen
                ? 'text-emerald-700 dark:text-amber-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Phân hệ</span>
          </button>
        </div>
      </nav>

      {/* ── Slide-Up PWA App Launcher Sheet ── */}
      {isLauncherOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trình khởi chạy phân hệ Bella Interior PWA"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setIsLauncherOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle & Header */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      Bella Interior OS PWA
                    </h2>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        isOnline
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
                      )}
                    >
                      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Vai trò: <strong className="text-slate-800 dark:text-slate-200">{roleLabel}</strong>
                    {simulatedRole ? ' (Đang mô phỏng)' : ''}
                    {!simulatedRole && grantsCount > 0 ? ` • +${grantsCount} ủy quyền riêng` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLauncherOpen(false)}
                  aria-label="Đóng menu phân hệ"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5">
              {/* Highlighted Standalone Field App & Install PWA Strip */}
              {(canOpenStandaloneSitePwa || installPrompt) && (
                <div className="grid grid-cols-1 gap-2">
                  {canOpenStandaloneSitePwa && (
                    <Link
                      href="/site-pwa"
                      onClick={() => setIsLauncherOpen(false)}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm active:scale-[0.99] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">Chế độ Hiện trường Độc lập (/site-pwa)</p>
                          <p className="text-[11px] text-emerald-100 truncate">
                            Ghi nhật ký, chụp ảnh R2, kiểm tra QC 1 chạm
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 shrink-0 text-emerald-100" />
                    </Link>
                  )}

                  {installPrompt && (
                    <button
                      type="button"
                      onClick={() => void handleInstallApp()}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Download className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold truncate">
                          Cài đặt Bella Interior App lên màn hình chính
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500 text-white shrink-0">
                        Cài ngay
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Grouped Allowed Modules Grid */}
              {CATEGORY_ORDER.map((category) => {
                const items = allModules.filter((item) => item.category === category);
                if (items.length === 0) return null;
                return (
                  <section key={category} aria-label={CATEGORY_LABELS[category]}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((item: InteriorPwaNavItem) => {
                        const active = isModuleActive(pathname, item.href);
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsLauncherOpen(false)}
                            className={cn(
                              'relative flex flex-col items-center justify-center text-center gap-1.5 p-3 rounded-2xl border min-h-[76px] transition active:scale-95',
                              active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-amber-300 shadow-2xs'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:border-emerald-400',
                            )}
                          >
                            {item.badge && (
                              <span className="absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white leading-none">
                                {item.badge}
                              </span>
                            )}
                            {renderIcon(
                              item.id,
                              cn(
                                'w-5 h-5',
                                active ? 'text-emerald-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300',
                              ),
                            )}
                            <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                              {item.shortLabel}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
