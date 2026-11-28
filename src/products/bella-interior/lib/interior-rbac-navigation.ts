/**
 * Bella Interior OS - Role-Based Access Control Navigation & Role Simulation
 * 
 * Maps the 12 official interior roles to allowed menu paths and provides
 * client-side simulation helpers so Administrators and Stakeholders can
 * preview the system exactly as each role experiences it.
 */

export type InteriorRoleKey =
  | 'OWNER'
  | 'ADMIN'
  | 'EXECUTIVE'
  | 'PM'
  | 'SALES'
  | 'DESIGNER'
  | 'QS'
  | 'PRODUCTION_MANAGER'
  | 'SITE_MANAGER'
  | 'QC'
  | 'ACCOUNTANT'
  | 'WARRANTY';

export interface InteriorRoleMeta {
  roleKey: InteriorRoleKey;
  displayName: string;
  badgeLabel: string;
  shortDesc: string;
  category: 'executive' | 'commercial' | 'technical' | 'production' | 'operations';
}

export const INTERIOR_ROLES: readonly InteriorRoleMeta[] = [
  {
    roleKey: 'OWNER',
    displayName: 'Chủ doanh nghiệp',
    badgeLabel: 'Owner / CEO',
    shortDesc: 'Toàn quyền quyết định và phê duyệt tối cao',
    category: 'executive',
  },
  {
    roleKey: 'ADMIN',
    displayName: 'Quản trị hệ thống',
    badgeLabel: 'System Admin',
    shortDesc: 'Quản trị nhân sự, vai trò, cấu hình và vận hành',
    category: 'executive',
  },
  {
    roleKey: 'EXECUTIVE',
    displayName: 'Ban điều hành',
    badgeLabel: 'Executive',
    shortDesc: 'Giám sát hiệu quả kinh doanh, dòng tiền và báo cáo',
    category: 'executive',
  },
  {
    roleKey: 'PM',
    displayName: 'Quản lý dự án',
    badgeLabel: 'Project Manager',
    shortDesc: 'Điều phối tiến độ, chi phí, giải ngân và bàn giao',
    category: 'operations',
  },
  {
    roleKey: 'SALES',
    displayName: 'Kinh doanh',
    badgeLabel: 'Sales / BD',
    shortDesc: 'Khách hàng, cơ hội, tư vấn báo giá và đàm phán hợp đồng',
    category: 'commercial',
  },
  {
    roleKey: 'DESIGNER',
    displayName: 'Kiến trúc sư / Thiết kế',
    badgeLabel: 'KTS / Designer',
    shortDesc: 'Không gian 3D, bản vẽ kỹ thuật xưởng và thư viện Spec vật liệu',
    category: 'technical',
  },
  {
    roleKey: 'QS',
    displayName: 'Kỹ sư Dự toán (QS)',
    badgeLabel: 'QS Engineer',
    shortDesc: 'Bóc tách khối lượng, tính COGS và lập định mức BOM xưởng',
    category: 'commercial',
  },
  {
    roleKey: 'PRODUCTION_MANAGER',
    displayName: 'Quản đốc xưởng sản xuất',
    badgeLabel: 'Quản đốc xưởng',
    shortDesc: 'Tiếp nhận lệnh sản xuất, gia công xẻ gỗ, sơn và đóng gói',
    category: 'production',
  },
  {
    roleKey: 'SITE_MANAGER',
    displayName: 'Chỉ huy trưởng công trường',
    badgeLabel: 'Chỉ huy công trường',
    shortDesc: 'Nhật ký công trình, lắp đặt nội thất và giám sát hiện trường',
    category: 'production',
  },
  {
    roleKey: 'QC',
    displayName: 'Kỹ sư Kiểm soát Chất lượng (QC)',
    badgeLabel: 'Kỹ sư QC',
    shortDesc: 'Nghiệm thu KCS xuất xưởng và checklist bàn giao kỹ thuật',
    category: 'technical',
  },
  {
    roleKey: 'ACCOUNTANT',
    displayName: 'Kế toán dự án',
    badgeLabel: 'Kế toán',
    shortDesc: 'Thu tiền theo đợt, công nợ khách hàng và đối soát vật tư',
    category: 'operations',
  },
  {
    roleKey: 'WARRANTY',
    displayName: 'Chăm sóc & Bảo hành',
    badgeLabel: 'Bảo hành / CSKH',
    shortDesc: 'Chứng thư bảo hành, xử lý phiếu yêu cầu bảo trì hậu mãi',
    category: 'operations',
  },
] as const;

/**
 * Menu paths allowed for each role in Bella Interior
 */
