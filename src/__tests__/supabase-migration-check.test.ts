const {
  analyzeMigrationState,
  getSupabaseMigrationListArgs,
  listLocalMigrationVersions,
  parseSupabaseMigrationList,
} = require('../../scripts/check-supabase-migrations.cjs');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

describe('Supabase migration check script', () => {
  it('uses the Supabase CLI v3 remote database URL flag', () => {
    const previousDbUrl = process.env.SUPABASE_DB_URL;
    const previousDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
    const expectedUrl = 'postgresql://ci.example/bella';

    try {
      process.env.SUPABASE_DB_URL = expectedUrl;
      delete process.env.SUPABASE_DATABASE_URL;

      expect(getSupabaseMigrationListArgs()).toEqual([
        '--yes', 'supabase', 'migration', 'list', `--remote=${expectedUrl}`,
      ]);
    } finally {
      if (previousDbUrl === undefined) delete process.env.SUPABASE_DB_URL;
      else process.env.SUPABASE_DB_URL = previousDbUrl;

      if (previousDatabaseUrl === undefined) delete process.env.SUPABASE_DATABASE_URL;
      else process.env.SUPABASE_DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('parses Supabase CLI migration list output', () => {
    const output = `
      Local          | Remote         | Time (UTC)
    ----------------|----------------|---------------------
      20260606100000 | 20260606100000 | 2026-06-06 10:00:00
      20260606103000 |                | 2026-06-06 10:30:00
                     | 20260606104500 | 2026-06-06 10:45:00
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260606100000', remote: '20260606100000' },
      { local: '20260606103000', remote: null },
      { local: null, remote: '20260606104500' },
    ]);
  });

  it('parses current Supabase CLI JSON output with status prelude', () => {
    const output = `Connecting to remote database...
{"migrations":[{"local":"20260912100000","remote":"","time":"2026-09-12 10:00:00"},{"local":"20261002040000","remote":"20261002040000","time":"2026-10-02 04:00:00"}],"message":"Migrations listed"}
A new version of Supabase CLI is available.`;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260912100000', remote: null },
      { local: '20261002040000', remote: '20261002040000' },
    ]);
  });

  it('parses table output with backtick-wrapped migration ids', () => {
    const output = `
      Local            | Remote           | Time (UTC)
    ------------------|------------------|---------------------
      \`20260912100000\` | \` \`              | \`2026-09-12 10:00:00\`
      \`20261002040000\` | \`20261002040000\` | \`2026-10-02 04:00:00\`
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260912100000', remote: null },
      { local: '20261002040000', remote: '20261002040000' },
    ]);
  });

  it('normalizes legacy 8-digit migration versions to the Supabase ledger version', () => {
    const output = `
      Local          | Remote         | Time (UTC)
    ----------------|----------------|---------------------
      20260914       | 20260914000000 | 2026-09-14 00:00:00
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260914000000', remote: '20260914000000' },
    ]);
  });

  it('includes legacy 8-digit local migration filenames in repository history comparison', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bella-migrations-'));
    try {
      writeFileSync(join(dir, '20260914_create_user_org_unit_access_projection.sql'), '-- legacy migration');
      writeFileSync(join(dir, '20261004010000_add_branch_id_to_attendance.sql'), '-- standard migration');

      expect(listLocalMigrationVersions(dir)).toEqual([
        '20260914000000',
        '20261004010000',
      ]);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('detects local migrations missing from the remote database', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000', '20260606113000'],
      ['20260606100000']
    );

    expect(state.isSynced).toBe(false);
    expect(state.latestLocal).toBe('20260606113000');
    expect(state.latestRemote).toBe('20260606100000');
    expect(state.pendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.newPendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.grandfatheredPendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual([]);
  });

  it('grandfathers local migration drift already present at the baseline ref', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000'],
      ['20260606100000'],
      ['20260606100000', '20260606103000']
    );

    expect(state.isSynced).toBe(true);
    expect(state.pendingLocal).toEqual(['20260606103000']);
    expect(state.newPendingLocal).toEqual([]);
    expect(state.grandfatheredPendingLocal).toEqual(['20260606103000']);
    expect(state.remoteOnly).toEqual([]);
  });

  it('still detects new local migration drift beyond the baseline ref', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000', '20260606113000'],
      ['20260606100000'],
      ['20260606100000', '20260606103000']
    );

    expect(state.isSynced).toBe(false);
    expect(state.pendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.grandfatheredPendingLocal).toEqual(['20260606103000']);
    expect(state.newPendingLocal).toEqual(['20260606113000']);
    expect(state.remoteOnly).toEqual([]);
  });

  it('detects remote-only migration drift', () => {
    const state = analyzeMigrationState(
      ['20260606100000'],
      ['20260606100000', '20260606104500']
    );

    expect(state.isSynced).toBe(false);
    expect(state.pendingLocal).toEqual([]);
    expect(state.newPendingLocal).toEqual([]);
    expect(state.grandfatheredPendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual(['20260606104500']);
  });

  it('keeps the verified Construction migration version alias strict by default', () => {
    const state = analyzeMigrationState(
      ['20261104135713', '20261106042111'],
      ['20261104223802', '20261106042111']
    );

    expect(state.isSynced).toBe(false);
    expect(state.remoteOnly).toEqual(['20261104223802']);
    expect(state.recognizedRemoteAliases).toEqual([]);
  });

  it('recognizes the verified Construction E2E migration version alias in isolated E2E mode', () => {
    const state = analyzeMigrationState(
      ['20261104135713', '20261106042111'],
      ['20261104223802', '20261106042111'],
      null,
      true,
    );

    expect(state.isSynced).toBe(true);
    expect(state.pendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual([]);
    expect(state.recognizedRemoteAliases).toEqual([
      { remote: '20261104223802', local: '20261104135713' },
    ]);
  });

  it('does not ignore an alias when its local migration is absent', () => {
    const state = analyzeMigrationState(
      ['20261106042111'],
      ['20261104223802', '20261106042111'],
      null,
      true,
    );

    expect(state.isSynced).toBe(false);
    expect(state.remoteOnly).toEqual(['20261104223802']);
    expect(state.recognizedRemoteAliases).toEqual([]);
  });

  it('passes when local and remote migrations match exactly', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606113000'],
      ['20260606100000', '20260606113000']
    );

    expect(state.isSynced).toBe(true);
    expect(state.pendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual([]);
  });
});
