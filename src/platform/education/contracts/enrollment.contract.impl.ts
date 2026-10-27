import { IEducationEnrollmentContract, EnrollStudentInput, EducationEnrollmentDTO } from './enrollment.contract';
import { EducationPreschoolEnrollmentError } from './enrollment.contract';
import type { IEducationPreschoolEnrollmentContract, EnrollPreschoolStudentInput } from './enrollment.contract';
import crypto from 'crypto';
import { EducationEngineService, OverrideRequest } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';
import { createClient } from '@/lib/supabase-server';
import { eventBus } from '@/platform/host/event-bus';
import { EventBusPort, DomainEventEnvelope } from '@/platform/core/events/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type EducationEnrollmentClient = SupabaseClient<Database>;

/**
 * Adapter: EventBusService → EventBusPort
 * Maps Platform Host EventBusService to Core EventBusPort abstraction
 */
class EventBusServiceAdapter implements EventBusPort {
  async publish<T = unknown>(event: DomainEventEnvelope<T>): Promise<void> {
    await eventBus.publish({
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      tenantId: event.tenantId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      userId: event.userId,
      correlationId: event.correlationId,
      causationId: event.causationId,
    });
  }

  subscribe<T = unknown>(eventType: string, handler: (event: DomainEventEnvelope<T>) => Promise<void> | void): () => void {
    return eventBus.subscribe(eventType, handler);
  }

  clear(): void {
    // EventBusService doesn't expose clear, no-op for now
  }
}

export class EnrollmentContractImpl implements IEducationEnrollmentContract, IEducationPreschoolEnrollmentContract {
  constructor(private readonly supabase?: EducationEnrollmentClient) {}

  public async enrollPreschoolStudent(input: EnrollPreschoolStudentInput): Promise<EducationEnrollmentDTO> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (![input.tenantId, input.courseId, input.studentPartyId, input.guardianPartyId, input.requestId]
      .every(value => typeof value === 'string' && uuid.test(value))) {
      throw new EducationPreschoolEnrollmentError('INVALID_REQUEST');
    }
    input = { tenantId: input.tenantId.toLowerCase(), courseId: input.courseId.toLowerCase(),
      studentPartyId: input.studentPartyId.toLowerCase(), guardianPartyId: input.guardianPartyId.toLowerCase(), requestId: input.requestId.toLowerCase() };
    const client = this.supabase;
    if (!client) throw new EducationPreschoolEnrollmentError('UNAVAILABLE');
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) throw new EducationPreschoolEnrollmentError('DENIED');
    // A caller-selected tenant never reaches the privileged RPC. Verify the public
    // contract selector against the persisted caller profile before any write.
    const profile = await client.from('users').select('id, tenant_id, role, status').eq('id', auth.data.user.id).maybeSingle();
    if (profile.error) throw new EducationPreschoolEnrollmentError('UNAVAILABLE');
    if (profile.data?.id !== auth.data.user.id || profile.data.tenant_id !== input.tenantId
      || profile.data.role !== 'admin' || profile.data.status !== 'active') throw new EducationPreschoolEnrollmentError('DENIED');
    const { data, error } = await client.rpc('edu_preschool_enroll_student', {
      p_course_id: input.courseId, p_student_party_id: input.studentPartyId,
      p_guardian_party_id: input.guardianPartyId, p_request_id: input.requestId,
    });
    if (error) {
      if (error.code === '42501' && error.message === 'ENROLLMENT_STUDENT_ACCESS_DENIED') {
        throw new EducationPreschoolEnrollmentError('STUDENT_DENIED');
      }
      if (error.code === '42501' && error.message === 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED') {
        throw new EducationPreschoolEnrollmentError('GUARDIAN_REQUIRED');
      }
      const code = error.code === '42501' ? 'DENIED' : error.code === '23505' ? 'CONFLICT'
        : error.code === '22023' ? 'INVALID_REQUEST' : 'UNAVAILABLE';
      throw new EducationPreschoolEnrollmentError(code);
    }
    const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!record(data) || typeof data.isDuplicate !== 'boolean' || !record(data.enrollment)) throw new EducationPreschoolEnrollmentError('UNAVAILABLE');
    const row = data.enrollment;
    if (typeof row.id !== 'string' || !uuid.test(row.id) || row.tenantId !== input.tenantId
      || row.studentPartyId !== input.studentPartyId || row.courseId !== input.courseId || row.status !== 'active'
      || typeof row.enrolledAt !== 'string' || !Number.isFinite(Date.parse(row.enrolledAt))) throw new EducationPreschoolEnrollmentError('UNAVAILABLE');
    const enrollment: EducationEnrollmentDTO = { id: row.id, tenantId: input.tenantId, studentPartyId: input.studentPartyId,
      courseId: input.courseId, status: 'active', enrolledAt: row.enrolledAt };
    // PostgREST has committed the RPC before returning this validated result.
    // A valid retry never publishes a second success event.
    if (!data.isDuplicate) {
      await new EventBusServiceAdapter().publish({
        eventId: crypto.randomUUID(), eventType: 'edu.enrollment.created.v1', eventVersion: 'v1',
        tenantId: enrollment.tenantId, aggregateId: enrollment.id, aggregateType: 'enrollment',
        occurredAt: enrollment.enrolledAt, userId: auth.data.user.id,
        payload: { enrollmentId: enrollment.id, studentPartyId: enrollment.studentPartyId, courseId: enrollment.courseId, status: enrollment.status },
      });
    }
    return enrollment;
  }

  public async enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO> {
    const supabase = this.supabase ?? createClient();
    const repository = new SupabaseEducationRepository(supabase);
    const eventBusAdapter = new EventBusServiceAdapter();
    const service = new EducationEngineService(repository, eventBusAdapter);

    let overrideRequest: OverrideRequest | undefined = (input as EnrollStudentInput & {overrideRequest?: unknown}).overrideRequest as OverrideRequest | undefined;
    if (!overrideRequest && input.overrideJustification) {
      try {
        overrideRequest = JSON.parse(input.overrideJustification);
      } catch {
        // Ignore parsing errors
      }
    }

    const result = await service.enrollStudent({
      tenantId: input.tenantId,
      studentPartyId: input.studentPartyId,
      courseId: input.courseId,
      requestId: input.requestId,
      overrideRequest,
    });

    if (!result.success || !result.enrollment) {
      throw new Error(result.error || 'Enrollment failed');
    }

    return {
      id: result.enrollment.id,
      tenantId: result.enrollment.tenantId,
      studentPartyId: result.enrollment.studentPartyId,
      courseId: result.enrollment.courseId,
      status: result.enrollment.status as 'pending' | 'active' | 'completed' | 'cancelled',
      enrolledAt: result.enrollment.enrolledAt,
    };
  }

  public async getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null> {
    const supabase = this.supabase ?? createClient();
    const repository = new SupabaseEducationRepository(supabase);
    const enrollment = await repository.findEnrollmentById(enrollmentId, tenantId);
    if (!enrollment) {
      return null;
    }

    return {
      id: enrollment.id,
      tenantId: enrollment.tenantId,
      studentPartyId: enrollment.studentPartyId,
      courseId: enrollment.courseId,
      status: enrollment.status as 'pending' | 'active' | 'completed' | 'cancelled',
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}
