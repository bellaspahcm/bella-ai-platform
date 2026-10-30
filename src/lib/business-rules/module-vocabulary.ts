/**
 * Module Vocabulary Dictionary
 * 
 * Provides domain-specific terminology for different business modules.
 * This enables the UI to display appropriate terms based on the tenant's module.
 * 
 * Rules:
 * - NEVER hard-code domain terms like "KTV", "Session", "Treatment" in UI
 * - ALWAYS use getModuleVocabulary() to get the correct term
 * - Keep vocabulary centralized for easy maintenance
 * 
 * Example:
 * ```tsx
 * const vocab = getModuleVocabulary(moduleKey);
 * <h1>{vocab.worker.plural}</h1> // "Kỹ thuật viên" or "Nhân viên vệ sinh"
 * ```
 */

import type { TenantModuleKey } from './tenant-modules';

export type ModuleVocabulary = {
  // Worker terms (KTV, Cleaner, Nanny, etc.)
  worker: {
    singular: string;
    plural: string;
    short: string; // KTV, NVS, etc.
    role: string; // For user role display
  };
  
  // Work unit terms (Session, Work Order, Shift, etc.)
  workUnit: {
    singular: string;
    plural: string;
    action: string; // "Thực hiện", "Hoàn thành", etc.
  };
  
  // Service terms (Treatment, Cleaning Service, Care Service, etc.)
  service: {
    singular: string;
    plural: string;
  };
  
  // Booking terms (Booking, Work Order, Assignment, etc.)
  booking: {
    singular: string;
    plural: string;
    action: string; // "Đặt lịch", "Tạo phiếu", etc.
  };
  
  // Package terms (Package, Contract, Care Plan, etc.)
  package: {
    singular: string;
    plural: string;
  };
  
  // Customer terms (may vary by domain)
  customer: {
    singular: string;
    plural: string;
    context: string; // "Khách hàng", "Doanh nghiệp", "Gia đình", etc.
  };
  
  // Service history / care history terms
  serviceHistory: {
    label: string; // "Lịch sử chăm sóc", "Lịch sử vệ sinh", etc.
    emptyState: string; // "Chưa có dữ liệu liệu trình", "Chưa có ca làm việc", etc.
  };
};

/**
 * Vocabulary for default/neutral state (when module not yet loaded)
 * Uses generic terms that work for all domains
 */
const NEUTRAL_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Nhân viên',
    plural: 'Nhân viên',
    short: 'NV',
    role: 'Nhân viên',
  },
  workUnit: {
    singular: 'Ca làm việc',
    plural: 'Các ca làm việc',
    action: 'Hoàn thành ca',
  },
  service: {
    singular: 'Dịch vụ',
    plural: 'Các dịch vụ',
  },
  booking: {
    singular: 'Đơn hàng',
    plural: 'Các đơn hàng',
    action: 'Tạo đơn',
  },
  package: {
    singular: 'Gói dịch vụ',
    plural: 'Các gói dịch vụ',
  },
  customer: {
    singular: 'Khách hàng',
    plural: 'Khách hàng',
    context: 'khách hàng',
  },
  serviceHistory: {
    label: 'Lịch sử dịch vụ',
    emptyState: 'Chưa có dữ liệu dịch vụ hoàn thành',
  },
};

/**
 * Vocabulary for Beauty Spa / Baby Care domains
 * (Default/Original vocabulary)
 */
const BEAUTY_BABYCARE_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Kỹ thuật viên',
    plural: 'Kỹ thuật viên',
    short: 'KTV',
    role: 'KTV',
  },
  workUnit: {
    singular: 'Buổi liệu trình',
    plural: 'Các buổi liệu trình',
    action: 'Thực hiện buổi liệu trình',
  },
  service: {
    singular: 'Liệu trình',
    plural: 'Các liệu trình',
  },
  booking: {
    singular: 'Đơn đặt lịch',
    plural: 'Các đơn đặt lịch',
    action: 'Đặt lịch',
  },
  package: {
    singular: 'Gói dịch vụ',
    plural: 'Các gói dịch vụ',
  },
  customer: {
    singular: 'Khách hàng',
    plural: 'Khách hàng',
    context: 'mẹ và bé',
  },
  serviceHistory: {
    label: 'Lịch sử chăm sóc',
    emptyState: 'Chưa có dữ liệu liệu trình hoàn thành',
  },
};

/**
 * Vocabulary for Industrial Cleaning domain
 */
const CLEANING_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Nhân viên vệ sinh',
    plural: 'Nhân viên vệ sinh',
    short: 'NVS',
    role: 'Nhân viên vệ sinh',
  },
  workUnit: {
    singular: 'Ca làm việc',
    plural: 'Các ca làm việc',
    action: 'Hoàn thành ca',
  },
  service: {
    singular: 'Dịch vụ vệ sinh',
    plural: 'Các dịch vụ vệ sinh',
  },
  booking: {
    singular: 'Phiếu công việc',
    plural: 'Các phiếu công việc',
    action: 'Tạo phiếu',
  },
  package: {
    singular: 'Gói dịch vụ',
    plural: 'Các gói dịch vụ',
  },
  customer: {
    singular: 'Khách hàng',
    plural: 'Khách hàng',
    context: 'doanh nghiệp',
  },
  serviceHistory: {
    label: 'Lịch sử vệ sinh',
    emptyState: 'Chưa ca làm việc nào hoàn thành',
  },
};

