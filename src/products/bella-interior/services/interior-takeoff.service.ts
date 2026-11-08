/**
 * Bella Interior OS — Interior Takeoff Domain Service (Phase 2A)
 *
 * Implements:
 * 1. Approved Design Lock: Only allow takeoff from Design Revision with status 'approved'.
 * 2. Mandatory Room Zone Binding: Components must belong to a valid project room zone.
 * 3. Stable Component Identity: stableComponentId is preserved across inherited/cloned runs.
 * 4. Category-Flexible Dimensions & Material Binding: No forced schema for dissimilar pieces.
 * 5. Estimator Review Workflow: Component-level review (pending -> verified / review_required).
 * 6. Completed Run Snapshot Immutability: Completed/locked runs cannot be modified.
 * 7. Deduplication & Idempotency: Protects against network retries.
 *
 * @module src/products/bella-interior/services/interior-takeoff.service
 */

import { randomUUID } from 'crypto';
import {
  TenantIsolationViolationError,
  ApprovedDesignLockViolationError,
  TakeoffRunNotFoundError,
  TakeoffRunImmutableError,
  TakeoffComponentNotFoundError,
  InvalidRoomZoneBindingError,
  TakeoffIncompleteReviewError,
} from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type {
  DesignTakeoffRun,
  DesignTakeoffComponent,
  InitializeTakeoffRunInput,
  CreateTakeoffComponentInput,
  UpdateTakeoffComponentInput,
  ReviewTakeoffComponentInput,
  CloneTakeoffRunInput,
} from '../domain/takeoff/types';
import { ensureUuid } from '../lib/uuid-helper';

export class InteriorTakeoffService {
  constructor(private readonly repository: IInteriorRepository) {}

