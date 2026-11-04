/**
 * Permission helpers - Di chuyển từ src/lib/business-rules/permissions.ts
 * v2: Thêm ROLE_GROUPS và isTechnicianRole() (Week 2)
 */

export type RolePermissions = Record<string, boolean>;

/**
 * ROLE_GROUPS: nhóm roles theo hành vi — không hard-code từng role ở từng file
 * Nguồn: src/lib/business-rules/permissions.ts (role list thực tế)
 */
export const ROLE_GROUPS = {
  /** Có quyền quản trị toàn hệ thống */
  ADMIN: new Set(['admin', 'super_admin']),
  /** Kỹ thuật viên trực tiếp phục vụ khách */
  TECHNICIAN: new Set(['ktv', 'ktv_lead']),
  /** Quản lý cấp trung — thấy nhiều hơn KTV */
  MANAGER: new Set(['admin', 'super_admin', 'manager', 'admin_staff']),
  /** Nghiệp vụ tài chính/kế toán */
  FINANCE: new Set(['admin', 'super_admin', 'accountant']),
  /** HR/Nhân sự */
  HR: new Set(['admin', 'super_admin', 'hr']),
} as const;

const ADMIN_ROLES = ROLE_GROUPS.ADMIN;

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

/** Admin hoặc super_admin */
export function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

/**
 * KTV hoặc KTV Lead — xem lịch của mình, không thấy tài chính
 * Dùng thay vì: role === 'ktv'
 */
export function isTechnicianRole(role: string | null | undefined) {
  return ROLE_GROUPS.TECHNICIAN.has(normalizeRole(role));
}

/** Có thể thấy dữ liệu tài chính cơ bản */
export function isManagerOrAbove(role: string | null | undefined) {
  return ROLE_GROUPS.MANAGER.has(normalizeRole(role));
}

export const SIDEBAR_MODULE_BY_LABEL: Record<string, string> = {
  Dashboard: 'dashboard',
  'Tổng quan': 'dashboard',
  'AI Copilot': 'ai_copilot',
  'Khách hàng': 'customers',
  'Lịch hẹn': 'bookings',
  'POS / In bill': 'bookings',
  'Thẻ liệu trình': 'sessions',
  'Tin nhắn': 'chat',
  'CRM & Zalo': 'crm',
  'Dịch vụ': 'services',
  'Đào tạo': 'student_training',
  'Meta Ads': 'marketing_ads',
  'Tài chính': 'finance',
  'Đối soát Tài chính': 'reconciliation',
  'Kế toán sổ cái': 'accounting',
  'Kho hàng': 'inventory',
  'Bảng lương': 'salary',
  'Trung tâm giám sát': 'system_monitor',
  'Nhật ký hệ thống': 'audit',
  'Cài đặt': 'settings',
  'Quản lý chi nhánh': 'branches',
  'Quản lý trẻ': 'students',
  'Quản lý lớp học': 'classes',
  'Quản lý giáo viên': 'teachers',
  'Chăm sóc & Nuôi dưỡng': 'care',
  'Học tập & Hoạt động': 'activities',
  'Truyền thông': 'communication',
  'Cơ sở vật chất': 'facilities',
  'Báo cáo thống kê': 'reports',
};

const DEFAULT_DENIED_SIDEBAR_LABELS_BY_ROLE: Record<string, Set<string>> = {
  teacher: new Set([
    'Tài chính', 'Quản lý chi nhánh', 'Cơ sở vật chất', 'Báo cáo thống kê', 'Cài đặt',
  ]),
  lead_teacher: new Set([
    'Tài chính', 'Quản lý chi nhánh', 'Cơ sở vật chất', 'Cài đặt',
  ]),
  caretaker: new Set([
    'Tài chính', 'Quản lý chi nhánh', 'Quản lý lớp học', 'Quản lý giáo viên',
    'Học tập & Hoạt động', 'Cơ sở vật chất', 'Báo cáo thống kê', 'Cài đặt',
  ]),
  ktv: new Set([
    'Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát Tài chính',
    'Trung tâm giám sát', 'Nhật ký hệ thống', 'Kho hàng',
    'Kế toán sổ cái', 'Meta Ads', 'Đào tạo', 'AI Copilot',
    'Quản lý chi nhánh', 'Cơ sở vật chất', 'Báo cáo thống kê',
  ]),
  ktv_lead: new Set([
    'Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát Tài chính',
    'Trung tâm giám sát', 'Nhật ký hệ thống', 'Kho hàng', 'Khách hàng',
    'Kế toán sổ cái', 'Meta Ads', 'Đào tạo', 'AI Copilot',
    'Quản lý chi nhánh', 'Cơ sở vật chất',
  ]),
  accountant: new Set([
    'Khách hàng', 'Lịch hẹn', 'POS / In bill', 'Thẻ liệu trình',
    'Tin nhắn', 'CRM & Zalo', 'Trung tâm giám sát', 'Nhật ký hệ thống',
    'Cài đặt', 'Meta Ads', 'Đào tạo', 'AI Copilot',
  ]),
};

export function resolveSidebarModuleId(label: string) {
  return SIDEBAR_MODULE_BY_LABEL[label] ?? null;
}

export function isSidebarItemAllowed(input: {
  role: string | null | undefined;
  label: string;
  rolePermissions?: RolePermissions | null;
}) {
  const role = normalizeRole(input.role);
  if (!role || role === 'customer' || isAdminRole(role)) return true;

  const moduleId = resolveSidebarModuleId(input.label);
  if (input.rolePermissions && moduleId && input.rolePermissions[moduleId] === false) {
    return false;
  }

  if (input.rolePermissions) return true;

  return !(DEFAULT_DENIED_SIDEBAR_LABELS_BY_ROLE[role]?.has(input.label) ?? false);
}
