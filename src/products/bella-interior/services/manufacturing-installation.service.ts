/**
 * Service 3: Manufacturing & Installation Service
 *
 * Implements Furniture Workshop Production Orders (cabinetry & millwork stages),
 * strict Approved Design Lock, and Job-site Room Installation Planning.
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID } from 'crypto';
import {
  TenantIsolationViolationError,
  ApprovedDesignLockViolationError,
} from '../domain/errors';
import type {
  ProductionOrder,
  ProductionOrderItem,
  SiteInstallationPlan,
  SiteRoomInstallation,
  WorkshopOperationStage,
  WorkshopMode,
} from '../domain/manufacturing-install/types';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';

export class ManufacturingInstallationService {
  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {}

  async issueProductionOrder(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly designRevisionId: string;
    readonly boqId: string;
    readonly orderNumber: string;
    readonly mode: WorkshopMode;
    readonly workshopManagerName: string;
    readonly scheduledStartDate: string;
    readonly scheduledCompletionDate: string;
    readonly subcontractorName?: string;
  }): Promise<ProductionOrder> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // STRICT INVARIANT: Approved Design Lock
    const revision = await this.repository.getDesignRevision(input.tenantId, input.designRevisionId);
    if (!revision) {
      throw new Error(`Design revision ${input.designRevisionId} not found`);
    }

    if (revision.status !== 'approved') {
      throw new ApprovedDesignLockViolationError(revision.versionNumber, revision.status);
    }

    // Load BOQ items to build production line items
    const boq = await this.repository.getBOQ(input.tenantId, input.boqId);
    if (!boq) {
      throw new Error(`BOQ ${input.boqId} not found`);
    }

    const orderId = randomUUID();
    const items: ProductionOrderItem[] = boq.items.map((boqItem) => ({
      id: randomUUID(),
      tenantId: input.tenantId,
      productionOrderId: orderId,
      boqItemId: boqItem.id,
      roomZoneName: boqItem.roomZoneName,
      itemName: boqItem.itemName,
      quantity: boqItem.quantity,
      unit: boqItem.unit,
      dimensionsSummary: `${boqItem.dimensions.width}x${boqItem.dimensions.depth}x${boqItem.dimensions.height} mm`,
      materialSummary: `${boqItem.specifications.carcassMaterial} / ${boqItem.specifications.doorFrontMaterial}`,
      currentStage: 'cutting_cnc',
      qcPassed: false,
    }));

    const order: ProductionOrder = {
      id: orderId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      designRevisionId: input.designRevisionId,
      boqId: input.boqId,
      orderNumber: input.orderNumber,
      mode: input.mode,
      subcontractorName: input.subcontractorName,
      status: 'in_production',
      scheduledStartDate: input.scheduledStartDate,
      scheduledCompletionDate: input.scheduledCompletionDate,
      workshopManagerName: input.workshopManagerName,
      items,
    };

    await this.repository.saveProductionOrder(input.tenantId, order);

    // Update Project Status
    const project = await this.repository.getProject(input.tenantId, input.projectId);
    if (project) {
      await this.repository.saveProject(input.tenantId, {
        ...project,
        status: 'in_production',
        updatedAt: new Date().toISOString(),
      });
    }

    // Publish ProductionOrderReleasedEvent
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'production_order',
        aggregateId: order.id,
        eventType: 'interior.production.order_released.v1',
        occurredAt: new Date().toISOString(),
        actorId: input.workshopManagerName,
        actorName: input.workshopManagerName,
        payload: {
          projectId: input.projectId,
          productionOrderId: order.id,
          designRevisionId: input.designRevisionId,
          totalItems: items.length,
        },
      });
    }

    return order;
  }

  async advanceWorkshopStage(input: {
    readonly tenantId: string;
    readonly orderId: string;
    readonly itemId: string;
    readonly newStage: WorkshopOperationStage;
    readonly qcPassed?: boolean;
    readonly qcNotes?: string;
  }): Promise<ProductionOrder> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const order = await this.repository.getProductionOrder(input.tenantId, input.orderId);
    if (!order) throw new Error(`Production order ${input.orderId} not found`);

    const updatedItems = order.items.map((item) => {
      if (item.id === input.itemId) {
        return {
          ...item,
          currentStage: input.newStage,
          qcPassed: input.qcPassed ?? item.qcPassed,
          qcNotes: input.qcNotes ?? item.qcNotes,
        };
      }
      return item;
    });

    // Check if all items dispatched or ready
    const allDispatched = updatedItems.every((i) => i.currentStage === 'dispatched');
    const allPacked = updatedItems.every((i) => i.currentStage === 'packed' || i.currentStage === 'dispatched');

    const status = allDispatched
      ? 'dispatched'
      : allPacked
      ? 'ready_for_dispatch'
      : 'in_production';

    const updatedOrder: ProductionOrder = {
      ...order,
      status,
      items: updatedItems,
      actualDispatchedDate: allDispatched ? new Date().toISOString() : order.actualDispatchedDate,
    };

    await this.repository.saveProductionOrder(input.tenantId, updatedOrder);
    return updatedOrder;
  }

  async createInstallationPlan(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly planNumber: string;
    readonly siteSupervisorId: string;
    readonly siteSupervisorName: string;
    readonly scheduledStartDate: string;
    readonly scheduledEndDate: string;
  }): Promise<SiteInstallationPlan> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const roomZones = await this.repository.listRoomZones(input.tenantId, input.projectId);
    const planId = randomUUID();

    const rooms: SiteRoomInstallation[] = roomZones.map((room) => ({
      id: randomUUID(),
      tenantId: input.tenantId,
      planId,
      roomZoneId: room.id,
      roomZoneName: room.name,
      status: 'not_delivered',
      installerTeamLeader: 'Đội thi công nội thất',
      progressPercent: 0,
      targetInstallDate: input.scheduledEndDate,
    }));

    const plan: SiteInstallationPlan = {
      id: planId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      planNumber: input.planNumber,
      siteSupervisorId: input.siteSupervisorId,
      siteSupervisorName: input.siteSupervisorName,
      scheduledStartDate: input.scheduledStartDate,
      scheduledEndDate: input.scheduledEndDate,
      rooms,
      overallProgressPercent: 0,
    };

    await this.repository.saveInstallationPlan(input.tenantId, plan);

    // Update project status to installing
    const project = await this.repository.getProject(input.tenantId, input.projectId);
    if (project) {
      await this.repository.saveProject(input.tenantId, {
        ...project,
        status: 'installing',
        updatedAt: new Date().toISOString(),
      });
    }

    return plan;
  }

  async updateRoomInstallProgress(input: {
    readonly tenantId: string;
    readonly planId: string;
    readonly roomId: string;
    readonly progressPercent: number;
    readonly status: SiteRoomInstallation['status'];
  }): Promise<SiteInstallationPlan> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const plan = await this.repository.getInstallationPlan(input.tenantId, input.planId);
    if (!plan) throw new Error(`Installation plan ${input.planId} not found`);

    const updatedRooms = plan.rooms.map((room) => {
      if (room.id === input.roomId) {
        return {
          ...room,
          progressPercent: input.progressPercent,
          status: input.status,
          completedDate: input.progressPercent >= 100 ? new Date().toISOString() : undefined,
        };
      }
      return room;
    });

    const overallProgressPercent = updatedRooms.length > 0
      ? Math.round(updatedRooms.reduce((acc, r) => acc + r.progressPercent, 0) / updatedRooms.length)
      : 0;

    const updatedPlan: SiteInstallationPlan = {
      ...plan,
      rooms: updatedRooms,
      overallProgressPercent,
    };

    await this.repository.saveInstallationPlan(input.tenantId, updatedPlan);
    return updatedPlan;
  }
}
