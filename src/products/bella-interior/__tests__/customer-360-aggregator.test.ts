/**
 * Bella Interior OS — Customer 360 Aggregator Tests
 *
 * Verifies:
 * 1. Tenant Isolation: Rejects unauthenticated/cross-tenant calls.
 * 2. Multi-Project Aggregation: Seamlessly unifies 1 Customer -> N Projects.
 * 3. Commercial & Execution Lineage: Aggregates quotations, contracts, payments, diaries, QC, handover, warranty.
 * 4. Alias Resolution: Merged customer queries resolve to canonical surviving target.
 * 5. Strict Read-Only Financial Projections: Value, paid, and debt calculated accurately.
 * 6. Chronological Interaction Timeline: All multi-project touchpoints sorted descending.
 * 7. Edge Cases: 0 projects, 0 contracts, missing relations, non-existent customer.
 * 8. Pagination, Filtering, Search & KPI calculation.
 *
 * @module src/products/bella-interior/__tests__/customer-360-aggregator.test
 */

import { randomUUID } from 'crypto';
import { InMemoryCustomerRepository } from '../repositories/crm/in-memory-customer.repository';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { Customer360AggregatorService } from '../services/crm/customer-360-aggregator.service';
import { TenantIsolationViolationError } from '../domain/crm/customer-errors';
import type { InteriorProject } from '../domain/design-specification/types';
import type { InteriorQuotation, InteriorContract } from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type { SiteDiaryEntry, QCPunchListItem, WarrantyServiceTicket } from '../domain/delivery-aftercare/types';

