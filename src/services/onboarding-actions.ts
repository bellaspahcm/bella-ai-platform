'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import {
  normalizeTenantBrandThemeForModule,
  toTenantBrandThemeJsonForModule,
  toTenantModuleJson,
  type TenantEnabledModules,
  type TenantPrimaryBusinessModuleKey,
} from '@/lib/business-rules/tenant-modules';
import { productRegistry } from '@/platform/registry/product-registry';
import {
  validateHospitalityTenantProfile,
  type HospitalityTenantProfile,
} from '@/products/bella-hospitality/profile-contract';
import { checkHqAuth } from './hq-actions';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

type AuthUser = { id: string };
type AdminAuthClient = {
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type OrgUnitInsert = Database['public']['Tables']['org_units']['Insert'];
type RegisterTenantBusinessModule = TenantPrimaryBusinessModuleKey | 'hospitality';
type RegisterTenantProductKey =
  | 'bella_babycare'
  | 'bella_spa'
  | 'bella_haircut'
  | 'bella_nail'
  | 'bella_preschool'
  | 'bella_english_center'
  | 'bella_hospitality';

const PRODUCT_HQ_ONLY_ERROR = 'Chỉ Admin HQ mới được setup tenant sản phẩm này.';

const PRODUCT_MODULE_MAP: Record<RegisterTenantProductKey, RegisterTenantBusinessModule> = {
  bella_babycare: 'babycare',
  bella_spa: 'beauty_spa',
  bella_haircut: 'beauty_spa',
  bella_nail: 'beauty_spa',
  bella_preschool: 'bella_education',
  bella_english_center: 'bella_education',
  bella_hospitality: 'hospitality',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi không xác định xảy ra';
}

function formatCleanupNote(label: string, message: string) {
  return message ? `; ${label} failed: ${message}` : '';
}

async function rollbackCreatedAuthUser(
  supabaseAdmin: AdminAuthClient,
  authUserId: string,
) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  return error?.message || '';
}

async function bootstrapDefaultBranchForTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: RegisterTenantInput,
  productKey: RegisterTenantProductKey,
) {
  const defaultBranch: OrgUnitInsert = {
    tenant_id: tenantId,
    unit_type: 'branch',
    name: input.spaName,
    code: 'MAIN',
    is_active: true,
    metadata: {
      source: 'hq_onboarding',
      productKey,
      address: input.address || null,
      phone: input.contactPhone || null,
      email: input.email || null,
    },
  };

  const { error } = await supabase
    .from('org_units')
    .insert(defaultBranch);

  return error?.message || '';
}

export interface RegisterTenantInput {
  spaName: string;
  contactPhone: string;
  address: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
  branchType?: 'owned' | 'franchise';
  businessModule?: RegisterTenantBusinessModule;
  productKey?: RegisterTenantProductKey;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  portalDisplayName?: string;
  invoiceDisplayName?: string;
  hospitality?: {
    profileId?: unknown;
    configuration?: unknown;
  };
}

function normalizeBusinessModule(value: unknown): RegisterTenantBusinessModule {
  if (value === 'hospitality') return 'hospitality';
  if (value === 'bella_education') return 'bella_education';
  return value === 'beauty_spa' ? 'beauty_spa' : 'babycare';
}

function normalizeProductKey(
  productKey: unknown,
  businessModule: unknown,
): RegisterTenantProductKey {
  if (typeof productKey === 'string' && productRegistry.has(productKey)) {
    if (productKey in PRODUCT_MODULE_MAP) {
      return productKey as RegisterTenantProductKey;
    }
  }

  const moduleKey = normalizeBusinessModule(businessModule);
  if (moduleKey === 'beauty_spa') return 'bella_spa';
  if (moduleKey === 'bella_education') return 'bella_preschool';
  if (moduleKey === 'hospitality') return 'bella_hospitality';
  return 'bella_babycare';
}

