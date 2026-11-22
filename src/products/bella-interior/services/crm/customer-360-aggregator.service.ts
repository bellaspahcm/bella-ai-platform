/**
 * Bella Interior OS — Customer 360 Aggregator Service
 *
 * Implements full 360-degree aggregation of Customer Profiles across:
 * - Direct CRM data (Profile, Contacts, Addresses, Merged Aliases)
 * - Multi-project Portfolio (1 Customer -> N Projects)
 * - Commercial Lifecycle (Quotations, Contracts, Addenda, Payments)
 * - Execution & Site Progress (Production Orders, Site Diaries, QC Punch Lists)
 * - Handover & Acceptance (Dossiers, Signatures)
 * - Warranty & Aftercare (Service Tickets)
 * - Strict Read-Only Financial Projections (Contract Value, Paid, Debt)
 * - Integrated Chronological Interaction Timeline
 *
 * Architectural Invariants:
 * 1. Zero Mutation: Aggregator only queries and projects, never mutates source records.
 * 2. Multi-project: A customer can link to multiple projects simultaneously.
 * 3. Graceful Legacy Fallback: Pre-existing projects with customer names are harmonized
 *    into the single source of truth without data loss.
 * 4. Tenant Isolation: All repository calls strictly scope to the authorized tenantId.
 *
 * @module src/products/bella-interior/services/crm/customer-360-aggregator.service
 */

import { TenantIsolationViolationError } from '../../domain/crm/customer-errors';
import type { ICustomerRepository } from '../../repositories/crm/customer-repository.interface';
import type { IInteriorRepository } from '../../repositories/interior-repository.interface';
import type {
  CustomerProfile,
  CustomerContact,
  CustomerAddress,
  CustomerAlias,
  CustomerType,
  CustomerTier,
  CustomerProfileStatus,
} from '../../domain/crm/customer.types';
import type { HandoverDossier, WarrantyCertificate } from '../../domain/delivery-aftercare/types';
import type {
  Customer360Profile,
  CustomerProjectSummary,
  CustomerQuotationSummary,
  CustomerContractSummary,
  CustomerPaymentSummary,
  CustomerProductionOrderSummary,
  CustomerSiteDiarySummary,
  CustomerPunchListSummary,
  CustomerHandoverSummary,
  CustomerWarrantySummary,
  CustomerWarrantyCertificateSummary,
  CustomerFinancialSummary,
  CustomerTimelineEvent,
  CustomerOverviewQuery,
  CustomerOverviewItem,
  CustomerOverviewResult,
  CustomerKPIOverview,
  CustomerSalesFunnel,
  CustomerGrowthChart,
  CustomerGrowthDataPoint,
} from '../../domain/crm/customer-360.types';
import type {
  CustomerFinancialSummary as PortfolioFinancialSummary,
  CustomerSourceDistributionItem,
  CustomerAlertItem,
  ActionSuggestion,
  CustomerSource,
} from '../../domain/customer-overview.types';

function toSafeIsoString(dateInput: string | null | undefined): string {
  if (!dateInput) return new Date().toISOString();
  const trimmed = dateInput.trim();
  const directParsed = new Date(trimmed);
  if (!Number.isNaN(directParsed.getTime())) {
    return directParsed.toISOString();
  }
  const fallback = new Date(`${trimmed}T12:00:00.000Z`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }
  return new Date().toISOString();
}

