import { NextResponse } from 'next/server';
import {
  INTERIOR_PERMISSIONS,
  resolveInteriorActorAccess,
} from '@/products/bella-interior/lib/server-context';
import { validInteriorUuid } from '@/products/bella-interior/lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';
import {
  getInteriorRoleDisplayName,
  normalizeInteriorRoleKey,
  type InteriorRoleKey,
} from '@/products/bella-interior/lib/interior-rbac-navigation';

export const dynamic = 'force-dynamic';

export interface ActorRoleEntry {
  id: string;
  roleKey: string;
  displayName: string;
  scopeType: 'TENANT' | 'BRANCH' | 'PROJECT' | 'SELF';
  scopeId: string | null;
}

export interface ActorDelegationEntry {
  id: string;
  roleKey: string;
  displayName: string;
}

export interface ActorDirectGrantEntry {
  id: string;
  permissionId: string;
  scopeType: 'TENANT' | 'BRANCH' | 'PROJECT' | 'SELF';
  scopeId: string | null;
}

export interface SiteCapabilities {
  canReadDiaries: boolean;
  canCreateDiary: boolean;
  canUpdateDiary: boolean;
  canUploadSitePhoto: boolean;
  canReadQc: boolean;
  canCreateQc: boolean;
  canUpdateQc: boolean;
  canApproveQc: boolean;
  canReadSchedule: boolean;
  canUpdateSchedule: boolean;
  canManageRoles: boolean;
}

interface InteriorUserRoleRow {
  id: string;
  role_key: string;
  scope_type: string;
  scope_id: string | null;
  status: string;
}

interface InteriorPermissionGrantRow {
  id: string;
  permission_id: string;
  scope_type: string;
  scope_id: string | null;
  status: string;
}

interface InteriorAdminDelegationRow {
  id: string;
  role_key: string;
  status: string;
}

interface InteriorProjectAssignmentRow {
  project_id: string;
}

interface RbacQueryResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
}

interface RbacSelectBuilder<Row> extends PromiseLike<RbacQueryResult<Row>> {
  eq: (column: string, value: string) => RbacSelectBuilder<Row>;
}

interface RbacUntypedReadClient {
  from: <Row>(table: string) => {
    select: (columns: string) => RbacSelectBuilder<Row>;
  };
}