function getEnabledModulesForBusinessModule(moduleKey: RegisterTenantBusinessModule): TenantEnabledModules {
  return {
    babycare: moduleKey === 'babycare',
    beauty_spa: moduleKey === 'beauty_spa',
    student_training: false,
    industrial_cleaning: false,
    real_estate: false,
    bella_auto: false,
    bella_healthcare: false,
    bella_education: moduleKey === 'bella_education',
  };
}

function toEnabledModulesJsonForBusinessModule(
  moduleKey: RegisterTenantBusinessModule,
): TenantUpdate['enabled_modules'] {
  const modules = getEnabledModulesForBusinessModule(moduleKey);
  return moduleKey === 'hospitality'
    ? { ...modules }
    : toTenantModuleJson(modules);
}

function toHospitalityMetadataJson(profile: HospitalityTenantProfile): TenantUpdate['metadata'] {
  return {
    hospitality: {
      schemaVersion: 1,
      profileId: profile.profileId,
      displayName: profile.displayName,
      description: profile.description,
      capabilities: profile.capabilities,
      configuration: profile.configuration,
    },
  };
}

async function assertProductSetupAllowed(productKey: RegisterTenantProductKey) {
  if (productKey === 'bella_babycare') return null;

  const hqAuth = await checkHqAuth();
  return hqAuth.authorized ? null : PRODUCT_HQ_ONLY_ERROR;
}

/**
 * Registers a new tenant and configures their initial environment.
 * Leverages the database SECURITY DEFINER function onboard_tenant.
 */
