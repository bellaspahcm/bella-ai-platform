import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { POST as createPreschoolEnrollment } from '@/app/api/education/enrollments/route';
import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import { PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';

let supabase: SupabaseClient<Database>;
let actorClient: SupabaseClient<Database>;

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => actorClient,
}));

jest.setTimeout(120_000);

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';
const educationSystemUserId = '00000000-0000-0000-0000-000000000001';

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function sslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : {
        rejectUnauthorized: true,
        ...(process.env.E2E_SUPABASE_DB_SSL_CA
          ? { ca: process.env.E2E_SUPABASE_DB_SSL_CA }
          : {}),
      };
}

function hasRealSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

interface PreschoolEnrollmentResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly student: {
    readonly partyId: string;
    readonly studentCode: string;
    readonly guardianPartyId: string;
  };
  readonly enrollment: {
    readonly id: string;
    readonly courseId: string;
    readonly status: string;
  };
  readonly chain: {
    readonly tenantId: string;
    readonly courseId: string;
    readonly enrollmentId: string;
    readonly branchId: string;
    readonly requestId: string;
    readonly assignedBy: string | null;
  } | null;
}

type CountRow = {
  count: number;
};

type EnrollmentReadBackRow = {
  id: string;
  tenant_id: string;
  student_party_id: string;
  course_id: string;
  request_id: string;
  status: string;
};

type ChainReadBackRow = {
  tenant_id: string;
  enrollment_id: string;
  course_id: string;
  branch_id: string;
  request_id: string;
  assigned_by: string | null;
};