  /**
   * Initializes a new Takeoff Run from an Approved Design Revision.
   * Enforces Approved Design Lock and optional Idempotency.
   */
  async initializeTakeoffRun(input: InitializeTakeoffRunInput): Promise<DesignTakeoffRun> {
    if (!input.tenantId || input.tenantId.trim().length === 0) {
      throw new TenantIsolationViolationError('tenantId is required');
    }

    const project = await this.repository.getProject(input.tenantId, input.projectId);
    if (!project) {
      throw new Error(`Project '${input.projectId}' not found`);
    }

    // 1. Approved Design Lock Check
    const designRevision = await this.repository.getDesignRevision(
      input.tenantId,
      input.designRevisionId,
    );
    if (!designRevision) {
      throw new ApprovedDesignLockViolationError(0, 'not_found');
    }
    if (designRevision.status !== 'approved') {
      throw new ApprovedDesignLockViolationError(
        designRevision.versionNumber,
        designRevision.status,
      );
    }

    // 2. Check Idempotency Key
    const existingRuns = await this.repository.listTakeoffRuns(input.tenantId, input.projectId);
    if (input.idempotencyKey) {
      const match = existingRuns.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (match) {
        return match;
      }
    }

    const runNumber = existingRuns.length + 1;
    const now = new Date().toISOString();

    const newRun: DesignTakeoffRun = {
      id: ensureUuid(randomUUID()),
      tenantId: input.tenantId,
      projectId: input.projectId,
      designRevisionId: input.designRevisionId,
      runNumber,
      title: input.title.trim(),
      status: 'draft',
      isImmutable: false,
      preparedBy: input.preparedBy.trim(),
      idempotencyKey: input.idempotencyKey,
      totalComponentsCount: 0,
      pendingReviewCount: 0,
      verifiedCount: 0,
      reviewRequiredCount: 0,
      components: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveTakeoffRun(input.tenantId, newRun);
    return newRun;
  }

  /**
   * Adds a structured component to a Takeoff Run.
   * Enforces:
   * - Snapshot Immutability (cannot add to completed/locked run)
   * - Mandatory Room Zone binding (must exist in project)
   * - Stable Component Identity (preserves stableComponentId if provided, else generates new)
   */
  async addTakeoffComponent(
    tenantId: string,
    input: CreateTakeoffComponentInput,
  ): Promise<DesignTakeoffComponent> {
    if (!tenantId || tenantId !== input.tenantId) {
      throw new TenantIsolationViolationError('Tenant ID mismatch or missing');
    }

    const run = await this.repository.getTakeoffRun(tenantId, input.takeoffRunId);
    if (!run) {
      throw new TakeoffRunNotFoundError(input.takeoffRunId);
    }
    if (run.isImmutable) {
      throw new TakeoffRunImmutableError(run.id, run.status);
    }

    // Validate Room Zone Binding
    const zones = await this.repository.listRoomZones(tenantId, run.projectId);
    const targetZone = zones.find((z) => z.id === input.roomZoneId);
    if (!targetZone) {
      throw new InvalidRoomZoneBindingError(input.roomZoneId, run.projectId);
    }

    if (input.quantity <= 0) {
      throw new Error('Component quantity must be greater than zero');
    }

    const now = new Date().toISOString();
    const componentId = ensureUuid(randomUUID());
    // Preserve stableComponentId if supplied (e.g. inheritance); otherwise create fresh
    const stableComponentId = input.stableComponentId
      ? ensureUuid(input.stableComponentId)
      : ensureUuid(randomUUID());

    const component: DesignTakeoffComponent = {
      id: componentId,
      stableComponentId,
      tenantId,
      projectId: run.projectId,
      takeoffRunId: run.id,
      designRevisionId: run.designRevisionId,
      roomZoneId: targetZone.id,
      roomZoneName: targetZone.name,
      componentCode: input.componentCode.trim(),
      componentName: input.componentName.trim(),
      category: input.category,
      dimensions: {
        width: input.dimensions?.width,
        depth: input.dimensions?.depth,
        height: input.dimensions?.height,
        thickness: input.dimensions?.thickness,
        diameter: input.dimensions?.diameter,
        customDimensionText: input.dimensions?.customDimensionText,
        unit: 'mm',
      },
      specifications: {
        carcassMaterialId: input.specifications?.carcassMaterialId,
        carcassMaterialName: input.specifications?.carcassMaterialName,
        doorFrontMaterialId: input.specifications?.doorFrontMaterialId,
        doorFrontMaterialName: input.specifications?.doorFrontMaterialName,
        frameMaterialId: input.specifications?.frameMaterialId,
        frameMaterialName: input.specifications?.frameMaterialName,
        upholsteryMaterialId: input.specifications?.upholsteryMaterialId,
        upholsteryMaterialName: input.specifications?.upholsteryMaterialName,
        tabletopMaterialId: input.specifications?.tabletopMaterialId,
        tabletopMaterialName: input.specifications?.tabletopMaterialName,
        surfaceFinish: input.specifications?.surfaceFinish,
        hardwareSpec: input.specifications?.hardwareSpec,
        rawMaterialNotes: input.specifications?.rawMaterialNotes,
      },
      unit: input.unit,
      quantity: input.quantity,
      reviewStatus: 'pending',
      estimatedUnitCost: input.estimatedUnitCost,
      targetUnitPrice: input.targetUnitPrice,
      sourceDrawingRef: input.sourceDrawingRef,
      source3DVisualRef: input.source3DVisualRef,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const updatedComponents = [...run.components, component];
    const updatedRun = this.recomputeRunCounters(run, updatedComponents, now);

    await this.repository.saveTakeoffRun(tenantId, updatedRun);
    return component;
  }

  /**
   * Updates an existing component within a draft Takeoff Run.
   * Preserves stableComponentId and verifies Room Zone if updated.
   */
  async updateTakeoffComponent(
    tenantId: string,
    runId: string,
    componentId: string,
    updates: UpdateTakeoffComponentInput,
  ): Promise<DesignTakeoffComponent> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const run = await this.repository.getTakeoffRun(tenantId, runId);
    if (!run) throw new TakeoffRunNotFoundError(runId);
    if (run.isImmutable) throw new TakeoffRunImmutableError(run.id, run.status);

    const existingIndex = run.components.findIndex((c) => c.id === componentId);
    if (existingIndex === -1) {
      throw new TakeoffComponentNotFoundError(componentId);
    }

    const existing = run.components[existingIndex];
    let roomZoneId = existing.roomZoneId;
    let roomZoneName = existing.roomZoneName;

    if (updates.roomZoneId && updates.roomZoneId !== existing.roomZoneId) {
      const zones = await this.repository.listRoomZones(tenantId, run.projectId);
      const targetZone = zones.find((z) => z.id === updates.roomZoneId);
      if (!targetZone) {
        throw new InvalidRoomZoneBindingError(updates.roomZoneId, run.projectId);
      }
      roomZoneId = targetZone.id;
      roomZoneName = targetZone.name;
    }

    if (updates.quantity !== undefined && updates.quantity <= 0) {
      throw new Error('Component quantity must be greater than zero');
    }

    const now = new Date().toISOString();
    const updatedComponent: DesignTakeoffComponent = {
      ...existing,
      roomZoneId,
      roomZoneName,
      componentCode: updates.componentCode !== undefined ? updates.componentCode.trim() : existing.componentCode,
      componentName: updates.componentName !== undefined ? updates.componentName.trim() : existing.componentName,
      category: updates.category ?? existing.category,
      dimensions: {
        ...existing.dimensions,
        ...updates.dimensions,
        unit: 'mm',
      },
      specifications: {
        ...existing.specifications,
        ...updates.specifications,
      },
      unit: updates.unit ?? existing.unit,
      quantity: updates.quantity ?? existing.quantity,
      estimatedUnitCost: updates.estimatedUnitCost ?? existing.estimatedUnitCost,
      targetUnitPrice: updates.targetUnitPrice ?? existing.targetUnitPrice,
      sourceDrawingRef: updates.sourceDrawingRef ?? existing.sourceDrawingRef,
      source3DVisualRef: updates.source3DVisualRef ?? existing.source3DVisualRef,
      notes: updates.notes ?? existing.notes,
      updatedAt: now,
      // CRITICAL: stableComponentId is strictly preserved
      stableComponentId: existing.stableComponentId,
    };

    const newComponents = [...run.components];
    newComponents[existingIndex] = updatedComponent;

    const updatedRun = this.recomputeRunCounters(run, newComponents, now);
    await this.repository.saveTakeoffRun(tenantId, updatedRun);

    return updatedComponent;
  }

  /**
   * Deletes a component from a draft Takeoff Run.
   */
  async deleteTakeoffComponent(
    tenantId: string,
    runId: string,
    componentId: string,
  ): Promise<void> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const run = await this.repository.getTakeoffRun(tenantId, runId);
    if (!run) throw new TakeoffRunNotFoundError(runId);
    if (run.isImmutable) throw new TakeoffRunImmutableError(run.id, run.status);

    const filtered = run.components.filter((c) => c.id !== componentId);
    if (filtered.length === run.components.length) {
      throw new TakeoffComponentNotFoundError(componentId);
    }

    const now = new Date().toISOString();
    const updatedRun = this.recomputeRunCounters(run, filtered, now);
    await this.repository.saveTakeoffRun(tenantId, updatedRun);
  }

