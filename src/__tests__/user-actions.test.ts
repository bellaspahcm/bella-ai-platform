import { createUser, deleteUser, getCurrentUser, updateBaseSalary, updateUser, updateUserStatus } from '../services/user-actions';
import { createClient as createSessionClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockAdminFrom = jest.fn();
const mockCreateAdminUser = jest.fn();
const mockDeleteAuthUser = jest.fn();
const mockPrivilegedDeleteAuthUser = jest.fn();
const mockSendTemporaryPasswordEmail = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();
const mockRecalculateAndSaveSalaryRecordEngine = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
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

jest.mock('../lib/supabase-admin', () => ({
  deleteAuthUser: (...args: unknown[]) => mockPrivilegedDeleteAuthUser(...args),
}));

jest.mock('../lib/mail', () => ({
  sendTemporaryPasswordEmail: (...args: unknown[]) => mockSendTemporaryPasswordEmail(...args),
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
    mockRpc.mockReset();
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

  function installCurrentUser() {
    mockRpc.mockResolvedValue({ data: identityRows(), error: null });
    return installScriptedSupabase([]);
  }

  function installTenantScopedSupabase(scripts: ScriptedResult[]) {
    installCurrentUser();
    return installScriptedSupabase(scripts);
  }

  function actionCalls(calls: DbCall[]) {
    return calls;
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

  function identityRows(profileOverrides: Record<string, unknown> = {}, tenant: { status: string | null } | null = { status: 'active' }) {
    return [{ id: 'admin-1', email: 'admin@bella.test', full_name: 'Admin User', avatar_url: null,
      role: 'admin', status: 'active', tenant_id: 'tenant-1', tenant_status: tenant?.status ?? null, ...profileOverrides }];
  }

  it('ignores cached profiles and rereads role and tenant on each call', async () => {
    const { getCache, setCache } = await import('../lib/redis-cache');
    jest.mocked(getCache).mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: 'old-hq' });
    mockRpc.mockResolvedValueOnce({ data: identityRows(), error: null })
      .mockResolvedValueOnce({ data: identityRows({ role: 'accountant', tenant_id: 'tenant-2' }), error: null });
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'admin', tenant_id: 'tenant-1' }));
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'accountant', tenant_id: 'tenant-2' }));
    expect(mockRpc.mock.calls).toEqual([['platform_current_actor_profile'], ['platform_current_actor_profile']]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(getCache).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
  });

  it.each([{ status: 'inactive' }, { status: null }, { tenant_id: null }, { id: 'another-auth-id' }])(
    'denies noncanonical profile %j', async (overrides) => {
      mockRpc.mockResolvedValue({ data: identityRows(overrides), error: null });
      expect(await getCurrentUser()).toBeNull();
    },
  );

  it.each(['suspended', 'terminated', null])('denies tenant status %s', async (status) => {
    mockRpc.mockResolvedValue({ data: identityRows({}, { status }), error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it('denies a missing tenant', async () => {
    mockRpc.mockResolvedValue({ data: identityRows({}, null), error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it('never falls back to matching email or a placeholder profile', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await getCurrentUser()).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('platform_current_actor_profile');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('maps canonical RLS denial to absent current authority', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    expect(await getCurrentUser()).toBeNull();
  });

  it('does not disguise database errors as an unauthenticated session', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('database unavailable') });
    await expect(getCurrentUser()).rejects.toThrow('database unavailable');
  });

  it('does not read cached or database profiles without a validated Auth actor', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does not return authority when Auth validation fails even if an actor is returned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: new Error('invalid signature') });
    await expect(getCurrentUser()).rejects.toThrow('invalid signature');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'missing Auth', actorId: null, callerRole: null, targetRole: 'ktv' },
    { label: 'admin', actorId: 'admin-1', callerRole: 'admin', targetRole: 'admin' },
    { label: 'HR', actorId: 'hr-1', callerRole: 'hr', targetRole: 'admin' },
    { label: 'manager', actorId: 'manager-1', callerRole: 'manager', targetRole: 'manager' },
    { label: 'unrecognized role', actorId: 'unknown-1', callerRole: 'arbitrary_role', targetRole: 'super_admin' },
  ])('holds createUser for $label before all identity side effects', async ({ actorId, callerRole, targetRole }) => {
    mockGetUser.mockResolvedValue({ data: { user: actorId ? { id: actorId } : null }, error: null });
    installScriptedSupabase([
      { table: 'users', op: 'select', data: { id: actorId, role: callerRole, tenant_id: 'tenant-1', status: 'active' } },
      { table: 'tenants', op: 'select', data: { status: 'active' } },
    ]);

    const result = await createUser({ ...createUserInput, role: targetRole });

    expect(result.error).toContain('IDENTITY_MANAGEMENT_AUTHORIZATION_NOT_READY');
    expect(result.data).toBeUndefined();
    expect(result.defaultPassword).toBeUndefined();
    expect(result.emailSent).toBeUndefined();
    expect(createSessionClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAdminFrom).not.toHaveBeenCalled();
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
    expect(mockDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockPrivilegedDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockSendTemporaryPasswordEmail).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'missing Auth', actorId: null, callerRole: null },
    { label: 'admin', actorId: 'admin-1', callerRole: 'admin' },
    { label: 'HR', actorId: 'hr-1', callerRole: 'hr' },
    { label: 'manager', actorId: 'manager-1', callerRole: 'manager' },
    { label: 'unrecognized role', actorId: 'unknown-1', callerRole: 'arbitrary_role' },
  ])('holds deleteUser for $label before Auth deletion or profile mutation', async ({ actorId, callerRole }) => {
    mockGetUser.mockResolvedValue({ data: { user: actorId ? { id: actorId } : null }, error: null });
    installScriptedSupabase([
      { table: 'users', op: 'select', data: { id: actorId, role: callerRole, tenant_id: 'tenant-1', status: 'active' } },
      { table: 'tenants', op: 'select', data: { status: 'active' } },
    ]);

    const result = await deleteUser('delete-user-1');

    expect(result.error).toContain('IDENTITY_MANAGEMENT_AUTHORIZATION_NOT_READY');
    expect(result.success).toBeUndefined();
    expect(createSessionClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAdminFrom).not.toHaveBeenCalled();
    expect(mockCreateAdminUser).not.toHaveBeenCalled();
    expect(mockDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockPrivilegedDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockSendTemporaryPasswordEmail).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('updates KTV base salary, recalculates salary, records audit, and revalidates', async () => {
    installTenantScopedSupabase([

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
    installTenantScopedSupabase([

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
    const calls = installTenantScopedSupabase([

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
    const calls = installTenantScopedSupabase([

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
