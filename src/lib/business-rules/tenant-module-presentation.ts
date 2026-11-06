import {
  getDefaultTenantModuleKey,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';

export type TenantSpecialtyKey =
  | 'all'
  | 'combo'
  | 'baby'
  | 'pregnancy'
  | 'lactation'
  | 'facial'
  | 'body'
  | 'laser'
  | 'relaxation';

export type GenderTone = 'blue' | 'rose' | 'slate';

type GenderOption = {
  id: string;
  label: string;
  tone: GenderTone;
};

type CustomerPresentation = {
  customerListSubtitle: string;
  customerSearchPlaceholder: string;
  editDescription: string;
  createDescription: string;
  primaryNameLabel: string;
  primaryNamePlaceholder: string;
  secondaryNameLabel: string;
  secondaryNamePlaceholder: string;
  secondaryDateLabel: string;
  secondaryGenderLabel: string;
  secondaryInfoTitle: string;
  secondaryInfoNameLabel: string;
  secondaryInfoDateLabel: string;
  activeCareBadge: string;
  activeStatusLabel: string;
  depositStatusLabel: string;
  leadStatusLabel: string;
  customerPrefix: string;
  secondaryPrefix: string;
  secondaryFallback: string;
  locationLatitudeLabel: string;
  locationLongitudeLabel: string;
  genderOptions: GenderOption[];
};

type SpecialtyOption = {
  id: TenantSpecialtyKey;
  label: string;
};

const BABYCARE_CUSTOMER_PRESENTATION: CustomerPresentation = {
  customerListSubtitle: 'Quản lý hồ sơ mẹ và bé',
  customerSearchPlaceholder: 'Tìm tên mẹ, tên bé, SĐT, ngày sinh, gói, địa chỉ...',
  editDescription: 'Chỉnh sửa hồ sơ mẹ và bé',
  createDescription: 'Nhập thông tin cơ bản của mẹ và bé',
  primaryNameLabel: 'Họ tên mẹ',
  primaryNamePlaceholder: 'VD: Nguyễn Thu Thủy',
  secondaryNameLabel: 'Họ tên bé / tên thân mật',
  secondaryNamePlaceholder: 'VD: Gia Bảo',
  secondaryDateLabel: 'Ngày sinh bé / dự sinh',
  secondaryGenderLabel: 'Giới tính của bé',
  secondaryInfoTitle: 'Thông tin bé',
  secondaryInfoNameLabel: 'Tên của bé',
  secondaryInfoDateLabel: 'Ngày sinh / Dự sinh',
  activeCareBadge: 'Đang có gói liệu trình',
  activeStatusLabel: 'Đang chăm sóc',
  depositStatusLabel: 'Chờ sinh (Đã cọc)',
  leadStatusLabel: 'Khách mới (Lead)',
  customerPrefix: 'Mẹ',
  secondaryPrefix: 'Bé',
  secondaryFallback: 'Chưa có',
  locationLatitudeLabel: 'Vĩ độ nhà khách (Latitude)',
  locationLongitudeLabel: 'Kinh độ nhà khách (Longitude)',
  genderOptions: [
    { id: 'boy', label: 'Bé trai', tone: 'blue' },
    { id: 'girl', label: 'Bé gái', tone: 'rose' },
    { id: 'unknown', label: 'Chưa biết', tone: 'slate' },
  ],
};

const BEAUTY_SPA_CUSTOMER_PRESENTATION: CustomerPresentation = {
  customerListSubtitle: 'Quản lý hồ sơ khách hàng Beauty Spa',
  customerSearchPlaceholder: 'Tìm khách, SĐT, liệu trình...',
  editDescription: 'Chỉnh sửa hồ sơ khách hàng Beauty Spa',
  createDescription: 'Nhập thông tin cơ bản của khách hàng Beauty Spa',
  primaryNameLabel: 'Họ tên khách hàng',
  primaryNamePlaceholder: 'VD: Nguyễn Linh Chi',
  secondaryNameLabel: 'Nhóm khách / ghi chú hồ sơ',
  secondaryNamePlaceholder: 'VD: Khách facial VIP',
  secondaryDateLabel: 'Ngày sinh khách hàng',
  secondaryGenderLabel: 'Giới tính khách hàng',
  secondaryInfoTitle: 'Thông tin khách hàng',
  secondaryInfoNameLabel: 'Nhóm / ghi chú hồ sơ',
  secondaryInfoDateLabel: 'Ngày sinh',
  activeCareBadge: 'Đang có liệu trình/dịch vụ',
  activeStatusLabel: 'Đang sử dụng dịch vụ',
  depositStatusLabel: 'Đã đặt cọc',
  leadStatusLabel: 'Khách tiềm năng',
  customerPrefix: 'Khách',
  secondaryPrefix: 'Hồ sơ',
  secondaryFallback: 'Chưa phân nhóm',
  locationLatitudeLabel: 'Vĩ độ địa chỉ khách (Latitude)',
  locationLongitudeLabel: 'Kinh độ địa chỉ khách (Longitude)',
  genderOptions: [
    { id: 'boy', label: 'Nam', tone: 'blue' },
    { id: 'girl', label: 'Nữ', tone: 'rose' },
    { id: 'unknown', label: 'Khác / chưa rõ', tone: 'slate' },
  ],
};

const INDUSTRIAL_CLEANING_CUSTOMER_PRESENTATION: CustomerPresentation = {
  customerListSubtitle: 'Quản lý hồ sơ khách hàng doanh nghiệp',
  customerSearchPlaceholder: 'Tìm tên doanh nghiệp, SĐT, loại cơ sở, địa chỉ...',
  editDescription: 'Chỉnh sửa hồ sơ khách hàng doanh nghiệp',
  createDescription: 'Nhập thông tin cơ bản của khách hàng doanh nghiệp',
  primaryNameLabel: 'Tên doanh nghiệp / Người liên hệ',
  primaryNamePlaceholder: 'VD: Công ty TNHH ABC',
  secondaryNameLabel: 'Loại cơ sở / Ghi chú',
  secondaryNamePlaceholder: 'VD: Văn phòng 500m²',
  secondaryDateLabel: 'Ngày bắt đầu hợp đồng',
  secondaryGenderLabel: 'Loại hình cơ sở',
  secondaryInfoTitle: 'Thông tin cơ sở',
  secondaryInfoNameLabel: 'Loại cơ sở / Ghi chú',
  secondaryInfoDateLabel: 'Lịch sử chăm sóc',
  activeCareBadge: 'Đang có hợp đồng dịch vụ',
  activeStatusLabel: 'Đang phục vụ',
  depositStatusLabel: 'Đã ký hợp đồng',
  leadStatusLabel: 'Khách tiềm năng',
  customerPrefix: 'Khách hàng',
  secondaryPrefix: 'Cơ sở',
  secondaryFallback: 'Chưa phân loại',
  locationLatitudeLabel: 'Vĩ độ địa chỉ cơ sở (Latitude)',
  locationLongitudeLabel: 'Kinh độ địa chỉ cơ sở (Longitude)',
  genderOptions: [
    { id: 'boy', label: 'Văn phòng', tone: 'blue' },
    { id: 'girl', label: 'Nhà xưởng', tone: 'slate' },
    { id: 'unknown', label: 'Khác', tone: 'slate' },
  ],
};

const NEUTRAL_CUSTOMER_PRESENTATION: CustomerPresentation = {
  customerListSubtitle: 'Quản lý hồ sơ khách hàng',
  customerSearchPlaceholder: 'Tìm tên khách, SĐT, ngày sinh, dịch vụ, địa chỉ...',
  editDescription: 'Chỉnh sửa hồ sơ khách hàng',
  createDescription: 'Nhập thông tin cơ bản của khách hàng',
  primaryNameLabel: 'Họ tên khách hàng',
  primaryNamePlaceholder: 'VD: Nguyễn Linh Chi',
  secondaryNameLabel: 'Nhóm khách / ghi chú hồ sơ',
  secondaryNamePlaceholder: 'VD: Khách VIP',
  secondaryDateLabel: 'Ngày sinh khách hàng',
  secondaryGenderLabel: 'Giới tính khách hàng',
  secondaryInfoTitle: 'Thông tin khách hàng',
  secondaryInfoNameLabel: 'Nhóm / ghi chú hồ sơ',
  secondaryInfoDateLabel: 'Ngày sinh',
  activeCareBadge: 'Đang có liệu trình/dịch vụ',
  activeStatusLabel: 'Đang sử dụng dịch vụ',
  depositStatusLabel: 'Đã đặt cọc',
  leadStatusLabel: 'Khách tiềm năng',
  customerPrefix: 'Khách',
  secondaryPrefix: 'Hồ sơ',
  secondaryFallback: 'Chưa phân nhóm',
  locationLatitudeLabel: 'Vĩ độ địa chỉ khách (Latitude)',
  locationLongitudeLabel: 'Kinh độ địa chỉ khách (Longitude)',
  genderOptions: [
    { id: 'boy', label: 'Nam', tone: 'blue' },
    { id: 'girl', label: 'Nữ', tone: 'rose' },
    { id: 'unknown', label: 'Khác / chưa rõ', tone: 'slate' },
  ],
};

// Specialty options for booking filters
const BABYCARE_SPECIALTIES: SpecialtyOption[] = [
  { id: 'all', label: 'Tất cả KTV' },
  { id: 'combo', label: 'Combo mẹ & bé' },
  { id: 'baby', label: 'Tắm bé' },
  { id: 'pregnancy', label: 'Massage bầu' },
  { id: 'lactation', label: 'Thông sữa / Kích sữa' },
];

const BEAUTY_SPA_SPECIALTIES: SpecialtyOption[] = [
  { id: 'all', label: 'Tất cả KTV' },
  { id: 'facial', label: 'Chăm sóc da mặt' },
  { id: 'body', label: 'Chăm sóc body' },
  { id: 'laser', label: 'Triệt lông / Công nghệ' },
  { id: 'relaxation', label: 'Gội đầu / Dưỡng sinh' },
];

const INDUSTRIAL_CLEANING_SPECIALTIES: SpecialtyOption[] = [
  { id: 'all', label: 'Tất cả nhân viên' },
  { id: 'combo', label: 'Văn phòng / tòa nhà' },
  { id: 'baby', label: 'Nhà xưởng / sản xuất' },
  { id: 'pregnancy', label: 'Y tế / bệnh viện' },
  { id: 'lactation', label: 'Nhà hàng / bếp ăn' },
  { id: 'facial', label: 'Cleanroom / đặc biệt' },
];

const REAL_ESTATE_CUSTOMER_PRESENTATION: CustomerPresentation = {
  customerListSubtitle: 'Quản lý hồ sơ nhà đầu tư & khách mua BĐS',
  customerSearchPlaceholder: 'Tìm tên khách, SĐT, dự án, căn hộ, nhu cầu...',
  editDescription: 'Chỉnh sửa hồ sơ khách mua BĐS',
  createDescription: 'Nhập thông tin nhà đầu tư / khách hàng mua BĐS',
  primaryNameLabel: 'Họ tên nhà đầu tư / Khách mua',
  primaryNamePlaceholder: 'VD: Nguyễn Minh Hoàng',
  secondaryNameLabel: 'Nhu cầu đầu tư / Sản phẩm quan tâm',
  secondaryNamePlaceholder: 'VD: Căn 2PN Vinhomes Green Paradise',
  secondaryDateLabel: 'Ngày tạo nhu cầu',
  secondaryGenderLabel: 'Phân loại nhà đầu tư',
  secondaryInfoTitle: 'Thông tin căn hộ quan tâm',
  secondaryInfoNameLabel: 'Dự án / Căn hộ quan tâm',
  secondaryInfoDateLabel: 'Ngày liên hệ',
  activeCareBadge: 'Đang giữ chỗ / đặt cọc',
  activeStatusLabel: 'Đang giao dịch',
  depositStatusLabel: 'Đã giữ chỗ / cọc',
  leadStatusLabel: 'Khách hàng mới (Lead)',
  customerPrefix: 'Khách mua',
  secondaryPrefix: 'Căn hộ',
  secondaryFallback: 'Chưa chọn căn',
  locationLatitudeLabel: 'Vĩ độ địa chỉ (Latitude)',
  locationLongitudeLabel: 'Kinh độ địa chỉ (Longitude)',
  genderOptions: [
    { id: 'boy', label: 'Căn hộ', tone: 'blue' },
    { id: 'girl', label: 'Biệt thự / Shophouse', tone: 'rose' },
    { id: 'unknown', label: 'Khác', tone: 'slate' },
  ],
};

export function getTenantModulePresentation(moduleKey: TenantModuleKey): CustomerPresentation {
  if (moduleKey === 'manufacturing') {
    return NEUTRAL_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'real_estate') {
    return REAL_ESTATE_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'beauty_spa') {
    return BEAUTY_SPA_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'industrial_cleaning') {
    return INDUSTRIAL_CLEANING_CUSTOMER_PRESENTATION;
  }
  return BABYCARE_CUSTOMER_PRESENTATION;
}

export function getTenantModulePresentationOrNeutral(
  moduleKey: TenantModuleKey | null | undefined,
): CustomerPresentation {
  if (moduleKey === 'real_estate') {
    return REAL_ESTATE_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'beauty_spa') {
    return BEAUTY_SPA_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'industrial_cleaning') {
    return INDUSTRIAL_CLEANING_CUSTOMER_PRESENTATION;
  }
  if (moduleKey === 'babycare') {
    return BABYCARE_CUSTOMER_PRESENTATION;
  }
  return NEUTRAL_CUSTOMER_PRESENTATION;
}

export function getTenantPresentationFromModules(enabledModules: unknown): CustomerPresentation {
  return getTenantModulePresentation(getDefaultTenantModuleKey(enabledModules));
}

export function getTenantSpecialtyOptions(moduleKey: TenantModuleKey): SpecialtyOption[] {
  if (moduleKey === 'manufacturing') {
    return [];
  }
  if (moduleKey === 'industrial_cleaning') {
    return INDUSTRIAL_CLEANING_SPECIALTIES;
  }
  return moduleKey === 'beauty_spa' ? BEAUTY_SPA_SPECIALTIES : BABYCARE_SPECIALTIES;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function getCustomerGenderPresentation(
  gender: unknown,
  moduleKey: TenantModuleKey | null | undefined,
): GenderOption {
  const labels = getTenantModulePresentationOrNeutral(moduleKey);
  const normalized = normalizeText(gender);

  if (['boy', 'male', 'nam', 'bé trai', 'be trai'].includes(normalized)) {
    return labels.genderOptions[0];
  }

  if (['girl', 'female', 'nữ', 'nu', 'bé gái', 'be gai'].includes(normalized)) {
    return labels.genderOptions[1];
  }

  return labels.genderOptions[2];
}

export function formatBookingCustomerLabel(input: {
  moduleKey: TenantModuleKey;
  primaryName?: string | null;
  secondaryName?: string | null;
}) {
  const labels = getTenantModulePresentation(input.moduleKey);
  const primaryName = input.primaryName || 'Khách hàng';
  const secondaryName = input.secondaryName || '';
  return `${labels.customerPrefix}: ${primaryName}${secondaryName ? ` - ${labels.secondaryPrefix}: ${secondaryName}` : ''}`;
}

export function getCustomerSecondarySummary(input: {
  moduleKey: TenantModuleKey | null | undefined;
  status?: string | null;
  secondaryName?: string | null;
  expectedDate?: string | null;
}) {
  const labels = getTenantModulePresentationOrNeutral(input.moduleKey);

  if (input.moduleKey === 'babycare' && input.status === 'deposit') {
    return `Dự sinh: ${input.expectedDate || 'Chưa cập nhật'}`;
  }

  return `${labels.secondaryPrefix}: ${input.secondaryName || labels.secondaryFallback}`;
}

export function getPackageSpecialty(input: {
  tenantModuleKey: TenantModuleKey;
  packageModuleKey?: string | null;
  serviceCategory?: string | null;
  packageName?: string | null;
}): TenantSpecialtyKey {
  const moduleKey = input.packageModuleKey === 'beauty_spa' ? 'beauty_spa' : input.tenantModuleKey;
  
  // Industrial Cleaning: always return 'all' (no specialty filtering)
  if (moduleKey === 'industrial_cleaning') {
    return 'all';
  }
  
  const category = normalizeText(input.serviceCategory);
  const name = normalizeText(input.packageName);

  if (moduleKey === 'beauty_spa') {
    if (category.includes('facial') || name.includes('facial') || name.includes('da mặt')) return 'facial';
    if (
      category.includes('laser') ||
      category.includes('technology') ||
      name.includes('laser') ||
      name.includes('triệt') ||
      name.includes('diode') ||
      name.includes('công nghệ')
    ) return 'laser';
    if (
      category.includes('body') ||
      name.includes('body') ||
      name.includes('massage') ||
      name.includes('giảm béo')
    ) return 'body';
    if (
      category.includes('relax') ||
      category.includes('relaxation') ||
      name.includes('gội') ||
      name.includes('dưỡng sinh') ||
      name.includes('thư giãn')
    ) return 'relaxation';
    return 'facial';
  }

  if (name.includes('combo') || name.includes('home-care') || name.includes('signature')) return 'combo';
  if (name.includes('bé') || name.includes('tắm') || name.includes('hydrotherapy') || name.includes('con yêu')) return 'baby';
  if (name.includes('bầu') || name.includes('thai')) return 'pregnancy';
  if (name.includes('sữa') || name.includes('thông') || name.includes('kích')) return 'lactation';
  return 'combo';
}

export function getKtvFallbackSpecialtyByName(
  fullName: string | null | undefined,
  moduleKey: TenantModuleKey,
): TenantSpecialtyKey {
  // Industrial Cleaning: always return 'all' (no specialty filtering by name)
  if (moduleKey === 'industrial_cleaning') {
    return 'all';
  }
  
  const name = normalizeText(fullName);

  if (moduleKey === 'beauty_spa') {
    if (name.includes('facial') || name.includes('da')) return 'facial';
    if (name.includes('body') || name.includes('massage')) return 'body';
    if (name.includes('laser') || name.includes('triệt')) return 'laser';
    if (name.includes('gội') || name.includes('dưỡng') || name.includes('relax')) return 'relaxation';
    return 'facial';
  }

  if (name.includes('hoa') || name.includes('hà') || name.includes('ha')) return 'combo';
  if (name.includes('tuyết') || name.includes('tuyet') || name.includes('thanh') || name.includes('bella')) return 'baby';
  if (name.includes('mai')) return 'pregnancy';
  return 'lactation';
}
