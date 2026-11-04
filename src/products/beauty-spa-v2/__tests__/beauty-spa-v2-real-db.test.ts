import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

import { GET as runAccountingWorker } from '@/app/api/cron/accounting-worker/route';
import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import { FINANCE_RECEIVABLE_SEMANTICS } from '@/platform/finance/contracts/receivable-charge.contract';
import type { Database } from '@/types/database.types';
import type {
  Clock,
  IdGenerator,
  ResourceAllocationRepository,
  ResourceAvailabilityPort,
  SessionRepository,
} from '@/platform/beauty/application/ports';
import type {
  ResourceAllocationHistoryRecord,
  ResourceAllocationRecord,
  ResourceCapacityWindow,
  SessionRecord,
  TimeInterval,
} from '@/platform/beauty/contracts';
import {
  SupabaseBeautyAppointmentRepository,
  SupabaseBeautyProfessionalAssignmentRepository,
  SupabaseBeautyResourceAllocationRepository,
  SupabaseBeautySessionRepository,
  type BeautyH8Database,
} from '@/platform/beauty/infrastructure';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';

import {
  BeautySpaV2Service,
  type BeautySpaSessionFinanceOutboxPort,
  type SpaStaffAvailabilityPort,
} from '../service';
import { BeautySpaAccountingOutboxPort } from '../finance-outbox';

jest.setTimeout(120_000);

type SeedClient = SupabaseClient<Database>;
type BeautyClient = SupabaseClient<BeautyH8Database>;

function hasRealSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

class UuidIds implements IdGenerator {
  public next(): string {
    return randomUUID();
  }
}

class IncrementingClock implements Clock {
  private readonly base = Date.parse('2026-10-02T03:00:00.000Z');
  private ticks = 0;

  public now(): string {
    this.ticks += 1;
    return new Date(this.base + this.ticks * 60_000).toISOString();
  }
}

class FixedAvailability implements ResourceAvailabilityPort {
  public async getWindow(scope: { tenantId: string; resourceId: string; interval: TimeInterval }): Promise<ResourceCapacityWindow> {
    return {
      tenantId: scope.tenantId,
      resourceId: scope.resourceId,
      interval: scope.interval,
      capacityUnits: 1,
      unavailable: false,
    };
  }
}

class AlwaysAvailableStaff implements SpaStaffAvailabilityPort {
  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function isRejected<T>(result: PromiseSettledResult<T>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

class TwoPartyBarrier {
  private arrivals = 0;
  private readonly released: Promise<void>;
  private release: (() => void) | null = null;

  public constructor(private readonly label: string) {
    this.released = new Promise((resolve) => {
      this.release = resolve;
    });
  }

  public async wait(): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals === 2) {
      this.release?.();
    }

    await Promise.race([
      this.released,
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error(`${this.label} barrier timed out`)), 10_000);
      }),
    ]);
  }
}

class BarrieredResourceAllocationRepository implements ResourceAllocationRepository {
  private readonly barrier = new TwoPartyBarrier('Beauty V2 concurrent resource activation');

  public constructor(
    private readonly inner: ResourceAllocationRepository,
    private readonly resourceId: string,
  ) {}

  public create(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    return this.inner.create(allocation);
  }

  public async update(allocation: ResourceAllocationRecord): Promise<ResourceAllocationRecord> {
    if (allocation.resourceId === this.resourceId && allocation.status === 'ACTIVE') {
      await this.barrier.wait();
    }
    return this.inner.update(allocation);
  }

  public appendHistory(history: ResourceAllocationHistoryRecord): Promise<ResourceAllocationHistoryRecord> {
    return this.inner.appendHistory(history);
  }

  public listActive(scope: { tenantId: string; resourceId: string }): Promise<ResourceAllocationRecord[]> {
    return this.inner.listActive(scope);
  }
}

class FailingCompletionSessionRepository implements SessionRepository {
  private failedCompletion = false;

  public constructor(
    private readonly inner: SessionRepository,
    private readonly sessionId: string,
  ) {}

  public create(session: SessionRecord): Promise<SessionRecord> {
    return this.inner.create(session);
  }

  public update(session: SessionRecord): Promise<SessionRecord> {
    if (
      session.id === this.sessionId
      && session.status === 'COMPLETED'
      && !this.failedCompletion
    ) {
      this.failedCompletion = true;
      throw new Error('session completion failed after start persisted');
    }

    return this.inner.update(session);
  }

