import fs from 'fs';
import path from 'path';
import {
  TuitionServicePeriodCompletionRepository,
  TuitionServicePeriodCompletionService,
} from '../finance/services/tuition-service-period-completion.service';
import {
  BillingPeriod,
  TuitionServicePeriodCompletion,
} from '../finance/domain/finance.types';
import {
  PreschoolFinanceUserProfile,
  resolvePreschoolFinanceActor,
} from '../finance/services/preschool-finance-authorization.service';

const tenantId = 'tenant-preschool';
const otherTenantId = 'tenant-other';
const billingPeriodId = 'period-october';
const actorId = 'operator-a';
const completedAt = '2026-11-02T08:30:00.000Z';

function makeBillingPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    id: billingPeriodId,
    tenantId,
    periodName: 'Configured Tuition Period',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    dueDate: '2026-11-05',
    status: 'ACTIVE',
    createdBy: 'staff-a',
    ...overrides,
  };
}

function makeCompletion(overrides: Partial<TuitionServicePeriodCompletion> = {}): TuitionServicePeriodCompletion {
  return {
    id: 'completion-october',
    tenantId,
    billingPeriodId,
    completedAt,
    completedBy: actorId,
    ...overrides,
  };
}

function makeRepoStub(options: {
  billingPeriod?: BillingPeriod | null;
  existingCompletion?: TuitionServicePeriodCompletion | null;
} = {}) {
  const calls = {
    created: [] as Array<Omit<TuitionServicePeriodCompletion, 'id' | 'createdAt'>>,
  };
  const billingPeriod = options.billingPeriod === undefined ? makeBillingPeriod() : options.billingPeriod;
  const existingCompletion = options.existingCompletion ?? null;

  const repo: TuitionServicePeriodCompletionRepository = {
    async getBillingPeriodById(inputTenantId: string, inputBillingPeriodId: string): Promise<BillingPeriod | null> {
      if (inputTenantId !== tenantId) return null;
      if (inputBillingPeriodId !== billingPeriodId) return null;
      return billingPeriod;
    },
    async getTuitionServicePeriodCompletion(
      inputTenantId: string,
      inputBillingPeriodId: string,
    ): Promise<TuitionServicePeriodCompletion | null> {
      if (inputTenantId !== tenantId) return null;
      if (inputBillingPeriodId !== billingPeriodId) return null;
      return existingCompletion;
    },
    async createTuitionServicePeriodCompletion(
      data: Omit<TuitionServicePeriodCompletion, 'id' | 'createdAt'>,
    ): Promise<TuitionServicePeriodCompletion> {
      calls.created.push(data);
      return makeCompletion(data);
    },
  };

  return { repo, calls };
}

describe('Preschool tuition service period completion operation', () => {
  test('authorized admin can complete a tenant billing period with server-derived identity', async () => {
    const { repo, calls } = makeRepoStub();
    const service = new TuitionServicePeriodCompletionService(repo, () => new Date(completedAt));

    const result = await service.completePeriod({
      tenantId,
      billingPeriodId,
      completedBy: actorId,
    });

    expect(result.alreadyCompleted).toBe(false);
    expect(result.completion).toMatchObject({
      tenantId,
      billingPeriodId,
      completedAt,
      completedBy: actorId,
    });
    expect(calls.created).toEqual([{
      tenantId,
      billingPeriodId,
      completedAt,
      completedBy: actorId,
    }]);
  });

  test('foreign or missing billing period fails closed before persistence', async () => {
    const missing = makeRepoStub({ billingPeriod: null });
    const service = new TuitionServicePeriodCompletionService(missing.repo, () => new Date(completedAt));

    await expect(service.completePeriod({
      tenantId,
      billingPeriodId,
      completedBy: actorId,
    })).rejects.toThrow('PRESCHOOL_TUITION_SERVICE_PERIOD_NOT_FOUND');
    expect(missing.calls.created).toHaveLength(0);

    const foreign = makeRepoStub();
    await expect(new TuitionServicePeriodCompletionService(
      foreign.repo,
      () => new Date(completedAt),
    ).completePeriod({
      tenantId: otherTenantId,
      billingPeriodId,
      completedBy: actorId,
    })).rejects.toThrow('PRESCHOOL_TUITION_SERVICE_PERIOD_NOT_FOUND');
    expect(foreign.calls.created).toHaveLength(0);
  });

  test('non-active billing period fails closed', async () => {
    const { repo, calls } = makeRepoStub({
      billingPeriod: makeBillingPeriod({ status: 'DRAFT' }),
    });
    const service = new TuitionServicePeriodCompletionService(repo, () => new Date(completedAt));

    await expect(service.completePeriod({
      tenantId,
      billingPeriodId,
      completedBy: actorId,
    })).rejects.toThrow('PRESCHOOL_TUITION_SERVICE_PERIOD_NOT_ACTIVE');
    expect(calls.created).toHaveLength(0);
  });

  test('duplicate completion returns existing evidence without creating another row', async () => {
    const existing = makeCompletion({ id: 'existing-completion' });
    const { repo, calls } = makeRepoStub({ existingCompletion: existing });
    const service = new TuitionServicePeriodCompletionService(repo, () => new Date(completedAt));

    const result = await service.completePeriod({
      tenantId,
      billingPeriodId,
      completedBy: actorId,
    });

    expect(result).toEqual({
      completion: existing,
      alreadyCompleted: true,
    });
    expect(calls.created).toHaveLength(0);
  });

  test('authorization allows admin/accountant and denies parent for completion action', () => {
    const adminProfile: PreschoolFinanceUserProfile = { id: 'admin-a', tenant_id: tenantId, role: 'admin' };
    const accountantProfile: PreschoolFinanceUserProfile = { id: 'acct-a', tenant_id: tenantId, role: 'accountant' };
    const parentProfile: PreschoolFinanceUserProfile = { id: 'parent-a', tenant_id: tenantId, role: 'parent' };

    expect(resolvePreschoolFinanceActor(adminProfile, 'complete-service-period').actorId).toBe('admin-a');
    expect(resolvePreschoolFinanceActor(accountantProfile, 'complete-service-period').actorId).toBe('acct-a');
    expect(() => resolvePreschoolFinanceActor(parentProfile, 'complete-service-period'))
      .toThrow('AUTH_ROLE_PERMISSION_ERROR');
  });

  test('branch API and UI deny tenant-wide completion without inventing branch semantics', () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/education/finance/route.ts'),
      'utf8',
    );
    const pageSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/dashboard/education/finance/page.tsx'),
      'utf8',
    );

    expect(routeSource).toContain("action === 'completeTuitionServicePeriod'");
    expect(routeSource).toContain('Tenant-wide completion is unavailable in branch Finance.');
    expect(routeSource).toContain('tenantId: actor.tenantId');
    expect(routeSource).not.toContain('body.completedBy');
    expect(routeSource).not.toContain('body.completedAt');
    expect(routeSource).not.toContain('body.tenantId');
    expect(routeSource).not.toContain('recognizeCompletedPeriodTuition');
    expect(routeSource).not.toContain('TUITION_SERVICE_RECOGNIZED');
    expect(routeSource).not.toContain('finance_transactions');
    expect(routeSource).not.toContain('131');
    expect(routeSource).not.toContain('511');

    expect(pageSource).toContain("financeCommand('completeTuitionServicePeriod'");
    expect(pageSource).toContain('Xác nhận hoàn thành');
    expect(pageSource).toContain('Xác nhận kỳ toàn trường chưa khả dụng trong luồng theo cơ sở.');
  });
});