/**
 * Vocabulary for Real Estate domain
 */
const REAL_ESTATE_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Chuyên viên tư vấn',
    plural: 'Chuyên viên tư vấn',
    short: 'CVTV',
    role: 'Tư vấn viên',
  },
  workUnit: {
    singular: 'Lượt tư vấn',
    plural: 'Lượt tư vấn',
    action: 'Đăng ký tư vấn',
  },
  service: {
    singular: 'Sản phẩm căn hộ',
    plural: 'Các sản phẩm căn hộ',
  },
  booking: {
    singular: 'Đơn giữ chỗ',
    plural: 'Các đơn giữ chỗ',
    action: 'Tạo giữ chỗ',
  },
  package: {
    singular: 'Dự án',
    plural: 'Các dự án',
  },
  customer: {
    singular: 'Khách mua',
    plural: 'Khách mua',
    context: 'bất động sản',
  },
  serviceHistory: {
    label: 'Lịch sử giao dịch',
    emptyState: 'Chưa có giao dịch giữ chỗ/hợp đồng nào',
  },
};

/**
 * Vocabulary for Healthcare / Dental domain
 */
const HEALTHCARE_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Bác sĩ / Y sĩ',
    plural: 'Bác sĩ & Y sĩ',
    short: 'Bác sĩ',
    role: 'Bác sĩ',
  },
  workUnit: {
    singular: 'Lượt khám',
    plural: 'Các lượt khám',
    action: 'Khám & Điều trị',
  },
  service: {
    singular: 'Dịch vụ Y tế / Nha khoa',
    plural: 'Dịch vụ Y tế / Nha khoa',
  },
  booking: {
    singular: 'Lịch hẹn khám',
    plural: 'Lịch hẹn khám',
    action: 'Đặt lịch khám',
  },
  package: {
    singular: 'Gói trị liệu / Phác đồ',
    plural: 'Gói trị liệu / Phác đồ',
  },
  customer: {
    singular: 'Bệnh nhân',
    plural: 'Bệnh nhân',
    context: 'bệnh nhân nha khoa',
  },
  serviceHistory: {
    label: 'Lịch sử điều trị lâm sàng',
    emptyState: 'Chưa có thông tin điều trị lâm sàng',
  },
};

/**
 * Vocabulary for Education / Preschool domain
 */
const EDUCATION_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Giáo viên',
    plural: 'Giáo viên',
    short: 'GV',
    role: 'Giáo viên',
  },
  workUnit: {
    singular: 'Tiết học',
    plural: 'Các tiết học',
    action: 'Điểm danh và Đứng lớp',
  },
  service: {
    singular: 'Khóa học / Lớp',
    plural: 'Các lớp học',
  },
  booking: {
    singular: 'Hồ sơ nhập học',
    plural: 'Hồ sơ nhập học',
    action: 'Tiếp nhận trẻ',
  },
  package: {
    singular: 'Kỳ học / Gói học phí',
    plural: 'Các kỳ học',
  },
  customer: {
    singular: 'Phụ huynh và Trẻ',
    plural: 'Phụ huynh và Trẻ',
    context: 'trẻ mầm non',
  },
  serviceHistory: {
    label: 'Nhật ký sinh hoạt và Chăm sóc',
    emptyState: 'Chưa có nhật ký sinh hoạt hoặc chăm sóc nào',
  },
};
/**
 * Get vocabulary for a specific module
 * Returns neutral vocabulary when moduleKey is null/undefined (before tenant data loads)
 */
export function getModuleVocabulary(moduleKey: TenantModuleKey | null | undefined): ModuleVocabulary {
  if (moduleKey === 'bella_education') {
    return EDUCATION_VOCABULARY;
  }

  if (moduleKey === 'bella_healthcare') {
    return HEALTHCARE_VOCABULARY;
  }

  if (moduleKey === 'industrial_cleaning') {
    return CLEANING_VOCABULARY;
  }
  
  if (moduleKey === 'real_estate') {
    return REAL_ESTATE_VOCABULARY;
  }
  
  if (moduleKey === 'beauty_spa' || moduleKey === 'babycare') {
    return BEAUTY_BABYCARE_VOCABULARY;
  }
  
  // Default: Neutral vocabulary (when module not yet loaded or unknown)
  return NEUTRAL_VOCABULARY;
}

/**
 * Hook-friendly wrapper for getting vocabulary
 * (for use in React components with useTenantModule)
 */
export function useModuleVocabulary(moduleKey: TenantModuleKey | null | undefined): ModuleVocabulary {
  return getModuleVocabulary(moduleKey);
}

/**
 * Get worker term (most commonly needed)
 * Shorthand for: getModuleVocabulary(moduleKey).worker
 */
export function getWorkerTerm(moduleKey: TenantModuleKey | null | undefined) {
  return getModuleVocabulary(moduleKey).worker;
}

/**
 * Get work unit term
 * Shorthand for: getModuleVocabulary(moduleKey).workUnit
 */
export function getWorkUnitTerm(moduleKey: TenantModuleKey | null | undefined) {
  return getModuleVocabulary(moduleKey).workUnit;
}

