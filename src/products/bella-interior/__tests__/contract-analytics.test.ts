import { InteriorContractAnalyticsService } from '../services/interior-contract-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorContract } from '../domain/commercial-costing/types';

/**
 * Tests for InteriorContractAnalyticsService
 *
 * Phase 2 – Financial Integrity:
 *   - Tenant isolation (Gate 0)
 *   - Per-project routing: each project returns its own contract or EMPTY STATE
 *   - Financial formulas: Contract Value (Snapshot), Net Collected (Transactions), Outstanding
 *   - Stepper badge logic from milestone status
 *   - No Dubai fallback for unrecognized or empty-state projects
 */

const validTenant = '00000000-0000-0000-0000-000000000001';

describe('InteriorContractAnalyticsService – Tenant Isolation (Gate 0)', () => {
  it('rejects empty tenantId', async () => {
    await expect(
      InteriorContractAnalyticsService.getContractOverview(''),
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  it('rejects whitespace-only tenantId', async () => {
    await expect(
      InteriorContractAnalyticsService.getContractOverview('   '),
    ).rejects.toThrow(TenantIsolationViolationError);
  });
});

describe('InteriorContractAnalyticsService – Dubai Luxury Villa (INT-2024-002)', () => {
  let res: Awaited<ReturnType<typeof InteriorContractAnalyticsService.getContractOverview>>;

  beforeAll(async () => {
    res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-2024-002');
  });

  it('returns hasContract: true for Dubai project', () => {
    expect(res.hasContract).toBe(true);
  });

  it('returns CON-DUBAI-001 header scoped to INT-2024-002', () => {
    expect(res.header.contractId).toBe('CON-DUBAI-001');
    expect(res.header.projectCode).toBe('INT-2024-002');
    expect(res.header.clientName).toBe('Sheikh Al-Maktoum Office');
  });

  it('contract value is 418M VND (Executed Snapshot)', () => {
    expect(res.kpis.totalContractValue.rawValue).toBe(418_000_000);
    expect(res.kpis.totalContractValue.formattedValue).toBe('418.000.000 đ');
  });

  it('net collected = 259M VND (125.4M + 83.6M + 50M partial)', () => {
    // tx-001: 125.4M, tx-002: 83.6M, tx-003: 50M (partial on đợt 3)
    expect(res.kpis.collectedAmount.rawValue).toBe(259_000_000);
  });

  it('outstanding = 418M - 259M = 159M VND', () => {
    expect(res.kpis.remainingAmount.rawValue).toBe(159_000_000);
  });

  it('payment progress ≈ 62% (259/418)', () => {
    const progress = res.kpis.collectedAmount.rawValue / res.kpis.totalContractValue.rawValue;
    expect(progress).toBeCloseTo(0.62, 1);
  });

  it('milestone percentages sum to 100%', () => {
    const sum = res.milestones.reduce((acc, m) => acc + m.percentage, 0);
    expect(sum).toBe(100);
  });

  it('đợt 3 is partial: 50M collected, 75.4M remaining', () => {
    const m3 = res.milestones[2];
    expect(m3.status).toBe('partial');
    expect(m3.collectedAmount).toBe(50_000_000);
    expect(m3.remainingAmount).toBe(75_400_000);
    expect(m3.remainingFormatted).toBe('75.400.000 đ');
  });

  it('stepper has 5 steps: 2 paid, 1 current/invoiced, 2 pending', () => {
    expect(res.progressStepper.steps).toHaveLength(5);
    expect(res.progressStepper.steps[0].badgeText).toBe('Đã thu');
    expect(res.progressStepper.steps[1].badgeText).toBe('Đã thu');
    // đợt 3 has invoiceStatus=issued and is partial — should be 'Đã xuất HĐ' or 'Thu 1 phần'
    // The service sets partial before invoiced in priority, so:
    expect(['Thu 1 phần', 'Đã xuất HĐ']).toContain(res.progressStepper.steps[2].badgeText);
    expect(res.progressStepper.steps[3].badgeText).toBe('Chờ thanh toán');
    expect(res.progressStepper.steps[4].badgeText).toBe('Chờ thanh toán');
  });
});

describe('InteriorContractAnalyticsService – Villa Riverside Thảo Điền (INT-THD-2026)', () => {
  let res: Awaited<ReturnType<typeof InteriorContractAnalyticsService.getContractOverview>>;

  beforeAll(async () => {
    res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-THD-2026');
  });

  it('returns hasContract: true for Thảo Điền project', () => {
    expect(res.hasContract).toBe(true);
  });

  it('contract is HD-NT-2026/08 for INT-THD-2026', () => {
    expect(res.header.contractId).toBe('HD-NT-2026/08');
    expect(res.header.projectCode).toBe('INT-THD-2026');
    expect(res.header.clientName).toBe('Trần Minh Quân');
  });

  it('contract value = 1.35B VND', () => {
    expect(res.kpis.totalContractValue.rawValue).toBe(1_350_000_000);
    expect(res.kpis.totalContractValue.formattedValue).toBe('1.350.000.000 đ');
  });

  it('net collected = 675M VND (đợt 1: 405M + đợt 2: 270M)', () => {
    expect(res.kpis.collectedAmount.rawValue).toBe(675_000_000);
  });

  it('outstanding = 1.35B - 675M = 675M VND', () => {
    expect(res.kpis.remainingAmount.rawValue).toBe(675_000_000);
  });

  it('payment progress = 50%', () => {
    expect(res.progressStepper.completionPercentage).toBe(50);
  });

  it('milestone percentages sum to 100%', () => {
    const sum = res.milestones.reduce((acc, m) => acc + m.percentage, 0);
    expect(sum).toBe(100);
  });

  it('stepper: đợt 1 & 2 paid, đợt 3-5 pending', () => {
    expect(res.progressStepper.steps[0].badgeText).toBe('Đã thu');
    expect(res.progressStepper.steps[1].badgeText).toBe('Đã thu');
    expect(res.progressStepper.steps[2].badgeText).toBe('Chờ thanh toán');
    expect(res.progressStepper.steps[3].badgeText).toBe('Chờ thanh toán');
    expect(res.progressStepper.steps[4].badgeText).toBe('Chờ thanh toán');
  });

  it('workshopReleaseGating is eligible (deposit ≥ 50%, contract signed)', () => {
    expect(res.workshopReleaseGating.isEligible).toBe(true);
    expect(res.workshopReleaseGating.criteria).toHaveLength(5);
  });
});

describe('InteriorContractAnalyticsService – Villa Sunrise (INT-2024-001) – EMPTY STATE', () => {
  let res: Awaited<ReturnType<typeof InteriorContractAnalyticsService.getContractOverview>>;

  beforeAll(async () => {
    res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-2024-001');
  });

  it('returns hasContract: false (no signed contract)', () => {
    expect(res.hasContract).toBe(false);
  });

  it('contract value KPI = 0 (no signed contract)', () => {
    expect(res.kpis.totalContractValue.rawValue).toBe(0);
  });

  it('net collected = 0 (no contract)', () => {
    expect(res.kpis.collectedAmount.rawValue).toBe(0);
  });

  it('stepper has 0 steps (no milestones)', () => {
    expect(res.progressStepper.steps).toHaveLength(0);
  });

  it('workshopReleaseGating is NOT eligible (no contract)', () => {
    expect(res.workshopReleaseGating.isEligible).toBe(false);
  });

  it('provides BOQ reference value (1.68B)', () => {
    expect(res.referenceBOQValue).toBe(1_680_000_000);
    expect(res.referenceBOQValueFormatted).toBe('1.680.000.000 đ');
  });

  it('no Dubai data contamination on Villa Sunrise', () => {
    expect(res.header.contractId).not.toBe('CON-DUBAI-001');
    expect(res.header.clientName).not.toBe('Sheikh Al-Maktoum Office');
  });
});

describe('InteriorContractAnalyticsService – Unknown Projects – EMPTY STATE', () => {
  it('INT-2024-003 returns hasContract: false', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-2024-003');
    expect(res.hasContract).toBe(false);
  });

  it('INT-2024-004 returns hasContract: false', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-2024-004');
    expect(res.hasContract).toBe(false);
  });

  it('unknown project code returns hasContract: false (no Dubai fallback)', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-9999-999');
    expect(res.hasContract).toBe(false);
    expect(res.header.contractId).not.toBe('CON-DUBAI-001');
  });
});

