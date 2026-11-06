/**
 * Service 1: Design & Specification Service
 *
 * Implements project creation, room/zone hierarchies, design revisions, and
 * the Approved Design Lock invariant.
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID } from 'crypto';
import {
  TenantIsolationViolationError,
  InvalidDesignRevisionStatusError,
} from '../domain/errors';
import type {
  InteriorProject,
  ProjectRoomZone,
  DesignRevision,
  DesignAsset,
  DesignMaterialSpec,
  InteriorProjectType,
} from '../domain/design-specification/types';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';

export class DesignSpecificationService {
  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {}

  async createProject(input: {
    readonly tenantId: string;
    readonly code: string;
    readonly name: string;
    readonly customerId: string;
    readonly customerName: string;
    readonly customerPhone: string;
    readonly siteAddress: string;
    readonly projectType: InteriorProjectType;
    readonly estimatedBudget: number;
    readonly targetCompletionDate: string;
    readonly leadArchitectId: string;
    readonly leadArchitectName: string;
  }): Promise<InteriorProject> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const now = new Date().toISOString();
    const project: InteriorProject = {
      id: randomUUID(),
      tenantId: input.tenantId,
      code: input.code,
      name: input.name,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      siteAddress: input.siteAddress,
      projectType: input.projectType,
      status: 'survey',
      estimatedBudget: input.estimatedBudget,
      targetCompletionDate: input.targetCompletionDate,
      leadArchitectId: input.leadArchitectId,
      leadArchitectName: input.leadArchitectName,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveProject(input.tenantId, project);
    return project;
  }

  async createRoomZone(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly code: string;
    readonly name: string;
    readonly floor: number;
    readonly areaSquareMeters?: number;
    readonly description?: string;
  }): Promise<ProjectRoomZone> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const roomZone: ProjectRoomZone = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      code: input.code,
      name: input.name,
      floor: input.floor,
      areaSquareMeters: input.areaSquareMeters,
      description: input.description,
    };

    await this.repository.saveRoomZone(input.tenantId, roomZone);
    return roomZone;
  }

  async createDesignRevision(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly title: string;
    readonly changeSummary?: string;
    readonly submittedBy: string;
    readonly assets?: Omit<DesignAsset, 'id' | 'tenantId' | 'revisionId'>[];
    readonly materialSpecs?: Omit<DesignMaterialSpec, 'id' | 'tenantId' | 'revisionId'>[];
  }): Promise<DesignRevision> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const existingRevisions = await this.repository.listDesignRevisions(input.tenantId, input.projectId);
    const versionNumber = existingRevisions.length + 1;
    const revisionId = randomUUID();
    const now = new Date().toISOString();

    const assets: DesignAsset[] = (input.assets || []).map((a) => ({
      ...a,
      id: randomUUID(),
      tenantId: input.tenantId,
      revisionId,
    }));

    const materialSpecs: DesignMaterialSpec[] = (input.materialSpecs || []).map((m) => ({
      ...m,
      id: randomUUID(),
      tenantId: input.tenantId,
      revisionId,
    }));

    const revision: DesignRevision = {
      id: revisionId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      versionNumber,
      title: input.title,
      status: 'client_review',
      changeSummary: input.changeSummary,
      submittedBy: input.submittedBy,
      submittedAt: now,
      assets,
      materialSpecs,
    };

    await this.repository.saveDesignRevision(input.tenantId, revision);
    return revision;
  }

  async approveDesignRevision(input: {
    readonly tenantId: string;
    readonly revisionId: string;
    readonly approvedBy: string;
    readonly clientSignoffName: string;
  }): Promise<DesignRevision> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const revision = await this.repository.getDesignRevision(input.tenantId, input.revisionId);
    if (!revision) {
      throw new Error(`Design revision ${input.revisionId} not found`);
    }

    if (revision.status === 'approved') {
      return revision; // Already approved (idempotent)
    }

    if (revision.status !== 'client_review' && revision.status !== 'in_review') {
      throw new InvalidDesignRevisionStatusError(revision.status, 'approved');
    }

    const now = new Date().toISOString();
    const approvedRevision: DesignRevision = {
      ...revision,
      status: 'approved',
      approvedBy: input.approvedBy,
      approvedAt: now,
      clientSignoffName: input.clientSignoffName,
      clientSignoffDate: now,
    };

    await this.repository.saveDesignRevision(input.tenantId, approvedRevision);

    // Update Project with activeApprovedRevisionId
    const project = await this.repository.getProject(input.tenantId, revision.projectId);
    if (project) {
      const updatedProject: InteriorProject = {
        ...project,
        activeApprovedRevisionId: approvedRevision.id,
        status: 'technical_design',
        updatedAt: now,
      };
      await this.repository.saveProject(input.tenantId, updatedProject);
    }

    // Publish Domain Event (Event-After-Persistence)
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'design_revision',
        aggregateId: approvedRevision.id,
        eventType: 'interior.design.revision_approved.v1',
        occurredAt: now,
        actorId: input.approvedBy,
        actorName: input.clientSignoffName,
        payload: {
          projectId: revision.projectId,
          revisionId: approvedRevision.id,
          versionNumber: approvedRevision.versionNumber,
          approvedBy: input.approvedBy,
        },
      });
    }

    return approvedRevision;
  }
}
