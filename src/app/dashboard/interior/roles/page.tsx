'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Home,
  LayoutGrid,
  LoaderCircle,
  Lock,
  MoreVertical,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';

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

type RevokeTarget = {
  path: string;
  body?: Record<string, unknown>;
  title: string;
  userName: string;
  roleOrPermission: string;
  scopeText: string;
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
  const roles = Array.isArray(value.roles)
    ? value.roles.flatMap((item) => {
        const role = decodeRole(item);
        return role ? [role] : [];
      })
    : [];
  const permissions = Array.isArray(value.permissions)
    ? value.permissions.flatMap((item) => {
        const permission = decodePermission(item);
        return permission ? [permission] : [];
      })
    : [];
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
    const direct_grants = Array.isArray(item.direct_grants)
      ? item.direct_grants.flatMap((grant) => {
          if (!isRecord(grant)) return [];
          const grant_id = stringValue(grant.grant_id);
          const permission_id = stringValue(grant.permission_id);
          const scope_type = stringValue(grant.scope_type);
          const grantStatus = stringValue(grant.status);
          if (!grant_id || !permission_id || !scope_type || !grantStatus || !['TENANT', 'BRANCH', 'PROJECT', 'SELF'].includes(scope_type)) return [];
          return [{ grant_id, permission_id, scope_type: scope_type as RoleScope, scope_id: stringValue(grant.scope_id), status: grantStatus }];
        })
      : [];
    const delegations = Array.isArray(item.admin_role_delegations)
      ? item.admin_role_delegations.flatMap((entry) => {
          if (!isRecord(entry)) return [];
          const delegation_id = stringValue(entry.delegation_id);
          const role_key = stringValue(entry.role_key);
          const entryStatus = stringValue(entry.status);
          return delegation_id && role_key && entryStatus ? [{ delegation_id, role_key, status: entryStatus }] : [];
        })
      : [];
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

function scopeLabel(scopeType: string, scopeId: string | null, catalog: Catalog | null): string {
  if (scopeType === 'TENANT') return 'Toàn doanh nghiệp';
  if (scopeType === 'SELF') return 'Dự án cá nhân (SELF)';
  if (!catalog) return `${scopeType}: ${scopeId ?? '—'}`;
  const options = scopeType === 'BRANCH' ? catalog.branches : catalog.projects;
  const match = options.find((option) => option.id === scopeId);
  return match?.name ?? `${scopeType === 'BRANCH' ? 'Chi nhánh' : 'Dự án'}: ${scopeId ?? '—'}`;
}

function scopeEndpointId(scopeType: RoleScope): string | null {
  return scopeType === 'TENANT' || scopeType === 'SELF' ? null : 'required';
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getAvatarColor(index: number): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300' },
    { bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300' },
  ];
  return colors[index % colors.length];
}

function formatAuditAction(event: AuditEvent): string {
  const type = event.event_type ?? '';
  if (type.includes('ASSIGN') || type.includes('ROLE_ASSIGNED')) {
    return `Cấp quyền vai trò ${event.role_key ?? ''}`.trim();
  }
  if (type.includes('REVOKE') || type.includes('ROLE_REVOKED')) {
    return `Thu hồi vai trò ${event.role_key ?? ''}`.trim();
  }
  if (type.includes('LOGIN') || type.includes('AUTH')) {
    return 'Đăng nhập hệ thống';
  }
  if (type.includes('INVITE') || type.includes('USER_CREATED')) {
    return 'Thêm nhân viên mới';
  }
  if (type.includes('DIRECT_GRANT')) {
    return `Cấp quyền bổ sung ${event.permission_id ?? ''}`.trim();
  }
  if (type.includes('DELEGAT')) {
    return `Ủy quyền ADMIN vai trò ${event.role_key ?? ''}`.trim();
  }
  if (type.includes('BRANCH')) {
    return 'Cập nhật phạm vi chi nhánh';
  }
  return type || 'Thay đổi phân quyền';
}

function formatAuditTime(rawTime?: string): string {
  if (!rawTime) return '—';
  try {
    const date = new Date(rawTime);
    if (isNaN(date.getTime())) return rawTime;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return rawTime;
  }
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

  // Modals & Panels State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
  const [isDirectGrantModalOpen, setIsDirectGrantModalOpen] = useState(false);
  const [isBranchMappingOpen, setIsBranchMappingOpen] = useState(false);
  const [isAllAuditModalOpen, setIsAllAuditModalOpen] = useState(false);
  const [viewingPermissionsUser, setViewingPermissionsUser] = useState<InteriorUser | null>(null);
  const [viewingRoleDetail, setViewingRoleDetail] = useState<Role | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState<RevokeTarget | null>(null);
  const [activeActionMenuUserId, setActiveActionMenuUserId] = useState<string | null>(null);

  // Advanced form fields
  const [grantPermission, setGrantPermission] = useState('');
  const [grantScopeType, setGrantScopeType] = useState<RoleScope>('PROJECT');
  const [grantScopeId, setGrantScopeId] = useState('');
  const [delegateAdminId, setDelegateAdminId] = useState('');
  const [delegateRoleKey, setDelegateRoleKey] = useState('');
  const [branchProjectId, setBranchProjectId] = useState('');
  const [branchId, setBranchId] = useState('');

  // Invite form fields
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRoleKey, setInviteRoleKey] = useState('SALES');
  const [inviteScopeType, setInviteScopeType] = useState<RoleScope>('TENANT');
  const [inviteScopeId, setInviteScopeId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
        'interior:users:manage', 'interior:roles:assign', 'interior:roles:manage',
        'interior:company:manage', 'interior:branch:manage', 'interior:audit:read', 'interior:audit:read_limited',
      ].includes(item.permission_id))?.permission_id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải cấu hình RBAC.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const selectedUser = useMemo(() => users.find((user) => user.user_id === selectedUserId) ?? null, [users, selectedUserId]);
  const scopeOptions = scopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];
  const grantScopeOptions = grantScopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];
  const inviteScopeOptions = inviteScopeType === 'BRANCH' ? catalog?.branches ?? [] : catalog?.projects ?? [];

  const activeAdmins = useMemo(() => {
    return users.filter((user) =>
      user.status.toLowerCase() === 'active' &&
      user.roles.some((assignment) => assignment.role_key === 'ADMIN' && assignment.status === 'ACTIVE')
    );
  }, [users]);

  const directGrantablePermissions = useMemo(() => {
    return (catalog?.permissions ?? []).filter((permission) => ![
      'interior:users:manage', 'interior:roles:assign', 'interior:roles:manage',
      'interior:company:manage', 'interior:branch:manage', 'interior:audit:read', 'interior:audit:read_limited',
    ].includes(permission.permission_id));
  }, [catalog?.permissions]);

  // Accounts requiring audit review: e.g. having both OWNER and ADMIN or unassigned
  const accountsRequiringReview = useMemo(() => {
    return users.filter((user) => {
      const activeRoles = user.roles.filter((r) => r.status === 'ACTIVE');
      const hasOwner = activeRoles.some((r) => r.role_key === 'OWNER');
      const hasAdmin = activeRoles.some((r) => r.role_key === 'ADMIN');
      return (hasOwner && hasAdmin) || activeRoles.length === 0;
    });
  }, [users]);

  // Group roles by business domain (4 categories)
  const roleGroups = useMemo(() => {
    if (!catalog) return [];
    const getRoles = (keys: string[]) => catalog.roles.filter((r) => keys.includes(r.role_key));

    return [
      {
        id: 'executive',
        title: 'Điều hành',
        subtitle: 'Quản lý chiến lược và vận hành tổng thể.',
        icon: Crown,
        iconBg: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
        roles: getRoles(['OWNER', 'ADMIN', 'EXECUTIVE']),
      },
      {
        id: 'commercial',
        title: 'Kinh doanh & thiết kế',
        subtitle: 'Phát triển kinh doanh và sáng tạo giải pháp.',
        icon: BarChart3,
        iconBg: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
        roles: getRoles(['PM', 'DESIGNER', 'SALES', 'QS']),
      },
      {
        id: 'production',
        title: 'Sản xuất & công trình',
        subtitle: 'Triển khai sản xuất và thi công.',
        icon: Wrench,
        iconBg: 'text-slate-600 bg-slate-100 dark:bg-slate-800',
        roles: getRoles(['PRODUCTION_MANAGER', 'SITE_MANAGER', 'QC']),
      },
      {
        id: 'control',
        title: 'Kiểm soát',
        subtitle: 'Kiểm soát tài chính và tuân thủ.',
        icon: ShieldCheck,
        iconBg: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
        roles: getRoles(['ACCOUNTANT', 'WARRANTY']),
      },
    ];
  }, [catalog]);

  async function handleAssignRole(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedUserId || !roleKey) return;
    setSaving(true);
    setError(null);
    try {
      await requestApi('/api/interior/users/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedUserId,
          role_key: roleKey,
          scope_type: scopeType,
          scope_id: scopeEndpointId(scopeType) === null ? null : scopeId,
        }),
      });

      // If SELF scope, optionally also assign project membership if selected
      if (scopeType === 'SELF' && membershipProjectId) {
        await requestApi('/api/interior/users/project-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUserId, project_id: membershipProjectId }),
        });
      }

      setSuccessToast(`Đã cấp vai trò ${roleKey} thành công.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cấp vai trò.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExecuteRevoke(): Promise<void> {
    if (!revokeConfirmation) return;
    setSaving(true);
    setError(null);
    try {
      await requestApi(revokeConfirmation.path, {
        method: 'DELETE',
        ...(revokeConfirmation.body
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(revokeConfirmation.body) }
          : {}),
      });
      setSuccessToast(`Đã thu hồi thành công.`);
      setRevokeConfirmation(null);
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
      setIsInviteModalOpen(false);
      setSuccessToast('Đã gửi lời mời và gán vai trò ban đầu thành công.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể mời nhân viên.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelegateAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestApi('/api/interior/users/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_user_id: delegateAdminId, role_key: delegateRoleKey }),
      });
      setSuccessToast('Ủy quyền vai trò cho Quản trị viên thành công.');
      setDelegateAdminId('');
      setDelegateRoleKey('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể ủy quyền.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDirectGrant(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requestApi('/api/interior/users/direct-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedUserId,
          permission_id: grantPermission,
          scope_type: grantScopeType,
          scope_id: grantScopeType === 'TENANT' || grantScopeType === 'SELF' ? null : grantScopeId,
        }),
      });
      setSuccessToast(`Đã cấp quyền trực tiếp ${grantPermission} thành công.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cấp quyền trực tiếp.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranchProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!branchProjectId) return;
    setSaving(true);
    setError(null);
    try {
      await requestApi(`/api/interior/projects/${branchProjectId}/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId || null }),
      });
      setSuccessToast('Đã cập nhật phạm vi chi nhánh cho dự án thành công.');
      setIsBranchMappingOpen(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu phạm vi chi nhánh.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !catalog) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <LoaderCircle className="h-6 w-6 animate-spin text-amber-600" />
        <p className="text-sm font-medium">Đang tải ma trận nhân sự &amp; phân quyền...</p>
      </div>
    );
  }

  if (!catalog) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nhân sự &amp; Phân quyền</h1>
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <strong className="text-base font-semibold">Chưa thể tải dữ liệu phân quyền.</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {error ?? 'Tài khoản hiện tại chưa có quyền xem role catalog. OWNER cần được bootstrap bằng một tài khoản thật đã xác minh.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => void refresh()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Thử lại
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4" />
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className="fixed top-6 right-6 z-50 flex max-w-md items-center gap-2.5 rounded-xl bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-3 duration-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-rose-700 rounded-md">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-5 space-y-6">
        {/* Breadcrumb & Navigation Topbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Home className="h-3.5 w-3.5 text-slate-400" />
            <span>&gt;</span>
            <span>Quản trị</span>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Nhân sự &amp; Phân quyền</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              title="Làm mới dữ liệu"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ</span>
            </button>
            <div className="relative">
              <button
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-2xs"
                title="Thông báo"
              >
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  2
                </span>
              </button>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              B
            </div>
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Nhân sự &amp; Phân quyền
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý tài khoản, vai trò và phạm vi truy cập
            </p>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Vai trò */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {catalog.roles.length}
              </div>
              <div className="text-xs font-medium text-slate-500">Vai trò</div>
            </div>
          </div>

          {/* Card 2: Tài khoản */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {String(users.length).padStart(2, '0')}
              </div>
              <div className="text-xs font-medium text-slate-500">Tài khoản</div>
            </div>
          </div>

          {/* Card 3: Cần rà soát */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {String(accountsRequiringReview.length).padStart(2, '0')}
              </div>
              <div className="text-xs font-medium text-slate-500">Cần rà soát</div>
            </div>
          </div>
        </section>

        {/* Section 1: Nhân viên & quyền truy cập */}
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Nhân viên &amp; quyền truy cập
              </h2>
            </div>
            {catalog.can_manage_users && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Mời nhân viên</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3.5 px-5">Nhân viên</th>
                  <th className="py-3.5 px-5">Vai trò</th>
                  <th className="py-3.5 px-5">Phạm vi</th>
                  <th className="py-3.5 px-5">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((user, idx) => {
                  const avatarColor = getAvatarColor(idx);
                  const activeAssignments = user.roles.filter((r) => r.status === 'ACTIVE');
                  const primaryAssignment = activeAssignments[0] ?? null;

                  return (
                    <tr
                      key={user.user_id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        selectedUserId === user.user_id ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Cột 1: Nhân viên */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarColor.bg} ${avatarColor.text} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {getInitials(user.full_name, user.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {user.full_name || 'Chưa cập nhật họ tên'}
                            </div>
                            <div className="text-slate-400 text-xs truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Vai trò */}
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeAssignments.length === 0 && (
                            <span className="text-slate-400 italic">Chưa gán vai trò</span>
                          )}
                          {activeAssignments.map((assignment) => {
                            const isOwner = assignment.role_key === 'OWNER';
                            const isAdmin = assignment.role_key === 'ADMIN';

                            return (
                              <span
                                key={assignment.assignment_id}
                                className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                                  isOwner
                                    ? 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300'
                                    : isAdmin
                                    ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300'
                                }`}
                              >
                                {assignment.role_key}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Cột 3: Phạm vi */}
                      <td className="py-4 px-5">
                        <div className="text-slate-600 dark:text-slate-300 font-medium">
                          {primaryAssignment
                            ? scopeLabel(primaryAssignment.scope_type, primaryAssignment.scope_id, catalog)
                            : '—'}
                          {activeAssignments.length > 1 && (
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              (+{activeAssignments.length - 1} phạm vi)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 4: Trạng thái */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Đang hoạt động
                        </span>
                      </td>

                      {/* Cột 5: Thao tác */}
                      <td className="py-4 px-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => {
                              setSelectedUserId(user.user_id);
                              setActiveActionMenuUserId((curr) => (curr === user.user_id ? null : user.user_id));
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Tùy chọn"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeActionMenuUserId === user.user_id && (
                            <div className="absolute right-0 mt-1 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                onClick={() => {
                                  setSelectedUserId(user.user_id);
                                  setActiveActionMenuUserId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Shield className="w-3.5 h-3.5 text-amber-600" />
                                <span>Cấp thêm quyền cho người này</span>
                              </button>
                              <button
                                onClick={() => {
                                  setViewingPermissionsUser(user);
                                  setActiveActionMenuUserId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>Xem quyền hiệu lực ({user.effective_permissions.length})</span>
                              </button>

                              {activeAssignments.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                                  <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-400">
                                    Thu hồi vai trò
                                  </div>
                                  {activeAssignments.map((a) => (
                                    <button
                                      key={a.assignment_id}
                                      onClick={() => {
                                        setActiveActionMenuUserId(null);
                                        setRevokeConfirmation({
                                          path: `/api/interior/users/roles/${a.assignment_id}`,
                                          title: 'Thu hồi vai trò',
                                          userName: user.full_name || user.email,
                                          roleOrPermission: a.role_key,
                                          scopeText: scopeLabel(a.scope_type, a.scope_id, catalog),
                                        });
                                      }}
                                      className="w-full text-left px-3.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-between"
                                    >
                                      <span>{a.role_key}</span>
                                      <span className="text-[10px] text-slate-400">{a.scope_type}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Cấp quyền truy cập */}
        {catalog.can_assign_roles && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Cấp quyền truy cập</h2>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">Chọn nhân viên</span>
                </div>
                <div className="w-4 h-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Chọn vai trò</span>
                </div>
                <div className="w-4 h-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Chọn phạm vi</span>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => void handleAssignRole(e)} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1: Chọn nhân viên */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nhân viên
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">Chọn tài khoản nhân viên</option>
                    {users
                      .filter((u) => u.status.toLowerCase() === 'active')
                      .map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.full_name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Step 2: Chọn vai trò */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Vai trò
                  </label>
                  <select
                    required
                    value={roleKey}
                    onChange={(e) => setRoleKey(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {catalog.roles.map((r) => (
                      <option key={r.role_key} value={r.role_key}>
                        {r.role_key} — {r.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Chọn phạm vi */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Phạm vi áp dụng
                  </label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      setScopeType(e.target.value as RoleScope);
                      setScopeId('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="TENANT">Toàn doanh nghiệp (TENANT)</option>
                    <option value="BRANCH">Chi nhánh (BRANCH)</option>
                    <option value="PROJECT">Dự án (PROJECT)</option>
                    <option value="SELF">Dự án được giao cá nhân (SELF)</option>
                  </select>
                </div>
              </div>

              {/* Conditional sub-selectors for Branch or Project */}
              {(scopeType === 'BRANCH' || scopeType === 'PROJECT') && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {scopeType === 'BRANCH' ? 'Chọn chi nhánh cụ thể *' : 'Chọn dự án áp dụng *'}
                  </label>
                  <select
                    required
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">-- {scopeType === 'BRANCH' ? 'Chọn chi nhánh' : 'Chọn dự án'} --</option>
                    {scopeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} {opt.code ? `· (${opt.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sub-selector for SELF project assignment */}
              {scopeType === 'SELF' && (
                <div className="rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 p-3.5">
                  <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1.5">
                    Gán dự án cho nhân viên để phạm vi SELF có hiệu lực ngay
                  </label>
                  <select
                    value={membershipProjectId}
                    onChange={(e) => setMembershipProjectId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">Chọn dự án (tùy chọn gán ngay)</option>
                    {catalog.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `· (${p.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !selectedUserId ||
                    !roleKey ||
                    ((scopeType === 'BRANCH' || scopeType === 'PROJECT') && !scopeId)
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Cấp quyền</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 3: Danh mục vai trò */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Danh mục vai trò</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg ${group.iconBg} flex items-center justify-center`}>
                        <GroupIcon className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{group.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{group.subtitle}</p>

                    <div className="space-y-2.5">
                      {group.roles.map((role) => (
                        <div
                          key={role.role_key}
                          onClick={() => setViewingRoleDetail(role)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300">
                              {role.role_key}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {role.display_name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {role.permissions.length} quyền
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Thiết lập nâng cao */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Thiết lập nâng cao</h2>
            </div>
            {catalog.can_manage_branches && (
              <button
                onClick={() => setIsBranchMappingOpen((c) => !c)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Gán dự án vào chi nhánh</span>
              </button>
            )}
          </div>

          {/* Collapsible Branch Mapping Box */}
          {isBranchMappingOpen && catalog.can_manage_branches && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-in fade-in duration-150">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Phạm vi chi nhánh cho dự án
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Branch scope chỉ bao phủ dự án có chi nhánh đang hoạt động cùng tenant. Mọi thay đổi đều được ghi nhật ký audit.
              </p>
              <form onSubmit={(e) => void handleSaveBranchProject(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  required
                  value={branchProjectId}
                  onChange={(e) => {
                    setBranchProjectId(e.target.value);
                    const selectedProject = catalog.projects.find((p) => p.id === e.target.value);
                    setBranchId(selectedProject?.branch_id ?? '');
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="">Chọn dự án</option>
                  {catalog.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `· (${p.code})` : ''}
                    </option>
                  ))}
                </select>

                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="">Không gán chi nhánh (Toàn doanh nghiệp)</option>
                  {catalog.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `· (${b.code})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={saving || !branchProjectId}
                  className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  Lưu phạm vi chi nhánh
                </button>
              </form>
            </div>
          )}

          {/* 2 Interactive Cards Matching Reference Mockup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Left: Ủy quyền quản trị viên */}
            <div
              onClick={() => {
                if (catalog.is_owner) setIsDelegationModalOpen(true);
              }}
              className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between cursor-pointer hover:border-amber-400 dark:hover:border-amber-700 transition-all ${
                !catalog.is_owner ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Ủy quyền quản trị viên
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    OWNER ủy quyền một số vai trò cho ADMIN
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>

            {/* Card Right: Cấp quyền riêng lẻ */}
            <div
              onClick={() => {
                if (catalog.is_owner) setIsDirectGrantModalOpen(true);
              }}
              className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between cursor-pointer hover:border-amber-400 dark:hover:border-amber-700 transition-all ${
                !catalog.is_owner ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Cấp quyền riêng lẻ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấp quyền ngoài bộ quyền mặc định
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>
          </div>
        </section>

        {/* Section 5: Lịch sử thay đổi gần đây */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lịch sử thay đổi gần đây
              </h2>
            </div>
            {audit.length > 0 && (
              <button
                onClick={() => setIsAllAuditModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-3">Người thực hiện</th>
                  <th className="py-3 px-3">Hành động</th>
                  <th className="py-3 px-3 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {audit.slice(0, 5).map((event, idx) => {
                  const avatarColor = getAvatarColor(idx + 2);
                  const actorUser = users.find((u) => u.user_id === event.actor_user_id);
                  const actorName = actorUser?.full_name || actorUser?.email || 'Bella Interior Demo Manager';

                  return (
                    <tr key={event.id ?? idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full ${avatarColor.bg} ${avatarColor.text} font-bold text-[10px] flex items-center justify-center shrink-0`}
                          >
                            {actorName[0]?.toUpperCase() ?? 'A'}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {actorName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {formatAuditAction(event)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">
                        {formatAuditTime(event.recorded_at ?? event.latest_at)}
                      </td>
                    </tr>
                  );
                })}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                      Chưa có thay đổi quyền nào được ghi nhận gần đây.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── MODALS & DRAWERS ──────────────────────────────────────────────── */}

      {/* Modal 1: Mời nhân viên */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Mời nhân viên mới</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void inviteUser(e)} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email nhân viên *
                </label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="nhanvien@congty.vn"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên *
                </label>
                <input
                  required
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vai trò ban đầu *
                  </label>
                  <select
                    required
                    value={inviteRoleKey}
                    onChange={(e) => setInviteRoleKey(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20"
                  >
                    {catalog.roles
                      .filter((r) => catalog.is_owner || r.role_key !== 'OWNER')
                      .map((r) => (
                        <option key={r.role_key} value={r.role_key}>
                          {r.role_key} — {r.display_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phạm vi áp dụng *
                  </label>
                  <select
                    value={inviteScopeType}
                    onChange={(e) => {
                      setInviteScopeType(e.target.value as RoleScope);
                      setInviteScopeId('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="TENANT">Toàn doanh nghiệp</option>
                    <option value="BRANCH">Chi nhánh</option>
                    <option value="PROJECT">Dự án</option>
                    <option value="SELF">Dự án cá nhân</option>
                  </select>
                </div>
              </div>

              {(inviteScopeType === 'BRANCH' || inviteScopeType === 'PROJECT') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {inviteScopeType === 'BRANCH' ? 'Chọn chi nhánh *' : 'Chọn dự án *'}
                  </label>
                  <select
                    required
                    value={inviteScopeId}
                    onChange={(e) => setInviteScopeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">Chọn phạm vi</option>
                    {inviteScopeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} {opt.code ? `· (${opt.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !inviteEmail ||
                    !inviteFullName ||
                    !inviteRoleKey ||
                    ((inviteScopeType === 'BRANCH' || inviteScopeType === 'PROJECT') && !inviteScopeId)
                  }
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  <span>Gửi lời mời và gán vai trò</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Xác nhận thu hồi quyền (Evidence-based safety check) */}
      {revokeConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {revokeConfirmation.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Vui lòng xác nhận trước khi thực hiện hành động này.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Nhân viên:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {revokeConfirmation.userName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vai trò / Quyền:</span>
                <span className="font-bold text-rose-600">
                  {revokeConfirmation.roleOrPermission}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phạm vi áp dụng:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {revokeConfirmation.scopeText}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3">
              Hành động này sẽ có hiệu lực ngay lập tức đối với tài khoản và được ghi vào nhật ký kiểm toán hệ thống.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setRevokeConfirmation(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleExecuteRevoke()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận thu hồi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Xem quyền hiệu lực của người dùng */}
      {viewingPermissionsUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Quyền hiệu lực:{' '}
                  <span className="text-amber-600">
                    {viewingPermissionsUser.full_name || viewingPermissionsUser.email}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng cộng: {viewingPermissionsUser.effective_permissions.length} action permissions được cấp
                </p>
              </div>
              <button
                onClick={() => setViewingPermissionsUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 pr-1 space-y-2">
              {viewingPermissionsUser.effective_permissions.map((p, idx) => {
                const catalogPerm = catalog.permissions.find((cp) => cp.permission_id === p.permission_id);

                return (
                  <div
                    key={`${p.permission_id}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{p.permission_id}</span>
                        {catalogPerm?.sensitive && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            Nhạy cảm
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {catalogPerm?.description || 'Quyền thao tác hệ thống'}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        {p.source === 'ROLE' ? `Vai trò: ${p.role_key}` : 'Cấp trực tiếp'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {scopeLabel(p.scope_type, p.scope_id, catalog)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {viewingPermissionsUser.effective_permissions.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Tài khoản này chưa có quyền hiệu lực nào.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setViewingPermissionsUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold dark:bg-white dark:text-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Chi tiết vai trò */}
      {viewingRoleDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {viewingRoleDetail.role_key}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                  {viewingRoleDetail.display_name}
                </h3>
              </div>
              <button
                onClick={() => setViewingRoleDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-3">{viewingRoleDetail.responsibility}</p>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Các quyền thuộc vai trò ({viewingRoleDetail.permissions.length}):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {viewingRoleDetail.permissions.map((pKey) => {
                  const perm = catalog.permissions.find((p) => p.permission_id === pKey);
                  return (
                    <span
                      key={pKey}
                      title={perm?.description ?? pKey}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                        perm?.sensitive
                          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      {pKey.replace('interior:', '')}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-right mt-4">
              <button
                onClick={() => setViewingRoleDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold dark:bg-white dark:text-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Ủy quyền Quản trị viên (ADMIN delegation) */}
      {isDelegationModalOpen && catalog.is_owner && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Ủy quyền vai trò cho Quản trị viên (ADMIN)
                </h3>
              </div>
              <button
                onClick={() => setIsDelegationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              ADMIN chỉ được phép gán những vai trò đã được OWNER phê duyệt ủy quyền. Vai trò OWNER không thể được ủy quyền.
            </p>

            <form onSubmit={(e) => void handleDelegateAdmin(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Quản trị viên (ADMIN) *
                </label>
                <select
                  required
                  value={delegateAdminId}
                  onChange={(e) => setDelegateAdminId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <option value="">Chọn tài khoản ADMIN</option>
                  {activeAdmins.map((adm) => (
                    <option key={adm.user_id} value={adm.user_id}>
                      {adm.full_name || adm.email} ({adm.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vai trò được phép gán *
                </label>
                <select
                  required
                  value={delegateRoleKey}
                  onChange={(e) => setDelegateRoleKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <option value="">Chọn vai trò</option>
                  {catalog.roles
                    .filter((r) => r.role_key !== 'OWNER')
                    .map((r) => (
                      <option key={r.role_key} value={r.role_key}>
                        {r.role_key} — {r.display_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving || !delegateAdminId || !delegateRoleKey}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu ủy quyền</span>
                </button>
              </div>
            </form>

            {/* List active delegations */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Danh sách ủy quyền đang hoạt động:
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {users.flatMap((u) =>
                  u.admin_role_delegations
                    .filter((d) => d.status === 'ACTIVE')
                    .map((d) => (
                      <div
                        key={d.delegation_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {u.full_name || u.email}
                          </span>
                          <span className="text-slate-400 ml-2">được gán:</span>
                          <span className="font-bold text-amber-700 ml-1">{d.role_key}</span>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setRevokeConfirmation({
                              path: '/api/interior/users/delegations',
                              body: { admin_user_id: u.user_id, role_key: d.role_key },
                              title: 'Thu hồi ủy quyền ADMIN',
                              userName: u.full_name || u.email,
                              roleOrPermission: d.role_key,
                              scopeText: 'Ủy quyền gán role',
                            });
                          }}
                          className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                        >
                          Thu hồi
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Cấp quyền riêng lẻ (Direct Grants) */}
      {isDirectGrantModalOpen && catalog.is_owner && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Cấp quyền riêng lẻ (Direct Grant)
                </h3>
              </div>
              <button
                onClick={() => setIsDirectGrantModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Dành riêng cho OWNER. Cho phép cấp một action permission cụ thể ngoài bộ quyền của vai trò.
            </p>

            <form onSubmit={(e) => void handleDirectGrant(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nhân viên nhận quyền *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <option value="">Chọn nhân viên</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quyền cần cấp *
                </label>
                <select
                  required
                  value={grantPermission}
                  onChange={(e) => setGrantPermission(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  {directGrantablePermissions.map((p) => (
                    <option key={p.permission_id} value={p.permission_id}>
                      {p.permission_id} ({p.description})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phạm vi áp dụng *
                </label>
                <select
                  value={grantScopeType}
                  onChange={(e) => {
                    setGrantScopeType(e.target.value as RoleScope);
                    setGrantScopeId('');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                >
                  <option value="TENANT">Toàn doanh nghiệp</option>
                  <option value="BRANCH">Chi nhánh</option>
                  <option value="PROJECT">Dự án</option>
                  <option value="SELF">Dự án cá nhân (SELF)</option>
                </select>
              </div>

              {(grantScopeType === 'BRANCH' || grantScopeType === 'PROJECT') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn chi nhánh / dự án *
                  </label>
                  <select
                    required
                    value={grantScopeId}
                    onChange={(e) => setGrantScopeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-3 py-2 text-xs"
                  >
                    <option value="">Chọn phạm vi</option>
                    {grantScopeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    !selectedUserId ||
                    !grantPermission ||
                    ((grantScopeType === 'BRANCH' || grantScopeType === 'PROJECT') && !grantScopeId)
                  }
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  <span>Cấp quyền riêng lẻ</span>
                </button>
              </div>
            </form>

            {/* List active direct grants */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Quyền trực tiếp đang có hiệu lực:
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {users.flatMap((u) =>
                  u.direct_grants
                    .filter((g) => g.status === 'ACTIVE')
                    .map((g) => (
                      <div
                        key={g.grant_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {u.full_name || u.email}
                          </span>
                          <span className="text-rose-600 font-bold ml-2">{g.permission_id}</span>
                          <span className="text-slate-400 ml-1">
                            ({scopeLabel(g.scope_type, g.scope_id, catalog)})
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setRevokeConfirmation({
                              path: `/api/interior/users/direct-grants/${g.grant_id}`,
                              title: 'Thu hồi quyền trực tiếp',
                              userName: u.full_name || u.email,
                              roleOrPermission: g.permission_id,
                              scopeText: scopeLabel(g.scope_type, g.scope_id, catalog),
                            });
                          }}
                          className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                        >
                          Thu hồi
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Xem toàn bộ Lịch sử thay đổi */}
      {isAllAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Nhật ký thay đổi phân quyền (Audit Log)
                </h3>
              </div>
              <button
                onClick={() => setIsAllAuditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Người thực hiện</th>
                    <th className="py-2.5 px-3">Hành động</th>
                    <th className="py-2.5 px-3">Phạm vi / Vai trò</th>
                    <th className="py-2.5 px-3 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {audit.map((event, idx) => {
                    const actorUser = users.find((u) => u.user_id === event.actor_user_id);
                    const actorName = actorUser?.full_name || actorUser?.email || 'Bella Interior Demo Manager';

                    return (
                      <tr key={event.id ?? idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {actorName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {formatAuditAction(event)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {event.role_key || event.permission_id || (event.scope_type ? `${event.scope_type}` : '—')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          {formatAuditTime(event.recorded_at ?? event.latest_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right mt-3">
              <button
                onClick={() => setIsAllAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold dark:bg-white dark:text-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
