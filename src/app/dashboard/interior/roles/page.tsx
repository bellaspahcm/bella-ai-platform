'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';

type RoleScope = 'TENANT' | 'BRANCH' | 'PROJECT' | 'SELF';

type RolePermission = {
  permission_id: string;
  module_key: string;
  action_key: string;
  description: string;
  sensitive: boolean;
};

type Role = {
  role_key: string;
  display_name: string;
  responsibility: string;
  permissions: string[];
};

type RoleAssignment = {
  assignment_id: string;
  role_key: string;
  scope_type: RoleScope;
  scope_id: string | null;
  status: string;
};

type EffectivePermission = {
  permission_id: string;
  source: 'ROLE' | 'DIRECT_GRANT';
  role_key: string | null;
  scope_type: RoleScope;
  scope_id: string | null;
};

type DirectGrant = {
  grant_id: string;
  permission_id: string;
  scope_type: RoleScope;
  scope_id: string | null;
  status: string;
};

type Delegation = {
  delegation_id: string;
  role_key: string;
  status: string;
};

type InteriorUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  status: string;
  roles: RoleAssignment[];
  project_ids: string[];
  direct_grants: DirectGrant[];
  effective_permissions: EffectivePermission[];
  admin_role_delegations: Delegation[];
};

type ScopeOption = { id: string; name: string; code?: string | null };

type Catalog = {
  roles: Role[];
  permissions: RolePermission[];
  branches: ScopeOption[];
  projects: Array<ScopeOption & { branch_id: string | null }>;
  is_owner: boolean;
  can_manage_branches: boolean;
  can_manage_users: boolean;
  can_assign_roles: boolean;
};

type AuditEvent = {
  id?: string;
  event_type?: string;
  actor_user_id?: string;
  target_user_id?: string | null;
  role_key?: string | null;
  permission_id?: string | null;
  scope_type?: string | null;
  scope_id?: string | null;
  recorded_at?: string;
  count?: number;
  latest_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function decodeRole(value: unknown): Role | null {
  if (!isRecord(value)) return null;
  const role_key = stringValue(value.role_key);
  const display_name = stringValue(value.display_name);
  const responsibility = stringValue(value.responsibility);
  if (!role_key || !display_name || !responsibility) return null;
  return { role_key, display_name, responsibility, permissions: stringList(value.permissions) };
}

function decodePermission(value: unknown): RolePermission | null {
  if (!isRecord(value)) return null;
  const permission_id = stringValue(value.permission_id);
  const module_key = stringValue(value.module_key);
  const action_key = stringValue(value.action_key);
  const description = stringValue(value.description);
  if (!permission_id || !module_key || !action_key || !description) return null;
  return { permission_id, module_key, action_key, description, sensitive: value.sensitive === true };
}

function decodeScopeOptions(value: unknown): ScopeOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = stringValue(item.id);
    const name = stringValue(item.name);
    if (!id || !name) return [];
    return [{ id, name, code: stringValue(item.code) }];
  });
}

function decodeCatalog(value: unknown): Catalog | null {
  if (!isRecord(value)) return null;
  const roles = Array.isArray(value.roles) ? value.roles.flatMap((item) => {
    const role = decodeRole(item);
    return role ? [role] : [];
  }) : [];
  const permissions = Array.isArray(value.permissions) ? value.permissions.flatMap((item) => {
    const permission = decodePermission(item);
    return permission ? [permission] : [];
  }) : [];
  const projects = decodeScopeOptions(value.projects).map((option, index) => {
    const raw = Array.isArray(value.projects) && isRecord(value.projects[index]) ? value.projects[index] : null;
    return { ...option, branch_id: raw ? stringValue(raw.branch_id) : null };
  });
  return {
    roles,
    permissions,
    branches: decodeScopeOptions(value.branches),
    projects,
    is_owner: value.is_owner === true,
    can_manage_branches: value.can_manage_branches === true,
    can_manage_users: value.can_manage_users === true,
    can_assign_roles: value.can_assign_roles === true,
  };
}

function decodeAssignments(value: unknown): RoleAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const assignment_id = stringValue(item.assignment_id);
    const role_key = stringValue(item.role_key);
    const scope_type = stringValue(item.scope_type);
    const status = stringValue(item.status);
    if (!assignment_id || !role_key || !status || !scope_type) return [];
    if (!['TENANT', 'BRANCH', 'PROJECT', 'SELF'].includes(scope_type)) return [];
    return [{ assignment_id, role_key, status, scope_type: scope_type as RoleScope, scope_id: stringValue(item.scope_id) }];
  });
}

