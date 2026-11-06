/**
 * Bella Interior OS — Master Facade Service
 *
 * Coordinates the 4 Bounded Contexts:
 * 1. Design & Specification
 * 2. Commercial & Costing
 * 3. Manufacturing & Installation
 * 4. Project Delivery & Aftercare
 *
 * Also provides Project Financial P&L Gross Margin calculations.
 *
 * @module src/products/bella-interior/services
 */

import { TenantIsolationViolationError } from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';
import { DesignSpecificationService } from './design-specification.service';
import { CommercialCostingService } from './commercial-costing.service';
import { ManufacturingInstallationService } from './manufacturing-installation.service';
import { DeliveryAftercareService } from './delivery-aftercare.service';

export interface ProjectProfitabilitySummary {
  readonly projectId: string;
  readonly projectName: string;
  readonly contractValue: number;
  readonly internalCostEstimate: number;
  readonly expectedGrossProfit: number;
  readonly grossMarginPercent: number;
  readonly activeStatus: string;
}

export class InteriorOSService {
  public readonly design: DesignSpecificationService;
  public readonly commercial: CommercialCostingService;
  public readonly manufacturing: ManufacturingInstallationService;
  public readonly delivery: DeliveryAftercareService;

  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {
    this.design = new DesignSpecificationService(repository, outbox);
    this.commercial = new CommercialCostingService(repository, outbox);
    this.manufacturing = new ManufacturingInstallationService(repository, outbox);
    this.delivery = new DeliveryAftercareService(repository, outbox);
  }

  /**
   * Calculates real-time Project Profitability & Gross Margin P&L
   */
  async calculateProjectProfitability(
    tenantId: string,
    projectId: string
  ): Promise<ProjectProfitabilitySummary> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const project = await this.repository.getProject(tenantId, projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const contract = await this.repository.getContractByProject(tenantId, projectId);
    const boq = await this.repository.getBOQByProject(tenantId, projectId);

    const contractValue = contract ? contract.currentContractValue : 0;
    const internalCostEstimate = boq ? boq.totalInternalCost : 0;
    const expectedGrossProfit = contractValue - internalCostEstimate;
    const grossMarginPercent = contractValue > 0 ? (expectedGrossProfit / contractValue) * 100 : 0;

    return {
      projectId,
      projectName: project.name,
      contractValue,
      internalCostEstimate,
      expectedGrossProfit,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      activeStatus: project.status,
    };
  }
}

