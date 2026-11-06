/**
 * Interior Production Request Port
 *
 * Interior OS DOES NOT own a Production Engine.
 * It delegates to Platform Manufacturing OS via this port.
 *
 * Interior OS owns:
 *   - FurnitureSpecification (material codes, surfaces, dimensions)
 *   - DesignToProductionMapping (approved revision_id → manufacturing order)
 *   - CabinetryConfiguration (room-level cabinet configuration)
 *   - FurnitureProductionItem (what Interior needs manufactured)
 *
 * Platform Manufacturing OS owns:
 *   - ProductionOrder (the actual production entity)
 *   - BOMRevision (bill of materials)
 *   - RoutingRevision (workshop operation routing)
 *   - WorkCenter (CNC, edge banding, assembly stations)
 *   - QualityDisposition (workshop QC results)
 *
 * @module src/products/bella-interior/ports/interior-production-request.port
 */

export interface FurnitureProductionItem {
  /** Interior item code (from BOQ) */
  readonly boqItemId: string;
  readonly itemName: string;
  readonly roomZoneName: string;
  readonly quantity: number;
  readonly unit: string;
  /** Furniture specification for manufacturing */
  readonly carcassMaterial: string;
  readonly doorFrontMaterial: string;
  readonly surfaceFinish: string;
  readonly hardwareSpec: string;
  readonly dimensionsMm: { width: number; depth: number; height: number };
  readonly estimatedProductionHours: number;
}

export interface InteriorProductionRequestInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  /** Must be an approved DesignRevision — enforced by caller */
  readonly designRevisionId: string;
  readonly interiorProjectId: string;
  readonly projectCode: string;
  readonly items: FurnitureProductionItem[];
  readonly requiredByDate: string;
  readonly notes?: string;
}

export interface InteriorProductionRequestResult {
  /** ID returned from Platform Manufacturing OS */
  readonly manufacturingProductionOrderId: string;
  readonly manufacturingOrderNumber: string;
  readonly status: 'draft' | 'released';
  readonly requestedAt: string;
}

/**
 * Port that Interior OS uses to request production from Platform Manufacturing OS.
 *
 * Implementation options:
 *   A. Direct call: ManufacturingSlice1Service.createProductionOrder() (same process)
 *   B. Event-driven: publish InteriorProductionRequested domain event → Manufacturing OS consumer
 *   C. API call: POST /api/manufacturing/production-orders (cross-service boundary)
 *
 * Decision must be made during Batch 3 (DB integration) based on deployment topology.
 */
export interface InteriorProductionRequestPort {
  /**
   * Request Platform Manufacturing OS to create a production order
   * for the given furniture items linked to an approved Interior design revision.
   *
   * INVARIANT: designRevisionId MUST reference an approved DesignRevision.
   * This is enforced by the caller (InteriorManufacturingService) before invoking.
   */
  requestProduction(
    input: InteriorProductionRequestInput,
  ): Promise<InteriorProductionRequestResult>;

  /**
   * Query the status of a previously submitted production request.
   */
  getProductionStatus(params: {
    tenantId: string;
    manufacturingProductionOrderId: string;
  }): Promise<{
    status: string;
    currentStage?: string;
    completionPercent?: number;
    dispatchedAt?: string;
  }>;
}