describe('InteriorContractAnalyticsService – computeFinancialTruth', () => {
  it('computes correct net collected from transactions', () => {
    const milestones = InteriorContractAnalyticsService.CANONICAL_MILESTONES;
    const result = InteriorContractAnalyticsService.computeFinancialTruth({
      contractValue: 418_000_000,
      milestones,
      clientName: 'Sheikh Al-Maktoum Office',
      contractNumber: 'CON-DUBAI-001',
    });
    // tx-001: 125.4M, tx-002: 83.6M, tx-003: 50M → 259M
    expect(result.netCollected).toBe(259_000_000);
    expect(result.outstandingAmount).toBe(159_000_000);
  });

  it('detects and reports overcollection accurately when net collected exceeds contract value', () => {
    const milestones = InteriorContractAnalyticsService.CANONICAL_MILESTONES;
    const result = InteriorContractAnalyticsService.computeFinancialTruth({
      contractValue: 200_000_000, // less than 259M collected
      milestones,
    });
    // 200M - 259M = -59M (negative outstanding = overcollected)
    expect(result.outstandingAmount).toBe(-59_000_000);
    expect(result.kpis.remainingAmount.label).toBe('Thu vượt hợp đồng');
    expect(result.kpis.remainingAmount.formattedValue).toBe('-59.000.000 đ');
  });
});

