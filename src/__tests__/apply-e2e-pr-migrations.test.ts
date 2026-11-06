const { applyMigration } = require('../../scripts/apply-e2e-pr-migrations.cjs');

describe('apply-e2e-pr-migrations', () => {
  it('skips a migration recorded under another version only when SQL matches apart from standalone comments', async () => {
    const existingSql = [
      '-- previous migration header',
      'CREATE TABLE public.example (id uuid PRIMARY KEY);',
      'CREATE INDEX example_id_idx ON public.example (id);',
    ].join('\n');
    const migration = {
      version: '20261106120000',
      name: 'example_migration',
      sql: [
        '-- zero-downtime: reviewed existing table',
        '-- current migration header',
        'CREATE TABLE public.example (id uuid PRIMARY KEY);',
        'CREATE INDEX example_id_idx ON public.example (id);',
      ].join('\n'),
    };
    const appliedSql: string[] = [];
    const client = {
      async query(sql: string) {
        if (sql.includes('WHERE version = $1')) return { rowCount: 0, rows: [] };
        if (sql.includes('information_schema.columns')) {
          return { rows: [{ column_name: 'name' }, { column_name: 'statements' }] };
        }
        if (sql.includes('WHERE name = $1 AND version <> $2')) {
          return { rows: [{ version: '20261105110000', statements: [existingSql] }] };
        }
        appliedSql.push(sql);
        return { rowCount: 1, rows: [] };
      },
    };

    await applyMigration(client, migration);

    expect(appliedSql).toEqual([]);
  });

  it('does not treat a meaningful SQL difference as an already-applied migration', async () => {
    const migration = {
      version: '20261106120001',
      name: 'example_migration',
      sql: 'CREATE TABLE public.example (id uuid PRIMARY KEY);',
    };
    const appliedSql: string[] = [];
    const client = {
      async query(sql: string) {
        if (sql.includes('WHERE version = $1')) return { rowCount: 0, rows: [] };
        if (sql.includes('information_schema.columns')) {
          return { rows: [{ column_name: 'name' }, { column_name: 'statements' }] };
        }
        if (sql.includes('WHERE name = $1 AND version <> $2')) {
          return {
            rows: [{
              version: '20261105110000',
              statements: ['CREATE TABLE public.example (id uuid PRIMARY KEY, name text);'],
            }],
          };
        }
        appliedSql.push(sql);
        return { rowCount: 1, rows: [] };
      },
    };

    await applyMigration(client, migration);

    expect(appliedSql).toContain(migration.sql);
  });
});
