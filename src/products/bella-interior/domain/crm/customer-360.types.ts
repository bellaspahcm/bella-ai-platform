/**
 * Bella Interior OS — Customer 360 & CRM Aggregator Types
 * Package: Customer 360 Aggregator Service & Unified Overview
 *
 * Provides comprehensive cross-functional domain structures unifying:
 * - Core Customer Profile & Multi-channel Contacts & Addresses
 * - Multi-Project Portfolio Lineage (1 Customer -> N Projects)
 * - Commercial Proposal & Contract Lifecycle (Quotations, Contracts, Addenda, Payments)
 * - On-site Construction Progress (Site Diaries, QC Punch Lists, Production Orders)
 * - Handover & Acceptance Records
 * - Aftercare & Warranty Service Tickets
 * - Read-Only Financial Projections (Value, Paid, Debt)
 * - Chronologically Unified Interaction Timeline
 *
 * @module src/products/bella-interior/domain/crm/customer-360.types
 */

import type {
  CustomerProfile,
  CustomerContact,
  CustomerAddress,
  CustomerType,
  CustomerTier,
  CustomerProfileStatus,
} from './customer.types';
import type {
  CustomerFinancialSummary as PortfolioFinancialSummary,
  CustomerSourceDistributionItem,
  CustomerAlertItem,
  ActionSuggestion,
} from '../customer-overview.types';

export interface CustomerProjectSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly projectType: string;
  readonly status: string;
  readonly siteAddress: string;
  readonly estimatedBudget: number;
  readonly targetCompletionDate: string;
  readonly leadArchitectName: string;
  readonly createdAt: string;
}

export interface CustomerQuotationSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly grandTotal: number;
  readonly createdAt: string;
}

export interface CustomerContractSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly contractNumber: string;
  readonly title: string;
  readonly status: string;
  readonly contractValue: number;
  readonly paidAmount?: number;
  readonly remainingDebt?: number;
  readonly signedDate?: string | null;
  readonly addendaCount: number;
}

export interface CustomerPaymentSummary {
  readonly id: string;
  readonly contractId: string;
  readonly milestoneId?: string;
  readonly referenceCode: string;
  readonly amount: number;
  readonly paymentMethod: string;
  readonly transactionDate: string;
  readonly proofUrl?: string;
}

export interface CustomerProductionOrderSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly scheduledCompletionDate?: string;
}

export interface CustomerSiteDiarySummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly date: string;
  readonly weather?: string;
  readonly progressSummary: string;
  readonly photoCount: number;
}

export interface CustomerPunchListSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly itemName: string;
  readonly roomZoneName: string;
  readonly severity: string;
  readonly status: string;
  readonly verifiedAt?: string;
}

export interface CustomerHandoverSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: string;
  readonly handoverDate: string;
  readonly clientAccepted: boolean;
  readonly clientSignoffName?: string;
  readonly dossierDocumentUrl?: string;
}

export interface CustomerWarrantyCertificateSummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly certificateNumber: string;
  readonly effectiveDate: string;
  readonly expirationDate: string;
  readonly status: string;
  readonly termsSummary?: string;
  readonly issuedAt?: string;
}

export interface CustomerWarrantySummary {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly ticketNumber: string;
  readonly defectCategory: string;
  readonly status: string;
  readonly reportedDate: string;
  readonly resolvedDate?: string;
  readonly certificateId?: string;
  readonly certificateNumber?: string;
  readonly priority?: string;
  readonly description?: string;
}

export interface CustomerFinancialSummary {
  readonly totalContractValue: number;
  readonly totalPaidAmount: number;
  readonly receivableDebt: number;
  readonly overpaidAmount?: number;
  readonly totalProjects: number;
  readonly activeProjects: number;
  readonly completedProjects: number;
}

export type TimelineEventType =
  | 'project_created'
  | 'project_status_changed'
  | 'quotation_issued'
  | 'quotation_approved'
  | 'contract_signed'
  | 'payment_received'
  | 'payment_refunded'
  | 'site_diary_logged'
  | 'qc_punch_list'
  | 'handover_accepted'
  | 'warranty_certificate_issued'
  | 'warranty_ticket_opened'
  | 'warranty_ticket_resolved'
  | 'contact_added'
  | 'profile_updated';

