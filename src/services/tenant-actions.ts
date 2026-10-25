'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getAuthorizedTenantUser } from '@/core/services/auth';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';
import type { Database, Json } from '@/types/database.types';
import {
  getDefaultTenantModuleKey,
  toTenantBrandThemeJson,
  toTenantBrandThemeJsonForModule,
  toTenantModuleJson,
  type TenantBrandTheme,
  type TenantEnabledModules,
} from '@/lib/business-rules/tenant-modules';

type TenantRow = Database['public']['Tables']['tenants']['Row'];
export type TenantPresentation = Pick<TenantRow,
  'id' | 'name' | 'status' | 'product_key' | 'enabled_modules' | 'brand_theme' | 'logo_url'>;
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type TenantSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TENANT_SETTINGS_ADMIN_ROLES = ['admin', 'super_admin'] as const;
const TENANT_SETTINGS_TENANT_ERROR = 'Không xác định được chi nhánh của người dùng';
const TENANT_SETTINGS_FORBIDDEN_ERROR = 'Không có quyền cập nhật cấu hình chi nhánh.';
const TENANT_MODULE_CONFIG_FORBIDDEN_ERROR = 'Module ngành được cấu hình khi setup tenant, admin tenant không thể tự chuyển đổi.';

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

function getAdminTenantClient() {
  const serviceRoleKey = getSupabaseAdminKey();
  const supabaseUrl = getSupabaseAdminUrl();
  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey);
}

async function fetchTenantSnapshot(
  supabase: TenantSupabaseClient,
  tenantId: string,
): Promise<{ data: TenantRow | null; error: string | null }> {
  let { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if ((error || !data) && getSupabaseAdminKey()) {
    const supabaseAdmin = getAdminTenantClient();
    if (supabaseAdmin) {
      const adminRes = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      data = adminRes.data;
      error = adminRes.error;
    }
  }

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: 'Tenant not found' };
  }

  return { data: data as TenantRow, error: null };
}

function mapTenantSettingsRollbackPayload(snapshot: TenantRow): TenantUpdate {
  return {
    name: snapshot.name,
    contact_phone: snapshot.contact_phone,
    email: snapshot.email,
    address: snapshot.address,
    logo_url: snapshot.logo_url,
    enabled_modules: snapshot.enabled_modules,
    brand_theme: snapshot.brand_theme,
    qr_bank_code: snapshot.qr_bank_code,
    qr_account_number: snapshot.qr_account_number,
    qr_account_name: snapshot.qr_account_name,
    salary_config: snapshot.salary_config,
    commission_config: snapshot.commission_config,
    role_permissions: snapshot.role_permissions,
    updated_at: snapshot.updated_at,
  };
}

async function rollbackTenantSettings(
  supabase: TenantSupabaseClient,
  tenantId: string,
  snapshot: TenantRow,
) {
  const { error } = await supabase
    .from('tenants')
    .update(mapTenantSettingsRollbackPayload(snapshot))
    .eq('id', tenantId);

  return error?.message || '';
}

// Read-only dashboard identity; never a full settings row or an authority source.
export async function getTenantPresentation(): Promise<TenantPresentation | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('tenants')
    .select('id, name, status, product_key, enabled_modules, brand_theme, logo_url')
    .eq('id', currentUser.tenant_id).single();
  if (error || !data || data.id !== currentUser.tenant_id || data.status !== 'active') return null;
  return data;
}

export async function getTenantSettings(): Promise<TenantRow | null> {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;

    if (!tenantId) {
      console.warn('[getTenantSettings] Không có tenantId cho người dùng hiện tại');
      return null;
    }

    if (tenantId === '77777777-7777-7777-7777-777777777777' || tenantId === 'tenant-medical-dev-id') {
      return {
        id: '77777777-7777-7777-7777-777777777777',
        name: 'Bella Medical Clinic',
        contact_phone: '0908 123 456',
        email: 'admin@medical.vn',
        address: '123 Nguyễn Thị Minh Khai, Q1, TP.HCM',
        logo_url: '',
        enabled_modules: { bella_healthcare: true } as unknown as Json,
        brand_theme: { primaryColor: '#074E44', brandName: 'Bella Medical Clinic' } as unknown as Json,
        qr_bank_code: null,
        qr_account_number: null,
        qr_account_name: null,
        salary_config: null,
        commission_config: null,
        role_permissions: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      } as TenantRow;
    }

    try {
      const { getCache, setCache, CacheKeys, CacheTTL } = await import('@/lib/redis-cache');
      const cached = await getCache<TenantRow>(CacheKeys.tenant(tenantId));
      if (cached) {
        return cached;
      }
    } catch (cacheErr) {
      console.warn('[getTenantSettings] Redis cache bypass:', cacheErr);
    }

    const { data, error } = await fetchTenantSnapshot(supabase, tenantId);
    if (error || !data) {
      console.warn(`[getTenantSettings] Failed to load tenant settings: ${error || 'Tenant not found'}`);
      return null;
    }

    try {
      const { setCache, CacheKeys, CacheTTL } = await import('@/lib/redis-cache');
      void setCache(CacheKeys.tenant(tenantId), data, CacheTTL.long);
    } catch {}

    return data;
  } catch (error) {
    console.error('[getTenantSettings] Exception:', error);
    return null;
  }
}

