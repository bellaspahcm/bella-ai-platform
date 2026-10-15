import { createUser, deleteUser, getCurrentUser, updateBaseSalary, updateUser, updateUserStatus } from '../services/user-actions';

const mockFrom = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockAdminFrom = jest.fn();
const mockCreateAdminUser = jest.fn();
const mockDeleteAuthUser = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();
const mockRecalculateAndSaveSalaryRecordEngine = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
    auth: {
      admin: {
        createUser: mockCreateAdminUser,
        deleteUser: mockDeleteAuthUser,
      },
    },
  })),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

jest.mock('../modules/hr-salary/actions/salary-recalculation-engine', () => ({
  recalculateAndSaveSalaryRecordEngine: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecordEngine(...args),
}));

jest.mock('../lib/redis-cache', () => ({
  getCache: jest.fn(() => Promise.resolve(null)),
  setCache: jest.fn(() => Promise.resolve(true)),
  deleteCache: jest.fn(() => Promise.resolve(true)),
  CacheKeys: {
    user: (id: string) => `user:${id}`,
    tenant: (id: string) => `tenant:${id}`,
    ktvSessions: (id: string, d: string) => `ktv:sessions:${id}:${d}`,
    ktvEarnings: (id: string, m: string) => `ktv:earnings:${id}:${m}`,
  },
  CacheTTL: {
    short: 30,
    medium: 60,
    long: 300,
    veryLong: 3600,
  },
}));

type ScriptedResult = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  data?: unknown;
  error?: { message: string; code?: string };
};

type DbCall = {
  table: string;
  op: ScriptedResult['op'];
  payload?: unknown;
  filters: Array<{ field: string; value: unknown }>;
};

class ScriptedQueryBuilder {
  private op: ScriptedResult['op'] | '' = '';

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: DbCall[],
  ) {}

  select() {
    if (!this.op) {
      this.op = 'select';
      this.calls.push({ table: this.table, op: 'select', filters: [] });
    }
    return this;
  }

  update(payload: unknown) {
    this.op = 'update';
    this.calls.push({ table: this.table, op: 'update', payload, filters: [] });
    return this;
  }

  insert(payload: unknown) {
    this.op = 'insert';
    this.calls.push({ table: this.table, op: 'insert', payload, filters: [] });
    return this;
  }

  delete() {
    this.op = 'delete';
    this.calls.push({ table: this.table, op: 'delete', filters: [] });
    return this;
  }

  eq(field: string, value: unknown) {
    this.calls.at(-1)?.filters.push({ field, value });
    return this;
  }
  single() { return this.resolve(); }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private resolve() {
    const next = this.scripts.shift();
    if (!next) {
      throw new Error(`No scripted result for ${this.table}.${this.op}`);
    }
    if (next.table !== this.table || next.op !== this.op) {
      throw new Error(`Expected ${next.table}.${next.op}, got ${this.table}.${this.op}`);
    }
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  }
}

