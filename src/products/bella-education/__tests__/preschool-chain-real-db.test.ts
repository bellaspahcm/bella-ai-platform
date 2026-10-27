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
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { PreschoolAttendanceCommandService } from '@/products/bella-education/services/preschool-attendance-command.service';
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

  it.each(['banned', 'deleted'])('denies a currently %s Auth actor without creating admission intent', async state => {
    const operationKey = randomUUID();
    await pg.query('BEGIN');
    try {
      await pg.query("SELECT set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
      await pg.query(state === 'banned'
        ? "UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1"
        : 'UPDATE auth.users SET deleted_at=clock_timestamp() WHERE id=$1', [actorUserId]);
      const access = await pg.query<{ allowed: boolean }>("SELECT public.preschool_branch_access($1,$2,$3,'admission') AS allowed", [ids.tenant, actorUserId, ids.branchA]);
      expect(access.rows[0].allowed).toBe(false);
      await pg.query('SAVEPOINT rejected_admission');
      await expect(pg.query('SELECT * FROM public.preschool_open_admission($1,$2,$3,$4::jsonb)', [ids.tenant, actorUserId, operationKey,
        JSON.stringify({ courseId: ids.course, branchId: ids.branchA })])).rejects.toMatchObject({ code: '42501' });
      await pg.query('ROLLBACK TO SAVEPOINT rejected_admission');
      expect((await pg.query('SELECT operation_key FROM public.preschool_admission_operations WHERE tenant_id=$1 AND operation_key=$2', [ids.tenant, operationKey])).rows).toEqual([]);
    } finally { await pg.query('ROLLBACK'); }
  });

  it('rechecks Auth revocation after the course lock wait and leaves no admission intent', async () => {
    const worker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const blocker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const operationKey = randomUUID();
    const lockName = `preschool-course:${ids.tenant}:${ids.course}`;
    await worker.connect();
    let attempt: Promise<{ code?: string }> | undefined;
    let before: { banned_until: Date | null; deleted_at: Date | null } | undefined;
    try {
      await blocker.connect();
      // Pin both backends across observations, including transaction poolers.
      // Session locks and a PID sampled outside a transaction can move apart.
      await worker.query('BEGIN');
      await blocker.query('BEGIN');
      const pid = (await worker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const blockerPid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      before = (await pg.query('SELECT banned_until,deleted_at FROM auth.users WHERE id=$1', [actorUserId])).rows[0];
      await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockName]);
      attempt = worker.query('SELECT * FROM public.preschool_open_admission($1,$2,$3,$4::jsonb)', [ids.tenant, actorUserId, operationKey,
        JSON.stringify({ courseId: ids.course, branchId: ids.branchA })]).then(() => ({}), (error: { code?: string }) => error);
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const activity = await pg.query<{ blocked: boolean }>(
          'SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked', [pid, blockerPid]);
        if (activity.rows[0]?.blocked) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await pg.query("UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1", [actorUserId]);
      await blocker.query('ROLLBACK');
      expect(await attempt).toMatchObject({ code: '42501' });
      expect((await pg.query('SELECT operation_key FROM public.preschool_admission_operations WHERE tenant_id=$1 AND operation_key=$2', [ids.tenant, operationKey])).rows).toEqual([]);
    } finally {
      try {
        await blocker.query('ROLLBACK');
        if (attempt) await attempt;
        await worker.query('ROLLBACK');
      } finally {
        try {
          const closed = await Promise.allSettled([worker.end(), blocker.end()]);
          for (const connection of closed) {
            if (connection.status === 'rejected') throw connection.reason;
          }
        } finally {
          // Restore even when a worker rollback/close fails; the observer is
          // independent and must not leave this run's actor banned.
          if (before) {
            await pg.query('UPDATE auth.users SET banned_until=$2,deleted_at=$3 WHERE id=$1', [actorUserId, before.banned_until, before.deleted_at]);
          }
        }
      }
    }
  });

  it('proves admission branch assignment persists through edu_enrollments, chain tables, read-back, tenant isolation, authorization, and idempotency', async () => {
    const chainService = new PreschoolChainService(supabase);
    const accessibleBranches = await chainService.listAccessibleBranches(ids.tenant, actorUserId);
    // The fixture links this actor to Branch A only. Branch B stays outside
    // the actor's explicit Platform organization access.
    expect(accessibleBranches.map((branch) => branch.id)).toEqual([ids.branchA]);

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

  it('scans only positive unpaid debt and leaves settled invoices without overdue exceptions', async () => {
    const periodId = randomUUID();
    await pg.query('BEGIN');
    try {
      const student = (await pg.query<{ party_id: string; student_id: string }>('SELECT party_id,student_id FROM public.students WHERE tenant_id=$1', [ids.tenant])).rows[0];
      expect(student).toBeDefined();
      await pg.query(`INSERT INTO public.edu_fin_billing_periods(id,tenant_id,period_name,start_date,end_date,due_date,status,created_by)
        VALUES($1,$2,'Review overdue proof',CURRENT_DATE-30,CURRENT_DATE-1,CURRENT_DATE-5,'ACTIVE',$3)`, [periodId, ids.tenant, actorUserId]);
      const expectedDebtId = randomUUID();
      const cases = [
        { id: randomUUID(), status: 'OVERPAID', paid: 110, outstanding: 0 },
        { id: randomUUID(), status: 'PAID', paid: 100, outstanding: 0 },
        { id: randomUUID(), status: 'UNPAID', paid: 0, outstanding: 0 },
        { id: expectedDebtId, status: 'PARTIALLY_PAID', paid: 20, outstanding: 80 },
      ];
      for (const invoice of cases) {
        await pg.query(`INSERT INTO public.edu_fin_invoices(id,tenant_id,student_id,student_party_id,billing_period_id,invoice_number,
          invoice_status,settlement_status,gross_amount,net_amount,paid_amount,outstanding_amount,due_date,created_by)
          VALUES($1,$2,$3,$4,$5,$6,'ISSUED',$7,100,100,$8,$9,CURRENT_DATE-5,$10)`,
        [invoice.id, ids.tenant, student.student_id, student.party_id, periodId, 'REVIEW-' + invoice.id, invoice.status, invoice.paid, invoice.outstanding, actorUserId]);
        await pg.query(`SELECT public.preschool_finance_branch_command($1,$2,$3,'projectInvoiceNotice',$4::jsonb)`,
          [ids.tenant, actorUserId, ids.branchA, JSON.stringify({ invoiceId: invoice.id, title: 'Controlled review proof', bodyText: 'Isolated test transaction' })]);
      }
      const before = (await pg.query('SELECT to_jsonb(i) AS row FROM public.edu_fin_invoices i WHERE tenant_id=$1 ORDER BY id', [ids.tenant])).rows;
      const scan = () => pg.query<{ result: { escalatedCount: number } }>(`SELECT public.preschool_finance_branch_command($1,$2,$3,'scanOverdueInvoices','{}') AS result`, [ids.tenant, actorUserId, ids.branchA]);
      expect((await scan()).rows[0].result.escalatedCount).toBe(1);
      expect((await scan()).rows[0].result.escalatedCount).toBe(0);
      const exceptions = await pg.query('SELECT n.source_entity_id AS invoice_id FROM public.edu_comm_exceptions x JOIN public.edu_comm_notices n ON n.id=x.notice_id AND n.tenant_id=x.tenant_id WHERE x.tenant_id=$1', [ids.tenant]);
      expect(exceptions.rows).toEqual([{ invoice_id: expectedDebtId }]);
      expect((await pg.query('SELECT to_jsonb(i) AS row FROM public.edu_fin_invoices i WHERE tenant_id=$1 ORDER BY id', [ids.tenant])).rows).toEqual(before);
    } finally { await pg.query('ROLLBACK'); }
    expect((await pg.query('SELECT id FROM public.edu_fin_billing_periods WHERE id=$1', [periodId])).rows).toEqual([]);
  });

  describe('attendance caller reconciliation CI', () => {
    const englishTenantId = randomUUID();
    let englishActorId = '';
    let englishClient: SupabaseClient<Database>;
    let schoolDay = '';
    let rollCallTime = '';

    beforeAll(async () => {
      const email = `${marker}-english-operator@example.test`;
      const password = `${randomUUID()}A1!`;
      const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error('ATTENDANCE_ENGLISH_AUTH_FIXTURE_FAILED');
      englishActorId = created.data.user.id;
      await pg.query("INSERT INTO public.tenants(id,name,status,product_key) VALUES($1,$2,'active','bella_english_center')",
        [englishTenantId, `${marker} English caller`]);
      await pg.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled English operator','admin','active')",
        [englishActorId, englishTenantId, email]);
      const { url } = requireSupabaseAdminEnv();
      const { publicKey } = requireSupabasePublicEnv();
      englishClient = createSupabaseClient<Database>(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await englishClient.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error('ATTENDANCE_ENGLISH_SIGN_IN_FAILED');
      const time = (await pg.query<{ school_day: string; instant: string }>(
        "SELECT (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS school_day,clock_timestamp()::text AS instant",
      )).rows[0];
      schoolDay = time.school_day;
      rollCallTime = new Date(time.instant).toISOString();
    });

    afterAll(async () => {
      if (englishActorId) await pg.query("UPDATE public.users SET status='inactive' WHERE id=$1 AND tenant_id=$2", [englishActorId, englishTenantId]);
      if (englishClient) {
        const { error } = await englishClient.auth.signOut({ scope: 'global' });
        if (error) throw new Error('ATTENDANCE_ENGLISH_FIXTURE_SIGN_OUT_FAILED');
      }
    });

    async function attendanceFixture(tenantId = ids.tenant) {
      const row = { tenantId, courseId: randomUUID(), studentPartyId: randomUUID(), enrollmentId: randomUUID(), requestId: randomUUID() };
      await pg.query('BEGIN');
      try {
        await pg.query("INSERT INTO public.party_parties(id,tenant_id,party_type,display_name) VALUES($1,$2,'person','Controlled attendance student')", [row.studentPartyId, tenantId]);
        await pg.query(`INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment,prerequisite_course_codes)
          VALUES($1,$2,$3,'Controlled attendance class','active',25,0,'{}')`, [row.courseId, tenantId, `CI-${row.courseId}`]);
        await pg.query("INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,request_id) VALUES($1,$2,$3,$4,'active',$5)",
          [row.enrollmentId, tenantId, row.studentPartyId, row.courseId, row.requestId]);
        if (tenantId === ids.tenant) {
          await pg.query('INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id,course_id,branch_id,assigned_by) VALUES($1,$2,$3,$4)',
            [tenantId, row.courseId, ids.branchA, actorUserId]);
          await pg.query('INSERT INTO public.preschool_chain_enrollment_branch_assignments(tenant_id,enrollment_id,course_id,branch_id,request_id,assigned_by) VALUES($1,$2,$3,$4,$5,$6)',
            [tenantId, row.enrollmentId, row.courseId, ids.branchA, row.requestId, actorUserId]);
        }
        await pg.query('COMMIT');
        return row;
      } catch (error) { await pg.query('ROLLBACK'); throw error; }
    }

    async function attendanceState(enrollmentId: string) {
      const events = (await pg.query('SELECT id,tenant_id,enrollment_id,status FROM public.edu_attendance WHERE enrollment_id=$1 ORDER BY id', [enrollmentId])).rows;
      const daily = (await pg.query('SELECT id,tenant_id,enrollment_id,status FROM public.edu_attendance_daily_state WHERE enrollment_id=$1 ORDER BY id', [enrollmentId])).rows;
      return { events, daily };
    }

    it('uses a real signed-in English Center public adapter and returns the persisted event rather than projection ID', async () => {
      const fixture = await attendanceFixture(englishTenantId);
      const result = await new AttendanceContractImpl(englishClient).recordAttendance({ ...fixture, status: 'present', rollCallTime });
      const state = await attendanceState(fixture.enrollmentId);
      expect(state.events).toEqual([{ id: result.id, tenant_id: englishTenantId, enrollment_id: fixture.enrollmentId, status: 'present' }]);
      expect(state.daily).toHaveLength(1);
      expect(state.daily[0].id).not.toBe(result.id);
    });

    it('preserves the authenticated Preschool caller with canonical history readback', async () => {
      const fixture = await attendanceFixture();
      const result = await new AttendanceContractImpl(actorClient).recordAttendance({ ...fixture, status: 'present', rollCallTime });
      const state = await attendanceState(fixture.enrollmentId);
      expect(state.events).toHaveLength(1);
      expect(state.events[0].id).toBe(result.id);
      expect(state.daily).toHaveLength(1);
      expect(state.daily[0].status).toBe('present');
    });

    it('records attendance for the authenticated Preschool admin', async () => {
      const fixture = await attendanceFixture();
      const result = await new PreschoolAttendanceCommandService(supabase).setDailyAttendance({
        ...fixture, actorId: actorUserId, actorRole: 'admin', status: 'excused', rollCallTime, schoolDay,
      });
      const state = await attendanceState(fixture.enrollmentId);
      expect(state.events).toHaveLength(1);
      expect(state.events[0].id).toBe(result.eventId);
      expect(state.daily).toHaveLength(1);
      expect(state.daily[0].status).toBe('excused');
    });

    it('denies admin_staff without the canonical Auth-to-teacher assignment and creates no Attendance data', async () => {
      const fixture = await attendanceFixture();
      await pg.query("UPDATE public.users SET role='admin_staff' WHERE id=$1 AND tenant_id=$2", [actorUserId, ids.tenant]);
      try {
        await expect(new PreschoolAttendanceCommandService(supabase).setDailyAttendance({
          ...fixture, actorId: actorUserId, actorRole: 'admin_staff', status: 'excused', rollCallTime, schoolDay,
        })).rejects.toMatchObject({ code: 'PRESCHOOL_ATTENDANCE_ACTION_DENIED', status: 403 });
        expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
      } finally { await pg.query("UPDATE public.users SET role='admin' WHERE id=$1 AND tenant_id=$2", [actorUserId, ids.tenant]); }
    });

    it('does not elevate the canonical admin profile when a caller claims super_admin', async () => {
      const fixture = await attendanceFixture();
      // Current Platform returns public.users.role unchanged. HQ super-admin is
      // role=admin plus bella_hq tenant, not permission to invent a profile role.
      await expect(new PreschoolAttendanceCommandService(supabase).setDailyAttendance({
        ...fixture, actorId: actorUserId, actorRole: 'super_admin', status: 'present', rollCallTime, schoolDay,
      })).rejects.toMatchObject({ status: 403 });
      expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
    });

    it.each(['foreign-tenant', 'wrong-role', 'wrong-branch', 'banned', 'deleted'] as const)('denies %s with no Attendance side effect', async reason => {
      const fixture = await attendanceFixture();
      const before = await attendanceState(fixture.enrollmentId);
      try {
        if (reason === 'wrong-role') await pg.query("UPDATE public.users SET role='admin_staff' WHERE id=$1 AND tenant_id=$2", [actorUserId, ids.tenant]);
        if (reason === 'wrong-branch') await pg.query('UPDATE public.preschool_chain_course_branch_assignments SET branch_id=$1 WHERE tenant_id=$2 AND course_id=$3', [ids.branchB, ids.tenant, fixture.courseId]);
        if (reason === 'banned') await pg.query("UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1", [actorUserId]);
        if (reason === 'deleted') await pg.query('UPDATE auth.users SET deleted_at=clock_timestamp() WHERE id=$1', [actorUserId]);
        const caller = reason === 'foreign-tenant' ? englishClient : actorClient;
        await expect(new AttendanceContractImpl(caller).recordAttendance({ ...fixture, status: 'present', rollCallTime }))
          .rejects.toThrow('ATTENDANCE_ACCESS_DENIED');
        expect(await attendanceState(fixture.enrollmentId)).toEqual(before);
      } finally {
        await pg.query("UPDATE public.users SET role='admin' WHERE id=$1 AND tenant_id=$2", [actorUserId, ids.tenant]);
        await pg.query('UPDATE auth.users SET banned_until=NULL,deleted_at=NULL WHERE id=$1', [actorUserId]);
      }
    });

    it('rechecks current Auth after a real enrollment lock wait', async () => {
      const fixture = await attendanceFixture();
      const blocker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      let pending: Promise<{ error?: unknown }> | undefined;
      try {
        await blocker.connect(); await blocker.query('BEGIN');
        const pid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await blocker.query('SELECT id FROM public.edu_enrollments WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [fixture.enrollmentId, ids.tenant]);
        pending = new AttendanceContractImpl(actorClient).recordAttendance({ ...fixture, status: 'present', rollCallTime })
          .then(() => ({}), (error: unknown) => ({ error }));
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const check = await pg.query<{ blocked: boolean }>('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS blocked', [pid]);
          if (check.rows[0].blocked) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        expect(waiting).toBe(true);
        await pg.query("UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1", [actorUserId]);
        await blocker.query('COMMIT');
        expect(await pending).toEqual({ error: expect.objectContaining({ message: 'Failed to set daily attendance: ATTENDANCE_ACCESS_DENIED' }) });
        expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
      } finally {
        try { await blocker.query('ROLLBACK'); if (pending) await pending; }
        finally { await blocker.end(); await pg.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1', [actorUserId]); }
      }
    });

    it('denies anonymous execution and preserves the trusted-server missing-enrollment error', async () => {
      const fixture = await attendanceFixture();
      const { url } = requireSupabaseAdminEnv();
      const { publicKey } = requireSupabasePublicEnv();
      const anonymous = createSupabaseClient<Database>(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await expect(new AttendanceContractImpl(anonymous).recordAttendance({ ...fixture, status: 'present', rollCallTime }))
        .rejects.toThrow('permission denied for function edu_set_daily_attendance');
      const missing = randomUUID();
      await expect(new AttendanceContractImpl(supabase).recordAttendance({ tenantId: ids.tenant, enrollmentId: missing, status: 'present', rollCallTime }))
        .rejects.toThrow(`Enrollment ${missing} not found`);
      expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
    });

    it.each(['cancel-first-write', 'cancel-second-write', 'revoke-during-upsert'] as const)('rolls back attempted history after %s without trigger/schema changes', async failure => {
      const fixture = await attendanceFixture();
      const worker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      const blocker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      let pending: Promise<{ code?: string }> | undefined;
      try {
        await worker.connect(); await blocker.connect();
        await worker.query('BEGIN'); await blocker.query('BEGIN');
        const workerPid = (await worker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const blockerPid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        if (failure === 'cancel-first-write') {
          // A first-write FK waiter; no shared table lock or schema injection.
          await blocker.query('SELECT id FROM public.tenants WHERE id=$1 FOR UPDATE', [ids.tenant]);
        } else {
          // Invisible at SELECT FOR UPDATE; blocks the second write's unique key.
          await blocker.query('INSERT INTO public.edu_attendance_daily_state(tenant_id,enrollment_id,school_day,status) VALUES($1,$2,$3,$4)',
            [ids.tenant, fixture.enrollmentId, schoolDay, 'present']);
        }
        await worker.query('SET LOCAL ROLE authenticated');
        await worker.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: actorUserId })]);
        pending = worker.query('SELECT * FROM public.edu_set_daily_attendance($1,$2,$3,$4,$5)',
          [ids.tenant, fixture.enrollmentId, 'absent', rollCallTime, schoolDay])
          .then(() => ({}), (error: { code?: string }) => error);
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const check = await pg.query<{ blocked: boolean }>('SELECT $2::int=ANY(pg_blocking_pids($1::int)) AS blocked', [workerPid, blockerPid]);
          if (check.rows[0].blocked) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        expect(waiting).toBe(true);
        if (failure !== 'revoke-during-upsert') {
          const cancelled = await pg.query<{ cancelled: boolean }>('SELECT pg_cancel_backend($1) AS cancelled', [workerPid]);
          expect(cancelled.rows[0].cancelled).toBe(true);
          expect(await pending).toMatchObject({ code: '57014' });
        } else {
          await pg.query('UPDATE public.org_units SET is_active=false WHERE id=$1 AND tenant_id=$2', [ids.branchA, ids.tenant]);
          // Release the key but discard the blocker's synthetic projection.
          await blocker.query('ROLLBACK');
          expect(await pending).toMatchObject({ code: '42501' });
        }
      } finally {
        try {
          await blocker.query('ROLLBACK');
          if (pending) await pending;
          await worker.query('ROLLBACK');
        } finally {
          await Promise.all([worker.end(), blocker.end()]);
          await pg.query('UPDATE public.org_units SET is_active=true WHERE id=$1 AND tenant_id=$2', [ids.branchA, ids.tenant]);
        }
      }
      expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
    });

    it('rolls back history and projection together and rejects snapshot-isolated callers', async () => {
      const fixture = await attendanceFixture();
      await pg.query('BEGIN');
      try {
        await pg.query('SET LOCAL ROLE authenticated');
        await pg.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: actorUserId })]);
        const rows = await pg.query('SELECT * FROM public.edu_set_daily_attendance($1,$2,$3,$4,$5)', [ids.tenant, fixture.enrollmentId, 'present', rollCallTime, schoolDay]);
        expect(rows.rowCount).toBe(1);
      } finally { await pg.query('ROLLBACK'); }
      expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
      await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      try {
        await pg.query('SET LOCAL ROLE authenticated');
        await pg.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: actorUserId })]);
        await expect(pg.query('SELECT * FROM public.edu_set_daily_attendance($1,$2,$3,$4,$5)', [ids.tenant, fixture.enrollmentId, 'present', rollCallTime, schoolDay]))
          .rejects.toMatchObject({ code: '40001' });
      } finally { await pg.query('ROLLBACK'); }
      expect(await attendanceState(fixture.enrollmentId)).toEqual({ events: [], daily: [] });
    });
  });

  describe('handover atomic command CI', () => {
    const handoverService = () => new PreschoolSafePickupHandoverService(supabase, input => {
      const client: SupabaseClient = supabase;
      return client.rpc('preschool_record_handover', {
        p_tenant_id: input.tenantId, p_actor_id: input.operatorUserId,
        p_student_party_id: input.studentPartyId, p_guardian_party_id: input.guardianPartyId,
        p_pickup_authorization_id: input.pickupAuthorizationId,
      });
    });
    async function seedHandoverFixture() {
      const fixture = {
        tenantId: ids.tenant,
        operatorUserId: actorUserId,
        studentPartyId: randomUUID(),
        guardianPartyId: randomUUID(),
        pickupAuthorizationId: randomUUID(),
        courseId: randomUUID(),
        enrollmentId: randomUUID(),
        requestId: randomUUID(),
      };
      await pg.query('BEGIN');
      try {
        await pg.query(`INSERT INTO public.party_parties(id,tenant_id,party_type,display_name)
          VALUES($1,$3,'person','Controlled CI child'),($2,$3,'person','Controlled CI guardian')`,
        [fixture.studentPartyId, fixture.guardianPartyId, ids.tenant]);
        await pg.query(`INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment,prerequisite_course_codes)
          VALUES($1,$2,$3,'Controlled CI handover class','active',25,0,'{}')`,
        [fixture.courseId, ids.tenant, `CI-${fixture.courseId}`]);
        await pg.query(`INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,request_id)
          VALUES($1,$2,$3,$4,'active',$5)`,
        [fixture.enrollmentId, ids.tenant, fixture.studentPartyId, fixture.courseId, fixture.requestId]);
        await pg.query(`INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id,course_id,branch_id,assigned_by)
          VALUES($1,$2,$3,$4)`, [ids.tenant, fixture.courseId, ids.branchA, actorUserId]);
        await pg.query(`INSERT INTO public.preschool_chain_enrollment_branch_assignments(tenant_id,enrollment_id,course_id,branch_id,request_id,assigned_by)
          VALUES($1,$2,$3,$4,$5,$6)`,
        [ids.tenant, fixture.enrollmentId, fixture.courseId, ids.branchA, fixture.requestId, actorUserId]);
        await pg.query(`INSERT INTO public.edu_preschool_pickup_authorizations(id,tenant_id,student_party_id,guardian_party_id,status)
          VALUES($1,$2,$3,$4,'authorized')`,
        [fixture.pickupAuthorizationId, ids.tenant, fixture.studentPartyId, fixture.guardianPartyId]);
        await pg.query('COMMIT');
        return fixture;
      } catch (error) {
        await pg.query('ROLLBACK');
        throw error;
      }
    }

    async function readHandoverEvents(studentPartyId: string) {
      return (await pg.query<{ id: string; handed_over_by: string }>(
        `SELECT id,handed_over_by FROM public.edu_preschool_pickup_handover_events
         WHERE tenant_id=$1 AND student_party_id=$2 ORDER BY id`, [ids.tenant, studentPartyId],
      )).rows;
    }

    it('serializes concurrent calls and recovers the committed canonical handover without another event', async () => {
      const fixture = await seedHandoverFixture();
      const service = handoverService();
      const [first, second] = await Promise.all([
        service.recordHandover(fixture), service.recordHandover(fixture),
      ]);
      expect(first.id).toBe(second.id);
      const recovered = await handoverService().recordHandover(fixture);
      expect(recovered.id).toBe(first.id);
      expect(recovered.handedOverBy).toBe(actorUserId);
      expect(await readHandoverEvents(fixture.studentPartyId)).toEqual([
        { id: first.id, handed_over_by: actorUserId },
      ]);
    });

    it('denies pickup revocation committed during an actual lock wait and persists no event', async () => {
      const fixture = await seedHandoverFixture();
      const blocker = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      let attempt: Promise<{ ok: boolean; error?: unknown }> | undefined;
      try {
        await blocker.connect();
        await blocker.query('BEGIN');
        await blocker.query("SET LOCAL statement_timeout = '15s'");
        const blockerPid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await blocker.query('SELECT id FROM public.edu_preschool_pickup_authorizations WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [fixture.pickupAuthorizationId, ids.tenant]);
        attempt = handoverService().recordHandover(fixture)
          .then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const activity = await pg.query<{ blocked: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS blocked', [blockerPid],
          );
          if (activity.rows[0]?.blocked) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        expect(waiting).toBe(true);
        await blocker.query("UPDATE public.edu_preschool_pickup_authorizations SET status='revoked' WHERE id=$1 AND tenant_id=$2",
          [fixture.pickupAuthorizationId, ids.tenant]);
        await blocker.query('COMMIT');
        expect(await attempt).toEqual({ ok: false, error: expect.objectContaining({ status: 403 }) });
        expect(await readHandoverEvents(fixture.studentPartyId)).toEqual([]);
      } finally {
        try {
          await blocker.query('ROLLBACK');
          if (attempt) await attempt;
        } finally { await blocker.end(); }
      }
    });

    it('denies a foreign tenant without persisting a handover', async () => {
      const fixture = await seedHandoverFixture();
      await expect(handoverService().recordHandover({
        ...fixture, tenantId: ids.otherTenant,
      })).rejects.toMatchObject({ status: 403 });
      expect(await readHandoverEvents(fixture.studentPartyId)).toEqual([]);
    });

    it.each(['anon', 'authenticated'] as const)('denies direct %s RPC execution without side effects', async role => {
      const fixture = await seedHandoverFixture();
      await pg.query('BEGIN');
      try {
        // Role is from the fixed tuple above, never request input.
        await pg.query(role === 'anon' ? 'SET LOCAL ROLE anon' : 'SET LOCAL ROLE authenticated');
        await pg.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role, sub: actorUserId })]);
        await expect(pg.query('SELECT * FROM public.preschool_record_handover($1,$2,$3,$4,$5)', [
          ids.tenant, actorUserId, fixture.studentPartyId, fixture.guardianPartyId, fixture.pickupAuthorizationId,
        ])).rejects.toMatchObject({ code: '42501' });
      } finally { await pg.query('ROLLBACK'); }
      expect(await readHandoverEvents(fixture.studentPartyId)).toEqual([]);
    });
  });
});