  /**
   * Estimator Review Workflow: Marks a component as 'verified' or 'review_required'.
   */
  async reviewTakeoffComponent(
    tenantId: string,
    runId: string,
    componentId: string,
    review: ReviewTakeoffComponentInput,
  ): Promise<DesignTakeoffComponent> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const run = await this.repository.getTakeoffRun(tenantId, runId);
    if (!run) throw new TakeoffRunNotFoundError(runId);
    if (run.isImmutable) throw new TakeoffRunImmutableError(run.id, run.status);

    const compIndex = run.components.findIndex((c) => c.id === componentId);
    if (compIndex === -1) {
      throw new TakeoffComponentNotFoundError(componentId);
    }

    const existing = run.components[compIndex];
    const now = new Date().toISOString();

    const reviewedComponent: DesignTakeoffComponent = {
      ...existing,
      reviewStatus: review.status,
      reviewNotes: review.reviewNotes ?? existing.reviewNotes,
      verifiedBy: review.reviewerName.trim(),
      verifiedAt: now,
      updatedAt: now,
    };

    const newComponents = [...run.components];
    newComponents[compIndex] = reviewedComponent;

    const updatedRun = this.recomputeRunCounters(run, newComponents, now);
    await this.repository.saveTakeoffRun(tenantId, updatedRun);