describe('Preschool Chain real DB E2E proof', () => {
  const marker = `preschool-chain-real-db-${Date.now()}`;
  const ids = {
    tenant: randomUUID(),
    otherTenant: randomUUID(),
    branchA: randomUUID(),
    branchB: randomUUID(),
    otherTenantBranch: randomUUID(),
    person: randomUUID(),
    course: randomUUID(),
    operationKey: randomUUID(),
  };

  let pg: Client;
  let actorUserId = '';
  let authUserId = '';
  const actorEmail = `${marker}-admission-operator@example.test`;

  beforeAll(async () => {
    if (!isRunnableDbUrl(dbUrl)) {
      throw new Error('PRESCHOOL_CHAIN_REAL_DB_REQUIRES_DATABASE_URL_OR_SUPABASE_DB_URL');
    }
    if (!hasRealSupabaseAdminEnv()) {
      throw new Error('PRESCHOOL_CHAIN_REAL_DB_REQUIRES_REAL_SUPABASE_ADMIN_ENV');
    }

    const { url, adminKey } = requireSupabaseAdminEnv();
    const { publicKey } = requireSupabasePublicEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    actorClient = createSupabaseClient<Database>(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const password = `${randomUUID()}A1!`;
    const authUser = await supabase.auth.admin.createUser({
      email: actorEmail,
      password,
      email_confirm: true,
    });
    if (authUser.error || !authUser.data.user) {
      throw new Error(`Failed to seed Preschool auth user: ${authUser.error?.message ?? 'missing user'}`);
    }
    authUserId = authUser.data.user.id;
    actorUserId = authUser.data.user.id;
    pg = new Client({
      connectionString: dbUrl,
      ssl: sslConfig(),
    });
    await pg.connect();
    await seedPreschoolChainFixture();
    const signedIn = await actorClient.auth.signInWithPassword({ email: actorEmail, password });
    if (signedIn.error) throw signedIn.error;
    expect(signedIn.data.user?.id).toBe(actorUserId);
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    try {
      if (pg) {
        try {
          // Durable admission, enrollment events and timeline history are retained.
          // Retire only this run's actor; never delete canonical evidence to clean up.
          if (actorUserId) {
            await pg.query("UPDATE public.users SET status = 'inactive' WHERE id = $1 AND tenant_id = $2", [actorUserId, ids.tenant]);
            const actor = await pg.query<{ status: string }>('SELECT status FROM public.users WHERE id = $1', [actorUserId]);
            expect(actor.rows[0]?.status).toBe('inactive');
          }
        } catch (error) {
          cleanupError = error;
        } finally {
          await pg.end();
        }
      }
    } finally {
      if (authUserId && actorClient) {
        const { error } = await actorClient.auth.signOut({ scope: 'global' });
        if (error && !error.message.toLowerCase().includes('user not found')) {
          cleanupError = cleanupError ?? error;
        }
      }
      console.info('[Preschool Chain retained fixture] history retained; run-owned actor retired');
      if (cleanupError) {
        throw cleanupError;
      }
    }
  });

  async function seedPreschoolChainFixture(): Promise<void> {
    await pg.query(
      `
        INSERT INTO public.tenants (id, name, status, product_key, enabled_modules)
        VALUES
          ($1::uuid, $2, 'active', 'bella_preschool', '{"education": true}'::jsonb),
          ($3::uuid, $4, 'active', 'bella_preschool', '{"education": true}'::jsonb)
      `,
      [
        ids.tenant,
        `${marker} Tenant`,
        ids.otherTenant,
        `${marker} Other Tenant`,
      ],
    );

    // StudentContract requires the existing canonical system actor. Do not
    // fabricate or move that shared identity into this run's tenant.
    const systemActor = await pg.query<CountRow>('SELECT COUNT(*)::int AS count FROM public.users WHERE id = $1', [educationSystemUserId]);
    if (systemActor.rows[0]?.count !== 1) {
      throw new Error('PRESCHOOL_CHAIN_REAL_DB_REQUIRES_CANONICAL_EDUCATION_SYSTEM_ACTOR');
    }
    await pg.query(
      "INSERT INTO public.users (id, tenant_id, email, full_name, role, status) VALUES ($1, $2, $3, $4, 'admin', 'active')",
      [actorUserId, ids.tenant, actorEmail, `${marker} Admission Operator`],
    );

    await pg.query(
      `
        INSERT INTO public.edu_courses (
          id,
          tenant_id,
          course_code,
          title,
          status,
          max_students,
          current_enrollment,
          prerequisite_course_codes
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          'active',
          25,
          0,
          '{}'::text[]
        )
      `,
      [
        ids.course,
        ids.tenant,
        `${marker}-CLASS-01`,
        `${marker} Preschool Class`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES
          ($1::uuid, $4::uuid, 'branch', $5, $8, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb),
          ($2::uuid, $4::uuid, 'branch', $6, $9, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb),
          ($3::uuid, $10::uuid, 'branch', $7, $11, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb)
      `,
      [
        ids.branchA,
        ids.branchB,
        ids.otherTenantBranch,
        ids.tenant,
        `${marker} Branch A`,
        `${marker} Branch B`,
        `${marker} Other Tenant Branch`,
        `${marker}-A`,
        `${marker}-B`,
        ids.otherTenant,
        `${marker}-OT`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb)
      `,
      [
        ids.person,
        ids.tenant,
        actorUserId,
        `${marker} Admission Operator`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id,
          from_id,
          from_type,
          to_id,
          to_type,
          rel_type,
          role,
          since,
          metadata
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'person',
          $3::uuid,
          'unit',
          'belongs_to',
          'admission_operator',
          CURRENT_DATE,
          '{"proof":"preschool-chain-real-db"}'::jsonb
        )
      `,
      [ids.tenant, ids.person, ids.branchA],
    );
  }

  function buildAdmissionRequest(): Request {
    return new Request('http://localhost/api/education/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationKey: ids.operationKey,
        tenantId: ids.tenant,
        childName: `${marker} Student`,
        nickname: 'Proof',
        dateOfBirth: '2023-06-15',
        gender: 'Nam',
        guardianName: `${marker} Guardian`,
        guardianPhone: '0909123456',
        medicalNote: 'Real DB chain proof',
        courseId: ids.course,
        branchId: ids.branchA,
      }),
    });
  }

  it('proves Preschool Chain migration tables, RLS, and policy surface exist in the real database', async () => {
    const tables = await pg.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
      `,
      [[
        'preschool_chain_course_branch_assignments',
        'preschool_chain_enrollment_branch_assignments',
      ]],
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'preschool_chain_course_branch_assignments',
      'preschool_chain_enrollment_branch_assignments',
    ]);

    const rls = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])
        ORDER BY c.relname
      `,
      [[
        'preschool_chain_course_branch_assignments',
        'preschool_chain_enrollment_branch_assignments',
      ]],
    );
    expect(rls.rows).toHaveLength(2);
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);

    const policies = await pg.query<{ policyname: string; cmd: string; roles: string[] }>(
      `
        SELECT policyname, cmd, roles
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname = ANY($1::text[])
        ORDER BY policyname
      `,
      [[
        'preschool_chain_course_branch_select',
        'preschool_chain_enrollment_branch_select',
      ]],
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual([
      'preschool_chain_course_branch_select',
      'preschool_chain_enrollment_branch_select',
    ]);
    expect(policies.rows.every((row) => row.cmd === 'SELECT' && row.roles.includes('authenticated'))).toBe(true);
    const grants = await pg.query<{ role: string; table_name: string; can_write: boolean }>(`
      SELECT role, table_name,
        has_table_privilege(role, 'public.' || table_name, 'INSERT,UPDATE,DELETE,TRUNCATE') AS can_write
      FROM unnest(ARRAY['anon', 'authenticated']) AS role
      CROSS JOIN unnest(ARRAY['preschool_chain_course_branch_assignments', 'preschool_chain_enrollment_branch_assignments']) AS table_name
    `);
    expect(grants.rows).toHaveLength(4);
    expect(grants.rows.every((row) => !row.can_write)).toBe(true);
  });

  it('proves admission branch assignment persists through edu_enrollments, chain tables, read-back, tenant isolation, authorization, and idempotency', async () => {
    const chainService = new PreschoolChainService(supabase);
    const accessibleBranches = await chainService.listAccessibleBranches(ids.tenant, actorUserId);
    expect(accessibleBranches.map((branch) => branch.id).sort()).toEqual([ids.branchA, ids.branchB].sort());

    const response = await createPreschoolEnrollment(buildAdmissionRequest());
    const body: PreschoolEnrollmentResponse = await response.json();

    if (response.status !== 201) {
      throw new Error(`Expected Preschool admission 201, received ${response.status}: ${JSON.stringify(body)}`);
    }
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.enrollment.courseId).toBe(ids.course);
    expect(body.enrollment.status).toBe('active');
    expect(body.chain).toEqual(expect.objectContaining({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      assignedBy: actorUserId,
    }));

    expect(body.chain).not.toBeNull();
    const chain = body.chain;
    if (!chain) {
      throw new Error('Expected Preschool chain assignment in admission response');
    }

    const enrollmentReadBack = await pg.query<EnrollmentReadBackRow>(
      `
        SELECT id::text, tenant_id::text, student_party_id::text, course_id::text, request_id, status
        FROM public.edu_enrollments
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
      `,
      [body.enrollment.id, ids.tenant],
    );
    expect(enrollmentReadBack.rows[0]).toEqual({
      id: body.enrollment.id,
      tenant_id: ids.tenant,
      student_party_id: body.student.partyId,
      course_id: ids.course,
      request_id: chain.requestId,
      status: 'active',
    });

    const courseChain = await pg.query<ChainReadBackRow>(
      `
        SELECT tenant_id::text, $1::uuid::text AS enrollment_id, course_id::text, branch_id::text, $2::uuid::text AS request_id, assigned_by::text
        FROM public.preschool_chain_course_branch_assignments
        WHERE tenant_id = $3::uuid
          AND course_id = $4::uuid
      `,
      [body.enrollment.id, chain.requestId, ids.tenant, ids.course],
    );
    expect(courseChain.rows[0]).toEqual({
      tenant_id: ids.tenant,
      enrollment_id: body.enrollment.id,
      course_id: ids.course,
      branch_id: ids.branchA,
      request_id: chain.requestId,
      assigned_by: actorUserId,
    });

    const enrollmentChain = await pg.query<ChainReadBackRow>(
      `
        SELECT tenant_id::text, enrollment_id::text, course_id::text, branch_id::text, request_id::text, assigned_by::text
        FROM public.preschool_chain_enrollment_branch_assignments
        WHERE tenant_id = $1::uuid
          AND enrollment_id = $2::uuid
      `,
      [ids.tenant, body.enrollment.id],
    );
    expect(enrollmentChain.rows[0]).toEqual({
      tenant_id: ids.tenant,
      enrollment_id: body.enrollment.id,
      course_id: ids.course,
      branch_id: ids.branchA,
      request_id: chain.requestId,
      assigned_by: actorUserId,
    });

    await expect(chainService.getEnrollmentChain(ids.tenant, body.enrollment.id))
      .resolves
      .toEqual(expect.objectContaining({
        tenantId: ids.tenant,
        enrollmentId: body.enrollment.id,
        branchId: ids.branchA,
      }));
    await expect(chainService.getEnrollmentChain(ids.otherTenant, body.enrollment.id))
      .resolves
      .toBeNull();
    await expect(chainService.listAccessibleBranches(ids.otherTenant, actorUserId))
      .rejects
      .toThrow('PRESCHOOL_CHAIN_ACTOR_DENIED');

    await expect(chainService.assignEnrollmentToBranch({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchB,
      actorUserId,
      requestId: randomUUID(),
    })).rejects.toThrow('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');

    await expect(chainService.assignEnrollmentToBranch({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      actorUserId,
      requestId: chain.requestId,
    })).resolves.toEqual(expect.objectContaining({
      tenantId: ids.tenant,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      requestId: chain.requestId,
    }));

    const chainCount = await pg.query<CountRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM public.preschool_chain_enrollment_branch_assignments
        WHERE tenant_id = $1::uuid
          AND enrollment_id = $2::uuid
      `,
      [ids.tenant, body.enrollment.id],
    );
    expect(chainCount.rows[0]?.count).toBe(1);

    const recoveredResponse = await createPreschoolEnrollment(buildAdmissionRequest());
    const recovered: PreschoolEnrollmentResponse = await recoveredResponse.json();
    expect(recoveredResponse.status).toBe(201);
    expect(recovered.student.partyId).toBe(body.student.partyId);
    expect(recovered.enrollment.id).toBe(body.enrollment.id);
    const enrollmentCount = await pg.query<CountRow>('SELECT COUNT(*)::int AS count FROM public.edu_enrollments WHERE tenant_id = $1', [ids.tenant]);
    expect(enrollmentCount.rows[0]?.count).toBe(1);

    const ownAssignment = await actorClient.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('tenant_id', ids.tenant);
    expect(ownAssignment.error).toBeNull();
    expect(ownAssignment.data).toEqual([{ enrollment_id: body.enrollment.id }]);
    const foreignAssignment = await actorClient.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('tenant_id', ids.otherTenant);
    expect(foreignAssignment.error).toBeNull();
    expect(foreignAssignment.data).toEqual([]);

    await pg.query("UPDATE public.users SET role = 'admin_staff' WHERE id = $1 AND tenant_id = $2", [actorUserId, ids.tenant]);
    try {
      expect((await chainService.listAccessibleBranches(ids.tenant, actorUserId)).map((branch) => branch.id)).toEqual([ids.branchA]);
      await expect(chainService.assertBranchAccess(ids.tenant, actorUserId, ids.branchB)).rejects.toThrow('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');
      const denied = await createPreschoolEnrollment(buildAdmissionRequest());
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({ success: false, error: 'PRESCHOOL_ADMISSION_ACTOR_DENIED' });
      expect((await pg.query<CountRow>('SELECT COUNT(*)::int AS count FROM public.edu_enrollments WHERE tenant_id = $1', [ids.tenant])).rows[0]?.count).toBe(1);
    } finally {
      await pg.query("UPDATE public.users SET role = 'admin' WHERE id = $1 AND tenant_id = $2", [actorUserId, ids.tenant]);
    }
  });
});
