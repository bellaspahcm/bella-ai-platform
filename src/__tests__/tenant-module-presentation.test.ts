import {
  formatBookingCustomerLabel,
  getCustomerGenderPresentation,
  getPackageSpecialty,
  getTenantModulePresentation,
  getTenantSpecialtyOptions,
} from '@/lib/business-rules/tenant-module-presentation';
import { getDefaultTenantModuleKey, normalizeEnabledModulesForSave } from '@/lib/business-rules/tenant-modules';

describe('tenant module presentation rules', () => {
  it('preserves Manufacturing as the sole tenant module without falling back to BabyCare', () => {
    const modules = normalizeEnabledModulesForSave({ manufacturing: true });

    expect(modules).toMatchObject({ manufacturing: true, babycare: false });
    expect(getDefaultTenantModuleKey(modules)).toBe('manufacturing');
    expect(getTenantModulePresentation('manufacturing').primaryNameLabel).toBe('Họ tên khách hàng');
    expect(getTenantSpecialtyOptions('manufacturing')).toEqual([]);
  });

  it('uses Beauty Spa customer wording without changing stored customer columns', () => {
    const labels = getTenantModulePresentation('beauty_spa');

    expect(labels.primaryNameLabel).toBe('Họ tên khách hàng');
    expect(labels.secondaryNameLabel).toBe('Nhóm khách / ghi chú hồ sơ');
    expect(labels.secondaryGenderLabel).toBe('Giới tính khách hàng');
    expect(formatBookingCustomerLabel({
      moduleKey: 'beauty_spa',
      primaryName: 'Khách Beauty Demo Linh',
      secondaryName: 'Beauty Demo',
    })).toBe('Khách: Khách Beauty Demo Linh - Hồ sơ: Beauty Demo');
  });

  it('keeps Babycare wording as the default module presentation', () => {
    const labels = getTenantModulePresentation('babycare');

    expect(labels.primaryNameLabel).toBe('Họ tên mẹ');
    expect(labels.secondaryNameLabel).toBe('Họ tên bé / tên thân mật');
    expect(getTenantSpecialtyOptions('babycare').map((option) => option.id)).toEqual([
      'all',
      'combo',
      'baby',
      'pregnancy',
      'lactation',
    ]);
  });

  it('maps Beauty Spa specialties from package metadata before using package-name fallback', () => {
    expect(getTenantSpecialtyOptions('beauty_spa').map((option) => option.id)).toEqual([
      'all',
      'facial',
      'body',
      'laser',
      'relaxation',
    ]);

    expect(getPackageSpecialty({
      tenantModuleKey: 'beauty_spa',
      packageModuleKey: 'beauty_spa',
      serviceCategory: 'laser',
      packageName: 'Triệt Lông Diode Demo',
    })).toBe('laser');

    expect(getPackageSpecialty({
      tenantModuleKey: 'beauty_spa',
      packageModuleKey: 'beauty_spa',
      serviceCategory: null,
      packageName: 'Gội Đầu Dưỡng Sinh Demo',
    })).toBe('relaxation');
  });

  it('normalizes Beauty Spa gender labels from legacy and Vietnamese values', () => {
    expect(getCustomerGenderPresentation('girl', 'beauty_spa')).toEqual(expect.objectContaining({
      label: 'Nữ',
      tone: 'rose',
    }));
    expect(getCustomerGenderPresentation('Nữ', 'beauty_spa')).toEqual(expect.objectContaining({
      label: 'Nữ',
      tone: 'rose',
    }));
    expect(getCustomerGenderPresentation('boy', 'beauty_spa')).toEqual(expect.objectContaining({
      label: 'Nam',
      tone: 'blue',
    }));
  });
});
