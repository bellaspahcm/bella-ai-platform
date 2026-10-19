import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { QueueIdentityReader } from '@/products/bella-education/work-queue/work-queue.service';
import { QueueError } from '@/products/bella-education/work-queue/work-queue.types';

export class QueueIdentityPersistence implements QueueIdentityReader {
  constructor(private readonly db: SupabaseClient<Database>) {}
  async identities(tenantId: string, studentIds: string[], guardianIds: string[]) {
    const uniqueStudents = [...new Set(studentIds)];
    const result = uniqueStudents.length ? await this.db.from('students').select('student_id, party_id, student_code')
      .eq('tenant_id', tenantId).in('student_id', uniqueStudents) : { data: [], error: null };
    if (result.error) throw new QueueError(500, 'Không thể đối chiếu hồ sơ trẻ.');
    const students = result.data ?? [];
    const partyIds = [...new Set([...students.flatMap(row => row.party_id ? [row.party_id] : []), ...guardianIds])];
    const parties = partyIds.length ? await this.db.from('party_parties').select('id, display_name')
      .eq('tenant_id', tenantId).in('id', partyIds) : { data: [], error: null };
    if (parties.error) throw new QueueError(500, 'Không thể đối chiếu tên trẻ và phụ huynh.');
    const partiesById = new Map((parties.data ?? []).map(row => [row.id, row.display_name]));
    const studentsById = new Map(students.map(row => [row.student_id, row]));
    return (studentId: string, guardianId: string | null) => {
      const row = studentsById.get(studentId);
      return { studentName: row?.party_id ? partiesById.get(row.party_id) ?? null : null, studentCode: row?.student_code ?? null,
        guardianName: guardianId ? partiesById.get(guardianId) ?? null : null };
    };
  }
}