describe('InteriorContractAnalyticsService – Currency Formatting', () => {
  it('formats 418_000_000 correctly', () => {
    expect(InteriorContractAnalyticsService.formatVND(418_000_000)).toBe('418.000.000 đ');
  });

  it('formats 0 correctly', () => {
    expect(InteriorContractAnalyticsService.formatVND(0)).toBe('0 đ');
  });

  it('formats 1_350_000_000 correctly', () => {
    expect(InteriorContractAnalyticsService.formatVND(1_350_000_000)).toBe('1.350.000.000 đ');
  });
});

describe('InteriorContractAnalyticsService – DB-First Repository Integration', () => {
  const mockContract: InteriorContract = {
    id: 'contract-db-001',
    tenantId: validTenant,
    projectId: '77a11111-2222-3333-4444-555566667777',
    quotationId: 'quot-001',
    contractNumber: 'HD-NT-2026/08',
    title: 'Villa Riverside Thảo Điền - Fitout Trọn Gói',
    status: 'active',
    baselineContractValue: 1_350_000_000,
    currentContractValue: 1_350_000_000,
    signedDate: '2026-11-06T00:00:00.000Z',
    clientRepresentative: 'Trần Minh Quân',
    contractorRepresentative: 'KTS. Lê Hoàng Sơn',
    milestones: [
      {
        id: 'm-1',
        tenantId: validTenant,
        contractId: 'contract-db-001',
        milestoneOrder: 1,
        name: 'Đợt 1: Tạm ứng ký hợp đồng',
        percentage: 30,
        amount: 405_000_000,
        triggerCondition: 'Ký hợp đồng',
        status: 'paid',
        dueDate: '2026-11-01',
        paidAt: '2026-11-01',
      },
      {
        id: 'm-2',
        tenantId: validTenant,
        contractId: 'contract-db-001',
        milestoneOrder: 2,
        name: 'Đợt 2: Khóa thiết kế & Chuyển xưởng',
        percentage: 20,
        amount: 270_000_000,
        triggerCondition: 'Duyệt bản vẽ',
        status: 'paid',
        dueDate: '2026-11-05',
        paidAt: '2026-11-05',
      },
      {
        id: 'm-3',
        tenantId: validTenant,
        contractId: 'contract-db-001',
        milestoneOrder: 3,
        name: 'Đợt 3: Hoàn thiện gia công',
        percentage: 30,
        amount: 405_000_000,
        triggerCondition: 'Xuất xưởng',
        status: 'pending',
        dueDate: '2026-12-01',
      },
      {
        id: 'm-4',
        tenantId: validTenant,
        contractId: 'contract-db-001',
        milestoneOrder: 4,
        name: 'Đợt 4: Lắp đặt hoàn thiện',
        percentage: 15,
        amount: 202_500_000,
        triggerCondition: 'Lắp đặt xong',
        status: 'pending',
        dueDate: '2026-12-25',
      },
      {
        id: 'm-5',
        tenantId: validTenant,
        contractId: 'contract-db-001',
        milestoneOrder: 5,
        name: 'Đợt 5: Nghiệm thu bàn giao',
        percentage: 5,
        amount: 67_500_000,
        triggerCondition: 'Bàn giao',
        status: 'pending',
        dueDate: '2027-01-10',
      },
    ],
    addenda: [],
  };

  const mockRepo = {
    getContractByProject: jest.fn().mockImplementation(async (tenant: string, projId: string) => {
      if (tenant !== validTenant) throw new Error('Tenant isolation breach in repo');
      if (projId === '77a11111-2222-3333-4444-555566667777') return mockContract;
      return null;
    }),
  } as unknown as IInteriorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries repository with tenantId and resolved project UUID for INT-THD-2026', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(
      validTenant,
      'INT-THD-2026',
      mockRepo,
    );

    expect(mockRepo.getContractByProject).toHaveBeenCalledTimes(1);
    expect(mockRepo.getContractByProject).toHaveBeenCalledWith(
      validTenant,
      '77a11111-2222-3333-4444-555566667777',
    );
    expect(res.hasContract).toBe(true);
    expect(res.header.contractId).toBe('HD-NT-2026/08');
    expect(res.header.clientName).toBe('Trần Minh Quân');
    expect(res.kpis.totalContractValue.rawValue).toBe(1_350_000_000);
    expect(res.kpis.collectedAmount.rawValue).toBe(675_000_000); // 405M + 270M from 2 paid milestones
    expect(res.kpis.remainingAmount.rawValue).toBe(675_000_000);
    expect(res.progressStepper.completionPercentage).toBe(50);
  });

  it('returns explicit empty state when repository returns null (Villa Sunrise INT-2024-001)', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(
      validTenant,
      'INT-2024-001',
      mockRepo,
    );

    expect(mockRepo.getContractByProject).toHaveBeenCalledWith(
      validTenant,
      'f6b027ee-494c-4c42-a6cd-01b18626c043',
    );
    expect(res.hasContract).toBe(false);
    expect(res.header.contractId).toBe('CHƯA KÝ KẾT');
    expect(res.header.clientName).toBe('SunCasa Group (Ahmad Santoso)');
    expect(res.kpis.totalContractValue.rawValue).toBe(0);
    expect(res.kpis.collectedAmount.rawValue).toBe(0);
    expect(res.progressStepper.steps).toHaveLength(0);
    expect(res.workshopReleaseGating.isEligible).toBe(false);
  });

  it('propagates repository error without masking', async () => {
    const failingRepo = {
      getContractByProject: jest.fn().mockRejectedValue(new Error('PostgreSQL connection timeout')),
    } as unknown as IInteriorRepository;

    await expect(
      InteriorContractAnalyticsService.getContractOverview(validTenant, 'INT-THD-2026', failingRepo),
    ).rejects.toThrow('PostgreSQL connection timeout');
  });
});
