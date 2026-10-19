'use client';

import { useEffect, useState, ReactNode } from 'react';
import type { TenantContext } from '@/core/types/tenant';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import { isModuleId } from '@/core/types/module';

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
function getDevFallbackContext(): TenantContext {
  let moduleKey: TenantContext['enabledModules'][number] = 'beauty_spa';
  let name = 'Executive HQ (Dev)';

  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/hq')) {
      moduleKey = 'beauty_spa';
      name = 'Executive HQ (Dev)';
    } else if (path.startsWith('/dashboard/real-estate')) {
      moduleKey = 'real_estate';
      name = 'Bella Land (Dev)';
    } else if (path.startsWith('/dashboard/bella-auto')) {
      moduleKey = 'bella_auto';
      name = 'Bella Auto (Dev)';
    } else if (path.startsWith('/dashboard/hospital')) {
      moduleKey = 'bella_healthcare';
      name = 'Bella General Hospital (Dev)';
    } else if (path.startsWith('/dashboard/medical') || path.startsWith('/dashboard/healthcare') || path.startsWith('/dashboard/dental')) {
      moduleKey = 'bella_healthcare';
      name = 'Bella Medical Clinic (Dev)';
    }
  }

  return {
    tenantId: 'dev-tenant',
    tenantName: name,
    enabledModules: [moduleKey, 'bella_healthcare', 'bella_auto', 'real_estate', 'beauty_spa', 'cleaning'],
    subscriptionPlan: 'enterprise',
    featureFlags: {},
    settings: {},
  };
}

export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTenantContext() {
      const isHqRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/hq');
      const allowNonProductionFallback = process.env.NODE_ENV !== 'production';

      // For HQ portal in non-production mode, immediately apply HQ fallback context so UI never hangs.
      if (isHqRoute && allowNonProductionFallback) {
        console.info('[TenantContextProvider] Instant HQ fallback activated for /hq route');
        setContext(getDevFallbackContext());
        setLoading(false);
        return;
      }

      const controller = allowNonProductionFallback ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => {
            controller.abort();
          }, 2000)
        : null;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/tenant/context', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          ...(controller ? { signal: controller.signal } : {}),
        });

        if (timeoutId) clearTimeout(timeoutId);

        // 1. If 401 Unauthorized, redirect to login page gracefully
        if (response.status === 401) {
          // In non-production, use dev fallback context instead of redirecting.
          if (allowNonProductionFallback) {
            console.info('[TenantContextProvider] Dev mode / HQ route: Using fallback tenant context');
            if (isMounted) {
              setContext(getDevFallbackContext());
              setLoading(false);
            }
            return;
          }
          
          // Production: redirect to login
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
          const msg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

          // In non-production, fallback to default tenant context.
          if (allowNonProductionFallback) {
            console.info('[TenantContextProvider] Dev fallback tenant context activated due to:', msg);
            if (isMounted) {
              setContext(getDevFallbackContext());
              setLoading(false);
            }
            return;
          }

          throw new Error(msg);
        }

        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid tenant context response format');
        }

        if (isMounted) {
          setContext(data as TenantContext);
        }
      } catch (err: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        if (allowNonProductionFallback) {
          console.info('[TenantContextProvider] Fallback context activated on error/timeout:', errorMessage);
          if (isMounted) {
            setContext(getDevFallbackContext());
          }
        } else {
          if (isMounted) {
            setError(errorMessage);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTenantContext();

    return () => {
      isMounted = false;
    };
  }, []);

  // Apply tenant module theme to <html> element when context loads
  useEffect(() => {
    if (!context) return;
    // Dashboard branding is resolved from the authenticated UserProvider tenant.
    // This module/context provider must not overwrite that product identity.
    const path = window.location.pathname;
    if (path === '/dashboard' || path.startsWith('/dashboard/')) return;

    const enabledModules: unknown = context.enabledModules;
    let moduleKey: string = 'baby_care'; // Default fallback

    let modulesArray: string[] = [];
    
    if (Array.isArray(enabledModules)) {
      modulesArray = enabledModules.filter(isModuleId);
    } else if (typeof enabledModules === 'object' && enabledModules !== null) {
      const hasNumericKeys = Object.keys(enabledModules).some(key => /^\d+$/.test(key));
      
      if (hasNumericKeys) {
        modulesArray = Object.values(enabledModules).filter((v): v is string => typeof v === 'string');
      } else {
        const modules = enabledModules as Record<string, unknown>;
        
        if (modules.real_estate === true) {
          moduleKey = 'real_estate';
        } else if (modules.industrial_cleaning === true) {
          moduleKey = 'industrial_cleaning';
        } else if (modules.beauty_spa === true) {
          moduleKey = 'beauty_spa';
        } else if (modules.bella_auto === true) {
          moduleKey = 'bella_auto';
        } else if (modules.bella_healthcare === true) {
          moduleKey = 'bella_healthcare';
        } else if (modules.babycare === true || modules.spa === true) {
          moduleKey = 'baby_care';
        }
        
        document.documentElement.dataset.tenantModule = moduleKey;
        return;
      }
    }
    
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/hospital')) {
        moduleKey = 'bella_healthcare';
      } else if (path.startsWith('/dashboard/medical') || path.startsWith('/dashboard/healthcare') || path.startsWith('/dashboard/dental')) {
        moduleKey = 'bella_healthcare';
      } else if (path.startsWith('/dashboard/real-estate')) {
        moduleKey = 'real_estate';
      } else if (path.startsWith('/dashboard/bella-auto')) {
        moduleKey = 'bella_auto';
      } else if (modulesArray.length > 0) {
        if (modulesArray.includes('bella_healthcare')) {
          moduleKey = 'bella_healthcare';
        } else if (modulesArray.includes('real_estate')) {
          moduleKey = 'real_estate';
        } else if (modulesArray.includes('industrial_cleaning')) {
          moduleKey = 'industrial_cleaning';
        } else if (modulesArray.includes('beauty_spa')) {
          moduleKey = 'beauty_spa';
        } else if (modulesArray.includes('bella_auto')) {
          moduleKey = 'bella_auto';
        } else if (modulesArray.includes('babycare') || modulesArray.includes('spa')) {
          moduleKey = 'baby_care';
        }
      }
    }

    document.documentElement.dataset.tenantModule = moduleKey;
    console.log('[TenantContextProvider] ✅ Applied module theme:', moduleKey);
    console.log('[TenantContextProvider] ✅ HTML data-tenant-module:', document.documentElement.dataset.tenantModule);

    // Update theme-color meta tag
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const themeColors: Record<string, string> = {
        baby_care: '#FDF2F8',
        beauty_spa: '#F0FDF4',
        industrial_cleaning: '#F8FAFC',
        real_estate: '#FFFBEB',
        bella_auto: '#F0F9FF',
        bella_healthcare: '#ECFEFF',
      };
      themeMeta.setAttribute('content', themeColors[moduleKey] || themeColors.baby_care);
    }
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
