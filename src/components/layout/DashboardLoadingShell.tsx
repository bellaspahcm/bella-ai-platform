'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { useUser } from '@/lib/user-context';
import { applyDashboardProductBrand, resetDashboardPresentation, resolveDashboardPresentation } from '@/lib/business-rules/product-presentation-routing';

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200/60 dark:bg-slate-800/45 ${className}`} />;
}

export function DashboardRouteLoading() {
  return (
    <div className="flex-1 bg-background/30 p-4 sm:p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <PulseBlock className="h-9 w-56 rounded-2xl" />
          <PulseBlock className="h-4 w-72 max-w-full rounded-full" />
        </div>
        <div className="flex flex-wrap gap-3">
          <PulseBlock className="h-12 w-36 rounded-2xl" />
          <PulseBlock className="h-12 w-44 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-[2rem] border border-white/50 bg-white/55 p-6 shadow-sm dark:border-white/5 dark:bg-slate-900/45">
            <PulseBlock className="mb-8 h-12 w-12 rounded-2xl" />
            <PulseBlock className="mb-3 h-4 w-32 rounded-full" />
            <PulseBlock className="h-8 w-20 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-[2.5rem] border border-white/50 bg-white/55 p-6 shadow-sm dark:border-white/5 dark:bg-slate-900/45">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="space-y-3">
              <PulseBlock className="h-7 w-64 max-w-full rounded-2xl" />
              <PulseBlock className="h-4 w-48 max-w-full rounded-full" />
            </div>
            <PulseBlock className="hidden h-12 w-32 rounded-2xl sm:block" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <PulseBlock key={item} className="h-24 rounded-[2rem]" />
            ))}
          </div>
        </div>
        <div className="rounded-[2.5rem] border border-white/50 bg-white/55 p-6 shadow-sm dark:border-white/5 dark:bg-slate-900/45">
          <PulseBlock className="mb-8 h-7 w-40 rounded-2xl" />
          <PulseBlock className="h-64 rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
}

export function DashboardAuthLoadingShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-[243px] shrink-0 border-r border-slate-200/50 bg-[#FAFAFA] p-5 lg:block">
        <div className="mx-auto mb-8 h-20 w-20 animate-pulse rounded-[2rem] bg-primary/10" />
        <div className="mb-10 space-y-3">
          <PulseBlock className="mx-auto h-8 w-44 rounded-2xl" />
          <PulseBlock className="mx-auto h-3 w-32 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <PulseBlock key={item} className="h-12 rounded-2xl" />
          ))}
        </div>
      </div>
      <main className="flex min-w-0 flex-1 flex-col pt-16 lg:pt-0">
        <DashboardRouteLoading />
      </main>
    </div>
  );
}

import { useState, useEffect, useLayoutEffect } from 'react';

export function DashboardAuthorizedShell({ children }: { children: React.ReactNode }) {
  const { isLoading, user, tenantSettings, product } = useUser();
  const presentation = tenantSettings ? resolveDashboardPresentation(tenantSettings, product) : null;
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const presentation = tenantSettings ? resolveDashboardPresentation(tenantSettings, product) : null;
    if (isLoading || !user || !tenantSettings || user.tenant_id !== tenantSettings.id || !presentation) {
      resetDashboardPresentation();
      return;
    }
    applyDashboardProductBrand(presentation.brand);
  }, [isLoading, user, tenantSettings, product]);

  useEffect(() => {
    setMounted(true);
    const searchParams = new URLSearchParams(window.location.search);
    const embedded = searchParams.get('embedded') === 'true';
    setIsEmbedded(embedded);

    if (embedded && typeof window !== 'undefined' && window.parent !== window) {
      const sendHeight = () => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage({ type: 'resize-iframe', height }, '*');
      };

      sendHeight();
      const handle = requestAnimationFrame(sendHeight);
      const observer = new ResizeObserver(sendHeight);
      observer.observe(document.body);

      return () => {
        cancelAnimationFrame(handle);
        observer.disconnect();
      };
    }
  }, []);

  if (!mounted || isLoading) {
    return <DashboardAuthLoadingShell />;
  }

  if (!user || !tenantSettings || user.tenant_id !== tenantSettings.id || !presentation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground" role="alert">
        Không thể xác định cấu hình sản phẩm của chi nhánh. Vui lòng tải lại trang.
      </main>
    );
  }

  if (isEmbedded) {
    return (
      <main className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-auto bg-transparent">
        {children}
      </main>
    );
  }

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="dashboard-main beauty-erp-content flex-1 flex flex-col min-w-0 pt-16 lg:pt-0 max-w-full overflow-y-auto overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
