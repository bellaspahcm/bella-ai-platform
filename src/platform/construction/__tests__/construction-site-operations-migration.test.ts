import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261105152641_construction_site_diary_issues.sql'),
  'utf8',
);

describe('Construction Site Diary and Issue migration', () => {
  it('allows multiple diary entries for the same Site and construction date', () => {
    expect(migration).toContain('CREATE TABLE public.construction_site_diary_entries');
    expect(migration).toContain('entry_date date NOT NULL');
    expect(migration).toContain('author_user_id uuid NOT NULL');
    expect(migration).not.toMatch(/UNIQUE\s*\([^)]*site_id\s*,\s*entry_date/i);
    expect(migration).toContain('CONSTRUCTION_SITE_DIARY_AUTHOR_OR_SCOPE_IMMUTABLE');
    expect(migration).toContain("'construction.site_diary.create'");
    expect(migration).toContain("'construction.site_diary.update'");
  });

  it('constrains diary, issue, Site and Work Package links to the same Tenant, Project, Site and Org Unit', () => {
    expect(migration).toContain('fk_construction_site_diary_site_scope');
    expect(migration).toContain('fk_construction_site_diary_work_package_scope');
    expect(migration).toContain('fk_construction_issues_site_scope');
    expect(migration).toContain('fk_construction_issues_diary_scope');
    expect(migration).toContain('fk_construction_issues_work_package_scope');
    expect(migration).toContain('REFERENCES public.construction_site_diary_entries(tenant_id, id, site_id, project_id, org_unit_id)');
  });

  it('implements only the defined Issue states and requires resolution and reopen evidence', () => {
    expect(migration).toContain("CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))");
    expect(migration).toContain('ck_construction_issues_resolved_result');
    expect(migration).toContain('ck_construction_issues_closed_timestamp');
    expect(migration).toContain('CONSTRUCTION_ISSUE_TRANSITION_INVALID');
    expect(migration).toContain('construction.issue.resolve');
    expect(migration).toContain('construction.issue.close');
    expect(migration).toContain('construction.issue.reopen');
    expect(migration).not.toContain('construction.issue.assign');
  });

  it('keeps authorization and RLS as independent checks and exposes no physical delete', () => {
    expect(migration).toContain('ALTER TABLE public.construction_site_diary_entries ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.construction_issues ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('public.construction_org_unit_access_allowed(tenant_id, org_unit_id)');
    expect(migration).toContain('public.platform_authorize_action');
    expect(migration).toContain('REVOKE ALL ON public.construction_site_diary_entries, public.construction_issues');
    expect(migration).not.toMatch(/GRANT\s+DELETE\b/i);
    expect(migration).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+public\.construction_(site_diary_entries|issues)\s+FOR DELETE/i);
  });

  it('preserves the five Construction permissions and enables direct grants for the new MVP actions', () => {
    for (const permission of [
      'construction:foundation:read',
      'construction:project:write',
      'construction:site:write',
      'construction:work_package:write',
      'construction:boq:write',
      'construction.site_diary.view',
      'construction.site_diary.create',
      'construction.site_diary.update',
      'construction.issue.view',
      'construction.issue.create',
      'construction.issue.update',
      'construction.issue.resolve',
      'construction.issue.close',
      'construction.issue.reopen',
    ]) {
      expect(migration).toContain(permission);
    }
  });
});
