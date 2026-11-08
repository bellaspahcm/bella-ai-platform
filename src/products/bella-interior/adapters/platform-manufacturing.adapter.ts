/**
 * Bella Interior OS — Platform Manufacturing Adapter
 *
 * Implements InteriorProductionRequestPort to delegate furniture manufacturing
 * to the Platform Manufacturing OS (src/platform/manufacturing/).
 *
 * Architectural Boundary:
 *   - Interior OS provides: Furniture specifications, material codes, dimensions,
 *     and the approved DesignRevision ID.
 *   - Platform Manufacturing OS provides: Production orders, BOM, routing, work centers,
 *     and workshop execution tracking.
 *
 * @module src/products/bella-interior/adapters
 */

import type {
  InteriorProductionRequestPort,
  InteriorProductionRequestInput,
  InteriorProductionRequestResult,
} from '../ports/interior-production-request.port';
import type { ManufacturingSlice1Service } from '@/platform/manufacturing/manufacturing-slice1.service';
import type { ManufacturingActor } from '@/platform/manufacturing/domain/types';

export class PlatformManufacturingAdapter implements InteriorProductionRequestPort {
  constructor(
    private readonly manufacturingService?: ManufacturingSlice1Service,
    private readonly defaultFactoryOrgUnitId: string = 'org-interior-factory-01',
  ) {}

  async requestProduction(
    input: InteriorProductionRequestInput,
  ): Promise<InteriorProductionRequestResult> {
    const requestedAt = new Date().toISOString();
    const orderNumber = `PO-MFG-${input.projectCode}-${Date.now().toString().slice(-4)}`;

    if (this.manufacturingService) {
      const actor: ManufacturingActor = {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        roles: ['factory_manager'],
        factoryOrgUnitId: this.defaultFactoryOrgUnitId,
      };

      const result = await this.manufacturingService.createProductionOrder(actor, {
        orderNumber,
        finishedGoodItemId: `fg-interior-${input.designRevisionId.slice(0, 8)}`,
        targetQuantity: input.items.reduce((acc, item) => acc + item.quantity, 0) || 1,
        uom: 'set',
        idempotencyKey: `mfg_req_${input.tenantId}_${input.designRevisionId}_${input.interiorProjectId}`,
      });

      return {
        manufacturingProductionOrderId: result.value.id,
        manufacturingOrderNumber: result.value.orderNumber,
        status: result.value.status === 'draft' ? 'draft' : 'released',
        requestedAt,
      };
    }

    throw new Error('MANUFACTURING_SERVICE_UNAVAILABLE');
  }

  async getProductionStatus(params: {
    tenantId: string;
    manufacturingProductionOrderId: string;
  }): Promise<{
    status: string;
    currentStage?: string;
    completionPercent?: number;
  }> {
    void params;
    throw new Error('MANUFACTURING_SERVICE_UNAVAILABLE');
  }
}
