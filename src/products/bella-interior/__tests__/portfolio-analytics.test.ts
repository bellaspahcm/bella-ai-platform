/**
 * Bella Interior OS — Portfolio Analytics & Executive Calculation Tests
 *
 * Verifies:
 * 1. Tenant Isolation (Gate 0 / P0)
 * 2. Zero UI calculation invariant: all metrics, P&L values, and variances are computed in the service
 * 3. Accurate formatting and categorization of portfolio KPIs, financial summaries, and operational alerts
 */

import { randomUUID } from 'crypto';
import { InteriorPortfolioAnalyticsService } from '../services/interior-portfolio-analytics.service';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { TenantIsolationViolationError } from '../domain/errors';
import type { InteriorProject } from '../domain/design-specification/types';
import type { InteriorContract, InteriorQuotation } from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type {
  QCPunchListItem,
  SiteDiaryEntry,
  HandoverDossier,
  WarrantyCertificate,
  WarrantyServiceTicket,
} from '../domain/delivery-aftercare/types';

describe('InteriorPortfolioAnalyticsService', () => {
  let service: InteriorPortfolioAnalyticsService;

  beforeEach(() => {
    service = new InteriorPortfolioAnalyticsService();
  });

  it('should enforce Tenant Isolation (Gate 0)', async () => {
    await expect(service.computePortfolioOverview('')).rejects.toThrow(
      TenantIsolationViolationError
    );
  });

  it('should compute complete portfolio overview with 4 KPI cards matching executive design', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result).toBeDefined();
    expect(result.kpis).toBeDefined();
    expect(result.kpis.totalProjects.value).toBe(24);
    expect(result.kpis.totalProjects.trend).toBe('12%');
    expect(result.kpis.inProgress.value).toBe(18);
    expect(result.kpis.inProgress.trend).toBe('8%');
    expect(result.kpis.delayedRisk.value).toBe(3);
    expect(result.kpis.delayedRisk.trend).toBe('1%');
    expect(result.kpis.averageGrossMargin.value).toBe('42%');
  });

  it('should provide canonical projects with pre-computed deadline labels and schedule health', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.projects.length).toBe(4);
    const [villa, office, skyline, garden] = result.projects;

    expect(villa.name).toBe('Villa Sunrise Renovation');
    expect(villa.stage).toBe('design');
    expect(villa.scheduleStatus).toBe('on_track');
    expect(villa.daysRemainingLabel).toBe('Còn 27 ngày');
    expect(villa.isDeadlineUrgent).toBe(true);

    expect(office.name).toBe('Office Tower Lobby');
    expect(office.stage).toBe('production');
    expect(office.scheduleStatus).toBe('ahead');
    expect(office.scheduleStatusLabel).toBe('Vượt tiến độ +2%');

    expect(skyline.name).toBe('Skyline Residence');
    expect(skyline.stage).toBe('installation');
    expect(skyline.scheduleStatus).toBe('delayed');
    expect(skyline.scheduleStatusLabel).toBe('Chậm tiến độ -5%');

    expect(garden.name).toBe('The Garden Villa');
    expect(garden.stage).toBe('handover');
    expect(garden.scheduleStatus).toBe('on_track');
  });

  it('should compute financial summary with formatted P&L and receivables', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.financialSummary).toBeDefined();
    expect(result.financialSummary.totalContractFormatted).toBe('12.8 tỷ đ');
    expect(result.financialSummary.collectedFormatted).toBe('8.6 tỷ đ');
    expect(result.financialSummary.receivableFormatted).toBe('4.2 tỷ đ');
    expect(result.financialSummary.actualProfitFormatted).toBe('4.8 tỷ đ');
    expect(result.financialSummary.averageMarginPercent).toBe(42.3);
  });

  it('should compute progress distribution and operational action alerts', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.progressOverview.overallProgressPercent).toBe(85);
    expect(result.progressOverview.onTrackPercent).toBe(72);
    expect(result.progressOverview.delayedPercent).toBe(18);
    expect(result.progressOverview.completedPercent).toBe(10);
    expect(result.progressOverview.specialAttentionCount).toBe(3);

    expect(result.actionAlerts.length).toBe(4);
    expect(result.actionAlerts[0].type).toBe('critical');
    expect(result.actionAlerts[0].title).toContain('Skyline Residence');
  });

  it('should compute multi-period business chain progress across the 4 key stages', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.businessChainProgress).toBeDefined();
    expect(result.businessChainProgress?.defaultPeriod).toBe('this_month');

    const thisMonth = result.businessChainProgress?.periods.this_month;
    expect(thisMonth).toBeDefined();
    expect(thisMonth?.periodLabel).toBe('Tháng này');
    expect(thisMonth?.stages.length).toBe(4);

    const design = thisMonth?.stages.find((s) => s.key === 'design');
    const commercial = thisMonth?.stages.find((s) => s.key === 'commercial');
    const production = thisMonth?.stages.find((s) => s.key === 'production');
    const handover = thisMonth?.stages.find((s) => s.key === 'handover');

    expect(design?.percent).toBe(92);
    expect(commercial?.percent).toBe(85);
    expect(production?.percent).toBe(70);
    expect(handover?.percent).toBe(45);
    expect(thisMonth?.overallPercent).toBe(65);
    expect(thisMonth?.statusLabel).toBe('Đúng tiến độ');

    const lastMonth = result.businessChainProgress?.periods.last_month;
    expect(lastMonth).toBeDefined();
    expect(lastMonth?.periodLabel).toBe('Tháng trước');
    expect(lastMonth?.overallPercent).toBe(58);

    const thisQuarter = result.businessChainProgress?.periods.this_quarter;
    expect(thisQuarter).toBeDefined();
    expect(thisQuarter?.statusLabel).toBe('Vượt tiến độ +3%');
    expect(thisQuarter?.overallPercent).toBe(72);
  });

  describe('Real Repository Analytics & 5 Capabilities (Hạng mục 5)', () => {
    const TENANT_A = `tenant-analytics-${randomUUID()}`;
    const TENANT_B = `tenant-isolated-${randomUUID()}`;

    let repo: InMemoryInteriorRepository;
    let realService: InteriorPortfolioAnalyticsService;

    beforeEach(() => {
      repo = new InMemoryInteriorRepository();
      realService = new InteriorPortfolioAnalyticsService(repo);
    });

    it('handles 0 projects in real repository cleanly without fabricating mock data', async () => {
      const result = await realService.computePortfolioOverview(TENANT_A);

      expect(result.kpis.totalProjects.value).toBe(0);
      expect(result.kpis.inProgress.value).toBe(0);
      expect(result.kpis.delayedRisk.value).toBe(0);
      expect(result.projects).toHaveLength(0);
      expect(result.financialSummary.totalContractValue).toBe(0);
      expect(result.financialSummary.collectedAmount).toBe(0);
      expect(result.financialSummary.receivableAmount).toBe(0);
      expect(result.financialSummary.costDataReliable).toBe(false);
      expect(result.financialSummary.actualProfit).toBe(0);
      expect(result.commercialAnalytics?.quotationCount).toBe(0);
      expect(result.deliveryQualityAnalytics?.totalPunchListItems).toBe(0);
      expect(result.warrantyAnalytics?.totalTicketsCount).toBe(0);
    });

    it('computes complete real portfolio analytics across all 5 capabilities', async () => {
      // 1. Setup Project 1: On track, active contract, partial payment
      const proj1Id = randomUUID();
      const proj1: InteriorProject = {
        id: proj1Id,
        tenantId: TENANT_A,
        code: 'DA-VIP-01',
        name: 'Biệt thự Đảo Ecopark Grand',
        customerId: 'cust-1',
        customerName: 'Ông Đặng Văn A',
        siteAddress: 'Đảo Marina, Ecopark',
        projectType: 'residential_villa',
        status: 'in_production',
        estimatedBudget: 3_000_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS. Lê Hoàng Sơn',
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      };
      await repo.saveProject(TENANT_A, proj1);

      // Quotation for Project 1 (Accepted)
      const quote1: InteriorQuotation = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj1Id,
        boqId: randomUUID(),
        quotationNumber: 'BG-ECO-01',
        versionNumber: 1,
        status: 'accepted',
        subtotal: 2_700_000_000,
        discountAmount: 0,
        vatPercent: 10,
        vatAmount: 270_000_000,
        grandTotal: 2_970_000_000,
        paymentTerms: 'Đợt 1 50%, Đợt 2 50%',
        validityDays: 30,
        createdAt: '2026-01-05T08:00:00.000Z',
      };
      await repo.saveQuotation(TENANT_A, quote1);

      // Contract 1: Signed 2,970,000,000 VND
      const contract1Id = randomUUID();
      const milestone1Id = randomUUID();
      const contract1: InteriorContract = {
        id: contract1Id,
        tenantId: TENANT_A,
        projectId: proj1Id,
        quotationId: quote1.id,
        contractNumber: 'HD-ECO-01',
        title: 'Hợp đồng thi công nội thất Ecopark Grand',
        status: 'signed',
        baselineContractValue: 2_970_000_000,
        currentContractValue: 2_970_000_000,
        signedDate: '2026-01-10',
        clientRepresentative: 'Ông Đặng Văn A',
        contractorRepresentative: 'Bella Interior',
        addenda: [],
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-01-10T08:00:00.000Z',
        milestones: [
          {
            id: milestone1Id,
            tenantId: TENANT_A,
            contractId: contract1Id,
            milestoneOrder: 1,
            name: 'Đợt 1',
            percentage: 50,
            amount: 1_500_000_000,
            triggerCondition: 'Ký hợp đồng',
            status: 'paid',
          },
        ],
      };
      await repo.saveContract(TENANT_A, contract1);

      // Payment: 1,500,000,000 VND
      const payment1: PaymentTransaction = {
        id: randomUUID(),
        tenantId: TENANT_A,
        contractId: contract1Id,
        milestoneId: milestone1Id,
        referenceCode: 'UNC-ECO-01',
        amount: 1_500_000_000,
        paymentMethod: 'bank_transfer',
        transactionDate: '2026-01-15T10:00:00.000Z',
        recordedBy: 'staff-1',
        createdAt: '2026-01-15T10:00:00.000Z',
      };
      await repo.savePaymentTransaction(TENANT_A, payment1);

      // Site Diary for Project 1
      const diary1: SiteDiaryEntry = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj1Id,
        date: '2026-02-01',
        weather: 'clear',
        laborHeadcount: 10,
        activitiesCompleted: ['Lắp vách trang trí phòng khách'],
        materialDelivered: [],
        supervisorName: 'KTS. Lê Hoàng Sơn',
      };
      await repo.saveSiteDiary(TENANT_A, diary1);

      // 2. Setup Project 2: Overdue / Delayed risk with Critical Punch List
      const proj2Id = randomUUID();
      const proj2: InteriorProject = {
        id: proj2Id,
        tenantId: TENANT_A,
        code: 'DA-RISK-02',
        name: 'Penthouse Vinhomes Metropolis',
        customerId: 'cust-2',
        customerName: 'Bà Nguyễn Thị B',
        siteAddress: 'Tòa M1, Metropolis, Hà Nội',
        projectType: 'residential_apartment',
        status: 'installing',
        estimatedBudget: 1_200_000_000,
        targetCompletionDate: '2026-01-01', // Past date -> Overdue!
        leadArchitectId: 'arch-2',
        leadArchitectName: 'KTS. Hoàng Long',
        createdAt: '2025-10-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      };
      await repo.saveProject(TENANT_A, proj2);

      // Critical Punch List Item for Project 2
      const punchItem: QCPunchListItem = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj2Id,
        roomZoneName: 'Phòng ngủ Master',
        itemName: 'Cánh tủ áo lùa kính',
        defectCategory: 'hardware_defect',
        description: 'Ray trượt kẹt cứng không đóng được',
        severity: 'critical',
        status: 'open',
        deadline: '2026-01-15',
      };
      await repo.savePunchListItem(TENANT_A, punchItem);

      // 3. Setup Project 3: Completed with Handover and Active Warranty
      const proj3Id = randomUUID();
      const proj3: InteriorProject = {
        id: proj3Id,
        tenantId: TENANT_A,
        code: 'DA-DONE-03',
        name: 'Showroom Thương Mại Hafele Center',
        customerId: 'cust-3',
        customerName: 'Công ty Cổ phần Hafele VN',
        siteAddress: 'Nguyễn Văn Trỗi, Phú Nhuận',
        projectType: 'retail_showroom',
        status: 'completed',
        estimatedBudget: 800_000_000,
        targetCompletionDate: '2026-02-01',
        leadArchitectId: 'arch-3',
        leadArchitectName: 'KTS. Minh Đức',
        createdAt: '2025-11-01T08:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
      };
      await repo.saveProject(TENANT_A, proj3);

      // Handover Dossier for Project 3
      const handover: HandoverDossier = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj3Id,
        contractId: randomUUID(),
        customerName: proj3.customerName,
        siteAddress: proj3.siteAddress,
        handoverDate: '2026-02-01',
        actualHandoverDate: '2026-02-01',
        status: 'client_approved',
        finalSettlementValue: 800_000_000,
        clientAccepted: true,
        clientSignoffName: 'Đại diện Hafele VN',
        warrantyPeriodMonths: 36,
      };
      await repo.saveHandoverDossier(TENANT_A, handover);

      // Warranty Certificate for Project 3
      const certId = randomUUID();
      const warrantyCert: WarrantyCertificate = {
        id: certId,
        tenantId: TENANT_A,
        projectId: proj3Id,
        contractId: handover.contractId,
        certificateNumber: 'BH-2026-HAFELE-01',
        customerName: proj3.customerName,
        siteAddress: proj3.siteAddress,
        effectiveDate: '2026-02-01',
        expirationDate: '2029-02-01',
        woodworkWarrantyMonths: 24,
        hardwareWarrantyMonths: 36,
        stoneWarrantyMonths: 60,
        termsSummary: 'Bảo hành chính hãng Hafele 36 tháng',
      };
      await repo.saveWarrantyCertificate(TENANT_A, warrantyCert);

      // Warranty Ticket for Project 3 (Resolved)
      const ticket: WarrantyServiceTicket = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj3Id,
        certificateId: certId,
        ticketNumber: 'BH-SC-01',
        reportedDate: '2026-02-10',
        customerReport: 'Đèn led tay nâng Blum bị nhấp nháy',
        roomZoneName: 'Khu trưng bày bếp',
        itemName: 'Bộ nguồn LED',
        defectCategory: 'electrical_defect',
        status: 'resolved',
        resolvedDate: '2026-02-12',
      };
      await repo.saveWarrantyTicket(TENANT_A, ticket);

      // Execute Real Portfolio Calculation
      const overview = await realService.computePortfolioOverview(TENANT_A);

      // ─── 1. Executive Overview Verification ───────────────────────────
      expect(overview.kpis.totalProjects.value).toBe(3);
      expect(overview.kpis.inProgress.value).toBe(2); // 3 total - 1 completed = 2 in progress
      expect(overview.kpis.delayedRisk.value).toBe(1); // proj2 is overdue & critical punch
      expect(overview.financialSummary.totalContractValue).toBe(2_970_000_000);
      expect(overview.financialSummary.collectedAmount).toBe(1_500_000_000);
      expect(overview.financialSummary.receivableAmount).toBe(1_470_000_000);

      // Cost & Profit Reliability Rule:
      expect(overview.financialSummary.costDataReliable).toBe(false);
      expect(overview.financialSummary.actualProfit).toBe(0);
      expect(overview.financialSummary.actualProfitFormatted).toContain('Chờ hạch toán');
      expect(overview.financialSummary.averageMarginNote).toContain('Chưa đủ dữ liệu chi phí');

      // ─── 2. Project Portfolio Verification ────────────────────────────
      expect(overview.projects).toHaveLength(3);

      const p1 = overview.projects.find((p) => p.id === proj1Id);
      expect(p1).toBeDefined();
      expect(p1?.stage).toBe('production');
      expect(p1?.scheduleStatus).toBe('ahead');
      expect(p1?.contractValue).toBe(2_970_000_000);

      const p2 = overview.projects.find((p) => p.id === proj2Id);
      expect(p2).toBeDefined();
      expect(p2?.stage).toBe('installation');
      expect(p2?.scheduleStatus).toBe('delayed');
      expect(p2?.isDeadlineUrgent).toBe(true);

      const p3 = overview.projects.find((p) => p.id === proj3Id);
      expect(p3).toBeDefined();
      expect(p3?.stage).toBe('handover');
      expect(p3?.progressPercent).toBe(100);

      // ─── 3. Commercial Analytics Verification ─────────────────────────
      expect(overview.commercialAnalytics).toBeDefined();
      expect(overview.commercialAnalytics?.quotationCount).toBe(1);
      expect(overview.commercialAnalytics?.acceptedQuotationCount).toBe(1);
      expect(overview.commercialAnalytics?.quotationConversionRate).toBe(100);
      expect(overview.commercialAnalytics?.collectionRate).toBe(51); // 1.5B / 2.97B ≈ 51%

      // ─── 4. Delivery & Quality Analytics Verification ─────────────────
      expect(overview.deliveryQualityAnalytics).toBeDefined();
      expect(overview.deliveryQualityAnalytics?.totalPunchListItems).toBe(1);
      expect(overview.deliveryQualityAnalytics?.openPunchListItems).toBe(1);
      expect(overview.deliveryQualityAnalytics?.criticalErrorsCount).toBe(1);
      expect(overview.deliveryQualityAnalytics?.siteDiaryEntriesCount).toBe(1);
      expect(overview.deliveryQualityAnalytics?.handoverDossiersCount).toBe(1);
      expect(overview.deliveryQualityAnalytics?.clientAcceptedHandoversCount).toBe(1);

      // ─── 5. Warranty Analytics Verification ───────────────────────────
      expect(overview.warrantyAnalytics).toBeDefined();
      expect(overview.warrantyAnalytics?.activeCertificatesCount).toBe(1);
      expect(overview.warrantyAnalytics?.totalTicketsCount).toBe(1);
      expect(overview.warrantyAnalytics?.openTicketsCount).toBe(0);
      expect(overview.warrantyAnalytics?.resolvedTicketsCount).toBe(1);
      expect(overview.warrantyAnalytics?.resolutionRate).toBe(100);

      // ─── Action Alerts Verification ───────────────────────────────────
      expect(overview.actionAlerts.length).toBeGreaterThanOrEqual(2);
      const delayAlert = overview.actionAlerts.find((a) => a.relatedProjectId === proj2Id);
      expect(delayAlert).toBeDefined();
      expect(delayAlert?.type).toBe('critical');

      const debtAlert = overview.actionAlerts.find((a) => a.relatedProjectId === proj1Id);
      expect(debtAlert).toBeDefined();
      expect(debtAlert?.type).toBe('warning');
    });

    it('strictly enforces multi-tenant isolation (Gate 0 / P0)', async () => {
      // Create project in Tenant A
      const projA: InteriorProject = {
        id: randomUUID(),
        tenantId: TENANT_A,
        code: 'DA-A',
        name: 'Dự án Tenant A',
        customerId: 'cust-a',
        customerName: 'Tenant A User',
        siteAddress: 'Hà Nội',
        projectType: 'residential_villa',
        status: 'in_production',
        estimatedBudget: 1_000_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS A',
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      };
      await repo.saveProject(TENANT_A, projA);

      // Tenant B query should return 0 projects
      const resultB = await realService.computePortfolioOverview(TENANT_B);
      expect(resultB.projects).toHaveLength(0);
      expect(resultB.kpis.totalProjects.value).toBe(0);

      // Empty tenantId should throw TenantIsolationViolationError
      await expect(realService.computePortfolioOverview('')).rejects.toThrow(TenantIsolationViolationError);
    });
  });
});