describe('user update audit rollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'admin-1',
            email: 'admin@bella.test',
          },
        },
      },
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          email: 'admin@bella.test',
        },
      },
      error: null,
    });
    mockCreateAdminUser.mockResolvedValue({
      data: { user: { id: 'created-user-1' } },
      error: null,
    });
    mockDeleteAuthUser.mockResolvedValue({ error: null });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
    mockRecalculateAndSaveSalaryRecordEngine.mockResolvedValue({ success: true, totalSalary: 8000000 });
  });

  function installScriptedSupabase(scripts: ScriptedResult[]) {
    const calls: DbCall[] = [];
    mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  function installScriptedAdminSupabase(scripts: ScriptedResult[]) {
    const calls: DbCall[] = [];
    mockAdminFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  function installCurrentUser() {
    return installScriptedSupabase([
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
    ]);
  }

  function currentUserScripts(): ScriptedResult[] {
    return [
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
    ];
  }

  function installTenantScopedSupabase(scripts: ScriptedResult[]) {
    return installScriptedSupabase([
      ...currentUserScripts(),
      ...scripts,
    ]);
  }

  function actionCalls(calls: DbCall[]) {
    return calls.slice(2);
  }

  const createUserInput = {
    email: 'new.user@bella.test',
    full_name: 'New User',
    role: 'manager',
  };

  it('validates the current auth user with getUser instead of trusting getSession', async () => {
    installCurrentUser();

    const result = await getCurrentUser();

    expect(result).toEqual(expect.objectContaining({
      id: 'admin-1',
      email: 'admin@bella.test',
      role: 'admin',
      tenant_id: 'tenant-1',
    }));
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  function identityScripts(profileOverrides: Record<string, unknown> = {}, tenant: unknown = { status: 'active' }): ScriptedResult[] {
    return [
      { table: 'users', op: 'select', data: { id: 'admin-1', email: 'admin@bella.test', role: 'admin',
        status: 'active', tenant_id: 'tenant-1', ...profileOverrides } },
      { table: 'tenants', op: 'select', data: tenant },
    ];
  }

  it('ignores cached profiles and rereads role and tenant on each call', async () => {
    const { getCache, setCache } = await import('../lib/redis-cache');
    jest.mocked(getCache).mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: 'old-hq' });
    const calls = installScriptedSupabase([
      ...identityScripts(), ...identityScripts({ role: 'accountant', tenant_id: 'tenant-2' }),
    ]);
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'admin', tenant_id: 'tenant-1' }));
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'accountant', tenant_id: 'tenant-2' }));
    expect(calls[3].filters).toEqual([{ field: 'id', value: 'tenant-2' }]);
    expect(getCache).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
  });

  it.each([{ status: 'inactive' }, { status: null }, { tenant_id: null }, { id: 'another-auth-id' }])(
    'denies noncanonical profile %j', async (overrides) => {
      installScriptedSupabase(identityScripts(overrides));
      expect(await getCurrentUser()).toBeNull();
    },
  );

  it.each(['suspended', 'terminated', null])('denies tenant status %s', async (status) => {
    installScriptedSupabase(identityScripts({}, { status }));
    expect(await getCurrentUser()).toBeNull();
  });

  it('denies a missing tenant', async () => {
    installScriptedSupabase(identityScripts({}, null));
    expect(await getCurrentUser()).toBeNull();
  });

  it('never falls back to matching email or a placeholder profile', async () => {
    const calls = installScriptedSupabase([{ table: 'users', op: 'select', data: null }]);
    expect(await getCurrentUser()).toBeNull();
    expect(calls).toEqual([{ table: 'users', op: 'select', filters: [{ field: 'id', value: 'admin-1' }] }]);
  });

  it('maps canonical RLS denial to absent current authority', async () => {
    installScriptedSupabase([{ table: 'users', op: 'select', error: { code: '42501', message: 'denied' } }]);
    expect(await getCurrentUser()).toBeNull();
  });

  it('does not disguise database errors as an unauthenticated session', async () => {
    installScriptedSupabase([{ table: 'users', op: 'select', error: new Error('database unavailable') }]);
    await expect(getCurrentUser()).rejects.toThrow('database unavailable');
  });

  it('does not read cached or database profiles without a validated Auth actor', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not return authority when Auth validation fails even if an actor is returned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: new Error('invalid signature') });
    await expect(getCurrentUser()).rejects.toThrow('invalid signature');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  const deletedUserSnapshot = {
    avatar_url: null,
    base_salary: 9000000,
    created_at: '2026-05-01T00:00:00.000Z',
    email: 'delete.me@bella.test',
    full_name: 'Delete Me',
    hire_date: '2026-05-01',
    id: 'delete-user-1',
    phone: '0900000000',
    resignation_date: null,
    role: 'ktv',
    status: 'active',
    tenant_id: 'tenant-1',
    updated_at: '2026-05-20T00:00:00.000Z',
  };

  const deletedStaffLeaveSnapshot = {
    approved_by: null,
    created_at: '2026-05-10T00:00:00.000Z',
    id: 'leave-1',
    leave_date: '2026-05-20',
    leave_type: 'full_day',
    reason: 'Personal',
    rejection_reason: null,
    status: 'pending',
    tenant_id: 'tenant-1',
    updated_at: '2026-05-10T00:00:00.000Z',
    user_id: 'delete-user-1',
  };

  it('creates auth user, profile row, audit log, and revalidates on success', async () => {
    installCurrentUser();
    const adminCalls = installScriptedAdminSupabase([
      {
        table: 'users',
        op: 'insert',
        data: {
          id: 'created-user-1',
          email: createUserInput.email,
          full_name: createUserInput.full_name,
          role: createUserInput.role,
          tenant_id: 'tenant-1',
          status: 'active',
        },
      },
    ]);

    const result = await createUser(createUserInput);

    expect(result.data).toEqual(expect.objectContaining({ id: 'created-user-1' }));
    expect(result.defaultPassword).toEqual(expect.stringMatching(/^Bella-.+1aA!$/));
    expect(mockCreateAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      email: createUserInput.email,
      email_confirm: true,
      user_metadata: { full_name: createUserInput.full_name },
    }));
    expect(adminCalls.map(c => c.payload)).toEqual([[
      {
        id: 'created-user-1',
        email: createUserInput.email,
        full_name: createUserInput.full_name,
        role: createUserInput.role,
        status: 'active',
        tenant_id: 'tenant-1',
      },
    ]]);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INSERT',
      table_name: 'users',
      record_id: 'created-user-1',
      new_data: {
        full_name: createUserInput.full_name,
        email: createUserInput.email,
        role: createUserInput.role,
      },
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('rolls back auth user when profile insert fails', async () => {
    installCurrentUser();
    installScriptedAdminSupabase([
      { table: 'users', op: 'insert', error: { message: 'profile insert failed' } },
    ]);

    const result = await createUser(createUserInput);

    expect(result.error).toContain('profile insert failed');
    expect(mockDeleteAuthUser).toHaveBeenCalledWith('created-user-1');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports auth rollback failure when profile insert fails', async () => {
    installCurrentUser();
    installScriptedAdminSupabase([
      { table: 'users', op: 'insert', error: { message: 'profile insert failed' } },
    ]);
    mockDeleteAuthUser.mockResolvedValue({ error: { message: 'auth delete failed' } });

    const result = await createUser(createUserInput);

    expect(result.error).toContain('profile insert failed');
    expect(result.error).toContain('auth rollback failed: auth delete failed');
  });

  it('rolls back profile and auth user when create audit logging fails', async () => {
    installCurrentUser();
    const adminCalls = installScriptedAdminSupabase([
      {
        table: 'users',
        op: 'insert',
        data: {
          id: 'created-user-1',
          email: createUserInput.email,
          full_name: createUserInput.full_name,
          role: createUserInput.role,
          tenant_id: 'tenant-1',
          status: 'active',
        },
      },
      { table: 'users', op: 'delete' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await createUser(createUserInput);

    expect(result.error).toContain('audit failed');
    expect(adminCalls.map(c => ({ op: c.op, payload: c.payload }))).toEqual([
      {
        op: 'insert',
        payload: [{
          id: 'created-user-1',
          email: createUserInput.email,
          full_name: createUserInput.full_name,
          role: createUserInput.role,
          status: 'active',
          tenant_id: 'tenant-1',
        }],
      },
      { op: 'delete', payload: undefined },
    ]);
    expect(mockDeleteAuthUser).toHaveBeenCalledWith('created-user-1');
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports cleanup failures when create audit rollback fails', async () => {
    installCurrentUser();
    installScriptedAdminSupabase([
      {
        table: 'users',
        op: 'insert',
        data: {
          id: 'created-user-1',
          email: createUserInput.email,
          full_name: createUserInput.full_name,
          role: createUserInput.role,
          tenant_id: 'tenant-1',
          status: 'active',
        },
      },
      { table: 'users', op: 'delete', error: { message: 'profile delete failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));
    mockDeleteAuthUser.mockResolvedValue({ error: { message: 'auth delete failed' } });

    const result = await createUser(createUserInput);

    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('profile rollback failed: profile delete failed');
    expect(result.error).toContain('auth rollback failed: auth delete failed');
  });

  it('deletes user and records old audit data on success', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: deletedUserSnapshot },
      { table: 'staff_leaves', op: 'select', data: [] },
      { table: 'users', op: 'update' },
    ]);

    const result = await deleteUser('delete-user-1');

    expect(result).toEqual({
      success: true,
      message: 'Nhân sự đã được đánh dấu nghỉ việc.',
    });
    expect(actionCalls(calls).map(c => `${c.table}.${c.op}`)).toEqual([
      'users.select',
      'staff_leaves.select',
      'users.update',
    ]);
    expect(actionCalls(calls)[0].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'delete-user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(actionCalls(calls)[1].filters).toEqual(expect.arrayContaining([
      { field: 'user_id', value: 'delete-user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(actionCalls(calls)[2].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'delete-user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'users',
      record_id: 'delete-user-1',
      old_data: expect.any(Object),
      new_data: expect.objectContaining({
        resignation_date: expect.any(String),
      }),
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('does not delete user when delete snapshot fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', error: { message: 'snapshot failed' } },
    ]);

    const result = await deleteUser('delete-user-1');

    expect(result.error).toContain('snapshot failed');
    expect(actionCalls(calls).map(c => c.op)).toEqual(['select']);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it.skip('restores deleted user when delete audit logging fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: deletedUserSnapshot },
      { table: 'staff_leaves', op: 'select', data: [deletedStaffLeaveSnapshot] },
      { table: 'users', op: 'delete' },
      { table: 'users', op: 'insert' },
      { table: 'staff_leaves', op: 'insert' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await deleteUser('delete-user-1');

    expect(result.error).toContain('audit failed');
    expect(actionCalls(calls).map(c => ({ table: c.table, op: c.op, payload: c.payload }))).toEqual([
      { table: 'users', op: 'select', payload: undefined },
      { table: 'staff_leaves', op: 'select', payload: undefined },
      { table: 'users', op: 'delete', payload: undefined },
      { table: 'users', op: 'insert', payload: [deletedUserSnapshot] },
      { table: 'staff_leaves', op: 'insert', payload: [deletedStaffLeaveSnapshot] },
    ]);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it.skip('reports restore failure when delete audit rollback fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: deletedUserSnapshot },
      { table: 'staff_leaves', op: 'select', data: [deletedStaffLeaveSnapshot] },
      { table: 'users', op: 'delete' },
      { table: 'users', op: 'insert', error: { message: 'restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await deleteUser('delete-user-1');

    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('restore failed: restore failed');
    expect(actionCalls(calls).map(c => `${c.table}.${c.op}`)).toEqual([
      'users.select',
      'staff_leaves.select',
      'users.delete',
      'users.insert',
    ]);
  });

  it.skip('reports staff leave restore failure when delete audit rollback partially fails', async () => {
    installTenantScopedSupabase([
      { table: 'users', op: 'select', data: deletedUserSnapshot },
      { table: 'staff_leaves', op: 'select', data: [deletedStaffLeaveSnapshot] },
      { table: 'users', op: 'delete' },
      { table: 'users', op: 'insert' },
      { table: 'staff_leaves', op: 'insert', error: { message: 'staff leave restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await deleteUser('delete-user-1');

    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('staff leaves restore failed: staff leave restore failed');
  });

  it('updates KTV base salary, recalculates salary, records audit, and revalidates', async () => {
    installScriptedSupabase([
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
      { table: 'users', op: 'select', data: { base_salary: 6000000, role: 'ktv', tenant_id: 'tenant-1' } },
      { table: 'users', op: 'update' },
    ]);

    const result = await updateBaseSalary('ktv-1', 8000000);

    expect(result).toEqual({ success: true });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledWith(
      expect.anything(),
      'ktv-1',
      expect.stringMatching(/^\d{4}-\d{2}-01$/),
      'tenant-1',
    );
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'users',
      record_id: 'ktv-1',
      old_data: { base_salary: 6000000 },
      new_data: { base_salary: 8000000 },
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('updates non-KTV base salary without salary recalculation', async () => {
    installScriptedSupabase([
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
      { table: 'users', op: 'select', data: { base_salary: 7000000, role: 'manager', tenant_id: 'tenant-1' } },
      { table: 'users', op: 'update' },
    ]);

    const result = await updateBaseSalary('manager-1', 9000000);

    expect(result).toEqual({ success: true });
    expect(mockRecalculateAndSaveSalaryRecordEngine).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      old_data: { base_salary: 7000000 },
      new_data: { base_salary: 9000000 },
    }));
  });

  it('rolls back KTV base salary when salary recalculation fails', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
      { table: 'users', op: 'select', data: { base_salary: 6000000, role: 'ktv', tenant_id: 'tenant-1' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine
      .mockRejectedValueOnce(new Error('salary recalc failed'))
      .mockResolvedValueOnce({ success: true, totalSalary: 6000000 });

    const result = await updateBaseSalary('ktv-1', 8000000);

    expect(result.error).toContain('salary recalc failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { base_salary: 8000000 },
      { base_salary: 6000000 },
    ]);
    expect(calls.filter(c => c.table === 'users' && c.op === 'update')[0].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'ktv-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(calls.filter(c => c.table === 'users' && c.op === 'update')[1].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'ktv-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back KTV base salary and recalculates old salary when audit logging fails', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'users',
        op: 'select',
        data: {
          id: 'admin-1',
          email: 'admin@bella.test',
          full_name: 'Admin User',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-1',
          avatar_url: null,
        },
      },
      { table: 'tenants', op: 'select', data: { status: 'active', name: 'Bella Test' } },
      { table: 'users', op: 'select', data: { base_salary: 6000000, role: 'ktv', tenant_id: 'tenant-1' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateBaseSalary('ktv-1', 8000000);

    expect(result.error).toContain('audit failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { base_salary: 8000000 },
      { base_salary: 6000000 },
    ]);
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledTimes(2);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('updates user status and records old/new audit data on success', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
    ]);

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result).toEqual({ success: true });
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
    ]);
    expect(calls.filter(c => c.table === 'users' && c.op === 'update')[0].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'users',
      record_id: 'user-1',
      old_data: { status: 'active' },
      new_data: { status: 'inactive' },
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('rolls back user status when audit logging fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result.error).toContain('audit failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
      { status: 'active' },
    ]);
    expect(calls.filter(c => c.table === 'users' && c.op === 'update')[1].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when user status audit rollback fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update', error: { message: 'rollback failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('rollback failed: rollback failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
      { status: 'active' },
    ]);
  });

  it('rolls back user profile fields when audit logging fails', async () => {
    const calls = installTenantScopedSupabase([
      { table: 'users', op: 'select', data: { full_name: 'Old Name', role: 'ktv' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUser('user-1', { full_name: 'New Name', role: 'manager' });

    expect(result.error).toContain('audit failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { full_name: 'New Name', role: 'manager' },
      { full_name: 'Old Name', role: 'ktv' },
    ]);
    expect(calls.filter(c => c.table === 'users' && c.op === 'update')[1].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'user-1' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });
});
