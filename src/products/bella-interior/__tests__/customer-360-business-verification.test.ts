import { randomUUID } from 'node:crypto';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InMemoryCustomerRepository } from '../repositories/crm/in-memory-customer.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';
import type { InteriorProject } from '../domain/design-specification/types';
import type { InteriorQuotation, InteriorContract, ContractAddendum, PaymentMilestone } from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type { SiteDiaryEntry, QCPunchListItem, WarrantyServiceTicket, HandoverDossier } from '../domain/delivery-aftercare/types';

describe('Customer 360 Business & Financial Correctness Verification (Cases A-J)', () => {
  const TENANT_ID = 'tenant-' + randomUUID();
  let interiorRepo: InMemoryInteriorRepository;
  let customerRepo: InMemoryCustomerRepository;
  let aggregator: Customer360AggregatorService;

  beforeEach(() => {
    customerRepo = new InMemoryCustomerRepository();
    interiorRepo = new InMemoryInteriorRepository();
    aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);
  });

  // Case A: Khách hàng chưa có dự án
  test('Case A: Customer with 0 projects aggregates cleanly with empty arrays and zero debt', async () => {
    const custA = await customerRepo.create(TENANT_ID, {
      code: 'KH-ZERO-PROJ',
      name: 'Chị Mai Hoa',
      type: 'individual',
      tier: 'standard',
      primaryPhone: '0901111222',
      primaryEmail: 'maihoa@example.com',
    });

    const c360 = await aggregator.getCustomer360(TENANT_ID, custA.id);
    expect(c360).not.toBeNull();
    expect(c360?.profile.id).toBe(custA.id);
    expect(c360?.projects.length).toBe(0);
    expect(c360?.commercial.contracts.length).toBe(0);
    expect(c360?.commercial.quotations.length).toBe(0);
    expect(c360?.commercial.payments.length).toBe(0);
    expect(c360?.financialSummary.totalContractValue).toBe(0);
    expect(c360?.financialSummary.totalPaidAmount).toBe(0);
    expect(c360?.financialSummary.receivableDebt).toBe(0);
    expect(c360?.financialSummary.overpaidAmount).toBe(0);
    expect(c360?.timeline.length).toBeGreaterThanOrEqual(1); // Profile creation event
  });

  // Case B: Khách hàng có nhiều dự án
  test('Case B: Customer with multiple projects (1 Customer -> N Projects) aggregates across all projects', async () => {
    const custB = await customerRepo.create(TENANT_ID, {
      code: 'KH-MULTI-PROJ',
      name: 'Anh Trần Bách',
      type: 'individual',
      tier: 'vip',
      primaryPhone: '0903333444',
    });

    const p1: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-B1',
      name: 'Biệt thự Gamuda',
      customerId: custB.id,
      customerName: custB.name,
      projectType: 'villa',
      status: 'in_progress',
      siteAddress: 'Hoàng Mai, Hà Nội',
      estimatedBudget: 3_000_000_000,
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    };
    const p2: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-B2',
      name: 'Penthouse Sunshine',
      customerId: custB.id,
      customerName: custB.name,
      projectType: 'penthouse',
      status: 'in_progress',
      siteAddress: 'Tây Hồ, Hà Nội',
      estimatedBudget: 5_000_000_000,
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, p1);
    await interiorRepo.saveProject(TENANT_ID, p2);

    const c360 = await aggregator.getCustomer360(TENANT_ID, custB.id);
    expect(c360?.projects.length).toBe(2);
    expect(c360?.financialSummary.totalProjects).toBe(2);
    expect(c360?.financialSummary.activeProjects).toBe(2);
  });

  // Case C: Khách hàng có báo giá nhưng chưa ký hợp đồng
  test('Case C: Customer with quotations but no signed contracts has 0 contract value and 0 receivable debt', async () => {
    const custC = await customerRepo.create(TENANT_ID, {
      code: 'KH-QUOTE-ONLY',
      name: 'Chị Lan Anh',
      type: 'individual',
      tier: 'standard',
    });

    const pC: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-C1',
      name: 'Chung cư Masteri',
      customerId: custC.id,
      customerName: custC.name,
      projectType: 'residential_apartment',
      status: 'concept_design',
      siteAddress: 'Gia Lâm, Hà Nội',
      estimatedBudget: 800_000_000,
      createdAt: '2026-02-11T00:00:00.000Z',
      updatedAt: '2026-02-11T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, pC);

    const qC: InteriorQuotation = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: pC.id,
      boqId: randomUUID(),
      quotationNumber: 'BG-2026-099',
      versionNumber: 1,
      status: 'sent_to_client',
      subtotal: 750_000_000,
      vatPercent: 10,
      vatAmount: 75_000_000,
      discountAmount: 0,
      grandTotal: 825_000_000,
      paymentTerms: '3 phases',
      validityDays: 30,
      createdAt: '2026-02-12T00:00:00.000Z',
    };
    await interiorRepo.saveQuotation(TENANT_ID, qC);

    const c360 = await aggregator.getCustomer360(TENANT_ID, custC.id);
    expect(c360?.commercial.quotations.length).toBe(1);
    expect(c360?.commercial.contracts.length).toBe(0);
    // Crucial financial check: Quotations MUST NOT inflate totalContractValue or receivableDebt
    expect(c360?.financialSummary.totalContractValue).toBe(0);
    expect(c360?.financialSummary.receivableDebt).toBe(0);
    expect(c360?.financialSummary.overpaidAmount).toBe(0);
  });

  // Case D: Khách hàng có nhiều hợp đồng và phụ lục (kèm hợp đồng nháp draft không tính)
  test('Case D & Financial Correctness: Only binding contracts and addenda are calculated, draft contracts are excluded', async () => {
    const custD = await customerRepo.create(TENANT_ID, {
      code: 'KH-ADDENDA',
      name: 'Tập đoàn An Gia',
      type: 'enterprise',
      tier: 'vvip',
    });

    const pD: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-D1',
      name: 'Văn phòng An Gia',
      customerId: custD.id,
      customerName: custD.name,
      projectType: 'commercial',
      status: 'in_production',
      siteAddress: 'Ba Đình, Hà Nội',
      estimatedBudget: 4_000_000_000,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, pD);

    const milestone: PaymentMilestone = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      contractId: 'placeholder',
      milestoneOrder: 1,
      name: 'Tạm ứng',
      percentage: 50,
      amount: 1_150_000_000,
      triggerCondition: 'Ký hợp đồng',
      status: 'pending',
    };

    // Contract 1: Signed, baseline 2 tỷ, currentContractValue 2.3 tỷ (do có phụ lục phát sinh 300 triệu)
    const c1: InteriorContract = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: pD.id,
      quotationId: randomUUID(),
      contractNumber: 'HD-D-01',
      title: 'Hợp đồng thi công nội thất',
      status: 'signed',
      baselineContractValue: 2_000_000_000,
      currentContractValue: 2_300_000_000,
      signedDate: '2026-01-15T00:00:00.000Z',
      clientRepresentative: 'Ông An',
      contractorRepresentative: 'Bà Bella',
      milestones: [{ ...milestone, contractId: 'c1' }],
      addenda: [],
    };
    await interiorRepo.saveContract(TENANT_ID, c1);

    const addendum1: ContractAddendum = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      contractId: c1.id,
      addendumNumber: 'PL-01',
      title: 'Bổ sung vách tiêu âm',
      valueDelta: 300_000_000,
      reason: 'Khách yêu cầu thêm',
      status: 'pending_customer_approval',
      approvedAt: null,
      baseContractValue: 2_000_000_000,
      proposedPaymentSchedule: [],
    };
    await interiorRepo.saveContractAddendum(TENANT_ID, addendum1);

    // Contract 2: Draft only (Giá trị 1.5 tỷ nhưng chưa ký -> KHÔNG ĐƯỢC TÍNH VÀO DOANH THU HOẶC NỢ)
    const cDraft: InteriorContract = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: pD.id,
      quotationId: randomUUID(),
      contractNumber: 'HD-D-DRAFT',
      title: 'Hợp đồng bảo trì dự kiến',
      status: 'draft',
      baselineContractValue: 1_500_000_000,
      currentContractValue: 1_500_000_000,
      signedDate: null,
      clientRepresentative: 'Ông An',
      contractorRepresentative: 'Bà Bella',
      milestones: [],
      addenda: [],
    };
    await interiorRepo.saveContract(TENANT_ID, cDraft);

    const c360 = await aggregator.getCustomer360(TENANT_ID, custD.id);
    expect(c360?.commercial.contracts.length).toBe(2);
    // Crucial check: Draft contract is excluded from financial summary
    expect(c360?.financialSummary.totalContractValue).toBe(2_300_000_000);
    expect(c360?.financialSummary.receivableDebt).toBe(2_300_000_000);
  });

  // Case E & F: Nhiều lần thanh toán, hoàn tiền / điều chỉnh giảm, thanh toán thừa (Overpayment)
  test('Case E & F: Multiple payments, refunds (negative amounts), deduplication, and credit balance (overpayment)', async () => {
    const custE = await customerRepo.create(TENANT_ID, {
      code: 'KH-PAYMENTS',
      name: 'Anh Vũ Hoàng',
      type: 'individual',
      tier: 'standard',
    });

    const pE: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-E1',
      name: 'Nhà phố Ecopark',
      customerId: custE.id,
      customerName: custE.name,
      projectType: 'townhouse',
      status: 'in_progress',
      siteAddress: 'Văn Giang, Hưng Yên',
      estimatedBudget: 1_000_000_000,
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, pE);

    const m1Id = randomUUID();
    const m2Id = randomUUID();
    const cEId = randomUUID();

    const m1: PaymentMilestone = {
      id: m1Id,
      tenantId: TENANT_ID,
      contractId: cEId,
      milestoneOrder: 1,
      name: 'Đợt 1: Tạm ứng',
      percentage: 50,
      amount: 500_000_000,
      triggerCondition: 'Ký hợp đồng',
      status: 'pending',
    };
    const m2: PaymentMilestone = {
      id: m2Id,
      tenantId: TENANT_ID,
      contractId: cEId,
      milestoneOrder: 2,
      name: 'Đợt 2: Thi công',
      percentage: 50,
      amount: 700_000_000,
      triggerCondition: 'Hoàn thành phần thô',
      status: 'pending',
    };

    const cE: InteriorContract = {
      id: cEId,
      tenantId: TENANT_ID,
      projectId: pE.id,
      quotationId: randomUUID(),
      contractNumber: 'HD-E-01',
      title: 'Hợp đồng trọn gói',
      status: 'signed',
      baselineContractValue: 1_000_000_000,
      currentContractValue: 1_000_000_000,
      signedDate: '2026-01-10T00:00:00.000Z',
      clientRepresentative: 'Anh Vũ Hoàng',
      contractorRepresentative: 'Bà Bella',
      milestones: [m1, m2],
      addenda: [],
    };
    await interiorRepo.saveContract(TENANT_ID, cE);

    // Payment 1: Tạm ứng 400 triệu
    const pay1: PaymentTransaction = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      contractId: cE.id,
      milestoneId: m1Id,
      amount: 400_000_000,
      paymentMethod: 'bank_transfer',
      referenceCode: 'TX-01',
      transactionDate: '2026-01-12T10:00:00.000Z',
      recordedBy: 'kế toán 1',
      createdAt: '2026-01-12T10:00:00.000Z',
    };
    // Payment 2: Đợt 2: 700 triệu
    const pay2: PaymentTransaction = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      contractId: cE.id,
      milestoneId: m2Id,
      amount: 700_000_000,
      paymentMethod: 'bank_transfer',
      referenceCode: 'TX-02',
      transactionDate: '2026-01-20T10:00:00.000Z',
      recordedBy: 'kế toán 1',
      createdAt: '2026-01-20T10:00:00.000Z',
    };
    // Payment 3 (Refund / Hoàn tiền do tính nhầm): -50 triệu
    const payRefund: PaymentTransaction = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      contractId: cE.id,
      milestoneId: m1Id,
      amount: -50_000_000,
      paymentMethod: 'bank_transfer',
      referenceCode: 'TX-REFUND-01',
      transactionDate: '2026-01-25T10:00:00.000Z',
      recordedBy: 'kế toán trưởng',
      createdAt: '2026-01-25T10:00:00.000Z',
    };

    await interiorRepo.savePaymentTransaction(TENANT_ID, pay1);
    await interiorRepo.savePaymentTransaction(TENANT_ID, pay2);
    await interiorRepo.savePaymentTransaction(TENANT_ID, payRefund);

    const c360 = await aggregator.getCustomer360(TENANT_ID, custE.id);
    expect(c360?.commercial.payments.length).toBe(3);

    // Total contract: 1,000,000,000
    // Total paid: 400,000,000 + 700,000,000 - 50,000,000 = 1,050,000,000
    expect(c360?.financialSummary.totalContractValue).toBe(1_000_000_000);
    expect(c360?.financialSummary.totalPaidAmount).toBe(1_050_000_000);
    // Since paid > contract, receivableDebt must be 0
    expect(c360?.financialSummary.receivableDebt).toBe(0);
    // Overpaid amount (credit balance) is exactly 50,000,000
    expect(c360?.financialSummary.overpaidAmount).toBe(50_000_000);

    // Verify refund event in timeline
    const refundEvent = c360?.timeline.find((e) => e.eventType === 'payment_refunded');
    expect(refundEvent).toBeDefined();
    expect(refundEvent?.title).toContain('Hoàn tiền / Điều chỉnh giảm');
    expect(refundEvent?.title).toContain('50.000.000');
  });

  // Case G: Khách hàng có dự án đã bàn giao và đang bảo hành
  test('Case G: Customer with handed-over project and active warranty ticket', async () => {
    const custG = await customerRepo.create(TENANT_ID, {
      code: 'KH-WARRANTY',
      name: 'Chị Thu Thủy',
      type: 'individual',
      tier: 'standard',
    });

    const pG: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-G1',
      name: 'Căn hộ Vinhomes Smart City',
      customerId: custG.id,
      customerName: custG.name,
      projectType: 'residential_apartment',
      status: 'warranty',
      siteAddress: 'Nam Từ Liêm, Hà Nội',
      estimatedBudget: 600_000_000,
      createdAt: '2025-06-05T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, pG);

    // Handover dossier
    const dossier: HandoverDossier = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: pG.id,
      status: 'completed',
      handoverDate: '2025-11-20',
      clientAccepted: true,
      clientSignoffName: 'Chị Thu Thủy',
      finalSettlementValue: 590_000_000,
      dossierDocumentUrl: 'https://storage.bella.vn/dossier-g1.pdf',
    };
    await interiorRepo.saveHandoverDossier(TENANT_ID, dossier);

    // Warranty ticket
    const ticket: WarrantyServiceTicket = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      projectId: pG.id,
      certificateId: randomUUID(),
      ticketNumber: 'BH-2026-088',
      defectCategory: 'hardware_hinge',
      customerReport: 'Bản lề cánh tủ bếp trên phát ra tiếng kêu cọt kẹt',
      status: 'in_progress',
      reportedDate: '2026-02-05',
    };
    await interiorRepo.saveWarrantyTicket(TENANT_ID, ticket);

    const c360 = await aggregator.getCustomer360(TENANT_ID, custG.id);
    expect(c360?.delivery.handovers.length).toBe(1);
    expect(c360?.delivery.handovers[0].clientAccepted).toBe(true);
    expect(c360?.aftercare.warrantyTickets.length).toBe(1);
    expect(c360?.aftercare.warrantyTickets[0].ticketNumber).toBe('BH-2026-088');
    expect(c360?.financialSummary.completedProjects).toBe(1);
    expect(c360?.financialSummary.activeProjects).toBe(0);
  });

  // Case H: Khách hàng legacy chưa có CRM profile chuẩn
  test('Case H: Legacy customer exists only in interior_projects without CRM profile', async () => {
    const legacyCustomerId = 'legacy-cust-007';
    const legacyProject: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-LEGACY',
      name: 'Showroom Áo cưới Hoàng Gia',
      customerId: legacyCustomerId,
      customerName: 'Hoàng Gia Wedding',
      projectType: 'commercial',
      status: 'in_progress',
      siteAddress: 'Hai Bà Trưng, Hà Nội',
      estimatedBudget: 1_200_000_000,
      createdAt: '2025-08-01T00:00:00.000Z',
      updatedAt: '2025-08-01T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, legacyProject);

    const c360 = await aggregator.getCustomer360(TENANT_ID, legacyCustomerId);
    expect(c360).not.toBeNull();
    expect(c360?.profile.id).toBe(legacyCustomerId);
    expect(c360?.profile.name).toBe('Hoàng Gia Wedding');
    expect(c360?.profile.code).toContain('KH-LEGACY');
    expect(c360?.projects.length).toBe(1);
    expect(c360?.projects[0].code).toBe('PRJ-LEGACY');
  });

  // Case I: Khách hàng có alias lịch sử sau gộp hồ sơ
  test('Case I: Resolves historical merged alias to canonical surviving profile', async () => {
    const sourceCust = await customerRepo.create(TENANT_ID, {
      code: 'KH-SRC-001',
      name: 'Alpha Chi nhánh 2',
    });

    const canonicalCust = await customerRepo.create(TENANT_ID, {
      code: 'KH-SURVIVING',
      name: 'Công ty Cổ phần Alpha Group',
      type: 'enterprise',
      tier: 'vvip',
    });

    // Record merge
    await customerRepo.recordMerge(TENANT_ID, {
      tenantId: TENANT_ID,
      sourceCustomerId: sourceCust.id,
      targetCustomerId: canonicalCust.id,
      actorId: 'admin-user',
      reason: 'Sáp nhập công ty con',
      contactsTransferredCount: 0,
      addressesTransferredCount: 0,
    });

    const projectOnAlias: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-ALIAS',
      name: 'Chi nhánh Alpha Đống Đa',
      customerId: sourceCust.id, // Project originally assigned to the alias ID
      customerName: 'Alpha Chi nhánh 2',
      projectType: 'commercial',
      status: 'in_progress',
      siteAddress: 'Đống Đa, Hà Nội',
      estimatedBudget: 900_000_000,
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, projectOnAlias);

    // Querying with the old alias ID MUST resolve cleanly to canonical surviving profile with projects
    const c360 = await aggregator.getCustomer360(TENANT_ID, sourceCust.id);
    expect(c360).not.toBeNull();
    expect(c360?.profile.id).toBe(canonicalCust.id);
    expect(c360?.profile.code).toBe('KH-SURVIVING');
    expect(c360?.projects.length).toBe(1);
    expect(c360?.projects[0].code).toBe('PRJ-ALIAS');
  });

  // Case J: Khách hàng thiếu dữ liệu ở một số phân hệ (Không lỗi, trả mảng rỗng tương ứng)
  test('Case J: Gracefully handles missing data across optional modules without throw', async () => {
    const custJ = await customerRepo.create(TENANT_ID, {
      code: 'KH-PARTIAL',
      name: 'Anh Nguyễn Minh',
      type: 'individual',
      tier: 'standard',
    });

    const pJ: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      code: 'PRJ-J1',
      name: 'Dự án đang khảo sát',
      customerId: custJ.id,
      customerName: custJ.name,
      projectType: 'residential_apartment',
      status: 'draft',
      siteAddress: 'Hà Đông, Hà Nội',
      estimatedBudget: 350_000_000,
      createdAt: '2026-02-16T00:00:00.000Z',
      updatedAt: '2026-02-16T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_ID, pJ);

    // No quotations, no contracts, no site diaries, no punch lists, no handovers, no warranties
    const c360 = await aggregator.getCustomer360(TENANT_ID, custJ.id);
    expect(c360).not.toBeNull();
    expect(c360?.projects.length).toBe(1);
    expect(c360?.commercial.quotations).toEqual([]);
    expect(c360?.commercial.contracts).toEqual([]);
    expect(c360?.commercial.payments).toEqual([]);
    expect(c360?.execution.productionOrders).toEqual([]);
    expect(c360?.execution.siteDiaries).toEqual([]);
    expect(c360?.execution.punchListItems).toEqual([]);
    expect(c360?.delivery.handovers).toEqual([]);
    expect(c360?.aftercare.warrantyTickets).toEqual([]);
  });
});
