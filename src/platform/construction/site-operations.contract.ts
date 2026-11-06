export interface ConstructionSiteActivityChoice {
  readonly id: string;
  readonly project_id: string;
  readonly org_unit_id: string;
  readonly site_code: string;
  readonly name: string;
  readonly can_view_diary: boolean;
  readonly can_create_diary: boolean;
  readonly can_update_diary: boolean;
  readonly can_view_issue: boolean;
  readonly can_create_issue: boolean;
  readonly can_update_issue: boolean;
  readonly can_resolve_issue: boolean;
  readonly can_close_issue: boolean;
  readonly can_reopen_issue: boolean;
}

export interface ConstructionActivityWorkPackageChoice {
  readonly id: string;
  readonly work_package_code: string;
  readonly name: string;
}

export interface ConstructionSiteDiaryEntry {
  readonly id: string;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly site_id: string;
  readonly org_unit_id: string;
  readonly work_package_id: string | null;
  readonly entry_date: string;
  readonly content: string;
  readonly author_user_id: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export type ConstructionIssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface ConstructionIssue {
  readonly id: string;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly site_id: string;
  readonly org_unit_id: string;
  readonly diary_entry_id: string | null;
  readonly work_package_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly status: ConstructionIssueStatus;
  readonly due_date: string | null;
  readonly resolution_result: string | null;
  readonly reopen_reason: string | null;
  readonly closed_at: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_by: string;
  readonly updated_at: string;
}

export const constructionSiteDiaryPermissions = {
  view: 'construction.site_diary.view',
  create: 'construction.site_diary.create',
  update: 'construction.site_diary.update',
} as const;

export const constructionIssuePermissions = {
  view: 'construction.issue.view',
  create: 'construction.issue.create',
  update: 'construction.issue.update',
  resolve: 'construction.issue.resolve',
  close: 'construction.issue.close',
  reopen: 'construction.issue.reopen',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDate(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseConstructionActivitySites(value: unknown): ConstructionSiteActivityChoice[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionSiteActivityChoice[] = [];
  for (const row of value) {
    if (!isRecord(row) || !isUuid(row.id) || !isUuid(row.project_id) || !isUuid(row.org_unit_id)
      || typeof row.site_code !== 'string' || typeof row.name !== 'string'
      || typeof row.can_view_diary !== 'boolean' || typeof row.can_create_diary !== 'boolean'
      || typeof row.can_update_diary !== 'boolean' || typeof row.can_view_issue !== 'boolean'
      || typeof row.can_create_issue !== 'boolean' || typeof row.can_update_issue !== 'boolean'
      || typeof row.can_resolve_issue !== 'boolean' || typeof row.can_close_issue !== 'boolean'
      || typeof row.can_reopen_issue !== 'boolean') return null;
    rows.push({
      id: row.id,
      project_id: row.project_id,
      org_unit_id: row.org_unit_id,
      site_code: row.site_code,
      name: row.name,
      can_view_diary: row.can_view_diary,
      can_create_diary: row.can_create_diary,
      can_update_diary: row.can_update_diary,
      can_view_issue: row.can_view_issue,
      can_create_issue: row.can_create_issue,
      can_update_issue: row.can_update_issue,
      can_resolve_issue: row.can_resolve_issue,
      can_close_issue: row.can_close_issue,
      can_reopen_issue: row.can_reopen_issue,
    });
  }
  return rows;
}

export function parseConstructionActivityWorkPackages(value: unknown): ConstructionActivityWorkPackageChoice[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionActivityWorkPackageChoice[] = [];
  for (const row of value) {
    if (!isRecord(row) || !isUuid(row.id) || typeof row.work_package_code !== 'string' || typeof row.name !== 'string') {
      return null;
    }
    rows.push({ id: row.id, work_package_code: row.work_package_code, name: row.name });
  }
  return rows;
}

export function parseConstructionSiteDiaryEntry(value: unknown): ConstructionSiteDiaryEntry | null {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.tenant_id) || !isUuid(value.project_id)
    || !isUuid(value.site_id) || !isUuid(value.org_unit_id) || !isNullableUuid(value.work_package_id)
    || !isDate(value.entry_date) || typeof value.content !== 'string' || !value.content.trim()
    || !isUuid(value.author_user_id) || !isUuid(value.created_by) || typeof value.created_at !== 'string'
    || !isUuid(value.updated_by) || typeof value.updated_at !== 'string') return null;
  return {
    id: value.id,
    tenant_id: value.tenant_id,
    project_id: value.project_id,
    site_id: value.site_id,
    org_unit_id: value.org_unit_id,
    work_package_id: value.work_package_id,
    entry_date: value.entry_date,
    content: value.content,
    author_user_id: value.author_user_id,
    created_by: value.created_by,
    created_at: value.created_at,
    updated_by: value.updated_by,
    updated_at: value.updated_at,
  };
}

export function parseConstructionSiteDiaryEntries(value: unknown): ConstructionSiteDiaryEntry[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionSiteDiaryEntry[] = [];
  for (const row of value) {
    const parsed = parseConstructionSiteDiaryEntry(row);
    if (!parsed) return null;
    rows.push(parsed);
  }
  return rows;
}

export function parseConstructionIssue(value: unknown): ConstructionIssue | null {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.tenant_id) || !isUuid(value.project_id)
    || !isUuid(value.site_id) || !isUuid(value.org_unit_id) || !isNullableUuid(value.diary_entry_id)
    || !isNullableUuid(value.work_package_id) || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.description !== 'string' || !value.description.trim()
    || (value.status !== 'OPEN' && value.status !== 'IN_PROGRESS' && value.status !== 'RESOLVED' && value.status !== 'CLOSED')
    || !isNullableDate(value.due_date) || !isNullableString(value.resolution_result)
    || !isNullableString(value.reopen_reason) || !isNullableString(value.closed_at)
    || !isUuid(value.created_by) || typeof value.created_at !== 'string'
    || !isUuid(value.updated_by) || typeof value.updated_at !== 'string') return null;
  return {
    id: value.id,
    tenant_id: value.tenant_id,
    project_id: value.project_id,
    site_id: value.site_id,
    org_unit_id: value.org_unit_id,
    diary_entry_id: value.diary_entry_id,
    work_package_id: value.work_package_id,
    title: value.title,
    description: value.description,
    status: value.status,
    due_date: value.due_date,
    resolution_result: value.resolution_result,
    reopen_reason: value.reopen_reason,
    closed_at: value.closed_at,
    created_by: value.created_by,
    created_at: value.created_at,
    updated_by: value.updated_by,
    updated_at: value.updated_at,
  };
}

export function parseConstructionIssues(value: unknown): ConstructionIssue[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionIssue[] = [];
  for (const row of value) {
    const parsed = parseConstructionIssue(row);
    if (!parsed) return null;
    rows.push(parsed);
  }
  return rows;
}