export const INTERIOR_ROLE_ALLOWED_HREFS: Record<InteriorRoleKey, readonly string[]> = {
  OWNER: [
    '/dashboard/interior',
    '/dashboard/ai-copilot',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/interior/production',
    '/dashboard/inventory',
    '/dashboard/interior/installation',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
    '/dashboard/interior/reports',
    '/dashboard/interior/roles',
    '/dashboard/settings?product=bella_interior',
  ],
  ADMIN: [
    '/dashboard/interior',
    '/dashboard/ai-copilot',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/interior/production',
    '/dashboard/inventory',
    '/dashboard/interior/installation',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
    '/dashboard/interior/reports',
    '/dashboard/interior/roles',
    '/dashboard/settings?product=bella_interior',
  ],
  EXECUTIVE: [
    '/dashboard/interior',
    '/dashboard/ai-copilot',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/schedule',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/inventory',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/reports',
    '/dashboard/accounting',
    '/dashboard/accounting/reports',
  ],
  PM: [
    '/dashboard/interior',
    '/dashboard/ai-copilot',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/interior/production',
    '/dashboard/inventory',
    '/dashboard/interior/installation',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
    '/dashboard/interior/reports',
  ],
  SALES: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
    '/dashboard/interior/reports',
  ],
  DESIGNER: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
  ],
  QS: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/inventory',
  ],
  PRODUCTION_MANAGER: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/interior/boq',
    '/dashboard/interior/production',
    '/dashboard/inventory',
    '/dashboard/interior/qc-handover',
  ],
  SITE_MANAGER: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/schedule',
    '/dashboard/interior/design',
    '/dashboard/inventory',
    '/dashboard/interior/installation',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
  ],
  QC: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/schedule',
    '/dashboard/interior/production',
    '/dashboard/interior/installation',
    '/dashboard/interior/site-diary',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
  ],
  ACCOUNTANT: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/contracts',
    '/dashboard/interior/finance',
    '/dashboard/inventory',
    '/dashboard/interior/reports',
    '/dashboard/accounting',
    '/dashboard/accounting/reports',
  ],
  WARRANTY: [
    '/dashboard/interior',
    '/dashboard/interior/projects',
    '/dashboard/interior/customers',
    '/dashboard/interior/installation',
    '/dashboard/interior/qc-handover',
    '/dashboard/interior/warranty',
  ],
};

export const INTERIOR_SIMULATED_ROLE_STORAGE_KEY = 'bella_interior_simulated_role';
export const INTERIOR_ROLE_CHANGE_EVENT = 'bella:interior-role-change';

/**
 * Normalizes input role string to canonical InteriorRoleKey or null
 */
export function normalizeInteriorRoleKey(role: string | null | undefined): InteriorRoleKey | null {
  if (!role) return null;
  const upper = role.trim().toUpperCase();

  // Alias maps for common role variations
  if (upper === 'SUPER_ADMIN' || upper === 'ROOT') return 'ADMIN';
  if (upper === 'ARCHITECT' || upper === 'LEAD_ARCHITECT' || upper === 'KTS') return 'DESIGNER';
  if (upper === 'PROJECT_MANAGER' || upper === 'PROJECT_LEAD') return 'PM';
  if (upper === 'WORKSHOP_MANAGER' || upper === 'PRODUCTION') return 'PRODUCTION_MANAGER';
  if (upper === 'SITE_SUPERVISOR' || upper === 'SITE_LEAD' || upper === 'SITE') return 'SITE_MANAGER';
  if (upper === 'QUALITY_CONTROL' || upper === 'KCS') return 'QC';
  if (upper === 'KE_TOAN') return 'ACCOUNTANT';
  if (upper === 'BAO_HANH') return 'WARRANTY';
  if (upper === 'KINH_DOANH') return 'SALES';
  if (upper === 'BAN_DIEU_HANH' || upper === 'CEO') return 'EXECUTIVE';

  return upper in INTERIOR_ROLE_ALLOWED_HREFS ? (upper as InteriorRoleKey) : null;
}

/**
 * Checks whether a specific menu href is permitted for the given role
 */
export function isInteriorMenuItemAllowed(
  role: string | null | undefined,
  href: string
): boolean {
  const roleKey = normalizeInteriorRoleKey(role);
  // Default to full access if no role is defined or role is OWNER/ADMIN
  if (!roleKey || roleKey === 'OWNER' || roleKey === 'ADMIN') {
    return true;
  }

  const allowedHrefs = INTERIOR_ROLE_ALLOWED_HREFS[roleKey];
  if (!allowedHrefs) return true;

  // Exact match or base path match (e.g. /dashboard/interior/design matches)
  return allowedHrefs.some((allowed) => {
    if (allowed === href) return true;
    // For query string variations like settings
    if (allowed.includes('?') && href.includes('?')) {
      return allowed.split('?')[0] === href.split('?')[0];
    }
    return false;
  });
}

/**
 * Returns user-friendly display name for an interior role
 */
export function getInteriorRoleDisplayName(role: string | null | undefined): string {
  const roleKey = normalizeInteriorRoleKey(role);
  if (!roleKey) return 'Chưa xác định';
  const meta = INTERIOR_ROLES.find((r) => r.roleKey === roleKey);
  return meta?.displayName || 'Chưa xác định';
}

/**
 * Reads currently simulated role from localStorage (browser-only)
 */
export function getSimulatedInteriorRole(): InteriorRoleKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(INTERIOR_SIMULATED_ROLE_STORAGE_KEY);
    return normalizeInteriorRoleKey(saved);
  } catch {
    return null;
  }
}

/**
 * Sets or clears simulated role in localStorage and dispatches sync event
 */
export function setSimulatedInteriorRole(role: InteriorRoleKey | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!role) {
      window.localStorage.removeItem(INTERIOR_SIMULATED_ROLE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(INTERIOR_SIMULATED_ROLE_STORAGE_KEY, role);
    }
    window.dispatchEvent(
      new CustomEvent(INTERIOR_ROLE_CHANGE_EVENT, {
        detail: { role },
      })
    );
  } catch {
    // Graceful fallback if localStorage is disabled
  }
}

