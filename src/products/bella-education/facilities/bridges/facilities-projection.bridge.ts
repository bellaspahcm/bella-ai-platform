/**
 * Bella Preschool OS — Facilities Cross-Domain Projection Bridge
 * File: src/products/bella-education/facilities/bridges/facilities-projection.bridge.ts
 *
 * Projects P9 Facilities Safety Hazards & Overdue Inspections to the Reusable Exception Work Queue Candidate (#3 Reuse).
 *
 * SUPREME INVARIANT:
 * Exception Work Queue resolution DOES NOT alter facility or asset operational status!
 * Work Queue RESOLVED ≠ Asset OPERATIONAL.
 */

import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import type { CommunicationException } from '@/products/bella-education/parent-engagement/domain/communication.types';

export class FacilitiesProjectionBridge {
  constructor(
    _commRepo: ParentCommunicationRepository,
    private readonly exceptionService: CommunicationExceptionService
  ) {}

  /**
   * Projects a SAFETY_DEFECT exception into the Staff Exception Work Queue when an asset or zone fails a safety inspection.
   */
  async projectSafetyDefectException(params: {
    tenantId: string;
    zoneId: string;
    assetId?: string;
    remarks: string;
  }): Promise<CommunicationException> {
    const existing = await this.exceptionService.getStaffWorkQueueExceptions(params.tenantId);
    const activeDefect = existing.find(
      e => e.exception_type === 'SAFETY_DEFECT' && e.student_id === (params.assetId || params.zoneId) && e.status === 'OPEN'
    );

    if (activeDefect) {
      return activeDefect;
    }

    return this.exceptionService.createException({
      tenantId: params.tenantId,
      noticeId: null,
      studentId: params.assetId || params.zoneId,
      guardianPartyId: null,
      exceptionType: 'SAFETY_DEFECT',
      assignedRole: 'FACILITY_MANAGER',
    });
  }

  /**
   * Projects an OVERDUE_INSPECTION exception into the Staff Exception Work Queue for overdue inspection schedules.
   */
  async projectOverdueInspectionException(params: {
    tenantId: string;
    scheduleId: string;
    zoneId: string;
    title: string;
  }): Promise<CommunicationException> {
    const existing = await this.exceptionService.getStaffWorkQueueExceptions(params.tenantId);
    const activeOverdue = existing.find(
      e => e.exception_type === 'OVERDUE_INSPECTION' && e.student_id === params.scheduleId && e.status === 'OPEN'
    );

    if (activeOverdue) {
      return activeOverdue;
    }

    return this.exceptionService.createException({
      tenantId: params.tenantId,
      noticeId: null,
      studentId: params.scheduleId,
      guardianPartyId: null,
      exceptionType: 'OVERDUE_INSPECTION',
      assignedRole: 'SAFETY_OFFICER',
    });
  }
}
