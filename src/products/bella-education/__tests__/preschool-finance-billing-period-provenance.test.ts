import fs from 'fs';
import path from 'path';

describe('Preschool P7 billing-period provenance', () => {
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/education/finance/route.ts'),
    'utf8',
  );

  const pageSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/dashboard/education/finance/page.tsx'),
    'utf8',
  );

  it('does not manufacture an implicit September 2026 billing period in the invoice API', () => {
    expect(routeSource).not.toContain('Kỳ Thu Tháng 9/2026');
    expect(routeSource).not.toContain('2026-09-01');
    expect(routeSource).not.toContain('2026-09-30');
    expect(routeSource).not.toContain('createBillingPeriod({');
  });

  it('requires a tenant-scoped configured billing period for invoice compilation', () => {
    expect(routeSource).toContain('billingPeriodId = asString(body.billingPeriodId);');
    expect(routeSource).toContain('FINANCE_BILLING_PERIOD_REQUIRED');
    expect(routeSource).toContain('repo.readBranchState(actor.tenantId, actor.actorId, branchId)');
    expect(routeSource).toContain('state.billingPeriods.find(period => period.id === billingPeriodId)');
    expect(routeSource).toContain('FINANCE_BILLING_PERIOD_NOT_FOUND: Active tenant billing period required.');
    expect(routeSource).toContain('dueDate: period.dueDate');
    expect(routeSource).not.toContain('body.dueDate');
  });

  it('lets the UI select a real active billing period instead of sending source-code dates', () => {
    expect(pageSource).not.toContain("useState<string>('2026-08-01')");
    expect(pageSource).not.toContain('Tháng 9/2026');
    expect(pageSource).not.toContain('15/09/2026');
    expect(pageSource).toContain('billingPeriods?: BillingPeriod[]');
    expect(pageSource).toContain('billingPeriodId: targetBillingPeriod.id');
    expect(pageSource).toContain('Chưa có kỳ thu học phí ACTIVE hợp lệ');
  });
});
