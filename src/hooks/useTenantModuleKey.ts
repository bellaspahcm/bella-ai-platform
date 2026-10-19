'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { type TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { resolveProductPresentationModule } from '@/lib/business-rules/product-presentation-routing';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { productResolver } from '@/platform/registry/product-resolver';

export function useTenantModuleKey(_options?: { forceFresh?: boolean }) {
  // Storage cannot prove the authenticated tenant. All callers start neutral.
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null);
  const [isTenantModuleLoading, setIsTenantModuleLoading] = useState(true);
  const [tenantModuleError, setTenantModuleError] = useState<string | null>(null);
  const resolvedIdentity = useRef<{ tenantId: string; moduleKey: TenantModuleKey } | null>(null);
  const requestVersion = useRef(0);

  const refreshTenantModuleKey = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsTenantModuleLoading(resolvedIdentity.current === null);
    setTenantModuleError(null);

    try {
      const user = await getCachedCurrentUser();
      if (version !== requestVersion.current) return;
      if (!user?.tenant_id || (resolvedIdentity.current && resolvedIdentity.current.tenantId !== user.tenant_id)) {
        resolvedIdentity.current = null;
        setTenantModuleKey(null);
        setIsTenantModuleLoading(true);
      }
      const tenant = await getCachedTenantSettings();
      if (version !== requestVersion.current) return;
      const resolved = tenant ? productResolver.tryResolve({ id: tenant.id, product_key: tenant.product_key ?? null }) : undefined;
      if (!tenant || !user?.tenant_id || tenant.id !== user.tenant_id || !resolved) {
        throw new Error('Không thể xác định sản phẩm của chi nhánh');
      }
      const moduleKey = resolveProductPresentationModule(resolved.product, tenant.enabled_modules);
      if (!moduleKey) {
        throw new Error('Chưa có cấu hình phân hệ hiển thị của chi nhánh');
      }
      resolvedIdentity.current = { tenantId: tenant.id, moduleKey };
      setTenantModuleKey(moduleKey);
    } catch (error) {
      if (version !== requestVersion.current) return;
      const message = error instanceof Error ? error.message : 'Không thể tải cấu hình phân hệ';
      resolvedIdentity.current = null;
      setTenantModuleError(message);
      setTenantModuleKey(null);
    } finally {
      if (version === requestVersion.current) setIsTenantModuleLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTenantModuleKey();
    return () => { requestVersion.current += 1; };
  }, [refreshTenantModuleKey]);

  return {
    tenantModuleKey,
    isTenantModuleLoading,
    tenantModuleError,
    refreshTenantModuleKey,
  };
}
