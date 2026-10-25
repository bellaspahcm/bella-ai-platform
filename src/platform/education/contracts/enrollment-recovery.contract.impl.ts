import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationEnrollmentDTO } from './enrollment.contract';
import {
  EducationEnrollmentRecoveryConflictError,
  type IEducationEnrollmentRecoveryContract,
  type RecoverEducationEnrollmentInput,
} from './enrollment-recovery.contract';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';

export class EnrollmentRecoveryContractImpl implements IEducationEnrollmentRecoveryContract {
  private readonly repository: SupabaseEducationRepository;

  /** The caller supplies an authorized server client; no privileged fallback. */
  constructor(supabase: SupabaseClient<Database>) {
    if (!supabase) throw new Error('Enrollment recovery requires an explicit authorized client');
    this.repository = new SupabaseEducationRepository(supabase);
  }

  public async getEnrollmentByRequest(
    input: RecoverEducationEnrollmentInput
  ): Promise<EducationEnrollmentDTO | null> {
    if (!input || [input.tenantId, input.requestId, input.studentPartyId, input.courseId].some(
      value => typeof value !== 'string' || !value.trim()
    )) {
      throw new Error('Enrollment recovery requires tenantId, requestId, studentPartyId and courseId');
    }

    // PostgreSQL uuid columns return canonical lowercase identifiers even when
    // their input used uppercase. The request key is text and remains opaque.
    const tenantId = input.tenantId.toLowerCase();
    const studentPartyId = input.studentPartyId.toLowerCase();
    const courseId = input.courseId.toLowerCase();
    const enrollment = await this.repository.findEnrollmentByRequestId(input.requestId, tenantId);
    if (!enrollment) return null;

    if (enrollment.tenantId !== tenantId || enrollment.requestId !== input.requestId) {
      throw new Error('Invalid enrollment recovery result');
    }
    if (enrollment.studentPartyId !== studentPartyId || enrollment.courseId !== courseId) {
      throw new EducationEnrollmentRecoveryConflictError();
    }

    return {
      id: enrollment.id,
      tenantId: enrollment.tenantId,
      studentPartyId: enrollment.studentPartyId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}