function decodeEffectivePermissions(value: unknown): EffectivePermission[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const permission_id = stringValue(item.permission_id);
    const source = stringValue(item.source);
    const scope_type = stringValue(item.scope_type);
    if (!permission_id || !scope_type || (source !== 'ROLE' && source !== 'DIRECT_GRANT')) return [];
    if (!['TENANT', 'BRANCH', 'PROJECT', 'SELF'].includes(scope_type)) return [];
    return [{ permission_id, source, role_key: stringValue(item.role_key), scope_type: scope_type as RoleScope, scope_id: stringValue(item.scope_id) }];
  });
}

function decodeUsers(value: unknown): InteriorUser[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const user_id = stringValue(item.user_id);
    const email = stringValue(item.email);
    const status = stringValue(item.status);
    if (!user_id || !email || !status) return [];
    const direct_grants = Array.isArray(item.direct_grants) ? item.direct_grants.flatMap((grant) => {
      if (!isRecord(grant)) return [];
      const grant_id = stringValue(grant.grant_id);
      const permission_id = stringValue(grant.permission_id);
      const scope_type = stringValue(grant.scope_type);
      const grantStatus = stringValue(grant.status);
      if (!grant_id || !permission_id || !scope_type || !grantStatus || !['TENANT', 'BRANCH', 'PROJECT', 'SELF'].includes(scope_type)) return [];
      return [{ grant_id, permission_id, scope_type: scope_type as RoleScope, scope_id: stringValue(grant.scope_id), status: grantStatus }];
    }) : [];
    const delegations = Array.isArray(item.admin_role_delegations) ? item.admin_role_delegations.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const delegation_id = stringValue(entry.delegation_id);
      const role_key = stringValue(entry.role_key);
      const entryStatus = stringValue(entry.status);
      return delegation_id && role_key && entryStatus ? [{ delegation_id, role_key, status: entryStatus }] : [];
    }) : [];
    return [{
      user_id,
      email,
      full_name: stringValue(item.full_name),
      status,
      roles: decodeAssignments(item.roles),
      project_ids: stringList(item.project_ids),
      direct_grants,
      effective_permissions: decodeEffectivePermissions(item.effective_permissions),
      admin_role_delegations: delegations,
    }];
  });
}

function decodeAuditEvents(value: unknown): AuditEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      ...(stringValue(item.id) ? { id: stringValue(item.id) ?? undefined } : {}),
      ...(stringValue(item.event_type) ? { event_type: stringValue(item.event_type) ?? undefined } : {}),
      ...(stringValue(item.actor_user_id) ? { actor_user_id: stringValue(item.actor_user_id) ?? undefined } : {}),
      ...(stringValue(item.target_user_id) ? { target_user_id: stringValue(item.target_user_id) } : {}),
      ...(stringValue(item.role_key) ? { role_key: stringValue(item.role_key) ?? undefined } : {}),
      ...(stringValue(item.permission_id) ? { permission_id: stringValue(item.permission_id) ?? undefined } : {}),
      ...(stringValue(item.scope_type) ? { scope_type: stringValue(item.scope_type) ?? undefined } : {}),
      ...(stringValue(item.scope_id) ? { scope_id: stringValue(item.scope_id) ?? undefined } : {}),
      ...(stringValue(item.recorded_at) ? { recorded_at: stringValue(item.recorded_at) ?? undefined } : {}),
      ...(typeof item.count === 'number' ? { count: item.count } : {}),
      ...(stringValue(item.latest_at) ? { latest_at: stringValue(item.latest_at) ?? undefined } : {}),
    }];
  });
}

async function requestApi(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(path, { ...init, cache: 'no-store' });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Không đọc được phản hồi từ máy chủ.');
  }
  if (!response.ok || !isRecord(result) || result.success !== true) {
    const reason = isRecord(result) ? stringValue(result.reason) : null;
    const error = isRecord(result) ? stringValue(result.error) : null;
    throw new Error(reason ? `${error ?? 'Thao tác bị từ chối'}: ${reason}` : error ?? 'Không thể hoàn thành thao tác.');
  }
  return result;
}

function scopeLabel(scopeType: string, scopeId: string | null, catalog: Catalog): string {
  if (scopeType === 'TENANT') return 'Toàn doanh nghiệp';
  if (scopeType === 'SELF') return 'Dự án được giao cho cá nhân';
  const options = scopeType === 'BRANCH' ? catalog.branches : catalog.projects;
  return options.find((option) => option.id === scopeId)?.name ?? `${scopeType}: ${scopeId ?? '—'}`;
}