export interface CustomerTimelineEvent {
  readonly id: string;
  readonly eventType: TimelineEventType;
  readonly timestamp: string; // ISO-8601
  readonly title: string;
  readonly description: string;
  readonly status?: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly referenceId?: string;
  readonly actorName?: string;
}

/**
 * Customer360Profile
 * Comprehensive unified view of a single customer across all projects and touchpoints.
 */
export interface Customer360Profile {
  readonly profile: CustomerProfile;
  readonly contacts: readonly CustomerContact[];
  readonly addresses: readonly CustomerAddress[];
  readonly projects: readonly CustomerProjectSummary[];
  readonly commercial: {
    readonly quotations: readonly CustomerQuotationSummary[];
    readonly contracts: readonly CustomerContractSummary[];
    readonly payments: readonly CustomerPaymentSummary[];
  };
  readonly execution: {
    readonly productionOrders: readonly CustomerProductionOrderSummary[];
    readonly siteDiaries: readonly CustomerSiteDiarySummary[];
    readonly punchListItems: readonly CustomerPunchListSummary[];
  };
  readonly delivery: {
    readonly handovers: readonly CustomerHandoverSummary[];
  };
  readonly aftercare: {
    readonly warrantyTickets: readonly CustomerWarrantySummary[];
    readonly warrantyCertificates?: readonly CustomerWarrantyCertificateSummary[];
  };
  readonly financialSummary: CustomerFinancialSummary;
  readonly timeline: readonly CustomerTimelineEvent[];
}

export interface CustomerOverviewQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly search?: string;
  readonly type?: CustomerType;
  readonly tier?: CustomerTier;
  readonly profileStatus?: CustomerProfileStatus;
  readonly hasDebt?: boolean;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface CustomerOverviewItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly avatar: string;
  readonly type: CustomerType;
  readonly typeLabel: string;
  readonly typeBadgeClass: string;
  readonly tier: CustomerTier;
  readonly source: string;
  readonly sourceLabel: string;
  readonly sourceClass: string;
  readonly managerName: string;
  readonly managerAvatar: string;
  readonly opportunityCount: number;
  readonly projectCount: number;
  readonly totalValue: number;
  readonly totalValueFormatted: string;
  readonly debt: number;
  readonly debtFormatted: string;
  readonly hasDebt: boolean;
  readonly lastInteractionDate: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
  readonly profileStatus?: 'active' | 'inactive' | 'merged';
  readonly primaryPhone?: string;
  readonly primaryEmail?: string;
  readonly notes?: string;
  readonly createdAt?: string;
}

export interface CustomerKPIOverview {
  readonly totalCustomers: {
    readonly value: number;
    readonly label: string;
    readonly trend: string;
    readonly isPositiveTrend: boolean;
  };
  readonly potentialCustomers: {
    readonly value: number;
    readonly label: string;
    readonly trend: string;
    readonly isPositiveTrend: boolean;
  };
  readonly activeTransacting: {
    readonly value: number;
    readonly label: string;
    readonly trend: string;
    readonly isPositiveTrend: boolean;
  };
  readonly vipCustomers: {
    readonly value: number;
    readonly label: string;
    readonly trend: string;
    readonly isPositiveTrend: boolean;
  };
}

export interface CustomerSalesFunnelStep {
  readonly stepNumber: number;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export interface CustomerSalesFunnel {
  readonly steps: readonly CustomerSalesFunnelStep[];
  readonly conversionRatePercent: number;
  readonly conversionRateTrend: string;
  readonly isConversionPositive: boolean;
  readonly targetAchievementLabel: string;
  readonly targetAchievementSub: string;
}

export interface CustomerGrowthDataPoint {
  readonly month: string;
  readonly customerCount: number;
  readonly revenueBillion: number;
}

export interface CustomerGrowthChart {
  readonly timeRangeLabel: string;
  readonly dataPoints: readonly CustomerGrowthDataPoint[];
}

export interface CustomerOverviewResult {
  readonly customers: readonly CustomerOverviewItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly kpis: CustomerKPIOverview;
  readonly salesFunnel: CustomerSalesFunnel;
  readonly growthChart: CustomerGrowthChart;
  readonly financialSummary?: PortfolioFinancialSummary;
  readonly sourceDistribution?: readonly CustomerSourceDistributionItem[];
  readonly alerts?: readonly CustomerAlertItem[];
  readonly actionSuggestion?: ActionSuggestion;
}
