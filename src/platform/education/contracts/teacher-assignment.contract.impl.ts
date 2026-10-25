/**
 * Education OS — Teacher Assignment Public Contract Implementation
 * 
 * Enforces canonical persistence on teacher_assignments table.
 * Strictly prevents lead teacher conflicts (max 1 active lead teacher per classroom/year,
 * and 1 lead teacher per classroom per academic year).
 * Zero usage of courses.metadata shadow model.
 * 
 * @module platform/education/contracts/teacher-assignment.contract.impl
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import {
  ITeacherAssignmentContract,
  AssignTeacherInput,
  TerminateTeacherAssignmentInput,
  TeacherAssignmentDTO,
} from './teacher-assignment.contract';
import { TeacherClassroomAssignment, TeacherRole, TeacherAssignmentStatus } from '../domain/teacher-assignment.entity';

interface DBTeacherAssignmentRow {
  assignment_id: string;
  tenant_id: string;
  course_id: string;
  teacher_party_id: string;
  role: string;
  academic_year: string;
  effective_start_date: string;
  effective_end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export class TeacherAssignmentContractImpl implements ITeacherAssignmentContract {
  private clientPromise?: Promise<SupabaseClient>;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.clientPromise = Promise.resolve(supabaseClient);
    }
  }

  private async getClient(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = Promise.resolve(createClient());
    }
    return this.clientPromise;
  }

  public async assignTeacher(input: AssignTeacherInput): Promise<TeacherAssignmentDTO> {
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.courseId) throw new Error('courseId is required');
    if (!input.teacherPartyId) throw new Error('teacherPartyId is required');
    if (!input.role) throw new Error('role is required');
    if (!input.academicYear) throw new Error('academicYear is required');

    const supabase = await this.getClient();

    if (input.role === 'lead_teacher') {
      // 1a. Classroom Lead Teacher Check: Max 1 active lead teacher per course & academic year
      const { data: existingClassLead, error: classLeadErr } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('course_id', input.courseId)
        .eq('academic_year', input.academicYear.trim())
        .eq('role', 'lead_teacher')
        .eq('status', 'active')
        .maybeSingle();

      if (classLeadErr) {
        throw new Error(`Failed to check existing classroom lead teacher: ${classLeadErr.message}`);
      }

      if (existingClassLead) {
        if (existingClassLead.teacher_party_id === input.teacherPartyId) {
          return this.mapRowToDTO(existingClassLead as DBTeacherAssignmentRow);
        }
        throw new Error('TEACHER_ASSIGNMENT_CONFLICT: Classroom already has an active lead teacher for this academic year');
      }

      // 1b. Teacher Workload Check: A teacher cannot be Lead Teacher of multiple active classrooms in the same academic year
      const { data: existingTeacherLead, error: teacherLeadErr } = await supabase
        .from('teacher_assignments')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('teacher_party_id', input.teacherPartyId)
        .eq('academic_year', input.academicYear.trim())
        .eq('role', 'lead_teacher')
        .eq('status', 'active')
        .maybeSingle();

      if (teacherLeadErr) {
        throw new Error(`Failed to check teacher active lead workload: ${teacherLeadErr.message}`);
      }

      if (existingTeacherLead) {
        if (existingTeacherLead.course_id === input.courseId) {
          return this.mapRowToDTO(existingTeacherLead as DBTeacherAssignmentRow);
        }
        throw new Error('TEACHER_ASSIGNMENT_CONFLICT: Teacher is already assigned as Lead Teacher to another active classroom for this academic year');
      }
    }

    // 2. Duplicate Check: Same teacher, role, course, academic year
    const { data: existingSameRole, error: dupCheckErr } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('course_id', input.courseId)
      .eq('teacher_party_id', input.teacherPartyId)
      .eq('academic_year', input.academicYear.trim())
      .eq('role', input.role)
      .eq('status', 'active')
      .maybeSingle();

    if (dupCheckErr) {
      throw new Error(`Failed to check duplicate teacher assignment: ${dupCheckErr.message}`);
    }

    if (existingSameRole) {
      return this.mapRowToDTO(existingSameRole as DBTeacherAssignmentRow);
    }

    // 3. Construct Aggregate
    const startDate = input.effectiveStartDate ? new Date(input.effectiveStartDate) : new Date();
    const assignment = TeacherClassroomAssignment.create({
      tenantId: input.tenantId,
      courseId: input.courseId,
      teacherPartyId: input.teacherPartyId,
      role: input.role,
      academicYear: input.academicYear,
      effectiveStartDate: startDate,
    });

    // 4. Canonical Persistence in teacher_assignments table
    const payload = {
      assignment_id: assignment.id,
      tenant_id: assignment.tenantId,
      course_id: assignment.courseId,
      teacher_party_id: assignment.teacherPartyId,
      role: assignment.role,
      academic_year: assignment.academicYear,
      effective_start_date: assignment.effectiveStartDate.toISOString().split('T')[0],
      effective_end_date: assignment.effectiveEndDate ? assignment.effectiveEndDate.toISOString().split('T')[0] : null,
      status: assignment.status,
      created_at: assignment.createdAt.toISOString(),
      updated_at: assignment.updatedAt.toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('teacher_assignments')
      .insert(payload)
      .select('*')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        throw new Error('TEACHER_ASSIGNMENT_CONFLICT: Classroom already has an active lead teacher for this academic year');
      }
      throw new Error(`Failed to save teacher assignment: ${insertErr.message}`);
    }

    return this.mapRowToDTO(inserted as DBTeacherAssignmentRow);
  }

  public async terminateAssignment(input: TerminateTeacherAssignmentInput): Promise<TeacherAssignmentDTO> {
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.assignmentId) throw new Error('assignmentId is required');

    const supabase = await this.getClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('assignment_id', input.assignmentId)
      .eq('tenant_id', input.tenantId)
      .not('course_id', 'is', null)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error(`Teacher assignment ${input.assignmentId} not found`);
    }

    const row = existing as DBTeacherAssignmentRow;
    const assignment = TeacherClassroomAssignment.reconstitute({
      id: row.assignment_id,
      tenantId: row.tenant_id,
      courseId: row.course_id,
      teacherPartyId: row.teacher_party_id,
      role: row.role as TeacherRole,
      academicYear: row.academic_year,
      effectiveStartDate: new Date(row.effective_start_date),
      effectiveEndDate: row.effective_end_date ? new Date(row.effective_end_date) : null,
      status: row.status as TeacherAssignmentStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });

    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    assignment.terminate(endDate);

    const { data: updated, error: updateErr } = await supabase
      .from('teacher_assignments')
      .update({
        status: assignment.status,
        effective_end_date: assignment.effectiveEndDate ? assignment.effectiveEndDate.toISOString().split('T')[0] : null,
        updated_at: assignment.updatedAt.toISOString(),
      })
      .eq('assignment_id', assignment.id)
      .eq('tenant_id', assignment.tenantId)
      .not('course_id', 'is', null)
      .select('*')
      .single();

    if (updateErr) {
      throw new Error(`Failed to terminate teacher assignment: ${updateErr.message}`);
    }

    return this.mapRowToDTO(updated as DBTeacherAssignmentRow);
  }

  public async getCourseTeachers(tenantId: string, courseId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]> {
    const supabase = await this.getClient();
    let query = supabase
      .from('teacher_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .eq('status', 'active');

    if (academicYear) {
      query = query.eq('academic_year', academicYear.trim());
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((r: unknown) => this.mapRowToDTO(r as DBTeacherAssignmentRow));
  }

  public async getTeacherAssignments(tenantId: string, teacherPartyId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]> {
    const supabase = await this.getClient();
    let query = supabase
      .from('teacher_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('teacher_party_id', teacherPartyId)
      .not('course_id', 'is', null)
      .eq('status', 'active');

    if (academicYear) {
      query = query.eq('academic_year', academicYear.trim());
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((r: unknown) => this.mapRowToDTO(r as DBTeacherAssignmentRow));
  }

  private mapRowToDTO(row: DBTeacherAssignmentRow): TeacherAssignmentDTO {
    return {
      assignmentId: row.assignment_id,
      tenantId: row.tenant_id,
      courseId: row.course_id,
      teacherPartyId: row.teacher_party_id,
      role: row.role as TeacherRole,
      academicYear: row.academic_year,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
      status: row.status as TeacherAssignmentStatus,
    };
  }
}