export async function saveTenantSettings(settings: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  enabled_modules?: TenantEnabledModules;
  brand_theme?: TenantBrandTheme;
  qr_bank_code?: string;
  qr_account_number?: string;
  qr_account_name?: string;
  salary_config?: Json;
  commission_config?: Json;
  role_permissions?: Json;
}) {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TENANT_SETTINGS_ADMIN_ROLES,
    errorMessage: TENANT_SETTINGS_TENANT_ERROR,
  });
  if (!auth.ok) {
    return {
      success: false,
      error: auth.reason === 'FORBIDDEN' ? TENANT_SETTINGS_FORBIDDEN_ERROR : auth.error,
    };
  }
  if (settings.enabled_modules !== undefined && auth.user.role !== 'super_admin') {
    return { success: false, error: TENANT_MODULE_CONFIG_FORBIDDEN_ERROR };
  }

  const supabase = await createClient();
  const tenantId = auth.tenantId;

  try {
    const { data: oldSettings, error: snapshotError } = await fetchTenantSnapshot(supabase, tenantId);
    if (snapshotError || !oldSettings) {
      return {
        success: false,
        error: `Failed to snapshot tenant settings: ${snapshotError || 'Tenant not found'}`,
      };
    }

    const updatePayload: TenantUpdate = { updated_at: new Date().toISOString() };
    if (settings.name !== undefined) updatePayload.name = settings.name;
    if (settings.phone !== undefined) updatePayload.contact_phone = settings.phone;
    if (settings.email !== undefined) updatePayload.email = settings.email;
    if (settings.address !== undefined) updatePayload.address = settings.address;
    if (settings.logo_url !== undefined) updatePayload.logo_url = settings.logo_url.trim();
    if (settings.enabled_modules !== undefined) {
      updatePayload.enabled_modules = toTenantModuleJson(settings.enabled_modules);
    }
    if (settings.brand_theme !== undefined) {
      const moduleKey = getDefaultTenantModuleKey(settings.enabled_modules ?? oldSettings.enabled_modules);
      updatePayload.brand_theme = toTenantBrandThemeJsonForModule(settings.brand_theme, moduleKey);
    }
    if (settings.qr_bank_code !== undefined) updatePayload.qr_bank_code = settings.qr_bank_code;
    if (settings.qr_account_number !== undefined) updatePayload.qr_account_number = settings.qr_account_number;
    if (settings.qr_account_name !== undefined) updatePayload.qr_account_name = settings.qr_account_name;
    if (settings.salary_config !== undefined) updatePayload.salary_config = settings.salary_config;
    if (settings.commission_config !== undefined) updatePayload.commission_config = settings.commission_config;
    if (settings.role_permissions !== undefined) updatePayload.role_permissions = settings.role_permissions;

    let { data, error } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenantId)
      .select();

    if ((!data || data.length === 0) && getSupabaseAdminKey()) {
      console.warn('Update returned 0 rows with auth client, trying with admin client...');
      const supabaseAdmin = getAdminTenantClient();
      if (!supabaseAdmin) {
        return { success: false, error: 'Không thể tạo Supabase admin client để cập nhật cấu hình chi nhánh.' };
      }
      
      const adminRes = await supabaseAdmin
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenantId)
        .select();
        
      data = adminRes.data;
      error = adminRes.error;
    }

    if (error) {
      console.error('Error updating tenant settings:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error('Update returned 0 rows for tenant_id:', tenantId);
      return { success: false, error: 'Không thể cập nhật cấu hình, chi nhánh không tồn tại hoặc bị chặn bởi quyền truy cập.' };
    }

    const updatedTenant = data[0];

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'tenants',
        record_id: tenantId,
        old_data: oldSettings,
        new_data: updatedTenant
      });
    } catch (auditError: unknown) {
      const rollbackError = await rollbackTenantSettings(supabase, tenantId, oldSettings);
      const rollbackNote = rollbackError ? `; rollback failed: ${rollbackError}` : '';
      return {
        success: false,
        error: `Failed to record tenant settings audit log: ${getErrorMessage(auditError)}${rollbackNote}`,
      };
    }

    revalidatePath('/dashboard/settings');
    
    // Invalidate tenant cache
    const { deleteCache, CacheKeys } = await import('@/lib/redis-cache');
    void deleteCache(CacheKeys.tenant(tenantId));
    
    return { success: true, data: updatedTenant };
  } catch (error: unknown) {
    console.error('Exception saving tenant settings:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
