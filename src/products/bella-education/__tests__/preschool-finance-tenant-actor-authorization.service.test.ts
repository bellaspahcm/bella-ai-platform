import fs from 'fs';
import path from 'path';
import {
  resolvePreschoolFinanceActor,
  PreschoolFinanceUserProfile,
} from '../finance/services/preschool-finance-authorization.service';

const tenantId = 'tenant-preschool';
const adminProfile: PreschoolFinanceUserProfile = {
  id: 'admin-user',
  tenant_id: tenantId,
  role: 'admin',
};
const accountantProfile: PreschoolFinanceUserProfile = {
  id: 'accountant-user',
  tenant_id: tenantId,
  role: 'accountant',
};
const parentProfile: PreschoolFinanceUserProfile = {
  id: 'parent-user',
  tenant_id: tenantId,
  role: 'parent',
};

describe('Preschool Finance tenant and actor authorization', () => {
  it('allows existing admin role as server-derived finance principal', () => {
    const actor = resolvePreschoolFinanceActor(adminProfile, 'modify-invoice');

    expect(actor).toEqual({
      tenantId,
      actorId: 'admin-user',
      role: 'admin',
      educationRole: 'PRINCIPAL',
      isSuperAdmin: false,
    });
  });

  it('allows super_admin role as server-derived finance principal with isSuperAdmin flag', () => {
    const actor = resolvePreschoolFinanceActor({ id: 'super-admin-user', tenant_id: tenantId, role: 'super_admin' }, 'modify-invoice');

    expect(actor).toEqual({
      tenantId,
      actorId: 'super-admin-user',
      role: 'super_admin',
      educationRole: 'PRINCIPAL',
      isSuperAdmin: true,
    });
  });

  it('allows existing accountant role for payment reconciliation', () => {
    const actor = resolvePreschoolFinanceActor(accountantProfile, 'reconcile-payment');

    expect(actor).toEqual({
      tenantId,
      actorId: 'accountant-user',
      role: 'accountant',
      educationRole: 'ACCOUNTANT',
      isSuperAdmin: false,
    });
  });

  it('denies parent role for finance operations even when the tenant is valid', () => {
    expect(() => resolvePreschoolFinanceActor(parentProfile, 'read')).toThrow('AUTH_ROLE_PERMISSION_ERROR');
    expect(() => resolvePreschoolFinanceActor(parentProfile, 'modify-invoice')).toThrow('AUTH_ROLE_PERMISSION_ERROR');
    expect(() => resolvePreschoolFinanceActor(parentProfile, 'reconcile-payment')).toThrow('AUTH_ROLE_PERMISSION_ERROR');
  });

  it('requires authenticated user and tenant context', () => {
    expect(() => resolvePreschoolFinanceActor(null, 'read')).toThrow('FINANCE_UNAUTHENTICATED');
    expect(() => resolvePreschoolFinanceActor({ id: 'admin-user', role: 'admin' }, 'read')).toThrow('FINANCE_UNAUTHENTICATED');
    expect(() => resolvePreschoolFinanceActor({ tenant_id: tenantId, role: 'admin' }, 'read')).toThrow('FINANCE_UNAUTHENTICATED');
  });

  it('keeps tenant and actor authority server-side in the Finance UI/API boundary', () => {
    const pageSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/dashboard/education/finance/page.tsx'),
      'utf8',
    );
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/education/finance/route.ts'),
      'utf8',
    );

    expect(pageSource).not.toContain('DEFAULT_TENANT_ID');
    expect(pageSource).not.toContain('DEFAULT_STAFF_ID');
    expect(pageSource).not.toContain('DEFAULT_PARENT_ID');
    expect(pageSource).not.toContain("from('edu_fin_");
    expect(pageSource).toContain("fetch('/api/education/finance'");

    expect(routeSource).toContain('getCurrentUser()');
    expect(routeSource).toContain('resolvePreschoolFinanceActor');
    expect(routeSource).not.toContain('body.tenantId');
    expect(routeSource).not.toContain('body.createdBy');
    expect(routeSource).not.toContain('body.payerPartyId');
  });
});
