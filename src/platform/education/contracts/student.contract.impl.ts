import { IEducationStudentContract, RegisterStudentInput, EducationStudentDTO } from './student.contract';
import { StudentService } from '../student/student.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createClient } from '@/lib/supabase-server';
import { EducationCandidateReadError } from './student.contract';
import type { SearchEnrollmentCandidatesInput, EnrollmentStudentCandidatePage, EnrollmentStudentCandidateDTO } from './student.contract';

type EducationStudentClient = SupabaseClient<Database>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = (): never => { throw new EducationCandidateReadError('UNAVAILABLE'); };
export class StudentContractImpl implements IEducationStudentContract {
  constructor(private readonly supabase?: EducationStudentClient) {}

  public async searchEnrollmentCandidates(input: SearchEnrollmentCandidatesInput): Promise<EnrollmentStudentCandidatePage> {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    const limit = input.limit ?? 20;
    if (!UUID.test(input.courseId) || query.length < 2 || query.length > 80 || /[\u0000-\u001f\u007f*]/.test(query)
      || !Number.isInteger(limit) || limit < 1 || limit > 20 || (input.cursor !== undefined && !UUID.test(input.cursor))) {
      throw new EducationCandidateReadError('INVALID_REQUEST');
    }
    input = { ...input, courseId: input.courseId.toLowerCase(), cursor: input.cursor?.toLowerCase() };
    // This capability has no global/default client or privileged fallback.
    const client = this.supabase;
    if (!client) return unavailable();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return unavailable();
    const profile = await client.from('users').select('id, tenant_id, role, status')
      .eq('id', auth.data.user.id).maybeSingle();
    if (profile.error || !profile.data || profile.data.id !== auth.data.user.id || !profile.data.tenant_id
      || profile.data.role !== 'admin' || profile.data.status !== 'active') return unavailable();
    const tenantId = profile.data.tenant_id;
    const { data, error } = await client.rpc('edu_preschool_enrollment_candidates', {
      p_course_id: input.courseId, p_query: query, p_limit: limit, p_cursor: input.cursor ?? undefined,
    });
    const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (error || !record(data) || data.tenantId !== tenantId || data.courseId !== input.courseId
      || !Array.isArray(data.candidates) || data.candidates.length > limit
      || (data.nextCursor !== null && (typeof data.nextCursor !== 'string' || !UUID.test(data.nextCursor)
        || (input.cursor !== undefined && data.nextCursor <= input.cursor)))) return unavailable();
    const candidates: EnrollmentStudentCandidateDTO[] = [];
    for (const row of data.candidates) {
      if (!record(row) || typeof row.studentPartyId !== 'string' || !UUID.test(row.studentPartyId)
        || (input.cursor !== undefined && row.studentPartyId <= input.cursor)
        || (typeof data.nextCursor === 'string' && row.studentPartyId > data.nextCursor)
        || typeof row.studentLabel !== 'string' || !row.studentLabel.trim()
        || !Array.isArray(row.guardians) || row.guardians.length < 1 || row.guardians.length > 100
        || (candidates[candidates.length - 1]?.studentPartyId ?? '') >= row.studentPartyId) return unavailable();
      const guardians: { guardianPartyId: string; guardianLabel: string }[] = [];
      for (const guardian of row.guardians) {
        if (!record(guardian) || typeof guardian.guardianPartyId !== 'string' || !UUID.test(guardian.guardianPartyId)
          || guardian.guardianPartyId === row.studentPartyId || typeof guardian.guardianLabel !== 'string' || !guardian.guardianLabel.trim()
          || guardians.some(choice => choice.guardianPartyId === guardian.guardianPartyId)) return unavailable();
        guardians.push({ guardianPartyId: guardian.guardianPartyId, guardianLabel: guardian.guardianLabel });
      }
      candidates.push({ studentPartyId: row.studentPartyId, studentLabel: row.studentLabel, guardians });
    }
    return { tenantId, courseId: input.courseId, nextCursor: data.nextCursor, candidates };
  }

  public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
    const student = await StudentService.createStudent({
      tenantId: input.tenantId,
      partyId: input.partyId,
      studentCode: input.studentCode,
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'primary',
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdBy: '00000000-0000-0000-0000-000000000001',
    }, this.supabase);

    return {
      partyId: student.partyId ?? input.partyId,
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
      guardianPartyId: input.guardianPartyId,
    };
  }

  public async getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null> {
    const client = this.supabase ?? await createClient();
    const { data: student, error } = await client.from('students')
      .select('party_id, tenant_id, student_code, academic_status')
      .eq('party_id', partyId).eq('tenant_id', tenantId)
      .order('enrollment_date', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error('EDUCATION_STUDENT_LOOKUP_UNAVAILABLE');
    if (!student) return null;
    return {
      partyId: student.party_id ?? partyId,
      tenantId: student.tenant_id,
      studentCode: student.student_code,
      academicStatus: student.academic_status === 'enrolled' ? 'active' : 'suspended',
    };
  }
}
