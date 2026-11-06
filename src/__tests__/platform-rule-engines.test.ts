import {
  UNLIMITED_QUOTA,
  buildEffectiveSubscriptionLimits,
  calculateSubscriptionInvoiceAmount,
  calculateSubscriptionUsageState,
  validateQuotaOverrideLimit,
} from '@/lib/business-rules/subscription';
import {
  buildInterBranchClearingAccountingPayload,
  calculateInterBranchClearingAmount,
  calculateRoyaltyAmount,
  getClearingAmount,
} from '@/lib/business-rules/franchise';
import {
  canAccessAiCopilot,
  canUseAiCopilotRole,
  isManualPermittedByRole,
  isSidebarItemAllowed,
} from '@/lib/business-rules/permissions';
import {
  getDefaultTenantModuleKey,
  isTenantModuleEnabled,
  normalizeEnabledModules,
  normalizeEnabledModulesForSave,
  normalizeTenantBrandTheme,
  normalizeTenantBrandThemeForModule,
  resolveTenantBrandIdentity,
} from '@/lib/business-rules/tenant-modules';

describe('platform rule engines', () => {
  it('builds subscription limits and usage state from entitlements', () => {
    const limits = buildEffectiveSubscriptionLimits('Basic', [
      { feature_key: 'ktv', is_unlimited: false, limit_value: 2 },
      { feature_key: 'customer', is_unlimited: true, limit_value: null },
      { feature_key: 'sms', is_unlimited: false, limit_value: '100' },
      { feature_key: 'branch', is_unlimited: false, limit_value: 3 },
    ]);

    expect(limits).toEqual({
      maxKtv: 2,
      maxCustomers: UNLIMITED_QUOTA,
      maxSms: 100,
      maxBranches: 3,
      tierName: 'Basic',
    });
    expect(calculateSubscriptionUsageState({
      current: 2,
      entitlement: { feature_key: 'ktv', limit_value: 2, is_unlimited: false },
    })).toMatchObject({ isBlocked: true, current: 2, max: 2 });
    expect(calculateSubscriptionUsageState({
      current: 9999,
      entitlement: { feature_key: 'customer', limit_value: null, is_unlimited: true },
    })).toMatchObject({ isBlocked: false, max: UNLIMITED_QUOTA });
  });

  it('calculates subscription invoices and validates quota overrides', () => {
    expect(calculateSubscriptionInvoiceAmount({ priceMonthly: 499000, durationMonths: 3 }))
      .toEqual({ success: true, amount: 1497000 });
    expect(calculateSubscriptionInvoiceAmount({ priceMonthly: 499000, durationMonths: 0 }))
      .toEqual({ success: false, error: 'Thời hạn gói cước không hợp lệ' });

    expect(validateQuotaOverrideLimit({ isUnlimited: false, limitValue: -1 }))
      .toBe('Quota override can only be limited with a non-negative limitValue or marked unlimited.');
    expect(validateQuotaOverrideLimit({ isUnlimited: true, limitValue: null })).toBeNull();
  });

  it('calculates franchise royalty and inter-branch clearing amounts', () => {
    expect(calculateRoyaltyAmount({
      grossRevenue: 50_000_000,
      royaltyType: 'percentage',
      royaltyRate: 5,
      royaltyFixedAmount: 0,
    })).toBe(2_500_000);
    expect(calculateRoyaltyAmount({
      grossRevenue: 50_000_000,
      royaltyType: 'fixed',
      royaltyRate: 5,
      royaltyFixedAmount: 2_000_000,
    })).toBe(2_000_000);
    expect(calculateInterBranchClearingAmount({ sessionCount: 3, clearingRate: 180000 }))
      .toBe(540000);
    expect(getClearingAmount({ calculated_amount: '540000' })).toBe(540000);
  });

  it('builds clearing accounting payloads from one shared rule', () => {
    expect(buildInterBranchClearingAccountingPayload({
      record: {
        clearing_number: 'CLR-202606-A-B-1234',
        month_year: '2026-06-01',
        session_count: '3',
        clearing_rate: '180000',
        calculated_amount: '540000',
      },
      debtorTenantId: 'tenant-a',
      creditorTenantId: 'tenant-b',
      paymentMethod: 'VietQR',
      role: 'creditor',
    })).toMatchObject({
      amount: 540000,
      role: 'creditor',
      debtorTenantId: 'tenant-a',
      creditorTenantId: 'tenant-b',
      sessionCount: 3,
      clearingRate: 180000,
    });
  });

  it('centralizes sidebar, manual, and AI access rules', () => {
    expect(isSidebarItemAllowed({ role: 'ktv', label: 'Tài chính' })).toBe(false);
    expect(isSidebarItemAllowed({ role: 'ktv', label: 'Thẻ liệu trình' })).toBe(true);
    expect(isSidebarItemAllowed({ role: 'ktv', label: 'POS / In bill' })).toBe(true);
    expect(isSidebarItemAllowed({ role: 'accountant', label: 'POS / In bill' })).toBe(false);
    expect(isSidebarItemAllowed({
      role: 'admin_staff',
      label: 'POS / In bill',
      rolePermissions: { bookings: false },
    })).toBe(false);
    expect(isSidebarItemAllowed({
      role: 'accountant',
      label: 'Tài chính',
      rolePermissions: { finance: false },
    })).toBe(false);

    expect(canUseAiCopilotRole('super_admin')).toBe(true);
    expect(canUseAiCopilotRole('ktv')).toBe(false);
    expect(canAccessAiCopilot({ role: 'accountant', tenantId: 'tenant-1' })).toBe(true);
    expect(canAccessAiCopilot({ role: 'accountant', tenantId: null })).toBe(false);

    expect(isManualPermittedByRole('hr', 'ktv')).toBe(true);
    expect(isManualPermittedByRole('admin_staff', 'admin')).toBe(false);
    expect(isManualPermittedByRole('super_admin', 'admin')).toBe(false);
  });

  it('normalizes tenant module and white-label display rules', () => {
    expect(normalizeEnabledModules(null)).toEqual({
      babycare: true,
      beauty_spa: false,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModules({
      babycare: false,
      beauty_spa: true,
      student_training: true,
      unknown_module: true,
    })).toEqual({
      babycare: false,
      beauty_spa: true,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: true,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModules({
      beauty_spa: true,
    })).toEqual({
      babycare: false,
      beauty_spa: true,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModules({
      babycare: true,
    })).toEqual({
      babycare: true,
      beauty_spa: false,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModulesForSave({
      babycare: false,
      beauty_spa: false,
      student_training: true,
    })).toEqual({
      babycare: true,
      beauty_spa: false,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: true,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModulesForSave({
      babycare: false,
      beauty_spa: true,
    })).toEqual({
      babycare: false,
      beauty_spa: true,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(normalizeEnabledModulesForSave({
      babycare: false,
      beauty_spa: false,
    })).toEqual({
      babycare: true,
      beauty_spa: false,
      manufacturing: false,
      industrial_cleaning: false,
      student_training: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
      bella_education: false,
      bella_interior: false,
    });
    expect(getDefaultTenantModuleKey({
      babycare: false,
      beauty_spa: true,
    })).toBe('beauty_spa');
    expect(isTenantModuleEnabled({ beauty_spa: true }, 'beauty_spa')).toBe(true);

    expect(normalizeTenantBrandTheme({
      brandName: '  Beauty Spa Premium  ',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#aabbcc',
      accentColor: 'rose',
      portalDisplayName: 'Portal khách hàng',
      invoiceDisplayName: 'Beauty Invoice',
    })).toEqual({
      brandName: 'Beauty Spa Premium',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#AABBCC',
      accentColor: '#F8A5C2',
      portalDisplayName: 'Portal khách hàng',
      invoiceDisplayName: 'Beauty Invoice',
      stylePreset: 'bella_rose',
      radiusStyle: 'soft',
      buttonStyle: 'pill',
      menuStyle: 'comfortable',
      fontHeading: 'serif',
    });
    expect(normalizeTenantBrandThemeForModule({}, 'beauty_spa')).toEqual({
      brandName: '',
      logoUrl: '',
      primaryColor: '#074E44',
      accentColor: '#C8A97A',
      portalDisplayName: '',
      invoiceDisplayName: '',
      stylePreset: 'jade_wellness',
      radiusStyle: 'soft',
      buttonStyle: 'pill',
      menuStyle: 'comfortable',
      fontHeading: 'serif',
    });
    // PR #124: Brand Identity Priority is CUSTOM BRAND > PRODUCT IDENTITY > NEUTRAL
    // resolveTenantBrandIdentity now returns neutral fallback 'Hệ thống' when no custom brand is set.
    // Product Identity (displayName from ProductRegistry) is applied by consumer (Sidebar/UserProvider).
    expect(resolveTenantBrandIdentity({
      enabledModules: { babycare: false, beauty_spa: true, student_training: true, industrial_cleaning: false },
      brandTheme: null,
      surface: 'app',
    })).toMatchObject({
      displayName: 'Hệ thống',
      logoUrl: '',
      primaryColor: '#074E44',
      isBeautySpa: true,
    });
    expect(resolveTenantBrandIdentity({
      enabledModules: { babycare: true, beauty_spa: false },
      brandTheme: null,
      surface: 'app',
    })).toMatchObject({
      displayName: 'Hệ thống',
      logoUrl: '/logo.png',
      primaryColor: '#A91555',
      isBeautySpa: false,
    });
  });
});