/**
 * GET /api/interior/me/access?projectId=<optional uuid>
 *
 * Returns ONLY the authenticated actor's own Interior roles, direct permission grants,
 * admin role delegations, assigned project IDs, and effective capability flags for
 * the selected project. Uses server-verified auth + tenant identity; never accepts
 * target user IDs from the request.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveInteriorActorAccess(request);
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(request.url);
  const rawProjectId = searchParams.get('projectId');
  if (rawProjectId !== null && rawProjectId !== '' && !validInteriorUuid(rawProjectId)) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PROJECT_ID' },
      { status: 400 },
    );
  }
  const projectId = rawProjectId && validInteriorUuid(rawProjectId) ? rawProjectId : undefined;

  try {
    const db = createServiceClient() as unknown as RbacUntypedReadClient;

    const [rolesRes, grantsRes, delegationsRes, assignmentsRes] = await Promise.all([
      db
        .from<InteriorUserRoleRow>('interior_user_roles')
        .select('id, role_key, scope_type, scope_id, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('user_id', ctx.actor.id)
        .eq('status', 'ACTIVE'),
      db
        .from<InteriorPermissionGrantRow>('interior_user_permission_grants')
        .select('id, permission_id, scope_type, scope_id, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('user_id', ctx.actor.id)
        .eq('status', 'ACTIVE'),
      db
        .from<InteriorAdminDelegationRow>('interior_admin_role_delegations')
        .select('id, role_key, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('admin_user_id', ctx.actor.id)
        .eq('status', 'ACTIVE'),
      db
        .from<InteriorProjectAssignmentRow>('interior_user_project_assignments')
        .select('project_id')
        .eq('tenant_id', ctx.tenantId)
        .eq('user_id', ctx.actor.id)
        .eq('status', 'ACTIVE'),
    ]);

    const roles: ActorRoleEntry[] = (rolesRes.data ?? []).map((row) => {
      const normalized = normalizeInteriorRoleKey(row.role_key);
      return {
        id: row.id,
        roleKey: row.role_key,
        displayName: normalized ? getInteriorRoleDisplayName(normalized) : row.role_key,
        scopeType: row.scope_type as ActorRoleEntry['scopeType'],
        scopeId: row.scope_id ?? null,
      };
    });

    const directGrants: ActorDirectGrantEntry[] = (grantsRes.data ?? []).map((row) => ({
      id: row.id,
      permissionId: row.permission_id,
      scopeType: row.scope_type as ActorDirectGrantEntry['scopeType'],
      scopeId: row.scope_id ?? null,
    }));

    const delegations: ActorDelegationEntry[] = (delegationsRes.data ?? []).map((row) => {
      const normalized = normalizeInteriorRoleKey(row.role_key);
      return {
        id: row.id,
        roleKey: row.role_key,
        displayName: normalized ? getInteriorRoleDisplayName(normalized) : row.role_key,
      };
    });

    const assignedProjectIds = (assignmentsRes.data ?? [])
      .map((row) => row.project_id)
      .filter((id): id is string => typeof id === 'string');

    // Evaluate effective runtime permissions via the canonical DB RBAC engine
    const checkedPermissions = [
      INTERIOR_PERMISSIONS.installationRead,
      INTERIOR_PERMISSIONS.installationCreate,
      INTERIOR_PERMISSIONS.installationUpdate,
      INTERIOR_PERMISSIONS.qcRead,
      INTERIOR_PERMISSIONS.qcCreate,
      INTERIOR_PERMISSIONS.qcUpdate,
      INTERIOR_PERMISSIONS.qcApprove,
      INTERIOR_PERMISSIONS.acceptanceEvidenceUpload,
      INTERIOR_PERMISSIONS.scheduleRead,
      INTERIOR_PERMISSIONS.scheduleUpdate,
      INTERIOR_PERMISSIONS.rolesRead,
    ] as const;

    const decisions = await Promise.all(
      checkedPermissions.map(async (permissionId) => {
        const decision = await ctx.authorization.authorize({
          permissionId,
          tenantId: ctx.tenantId,
          projectId,
        });
        return [permissionId, decision.status === 'ALLOW'] as const;
      }),
    );

    const allowMap = new Map<string, boolean>(decisions);
    const has = (permissionId: string) => allowMap.get(permissionId) === true;

    const capabilities: SiteCapabilities = {
      canReadDiaries: has(INTERIOR_PERMISSIONS.installationRead),
      canCreateDiary: has(INTERIOR_PERMISSIONS.installationCreate),
      canUpdateDiary: has(INTERIOR_PERMISSIONS.installationUpdate),
      canUploadSitePhoto:
        has(INTERIOR_PERMISSIONS.installationCreate)
        || has(INTERIOR_PERMISSIONS.installationUpdate)
        || has(INTERIOR_PERMISSIONS.qcCreate)
        || has(INTERIOR_PERMISSIONS.acceptanceEvidenceUpload),
      canReadQc: has(INTERIOR_PERMISSIONS.qcRead),
      canCreateQc: has(INTERIOR_PERMISSIONS.qcCreate),
      canUpdateQc: has(INTERIOR_PERMISSIONS.qcUpdate),
      canApproveQc: has(INTERIOR_PERMISSIONS.qcApprove),
      canReadSchedule: has(INTERIOR_PERMISSIONS.scheduleRead),
      canUpdateSchedule: has(INTERIOR_PERMISSIONS.scheduleUpdate),
      canManageRoles: has(INTERIOR_PERMISSIONS.rolesRead),
    };

    // Determine primary role key for UI labeling
    const normalizedRoles = roles
      .map((r) => normalizeInteriorRoleKey(r.roleKey))
      .filter((r): r is InteriorRoleKey => r !== null);

    const priorityOrder: InteriorRoleKey[] = [
      'OWNER',
      'ADMIN',
      'PM',
      'SITE_MANAGER',
      'QC',
      'EXECUTIVE',
      'PRODUCTION_MANAGER',
      'DESIGNER',
      'QS',
      'SALES',
      'ACCOUNTANT',
      'WARRANTY',
    ];
    const primaryRoleKey: InteriorRoleKey | null =
      priorityOrder.find((key) => normalizedRoles.includes(key))
      ?? normalizeInteriorRoleKey(ctx.actor.role ?? null)
      ?? null;

    return NextResponse.json(
      {
        success: true,
        data: {
          actor: {
            id: ctx.actor.id,
            email: ctx.actor.email,
            fullName: ctx.actor.full_name || ctx.actor.email,
            legacyRole: ctx.actor.role,
          },
          primaryRoleKey,
          roles,
          delegations,
          directGrants,
          assignedProjectIds,
          capabilities,
          projectId: projectId ?? null,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'INTERIOR_SELF_ACCESS_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
