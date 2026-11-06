export interface ConstructionScheduleItem {
  readonly id: string;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly site_id: string;
  readonly work_package_id: string;
  readonly org_unit_id: string;
  readonly title: string;
  readonly baseline_start_date: string;
  readonly baseline_end_date: string;
  readonly forecast_start_date: string;
  readonly forecast_end_date: string;
  readonly actual_start_date: string | null;
  readonly actual_end_date: string | null;
  readonly progress_percent: number;
  readonly delay_reason: string | null;
  readonly responsible_user_id: string | null;
  readonly predecessor_schedule_item_id: string | null;
}

export interface ConstructionProjectChoice {
  readonly id: string;
  readonly project_code: string;
  readonly name: string;
}

export interface ConstructionSiteChoice {
  readonly id: string;
  readonly project_id: string;
  readonly org_unit_id: string;
  readonly site_code: string;
  readonly name: string;
}

export interface ConstructionWorkPackageChoice {
  readonly id: string;
  readonly project_id: string;
  readonly site_id: string;
  readonly org_unit_id: string;
  readonly work_package_code: string;
  readonly name: string;
}

export interface ConstructionAssigneeChoice {
  readonly id: string;
  readonly full_name: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function nullableDate(value: unknown): value is string | null {
  return value === null || isDate(value);
}

export function parseScheduleItem(value: unknown): ConstructionScheduleItem | null {
  if (!isRecord(value)) return null;
  const responsibleUserId = value.responsible_user_id ?? null;
  const predecessorScheduleItemId = value.predecessor_schedule_item_id ?? null;
  const progress = typeof value.progress_percent === 'number'
    ? value.progress_percent
    : typeof value.progress_percent === 'string' ? Number(value.progress_percent) : Number.NaN;
  if (!isUuid(value.id) || !isUuid(value.tenant_id) || !isUuid(value.project_id)
    || !isUuid(value.site_id) || !isUuid(value.work_package_id) || !isUuid(value.org_unit_id)
    || typeof value.title !== 'string' || !value.title.trim()
    || !isDate(value.baseline_start_date) || !isDate(value.baseline_end_date)
    || !isDate(value.forecast_start_date) || !isDate(value.forecast_end_date)
    || !nullableDate(value.actual_start_date) || !nullableDate(value.actual_end_date)
    || !Number.isFinite(progress) || progress < 0 || progress > 100
    || (value.delay_reason !== null && typeof value.delay_reason !== 'string')
    || !nullableUuid(responsibleUserId)
    || !nullableUuid(predecessorScheduleItemId)) return null;

  return {
    id: value.id,
    tenant_id: value.tenant_id,
    project_id: value.project_id,
    site_id: value.site_id,
    work_package_id: value.work_package_id,
    org_unit_id: value.org_unit_id,
    title: value.title,
    baseline_start_date: value.baseline_start_date,
    baseline_end_date: value.baseline_end_date,
    forecast_start_date: value.forecast_start_date,
    forecast_end_date: value.forecast_end_date,
    actual_start_date: value.actual_start_date,
    actual_end_date: value.actual_end_date,
    progress_percent: progress,
    delay_reason: value.delay_reason,
    responsible_user_id: responsibleUserId,
    predecessor_schedule_item_id: predecessorScheduleItemId,
  };
}

export function parseScheduleItems(value: unknown): ConstructionScheduleItem[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ConstructionScheduleItem[] = [];
  for (const row of value) {
    const parsed = parseScheduleItem(row);
    if (!parsed) return null;
    rows.push(parsed);
  }
  return rows;
}