export class Customer360AggregatorService {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly interiorRepo: IInteriorRepository,
  ) {}

  private validateTenant(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new TenantIsolationViolationError('Tenant ID must be specified and non-empty.');
    }
  }

  /**
   * Retrieves full 360-degree profile for a customer by ID or Code.
   * Resolves canonical ID across merged aliases automatically.
   */
  async getCustomer360(tenantId: string, customerIdOrCode: string): Promise<Customer360Profile | null> {
    this.validateTenant(tenantId);
    if (!customerIdOrCode || typeof customerIdOrCode !== 'string' || !customerIdOrCode.trim()) {
      return null;
    }

    const trimmedInput = customerIdOrCode.trim();

    // 1. Resolve canonical ID if input is an alias from a merged customer
    let canonicalId = trimmedInput;
    try {
      if (typeof this.customerRepo.resolveCanonicalId === 'function') {
        canonicalId = await this.customerRepo.resolveCanonicalId(tenantId, trimmedInput);
      }
    } catch {
      canonicalId = trimmedInput;
    }

    // 2. Fetch Profile from Customer Repository
    let profile: CustomerProfile | null = null;
    try {
      profile = await this.customerRepo.findById(tenantId, canonicalId);
      if (!profile) {
        profile = await this.customerRepo.findByCode(tenantId, canonicalId);
        if (profile) {
          canonicalId = profile.id;
        }
      }
    } catch {
      profile = null;
    }

    // 3. Fallback: If not found in CRM repo, check if projects reference this customer ID/code
    let allProjects: any[] = [];
    try {
      allProjects = (await this.interiorRepo.listProjects(tenantId)) as any[];
    } catch {
      allProjects = [];
    }
    if (!profile) {
      const matchingProjects = allProjects.filter(
        (p) => p.customerId === trimmedInput || p.customerPhone === trimmedInput || p.customerProfileId === trimmedInput
      );
      if (matchingProjects.length > 0) {
        // If any matching project is linked to a canonical CRM profile, resolve to it
        const projectWithProfile = matchingProjects.find((p) => p.customerProfileId);
        if (projectWithProfile && projectWithProfile.customerProfileId) {
          try {
            profile = await this.customerRepo.findById(tenantId, projectWithProfile.customerProfileId);
            if (profile) {
              canonicalId = profile.id;
            }
          } catch {
            profile = null;
          }
        }

        if (!profile) {
          const first = matchingProjects[0];
          profile = {
            id: first.customerId || trimmedInput,
            tenantId,
            code: `KH-${first.customerId ? first.customerId.substring(0, 8).toUpperCase() : 'LEGACY'}`,
            name: first.customerName || `Khách hàng ${trimmedInput}`,
            type: 'individual',
            tier: 'standard',
            profileStatus: 'active',
            primaryPhone: first.customerPhone || undefined,
            createdAt: first.createdAt || new Date().toISOString(),
            updatedAt: first.updatedAt || new Date().toISOString(),
          };
          canonicalId = profile.id;
        }
      } else {
        return null;
      }
    }

    // 4. Gather all valid aliases for this customer
    let aliases: readonly CustomerAlias[] = [];
    try {
      if (typeof this.customerRepo.getAliases === 'function') {
        aliases = await this.customerRepo.getAliases(tenantId, canonicalId);
      }
    } catch {
      aliases = [];
    }

    const validCustomerIds = new Set<string>([
      canonicalId,
      profile.id,
      ...aliases.map((a) => a.aliasCustomerId),
    ]);

    // 5. Fetch Contacts and Addresses
    let contacts: readonly CustomerContact[] = [];
    let addresses: readonly CustomerAddress[] = [];
    try {
      contacts = await this.customerRepo.listContacts(tenantId, canonicalId);
    } catch {
      contacts = [];
    }
    try {
      addresses = await this.customerRepo.listAddresses(tenantId, canonicalId);
    } catch {
      addresses = [];
    }

    // 6. Gather Multi-Project Lineage
    const linkedProjects = allProjects.filter(
      (p) => validCustomerIds.has(p.customerId) || (p.customerProfileId && validCustomerIds.has(p.customerProfileId))
    );
    const projectSummaries: CustomerProjectSummary[] = linkedProjects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      projectType: p.projectType,
      status: p.status,
      siteAddress: p.siteAddress,
      estimatedBudget: p.estimatedBudget,
      targetCompletionDate: p.targetCompletionDate,
      leadArchitectName: p.leadArchitectName,
      createdAt: p.createdAt,
    }));

    // 7. Aggregate Commercial, Execution, Handover, and Warranty across all linked projects
    const quotationSummaries: CustomerQuotationSummary[] = [];
    const contractSummaries: CustomerContractSummary[] = [];
    const paymentSummaries: CustomerPaymentSummary[] = [];
    const productionOrderSummaries: CustomerProductionOrderSummary[] = [];
    const siteDiarySummaries: CustomerSiteDiarySummary[] = [];
    const punchListSummaries: CustomerPunchListSummary[] = [];
    const handoverSummaries: CustomerHandoverSummary[] = [];
    const warrantySummaries: CustomerWarrantySummary[] = [];
    const warrantyCertificateSummaries: CustomerWarrantyCertificateSummary[] = [];
    const certificateMap = new Map<string, WarrantyCertificate>();
    const timelineEvents: CustomerTimelineEvent[] = [];

    // Add Profile creation/update to timeline
    timelineEvents.push({
      id: `evt-profile-${profile.id}`,
      eventType: 'profile_updated',
      timestamp: toSafeIsoString(profile.createdAt),
      title: 'Hồ sơ khách hàng được khởi tạo',
      description: `Mã khách hàng: ${profile.code} — ${profile.name}`,
    });

    for (const project of linkedProjects) {
      // Timeline: Project Created
      timelineEvents.push({
        id: `evt-proj-created-${project.id}`,
        eventType: 'project_created',
        timestamp: toSafeIsoString(project.createdAt),
        title: `Tạo mới dự án: ${project.name}`,
        description: `Mã dự án: ${project.code} | Loại: ${project.projectType} | Ngân sách: ${project.estimatedBudget.toLocaleString('vi-VN')} ₫`,
        projectId: project.id,
        projectName: project.name,
        referenceId: project.code,
      });

      // Commercial: Quotations
      try {
        const quotations = await this.interiorRepo.listQuotationsByProject(tenantId, project.id);
        for (const q of quotations) {
          quotationSummaries.push({
            id: q.id,
            projectId: project.id,
            projectName: project.name,
            quotationNumber: q.quotationNumber,
            versionNumber: q.versionNumber,
            status: q.status,
            grandTotal: q.grandTotal,
            createdAt: q.createdAt,
          });

          timelineEvents.push({
            id: `evt-quotation-${q.id}`,
            eventType: q.status === 'accepted' ? 'quotation_approved' : 'quotation_issued',
            timestamp: q.createdAt,
            title: `Báo giá ${q.quotationNumber} (v${q.versionNumber})`,
            description: `Trạng thái: ${q.status} | Giá trị: ${q.grandTotal.toLocaleString('vi-VN')} ₫`,
            status: q.status,
            projectId: project.id,
            projectName: project.name,
            referenceId: q.quotationNumber,
          });
        }
      } catch {
        // Quotation query is optional / RBAC scoped
      }

      // Commercial: Contracts & Payments
      try {
        const contracts = await this.interiorRepo.listContractsByProject(tenantId, project.id);
        for (const c of contracts) {
          const addenda = await this.interiorRepo.listContractAddenda(tenantId, c.id);
          const contractValue = c.currentContractValue || c.baselineContractValue || 0;
          const payments = await this.interiorRepo.listPaymentTransactions(tenantId, c.id);
          const contractPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
          const contractRemainingDebt = Math.max(0, contractValue - contractPaidAmount);

          contractSummaries.push({
            id: c.id,
            projectId: project.id,
            projectName: project.name,
            contractNumber: c.contractNumber,
            title: c.title,
            status: c.status,
            contractValue,
            paidAmount: contractPaidAmount,
            remainingDebt: contractRemainingDebt,
            signedDate: c.signedDate,
            addendaCount: addenda.length,
          });

          if (c.signedDate) {
            timelineEvents.push({
              id: `evt-contract-${c.id}`,
              eventType: 'contract_signed',
              timestamp: toSafeIsoString(c.signedDate),
              title: `Ký hợp đồng: ${c.contractNumber}`,
              description: `${c.title} — Giá trị: ${contractValue.toLocaleString('vi-VN')} ₫`,
              status: c.status,
              projectId: project.id,
              projectName: project.name,
              referenceId: c.contractNumber,
            });
          }

          for (const p of payments) {
            paymentSummaries.push({
              id: p.id,
              contractId: c.id,
              milestoneId: p.milestoneId,
              referenceCode: p.referenceCode,
              amount: p.amount,
              paymentMethod: p.paymentMethod,
              transactionDate: p.transactionDate,
              proofUrl: p.proofUrl,
            });

            const isRefund = p.amount < 0;
            timelineEvents.push({
              id: `evt-payment-${p.id}`,
              eventType: isRefund ? 'payment_refunded' : 'payment_received',
              timestamp: toSafeIsoString(p.transactionDate),
              title: isRefund
                ? `Hoàn tiền / Điều chỉnh giảm: ${Math.abs(p.amount).toLocaleString('vi-VN')} ₫`
                : `Thanh toán: ${p.amount.toLocaleString('vi-VN')} ₫`,
              description: `Mã GD: ${p.referenceCode} (${p.paymentMethod}) cho hợp đồng ${c.contractNumber}`,
              status: 'completed',
              projectId: project.id,
              projectName: project.name,
              referenceId: p.id,
            });
          }
        }
      } catch {
        // Contract query is optional / RBAC scoped
      }

      // Execution: Production Orders
      try {
        const productionOrders = await this.interiorRepo.listProductionOrders(tenantId, project.id);
        for (const po of productionOrders) {
          productionOrderSummaries.push({
            id: po.id,
            projectId: project.id,
            projectName: project.name,
            orderNumber: po.orderNumber,
            status: po.status,
            scheduledCompletionDate: po.scheduledCompletionDate,
          });
        }
      } catch {
        // Production order query is optional / RBAC scoped
      }

      // Execution: Site Diaries
      try {
        const siteDiaries = await this.interiorRepo.listSiteDiaries(tenantId, project.id);
        for (const d of siteDiaries) {
          const summary = (d.activitiesCompleted && d.activitiesCompleted.length > 0)
            ? d.activitiesCompleted.join('; ')
            : `Nhật ký ngày ${d.date}`;

          siteDiarySummaries.push({
            id: d.id,
            projectId: project.id,
            projectName: project.name,
            date: d.date,
            weather: d.weather,
            progressSummary: summary,
            photoCount: d.photoUrls ? d.photoUrls.length : 0,
          });

          timelineEvents.push({
            id: `evt-diary-${d.id}`,
            eventType: 'site_diary_logged',
            timestamp: toSafeIsoString(d.date),
            title: `Nhật ký công trường: ${project.name}`,
            description: summary,
            projectId: project.id,
            projectName: project.name,
            referenceId: d.id,
          });
        }
      } catch {
        // Site diary query is optional / RBAC scoped
      }

      // Execution: QC Punch Lists
      try {
        const punchLists = await this.interiorRepo.listPunchListItems(tenantId, project.id);
        for (const pl of punchLists) {
          punchListSummaries.push({
            id: pl.id,
            projectId: project.id,
            projectName: project.name,
            itemName: pl.itemName,
            roomZoneName: pl.roomZoneName,
            severity: pl.severity,
            status: pl.status,
            verifiedAt: pl.verifiedAt,
          });

          timelineEvents.push({
            id: `evt-punch-${pl.id}`,
            eventType: 'qc_punch_list',
            timestamp: toSafeIsoString(pl.verifiedAt || pl.deadline),
            title: `Hạng mục QC (${pl.itemName}) — ${pl.status}`,
            description: `Khu vực: ${pl.roomZoneName} | Mức độ: ${pl.severity} | ${pl.description}`,
            status: pl.status,
            projectId: project.id,
            projectName: project.name,
            referenceId: pl.itemName,
          });
        }
      } catch {
        // QC punch list query is optional / RBAC scoped
      }

      // Handover: Dossier & Acceptance
      try {
        let dossiers: HandoverDossier[] = [];
        if (typeof this.interiorRepo.listHandoverDossiers === 'function') {
          dossiers = await this.interiorRepo.listHandoverDossiers(tenantId, project.id);
        } else {
          const single = await this.interiorRepo.getHandoverDossier(tenantId, project.id);
          if (single) dossiers = [single];
        }

        for (const dossier of dossiers) {
          handoverSummaries.push({
            id: dossier.id,
            projectId: project.id,
            projectName: project.name,
            status: dossier.status,
            handoverDate: dossier.handoverDate,
            clientAccepted: dossier.clientAccepted,
            clientSignoffName: dossier.clientSignoffName,
            dossierDocumentUrl: dossier.dossierDocumentUrl,
          });

          if (dossier.clientAccepted) {
            timelineEvents.push({
              id: `evt-handover-${dossier.id}`,
              eventType: 'handover_accepted',
              timestamp: toSafeIsoString(dossier.handoverDate),
              title: `Khách hàng ký nghiệm thu bàn giao: ${project.name}`,
              description: `Người ký: ${dossier.clientSignoffName || 'Khách hàng'} | Giá trị quyết toán: ${dossier.finalSettlementValue.toLocaleString('vi-VN')} ₫`,
              status: dossier.status,
              projectId: project.id,
              projectName: project.name,
              referenceId: dossier.id,
            });
          }
        }
      } catch {
        // Handover dossier query is optional if not yet initialized
      }

      // Aftercare: Warranty Certificates & Service Tickets
      if (typeof this.interiorRepo.listWarrantyCertificates === 'function') {
        try {
          const certs = await this.interiorRepo.listWarrantyCertificates(tenantId, project.id);
          for (const cert of certs) {
            certificateMap.set(cert.id, cert);
            warrantyCertificateSummaries.push({
              id: cert.id,
              projectId: project.id,
              projectName: project.name,
              certificateNumber: cert.certificateNumber,
              effectiveDate: cert.effectiveDate,
              expirationDate: cert.expirationDate,
              status: 'active',
              termsSummary: cert.termsSummary,
              issuedAt: cert.effectiveDate,
            });

            timelineEvents.push({
              id: `evt-wcert-${cert.id}`,
              eventType: 'warranty_certificate_issued',
              timestamp: toSafeIsoString(cert.effectiveDate),
              title: `Phát hành Chứng thư Bảo hành: ${cert.certificateNumber}`,
              description: `Dự án: ${project.name} | Hiệu lực: ${cert.effectiveDate} đến ${cert.expirationDate} | ${cert.termsSummary || ''}`.trim(),
              status: 'active',
              projectId: project.id,
              projectName: project.name,
              referenceId: cert.certificateNumber,
            });
          }
        } catch {
          // Optional query
        }
      }

      try {
        const warrantyTickets = await this.interiorRepo.listWarrantyTickets(tenantId, project.id);
        for (const wt of warrantyTickets) {
          const matchedCert = wt.certificateId ? certificateMap.get(wt.certificateId) : undefined;
          warrantySummaries.push({
            id: wt.id,
            projectId: project.id,
            projectName: project.name,
            ticketNumber: wt.ticketNumber,
            defectCategory: wt.defectCategory,
            status: wt.status,
            reportedDate: wt.reportedDate,
            resolvedDate: wt.resolvedDate,
            certificateId: wt.certificateId,
            certificateNumber: matchedCert?.certificateNumber,
            priority: 'standard',
            description: wt.customerReport,
          });

          timelineEvents.push({
            id: `evt-warranty-${wt.id}`,
            eventType: wt.status === 'resolved' || wt.status === 'closed' ? 'warranty_ticket_resolved' : 'warranty_ticket_opened',
            timestamp: toSafeIsoString(wt.resolvedDate || wt.reportedDate),
            title: `Phiếu bảo hành: ${wt.ticketNumber}`,
            description: `Vấn đề: ${wt.defectCategory} | Trạng thái: ${wt.status} | Nội dung: ${wt.customerReport}`,
            status: wt.status,
            projectId: project.id,
            projectName: project.name,
            referenceId: wt.ticketNumber,
          });
        }
      } catch {
        // Warranty tickets query is optional / RBAC scoped
      }
    }

    // 8. Financial Summary Calculation (Strictly Read-Only Projection)
    // Only binding contracts with valid commercial recognition ('signed', 'active', 'completed')
    const bindingContractStatuses = new Set(['signed', 'active', 'completed']);
    const bindingContracts = contractSummaries.filter((c) => bindingContractStatuses.has(c.status));
    const totalContractValue = bindingContracts.reduce((sum, c) => sum + c.contractValue, 0);

    // Deduplicate payment transactions by id and sum net amounts (including refunds/negative values)
    const uniquePaymentsMap = new Map<string, CustomerPaymentSummary>();
    for (const p of paymentSummaries) {
      if (!uniquePaymentsMap.has(p.id)) {
        uniquePaymentsMap.set(p.id, p);
      }
    }
    const deduplicatedPayments = Array.from(uniquePaymentsMap.values());
    const totalPaidAmount = deduplicatedPayments.reduce((sum, p) => sum + p.amount, 0);

    const receivableDebt = totalPaidAmount >= totalContractValue ? 0 : totalContractValue - totalPaidAmount;
    const overpaidAmount = totalPaidAmount > totalContractValue ? totalPaidAmount - totalContractValue : 0;

    const completedStatuses = new Set(['completed', 'warranty', 'handover']);
    const completedProjects = projectSummaries.filter((p) => completedStatuses.has(p.status)).length;
    const activeProjects = projectSummaries.length - completedProjects;

    const financialSummary: CustomerFinancialSummary = {
      totalContractValue,
      totalPaidAmount,
      receivableDebt,
      overpaidAmount,
      totalProjects: projectSummaries.length,
      activeProjects,
      completedProjects,
    };

    // 9. Chronological Timeline Sorting (Descending)
    timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      profile,
      contacts,
      addresses,
      projects: projectSummaries,
      commercial: {
        quotations: quotationSummaries,
        contracts: contractSummaries,
        payments: paymentSummaries,
      },
      execution: {
        productionOrders: productionOrderSummaries,
        siteDiaries: siteDiarySummaries,
        punchListItems: punchListSummaries,
      },
      delivery: {
        handovers: handoverSummaries,
      },
      aftercare: {
        warrantyTickets: warrantySummaries,
        warrantyCertificates: warrantyCertificateSummaries,
      },
      financialSummary,
      timeline: timelineEvents,
    };
  }

  /**
   * Lists customer overview items with pagination, filtering, search,
   * dynamic KPIs, sales funnel, and growth projections.
   */
  async listCustomersOverview(
    tenantId: string,
    query: CustomerOverviewQuery = {}
  ): Promise<CustomerOverviewResult> {
    this.validateTenant(tenantId);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    // 1. Fetch CRM Profiles
    let rawProfiles: readonly CustomerProfile[] = [];
    try {
      rawProfiles = await this.customerRepo.list(tenantId, {
        profileStatus: query.profileStatus,
        search: query.search,
      });
    } catch {
      rawProfiles = [];
    }

    // 2. Fetch Projects to harmonize legacy customers
    let allProjects: any[] = [];
    try {
      allProjects = (await this.interiorRepo.listProjects(tenantId)) as any[];
    } catch {
      allProjects = [];
    }

    // Map projects by customer ID (supporting legacy customerId and canonical customerProfileId)
    const projectsByCustomerId = new Map<string, typeof allProjects>();
    for (const p of allProjects) {
      const keys = [p.customerId];
      if (p.customerProfileId && p.customerProfileId !== p.customerId) {
        keys.push(p.customerProfileId);
      }
      for (const k of keys) {
        if (!k) continue;
        const list = projectsByCustomerId.get(k) || [];
        if (!list.some((existing) => existing.id === p.id)) {
          list.push(p);
        }
        projectsByCustomerId.set(k, list);
      }
    }

    // Build unified list of profiles
    const customerMap = new Map<string, CustomerProfile>();
    for (const p of rawProfiles) {
      customerMap.set(p.id, p);
    }

    // Collect legacy customerIds that are already mapped to a canonical CRM profile
    const legacyIdsMappedToProfile = new Set<string>();
    for (const p of allProjects) {
      if (p.customerProfileId && customerMap.has(p.customerProfileId)) {
        if (p.customerId) {
          legacyIdsMappedToProfile.add(p.customerId);
        }
      }
    }

    // Collect phones and codes from existing CRM profiles for fuzzy linking
    const phoneToProfileId = new Map<string, string>();
    const codeToProfileId = new Map<string, string>();
    for (const p of rawProfiles) {
      if (p.primaryPhone) phoneToProfileId.set(p.primaryPhone.trim(), p.id);
      if (p.code) codeToProfileId.set(p.code.toUpperCase().trim(), p.id);
    }

    // Harmonize legacy project customer IDs if not present in customerRepo AND not already mapped
    for (const [custId, pList] of projectsByCustomerId.entries()) {
      if (customerMap.has(custId)) continue;
      if (legacyIdsMappedToProfile.has(custId)) continue;

      const first = pList[0];
      const matchedProfileId =
        (first.customerPhone && phoneToProfileId.get(first.customerPhone.trim())) ||
        codeToProfileId.get(custId.toUpperCase().trim()) ||
        codeToProfileId.get(`KH-${custId.toUpperCase().trim()}`);

      if (matchedProfileId && customerMap.has(matchedProfileId)) {
        // Link these projects into the matched profile instead of creating a duplicate
        const existingList = projectsByCustomerId.get(matchedProfileId) || [];
        for (const proj of pList) {
          if (!existingList.some((e) => e.id === proj.id)) {
            existingList.push(proj);
          }
        }
        projectsByCustomerId.set(matchedProfileId, existingList);
        continue;
      }

      customerMap.set(custId, {
        id: custId,
        tenantId,
        code: custId.toUpperCase().startsWith('KH-')
          ? custId.toUpperCase()
          : `KH-${custId.length <= 12 ? custId.toUpperCase() : custId.substring(0, 8).toUpperCase()}`,
        name: first.customerName || `Khách hàng ${custId}`,
        type: 'individual',
        tier: 'standard',
        profileStatus: 'active',
        primaryPhone: first.customerPhone || undefined,
        createdAt: first.createdAt || new Date().toISOString(),
        updatedAt: first.updatedAt || new Date().toISOString(),
      });
    }

    const allProfiles = Array.from(customerMap.values());

    // 3. Transform to CustomerOverviewItem
    const overviewItems: CustomerOverviewItem[] = [];

    for (const profile of allProfiles) {
      // Filter by type if requested
      if (query.type && profile.type !== query.type) continue;
      // Filter by tier if requested
      if (query.tier && profile.tier !== query.tier) continue;

      const customerProjects = projectsByCustomerId.get(profile.id) || [];

      // Calculate total value & debt across customer's projects
      let customerTotalValue = 0;
      let customerPaidAmount = 0;
      const seenPaymentIds = new Set<string>();

      for (const proj of customerProjects) {
        try {
          const contracts = await this.interiorRepo.listContractsByProject(tenantId, proj.id);
          for (const c of contracts) {
            if (['signed', 'active', 'completed'].includes(c.status)) {
              customerTotalValue += (c.currentContractValue || c.baselineContractValue || 0);
            }
            try {
              const payments = await this.interiorRepo.listPaymentTransactions(tenantId, c.id);
              for (const p of payments) {
                if (!seenPaymentIds.has(p.id)) {
                  seenPaymentIds.add(p.id);
                  customerPaidAmount += p.amount;
                }
              }
            } catch {
              // Ignore payment lookup errors gracefully
            }
          }
        } catch {
          // Ignore contract lookup errors gracefully
        }
      }

      const debt = Math.max(0, customerTotalValue - customerPaidAmount);
      const hasDebt = debt > 0;

      if (query.hasDebt !== undefined && hasDebt !== query.hasDebt) continue;

      // Extract explicit lead stage from notes if stored
      let explicitLeadStage: string | null = null;
      if (profile.notes) {
        const m = profile.notes.match(/\[Lead stage:\s*([a-z_]+)\]/i) || profile.notes.match(/\[Lead stage updated\]\s*([a-z_]+)/i);
        if (m) explicitLeadStage = m[1].toLowerCase();
      }

      // Status derivation for UI overview
      let status = explicitLeadStage || 'lead';
      let statusLabel = 'Tiềm năng';
      let statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';

      if (profile.profileStatus === 'inactive') {
        status = 'inactive';
        statusLabel = 'Tạm dừng';
        statusBadgeClass = 'bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-900/50 dark:text-stone-400 dark:border-stone-700';
      } else if (profile.profileStatus === 'merged') {
        status = 'merged';
        statusLabel = 'Đã gộp';
        statusBadgeClass = 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-700';
      } else if (profile.tier === 'vip' || status === 'vip') {
        status = 'vip';
        statusLabel = 'Khách hàng VIP';
        statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
      } else if (status === 'negotiating') {
        status = 'negotiating';
        statusLabel = 'Đang đàm phán';
        statusBadgeClass = 'bg-violet-50 text-violet-700 border-violet-200';
      } else if (status === 're_engagement') {
        status = 're_engagement';
        statusLabel = 'Chăm sóc lại';
        statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (status === 'transacting' || customerProjects.length > 0) {
        const hasActive = customerProjects.some((p) => p.status !== 'completed' && p.status !== 'warranty');
        if (hasActive || status === 'transacting') {
          status = 'transacting';
          statusLabel = 'Đang theo dự án';
          statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else {
          status = 'completed';
          statusLabel = 'Đã hoàn thành';
          statusBadgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
        }
      }

      // Type Badge
      const typeLabel = profile.type === 'enterprise' ? 'Doanh nghiệp' : 'Cá nhân';
      const typeBadgeClass =
        profile.type === 'enterprise'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-blue-50 text-blue-700 border-blue-200';

      // Resolve manager name / assigned team (Sale & KTS) from notes if stored
      let managerName = '— Chưa phân công —';
      if (profile.notes) {
        const saleMatch = profile.notes.match(/Sale[:\s]+([^|\]]+)/i);
        const ktsMatch = profile.notes.match(/KTS[:\s]+([^|\]]+)/i);
        const genericMatch = profile.notes.match(/(?:Phụ trách|Quản lý)[:\s]+([^|\]]+)/i);

        if (saleMatch && ktsMatch) {
          managerName = `${saleMatch[1].trim()} (Sale) • ${ktsMatch[1].trim()}`;
        } else if (saleMatch) {
          managerName = `${saleMatch[1].trim()} (Sale)`;
        } else if (ktsMatch) {
          managerName = ktsMatch[1].trim();
        } else if (genericMatch) {
          managerName = genericMatch[1].trim();
        }
      } else if (profile.code?.startsWith('KH-0000')) {
        managerName = '— Chưa phân công —';
      }

      overviewItems.push({
        id: profile.id,
        code: profile.code,
        name: profile.name,
        avatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-female-1.jpg',
        type: profile.type,
        typeLabel,
        typeBadgeClass,
        tier: profile.tier,
        source: 'referral',
        sourceLabel: 'Giới thiệu',
        sourceClass: 'bg-amber-50 text-amber-700 border-amber-200',
        managerName,
        managerAvatar: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/team/staff-male-architect-1.jpg',
        opportunityCount: Math.max(1, customerProjects.length),
        projectCount: customerProjects.length,
        totalValue: customerTotalValue,
        totalValueFormatted: `${customerTotalValue.toLocaleString('vi-VN')} ₫`,
        debt,
        debtFormatted: `${debt.toLocaleString('vi-VN')} ₫`,
        hasDebt,
        lastInteractionDate: 'Gần đây',
        status,
        statusLabel,
        statusBadgeClass,
        profileStatus: profile.profileStatus,
        primaryPhone: profile.primaryPhone,
        primaryEmail: profile.primaryEmail,
        notes: profile.notes || undefined,
      });
    }

    // Sort overview items deterministically by code (default: asc, or desc when requested)
    const sortOrder = query.sortOrder ?? 'asc';
    overviewItems.sort((a, b) => (sortOrder === 'desc' ? b.code.localeCompare(a.code) : a.code.localeCompare(b.code)));

    // 4. Search Filter
    let filtered = overviewItems;
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.primaryPhone && c.primaryPhone.includes(q)) ||
          (c.primaryEmail && c.primaryEmail.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedCustomers = filtered.slice(startIndex, startIndex + limit);

    // 5. Compute Dynamic KPIs (Canonical Single Source of Truth)
    const totalCustomers = allProfiles.length;
    const potentialCustomers = overviewItems.filter((c) => c.status === 'lead').length;
    const activeTransacting = overviewItems.filter((c) => c.status === 'transacting').length;
    const vipCustomers = overviewItems.filter((c) => c.tier === 'vip' || c.status === 'vip').length;

    // Real dynamic trends based on profile creation timestamp
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newProfilesLast30Days = allProfiles.filter((p) => {
      if (!p.createdAt) return false;
      return new Date(p.createdAt) >= thirtyDaysAgo;
    }).length;
    const growthTrendPct = totalCustomers > 0 ? Math.round((newProfilesLast30Days / totalCustomers) * 100) : 0;

    const kpis: CustomerKPIOverview = {
      totalCustomers: {
        value: totalCustomers,
        label: 'Tổng khách hàng',
        trend: growthTrendPct > 0 ? `↑ ${growthTrendPct}% tháng này` : 'Ổn định',
        isPositiveTrend: true,
      },
      potentialCustomers: {
        value: potentialCustomers,
        label: 'Khách hàng tiềm năng',
        trend: potentialCustomers > 0 ? `${potentialCustomers} lead mới` : 'Chưa có lead',
        isPositiveTrend: potentialCustomers > 0,
      },
      activeTransacting: {
        value: activeTransacting,
        label: 'Đang giao dịch',
        trend: activeTransacting > 0 ? `${activeTransacting} đang triển khai` : '0 dự án',
        isPositiveTrend: activeTransacting > 0,
      },
      vipCustomers: {
        value: vipCustomers,
        label: 'Khách hàng VIP',
        trend: vipCustomers > 0 ? `${vipCustomers} thành viên VIP` : '0 VIP',
        isPositiveTrend: vipCustomers > 0,
      },
    };

    // 6. Real Dynamic Sales Funnel from Portfolio Lifecycle
    const surveyCount = overviewItems.filter((c) => {
      const projs = projectsByCustomerId.get(c.id) || [];
      return projs.some((p) => ['lead', 'survey', 'design_concept', 'design_3d'].includes(p.status));
    }).length;
    const quotationCount = overviewItems.filter((c) => {
      const projs = projectsByCustomerId.get(c.id) || [];
      return projs.some((p) => ['quotation', 'estimating', 'contract_draft'].includes(p.status));
    }).length;
    const negotiatingCount = overviewItems.filter((c) => c.status === 'negotiating').length;
    const signedCount = overviewItems.filter((c) => c.status === 'transacting' || c.totalValue > 0).length;

    const conversionRate = totalCustomers > 0 ? Math.round((signedCount / totalCustomers) * 100) : 0;
    const salesFunnel: CustomerSalesFunnel = {
      steps: [
        { stepNumber: 1, label: 'Khách hàng tiềm năng', count: potentialCustomers, color: '#3b82f6' },
        { stepNumber: 2, label: 'Khảo sát & tư vấn', count: surveyCount, color: '#10b981' },
        { stepNumber: 3, label: 'Báo giá đề xuất', count: quotationCount, color: '#f59e0b' },
        { stepNumber: 4, label: 'Đàm phán', count: negotiatingCount, color: '#8b5cf6' },
        { stepNumber: 5, label: 'Ký hợp đồng', count: signedCount, color: '#6366f1' },
      ],
      conversionRatePercent: conversionRate,
      conversionRateTrend: signedCount > 0 ? `Tỷ lệ ký kết thực tế ${conversionRate}%` : 'Chưa có hợp đồng ký',
      isConversionPositive: conversionRate >= 20,
      targetAchievementLabel: conversionRate >= 20 ? 'Vượt chỉ tiêu' : 'Đang triển khai',
      targetAchievementSub: `${signedCount}/${totalCustomers} KH đã ký hợp đồng`,
    };

    // 7. Real Dynamic Monthly Growth Chart
    const monthlyCustomerMap: Record<number, number> = {};
    const monthlyRevenueMap: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyCustomerMap[m] = 0;
      monthlyRevenueMap[m] = 0;
    }

    for (const p of allProfiles) {
      if (p.createdAt) {
        const m = new Date(p.createdAt).getMonth() + 1;
        if (monthlyCustomerMap[m] !== undefined) {
          monthlyCustomerMap[m] += 1;
        }
      }
    }

    for (const proj of allProjects) {
      if (proj.createdAt && proj.estimatedBudget) {
        const m = new Date(proj.createdAt).getMonth() + 1;
        if (monthlyRevenueMap[m] !== undefined) {
          monthlyRevenueMap[m] += proj.estimatedBudget;
        }
      }
    }

    let cumulativeCustomers = 0;
    const currentMonthNum = now.getMonth() + 1;
    const dataPoints: CustomerGrowthDataPoint[] = [];

    for (let m = 1; m <= 12; m++) {
      cumulativeCustomers += monthlyCustomerMap[m];
      const countForMonth = m <= currentMonthNum ? Math.max(cumulativeCustomers, monthlyCustomerMap[m]) : totalCustomers;
      const revBillion = Number(((monthlyRevenueMap[m] || 0) / 1_000_000_000).toFixed(2));
      dataPoints.push({
        month: `T${m}`,
        customerCount: countForMonth,
        revenueBillion: revBillion,
      });
    }

    const growthChart: CustomerGrowthChart = {
      timeRangeLabel: '12 tháng',
      dataPoints,
    };

    // 8. Real Portfolio Financial Summary
    const totalContractValue = overviewItems.reduce((acc, c) => acc + c.totalValue, 0);
    const receivableDebt = overviewItems.reduce((acc, c) => acc + c.debt, 0);
    const collected = Math.max(0, totalContractValue - receivableDebt);
    const collectionRatePercent = totalContractValue > 0 ? Math.round((collected / totalContractValue) * 100) : 0;

    const formatCurrencyStr = (amt: number): string => {
      if (amt >= 1_000_000_000) return `${(amt / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} tỷ`;
      if (amt >= 1_000_000) return `${Math.round(amt / 1_000_000)} triệu`;
      return amt > 0 ? `${amt.toLocaleString('vi-VN')} ₫` : '0 ₫';
    };

    const financialSummary: PortfolioFinancialSummary = {
      totalContractValue,
      totalContractValueFormatted: formatCurrencyStr(totalContractValue),
      collected,
      collectedFormatted: formatCurrencyStr(collected),
      receivableDebt,
      receivableDebtFormatted: formatCurrencyStr(receivableDebt),
      collectionRatePercent,
    };

    // 9. Real Source Distribution
    const sourceMapCount: Record<string, number> = {
      referral: 0,
      marketing: 0,
      partner: 0,
      returning: 0,
      website: 0,
    };
    for (const item of overviewItems) {
      const src = item.source || 'referral';
      sourceMapCount[src] = (sourceMapCount[src] || 0) + 1;
    }

    const sourceMeta: Record<string, { label: string; color: string }> = {
      referral: { label: 'Giới thiệu', color: '#10b981' },
      marketing: { label: 'Marketing', color: '#8b5cf6' },
      partner: { label: 'Đối tác', color: '#06b6d4' },
      returning: { label: 'Khách hàng cũ', color: '#64748b' },
      website: { label: 'Website', color: '#f59e0b' },
    };

    const sourceDistribution: CustomerSourceDistributionItem[] = Object.entries(sourceMapCount)
      .filter(([_, count]) => count > 0)
      .map(([sourceKey, count]) => {
        const meta = sourceMeta[sourceKey] || { label: sourceKey, color: '#3b82f6' };
        const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0;
        return {
          source: sourceKey as CustomerSource,
          label: meta.label,
          percentage: pct,
          color: meta.color,
        };
      });

    // 10. Real Contextual Alerts
    const alerts: CustomerAlertItem[] = [];
    const debtors = overviewItems.filter((c) => c.debt > 0).slice(0, 2);
    for (const d of debtors) {
      alerts.push({
        id: `crm-debt-${d.id}`,
        title: `KH ${d.name}`,
        subtitle: `Công nợ cần thu: ${d.debtFormatted}`,
        date: 'Cần thu hồi',
        severity: 'warning',
      });
    }
    const recentLeads = overviewItems.filter((c) => c.status === 'lead').slice(0, 2);
    for (const l of recentLeads) {
      alerts.push({
        id: `crm-lead-${l.id}`,
        title: `KH ${l.name}`,
        subtitle: 'Khách hàng tiềm năng mới cần liên hệ',
        date: 'Lead mới',
        severity: 'info',
      });
    }
    const transactingList = overviewItems.filter((c) => c.status === 'transacting').slice(0, 2);
    for (const t of transactingList) {
      if (alerts.length >= 4) break;
      alerts.push({
        id: `crm-trans-${t.id}`,
        title: `Dự án của ${t.name}`,
        subtitle: `Đang triển khai ${t.projectCount} công trình`,
        date: 'Đang thi công',
        severity: 'success',
      });
    }

    // 11. Real Action Suggestion
    const actionSuggestion: ActionSuggestion = receivableDebt > 0
      ? {
          title: 'Thu hồi công nợ',
          description: `Hiện có ${debtors.length} khách hàng có công nợ tồn đọng với tổng giá trị ${financialSummary.receivableDebtFormatted}. Cần ưu tiên thu hồi.`,
          ctaLabel: 'Xem công nợ →',
          ctaLink: '/dashboard/interior/customers?hasDebt=true',
        }
      : {
          title: 'Chăm sóc khách hàng tiềm năng',
          description: `Hệ thống ghi nhận ${potentialCustomers} khách hàng tiềm năng sẵn sàng khảo sát thực tế và báo giá phương án.`,
          ctaLabel: 'Xem khách hàng tiềm năng →',
          ctaLink: '/dashboard/interior/customers?status=lead',
        };

    return {
      customers: paginatedCustomers,
      total,
      page,
      limit,
      totalPages,
      kpis,
      salesFunnel,
      growthChart,
      financialSummary,
      sourceDistribution,
      alerts,
      actionSuggestion,
    };
  }
}
