/**
 * Education OS — Supabase Education Repository Implementation
 * 
 * Extends BaseSupabaseRepositoryPrimitive from Common Core (src/platform/core/repository).
 * Preserves strict 1-way dependency rules with zero duplicated infrastructure.
 * 
 * @module platform/education/repositories/supabase-education.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { BaseSupabaseRepositoryPrimitive } from '../../core/repository';
import { Course, CourseStatus } from '../domain/course.entity';
import { Enrollment, EnrollmentStatus } from '../domain/enrollment.entity';
import { IEducationRepository } from './education-repository.interface';

/**
 * RPC Contract: edu_enroll_student_v3
 * 
 * Source: supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql
 * All 4 return branches return identical structure via json_build_object.
 * 
 * Structure proven consistent across:
 * - Branch 1: Pre-lock duplicate check (line 61)
 * - Branch 2: Post-lock duplicate recheck (line 78)
 * - Branch 3: INSERT conflict occurred (line 98)
 * - Branch 4: Successful new enrollment (line 109)
 */
interface EduEnrollStudentV3Result {
  success: boolean;
  enrollment_id: string;
  is_duplicate: boolean;
}

export class SupabaseEducationRepository extends BaseSupabaseRepositoryPrimitive implements IEducationRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {
    super();
  }

  public async saveCourse(course: Course): Promise<void> {
    const payload = {
      id: course.id,
      tenant_id: course.tenantId,
      course_code: course.courseCode,
      title: course.title,
      status: course.status,
      max_students: course.maxStudents,
      current_enrollment: course.currentEnrollment,
      prerequisite_course_codes: course.prerequisiteCourseCodes,
      created_at: course.createdAt.toISOString(),
      updated_at: course.updatedAt.toISOString(),
    };

    const { error } = await this.supabase
      .from('edu_courses')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw this.mapDatabaseError(error, `Failed to save course ${course.id}`);
    }
  }

  public async findCourseById(id: string, tenantId: string): Promise<Course | null> {
    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to find course ${id}`);
    }

    if (!data) return null;

    return Course.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      courseCode: data.course_code,
      title: data.title,
      status: data.status as CourseStatus,
      maxStudents: data.max_students,
      currentEnrollment: data.current_enrollment ?? 0,
      prerequisiteCourseCodes: data.prerequisite_course_codes ?? undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async saveEnrollment(enrollment: Enrollment): Promise<void> {
    const payload = {
      id: enrollment.id,
      tenant_id: enrollment.tenantId,
      student_party_id: enrollment.studentPartyId,
      course_id: enrollment.courseId,
      status: enrollment.status,
      request_id: enrollment.requestId,
      enrolled_at: enrollment.enrolledAt.toISOString(),
      created_at: enrollment.createdAt.toISOString(),
      updated_at: enrollment.updatedAt.toISOString(),
    };

    const { error } = await this.supabase
      .from('edu_enrollments')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw this.mapDatabaseError(error, `Failed to save enrollment ${enrollment.id}`);
    }
  }

  public async findEnrollmentById(id: string, tenantId: string): Promise<Enrollment | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to find enrollment ${id}`);
    }

    if (!data) return null;

    return Enrollment.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      studentPartyId: data.student_party_id,
      courseId: data.course_id,
      status: data.status as EnrollmentStatus,
      requestId: data.request_id,
      enrolledAt: new Date(data.enrolled_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async findEnrollmentByRequestId(requestId: string, tenantId: string): Promise<Enrollment | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Failed to recover enrollment by request');
    }
    if (!data) return null;

    const status = data.status;
    if (status !== 'pending' && status !== 'active' && status !== 'completed' && status !== 'cancelled') {
      throw new Error('Invalid enrollment recovery status');
    }

    return Enrollment.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      studentPartyId: data.student_party_id,
      courseId: data.course_id,
      status,
      requestId: data.request_id,
      enrolledAt: new Date(data.enrolled_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async findEnrollmentByStudentAndCourse(
    studentPartyId: string,
    courseId: string,
    tenantId: string
  ): Promise<Enrollment | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('*')
      .eq('student_party_id', studentPartyId)
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Failed to find enrollment by student and course');
    }

    if (!data) return null;

    return Enrollment.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      studentPartyId: data.student_party_id,
      courseId: data.course_id,
      status: data.status as EnrollmentStatus,
      requestId: data.request_id,
      enrolledAt: new Date(data.enrolled_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async verifyStudentRole(
    studentPartyId: string,
    tenantId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    const { data: party, error } = await this.supabase
      .from('party_parties')
      .select('id, party_type, tenant_id')
      .eq('id', studentPartyId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to query student party ${studentPartyId}`);
    }

    if (!party) {
      return { isValid: false, reason: `Party ${studentPartyId} not found` };
    }

    if (party.tenant_id !== tenantId) {
      return { isValid: false, reason: `Party belongs to tenant ${party.tenant_id}, expected ${tenantId}` };
    }

    if (party.party_type !== 'person') {
      return { isValid: false, reason: `Party type must be 'person', received '${party.party_type}'` };
    }

    return { isValid: true };
  }

  public async findCourseByCode(courseCode: string, tenantId: string): Promise<Course | null> {
    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('*')
      .eq('course_code', courseCode.trim().toUpperCase())
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to find course by code ${courseCode}`);
    }

    if (!data) return null;

    return Course.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      courseCode: data.course_code,
      title: data.title,
      status: data.status as CourseStatus,
      maxStudents: data.max_students,
      currentEnrollment: data.current_enrollment ?? 0,
      prerequisiteCourseCodes: data.prerequisite_course_codes ?? undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async getStudentScores(studentPartyId: string, tenantId: string): Promise<Array<{ courseId: string; score: number }>> {
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .select('student_id')
      .eq('party_id', studentPartyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (studentError || !student) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('score, status, assessments!inner(course_id)')
      .eq('student_id', student.student_id)
      .eq('tenant_id', tenantId);

    if (error || !data) {
      return [];
    }

    // Keep only graded assessments with non-null scores
    interface AssessmentRow {
      status: string;
      score: number | null;
      assessments: { course_id: string };
    }
    
    return data
      .filter((r: AssessmentRow) => r.status === 'graded' && r.score !== null)
      .map((r: AssessmentRow) => ({
        courseId: r.assessments.course_id,
        score: Number(r.score),
      }));
  }

  public async getActiveEnrollmentsCount(studentPartyId: string, tenantId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('edu_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('student_party_id', studentPartyId)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'pending']);

    if (error) {
      throw this.mapDatabaseError(error, `Failed to count active enrollments for student ${studentPartyId}`);
    }

    return count || 0;
  }

  public async executeEnrollStudentTransaction(params: {
    tenantId: string;
    studentPartyId: string;
    courseId: string;
    enrollmentId: string;
    requestId: string;
  }): Promise<{ isDuplicate: boolean; enrollmentId: string }> {
    const { data, error } = await this.supabase.rpc('edu_enroll_student_v3', {
      p_tenant_id: params.tenantId,
      p_student_party_id: params.studentPartyId,
      p_course_id: params.courseId,
      p_enrollment_id: params.enrollmentId,
      p_enrolled_at: new Date().toISOString(),
      p_request_id: params.requestId,
    });

    if (error) {
      throw this.mapDatabaseError(error, `RPC edu_enroll_student_v3 failed: ${error.message}`);
    }

    // Handle unexpected null (should not occur based on SQL contract, but RPC signature allows it)
    if (!data) {
      throw new Error('RPC edu_enroll_student_v3 returned null unexpectedly');
    }

    // Type assertion: structure proven consistent across all 4 SQL return branches
    // See: supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql
    // Runtime check narrows Json union, then assert to specific structure
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('RPC edu_enroll_student_v3 returned unexpected type');
    }

    const result = data as unknown as EduEnrollStudentV3Result;

    return {
      isDuplicate: result.is_duplicate,
      enrollmentId: result.enrollment_id,
    };
  }
}
