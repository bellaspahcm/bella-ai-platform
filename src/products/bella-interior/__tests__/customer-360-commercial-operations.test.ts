/**
 * Bella Interior OS — Customer 360 Commercial Operations & Lineage Tests
 *
 * Verifies:
 * 1. Comprehensive Customer 360: Profile, Multi-project, Contracts, Handover, Warranty.
 * 2. Per-contract Collection & Debt Breakdown: paidAmount, remainingDebt.
 * 3. Warranty Certificate & Service Ticket Linkage: certificateNumber resolution.
 * 4. Chronological Interaction Timeline: Including warranty_certificate_issued and handover_accepted.
 * 5. Strict Multi-tenant Isolation: Cross-tenant access blocked.
 *
 * @module src/products/bella-interior/__tests__/customer-360-commercial-operations.test
 */

import { randomUUID } from 'crypto';
import { InMemoryCustomerRepository } from '../repositories/crm/in-memory-customer.repository';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';
import { TenantIsolationViolationError } from '../domain/crm/customer-errors';
import type { InteriorProject } from '../domain/design-specification/types';
import type { InteriorContract } from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type {
  HandoverDossier,
  WarrantyCertificate,
  WarrantyServiceTicket,
} from '../domain/delivery-aftercare/types';

describe('Customer 360 Commercial Operations & Handover-Warranty Lineage', () => {
  const TENANT_A = `tenant-commercial-${randomUUID()}`;
  const TENANT_B = `tenant-isolated-${randomUUID()}`;

  let customerRepo: InMemoryCustomerRepository;
  let interiorRepo: InMemoryInteriorRepository;
  let aggregator: Customer360AggregatorService;

  beforeEach(() => {
    customerRepo = new InMemoryCustomerRepository();
    interiorRepo = new InMemoryInteriorRepository();
    aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);
  });

  it('aggregates per-contract payment progress, remaining debt, and collection ratio', async () => {
    // 1. Create Customer
    const customer = await customerRepo.create(TENANT_A, {
      code: 'KH-CORP-001',
      name: 'Tập đoàn Đầu tư & Phát triển Bất động sản ABC',
      type: 'enterprise',
      tier: 'vip',
      primaryPhone: '0909888999',
    });

    // 2. Create Project
    const projectId = randomUUID();
    const project: InteriorProject = {
      id: projectId,
      tenantId: TENANT_A,
      code: 'DA-2026-VIP',
      name: 'Văn phòng Trụ sở ABC Tower',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: '0909888999',
      siteAddress: 'Tầng 18, Tháp ABC, Cầu Giấy, Hà Nội',
      projectType: 'commercial_office',
      status: 'contracted',
      estimatedBudget: 5_000_000_000,
      targetCompletionDate: '2026-12-31',
      leadArchitectId: 'arch-lead-1',
      leadArchitectName: 'KTS Lê Hoàng',
      createdAt: '2026-01-10T08:00:00.000Z',
      updatedAt: '2026-01-10T08:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_A, project);

    // 3. Create Contract 1 (Fit-out Fitment: 3,000,000,000 VND)
    const contract1Id = randomUUID();
    const milestone1Id = randomUUID();
    const contract1: InteriorContract = {
      id: contract1Id,
      tenantId: TENANT_A,
      projectId,
      quotationId: randomUUID(),
      contractNumber: 'HD-ABC-01',
      title: 'Hợp đồng Thi công Hoàn thiện Nội thất Văn phòng',
      status: 'signed',
      baselineContractValue: 3_000_000_000,
      currentContractValue: 3_000_000_000,
      signedDate: '2026-01-15',
      clientRepresentative: 'Ông Nguyễn Văn Giám Đốc',
      contractorRepresentative: 'Bella Interior',
      addenda: [],
      createdAt: '2026-01-12T08:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
      milestones: [
        {
          id: milestone1Id,
          tenantId: TENANT_A,
          contractId: contract1Id,
          milestoneOrder: 1,
          name: 'Đợt 1: Tạm ứng hợp đồng',
          percentage: 60,
          amount: 1_800_000_000,
          triggerCondition: 'Sau khi ký kết hợp đồng',
          status: 'paid',
        },
      ],
    };
    await interiorRepo.saveContract(TENANT_A, contract1);

    // Pay 1,800,000,000 VND for Contract 1
    const payment1: PaymentTransaction = {
      id: randomUUID(),
      tenantId: TENANT_A,
      contractId: contract1Id,
      milestoneId: milestone1Id,
      referenceCode: 'UNC-ABC-001',
      amount: 1_800_000_000,
      paymentMethod: 'bank_transfer',
      transactionDate: '2026-01-20T10:00:00.000Z',
      recordedBy: 'accountant-1',
      createdAt: '2026-01-20T10:00:00.000Z',
    };
    await interiorRepo.savePaymentTransaction(TENANT_A, payment1);

    // 4. Create Contract 2 (Loose Furniture & Acoustic: 1,000,000,000 VND - Fully Paid)
    const contract2Id = randomUUID();
    const milestone2Id = randomUUID();
    const contract2: InteriorContract = {
      id: contract2Id,
      tenantId: TENANT_A,
      projectId,
      quotationId: randomUUID(),
      contractNumber: 'HD-ABC-02',
      title: 'Hợp đồng Cung cấp Nội thất Rời & Tiêu âm',
      status: 'signed',
      baselineContractValue: 1_000_000_000,
      currentContractValue: 1_000_000_000,
      signedDate: '2026-02-01',
      clientRepresentative: 'Ông Nguyễn Văn Giám Đốc',
      contractorRepresentative: 'Bella Interior',
      addenda: [],
      createdAt: '2026-01-28T08:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
      milestones: [
        {
          id: milestone2Id,
          tenantId: TENANT_A,
          contractId: contract2Id,
          milestoneOrder: 1,
          name: 'Đợt 1: Toàn bộ giá trị',
          percentage: 100,
          amount: 1_000_000_000,
          triggerCondition: 'Ký nghiệm thu sản xuất',
          status: 'paid',
        },
      ],
    };
    await interiorRepo.saveContract(TENANT_A, contract2);

    // Pay 1,000,000,000 VND for Contract 2
    const payment2: PaymentTransaction = {
      id: randomUUID(),
      tenantId: TENANT_A,
      contractId: contract2Id,
      milestoneId: milestone2Id,
      referenceCode: 'UNC-ABC-002',
      amount: 1_000_000_000,
      paymentMethod: 'bank_transfer',
      transactionDate: '2026-02-05T14:00:00.000Z',
      recordedBy: 'accountant-1',
      createdAt: '2026-02-05T14:00:00.000Z',
    };
    await interiorRepo.savePaymentTransaction(TENANT_A, payment2);

    // 5. Query Customer 360
    const profile = await aggregator.getCustomer360(TENANT_A, customer.id);
    expect(profile).not.toBeNull();

    // Verify Contracts breakdown
    const contracts = profile?.commercial.contracts || [];
    expect(contracts).toHaveLength(2);

    const c1 = contracts.find((c) => c.id === contract1Id);
    expect(c1).toBeDefined();
    expect(c1?.contractValue).toBe(3_000_000_000);
    expect(c1?.paidAmount).toBe(1_800_000_000);
    expect(c1?.remainingDebt).toBe(1_200_000_000);

    const c2 = contracts.find((c) => c.id === contract2Id);
    expect(c2).toBeDefined();
    expect(c2?.contractValue).toBe(1_000_000_000);
    expect(c2?.paidAmount).toBe(1_000_000_000);
    expect(c2?.remainingDebt).toBe(0);

    // Verify Overall Financial Summary
    expect(profile?.financialSummary.totalContractValue).toBe(4_000_000_000);
    expect(profile?.financialSummary.totalPaidAmount).toBe(2_800_000_000);
    expect(profile?.financialSummary.receivableDebt).toBe(1_200_000_000);
    expect(profile?.financialSummary.overpaidAmount).toBe(0);
  });

  it('aggregates handover dossiers, warranty certificates, and links tickets with certificate numbers', async () => {
    // 1. Create Customer & Project
    const customer = await customerRepo.create(TENANT_A, {
      code: 'KH-RES-002',
      name: 'Bà Lê Minh Tâm',
      type: 'individual',
      tier: 'standard',
    });

    const projectId = randomUUID();
    const project: InteriorProject = {
      id: projectId,
      tenantId: TENANT_A,
      code: 'DA-RES-002',
      name: 'Căn hộ Duplex Vinhomes Skylake',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: '0912345678',
      siteAddress: 'P.2408, Tòa S2, Vinhomes Skylake, Phạm Hùng, Hà Nội',
      projectType: 'residential_apartment',
      status: 'handover',
      estimatedBudget: 1_500_000_000,
      targetCompletionDate: '2026-06-30',
      leadArchitectId: 'arch-3',
      leadArchitectName: 'KTS Trần Đức',
      createdAt: '2026-02-01T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_A, project);

    // 2. Handover Dossier
    const dossierId = randomUUID();
    const handoverDossier: HandoverDossier = {
      id: dossierId,
      tenantId: TENANT_A,
      projectId,
      contractId: randomUUID(),
      customerName: customer.name,
      siteAddress: project.siteAddress,
      handoverDate: '2026-06-15',
      actualHandoverDate: '2026-06-15',
      status: 'client_approved',
      finalSettlementValue: 1_450_000_000,
      clientAccepted: true,
      clientSignoffName: 'Lê Minh Tâm',
      warrantyPeriodMonths: 24,
      dossierDocumentUrl: 'https://storage.bella.vn/dossiers/dossier-2408.pdf',
    };
    await interiorRepo.saveHandoverDossier(TENANT_A, handoverDossier);

    // 3. Warranty Certificate
    const certId = randomUUID();
    const certificate: WarrantyCertificate = {
      id: certId,
      tenantId: TENANT_A,
      projectId,
      contractId: handoverDossier.contractId,
      certificateNumber: 'BH-2026-VHL-001',
      customerName: customer.name,
      siteAddress: project.siteAddress,
      effectiveDate: '2026-06-15',
      expirationDate: '2028-06-15',
      woodworkWarrantyMonths: 24,
      hardwareWarrantyMonths: 36,
      stoneWarrantyMonths: 120,
      termsSummary: 'Bảo hành 24 tháng gỗ An Cường, 36 tháng phụ kiện Hafele, 120 tháng mặt đá Vicostone.',
    };
    await interiorRepo.saveWarrantyCertificate(TENANT_A, certificate);

    // 4. Warranty Service Ticket linked to the certificate
    const ticketId = randomUUID();
    const ticket: WarrantyServiceTicket = {
      id: ticketId,
      tenantId: TENANT_A,
      projectId,
      certificateId: certId,
      ticketNumber: 'SC-2026-0042',
      reportedDate: '2026-07-10',
      customerReport: 'Ray trượt ngăn kéo tủ bếp dưới tầng 1 bị kẹt bi',
      roomZoneName: 'Khu vực bếp',
      itemName: 'Ray trượt Hafele',
      defectCategory: 'hardware_defect',
      status: 'assigned',
      assignedTechnician: 'Thợ Kỹ thuật Hafele',
    };
    await interiorRepo.saveWarrantyTicket(TENANT_A, ticket);

    // 5. Query Customer 360
    const profile = await aggregator.getCustomer360(TENANT_A, customer.id);
    expect(profile).not.toBeNull();

    // Verify Delivery / Handovers
    const handovers = profile?.delivery.handovers || [];
    expect(handovers).toHaveLength(1);
    expect(handovers[0].id).toBe(dossierId);
    expect(handovers[0].clientAccepted).toBe(true);
    expect(handovers[0].clientSignoffName).toBe('Lê Minh Tâm');

    // Verify Warranty Certificates
    const certs = profile?.aftercare.warrantyCertificates || [];
    expect(certs).toHaveLength(1);
    expect(certs[0].id).toBe(certId);
    expect(certs[0].certificateNumber).toBe('BH-2026-VHL-001');
    expect(certs[0].effectiveDate).toBe('2026-06-15');
    expect(certs[0].expirationDate).toBe('2028-06-15');
    expect(certs[0].termsSummary).toContain('phụ kiện Hafele');

    // Verify Service Ticket Linkage
    const tickets = profile?.aftercare.warrantyTickets || [];
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe(ticketId);
    expect(tickets[0].certificateId).toBe(certId);
    expect(tickets[0].certificateNumber).toBe('BH-2026-VHL-001');
    expect(tickets[0].description).toBe('Ray trượt ngăn kéo tủ bếp dưới tầng 1 bị kẹt bi');
    expect(tickets[0].defectCategory).toBe('hardware_defect');

    // Verify Timeline Events
    const timeline = profile?.timeline || [];
    const certIssuedEvent = timeline.find((e) => e.eventType === 'warranty_certificate_issued');
    expect(certIssuedEvent).toBeDefined();
    expect(certIssuedEvent?.title).toContain('BH-2026-VHL-001');
    expect(certIssuedEvent?.referenceId).toBe('BH-2026-VHL-001');

    const handoverEvent = timeline.find((e) => e.eventType === 'handover_accepted');
    expect(handoverEvent).toBeDefined();
    expect(handoverEvent?.description).toContain('Lê Minh Tâm');
  });

  it('strictly enforces multi-tenant isolation (Gate 0 / P0)', async () => {
    // Create customer in Tenant A
    const custA = await customerRepo.create(TENANT_A, {
      code: 'KH-A-SECRET',
      name: 'Khách hàng Bảo mật Tenant A',
    });

    const projA: InteriorProject = {
      id: randomUUID(),
      tenantId: TENANT_A,
      code: 'DA-A-SECRET',
      name: 'Dự án Bí mật Tenant A',
      customerId: custA.id,
      customerName: custA.name,
      siteAddress: 'Hà Nội',
      projectType: 'residential_villa',
      status: 'signed',
      estimatedBudget: 1_000_000_000,
      targetCompletionDate: '2026-12-31',
      leadArchitectId: 'arch-1',
      leadArchitectName: 'KTS A',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await interiorRepo.saveProject(TENANT_A, projA);

    // Tenant B queries Tenant A customer -> MUST BE NULL
    const crossTenantProfile = await aggregator.getCustomer360(TENANT_B, custA.id);
    expect(crossTenantProfile).toBeNull();

    // Invalid tenantId throws TenantIsolationViolationError
    await expect(aggregator.getCustomer360('', custA.id)).rejects.toThrow(TenantIsolationViolationError);
  });
});
