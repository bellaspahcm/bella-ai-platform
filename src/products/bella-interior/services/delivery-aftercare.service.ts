/**
 * Service 4: Project Delivery & Aftercare Service
 *
 * Implements Daily Site Diary, QC Punch List Inspections, Handover Sign-off with
 * Open Critical Defect checks, and Warranty Care Certificates & Tickets.
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID } from 'crypto';
import {
  TenantIsolationViolationError,
  OpenCriticalPunchListError,
  HandoverCustomerApprovalRequiredError,
} from '../domain/errors';
import type {
  SiteDiaryEntry,
  QCPunchListItem,
  HandoverDossier,
  WarrantyCertificate,
  WarrantyServiceTicket,
} from '../domain/delivery-aftercare/types';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';

export class DeliveryAftercareService {
  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {}

  async recordSiteDiary(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly date: string;
    readonly weather: string;
    readonly laborHeadcount: number;
    readonly activitiesCompleted: string[];
    readonly materialDelivered: string[];
    readonly issuesNoted?: string;
    readonly supervisorName: string;
    readonly photoUrls?: string[];
  }): Promise<SiteDiaryEntry> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const entry: SiteDiaryEntry = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      date: input.date,
      weather: input.weather,
      laborHeadcount: input.laborHeadcount,
      activitiesCompleted: input.activitiesCompleted,
      materialDelivered: input.materialDelivered,
      issuesNoted: input.issuesNoted,
      supervisorName: input.supervisorName,
      photoUrls: input.photoUrls || [],
    };

    await this.repository.saveSiteDiary(input.tenantId, entry);
    return entry;
  }

  async recordPunchListItem(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly roomZoneName: string;
    readonly itemName: string;
    readonly defectCategory: QCPunchListItem['defectCategory'];
    readonly description: string;
    readonly severity: QCPunchListItem['severity'];
    readonly assignedFixer: string;
    readonly deadline: string;
    readonly photoUrl?: string;
  }): Promise<QCPunchListItem> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const item: QCPunchListItem = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      roomZoneName: input.roomZoneName,
      itemName: input.itemName,
      defectCategory: input.defectCategory,
      description: input.description,
      severity: input.severity,
      assignedFixer: input.assignedFixer,
      deadline: input.deadline,
      photoUrl: input.photoUrl,
      status: 'open',
    };

    await this.repository.savePunchListItem(input.tenantId, item);
    return item;
  }

  async rectifyPunchListItem(input: {
    readonly tenantId: string;
    readonly itemId: string;
    readonly projectId: string;
    readonly rectificationNote: string;
  }): Promise<QCPunchListItem> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const items = await this.repository.listPunchListItems(input.tenantId, input.projectId);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) throw new Error(`Punch list item ${input.itemId} not found`);

    const updatedItem: QCPunchListItem = {
      ...item,
      status: 'rectified',
      rectificationNote: input.rectificationNote,
    };

    await this.repository.savePunchListItem(input.tenantId, updatedItem);
    return updatedItem;
  }

  async verifyPunchListItem(input: {
    readonly tenantId: string;
    readonly itemId: string;
    readonly projectId: string;
    readonly verifiedBy: string;
  }): Promise<QCPunchListItem> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const items = await this.repository.listPunchListItems(input.tenantId, input.projectId);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) throw new Error(`Punch list item ${input.itemId} not found`);

    const updatedItem: QCPunchListItem = {
      ...item,
      status: 'verified',
      verifiedBy: input.verifiedBy,
      verifiedAt: new Date().toISOString(),
    };

    await this.repository.savePunchListItem(input.tenantId, updatedItem);
    return updatedItem;
  }

  async completeHandover(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly contractId: string;
    readonly clientSignoffName: string;
    readonly finalSettlementValue: number;
    readonly woodworkWarrantyMonths?: number;
    readonly hardwareWarrantyMonths?: number;
    readonly stoneWarrantyMonths?: number;
  }): Promise<{ dossier: HandoverDossier; certificate: WarrantyCertificate }> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // INVARIANT: Check Punch List for unverified critical/major defects
    const punchList = await this.repository.listPunchListItems(input.tenantId, input.projectId);
    const openCritical = punchList.filter(
      (item) => item.status !== 'verified' && (item.severity === 'critical' || item.severity === 'major')
    );

    if (openCritical.length > 0) {
      throw new OpenCriticalPunchListError(openCritical.length);
    }
    throw new HandoverCustomerApprovalRequiredError();
  }

  async createWarrantyTicket(input: {
    readonly tenantId: string;
    readonly certificateId: string;
    readonly projectId: string;
    readonly roomZoneName: string;
    readonly itemName: string;
    readonly defectCategory: QCPunchListItem['defectCategory'];
    readonly customerReport: string;
  }): Promise<WarrantyServiceTicket> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const ticket: WarrantyServiceTicket = {
      id: randomUUID(),
      tenantId: input.tenantId,
      certificateId: input.certificateId,
      projectId: input.projectId,
      ticketNumber: `TK-${Date.now().toString().slice(-6)}`,
      reportedDate: new Date().toISOString(),
      customerReport: input.customerReport,
      roomZoneName: input.roomZoneName,
      itemName: input.itemName,
      defectCategory: input.defectCategory,
      status: 'submitted',
    };

    await this.repository.saveWarrantyTicket(input.tenantId, ticket);

    // Publish event
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'warranty',
        aggregateId: ticket.id,
        eventType: 'interior.aftercare.warranty_claim_created.v1',
        occurredAt: ticket.reportedDate,
        actorId: 'customer_care',
        actorName: 'Bộ phận bảo hành',
        payload: {
          projectId: input.projectId,
          ticketId: ticket.id,
          certificateId: input.certificateId,
          defectCategory: input.defectCategory,
        },
      });
    }

    return ticket;
  }

  async resolveWarrantyTicket(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly assignedTechnician: string;
    readonly resolutionDetails: string;
  }): Promise<WarrantyServiceTicket> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const tickets = await this.repository.listWarrantyTickets(input.tenantId);
    const ticket = tickets.find((t) => t.id === input.ticketId);
    if (!ticket) throw new Error(`Warranty ticket ${input.ticketId} not found`);

    const updatedTicket: WarrantyServiceTicket = {
      ...ticket,
      status: 'resolved',
      assignedTechnician: input.assignedTechnician,
      resolvedDate: new Date().toISOString(),
      resolutionDetails: input.resolutionDetails,
    };

    await this.repository.saveWarrantyTicket(input.tenantId, updatedTicket);
    return updatedTicket;
  }
}
