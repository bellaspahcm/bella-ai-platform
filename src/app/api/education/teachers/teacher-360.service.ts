import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface Teacher360Compliance {
  readonly officialRecords: boolean;
  readonly healthCheck: boolean;
  readonly firstAidWarning: 'unknown' | 'valid' | 'warning';
}

export interface Teacher360ProfileData {
  readonly partyId: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly joinedDate: string;
  readonly degree: string;
  readonly totalExperience: string;
  readonly workloadHours: number;
  readonly maxWorkloadHours: number;
  readonly status: string;
  readonly role: string;
  readonly currentClass: string;
  readonly compliance: Teacher360Compliance;
}

export interface UpdateTeacher360ProfileInput {
  readonly name?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
  readonly joinedDate?: string;
  readonly degree?: string;
  readonly totalExperience?: string;
  readonly workloadHours?: number;
  readonly compliance?: Teacher360Compliance;
}

export class Teacher360ReadError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 503) {
    super(code);
  }
}

type TeacherProfileRpcClient = {
  rpc: (
    name: 'preschool_admin_get_teacher_profile' | 'preschool_admin_update_teacher_profile',
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseTeacherProfile(data: unknown): Teacher360ProfileData {
  if (!isRecord(data) || typeof data.partyId !== 'string' || typeof data.name !== 'string') {
    throw new Teacher360ReadError('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  }

  const rawCompliance = isRecord(data.compliance) ? data.compliance : {};
  const firstAid = rawCompliance.firstAidWarning;
  const firstAidWarning: 'unknown' | 'valid' | 'warning' =
    firstAid === 'valid' || firstAid === 'warning' ? firstAid : 'unknown';

  return {
    partyId: data.partyId,
    name: data.name,
    phone: typeof data.phone === 'string' ? data.phone : '',
    email: typeof data.email === 'string' ? data.email : '',
    address: typeof data.address === 'string' ? data.address : 'Chưa được cung cấp',
    joinedDate: typeof data.joinedDate === 'string' ? data.joinedDate : 'Chưa được cung cấp',
    degree: typeof data.degree === 'string' ? data.degree : 'Chưa được cung cấp',
    totalExperience: typeof data.totalExperience === 'string' ? data.totalExperience : 'Chưa được cung cấp',
    workloadHours: typeof data.workloadHours === 'number' ? data.workloadHours : 0,
    maxWorkloadHours: typeof data.maxWorkloadHours === 'number' ? data.maxWorkloadHours : 40,
    status: typeof data.status === 'string' ? data.status : 'Đã xác nhận',
    role: typeof data.role === 'string' ? data.role : 'Chưa phân công',
    currentClass: typeof data.currentClass === 'string' ? data.currentClass : 'Chưa phân công lớp',
    compliance: {
      officialRecords: Boolean(rawCompliance.officialRecords),
      healthCheck: Boolean(rawCompliance.healthCheck),
      firstAidWarning,
    },
  };
}

export async function loadTeacher360Profile(
  client: SupabaseClient<Database>,
  tenantId: string,
  actorId: string,
  teacherPartyId: string
): Promise<Teacher360ProfileData> {
  const rpcClient = client as unknown as TeacherProfileRpcClient;
  const { data, error } = await rpcClient.rpc('preschool_admin_get_teacher_profile', {
    p_tenant_id: tenantId,
    p_actor_id: actorId,
    p_teacher_party_id: teacherPartyId,
  });

  if (error) {
    if (error.code === '42501') throw new Teacher360ReadError('PRESCHOOL_TEACHER_ACCESS_DENIED', 403);
    if (error.code === '44404') throw new Teacher360ReadError('PRESCHOOL_TEACHER_NOT_FOUND', 404);
    throw new Teacher360ReadError('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  }

  return parseTeacherProfile(data);
}

export async function updateTeacher360Profile(
  client: SupabaseClient<Database>,
  tenantId: string,
  actorId: string,
  teacherPartyId: string,
  input: UpdateTeacher360ProfileInput
): Promise<Teacher360ProfileData> {
  const rpcClient = client as unknown as TeacherProfileRpcClient;
  const { data, error } = await rpcClient.rpc('preschool_admin_update_teacher_profile', {
    p_tenant_id: tenantId,
    p_actor_id: actorId,
    p_teacher_party_id: teacherPartyId,
    p_name: input.name ?? null,
    p_phone: input.phone ?? null,
    p_email: input.email ?? null,
    p_address: input.address ?? null,
    p_joined_date: input.joinedDate ?? null,
    p_degree: input.degree ?? null,
    p_total_experience: input.totalExperience ?? null,
    p_workload_hours: input.workloadHours ?? null,
    p_compliance: input.compliance ?? null,
  });

  if (error) {
    if (error.code === '42501') throw new Teacher360ReadError('PRESCHOOL_TEACHER_ACCESS_DENIED', 403);
    if (error.code === '44404') throw new Teacher360ReadError('PRESCHOOL_TEACHER_NOT_FOUND', 404);
    if (error.code === '22023') throw new Teacher360ReadError('PRESCHOOL_TEACHER_INVALID_REQUEST', 400);
    throw new Teacher360ReadError('PRESCHOOL_TEACHER_UNAVAILABLE', 503);
  }

  return parseTeacherProfile(data);
}
