import type { SupabaseClient } from '@supabase/supabase-js';
import { PreschoolChainService } from '../services/preschool-chain.service';
import type { Database } from '@/types/database.types';
import type { IOrgUnitContract, OrgUnit } from '@/platform/org-unit';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EnrollmentRecoveryContractImpl } from '@/platform/education/contracts/enrollment-recovery.contract.impl';

type PreschoolChainClient = SupabaseClient<Database>;
type OrgUnitContractScope = Pick<IOrgUnitContract, 'getOrgUnit' | 'getOrgUnits'>;
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;
type QueryResult<T = unknown> = { data: T; error: { message: string } | null };

class FakeQueryBuilder implements PromiseLike<QueryResult<unknown>> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private upsertRow: Row | null = null;
  private start=0;
  private end=999;
  private sortColumn='';

  public constructor(
    private readonly db: Db,
    private readonly table: string,
  ) {}

  public select(): FakeQueryBuilder {
    return this;
  }
  public order(column:string):FakeQueryBuilder { this.sortColumn=column;return this; }
  public range(start:number,end:number):FakeQueryBuilder { this.start=start;this.end=end;return this; }

  public eq(column: string, value: unknown): FakeQueryBuilder {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  public in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  public upsert(row: Row): FakeQueryBuilder {
    this.upsertRow = row;
    return this;
  }

  public async maybeSingle(): Promise<QueryResult<Row | null>> {
    if (this.upsertRow) await this.executeUpsert();
    const [row] = this.filteredRows();
    return { data: row ?? null, error: null };
  }

  public async single(): Promise<QueryResult<Row | null>> {
    if (this.upsertRow) await this.executeUpsert();
    const [row] = this.filteredRows();
    return { data: row ?? null, error: null };
  }

  public then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executeUpsert().then(onfulfilled, onrejected);
  }

  private async executeUpsert(): Promise<QueryResult<unknown>> {
    if (!this.upsertRow) {
      return { data: this.filteredRows(), error: null };
    }

    const rows = this.db[this.table] ?? [];
    const uniqueColumns = this.table === 'preschool_chain_course_branch_assignments'
      ? ['tenant_id', 'course_id']
      : ['tenant_id', 'enrollment_id'];
    const existingIndex = rows.findIndex((row) => uniqueColumns.every((column) => row[column] === this.upsertRow?.[column]));
    if (existingIndex >= 0) {
      rows[existingIndex] = { ...rows[existingIndex], ...this.upsertRow };
    } else {
      rows.push({ id: `${this.table}-${rows.length + 1}`, created_at: '2026-10-06T00:00:00.000Z', ...this.upsertRow });
    }
    this.db[this.table] = rows;
    return { data: null, error: null };
  }

  private filteredRows(): Row[] {
    const rows = this.db[this.table] ?? [];
    const matches=rows.filter((row) => this.filters.every((filter) => filter(row)));
    if(this.sortColumn)matches.sort((a,b)=>String(a[this.sortColumn]).localeCompare(String(b[this.sortColumn])));
    return matches.slice(this.start,Math.min(this.end+1,this.start+1000));
  }
}

class FakeSupabaseClient {
  public constructor(private readonly db: Db) {}

  public async rpc(_name:string,input:Record<string,string>) {
    const course = {tenant_id:input.p_tenant_id,course_id:input.p_course_id,branch_id:input.p_branch_id};
    const row = {...course,enrollment_id:input.p_enrollment_id,request_id:input.p_request_id,assigned_by:input.p_actor_id};
    if (!this.db.preschool_chain_course_branch_assignments.length) this.db.preschool_chain_course_branch_assignments.push(course);
    if (!this.db.preschool_chain_enrollment_branch_assignments.length) this.db.preschool_chain_enrollment_branch_assignments.push(row);
    return {data:[row],error:null};
  }
  public from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this.db, table);
  }
}

function createOrgUnit(row: Row): OrgUnit {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    unitType: row.unit_type as OrgUnit['unitType'],
    name: String(row.name ?? row.id),
    code: typeof row.code === 'string' ? row.code : undefined,
    parentId: typeof row.parent_id === 'string' ? row.parent_id : undefined,
    isActive: row.is_active === true,
    metadata: null,
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
    updatedAt: new Date('2026-10-06T00:00:00.000Z'),
  };
}

function createOrgUnitContract(db: Db): OrgUnitContractScope {
  return {
    async getOrgUnit(id: string, tenantId: string) {
      const row = (db.org_units ?? []).find((unit) => unit.id === id && unit.tenant_id === tenantId);
      return row ? createOrgUnit(row) : null;
    },
    async getOrgUnits(filter) {
      return (db.org_units ?? [])
        .filter((unit) => unit.tenant_id === filter.tenantId)
        .filter((unit) => !filter.unitType || unit.unit_type === filter.unitType)
        .filter((unit) => filter.isActive === undefined || unit.is_active === filter.isActive)
        .map(createOrgUnit);
    },
  };
}