export async function registerNewTenant(input: RegisterTenantInput) {
  try {
    // 1. Validate parameters
    if (!input.spaName || !input.adminName || !input.adminEmail) {
      return { success: false, error: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' };
    }
    const productKey = normalizeProductKey(input.productKey, input.businessModule);
    const businessModule = PRODUCT_MODULE_MAP[productKey];
    const productAuthError = await assertProductSetupAllowed(productKey);
    if (productAuthError) {
      return { success: false, error: productAuthError };
    }
    const hospitalityProfileResult = productKey === 'bella_hospitality'
      ? validateHospitalityTenantProfile(
        input.hospitality?.profileId,
        input.hospitality?.configuration,
      )
      : null;
    if (hospitalityProfileResult?.success === false) {
      return { success: false, error: hospitalityProfileResult.error };
    }

    // Provisioning requires the retained privileged client; never fall back to a client RPC or signUp.
    const adminUrl = getSupabaseAdminUrl();
    const serviceRoleKey = getSupabaseAdminKey();
    if (!adminUrl || !serviceRoleKey) {
      return {
        success: false,
        error: 'ONBOARDING_SETUP_UNAVAILABLE: Hệ thống chưa cấu hình kết nối quản trị để tạo tenant.',
      };
    }

    const password = input.adminPassword || 'Password123!';
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createSupabaseClient<Database>(adminUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: input.adminEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: input.adminName,
      },
    });

    if (adminError) {
      console.error('[registerNewTenant] Admin auth signup failed:', adminError.message);
      return { success: false, error: adminError.message };
    }

    const authUser: AuthUser | null = adminData?.user?.id ? { id: adminData.user.id } : null;
    if (!authUser) {
      return { success: false, error: 'Không thể tạo tài khoản xác thực. Vui lòng thử lại.' };
    }

    // 3. Call DB Onboarding Function
    type OnboardTenantRpc = (
      fn: 'onboard_tenant',
      args: {
        p_spa_name: string;
        p_contact_phone: string;
        p_address: string;
        p_email: string;
        p_admin_id: string;
        p_admin_email: string;
        p_admin_name: string;
      }
    ) => Promise<{ data: string | null; error: { message: string } | null }>;

    const onboardingRpcClient = supabaseAdmin as unknown as { rpc: OnboardTenantRpc };
    const { data: tenantId, error: rpcError } = await onboardingRpcClient.rpc('onboard_tenant', {
      p_spa_name: input.spaName,
      p_contact_phone: input.contactPhone || '',
      p_address: input.address || '',
      p_email: input.email || '',
      p_admin_id: authUser.id,
      p_admin_email: input.adminEmail,
      p_admin_name: input.adminName
    });
 
    if (rpcError) {
      console.error('[registerNewTenant] Database onboarding RPC failed:', rpcError.message);
      const authRollbackError = await rollbackCreatedAuthUser(supabaseAdmin, authUser.id);
      const rollbackNote = formatCleanupNote('auth cleanup', authRollbackError);
      return { success: false, error: `${rpcError.message}${rollbackNote}` };
    }

    // 3.1. Update HQ-managed tenant setup fields after the base onboarding RPC.
    const tenantSetupClient = supabaseAdmin;
    const postOnboardingUpdate: TenantUpdate = {
      product_key: productKey,
      enabled_modules: toEnabledModulesJsonForBusinessModule(businessModule),
    };
    if (hospitalityProfileResult?.success) {
      postOnboardingUpdate.metadata = toHospitalityMetadataJson(hospitalityProfileResult.profile);
    }
    if (businessModule === 'beauty_spa') {
      const brandTheme = normalizeTenantBrandThemeForModule({
        brandName: input.brandName || input.spaName,
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        accentColor: input.accentColor,
        portalDisplayName: input.portalDisplayName || input.brandName || input.spaName,
        invoiceDisplayName: input.invoiceDisplayName || input.brandName || input.spaName,
        stylePreset: 'jade_wellness',
        radiusStyle: 'soft',
        buttonStyle: 'pill',
        menuStyle: 'comfortable',
      }, businessModule);
      postOnboardingUpdate.logo_url = brandTheme.logoUrl;
      postOnboardingUpdate.brand_theme = toTenantBrandThemeJsonForModule(brandTheme, businessModule);
    }
    if (input.branchType === 'franchise') {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
      postOnboardingUpdate.franchise_agreement_date = today;
      postOnboardingUpdate.royalty_type = 'percentage';
    }

    if (Object.keys(postOnboardingUpdate).length > 0) {
      const { error: updateError } = await tenantSetupClient
        .from('tenants')
        .update(postOnboardingUpdate)
        .eq('id', tenantId as string);

      if (updateError) {
        console.error('[registerNewTenant] Post-onboarding tenant setup update failed:', updateError.message);
        const setupLabel = input.branchType === 'franchise'
          ? 'cấu hình nhượng quyền'
          : 'cấu hình sản phẩm tenant';
        return { success: false, error: `Lỗi cập nhật ${setupLabel}: ${updateError.message}` };
      }
    }

    if (productKey !== 'bella_babycare') {
      const branchBootstrapError = await bootstrapDefaultBranchForTenant(
        tenantSetupClient,
        tenantId as string,
        input,
        productKey,
      );
      if (branchBootstrapError) {
        return { success: false, error: `Lỗi tạo chi nhánh mặc định: ${branchBootstrapError}` };
      }
    }
 
    // 4. Record Audit Log for Onboarding
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'tenants',
        record_id: tenantId as string,
        new_data: { 
          id: tenantId,
          name: input.spaName,
          contact_phone: input.contactPhone,
          address: input.address,
          email: input.email,
          product_key: productKey,
          business_module: businessModule,
          enabled_modules: getEnabledModulesForBusinessModule(businessModule),
        }
      });
    } catch (auditErr) {
      return {
        success: false,
        error: `Failed to record onboarding audit log: ${getErrorMessage(auditErr)}`,
        data: {
          tenantId,
          userId: authUser.id,
          email: input.adminEmail
        }
      };
    }

    // 5. Clear caches
    await safeRevalidatePath('/dashboard');
    
    return { 
      success: true, 
      data: { 
        tenantId, 
        userId: authUser.id,
        email: input.adminEmail
      } 
    };

  } catch (error: unknown) {
    console.error('[registerNewTenant] Unexpected error:', error);
    const errorMessage = getErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}
