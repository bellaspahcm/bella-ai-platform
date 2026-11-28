import {
  isInteriorMenuItemAllowed,
  normalizeInteriorRoleKey,
  type InteriorRoleKey,
} from './interior-rbac-navigation';

export type InteriorPwaModuleCategory =
  | 'operations'
  | 'design_commercial'
  | 'production_site'
  | 'finance_admin';

export interface InteriorPwaCapabilityFlags {
  canReadDiaries?: boolean;
  canCreateDiary?: boolean;
  canUpdateDiary?: boolean;
  canUploadSitePhoto?: boolean;
  canReadQc?: boolean;
  canCreateQc?: boolean;
  canReadSchedule?: boolean;
  canReadProduction?: boolean;
  canReadWarranty?: boolean;
  canManageRoles?: boolean;
}

export interface InteriorPwaNavItem {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  category: InteriorPwaModuleCategory;
  badge?: string;
}

export const INTERIOR_PWA_MODULES: readonly InteriorPwaNavItem[] = [
  {
    id: 'overview',
    label: 'Tổng quan Interior',
    shortLabel: 'Tổng quan',
    href: '/dashboard/interior',
    category: 'operations',
  },
  {
    id: 'projects',
    label: 'Danh sách dự án',
    shortLabel: 'Dự án',
    href: '/dashboard/interior/projects',
    category: 'operations',
  },
  {
    id: 'customers',
    label: 'Khách hàng',
    shortLabel: 'Khách hàng',
    href: '/dashboard/interior/customers',
    category: 'operations',
  },
  {
    id: 'schedule',
    label: 'Lịch công việc',
    shortLabel: 'Lịch',
    href: '/dashboard/interior/schedule',
    category: 'operations',
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    shortLabel: 'AI',
    href: '/dashboard/ai-copilot',
    category: 'operations',
  },
  {
    id: 'design',
    label: 'Design Studio',
    shortLabel: 'Thiết kế',
    href: '/dashboard/interior/design',
    category: 'design_commercial',
  },
  {
    id: 'boq',
    label: 'BOQ & Dự toán',
    shortLabel: 'BOQ',
    href: '/dashboard/interior/boq',
    category: 'design_commercial',
  },
  {
    id: 'contracts',
    label: 'Báo giá & Hợp đồng',
    shortLabel: 'Hợp đồng',
    href: '/dashboard/interior/contracts',
    category: 'design_commercial',
  },
  {
    id: 'finance',
    label: 'Thanh toán dự án',
    shortLabel: 'Thanh toán',
    href: '/dashboard/interior/finance',
    category: 'finance_admin',
  },
  {
    id: 'production',
    label: 'Sản xuất xưởng',
    shortLabel: 'Xưởng SX',
    href: '/dashboard/interior/production',
    category: 'production_site',
  },
  {
    id: 'inventory',
    label: 'Kho vật tư',
    shortLabel: 'Kho',
    href: '/dashboard/inventory',
    category: 'production_site',
  },
  {
    id: 'installation',
    label: 'Thi công lắp đặt',
    shortLabel: 'Lắp đặt',
    href: '/dashboard/interior/installation',
    category: 'production_site',
  },
  {
    id: 'site-diary',
    label: 'Nhật ký công trình PWA',
    shortLabel: 'Nhật ký',
    href: '/dashboard/interior/site-diary',
    category: 'production_site',
    badge: 'PWA',
  },
  {
    id: 'qc-handover',
    label: 'QC & Nghiệm thu',
    shortLabel: 'QC',
    href: '/dashboard/interior/qc-handover',
    category: 'production_site',
  },
  {
    id: 'warranty',
    label: 'Bảo hành & Hậu mãi',
    shortLabel: 'Bảo hành',
    href: '/dashboard/interior/warranty',
    category: 'production_site',
  },
  {
    id: 'reports',
    label: 'Báo cáo tổng hợp',
    shortLabel: 'Báo cáo',
    href: '/dashboard/interior/reports',
    category: 'finance_admin',
  },
  {
    id: 'accounting',
    label: 'Sổ cái kế toán TT99',
    shortLabel: 'Sổ cái',
    href: '/dashboard/accounting',
    category: 'finance_admin',
  },
  {
    id: 'roles',
    label: 'Nhân sự & Phân quyền',
    shortLabel: 'Phân quyền',
    href: '/dashboard/interior/roles',
    category: 'finance_admin',
  },
  {
    id: 'settings',
    label: 'Cài đặt hệ thống',
    shortLabel: 'Cài đặt',
    href: '/dashboard/settings?product=bella_interior',
    category: 'finance_admin',
  },
] as const;