  public getById(scope: { tenantId: string; sessionId: string }): Promise<SessionRecord | null> {
    return this.inner.getById(scope);
  }
}

describeWithRealSupabase('Bella Beauty Spa v2 Real DB business proof', () => {
  const marker = `beauty-v2-real-db-${Date.now()}`;
  const created = {
    tenants: [] as string[],
    customers: [] as string[],
    financeTenants: [] as string[],
  };

  let seedClient: SeedClient;
  let beautyClient: BeautyClient;

  beforeAll(() => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    seedClient = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    beautyClient = createSupabaseClient<BeautyH8Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  function isAppendOnlyHistoryError(error: { message: string } | null): boolean {
    return Boolean(error?.message.match(/Beauty OS history tables are append-only|append-only/i));
  }

  async function cleanup(label: string, result: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await result;
    if (error) {
      throw new Error(`${label} cleanup failed: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!beautyClient || !seedClient) return;

    let retainedImmutableHistory = false;

    for (const tenantId of created.tenants) {
      const resourceHistoryCleanup = await beautyClient.from('beauty_resource_allocation_history').delete().eq('tenant_id', tenantId);
      const assignmentHistoryCleanup = await beautyClient.from('beauty_professional_assignment_history').delete().eq('tenant_id', tenantId);

      if (isAppendOnlyHistoryError(resourceHistoryCleanup.error) || isAppendOnlyHistoryError(assignmentHistoryCleanup.error)) {
        retainedImmutableHistory = true;
        console.warn(
          `[Beauty Spa V2 Real DB cleanup] retained immutable Beauty history fixture for tenant ${tenantId}; append-only contract rejects runtime cleanup.`,
        );
        continue;
      }
      if (resourceHistoryCleanup.error) {
        throw new Error(`beauty_resource_allocation_history cleanup failed: ${resourceHistoryCleanup.error.message}`);
      }
      if (assignmentHistoryCleanup.error) {
        throw new Error(`beauty_professional_assignment_history cleanup failed: ${assignmentHistoryCleanup.error.message}`);
      }
      await cleanup('beauty_sessions', beautyClient.from('beauty_sessions').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_resource_allocations', beautyClient.from('beauty_resource_allocations').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_professional_assignments', beautyClient.from('beauty_professional_assignments').delete().eq('tenant_id', tenantId));
      await cleanup('beauty_appointments', beautyClient.from('beauty_appointments').delete().eq('tenant_id', tenantId));
    }

    if (!retainedImmutableHistory && created.financeTenants.length === 0 && created.customers.length > 0) {
      await cleanup('customers', seedClient.from('customers').delete().in('id', created.customers));
    } else if (retainedImmutableHistory && created.customers.length > 0) {
      console.warn(
        `[Beauty Spa V2 Real DB cleanup] retained customer fixture(s) because immutable Beauty history references the booking chain: ${created.customers.join(', ')}`,
      );
    } else if (created.financeTenants.length > 0 && created.customers.length > 0) {
      console.warn(
        `[Beauty Spa V2 Real DB cleanup] retained customer fixture(s) because immutable Finance control facts reference the Beauty AR chain: ${created.customers.join(', ')}`,
      );
    }
    if (created.tenants.length > 0) {
      console.warn(
        `[Beauty Spa V2 Real DB cleanup] retained tenant fixture(s): ${created.tenants.join(', ')}`,
      );
    }
  });

  async function insertTenant(label: string): Promise<string> {
    const { data, error } = await seedClient
      .from('tenants')
      .insert({
        name: `${marker}-${label}`,
        status: 'active',
        product_key: 'bella_spa',
        enabled_modules: {
          beauty_spa: true,
          babycare: false,
          payroll: true,
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.tenants.push(data!.id);
    return data!.id;
  }

  async function insertCustomer(tenantId: string, label: string): Promise<string> {
    const { data, error } = await seedClient
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name_mother: `${marker}-${label}`,
        phone: `05${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
        status: 'active',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.customers.push(data!.id);
    return data!.id;
  }

  async function seedFinanceFoundation(tenantId: string): Promise<void> {
    const { error: accountingAccountsError } = await seedClient
      .from('accounting_accounts')
      .insert([
        {
          tenant_id: tenantId,
          account_code: '3387',
          account_name: `${marker} unearned revenue`,
          account_type: 'LIABILITY',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          account_code: '131',
          account_name: `${marker} receivable`,
          account_type: 'ASSET',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          account_code: '5113',
          account_name: `${marker} service revenue`,
          account_type: 'REVENUE',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          account_code: '6421',
          account_name: `${marker} commission expense`,
          account_type: 'EXPENSE',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          account_code: '334',
          account_name: `${marker} payroll payable`,
          account_type: 'LIABILITY',
          is_active: true,
        },
      ]);
    expect(accountingAccountsError).toBeNull();

    const { error: periodError } = await seedClient
      .from('finance_accounting_periods')
      .insert({
        tenant_id: tenantId,
        name: `${marker}-FY2026`,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        status: 'OPEN',
      });
    expect(periodError).toBeNull();

    const { data: accounts, error: accountsError } = await seedClient
      .from('finance_accounts')
      .insert([
        {
          tenant_id: tenantId,
          code: '131',
          name: `${marker} finance receivable`,
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: '511',
          name: `${marker} finance service revenue`,
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: '112',
          name: `${marker} finance bank`,
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
      ])
      .select('id, code');
    expect(accountsError).toBeNull();

    const bankAccount = accounts?.find((account) => account.code === '112');
    expect(bankAccount?.id).toBeTruthy();

    const { error: bankError } = await seedClient
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantId,
        account_number: `${marker}-${tenantId.slice(0, 8)}-112`,
        account_name: `${marker} Beauty bank`,
        bank_name: 'Beauty Proof Bank',
        currency: 'VND',
        linked_finance_account_id: bankAccount!.id,
        is_active: true,
      });
    expect(bankError).toBeNull();

    for (const [semanticKey, accountCode] of [
      [FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE, '131'],
      [FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE, '511'],
    ] as const) {
      const { error } = await seedClient.from('finance_control_account_mappings').insert({
          tenant_id: tenantId,
          control_type: semanticKey,
          account_code: accountCode,
          effective_from: '2026-01-01',
          effective_to: null,
          authority_version: 'VI_TT99_2025|99/2025/TT-BTC|PROVEN',
      });
      expect(error).toBeNull();
    }

    created.financeTenants.push(tenantId);
  }

  function createService(
    allocationRepo: ResourceAllocationRepository = new SupabaseBeautyResourceAllocationRepository(beautyClient),
    sessionRepo: SessionRepository = new SupabaseBeautySessionRepository(beautyClient),
    financeOutbox?: BeautySpaSessionFinanceOutboxPort,
  ) {
    const appointmentRepo = new SupabaseBeautyAppointmentRepository(beautyClient);
    const assignmentRepo = new SupabaseBeautyProfessionalAssignmentRepository(beautyClient);
    const service = new BeautySpaV2Service(
      appointmentRepo,
      assignmentRepo,
      allocationRepo,
      sessionRepo,
      new FixedAvailability(),
      new AlwaysAvailableStaff(),
      new UuidIds(),
      new IncrementingClock(),
      undefined,
      financeOutbox,
    );
    return { service, appointmentRepo, sessionRepo };
  }

  it('persists booking, read-back, tenant scoping, history, rollback, retry, and checkout evidence', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    const customerA = await insertCustomer(tenantA, 'customer-a');
    const { service, appointmentRepo, sessionRepo } = createService();

    const interval: TimeInterval = {
      startsAt: '2026-10-02T10:00:00.000Z',
      endsAt: '2026-10-02T11:00:00.000Z',
    };
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const therapistId = randomUUID();
    const actorId = randomUUID();
    const occupiedResourceId = randomUUID();
    const retryResourceId = randomUUID();

    await service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: therapistId,
      resources: [{
        resourceId: occupiedResourceId,
        resourceType: 'ROOM',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: 'BOOKING',
    });

    await expect(service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: randomUUID(),
      resources: [
        {
          resourceId: retryResourceId,
          resourceType: 'BED',
          segmentId: randomUUID(),
        },
        {
          resourceId: occupiedResourceId,
          resourceType: 'ROOM',
          segmentId: randomUUID(),
        },
      ],
      actorId,
      bookingMode: 'WALK_IN',
    })).rejects.toMatchObject({ code: 'RESOURCE_CAPACITY_CONFLICT' });

    const { data: rolledBackRows, error: rollbackReadError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('id, tenant_id, resource_id, status, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('resource_id', retryResourceId);
    expect(rollbackReadError).toBeNull();
    expect(rolledBackRows).toEqual([
      expect.objectContaining({
        tenant_id: tenantA,
        resource_id: retryResourceId,
        status: 'DISRUPTED',
        reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
        actor_id: actorId,
      }),
    ]);

    const { data: allocationHistory, error: allocationHistoryError } = await beautyClient
      .from('beauty_resource_allocation_history')
      .select('event_type, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('event_type', 'BOOKING_ALLOCATION_ROLLED_BACK');
    expect(allocationHistoryError).toBeNull();
    expect(allocationHistory).toEqual([
      expect.objectContaining({
        event_type: 'BOOKING_ALLOCATION_ROLLED_BACK',
        reason: 'BOOKING_RESOURCE_ALLOCATION_FAILED',
        actor_id: actorId,
      }),
    ]);

    const { data: assignmentHistory, error: assignmentHistoryError } = await beautyClient
      .from('beauty_professional_assignment_history')
      .select('event_type, reason, actor_id')
      .eq('tenant_id', tenantA)
      .eq('event_type', 'BOOKING_ASSIGNMENT_ROLLED_BACK');
    expect(assignmentHistoryError).toBeNull();
    expect(assignmentHistory).toHaveLength(1);
    expect(assignmentHistory?.[0]).toEqual(expect.objectContaining({
      reason: 'BOOKING_ORCHESTRATION_FAILED',
      actor_id: actorId,
    }));

    const retried = await service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: therapistId,
      resources: [{
        resourceId: retryResourceId,
        resourceType: 'BED',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: 'BOOKING',
    });

    const crossTenantAppointment = await appointmentRepo.getById({
      tenantId: tenantB,
      appointmentId: retried.appointment.id,
    });
    expect(crossTenantAppointment).toBeNull();

    const { data: appointmentReadback, error: appointmentReadbackError } = await beautyClient
      .from('beauty_appointments')
      .select('id, tenant_id, customer_id, branch_id, service_id, status')
      .eq('tenant_id', tenantA)
      .eq('id', retried.appointment.id)
      .single();
    expect(appointmentReadbackError).toBeNull();
    expect(appointmentReadback).toEqual(expect.objectContaining({
      id: retried.appointment.id,
      tenant_id: tenantA,
      customer_id: customerA,
      branch_id: branchId,
      service_id: serviceId,
      status: 'PENDING',
    }));

    const plannedSession: SessionRecord = await sessionRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      appointmentId: retried.appointment.id,
      serviceCommitmentId: retried.serviceCommitmentId,
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });

    const completed = await service.completeSession({
      session: plannedSession,
      performerId: therapistId,
      outcome: {
        checkedOutBy: actorId,
        customerHistoryNote: 'Real DB Beauty V2 checkout evidence persisted.',
        packageSessionUsed: true,
        paymentStatus: 'PAID',
        inventoryHandoff: 'NOT_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['BEAUTY_V2_REAL_DB', 'CHECKOUT_EVIDENCE'],
      },
    });
    expect(completed.status).toBe('COMPLETED');

    const crossTenantSession = await sessionRepo.getById({
      tenantId: tenantB,
      sessionId: plannedSession.id,
    });
    expect(crossTenantSession).toBeNull();

    const { data: completedSession, error: completedSessionError } = await beautyClient
      .from('beauty_sessions')
      .select('id, tenant_id, status, actual_performer_id, outcome')
      .eq('tenant_id', tenantA)
      .eq('id', plannedSession.id)
      .single();
    expect(completedSessionError).toBeNull();
    expect(completedSession).toEqual(expect.objectContaining({
      id: plannedSession.id,
      tenant_id: tenantA,
      status: 'COMPLETED',
      actual_performer_id: therapistId,
    }));

    const checkoutOutcome = JSON.parse(completedSession!.outcome ?? '{}') as {
      paymentStatus?: string;
      auditTags?: string[];
    };
    expect(checkoutOutcome.paymentStatus).toBe('PAID');
    expect(checkoutOutcome.auditTags).toEqual(expect.arrayContaining(['BEAUTY_V2_REAL_DB']));
  });

  it('proves Real DB rejects concurrent active allocations for the same resource and interval', async () => {
    const tenantA = await insertTenant('concurrency-tenant');
    const customerA = await insertCustomer(tenantA, 'concurrency-customer');
    const resourceId = randomUUID();
    const allocationRepo = new BarrieredResourceAllocationRepository(
      new SupabaseBeautyResourceAllocationRepository(beautyClient),
      resourceId,
    );
    const { service } = createService(allocationRepo);

    const interval: TimeInterval = {
      startsAt: '2026-10-02T14:00:00.000Z',
      endsAt: '2026-10-02T15:00:00.000Z',
    };
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const actorId = randomUUID();

    const book = (label: string) => service.bookService({
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval,
      leadProfessionalId: randomUUID(),
      resources: [{
        resourceId,
        resourceType: 'ROOM',
        segmentId: randomUUID(),
      }],
      actorId,
      bookingMode: label === 'request-a' ? 'BOOKING' : 'WALK_IN',
    });

    const results = await Promise.allSettled([
      book('request-a'),
      book('request-b'),
    ]);

    const fulfilled = results.filter(isFulfilled);
    const rejected = results.filter(isRejected);
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toMatch(/resource allocation|conflict|overlap|constraint/i);

    const { data: activeRows, error: activeRowsError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('id, tenant_id, resource_id, starts_at, ends_at, status')
      .eq('tenant_id', tenantA)
      .eq('resource_id', resourceId)
      .eq('status', 'ACTIVE');
    expect(activeRowsError).toBeNull();
    expect(activeRows).toHaveLength(1);
    const activeRow = activeRows![0];
    expect(activeRow).toEqual(expect.objectContaining({
      tenant_id: tenantA,
      resource_id: resourceId,
      status: 'ACTIVE',
    }));
    expect(new Date(activeRow.starts_at).toISOString()).toBe(interval.startsAt);
    expect(new Date(activeRow.ends_at).toISOString()).toBe(interval.endsAt);

    const { data: allRows, error: allRowsError } = await beautyClient
      .from('beauty_resource_allocations')
      .select('status')
      .eq('tenant_id', tenantA)
      .eq('resource_id', resourceId);
    expect(allRowsError).toBeNull();
    expect(allRows?.map((row) => row.status).sort()).toEqual(['ACTIVE', 'DISRUPTED']);
  });

  it('wires a completed H8 session to SESSION_DONE outbox, worker, journal, and F3 receivable facts', async () => {
    const tenantA = await insertTenant('finance-wiring-tenant');
    await seedFinanceFoundation(tenantA);
    const customerA = await insertCustomer(tenantA, 'finance-wiring-customer');
    const financeOutbox = new BeautySpaAccountingOutboxPort(seedClient);
    const { service, appointmentRepo, sessionRepo } = createService(
      new SupabaseBeautyResourceAllocationRepository(beautyClient),
      new SupabaseBeautySessionRepository(beautyClient),
      financeOutbox,
    );
    const branchId = randomUUID();
    const serviceId = randomUUID();
    const therapistId = randomUUID();
    const actorId = randomUUID();

    const appointment = await appointmentRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      branchId,
      customerId: customerA,
      serviceId,
      interval: {
        startsAt: '2026-10-02T18:00:00.000Z',
        endsAt: '2026-10-02T19:00:00.000Z',
      },
      status: 'PENDING',
    });
    const plannedSession = await sessionRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      appointmentId: appointment.id,
      serviceCommitmentId: randomUUID(),
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });

    const completed = await service.completeSession({
      session: plannedSession,
      performerId: therapistId,
      outcome: {
        checkedOutBy: actorId,
        customerHistoryNote: 'Beauty V2 finance wiring proof persisted.',
        packageSessionUsed: false,
        paymentStatus: 'FINANCE_HANDOFF_REQUIRED',
        inventoryHandoff: 'NOT_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['BEAUTY_V2_FINANCE_WIRING_PROOF'],
      },
      financeHandoff: {
        earnedRevenueAmount: 150000,
        deferredRevenueAmount: 0,
        receivableAmount: 150000,
        commissionAmount: 0,
        description: `${marker} Beauty V2 H8 SESSION_DONE`,
      },
    });
    expect(completed.status).toBe('COMPLETED');

    const { data: outboxBeforeWorker, error: outboxBeforeWorkerError } = await seedClient
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, status, payload')
      .eq('tenant_id', tenantA)
      .eq('event_type', 'SESSION_DONE')
      .eq('reference_type', 'BEAUTY_SESSION')
      .eq('reference_id', plannedSession.id)
      .single();
    expect(outboxBeforeWorkerError).toBeNull();
    expect(outboxBeforeWorker).toEqual(expect.objectContaining({
      tenant_id: tenantA,
      event_type: 'SESSION_DONE',
      reference_type: 'BEAUTY_SESSION',
      reference_id: plannedSession.id,
      status: 'PENDING',
    }));

    const priorCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = `${marker}-cron-secret`;
    try {
      const response = await runAccountingWorker(new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }));
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.successCount).toBeGreaterThanOrEqual(1);
    } finally {
      if (priorCronSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = priorCronSecret;
      }
    }

    const { data: outboxAfterWorker, error: outboxAfterWorkerError } = await seedClient
      .from('accounting_outbox')
      .select('id, status, journal_entry_id')
      .eq('tenant_id', tenantA)
      .eq('id', outboxBeforeWorker!.id)
      .single();
    expect(outboxAfterWorkerError).toBeNull();
    expect(outboxAfterWorker).toEqual(expect.objectContaining({
      status: 'COMPLETED',
    }));
    expect(outboxAfterWorker?.journal_entry_id).toBeTruthy();

    const { data: journal, error: journalError } = await seedClient
      .from('journal_entries')
      .select('id, tenant_id, reference_type, reference_id, status')
      .eq('tenant_id', tenantA)
      .eq('reference_type', 'SESSION_DONE')
      .eq('reference_id', plannedSession.id)
      .single();
    expect(journalError).toBeNull();
    expect(journal).toEqual(expect.objectContaining({
      tenant_id: tenantA,
      reference_type: 'SESSION_DONE',
      reference_id: plannedSession.id,
      status: 'POSTED',
    }));

    const { data: invoice, error: invoiceError } = await seedClient
      .from('finance_invoices')
      .select('id, tenant_id, status, metadata')
      .eq('tenant_id', tenantA)
      .eq('metadata->>business_source_type', 'BEAUTY_SESSION_DONE')
      .eq('metadata->>business_source_id', plannedSession.id)
      .single();
    expect(invoiceError).toBeNull();
    expect(invoice).toEqual(expect.objectContaining({
      tenant_id: tenantA,
      status: 'FINALIZED',
    }));

    const { data: position, error: positionError } = await seedClient
      .from('finance_receivable_positions')
      .select('id, invoice_id, customer_id, original_amount_minor, outstanding_amount_minor')
      .eq('tenant_id', tenantA)
      .eq('invoice_id', invoice!.id)
      .single();
    expect(positionError).toBeNull();
    expect(position).toEqual(expect.objectContaining({
      invoice_id: invoice!.id,
      customer_id: customerA,
      original_amount_minor: 150000,
      outstanding_amount_minor: 150000,
    }));

    const { count: ledgerCount, error: ledgerError } = await seedClient
      .from('finance_receivable_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantA)
      .eq('invoice_id', invoice!.id);
    expect(ledgerError).toBeNull();
    expect(ledgerCount).toBeGreaterThanOrEqual(1);
  });

  it('rolls back a persisted session start when Real DB completion update fails', async () => {
    const tenantA = await insertTenant('session-rollback-tenant');
    const customerA = await insertCustomer(tenantA, 'session-rollback-customer');
    const realSessionRepo = new SupabaseBeautySessionRepository(beautyClient);
    const { appointmentRepo } = createService();

    const interval: TimeInterval = {
      startsAt: '2026-10-02T16:00:00.000Z',
      endsAt: '2026-10-02T17:00:00.000Z',
    };
    const appointment = await appointmentRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      branchId: randomUUID(),
      customerId: customerA,
      serviceId: randomUUID(),
      interval,
      status: 'PENDING',
    });
    const plannedSession = await realSessionRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      appointmentId: appointment.id,
      serviceCommitmentId: randomUUID(),
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });
    const failingSessionRepo = new FailingCompletionSessionRepository(realSessionRepo, plannedSession.id);
    const { service } = createService(
      new SupabaseBeautyResourceAllocationRepository(beautyClient),
      failingSessionRepo,
    );

    await expect(service.completeSession({
      session: plannedSession,
      performerId: randomUUID(),
      outcome: {
        checkedOutBy: randomUUID(),
        customerHistoryNote: 'Completion failure should restore the planned session state.',
        packageSessionUsed: false,
        paymentStatus: 'FINANCE_HANDOFF_REQUIRED',
        inventoryHandoff: 'NOT_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['BEAUTY_V2_REAL_DB', 'SESSION_ROLLBACK'],
      },
    })).rejects.toThrow('session completion failed after start persisted');

    const { data: sessionReadback, error: sessionReadbackError } = await beautyClient
      .from('beauty_sessions')
      .select('id, tenant_id, status, actual_start_at, actual_end_at, actual_performer_id, outcome')
      .eq('tenant_id', tenantA)
      .eq('id', plannedSession.id)
      .single();
    expect(sessionReadbackError).toBeNull();
    expect(sessionReadback).toEqual(expect.objectContaining({
      id: plannedSession.id,
      tenant_id: tenantA,
      status: 'PLANNED',
      actual_start_at: null,
      actual_end_at: null,
      actual_performer_id: null,
      outcome: null,
    }));
  });

  it('routes Beauty completed-service receivables through F5 AR control with case, severity, idempotency, and tenant isolation evidence', async () => {
    const tenantA = await insertTenant('finance-f5-tenant-a');
    const tenantB = await insertTenant('finance-f5-tenant-b');
    const customerA = await insertCustomer(tenantA, 'finance-f5-customer-a');
    await seedFinanceFoundation(tenantA);

    const { service, appointmentRepo, sessionRepo } = createService();
    const interval: TimeInterval = {
      startsAt: '2026-10-02T18:00:00.000Z',
      endsAt: '2026-10-02T19:00:00.000Z',
    };
    const appointment = await appointmentRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      branchId: randomUUID(),
      customerId: customerA,
      serviceId: randomUUID(),
      interval,
      status: 'PENDING',
    });
    const plannedSession = await sessionRepo.create({
      id: randomUUID(),
      tenantId: tenantA,
      appointmentId: appointment.id,
      serviceCommitmentId: randomUUID(),
      status: 'PLANNED',
      actualStartAt: null,
      actualEndAt: null,
      actualPerformerId: null,
      outcome: null,
    });
    const completed = await service.completeSession({
      session: plannedSession,
      performerId: randomUUID(),
      outcome: {
        checkedOutBy: randomUUID(),
        customerHistoryNote: 'Beauty F5 AR control evidence.',
        packageSessionUsed: false,
        paymentStatus: 'FINANCE_HANDOFF_REQUIRED',
        inventoryHandoff: 'NOT_REQUIRED',
        payrollHandoff: 'PAYROLL_HANDOFF_REQUIRED',
        auditTags: ['BEAUTY_V2_REAL_DB', 'F5_AR_CONTROL'],
      },
    });
    expect(completed.status).toBe('COMPLETED');

    const financeService = new SemanticReceivableChargeService(
      new SupabaseReceivableChargeGateway(seedClient, 'service_role'),
    );
    const matchedReceivable = await financeService.recognizeServiceReceivable({
      tenantId: tenantA,
      customerId: customerA,
      amountMinor: 180_000,
      currency: 'VND',
      servicePeriodStart: '2026-10-02',
      servicePeriodEnd: '2026-10-02',
      recognitionDate: '2026-10-02',
      dueDate: '2026-10-09',
      businessSourceType: 'BEAUTY_V2_SESSION_COMPLETED',
      businessSourceId: completed.id,
      description: `${marker} Beauty V2 completed service receivable`,
      metadata: {
        product_key: 'bella_spa',
        beauty_session_id: completed.id,
        beauty_appointment_id: appointment.id,
      },
    });
    expect(matchedReceivable.receivableLedgerEntryCount).toBe(1);
    expect(matchedReceivable.transactionLineCount).toBe(2);

    const { data: matchedFact, error: matchedFactError } = await seedClient
      .from('finance_receivable_ledger')
      .select('created_at')
      .eq('tenant_id', tenantA)
      .eq('invoice_id', matchedReceivable.invoiceId)
      .eq('entry_type', 'DEBIT_ACCRUAL')
      .single();
    expect(matchedFactError).toBeNull();
    expect(matchedFact).not.toBeNull();

    const passBasisId = randomUUID();
    const passReconciliationAsOf = new Date(
      new Date(matchedFact!.created_at).getTime() + 1_000,
    ).toISOString();
    const passParams = {
      p_tenant_id: tenantA,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: passBasisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: passReconciliationAsOf,
    } as const;
    const passRun = await seedClient.rpc('f5_run_reconciliation', passParams);
    const duplicatePassRun = await seedClient.rpc('f5_run_reconciliation', passParams);
    expect(passRun.error).toBeNull();
    expect(duplicatePassRun.error).toBeNull();
    expect(passRun.data.run_id).toBe(duplicatePassRun.data.run_id);

    const { data: passResult, error: passResultError } = await seedClient
      .from('f5_control_results')
      .select('result_id, financial_result, severity, expected_amount, actual_amount, case_id')
      .eq('tenant_id', tenantA)
      .eq('run_id', passRun.data.run_id)
      .eq('source_id', matchedReceivable.invoiceId)
      .single();
    expect(passResultError).toBeNull();
    expect(passResult).toMatchObject({
      financial_result: 'MATCHED',
      severity: 'LOW',
      expected_amount: 180_000,
      actual_amount: 180_000,
      case_id: null,
    });

    const mismatchReceivable = await financeService.recognizeServiceReceivable({
      tenantId: tenantA,
      customerId: customerA,
      amountMinor: 150_000,
      currency: 'VND',
      servicePeriodStart: '2026-10-02',
      servicePeriodEnd: '2026-10-02',
      recognitionDate: '2026-10-02',
      dueDate: '2026-10-09',
      businessSourceType: 'BEAUTY_V2_SESSION_COMPLETED_MISMATCH',
      businessSourceId: randomUUID(),
      description: `${marker} Beauty V2 mismatch receivable`,
      metadata: {
        product_key: 'bella_spa',
        beauty_session_id: completed.id,
        mismatch_probe: true,
      },
    });
    const { error: mismatchFactError } = await seedClient
      .from('finance_receivable_ledger')
      .insert({
        id: randomUUID(),
        tenant_id: tenantA,
        invoice_id: mismatchReceivable.invoiceId,
        entry_type: 'CREDIT_ALLOCATION',
        amount_minor: 150_000,
        source_type: 'ALLOCATION',
        source_id: randomUUID(),
        created_at: '2026-10-02T20:00:00.000Z',
      });
    expect(mismatchFactError).toBeNull();

    const { data: mismatchDebitFact, error: mismatchDebitFactError } = await seedClient
      .from('finance_receivable_ledger')
      .select('created_at')
      .eq('tenant_id', tenantA)
      .eq('invoice_id', mismatchReceivable.invoiceId)
      .eq('entry_type', 'DEBIT_ACCRUAL')
      .single();
    expect(mismatchDebitFactError).toBeNull();
    expect(mismatchDebitFact).not.toBeNull();
    const mismatchReconciliationAsOf = new Date(
      new Date(mismatchDebitFact!.created_at).getTime() + 1_000,
    ).toISOString();

    const { data: mismatchRun, error: mismatchRunError } = await seedClient.rpc('f5_run_reconciliation', {
      p_tenant_id: tenantA,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: randomUUID(),
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: mismatchReconciliationAsOf,
    });
    expect(mismatchRunError).toBeNull();

    const { data: mismatchResult, error: mismatchResultError } = await seedClient
      .from('f5_control_results')
      .select('result_id, financial_result, severity, expected_amount, actual_amount, variance_amount, case_id')
      .eq('tenant_id', tenantA)
      .eq('run_id', mismatchRun.run_id)
      .eq('source_id', mismatchReceivable.invoiceId)
      .single();
    expect(mismatchResultError).toBeNull();
    expect(mismatchResult).toMatchObject({
      financial_result: 'VARIANCE',
      severity: 'MEDIUM',
      expected_amount: 0,
      actual_amount: 150_000,
    });
    expect(Number(mismatchResult!.variance_amount)).toBe(150_000);
    expect(mismatchResult!.case_id).toBeTruthy();

    const { data: caseRow, error: caseError } = await seedClient
      .from('f5_control_cases')
      .select('case_state, result_id, tenant_id')
      .eq('case_id', mismatchResult!.case_id)
      .single();
    expect(caseError).toBeNull();
    expect(caseRow).toMatchObject({
      case_state: 'OPEN',
      result_id: mismatchResult!.result_id,
      tenant_id: tenantA,
    });

    const { data: tenantBRun, error: tenantBRunError } = await seedClient.rpc('f5_run_reconciliation', {
      p_tenant_id: tenantB,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: randomUUID(),
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-10-02T23:59:59.000Z',
    });
    expect(tenantBRunError).toBeNull();
    expect(tenantBRun.total_checked).toBe(0);

    const { count: crossTenantResults, error: crossTenantError } = await seedClient
      .from('f5_control_results')
      .select('result_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantB)
      .in('source_id', [matchedReceivable.invoiceId, mismatchReceivable.invoiceId]);
    expect(crossTenantError).toBeNull();
    expect(crossTenantResults).toBe(0);
  });
});