function createService(db: Db, orgUnits: OrgUnitContractScope = createOrgUnitContract(db)): PreschoolChainService {
  return new PreschoolChainService(
    new FakeSupabaseClient(db) as unknown as PreschoolChainClient,
    orgUnits,
  );
}

describe('PreschoolChainService', () => {
  const tenantId = 'tenant-a';
  const courseId = 'course-a';
  const enrollmentId = 'enrollment-a';
  const branchId = 'branch-a';
  const regionId = 'region-a';
  const actorUserId = 'user-a';

  function baseDb(): Db {
    return {
      org_units: [
        { id: regionId, tenant_id: tenantId, unit_type: 'region', name: 'Quận 1', is_active: true, parent_id: null },
        { id: branchId, tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 1', code: 'Q1', is_active: true, parent_id: regionId },
      ],
      users: [{ id: actorUserId, tenant_id: tenantId, role: 'admin', status:'active' }],
      people_directory: [{ id: 'person-a', tenant_id: tenantId, user_id: actorUserId, is_active: true }],
      org_relationships: [{
        tenant_id: tenantId,
        from_id: 'person-a',
        from_type: 'person',
        to_id: regionId,
        to_type: 'unit',
        rel_type: 'manages',
        since: null,
        until: null,
      }],
      preschool_chain_course_branch_assignments: [],
      preschool_chain_enrollment_branch_assignments: [],
    };
  }

  const preflightInput = { tenantId, courseId, branchId, actorUserId };
  const assignmentInput = {
    ...preflightInput,
    enrollmentId,
    requestId: '11111111-1111-4111-8111-111111111111',
  };

  it('preflights an explicit valid branch without changing any database rows', async () => {
    const db = baseDb();
    const before = JSON.stringify(db);
    await createService(db).preflightEnrollmentBranch(preflightInput);
    expect(JSON.stringify(db)).toBe(before);
  });

  it.each(['missing', 'inactive', 'foreign-tenant', 'non-branch'])('rejects an explicit %s branch during preflight without writes', async (state) => {
    const db = baseDb();
    db.org_units = db.org_units.filter((row) => row.id !== branchId);
    if (state !== 'missing') {
      db.org_units.push({
        id: branchId,
        tenant_id: state === 'foreign-tenant' ? 'tenant-b' : tenantId,
        unit_type: state === 'non-branch' ? 'team' : 'branch',
        is_active: state !== 'inactive',
        parent_id: regionId,
      });
    }
    const before = JSON.stringify(db);
    await expect(createService(db).preflightEnrollmentBranch(preflightInput))
      .rejects.toThrow('PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('rejects denied access during preflight without writes', async () => {
    const db = baseDb();
    db.users[0].role='admin_staff'; db.org_relationships = [];
    const before = JSON.stringify(db);
    await expect(createService(db).preflightEnrollmentBranch(preflightInput))
      .rejects.toThrow('PRESCHOOL_ADMISSION_ACTOR_DENIED');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('rejects a conflicting course branch during preflight without writes', async () => {
    const db = baseDb();
    db.preschool_chain_course_branch_assignments.push({ tenant_id: tenantId, course_id: courseId, branch_id: 'branch-b' });
    const before = JSON.stringify(db);
    await expect(createService(db).preflightEnrollmentBranch(preflightInput))
      .rejects.toThrow('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('propagates branch lookup failure during preflight without writes', async () => {
    const db = baseDb();
    const orgUnits = createOrgUnitContract(db);
    orgUnits.getOrgUnit = async () => { throw new Error('Branch lookup failed'); };
    const before = JSON.stringify(db);
    await expect(createService(db, orgUnits).preflightEnrollmentBranch(preflightInput))
      .rejects.toThrow('Branch lookup failed');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('fails closed when the course mapping lookup fails during preflight', async () => {
    const db = baseDb();
    db.users[0].role = 'admin';
    const before = JSON.stringify(db);
    const lookup = jest.spyOn(FakeQueryBuilder.prototype, 'maybeSingle')
      .mockResolvedValueOnce({ data: db.users[0], error: null })
      .mockResolvedValueOnce({ data: db.users[0], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Mapping read failed' } });
    try {
      await expect(createService(db).preflightEnrollmentBranch(preflightInput))
        .rejects.toThrow('PRESCHOOL_CHAIN_COURSE_BRANCH_LOOKUP_FAILED: Mapping read failed');
      expect(JSON.stringify(db)).toBe(before);
    } finally {
      lookup.mockRestore();
    }
  });

  it.each(['access', 'mapping'])('revalidates changed %s at assignment after a successful preflight', async (changedState) => {
    const db = baseDb();
    const service = createService(db);
    await service.preflightEnrollmentBranch(preflightInput);
    if (changedState === 'access') db.users[0].role='admin_staff';
    else db.preschool_chain_course_branch_assignments.push({ tenant_id: tenantId, course_id: courseId, branch_id: 'branch-b' });
    const beforeAssignment = JSON.stringify(db);
    await expect(service.assignEnrollmentToBranch(assignmentInput)).rejects.toThrow(
      changedState === 'access' ? 'PRESCHOOL_ADMISSION_ACTOR_DENIED' : 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT',
    );
    expect(JSON.stringify(db)).toBe(beforeAssignment);
  });

  it.each([
    { enrollmentId: '', requestId: 'request-a', error: 'PRESCHOOL_CHAIN_ENROLLMENT_REQUIRED' },
    { enrollmentId, requestId: '', error: 'PRESCHOOL_CHAIN_REQUEST_REQUIRED' },
  ])('preserves assignment required input validation: $error', async ({ error, ...overrides }) => {
    const db = baseDb();
    await expect(createService(db).assignEnrollmentToBranch({ ...assignmentInput, ...overrides }))
      .rejects.toThrow(error);
    expect(db.preschool_chain_course_branch_assignments).toEqual([]);
    expect(db.preschool_chain_enrollment_branch_assignments).toEqual([]);
  });

  it('persists course and enrollment branch assignments and reads back the chain', async () => {
    const db = baseDb();
    const service = createService(db);

    const assignment = await service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '11111111-1111-4111-8111-111111111111',
    });

    expect(assignment).toEqual(expect.objectContaining({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      assignedBy: actorUserId,
    }));
    await expect(service.getEnrollmentChain(tenantId, enrollmentId)).resolves.toEqual(assignment);
    expect(db.preschool_chain_course_branch_assignments).toHaveLength(1);
    expect(db.preschool_chain_enrollment_branch_assignments).toHaveLength(1);
  });

  it('blocks branch assignment when the actor has no branch-chain access', async () => {
    const db = baseDb();
    db.org_relationships = []; db.users[0].role='admin_staff';
    const service = createService(db);

    await expect(service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '22222222-2222-4222-8222-222222222222',
    })).rejects.toThrow('PRESCHOOL_ADMISSION_ACTOR_DENIED');
  });

  it('blocks course reassignment to a different branch', async () => {
    const db = baseDb();
    db.org_units.push({ id: 'branch-b', tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 3', is_active: true, parent_id: regionId });
    db.preschool_chain_course_branch_assignments.push({
      tenant_id: tenantId,
      course_id: courseId,
      branch_id: 'branch-b',
    });
    const service = createService(db);

    await expect(service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '33333333-3333-4333-8333-333333333333',
    })).rejects.toThrow('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');
  });

  it('lists only branch options accessible through the actor organization chain', async () => {
    const db = baseDb();
    db.users[0].role='admin_staff';
    db.org_units.push({ id: 'branch-b', tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 3', code: 'Q3', is_active: true, parent_id: null });
    const service = createService(db);

    await expect(service.listAccessibleBranches(tenantId, actorUserId)).resolves.toEqual([
      { id: branchId, name: 'Bella Preschool Quận 1', code: 'Q1' },
    ]);
  });
  it('does not expand access from an inactive ancestor root',async()=>{
    const db=baseDb(); db.users[0].role='admin_staff'; db.org_units[0].is_active=false;
    expect(await createService(db).listAccessibleBranches(tenantId,actorUserId)).toEqual([]);
  });
  it('rejects stored enrollment mapping drift before invoking any writer',async()=>{
    const db=baseDb();db.preschool_chain_enrollment_branch_assignments.push({tenant_id:tenantId,enrollment_id:enrollmentId,course_id:courseId,branch_id:branchId,request_id:'different'});
    await expect(createService(db).assignEnrollmentToBranch(assignmentInput)).rejects.toThrow('ASSIGNMENT_CONFLICT');
    expect(db.preschool_chain_course_branch_assignments).toEqual([]);
  });
  it('retains the 1001st course/enrollment mapping beyond the PostgREST default cap',async()=>{
    const db=baseDb();
    for(let i=0;i<1001;i++){
      const suffix=String(i).padStart(4,'0');
      db.preschool_chain_course_branch_assignments.push({tenant_id:tenantId,course_id:'course-'+suffix,branch_id:branchId});
      db.preschool_chain_enrollment_branch_assignments.push({tenant_id:tenantId,course_id:'course-'+suffix,branch_id:branchId,enrollment_id:'enrollment-'+suffix,request_id:'request-'+suffix,assigned_by:actorUserId});
    }
    const canonical=(id:string)=>({id,tenantId,studentPartyId:'canonical-child',courseId:'course-'+id.slice(-4),status:'active' as const,enrolledAt:'2026-10-19T00:00:00Z'});
    const enrollment=jest.spyOn(EnrollmentContractImpl.prototype,'getEnrollment').mockImplementation(async(_tenant,id)=>canonical(id));
    const recovery=jest.spyOn(EnrollmentRecoveryContractImpl.prototype,'getEnrollmentByRequest').mockImplementation(async(input)=>canonical('enrollment-'+input.requestId.slice(-4)));
    try{const rows=await createService(db).listEnrollmentAssignments(tenantId,actorUserId);expect(rows).toHaveLength(1001);expect(rows.at(-1)?.enrollmentId).toBe('enrollment-1000');}
    finally{enrollment.mockRestore();recovery.mockRestore();}
  });

});
