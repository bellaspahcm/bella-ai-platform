import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261105072547_construction_schedule_progress.sql'
  ),
  'utf8'
);
const assignmentMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261105075710_construction_schedule_responsibility_dependencies.sql'
  ),
  'utf8'
);
const atomicUpdateMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261105080412_construction_schedule_atomic_details_update.sql'
  ),
  'utf8'
);

describe('Construction schedule and progress migration', () => {
  it('adds Construction-owned schedule records scoped to the existing Work Package', () => {
    expect(migration).toContain('CREATE TABLE public.construction_schedule_items');
    expect(migration).toContain('fk_construction_schedule_items_work_package_scope');
    expect(migration).toContain('REFERENCES public.construction_work_packages(tenant_id, id, site_id, project_id, org_unit_id)');
    expect(migration).toContain('baseline_start_date');
    expect(migration).toContain('forecast_start_date');
    expect(migration).toContain('actual_start_date');
    expect(migration).toContain('progress_percent');
    expect(migration).toContain('delay_reason');
  });

  it('keeps the original baseline immutable and records the authenticated actor and time', () => {
    expect(migration).toContain('CONSTRUCTION_SCHEDULE_BASELINE_IMMUTABLE');
    expect(migration).toContain('NEW.updated_by := v_actor.id');
    expect(migration).toContain('NEW.updated_at := statement_timestamp()');
    expect(migration).toContain('NEW.created_at := statement_timestamp()');
  });

  it('checks trusted tenant, Org Unit and existing action permissions on each boundary', () => {
    expect(migration).toContain('public.platform_current_actor_profile()');
    expect(migration).toContain("'construction:foundation:read'");
    expect(migration).toContain("'construction:work_package:write'");
    expect(migration).toContain('public.construction_org_unit_access_allowed(tenant_id, org_unit_id)');
    expect(migration).toContain('CREATE POLICY construction_schedule_items_action_read');
    expect(migration).toContain('CREATE POLICY construction_schedule_items_action_insert');
    expect(migration).toContain('CREATE POLICY construction_schedule_items_action_update');
  });

  it('exposes authenticated RPCs and keeps invalid progress or dates out of persistence', () => {
    expect(migration).toContain('public.construction_create_schedule_item');
    expect(migration).toContain('public.construction_update_schedule_item');
    expect(migration).toContain('public.construction_list_schedule_items');
    expect(migration).toContain('progress_percent < 0 OR p_progress_percent > 100');
    expect(migration).toContain('p_forecast_start_date > p_forecast_end_date');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.construction_create_schedule_item');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.construction_create_schedule_item');
  });

  it('adds same-tenant responsibility and same-work-package predecessor constraints', () => {
    expect(assignmentMigration).toContain('responsible_user_id uuid');
    expect(assignmentMigration).toContain('predecessor_schedule_item_id uuid');
    expect(assignmentMigration).toContain('REFERENCES public.users(id) ON DELETE RESTRICT');
    expect(assignmentMigration).toContain('fk_construction_schedule_predecessor_same_package');
    expect(assignmentMigration).toContain("v_assignee_status IS DISTINCT FROM 'active'");
    expect(assignmentMigration).toContain('CONSTRUCTION_SCHEDULE_DEPENDENCY_CYCLE');
    expect(assignmentMigration).toContain('CONSTRUCTION_SCHEDULE_DEPENDENCY_DATE_CONFLICT');
  });

  it('wraps schedule creation and progress updates with assignment details atomically', () => {
    expect(assignmentMigration).toContain('public.construction_create_schedule_item_with_details');
    expect(assignmentMigration).toContain('public.construction_update_schedule_item_with_details');
    expect(assignmentMigration).toContain('LANGUAGE plpgsql');
    expect(assignmentMigration).toContain('SECURITY INVOKER');
    expect(assignmentMigration).toContain('GRANT EXECUTE ON FUNCTION public.construction_create_schedule_item_with_details');
    expect(assignmentMigration).toContain('GRANT EXECUTE ON FUNCTION public.construction_update_schedule_item_with_details');
  });

  it('validates the complete next schedule state in one update mutation', () => {
    expect(atomicUpdateMigration).toContain('SET forecast_start_date = p_forecast_start_date');
    expect(atomicUpdateMigration).toContain('responsible_user_id = p_responsible_user_id');
    expect(atomicUpdateMigration).toContain('predecessor_schedule_item_id = p_predecessor_schedule_item_id');
    expect(atomicUpdateMigration).not.toContain('public.construction_update_schedule_item(');
    expect(atomicUpdateMigration).toContain('SECURITY INVOKER');
  });
});
