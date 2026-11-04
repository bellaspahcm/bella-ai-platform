import {
  EducationRole,
  EducationSecurityGuardService,
  SecurityUserContext,
} from '../../security/education-security-guard.service';

export type PreschoolFinanceOperation =
  | 'read'
  | 'modify-invoice'
  | 'complete-service-period'
  | 'reconcile-payment'
  | 'resolve-exception';

export interface PreschoolFinanceUserProfile {
  id?: string | null;
  tenant_id?: string | null;
  role?: string | null;
}

export interface PreschoolFinanceActorContext {
  tenantId: string;
  actorId: string;
  role: 'admin' | 'accountant' | 'super_admin' | 'owner';
  educationRole: Extract<EducationRole, 'PRINCIPAL' | 'ACCOUNTANT'>;
  isSuperAdmin: boolean;
}

const guard = new EducationSecurityGuardService();

function mapBellaRole(role: string): PreschoolFinanceActorContext['educationRole'] | null {
  if (role === 'admin' || role === 'super_admin' || role === 'owner') return 'PRINCIPAL';
  if (role === 'accountant') return 'ACCOUNTANT';
  return null;
}

export function resolvePreschoolFinanceActor(
  profile: PreschoolFinanceUserProfile | null,
  operation: PreschoolFinanceOperation,
): PreschoolFinanceActorContext {
  const actorId = profile?.id?.trim() ?? '';
  const tenantId = profile?.tenant_id?.trim() ?? '';
  const role = profile?.role?.trim().toLowerCase() ?? '';

  if (!actorId || !tenantId) {
    throw new Error('FINANCE_UNAUTHENTICATED: Authenticated finance operator and tenant are required.');
  }

  const educationRole = mapBellaRole(role);
  if (!educationRole || (role !== 'admin' && role !== 'accountant' && role !== 'super_admin' && role !== 'owner')) {
    throw new Error(`AUTH_ROLE_PERMISSION_ERROR: Role '${role || 'unknown'}' is not authorized for Preschool Finance operations.`);
  }

  const isSuperAdmin = role === 'super_admin' || role === 'owner';

  const securityContext: SecurityUserContext = {
    userId: actorId,
    tenantId,
    role: educationRole,
  };

  if (operation === 'reconcile-payment') {
    guard.assertCanReconcilePayment(securityContext);
  } else if (operation === 'resolve-exception') {
    guard.assertCanResolveStaffWorkQueue(securityContext);
  } else {
    guard.assertCanModifyInvoice(securityContext);
  }

  return {
    tenantId,
    actorId,
    role: role as PreschoolFinanceActorContext['role'],
    educationRole,
    isSuperAdmin,
  };
}