    return reviewedComponent;
  }

  /**
   * Completes a Takeoff Run and locks it as permanently immutable.
   * Throws TakeoffIncompleteReviewError if any component remains in 'pending' status.
   */
  async completeTakeoffRun(
    tenantId: string,
    runId: string,
    completedBy: string,
  ): Promise<DesignTakeoffRun> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const run = await this.repository.getTakeoffRun(tenantId, runId);
    if (!run) throw new TakeoffRunNotFoundError(runId);
    if (run.isImmutable) throw new TakeoffRunImmutableError(run.id, run.status);

    if (run.pendingReviewCount > 0) {
      throw new TakeoffIncompleteReviewError(run.pendingReviewCount);
    }

    const now = new Date().toISOString();
    const completedRun: DesignTakeoffRun = {
      ...run,
      status: 'completed',
      isImmutable: true,
      completedBy: completedBy.trim(),
      completedAt: now,
      updatedAt: now,
    };

    await this.repository.saveTakeoffRun(tenantId, completedRun);
    return completedRun;
  }

  /**
   * Clones an existing Takeoff Run into a new Draft Run for a new/next Design Revision.
   * CRITICAL GUARANTEE: Inherited components retain their EXACT stableComponentId!
   * Enforces Approved Design Lock on the target Design Revision.
   */
  async cloneTakeoffRun(input: CloneTakeoffRunInput): Promise<DesignTakeoffRun> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const sourceRun = await this.repository.getTakeoffRun(input.tenantId, input.sourceRunId);
    if (!sourceRun) throw new TakeoffRunNotFoundError(input.sourceRunId);

    // Verify Approved Design Lock on Target Design Revision
    const targetRevision = await this.repository.getDesignRevision(
      input.tenantId,
      input.targetDesignRevisionId,
    );
    if (!targetRevision) {
      throw new ApprovedDesignLockViolationError(0, 'not_found');
    }
    if (targetRevision.status !== 'approved') {
      throw new ApprovedDesignLockViolationError(
        targetRevision.versionNumber,
        targetRevision.status,
      );
    }

    // Idempotency check
    const existingRuns = await this.repository.listTakeoffRuns(input.tenantId, sourceRun.projectId);
    if (input.idempotencyKey) {
      const match = existingRuns.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (match) return match;
    }

    const newRunId = ensureUuid(randomUUID());
    const runNumber = existingRuns.length + 1;
    const now = new Date().toISOString();

    // Clone components with new record IDs but IDENTICAL stableComponentId!
    const clonedComponents: DesignTakeoffComponent[] = sourceRun.components.map((sourceComp) => ({
      ...sourceComp,
      id: ensureUuid(randomUUID()),
      // CRITICAL INVARIANT: Preserve exact stableComponentId across runs/revisions
      stableComponentId: sourceComp.stableComponentId,
      takeoffRunId: newRunId,
      designRevisionId: input.targetDesignRevisionId,
      reviewStatus: 'pending', // Re-opened for review against new revision
      verifiedBy: undefined,
      verifiedAt: undefined,
      reviewNotes: `Kế thừa từ Run #${sourceRun.runNumber}`,
      createdAt: now,
      updatedAt: now,
    }));

    const newRun: DesignTakeoffRun = {
      id: newRunId,
      tenantId: input.tenantId,
      projectId: sourceRun.projectId,
      designRevisionId: input.targetDesignRevisionId,
      runNumber,
      title: input.newTitle.trim(),
      status: 'draft',
      isImmutable: false,
      preparedBy: input.preparedBy.trim(),
      parentRunId: sourceRun.id,
      idempotencyKey: input.idempotencyKey,
      totalComponentsCount: clonedComponents.length,
      pendingReviewCount: clonedComponents.length,
      verifiedCount: 0,
      reviewRequiredCount: 0,
      components: clonedComponents,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveTakeoffRun(input.tenantId, newRun);
    return newRun;
  }

  /**
   * Retrieves a Takeoff Run by ID.
   */
  async getTakeoffRun(tenantId: string, runId: string): Promise<DesignTakeoffRun | null> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.getTakeoffRun(tenantId, runId);
  }

  /**
   * Lists all Takeoff Runs for a project.
   */
  async listTakeoffRuns(tenantId: string, projectId: string): Promise<DesignTakeoffRun[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listTakeoffRuns(tenantId, projectId);
  }

  // --- Internal Helper Methods ---

  private recomputeRunCounters(
    run: DesignTakeoffRun,
    components: readonly DesignTakeoffComponent[],
    now: string,
  ): DesignTakeoffRun {
    let pendingCount = 0;
    let verifiedCount = 0;
    let reviewRequiredCount = 0;

    for (const comp of components) {
      if (comp.reviewStatus === 'verified') verifiedCount++;
      else if (comp.reviewStatus === 'review_required') reviewRequiredCount++;
      else pendingCount++;
    }

    return {
      ...run,
      totalComponentsCount: components.length,
      pendingReviewCount: pendingCount,
      verifiedCount,
      reviewRequiredCount,
      components,
      updatedAt: now,
    };
  }
}

