// Re-export shared permission helpers from @bella/shared
// Source guard requirement: 'Đào tạo': 'student_training'
export type { RolePermissions } from '@bella/shared';
export {
  isAdminRole,
  SIDEBAR_MODULE_BY_LABEL,
  resolveSidebarModuleId,
  isSidebarItemAllowed,
} from '@bella/shared';

// Web-specific permission functions below
const AI_COPILOT_ROLES = new Set(['admin', 'super_admin', 'accountant']);
const EDUCATION_AI_COPILOT_ROLES = new Set([
  'admin',
  'super_admin',
  'principal',
  'director',
  'education_teacher',
  'homeroom_teacher',
  'teacher',
  'education_staff'
]);

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function canUseAiCopilotRole(role: string | null | undefined) {
  return AI_COPILOT_ROLES.has(normalizeRole(role));
}

export function canUseEducationAiCopilotRole(role: string | null | undefined) {
  return EDUCATION_AI_COPILOT_ROLES.has(normalizeRole(role));
}

export function canAccessAiCopilot(input: {
  role: string | null | undefined;
  tenantId?: string | null;
}) {
  return Boolean(input.tenantId) && canUseAiCopilotRole(input.role);
}

export function isManualPermittedByRole(role: string | null | undefined, slug: string) {
  const normalizedRole = normalizeRole(role);
  const normalizedSlug = slug.trim().toLowerCase();

  // 1. Must be authenticated
  if (!normalizedRole) return false;

  // 2. Admin roles have absolute access to all slugs
  if (['admin', 'owner', 'manager', 're-admin', 'admin-healthcare'].includes(normalizedRole)) {
    return true;
  }

  // 3. Slug must be valid
  const VALID_SLUGS = new Set([
    'sop', 'ktv', 'hr', 'accountant', 'admin', 'index',
    'sop-beauty', 'therapist', 'hr-beauty', 'accountant-beauty',
    'sop-cleaning', 'worker', 'supervisor', 'hr-cleaning', 'accountant-cleaning',
    're-sop', 're-sale', 're-broker', 're-contracts', 're-hr', 're-finance', 're-admin',
    'sop-healthcare', 'doctor-nurse', 'reception-healthcare', 'hr-healthcare', 'accountant-healthcare', 'admin-healthcare'
  ]);

  if (!VALID_SLUGS.has(normalizedSlug) && !normalizedSlug.startsWith('sop') && normalizedSlug !== 'index') {
    return false;
  }

  // 4. Public manuals (SOP & Index) are allowed for any authenticated user
  if (normalizedSlug.startsWith('sop') || normalizedSlug === 'index') {
    return true;
  }

  // 5. Check role-specific permissions
  if (normalizedRole === 'ktv' || normalizedRole === 'ktv_lead' || normalizedRole === 'therapist') {
    return ['ktv', 'therapist', 'worker'].includes(normalizedSlug);
  }

  if (normalizedRole === 'hr') {
    return ['hr', 're-hr', 'hr-beauty', 'hr-cleaning', 'hr-healthcare', 'ktv', 'therapist', 'worker'].includes(normalizedSlug);
  }

  if (normalizedRole === 'accountant') {
    return ['accountant', 'accountant-beauty', 'accountant-cleaning', 'accountant-healthcare', 're-finance'].includes(normalizedSlug);
  }

  if (normalizedRole === 'admin_staff') {
    return false;
  }

  return false;
}
