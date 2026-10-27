import { describe, expect, it } from '@jest/globals';
import { DailyCareService } from '../care-wellbeing/daily-care/daily-care.service';

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

const tenantId = 'tenant-1';
const otherTenantId = 'tenant-2';
const courseId = 'course-1';
const otherCourseId = 'course-2';
const studentPartyId = 'party-student-1';
const otherStudentPartyId = 'party-student-2';

class QueryBuilder {
  private predicates: Predicate[] = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private selectColumns = '*';
  private insertRows: Row[] | null = null;
  private updatePatch: Row | null = null;

  constructor(
    private readonly table: string,
    private readonly state: Map<string, Row[]>,
  ) {}

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.predicates.push((row) => row[column] === value);
    if (this.updatePatch) {
      return this.executeUpdate();
    }
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  insert(row: Row | Row[]) {
    this.insertRows = Array.isArray(row) ? row : [row];
    return this;
  }

  update(patch: Row) {
    this.updatePatch = patch;
    return this;
  }

  async maybeSingle() {
    const rows = this.executeSelect();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    if (this.insertRows) {
      const rows = this.state.get(this.table) ?? [];
      const inserted = this.insertRows.map((row, index) => ({
        id: `${this.table}-${rows.length + index + 1}`,
        created_at: '2026-09-27T00:00:00.000Z',
        updated_at: '2026-09-27T00:00:00.000Z',
        ...row,
      }));
      this.state.set(this.table, [...rows, ...inserted]);
      return { data: inserted[0], error: null };
    }

    const rows = this.executeSelect();
    return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } };
  }

  then(resolve: (value: { data: Row[]; error: null }) => void) {
    resolve({ data: this.executeSelect(), error: null });
  }

  private executeSelect(): Row[] {
    const rows = this.state.get(this.table) ?? [];
    return rows.filter((row) => (
      this.predicates.every((predicate) => predicate(row))
      && this.inFilters.every((filter) => filter.values.includes(row[filter.column]))
    )).map((row) => ({ ...row }));
  }

  private async executeUpdate() {
    const rows = this.state.get(this.table) ?? [];
    let changed = false;
    const nextRows = rows.map((row) => {
      const matches = this.predicates.every((predicate) => predicate(row));
      if (!matches) return row;
      changed = true;
      return {
        ...row,
        ...this.updatePatch,
      };
    });
    this.state.set(this.table, nextRows);
    return { data: changed ? nextRows.filter((row) => this.predicates.every((predicate) => predicate(row))) : [], error: null };
  }
}

class FakeSupabase {
  public readonly state = new Map<string, Row[]>();

  constructor(seed: Record<string, Row[]>) {
    Object.entries(seed).forEach(([table, rows]) => this.state.set(table, rows.map((row) => ({ ...row }))));
  }

  from(table: string) {
    return new QueryBuilder(table, this.state);
  }
}

function buildClient() {
  return new FakeSupabase({
    tenants: [{ id: tenantId, product_key: 'bella_school' }, { id: otherTenantId, product_key: 'bella_school' }],
    edu_courses: [
      { id: courseId, tenant_id: tenantId, status: 'active' },
      { id: otherCourseId, tenant_id: otherTenantId, status: 'active' },
    ],
    edu_enrollments: [
      { id: 'enrollment-1', tenant_id: tenantId, course_id: courseId, student_party_id: studentPartyId, status: 'active' },
      { id: 'enrollment-2', tenant_id: tenantId, course_id: otherCourseId, student_party_id: otherStudentPartyId, status: 'active' },
    ],
    students: [
      { tenant_id: tenantId, party_id: studentPartyId, student_code: 'EDU-2026-001' },
      { tenant_id: tenantId, party_id: otherStudentPartyId, student_code: 'EDU-2026-002' },
    ],
    party_parties: [
      { tenant_id: tenantId, id: studentPartyId, display_name: 'Daily Care Child', gender: 'female', dob: '2022-01-01' },
      { tenant_id: tenantId, id: otherStudentPartyId, display_name: 'Other Child', gender: 'male', dob: '2021-01-01' },
    ],
    edu_daily_care_sessions: [],
    edu_daily_care_records: [],
    edu_child_allergies: [],
    edu_meal_item_ingredients: [],
  });
}

describe('DailyCareService canonical student party connection', () => {
  it('persists and reads back care for a canonical enrolled student without legacy student_id', async () => {
    const client = buildClient();
    const service = new DailyCareService(client as never);

    const mealResult = await service.recordBulkMeals({
      tenantId,
      courseId,
      date: '2026-09-27',
      mealType: 'LUNCH',
      students: [{ studentPartyId, portion: 'ALL' }],
    });
    const hygieneResult = await service.recordBulkHygiene({
      tenantId,
      courseId,
      date: '2026-09-27',
      hygieneEntries: [{ studentPartyId, type: 'TOILET' }],
    });
    const napResult = await service.recordBulkNap({
      tenantId,
      courseId,
      date: '2026-09-27',
      napEntries: [{ studentPartyId, quality: 'DEEP' }],
    });

    expect(mealResult.committed).toBe(1);
    expect(hygieneResult.committed).toBe(1);
    expect(napResult.committed).toBe(1);

    const records = client.state.get('edu_daily_care_records') ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      tenant_id: tenantId,
      student_party_id: studentPartyId,
    });
    expect(records[0]).not.toHaveProperty('student_id');

    const roster = await service.getDailyCareRoster(tenantId, courseId, '2026-09-27');
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      studentPartyId,
      name: 'Daily Care Child',
      studentCode: 'EDU-2026-001',
    });
    expect(roster[0].care?.mealRecords).toHaveLength(1);
    expect(roster[0].care?.hygieneRecords).toHaveLength(1);
    expect(roster[0].care?.napRecords).toMatchObject({ quality: 'DEEP' });
  });

  it('records arrival for the canonical student party', async () => {
    const client = buildClient();
    const service = new DailyCareService(client as never);

    const result = await service.recordBulkArrival({
      tenantId,
      courseId,
      date: '2026-09-27',
      arrivals: [{ studentPartyId, status: 'PRESENT', condition: 'GOOD' }],
    });

    expect(result.committed).toBe(1);
    const roster = await service.getDailyCareRoster(tenantId, courseId, '2026-09-27');
    expect(roster[0].care?.arrivalStatus).toBe('PRESENT');
  });

  it('denies cross-tenant course access', async () => {
    const client = buildClient();
    const service = new DailyCareService(client as never);

    await expect(service.getDailyCareRoster(otherTenantId, courseId, '2026-09-27'))
      .rejects.toThrow('CARE_COURSE_NOT_FOUND_FOR_TENANT');
  });

  it('does not create a care record for a student outside the selected course', async () => {
    const client = buildClient();
    const service = new DailyCareService(client as never);

    const result = await service.recordBulkArrival({
      tenantId,
      courseId,
      date: '2026-09-27',
      arrivals: [{ studentPartyId: otherStudentPartyId, status: 'PRESENT' }],
    });

    expect(result.committed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(result.exceptions[0].errorMessage).toContain('CARE_STUDENT_NOT_ENROLLED_IN_COURSE');
    expect(client.state.get('edu_daily_care_records')).toHaveLength(0);
  });
});
