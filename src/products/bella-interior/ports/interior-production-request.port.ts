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

/**
 * Commercial Source-of-Truth lineage passed immutably to Manufacturing OS.
 *
 * INVARIANT (Commercial Source-of-Truth):
 *   Every production intake MUST carry exact version references that trace back
 *   to the approved commercial chain. Manufacturing OS MUST NOT substitute
 *   "latest" for any of these approved snapshot identifiers.
 *
 * Required pre-conditions (enforced by CommercialIntakeValidationService
 * before this payload is constructed):
 *   1. boq.snapshot_sealed_at IS NOT NULL — BOQ must be sealed (approved/locked)
 *   2. quotation.status IN ('accepted') — only accepted quotations may trigger production
 *   3. contract.status IN ('signed', 'active') — contract must be executed
 *   4. customerApprovalId references an approval record with status = 'approved'
 *   5. All version numbers must be > 0 and match persisted records
 */
export interface CommercialSourceOfTruth {
  /** Executed contract ID (Phase 3) */
  readonly contractId: string;
  /** Exact quotation ID used to generate the contract */
  readonly quotationId: string;
  /** Quotation version number at the time of contract formation */
  readonly quotationVersionNumber: number;
  /** BOQ ID whose snapshot underpins the quotation */
  readonly boqId: string;
  /** BOQ version number — must reference a sealed (locked_for_contract) BOQ snapshot */
  readonly boqVersionNumber: number;
  /** Sealed timestamp of the BOQ snapshot (ISO-8601) — must NOT be null */
  readonly boqSnapshotSealedAt: string;
  /** Exact persisted BOQ status accepted for intake after snapshot seal validation. */
  readonly boqSealedStatus: 'approved' | 'locked_for_contract';
  /** Design revision ID whose approved takeoff produced the BOQ */
  readonly designRevisionId: string;
  /** Design revision version number at the time of approval */
  readonly designRevisionVersionNumber: number;
  /** Customer approval record ID (Phase 4) with status = 'approved' */
  readonly customerApprovalId: string;
  /**
   * Reference path to stored signature document (Supabase Storage / S3).
   * Populated from CustomerApproval.signatureReference if present.
   */
  readonly signatureReferenceStoragePath?: string;
  /**
   * SHA-256 integrity hash of the uploaded signed document artifact.
   *
   * IMPORTANT ARCHITECTURAL QUALIFICATION:
   * This SHA-256 hash verifies document artifact file integrity in storage.
   * It does NOT constitute a legal PKI digital signature, nor does it
   * independently prove the signer's identity or authorization.
   * Authoritative approval proof resides in the CustomerApproval record.
   */
  readonly signatureFileSha256?: string;
  /** Baseline contract value (amount agreed at signing, before addenda) */
  readonly baselineContractValue: number;
  /** Current contract value after all addenda (may equal baseline if no addenda) */
  readonly currentContractValue: number;
  /**
   * Role of the actor issuing the production request.
   * Must be authorized (OWNER, ADMIN, PROJECT_MANAGER, or interior:production:request).
   */
  readonly authorizedActorRole: string;
  /**
   * Idempotency key uniquely identifying this release attempt.
   * Guards against duplicate ProductionOrders from retries or double-clicks.
   */
  readonly idempotencyKey: string;
  /** Addendum ID if this release is for an approved contract variation order */
  readonly addendumId?: string;
  /** Addendum number (e.g. 'ADD-01') if applicable */
  readonly addendumNumber?: string;
}

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
  /** Role of the requesting actor for RBAC verification */
  readonly userRole: string;
  /** Unique idempotency key to prevent duplicate production orders */
  readonly idempotencyKey: string;
  /** Must be an approved DesignRevision — enforced by CommercialIntakeValidationService */
  readonly designRevisionId: string;
  readonly interiorProjectId: string;
  readonly projectCode: string;
  /**
   * Immutable commercial lineage — must be validated before construction.
   * @see CommercialSourceOfTruth for pre-conditions.
   */
  readonly commercialSourceOfTruth: CommercialSourceOfTruth;
  readonly items: FurnitureProductionItem[];
  readonly requiredByDate: string;
  /** Optional reference to approved contract addendum for variation releases */
  readonly addendumId?: string;
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
 * Current adapter: PlatformManufacturingAdapter (throws MANUFACTURING_AUTHORIZATION_CONTEXT_UNAVAILABLE)
 */
export interface InteriorProductionRequestPort {
  /**
   * Request Platform Manufacturing OS to create a production order
   * for the given furniture items linked to an approved Interior design revision.
   *
   * INVARIANTS enforced before this method is called:
   *   - designRevisionId references an APPROVED DesignRevision
   *   - commercialSourceOfTruth.boqSnapshotSealedAt IS NOT NULL
   *   - All Commercial chain IDs/versions are validated against persisted records
   *   - customerApprovalId references an APPROVED CustomerApproval
   *
   * @see CommercialIntakeValidationService for pre-condition enforcement
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