describe('Customer 360 Aggregator Service', () => {
  const TENANT_A = 'tenant-a-' + randomUUID();
  const TENANT_B = 'tenant-b-' + randomUUID();

  let customerRepo: InMemoryCustomerRepository;
  let interiorRepo: InMemoryInteriorRepository;
  let aggregator: Customer360AggregatorService;

  beforeEach(() => {
    customerRepo = new InMemoryCustomerRepository();
    interiorRepo = new InMemoryInteriorRepository();
    aggregator = new Customer360AggregatorService(customerRepo, interiorRepo);
  });

  describe('Tenant Isolation (Gate 0 / P0)', () => {
    it('throws TenantIsolationViolationError on empty or invalid tenantId', async () => {
      await expect(aggregator.getCustomer360('', 'cust-123')).rejects.toThrow(TenantIsolationViolationError);
      await expect(aggregator.getCustomer360('   ', 'cust-123')).rejects.toThrow(TenantIsolationViolationError);
      await expect(aggregator.listCustomersOverview('')).rejects.toThrow(TenantIsolationViolationError);
    });

    it('strictly isolates customer data between tenants', async () => {
      // Create customer in Tenant A
      const custA = await customerRepo.create(TENANT_A, {
        code: 'KH-001',
        name: 'Nguyen Van A',
        primaryPhone: '0901234567',
      });

      // Query from Tenant B must return null
      const resultTenantB = await aggregator.getCustomer360(TENANT_B, custA.id);
      expect(resultTenantB).toBeNull();

      // Query from Tenant A returns valid profile
      const resultTenantA = await aggregator.getCustomer360(TENANT_A, custA.id);
      expect(resultTenantA).not.toBeNull();
      expect(resultTenantA?.profile.name).toBe('Nguyen Van A');
    });
  });

  describe('Multi-Project Customer Aggregation', () => {
    it('aggregates multiple projects and all associated records under a single customer', async () => {
      // 1. Create Customer
      const cust = await customerRepo.create(TENANT_A, {
        code: 'KH-VIP-001',
        name: 'Tran Thi B',
        primaryPhone: '0987654321',
        primaryEmail: 'b.tran@example.com',
        tier: 'vip',
        type: 'individual',
      });

      // 2. Add Contacts and Addresses
      await customerRepo.addContact(TENANT_A, cust.id, {
        name: 'Le Van C (Tro ly)',
        role: 'primary_contact',
        phone: '0911222333',
        isPrimary: true,
      });

      await customerRepo.addAddress(TENANT_A, cust.id, {
        addressType: 'site_location',
        fullAddress: 'Villa 12, Ciputra, Ha Noi',
        city: 'Ha Noi',
        isDefault: true,
      });

      // 3. Create Project 1 (Villa Ciputra)
      const proj1: InteriorProject = {
        id: randomUUID(),
        tenantId: TENANT_A,
        code: 'INT-2026-001',
        name: 'Villa Ciputra Penthouse',
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: '0987654321',
        siteAddress: 'Villa 12, Ciputra, Ha Noi',
        projectType: 'residential_villa',
        status: 'in_production',
        estimatedBudget: 2_500_000_000,
        targetCompletionDate: '2026-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS Hoang Long',
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-01-10T08:00:00.000Z',
      };
      await interiorRepo.saveProject(TENANT_A, proj1);

      // 4. Create Project 2 (Showroom Shophouse)
      const proj2: InteriorProject = {
        id: randomUUID(),
        tenantId: TENANT_A,
        code: 'INT-2026-002',
        name: 'Showroom Shophouse Marina',
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: '0987654321',
        siteAddress: 'SH-08, Ecopark, Hung Yen',
        projectType: 'retail_showroom',
        status: 'contracted',
        estimatedBudget: 1_200_000_000,
        targetCompletionDate: '2026-11-30',
        leadArchitectId: 'arch-2',
        leadArchitectName: 'KTS Minh Chau',
        createdAt: '2026-02-15T09:00:00.000Z',
        updatedAt: '2026-02-15T09:00:00.000Z',
      };
      await interiorRepo.saveProject(TENANT_A, proj2);

      // 5. Add Commercial records for Project 1
      const quotation1: InteriorQuotation = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj1.id,
        boqId: randomUUID(),
        quotationNumber: 'QT-2026-001',
        versionNumber: 1,
        status: 'accepted',
        subtotal: 2_200_000_000,
        discountAmount: 0,
        vatPercent: 10,
        vatAmount: 220_000_000,
        grandTotal: 2_420_000_000,
        paymentTerms: '4 phases',
        validityDays: 30,
        createdAt: '2026-01-15T10:00:00.000Z',
      };
      await interiorRepo.saveQuotation(TENANT_A, quotation1);

      const milestone1Id = randomUUID();
      const contract1Id = randomUUID();

      const contract1: InteriorContract = {
        id: contract1Id,
        tenantId: TENANT_A,
        projectId: proj1.id,
        quotationId: quotation1.id,
        contractNumber: 'HD-2026-001',
        title: 'Hợp đồng thi công nội thất Villa Ciputra',
        status: 'signed',
        baselineContractValue: 2_420_000_000,
        currentContractValue: 2_420_000_000,
        signedDate: '2026-01-20',
        clientRepresentative: 'Tran Thi B',
        contractorRepresentative: 'Bella Interior',
        addenda: [],
        createdAt: '2026-01-18T10:00:00.000Z',
        updatedAt: '2026-01-20T14:00:00.000Z',
        milestones: [
          {
            id: milestone1Id,
            tenantId: TENANT_A,
            contractId: contract1Id,
            milestoneOrder: 1,
            name: 'Đợt 1: Ký hợp đồng & Tạm ứng',
            percentage: 40,
            amount: 1_000_000_000,
            triggerCondition: 'Ngay sau khi ký hợp đồng',
            status: 'paid',
          },
        ],
      };
      await interiorRepo.saveContract(TENANT_A, contract1);

      // Payment for Contract 1 (Milestone 1 deposit: 1,000,000,000 VND)
      const payment1: PaymentTransaction = {
        id: randomUUID(),
        tenantId: TENANT_A,
        contractId: contract1.id,
        milestoneId: milestone1Id,
        referenceCode: 'PAY-2026-001',
        amount: 1_000_000_000,
        paymentMethod: 'bank_transfer',
        transactionDate: '2026-01-22T10:00:00.000Z',
        recordedBy: 'staff-1',
        createdAt: '2026-01-22T10:00:00.000Z',
      };
      await interiorRepo.savePaymentTransaction(TENANT_A, payment1);

      // 6. Add Execution records for Project 1 (Site diary & Punch list)
      const diary1: SiteDiaryEntry = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj1.id,
        date: '2026-02-01',
        weather: 'clear',
        laborHeadcount: 8,
        activitiesCompleted: ['Lắp đặt hệ thống điện và trần thạch cao phòng khách'],
        materialDelivered: [],
        supervisorName: 'KTS Hoang Long',
        photoUrls: ['https://storage.bella.vn/photo1.jpg'],
      };
      await interiorRepo.saveSiteDiary(TENANT_A, diary1);

      const punch1: QCPunchListItem = {
        id: randomUUID(),
        tenantId: TENANT_A,
        projectId: proj1.id,
        roomZoneName: 'Phòng khách',
        itemName: 'Tủ rượu phòng khách',
        defectCategory: 'scratched_surface',
        description: 'Sơn bệt bị xước nhẹ cạnh tủ rượu',
        severity: 'minor',
        status: 'open',
        assignedFixer: 'Thợ sơn',
        deadline: '2026-02-15',
      };
      await interiorRepo.savePunchListItem(TENANT_A, punch1);

      // 7. Add Warranty record for Project 1
      const warranty1: WarrantyServiceTicket = {
        id: randomUUID(),
        tenantId: TENANT_A,
        certificateId: randomUUID(),
        projectId: proj1.id,
        ticketNumber: 'BH-2026-001',
        reportedDate: '2026-03-01',
        customerReport: 'Bản lề giảm chấn cánh tủ trên bị lỏng',
        roomZoneName: 'Bếp',
        itemName: 'Tủ bếp trên',
        defectCategory: 'hardware_defect',
        status: 'submitted',
      };
      await interiorRepo.saveWarrantyTicket(TENANT_A, warranty1);

      // 8. Execute Customer 360 Aggregation
      const c360 = await aggregator.getCustomer360(TENANT_A, cust.id);

      expect(c360).not.toBeNull();
      // Profile
      expect(c360?.profile.id).toBe(cust.id);
      expect(c360?.profile.name).toBe('Tran Thi B');
      expect(c360?.profile.tier).toBe('vip');

      // Multi-project Lineage
      expect(c360?.projects.length).toBe(2);
      const projIds = c360?.projects.map((p) => p.id);
      expect(projIds).toContain(proj1.id);
      expect(projIds).toContain(proj2.id);

      // Contacts & Addresses
      expect(c360?.contacts.length).toBe(1);
      expect(c360?.contacts[0].name).toBe('Le Van C (Tro ly)');
      expect(c360?.addresses.length).toBe(1);
      expect(c360?.addresses[0].city).toBe('Ha Noi');

      // Commercial
      expect(c360?.commercial.quotations.length).toBe(1);
      expect(c360?.commercial.quotations[0].quotationNumber).toBe('QT-2026-001');
      expect(c360?.commercial.contracts.length).toBe(1);
      expect(c360?.commercial.contracts[0].contractNumber).toBe('HD-2026-001');
      expect(c360?.commercial.payments.length).toBe(1);
      expect(c360?.commercial.payments[0].amount).toBe(1_000_000_000);

      // Execution & Aftercare
      expect(c360?.execution.siteDiaries.length).toBe(1);
      expect(c360?.execution.siteDiaries[0].progressSummary).toContain('Lắp đặt hệ thống điện');
      expect(c360?.execution.punchListItems.length).toBe(1);
      expect(c360?.execution.punchListItems[0].itemName).toBe('Tủ rượu phòng khách');
      expect(c360?.aftercare.warrantyTickets.length).toBe(1);
      expect(c360?.aftercare.warrantyTickets[0].ticketNumber).toBe('BH-2026-001');

      // Read-Only Financial Summary
      expect(c360?.financialSummary.totalContractValue).toBe(2_420_000_000);
      expect(c360?.financialSummary.totalPaidAmount).toBe(1_000_000_000);
      expect(c360?.financialSummary.receivableDebt).toBe(1_420_000_000);
      expect(c360?.financialSummary.totalProjects).toBe(2);
      expect(c360?.financialSummary.activeProjects).toBe(2);

      // Chronological Timeline Sorting (Descending)
      expect(c360?.timeline.length).toBeGreaterThanOrEqual(7);
      const timestamps = c360?.timeline.map((t) => new Date(t.timestamp).getTime()) || [];
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });
  });

  describe('Alias Resolution (Merged Customers)', () => {
    it('resolves historical alias ID to canonical surviving customer profile and projects', async () => {
      // Create Customer Source and Customer Target
      const sourceCust = await customerRepo.create(TENANT_A, {
        code: 'KH-SRC-001',
        name: 'Pham Van Source',
      });

      const targetCust = await customerRepo.create(TENANT_A, {
        code: 'KH-TGT-002',
        name: 'Pham Van Target',
        tier: 'gold',
      });

      // Project associated with Source Customer before merge
      const oldProject: InteriorProject = {
        id: randomUUID(),
        tenantId: TENANT_A,
        code: 'INT-OLD-001',
        name: 'Old Apartment Renovation',
        customerId: sourceCust.id,
        customerName: sourceCust.name,
        customerPhone: '0933444555',
        siteAddress: 'Apt 501, D Capitale',
        projectType: 'residential_apartment',
        status: 'completed',
        estimatedBudget: 500_000_000,
        targetCompletionDate: '2025-12-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS Hoang Long',
        createdAt: '2025-05-01T08:00:00.000Z',
        updatedAt: '2025-05-01T08:00:00.000Z',
      };
      await interiorRepo.saveProject(TENANT_A, oldProject);

      // Perform Merge in repository
      await customerRepo.mergeAtomically(TENANT_A, {
        sourceCustomerId: sourceCust.id,
        targetCustomerId: targetCust.id,
        actorId: 'admin-user',
        reason: 'Duplicate phone and profile detected',
      });

      // Now query Customer 360 using OLD Source ID!
      const resolved360 = await aggregator.getCustomer360(TENANT_A, sourceCust.id);

      expect(resolved360).not.toBeNull();
      // Must resolve to TARGET customer
      expect(resolved360?.profile.id).toBe(targetCust.id);
      expect(resolved360?.profile.name).toBe('Pham Van Target');
      // Must include project that was originally associated with the Source customer
      expect(resolved360?.projects.length).toBe(1);
      expect(resolved360?.projects[0].name).toBe('Old Apartment Renovation');
    });
  });

  describe('Edge Cases & Graceful Degradation', () => {
    it('handles customer with 0 projects without throwing errors', async () => {
      const newLead = await customerRepo.create(TENANT_A, {
        code: 'KH-LEAD-001',
        name: 'Nguyen Tiềm Năng',
        primaryPhone: '0944555666',
        tier: 'standard',
      });

      const c360 = await aggregator.getCustomer360(TENANT_A, newLead.id);

      expect(c360).not.toBeNull();
      expect(c360?.projects).toEqual([]);
      expect(c360?.commercial.quotations).toEqual([]);
      expect(c360?.commercial.contracts).toEqual([]);
      expect(c360?.commercial.payments).toEqual([]);
      expect(c360?.financialSummary.totalContractValue).toBe(0);
      expect(c360?.financialSummary.totalPaidAmount).toBe(0);
      expect(c360?.financialSummary.receivableDebt).toBe(0);
      expect(c360?.financialSummary.totalProjects).toBe(0);
      expect(c360?.timeline.length).toBe(1); // Profile created event
    });

    it('harmonizes legacy projects that have customerId before CRM persistence', async () => {
      // Legacy project with customerId that does not exist in customerRepo
      const legacyProj: InteriorProject = {
        id: randomUUID(),
        tenantId: TENANT_A,
        code: 'INT-LEGACY-001',
        name: 'Legacy Duplex',
        customerId: 'legacy-cust-999',
        customerName: 'Ba Nguyen Thi Legacy',
        customerPhone: '0977888999',
        siteAddress: 'Duplex Golden Palace',
        projectType: 'residential_apartment',
        status: 'contracted',
        estimatedBudget: 800_000_000,
        targetCompletionDate: '2026-10-31',
        leadArchitectId: 'arch-1',
        leadArchitectName: 'KTS Hoang Long',
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      };
      await interiorRepo.saveProject(TENANT_A, legacyProj);

      // Query by legacy customerId
      const c360 = await aggregator.getCustomer360(TENANT_A, 'legacy-cust-999');

      expect(c360).not.toBeNull();
      expect(c360?.profile.id).toBe('legacy-cust-999');
      expect(c360?.profile.name).toBe('Ba Nguyen Thi Legacy');
      expect(c360?.profile.primaryPhone).toBe('0977888999');
      expect(c360?.projects.length).toBe(1);
      expect(c360?.projects[0].name).toBe('Legacy Duplex');
    });

    it('returns null for completely non-existent customer', async () => {
      const result = await aggregator.getCustomer360(TENANT_A, 'unknown-id-404');
      expect(result).toBeNull();
    });
  });

  describe('Pagination, Filtering, Search & KPI Overview', () => {
    it('correctly paginates, filters and computes KPIs', async () => {
      // Seed 5 customers
      for (let i = 1; i <= 5; i++) {
        await customerRepo.create(TENANT_A, {
          code: `KH-PAG-${String(i).padStart(3, '0')}`,
          name: `Khach Hang ${i}`,
          type: i % 2 === 0 ? 'enterprise' : 'individual',
          tier: i === 5 ? 'vip' : 'standard',
          primaryPhone: `090000000${i}`,
        });
      }

      // 1. Pagination: Page 1, Limit 2
      const resPage1 = await aggregator.listCustomersOverview(TENANT_A, { page: 1, limit: 2 });
      expect(resPage1.total).toBe(5);
      expect(resPage1.page).toBe(1);
      expect(resPage1.limit).toBe(2);
      expect(resPage1.totalPages).toBe(3);
      expect(resPage1.customers.length).toBe(2);
      expect(resPage1.customers[0].code).toBe('KH-PAG-001');

      // 2. Pagination: Page 2, Limit 2
      const resPage2 = await aggregator.listCustomersOverview(TENANT_A, { page: 2, limit: 2 });
      expect(resPage2.customers.length).toBe(2);
      expect(resPage2.customers[0].code).toBe('KH-PAG-003');

      // 3. Search by name/phone
      const resSearch = await aggregator.listCustomersOverview(TENANT_A, { search: 'Khach Hang 3' });
      expect(resSearch.total).toBe(1);
      expect(resSearch.customers[0].name).toBe('Khach Hang 3');

      // 4. Filter by type
      const resEnterprise = await aggregator.listCustomersOverview(TENANT_A, { type: 'enterprise' });
      expect(resEnterprise.total).toBe(2);
      expect(resEnterprise.customers.every((c) => c.type === 'enterprise')).toBe(true);

      // 5. KPIs & Analytical Projections (Canonical Single Source of Truth)
      expect(resPage1.kpis.totalCustomers.value).toBe(5);
      expect(resPage1.kpis.vipCustomers.value).toBe(1);
      expect(resPage1.salesFunnel.steps.length).toBe(5);
      expect(resPage1.growthChart.dataPoints.length).toBe(12);
      expect(resPage1.financialSummary).toBeDefined();
      expect(resPage1.sourceDistribution).toBeDefined();
      expect(resPage1.alerts).toBeDefined();
      expect(resPage1.actionSuggestion).toBeDefined();
    });
  });
});
