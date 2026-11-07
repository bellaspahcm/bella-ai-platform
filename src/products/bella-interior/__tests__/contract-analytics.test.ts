import { InteriorContractAnalyticsService } from '../services/interior-contract-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorContractAnalyticsService', () => {
  const validTenant = '00000000-0000-0000-0000-000000000001';

  it('rejects empty or missing tenantId enforcing Gate 0 tenant isolation', async () => {
    await expect(InteriorContractAnalyticsService.getContractOverview('')).rejects.toThrow(
      TenantIsolationViolationError,
    );
    await expect(InteriorContractAnalyticsService.getContractOverview('   ')).rejects.toThrow(
      TenantIsolationViolationError,
    );
  });

  it('returns valid contract overview response with verified project header', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    expect(res).toBeDefined();
    expect(res.header.contractId).toBe('CON-DUBAI-001');
    expect(res.header.clientName).toBe('Sheikh Al-Maktoum Office');
    expect(res.header.projectName).toBe('Villa Sunrise Renovation');
  });

  it('enforces mathematical invariant: milestone percentages must sum to exactly 100%', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    const sum = res.milestones.reduce((acc, m) => acc + m.percentage, 0);
    expect(sum).toBe(100);
  });

  it('enforces mathematical invariant: milestone amounts must sum to total contract value (418M VND)', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    const sumAmount = res.milestones.reduce((acc, m) => acc + m.amount, 0);
    expect(sumAmount).toBe(418_000_000);
    expect(res.kpis.totalContractValue.rawValue).toBe(418_000_000);
    expect(res.kpis.totalContractValue.formattedValue).toBe('418.000.000 đ');
  });

  it('validates 50% deposit and design approval collection invariant (209M VND = 50%)', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    const milestone1And2 = res.milestones[0].amount + res.milestones[1].amount;
    expect(milestone1And2).toBe(209_000_000);
    expect(res.kpis.collectedAmount.rawValue).toBe(209_000_000);
    expect(res.kpis.collectedAmount.subtext).toBe('50% hợp đồng');
    expect(res.progressStepper.completionPercentage).toBe(50);
  });

  it('verifies 5 payment stepper stages matching executive reference mockup', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    expect(res.progressStepper.steps).toHaveLength(5);
    expect(res.progressStepper.steps[0].badgeText).toBe('Đã thu');
    expect(res.progressStepper.steps[1].badgeText).toBe('Đã thu');
    expect(res.progressStepper.steps[2].badgeText).toBe('Đã xuất HĐ');
    expect(res.progressStepper.steps[3].badgeText).toBe('Chờ thanh toán');
    expect(res.progressStepper.steps[4].badgeText).toBe('Chờ thanh toán');
  });

  it('verifies milestone data table status and remaining balances', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    const m3 = res.milestones[2];
    expect(m3.status).toBe('partial');
    expect(m3.amount).toBe(125_400_000);
    expect(m3.collectedAmount).toBe(50_000_000);
    expect(m3.remainingAmount).toBe(75_400_000);
    expect(m3.remainingFormatted).toBe('75.400.000 đ');
  });

  it('verifies operational alerts highlighting 3-day payment due countdown', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    expect(res.alerts).toHaveLength(1);
    expect(res.alerts[0].highlightText).toBe('Còn 3 ngày');
    expect(res.alerts[0].amountFormatted).toBe('(Đợt 4: 62.700.000 đ)');
    expect(res.alerts[0].dueInDays).toBe(3);
  });

  it('verifies 5-point workshop release gating checklist and eligibility', async () => {
    const res = await InteriorContractAnalyticsService.getContractOverview(validTenant);
    expect(res.workshopReleaseGating.isEligible).toBe(true);
    expect(res.workshopReleaseGating.criteria).toHaveLength(5);
    expect(res.workshopReleaseGating.criteria.every((c) => c.satisfied)).toBe(true);
  });

  it('formats currency correctly in Vietnamese standard', () => {
    expect(InteriorContractAnalyticsService.formatVND(418000000)).toBe('418.000.000 đ');
    expect(InteriorContractAnalyticsService.formatVND(0)).toBe('0 đ');
  });
});