const ROLE_BOTTOM_TAB_IDS: Record<InteriorRoleKey, readonly [string, string, string, string]> = {
  OWNER: ['overview', 'projects', 'site-diary', 'finance'],
  ADMIN: ['overview', 'projects', 'site-diary', 'roles'],
  EXECUTIVE: ['overview', 'projects', 'site-diary', 'reports'],
  PM: ['overview', 'projects', 'site-diary', 'qc-handover'],
  SITE_MANAGER: ['overview', 'projects', 'site-diary', 'qc-handover'],
  QC: ['overview', 'projects', 'qc-handover', 'site-diary'],
  PRODUCTION_MANAGER: ['overview', 'projects', 'production', 'qc-handover'],
  DESIGNER: ['overview', 'projects', 'design', 'boq'],
  QS: ['overview', 'projects', 'boq', 'contracts'],
  SALES: ['overview', 'customers', 'contracts', 'schedule'],
  ACCOUNTANT: ['overview', 'finance', 'accounting', 'reports'],
  WARRANTY: ['overview', 'projects', 'warranty', 'qc-handover'],
};

const DEFAULT_BOTTOM_TAB_IDS: readonly [string, string, string, string] = [
  'overview',
  'projects',
  'site-diary',
  'qc-handover',
];

function isModuleUnlockedByCapabilities(
  moduleId: string,
  capabilities?: InteriorPwaCapabilityFlags | null,
): boolean {
  if (!capabilities) return false;
  switch (moduleId) {
    case 'site-diary':
      return Boolean(
        capabilities.canReadDiaries
        || capabilities.canCreateDiary
        || capabilities.canUpdateDiary
        || capabilities.canUploadSitePhoto,
      );
    case 'installation':
      return Boolean(capabilities.canReadDiaries || capabilities.canCreateDiary || capabilities.canUpdateDiary);
    case 'qc-handover':
      return Boolean(capabilities.canReadQc || capabilities.canCreateQc);
    case 'production':
      return Boolean(capabilities.canReadProduction);
    case 'warranty':
      return Boolean(capabilities.canReadWarranty);
    case 'schedule':
      return Boolean(capabilities.canReadSchedule);
    case 'roles':
      return Boolean(capabilities.canManageRoles);
    default:
      return false;
  }
}

export function isInteriorPwaModuleAllowed(
  role: string | null | undefined,
  item: InteriorPwaNavItem,
  capabilities?: InteriorPwaCapabilityFlags | null,
): boolean {
  return isInteriorMenuItemAllowed(role, item.href) || isModuleUnlockedByCapabilities(item.id, capabilities);
}

/**
 * Returns all Bella Interior OS modules visible to the role (plus any directly-granted capabilities).
 */
export function getInteriorLaunchpadItems(
  role: string | null | undefined,
  capabilities?: InteriorPwaCapabilityFlags | null,
): InteriorPwaNavItem[] {
  return INTERIOR_PWA_MODULES.filter((item) => isInteriorPwaModuleAllowed(role, item, capabilities));
}

/**
 * Returns up to 4 tailored mobile bottom-bar items for a given Bella Interior role,
 * prioritizing runtime-granted field access when a role receives custom delegation.
 */
export function getInteriorBottomNavItems(
  role: string | null | undefined,
  capabilities?: InteriorPwaCapabilityFlags | null,
): InteriorPwaNavItem[] {
  const roleKey = normalizeInteriorRoleKey(role);
  const preferredIds = roleKey ? [...ROLE_BOTTOM_TAB_IDS[roleKey]] : [...DEFAULT_BOTTOM_TAB_IDS];

  // If a non-site role (e.g. DESIGNER, PRODUCTION_MANAGER) was explicitly granted site-diary write access,
  // promote site-diary into their 4th quick slot so they can open it in one tap on mobile.
  if (
    capabilities?.canCreateDiary
    && !preferredIds.includes('site-diary')
    && isModuleUnlockedByCapabilities('site-diary', capabilities)
  ) {
    preferredIds[3] = 'site-diary';
  }

  const byId = new Map(INTERIOR_PWA_MODULES.map((m) => [m.id, m]));
  const selected: InteriorPwaNavItem[] = [];

  for (const id of preferredIds) {
    const candidate = byId.get(id);
    if (candidate && isInteriorPwaModuleAllowed(role, candidate, capabilities)) {
      selected.push(candidate);
    }
  }

  if (selected.length < 4) {
    for (const item of getInteriorLaunchpadItems(role, capabilities)) {
      if (!selected.some((existing) => existing.id === item.id)) {
        selected.push(item);
      }
      if (selected.length === 4) break;
    }
  }

  return selected.slice(0, 4);
}

/**
 * Determines when the Bella Interior mobile PWA bottom shell should render.
 * Strictly isolated to Bella Interior product/routes so other verticals stay unchanged.
 */
export function isInteriorMobileShellPath(
  pathname: string | null | undefined,
  productKey?: string | null,
): boolean {
  if (!pathname) return false;
  if (pathname === '/dashboard/interior' || pathname.startsWith('/dashboard/interior/')) {
    return true;
  }
  return productKey === 'bella_interior' && (
    pathname === '/dashboard/inventory'
    || pathname === '/dashboard/accounting'
    || pathname.startsWith('/dashboard/accounting/')
    || pathname === '/dashboard/ai-copilot'
    || pathname === '/dashboard/settings'
  );
}
