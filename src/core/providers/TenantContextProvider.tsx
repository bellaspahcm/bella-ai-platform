'use client';

import { useEffect, useState, ReactNode } from 'react';
import { isTenantContext, type TenantContext } from '@/core/types/tenant';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import { resolveCanonicalTenantBrand, applyCanonicalTenantTheme } from '@/lib/business-rules/tenant-modules';

/**
 * Error message displayed when tenant configuration fails to load.
 */
const TENANT_LOAD_ERROR_MESSAGE = 'Không thể tải cấu hình chi nhánh. Vui lòng thử lại sau.';

/**
 * Loading message displayed while tenant configuration is being fetched.
 */
const TENANT_LOADING_MESSAGE = 'Đang tải cấu hình chi nhánh...';

/**
 * Provider component that loads tenant configuration and makes it available
 * to all child components via useTenantContext() hook.
 * 
 * @remarks
 * This provider should wrap the entire application in the root layout.
 * It fetches tenant configuration from the `/api/tenant/context` endpoint
 * on mount and handles loading and error states.
 * 
 * **Loading State**: Displays a loading message while fetching tenant data.
 * 
 * **Error State**: Displays an error message if tenant fetch fails.
 * Users cannot proceed without valid tenant context.
 * 
 * **Success State**: Once loaded, tenant context is available to all
 * child components via useTenantContext() hook.
 * 
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function RootLayout({ children }: { children: ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <TenantContextProvider>
 *           {children}
 *         </TenantContextProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * @param props - Component props
 * @param props.children - Child components that will have access to tenant context
 */
export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    applyCanonicalTenantTheme(null);
    async function load() {
      try {
        const response = await fetch('/api/tenant/context', {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        });
        if (!response.ok) throw new Error(TENANT_LOAD_ERROR_MESSAGE);
        const value: unknown = await response.json();
        if (!isTenantContext(value) || !value.settings || Array.isArray(value.settings)) {
          throw new Error(TENANT_LOAD_ERROR_MESSAGE);
        }
        if (active) setContext(value);
      } catch (err: unknown) {
        if (active) {
          setContext(null);
          setError(err instanceof Error ? err.message : TENANT_LOAD_ERROR_MESSAGE);
          applyCanonicalTenantTheme(null);
        }
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!context) return;
    applyCanonicalTenantTheme(resolveCanonicalTenantBrand({
      tenantId: context.tenantId, productKey: context.settings.productKey,
      enabledModules: context.enabledModules, brandTheme: context.settings.brandTheme,
      logoUrl: typeof context.settings.logoUrl === 'string' ? context.settings.logoUrl : null,
      tenantName: context.tenantName, surface: 'app',
    }));
  }, [context]);

  // Show loading state while fetching tenant configuration
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{TENANT_LOADING_MESSAGE}</p>
        </div>
      </div>
    );
  }

  // Show error state if tenant configuration failed to load
  if (error || !context) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <svg 
            className="w-12 h-12 text-red-500 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Lỗi tải cấu hình
          </h2>
          <p className="text-red-600 mb-4">
            {error || TENANT_LOAD_ERROR_MESSAGE}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Provide tenant context to all child components
  return (
    <TenantContextContext.Provider value={context}>
      {children}
    </TenantContextContext.Provider>
  );
}
