// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT COMMUNICATION EXCEPTION SERVICE
// File: src/products/bella-education/parent-engagement/services/communication-exception.service.ts
// ============================================================================

import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { CommunicationException, ExceptionStatus } from '../domain/communication.types';

export interface ICreateCommunicationExceptionDto {
  tenantId: string;
  noticeId?: string | null;
  studentId: string;
  guardianPartyId?: string | null;
  exceptionType: CommunicationException['exception_type'];
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedRole?: CommunicationException['assigned_role'];
}

export interface IResolveExceptionDto {
  tenantId: string;
  exceptionId: string;
  resolvedBy: string;
  resolutionNotes: string;
}

export class CommunicationExceptionService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  async createException(dto: ICreateCommunicationExceptionDto): Promise<CommunicationException> {
    return await this.repository.createException({
      tenant_id: dto.tenantId,
      notice_id: dto.noticeId ?? null,
      student_id: dto.studentId,
      guardian_party_id: dto.guardianPartyId ?? null,
      exception_type: dto.exceptionType,
      severity: dto.severity ?? 'MEDIUM',
      assigned_role: dto.assignedRole ?? 'TEACHER',
      status: 'OPEN',
    });
  }

  async resolveException(dto: IResolveExceptionDto): Promise<CommunicationException> {
    const nowIso = new Date().toISOString();
    return await this.repository.updateException(dto.tenantId, dto.exceptionId, {
      status: 'RESOLVED',
      resolved_by: dto.resolvedBy,
      resolved_at: nowIso,
      resolution_notes: dto.resolutionNotes,
    });
  }

  async getStaffWorkQueueExceptions(tenantId: string, status?: ExceptionStatus): Promise<CommunicationException[]> {
    return await this.repository.getExceptionsByTenant(tenantId, status);
  }
}
