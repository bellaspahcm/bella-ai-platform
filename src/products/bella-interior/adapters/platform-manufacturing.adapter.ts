/**
 * Bella Interior OS — Platform Manufacturing Adapter
 *
 * Holds the Interior-to-Manufacturing contract closed until Product authorization
 * can resolve a canonical Manufacturing actor, factory scope, and persisted BOM.
 *
 * Interior permissions and caller-supplied design data do not establish Platform
 * Manufacturing roles or factory scope. Do not manufacture those values here.
 *
 * @module src/products/bella-interior/adapters
 */

import type {
  InteriorProductionRequestPort,
  InteriorProductionRequestInput,
  InteriorProductionRequestResult,
} from '../ports/interior-production-request.port';

export class PlatformManufacturingAdapter implements InteriorProductionRequestPort {
  async requestProduction(
    _input: InteriorProductionRequestInput,
  ): Promise<InteriorProductionRequestResult> {
    throw new Error('MANUFACTURING_AUTHORIZATION_CONTEXT_UNAVAILABLE');
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