function scopeEndpointId(scopeType: RoleScope): string | null {
  return scopeType === 'TENANT' || scopeType === 'SELF' ? null : 'required';
}

export default function InteriorRoleManagementPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [users, setUsers] = useState<InteriorUser[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [scopeType, setScopeType] = useState<RoleScope>('PROJECT');
  const [scopeId, setScopeId] = useState('');
  const [membershipProjectId, setMembershipProjectId] = useState('');
  const [grantPermission, setGrantPermission] = useState('');
  const [grantScopeType, setGrantScopeType] = useState<RoleScope>('PROJECT');
  const [grantScopeId, setGrantScopeId] = useState('');
  const [delegateAdminId, setDelegateAdminId] = useState('');
  const [delegateRoleKey, setDelegateRoleKey] = useState('');
  const [branchProjectId, setBranchProjectId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRoleKey, setInviteRoleKey] = useState('SALES');
  const [inviteScopeType, setInviteScopeType] = useState<RoleScope>('TENANT');
  const [inviteScopeId, setInviteScopeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogResponse, userResponse, auditResponse] = await Promise.all([
        requestApi('/api/interior/rbac'),
        requestApi('/api/interior/users'),
        requestApi('/api/interior/rbac/audit'),
      ]);
      const nextCatalog = decodeCatalog(catalogResponse.catalog);
      if (!nextCatalog) throw new Error('Role catalog trả về dữ liệu không hợp lệ.');
      const nextUsers = decodeUsers(userResponse.users);
      setCatalog(nextCatalog);
      setUsers(nextUsers);
      setAudit(decodeAuditEvents(auditResponse.events));
      setSelectedUserId((current) => current || nextUsers[0]?.user_id || '');
      setRoleKey((current) => current || nextCatalog.roles[0]?.role_key || '');
      setGrantPermission((current) => current || nextCatalog.permissions.find((item) => ![
        'interior:users:manage','interior:roles:assign','interior:roles:manage',
        'interior:company:manage','interior:branch:manage','interior:audit:read','interior:audit:read_limited',
      ].includes(item.permission_id))?.permission_id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải cấu hình RBAC.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedUser = useMemo(() => users.find((user) => user.user_id === selectedUserId) ?? null, [users, selectedUserId]);
  const scopeOptions = scopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];
  const grantScopeOptions = grantScopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];
  const inviteScopeOptions = inviteScopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];
  const activeAdmins = users.filter((user) => user.status.toLowerCase() === 'active'
    && user.roles.some((assignment) => assignment.role_key === 'ADMIN' && assignment.status === 'ACTIVE'));
  const directGrantablePermissions = (catalog?.permissions ?? []).filter((permission) => ![
    'interior:users:manage','interior:roles:assign','interior:roles:manage',
    'interior:company:manage','interior:branch:manage','interior:audit:read','interior:audit:read_limited',
  ].includes(permission.permission_id));

  async function submit(event: FormEvent<HTMLFormElement>, path: string, body: Record<string, unknown>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestApi(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu thay đổi.');
    } finally {
      setSaving(false);
    }
  }

  async function revoke(path: string, body?: Record<string, unknown>): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await requestApi(path, {
        method: 'DELETE',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thu hồi quyền.');
    } finally {
      setSaving(false);
    }
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestApi('/api/interior/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteFullName,
          role_key: inviteRoleKey,
          scope_type: inviteScopeType,
          scope_id: inviteScopeType === 'TENANT' || inviteScopeType === 'SELF' ? null : inviteScopeId,
        }),
      });
      setInviteEmail('');
      setInviteFullName('');
      setInviteScopeId('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể mời nhân viên.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !catalog) {
    return <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tải ma trận quyền...</div>;
  }

  if (!catalog) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vai trò & phân quyền Interior</h1>
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div>
            <strong>Chưa thể tải RBAC.</strong>
            <p className="mt-1">{error ?? 'Tài khoản hiện tại chưa có quyền xem role catalog. OWNER cần được bootstrap bằng một tài khoản thật đã xác minh.'}</p>
          </div></div>
          <button onClick={() => void refresh()} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" />Thử lại</button>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Bella Interior</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Role & Permission Matrix</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Vai trò, action permission và project scope được kiểm tra lại ở database. Quyền ghi không tự cấp quyền duyệt hoặc thực hiện nghiệp vụ nhạy cảm.</p>
        </div>
        <button disabled={loading} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Làm mới
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-bold">Danh mục 12 vai trò</h2></div>
          <div className="mt-4 space-y-3">
            {catalog.roles.map((role) => (
              <details key={role.role_key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <summary className="cursor-pointer list-none">
                  <span className="flex flex-wrap items-center justify-between gap-2"><strong>{role.display_name}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{role.role_key}</span></span>
                  <span className="mt-1 block text-xs text-slate-500">{role.responsibility}</span>
                </summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => {
                    const entry = catalog.permissions.find((item) => item.permission_id === permission);
                    return <span key={permission} title={entry?.description ?? permission} className={`rounded-md border px-2 py-1 text-[10px] ${entry?.sensitive ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>{permission.replace('interior:', '')}</span>;
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Nhân viên và phạm vi</h2><p className="mt-1 text-xs text-slate-500">Tài khoản mới được mời qua Supabase Auth và nhận role/scope Interior trong cùng thao tác.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{users.length} tài khoản</span></div>

          {catalog.can_manage_users && <form className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:grid-cols-2" onSubmit={(event) => void inviteUser(event)}>
            <div className="sm:col-span-2"><strong className="text-sm">Mời nhân viên thật</strong><p className="mt-1 text-xs text-slate-500">Gửi lời mời email, tạo hồ sơ cùng tenant và gán role ban đầu. Không dùng mật khẩu mặc định hoặc tự cấp quyền theo domain.</p></div>
            <label className="text-xs font-semibold">Email<input required type="email" autoComplete="email" maxLength={320} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-xs font-semibold">Họ tên<input required autoComplete="name" maxLength={160} value={inviteFullName} onChange={(event) => setInviteFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-xs font-semibold">Vai trò ban đầu<select required value={inviteRoleKey} onChange={(event) => setInviteRoleKey(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              {catalog.roles.filter((role) => catalog.is_owner || role.role_key !== 'OWNER').map((role) => <option key={role.role_key} value={role.role_key}>{role.role_key} — {role.display_name}</option>)}
            </select></label>
            <label className="text-xs font-semibold">Scope<select value={inviteScopeType} onChange={(event) => { setInviteScopeType(event.target.value as RoleScope); setInviteScopeId(''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="TENANT">TENANT — toàn doanh nghiệp</option><option value="BRANCH">BRANCH — chi nhánh</option><option value="PROJECT">PROJECT — dự án</option><option value="SELF">SELF — chỉ dự án được giao</option>
            </select></label>
            {(inviteScopeType === 'BRANCH' || inviteScopeType === 'PROJECT') && <label className="text-xs font-semibold sm:col-span-2">{inviteScopeType === 'BRANCH' ? 'Chi nhánh' : 'Dự án'}<select required value={inviteScopeId} onChange={(event) => setInviteScopeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Chọn phạm vi</option>{inviteScopeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}{option.code ? ` · ${option.code}` : ''}</option>)}
            </select></label>}
            <button disabled={saving || !inviteEmail || !inviteFullName || !inviteRoleKey || ((inviteScopeType === 'BRANCH' || inviteScopeType === 'PROJECT') && !inviteScopeId)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Gửi lời mời và gán role
            </button>
          </form>}

          {catalog.can_assign_roles && <form className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60 sm:grid-cols-2" onSubmit={(event) => void submit(event, '/api/interior/users/roles', {
            target_user_id: selectedUserId,
            role_key: roleKey,
            scope_type: scopeType,
            scope_id: scopeEndpointId(scopeType) === null ? null : scopeId,
          })}>
            <label className="text-xs font-semibold">Tài khoản<select required value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Chọn nhân viên</option>{users.filter((user) => user.status.toLowerCase() === 'active').map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name || user.email} — {user.email}</option>)}
            </select></label>
            <label className="text-xs font-semibold">Vai trò<select required value={roleKey} onChange={(event) => setRoleKey(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              {catalog.roles.map((role) => <option key={role.role_key} value={role.role_key}>{role.role_key} — {role.display_name}</option>)}
            </select></label>
            <label className="text-xs font-semibold">Scope<select value={scopeType} onChange={(event) => { setScopeType(event.target.value as RoleScope); setScopeId(''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="TENANT">TENANT — toàn doanh nghiệp</option><option value="BRANCH">BRANCH — chi nhánh</option><option value="PROJECT">PROJECT — dự án</option><option value="SELF">SELF — dự án được giao cá nhân</option>
            </select></label>
            {scopeEndpointId(scopeType) !== null && <label className="text-xs font-semibold">{scopeType === 'BRANCH' ? 'Chi nhánh' : 'Dự án'}<select required value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Chọn phạm vi</option>{scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}{option.code ? ` · ${option.code}` : ''}</option>)}
            </select></label>}
            <button disabled={saving || !selectedUserId || !roleKey || (scopeEndpointId(scopeType) !== null && !scopeId)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Gán vai trò
            </button>
          </form>}

          {scopeType === 'SELF' && <form className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700" onSubmit={(event) => void submit(event, '/api/interior/users/project-assignments', { user_id: selectedUserId, project_id: membershipProjectId })}>
            <label className="min-w-64 flex-1 text-xs font-semibold">Gán dự án trực tiếp để SELF có hiệu lực<select required value={membershipProjectId} onChange={(event) => setMembershipProjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Chọn dự án</option>{catalog.projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.code ?? project.id}</option>)}
            </select></label><button disabled={saving || !selectedUserId || !membershipProjectId} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Gán dự án SELF</button>
          </form>}

          <div className="mt-4 max-h-[36rem] space-y-3 overflow-auto pr-1">
            {users.map((user) => (
              <article key={user.user_id} className={`rounded-xl border p-4 ${user.user_id === selectedUserId ? 'border-amber-400 dark:border-amber-700' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setSelectedUserId(user.user_id)} className="min-w-0 text-left">
                    <strong className="block truncate text-sm">{user.full_name || user.email}</strong><span className="block truncate text-xs text-slate-500">{user.email} · {user.status}</span>
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {user.roles.length === 0 && <p className="text-xs text-slate-500">Chưa có Interior role assignment.</p>}
                  {user.roles.map((assignment) => <div key={assignment.assignment_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900">
                    <span><strong>{assignment.role_key}</strong><span className="ml-2 text-slate-500">{scopeLabel(assignment.scope_type, assignment.scope_id, catalog)}</span><span className={`ml-2 ${assignment.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-400'}`}>{assignment.status}</span></span>
                    {assignment.status === 'ACTIVE' && <button type="button" disabled={saving} onClick={() => void revoke(`/api/interior/users/roles/${assignment.assignment_id}`)} aria-label={`Thu hồi ${assignment.role_key}`} className="rounded-md p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"><X className="h-4 w-4" /></button>}
                  </div>)}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">Quyền hiệu lực ({user.effective_permissions.length})</summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.effective_permissions.map((permission, index) => <span key={`${permission.permission_id}-${permission.source}-${permission.scope_type}-${index}`} title={`${permission.source}${permission.role_key ? ` · ${permission.role_key}` : ''} · ${scopeLabel(permission.scope_type, permission.scope_id, catalog)}`} className="rounded bg-slate-100 px-1.5 py-1 text-[10px] dark:bg-slate-800">{permission.permission_id.replace('interior:', '')}</span>)}
                    {user.effective_permissions.length === 0 && <span className="text-xs text-slate-500">Không có quyền hiệu lực.</span>}
                  </div>
                </details>
                {user.project_ids.length > 0 && <p className="mt-2 text-[11px] text-slate-500">Dự án SELF: {user.project_ids.map((id) => catalog.projects.find((project) => project.id === id)?.name ?? id).join(', ')}</p>}
                {user.direct_grants.map((grant) => <div key={grant.grant_id} className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-100 px-3 py-2 text-[11px] dark:border-rose-950">
                  <span>{grant.permission_id} · {scopeLabel(grant.scope_type, grant.scope_id, catalog)} · {grant.status}</span>
                  {catalog.is_owner && grant.status === 'ACTIVE' && <button type="button" disabled={saving} onClick={() => void revoke(`/api/interior/users/direct-grants/${grant.grant_id}`)} className="text-rose-700 disabled:opacity-50">Thu hồi</button>}
                </div>)}
                {catalog.is_owner && user.admin_role_delegations.map((delegation) => <div key={delegation.delegation_id} className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-violet-100 px-3 py-2 text-[11px] dark:border-violet-950">
                  <span>ADMIN được gán {delegation.role_key} · {delegation.status}</span>
                  {delegation.status === 'ACTIVE' && <button type="button" disabled={saving} onClick={() => void revoke('/api/interior/users/delegations', { admin_user_id: user.user_id, role_key: delegation.role_key })} className="text-rose-700 disabled:opacity-50">Thu hồi</button>}
                </div>)}
              </article>
            ))}
          </div>
        </div>
      </section>

      {catalog.can_manage_branches && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-base font-bold">Gán dự án vào chi nhánh</h2>
        <p className="mt-1 text-xs text-slate-500">Branch scope chỉ bao phủ dự án có chi nhánh đang hoạt động cùng tenant. Thay đổi được ghi vào audit log.</p>
        <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void submit(event, `/api/interior/projects/${branchProjectId}/branch`, { branch_id: branchId || null })}>
          <select required value={branchProjectId} onChange={(event) => {
            setBranchProjectId(event.target.value);
            const selectedProject = catalog.projects.find((project) => project.id === event.target.value);
            setBranchId(selectedProject?.branch_id ?? '');
          }} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Chọn dự án</option>{catalog.projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.code ?? project.id}</option>)}</select>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Không gán chi nhánh</option>{catalog.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? ` · ${branch.code}` : ''}</option>)}</select>
          <button disabled={saving || !branchProjectId} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">Lưu phạm vi</button>
        </form>
      </section>}

      {catalog.is_owner && <section className="grid gap-4 lg:grid-cols-2">
        <form className="rounded-2xl border border-violet-200 bg-white p-5 dark:border-violet-950 dark:bg-slate-950" onSubmit={(event) => void submit(event, '/api/interior/users/delegations', { admin_user_id: delegateAdminId, role_key: delegateRoleKey })}>
          <h2 className="text-base font-bold">Ủy quyền role cho ADMIN</h2><p className="mt-1 text-xs text-slate-500">ADMIN chỉ được gán những role được OWNER ủy quyền. OWNER không thể được ủy quyền.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select required value={delegateAdminId} onChange={(event) => setDelegateAdminId(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Chọn ADMIN</option>{activeAdmins.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name || user.email}</option>)}</select>
            <select required value={delegateRoleKey} onChange={(event) => setDelegateRoleKey(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Role được gán</option>{catalog.roles.filter((role) => role.role_key !== 'OWNER').map((role) => <option key={role.role_key} value={role.role_key}>{role.role_key}</option>)}</select>
          </div><button disabled={saving || !delegateAdminId || !delegateRoleKey} className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Ủy quyền</button>
        </form>

        <form className="rounded-2xl border border-rose-200 bg-white p-5 dark:border-rose-950 dark:bg-slate-950" onSubmit={(event) => void submit(event, '/api/interior/users/direct-grants', {
          target_user_id: selectedUserId,
          permission_id: grantPermission,
          scope_type: grantScopeType,
          scope_id: grantScopeType === 'TENANT' || grantScopeType === 'SELF' ? null : grantScopeId,
        })}>
          <h2 className="text-base font-bold">Direct permission grant</h2><p className="mt-1 text-xs text-slate-500">OWNER-only. Không vượt qua tenant, branch, project hoặc SELF scope.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select required value={grantPermission} onChange={(event) => setGrantPermission(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">{directGrantablePermissions.map((permission) => <option key={permission.permission_id} value={permission.permission_id}>{permission.permission_id}</option>)}</select>
            <select value={grantScopeType} onChange={(event) => { setGrantScopeType(event.target.value as RoleScope); setGrantScopeId(''); }} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="TENANT">TENANT</option><option value="BRANCH">BRANCH</option><option value="PROJECT">PROJECT</option><option value="SELF">SELF</option></select>
            {(grantScopeType === 'BRANCH' || grantScopeType === 'PROJECT') && <select required value={grantScopeId} onChange={(event) => setGrantScopeId(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:col-span-2"><option value="">Chọn phạm vi</option>{grantScopeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}
          </div><button disabled={saving || !selectedUserId || !grantPermission || ((grantScopeType === 'BRANCH' || grantScopeType === 'PROJECT') && !grantScopeId)} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Cấp quyền bổ sung</button>
        </form>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-base font-bold">Lịch sử thay đổi quyền</h2>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {audit.map((event, index) => <div key={event.id ?? `${event.event_type}-${event.latest_at}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
            <span><strong>{event.event_type ?? 'Thay đổi quyền'}</strong>{event.role_key ? ` · ${event.role_key}` : ''}{event.permission_id ? ` · ${event.permission_id}` : ''}{typeof event.count === 'number' ? ` · ${event.count} lần` : ''}</span>
            <time className="text-slate-500">{event.recorded_at ?? event.latest_at ?? ''}</time>
          </div>)}
          {audit.length === 0 && <p className="py-3 text-xs text-slate-500">Chưa có thay đổi quyền được ghi nhận.</p>}
        </div>
      </section>
    </main>
  );
}
