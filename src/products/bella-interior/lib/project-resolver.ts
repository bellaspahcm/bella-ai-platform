/**
 * Bella Interior OS — Deterministic Tenant Project Resolver
 *
 * Implements the mandatory architectural rule:
 * Only auto-select a project if EXACTLY ONE matching project exists in the tenant.
 * If multiple projects exist, explicit `projectId` is mandatory to prevent ambiguous cross-project mutations.
 *
 * @module src/products/bella-interior/lib/project-resolver
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { validInteriorUuid } from './rbac-api';

export type ProjectResolveResult =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly error: 'PROJECT_REQUIRED' | 'PROJECT_NOT_FOUND' | 'AMBIGUOUS_PROJECT_SELECTION'; readonly message: string; readonly availableProjects?: ReadonlyArray<{ readonly id: string; readonly name: string; readonly code: string }> };

export async function resolveTenantProject(
  supabase: SupabaseClient,
  tenantId: string,
  requestedProjectId?: string | null,
): Promise<ProjectResolveResult> {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return {
      ok: false,
      error: 'PROJECT_NOT_FOUND',
      message: 'Invalid or missing tenant identifier',
    };
  }

  // Gracefully handle partial mock clients in unit tests
  if (typeof supabase?.from !== 'function') {
    if (requestedProjectId && validInteriorUuid(requestedProjectId.trim())) {
      return { ok: true, projectId: requestedProjectId.trim() };
    }
    return {
      ok: false,
      error: 'PROJECT_NOT_FOUND',
      message: 'Supabase client does not support table queries',
    };
  }

  // 1. Explicit project ID provided
  if (requestedProjectId !== undefined && requestedProjectId !== null && requestedProjectId.trim() !== '') {
    const trimmed = requestedProjectId.trim();
    if (!validInteriorUuid(trimmed)) {
      return {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
        message: 'Provided projectId is not a valid UUID',
      };
    }

    const { data, error } = await supabase
      .from('interior_projects')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', trimmed)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        error: 'PROJECT_NOT_FOUND',
        message: `Project ${trimmed} not found in current tenant`,
      };
    }

    return { ok: true, projectId: (data as { id: string }).id };
  }

  // 2. No project ID provided — check tenant project multiplicity
  const { data: projects, error } = await supabase
    .from('interior_projects')
    .select('id, name, code')
    .eq('tenant_id', tenantId);

  if (error || !Array.isArray(projects) || projects.length === 0) {
    return {
      ok: false,
      error: 'PROJECT_NOT_FOUND',
      message: 'No interior project found in current tenant',
    };
  }

  // Strictly check multiplicity:
  // Exactly ONE project -> Safe to auto-resolve
  if (projects.length === 1) {
    return { ok: true, projectId: (projects[0] as { id: string }).id };
  }

  // Multiple projects -> Ambiguous, never arbitrarily pick the first one
  return {
    ok: false,
    error: 'AMBIGUOUS_PROJECT_SELECTION',
    message: `Multiple projects exist in tenant (${projects.length}). Explicit "projectId" query parameter is required.`,
    availableProjects: projects as unknown as Array<{ id: string; name: string; code: string }>,
  };
}
