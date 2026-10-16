'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { productResolver } from '@/platform/registry/product-resolver';
import type { ProductDefinition } from '@/platform/registry/product-registry';

type CurrentUserResult = Awaited<ReturnType<typeof getCachedCurrentUser>>;
type TenantSettingsResult = Awaited<ReturnType<typeof getCachedTenantSettings>>;

interface UserContextType {
  user: CurrentUserResult;
  userRole: string | null;
  tenantSettings: TenantSettingsResult;
  product: ProductDefinition | null;
  isLoading: boolean;
  activeBranchId: string | null;
  setActiveBranchId: React.Dispatch<React.SetStateAction<string | null>>;
  isBranchPending: boolean;
  setIsBranchPending: React.Dispatch<React.SetStateAction<boolean>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserResult>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettingsResult>(null);
  const [product, setProduct] = useState<ProductDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [isBranchPending, setIsBranchPending] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, tenantData] = await Promise.all([
          getCachedCurrentUser(),
          getCachedTenantSettings().catch(() => null),
        ]);
        
        setUser(userData);
        if (userData) {
          setUserRole(userData.role?.toLowerCase() || null);
        }
        setTenantSettings(tenantData);

        // Resolve product identity if tenant has product_key
        const productKey = (tenantData as { product_key?: string | null })?.product_key;
        if (productKey && tenantData) {
          const resolved = productResolver.tryResolve({
            id: tenantData.id,
            product_key: productKey
          });
          setProduct(resolved?.product ?? null);
        } else {
          setProduct(null);
        }
      } catch (error) {
        console.error('[UserProvider] Error loading user context data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <UserContext.Provider value={{ user, userRole, tenantSettings, product, isLoading, activeBranchId, setActiveBranchId, isBranchPending, setIsBranchPending }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
