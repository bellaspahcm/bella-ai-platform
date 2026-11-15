const {
  applyMigration,
  assertIsolatedE2eTarget,
  createE2eMigrationClient,
  ensureInteriorHistoryHardeningBaseline,
  assertInteriorTriggerHelpersHardened,
  inspectInteriorTriggerHardeningBaseline,
  needsInteriorTriggerHardeningDiagnostic,
} = require('../../scripts/apply-e2e-pr-migrations.cjs');

describe('isolated E2E migration target', () => {
  const expectedRef = 'bmnbqbcdbuklhopfbopv';
  const prodRef = 'lvnvkpyxtuilhrabtlwv';
  const apiUrl = `https://${expectedRef}.supabase.co`;
  const scheme = 'postgresql:';
  const fakePassword = ['fixture', 'password'].join('-');
  const poolerHost = 'aws-1-ap-southeast-1.pooler.supabase.com';
  const dbUrl = (user: string, host: string, port = 5432, database = 'postgres', query = '') =>
    `${scheme}//${user}:${fakePassword}@${host}:${port}/${database}${query}`;
  const direct = dbUrl('postgres', `db.${expectedRef}.supabase.co`, 5432, 'postgres', '?sslmode=require');
  const pooler = dbUrl(`postgres.${expectedRef}`, poolerHost, 6543, 'postgres', '?sslmode=require');

  it.each([direct, pooler])('accepts only the configured isolated project endpoint', (url) => {
    expect(() => assertIsolatedE2eTarget(url, expectedRef, apiUrl)).not.toThrow();
  });

  it.each([
    dbUrl('postgres', `db.${prodRef}.supabase.co`),
    dbUrl(`postgres.${prodRef}`, poolerHost, 6543),
    dbUrl('postgres', `db.${expectedRef}.supabase.co.evil.example`),
    dbUrl(`postgres.${expectedRef}.evil`, poolerHost, 6543),
    dbUrl('postgres', `db.${expectedRef}.supabase.co`, 5432, 'postgres', `?host=db.${prodRef}.supabase.co`),
    dbUrl(`postgres.${expectedRef}`, poolerHost, 6543, 'postgres', `?user=postgres.${prodRef}`),
    dbUrl('postgres', `db.${expectedRef}.supabase.co`, 5432, 'postgres', `?%68ost=db.${prodRef}.supabase.co`),
    dbUrl('postgres', `db.${expectedRef}.supabase.co`, 5432, 'postgres', '?sslmode=require&sslmode=disable'),
    dbUrl('postgres', `db.${expectedRef}.supabase.co`, 5432, 'other'),
    `not-a-url-with-${fakePassword}`,
  ])('rejects unsafe or ambiguous connection strings without exposing them', (url) => {
    try {
      assertIsolatedE2eTarget(url, expectedRef, apiUrl);
      throw new Error('EXPECTED_REJECTION');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('E2E_DATABASE_TARGET_REJECTED');
    }
  });

  it('requires the explicit E2E project ref and rejects Production as the expected target', () => {
    expect(() => assertIsolatedE2eTarget(direct, undefined, apiUrl)).toThrow('E2E_DATABASE_TARGET_REJECTED');
    expect(() => assertIsolatedE2eTarget(direct, prodRef, apiUrl)).toThrow('E2E_DATABASE_TARGET_REJECTED');
  });

  it.each([
    `https://${prodRef}.supabase.co`,
    `https://${expectedRef}.supabase.co.evil.example`,
    `http://${expectedRef}.supabase.co`,
    `https://${expectedRef}.supabase.co/other`,
    'invalid-api-url',
  ])('rejects an API target that does not match the isolated DB', (targetApiUrl) => {
    expect(() => assertIsolatedE2eTarget(direct, expectedRef, targetApiUrl)).toThrow('E2E_DATABASE_TARGET_REJECTED');
  });

  it('rejects an invalid CI target before constructing the database client', () => {
    const ClientConstructor = jest.fn();
    expect(() => createE2eMigrationClient(
      dbUrl('postgres', `db.${prodRef}.supabase.co`),
      { CI: 'true', EXPECTED_E2E_PROJECT_REF: expectedRef, SUPABASE_URL: apiUrl },
      ClientConstructor,
    )).toThrow('E2E_DATABASE_TARGET_REJECTED');
    expect(ClientConstructor).not.toHaveBeenCalled();
  });

  it('rejects a Production API URL before constructing the E2E database client', () => {
    const ClientConstructor = jest.fn();
    expect(() => createE2eMigrationClient(
      direct,
      { CI: 'true', EXPECTED_E2E_PROJECT_REF: expectedRef, SUPABASE_URL: `https://${prodRef}.supabase.co` },
      ClientConstructor,
    )).toThrow('E2E_DATABASE_TARGET_REJECTED');
    expect(ClientConstructor).not.toHaveBeenCalled();
  });

  it('constructs the client for a validated CI URL and preserves non-CI behavior', () => {
    const ClientConstructor = jest.fn();
    createE2eMigrationClient(direct, { GITHUB_ACTIONS: 'true', EXPECTED_E2E_PROJECT_REF: expectedRef, SUPABASE_URL: apiUrl }, ClientConstructor);
    expect(ClientConstructor).toHaveBeenCalledWith({ connectionString: direct });
    createE2eMigrationClient('local-fixture', {}, ClientConstructor);
    expect(ClientConstructor).toHaveBeenLastCalledWith({ connectionString: 'local-fixture' });
  });
});

describe('Interior hardening E2E diagnostic', () => {
  const target = 'supabase/migrations/20261112230707_interior_trigger_function_hardening.sql';

  it('selects diagnostics only for the exact hardening migration', () => {
    expect(needsInteriorTriggerHardeningDiagnostic([{ file: target }])).toBe(true);
    expect(needsInteriorTriggerHardeningDiagnostic([{ file: `${target}.other` }])).toBe(false);
    expect(needsInteriorTriggerHardeningDiagnostic([])).toBe(false);
  });

  it('reports missing prerequisites using only read-only catalog queries', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ name: 'trg_record_interior_boq_item_history', present: true, owner: 'postgres', security_definer: true, configuration: [], explicit_acl: null, effective_acl: ['postgres:EXECUTE:true'] }] })
        .mockResolvedValueOnce({ rows: [{ name: 'interior_boq_item_history', present: false, rls_enabled: null }] })
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: [{ table_name: 'interior_boq_item_history', column_name: 'lineage_metadata', present: false }] })
        .mockResolvedValueOnce({ rows: [{ name: 'trg_interior_boq_items_history_capture', enabled: 'O', type: 27, function_name: 'trg_record_interior_boq_item_history' }] })
        .mockResolvedValueOnce({ rows: [{ name: 'history_select' }] })
        .mockResolvedValueOnce({ rows: [{ present: true, security_definer: true, configuration: ['search_path=""'], anon_execute: false, authenticated_execute: true }] })
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: [{ version: '20261109140000' }] }),
    };

    const diagnostic = await inspectInteriorTriggerHardeningBaseline(client);

    expect(diagnostic.functions).toContainEqual({ name: 'trg_record_interior_boq_item_history', present: true, owner: 'postgres', security_definer: true, configuration: [], explicit_acl: null, effective_acl: ['postgres:EXECUTE:true'] });
    expect(diagnostic.relations).toContainEqual({ name: 'interior_boq_item_history', present: false, rls_enabled: null });
    expect(diagnostic.triggers).toContainEqual({ name: 'trg_interior_boq_items_history_capture', enabled: 'O', type: 27, function_name: 'trg_record_interior_boq_item_history' });
    expect(diagnostic.policies).toEqual(['history_select']);
    expect(diagnostic.policyCount).toBe(1);
    expect(diagnostic.ledgerPresent).toBe(true);
    expect(diagnostic.versions).toEqual([{ version: '20261109140000' }]);
    expect(diagnostic.authUsersPresent).toBe(true);
    expect(diagnostic.historyReadFunction).toEqual({
      present: true,
      security_definer: true,
      configuration: ['search_path=""'],
      anon_execute: false,
      authenticated_execute: true,
    });
    expect(client.query).toHaveBeenCalledTimes(9);
    const columnParameters = client.query.mock.calls[3][1];
    const columnsByTable = columnParameters[0].map((table: string, i: number) => `${table}.${columnParameters[1][i]}`);
    expect(columnsByTable).toEqual(expect.arrayContaining([
      'interior_boqs.id', 'interior_boqs.tenant_id', 'interior_boqs.version_number',
      'interior_boq_items.source_takeoff_component_id', 'interior_boq_items.stable_component_id',
      'interior_boq_item_history.lineage_metadata', 'interior_boq_item_history.actor_id',
    ]));
    expect(client.query.mock.calls[8][1][0]).toContain('20261109124658');
    for (const [query] of client.query.mock.calls) {
      expect((query as string).trim()).toMatch(/^SELECT\b/i);
    }
  });

  it('does not query a missing ledger table', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ present: false }] }),
    };
    const diagnostic = await inspectInteriorTriggerHardeningBaseline(client);
    expect(diagnostic.ledgerPresent).toBe(false);
    expect(diagnostic.versions).toEqual([]);
    expect(diagnostic.policyCount).toBe(0);
    expect(client.query).toHaveBeenCalledTimes(8);
  });

  it('fails closed on a partial Interior baseline without issuing DDL', async () => {
    const client = { query: jest.fn() };
    const partial = {
      relations: [{ name: 'interior_boq_item_history', present: false, rls_enabled: null }],
      columns: [],
      functions: [],
      triggers: [],
      policies: [],
      policyCount: 0,
      versions: [{ version: '20261109124658' }, { version: '20261109140000' }],
      ledgerPresent: true,
      authUsersPresent: true,
      historyReadFunction: {
        present: true,
        security_definer: true,
        configuration: ['search_path=""'],
        anon_execute: false,
        authenticated_execute: true,
      },
    };

    await expect(ensureInteriorHistoryHardeningBaseline(client, [{ file: target }], partial))
      .rejects.toThrow('INTERIOR_E2E_BASELINE_PARTIAL');
    expect(client.query).not.toHaveBeenCalled();
  });

  it('verifies all helper ACLs and only the migration-owned search_path changes', async () => {
    const rows = [
      'guard_interior_quotation_items_immutability', 'guard_interior_quotations_immutability',
      'guard_interior_contracts_immutability', 'guard_interior_payment_milestones_immutability',
      'guard_interior_customer_approvals_immutability', 'interior_customer_approvals_updated_at',
      'interior_guard_boq_approval', 'trg_record_interior_boq_item_history',
    ].map((name) => ({
      name,
      present: true,
      anon_execute: false,
      authenticated_execute: false,
      service_role_execute: false,
      configuration: name === 'interior_guard_boq_approval' ? ['search_path=""'] : ['search_path=pg_catalog'],
    }));
    const client = { query: jest.fn().mockResolvedValue({ rows }) };
    const before = {
      functions: [{ name: 'interior_guard_boq_approval', configuration: ['search_path=""'] }],
    };

    await expect(assertInteriorTriggerHelpersHardened(client, [{ file: target }], before)).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect((client.query.mock.calls[0][0] as string).trim()).toMatch(/^SELECT\b/i);
  });
});

describe('apply-e2e-pr-migrations', () => {
  it('skips an equivalent migration when the ledger uses another name, version, and statement split', async () => {
    const migration = {
      version: '20261106120000',
      name: 'example_migration',
      sql: [
        '-- zero-downtime: allow blocking-index - table is new and empty',
        '-- Bella Platform direct action grants',
        'CREATE TABLE public.example (id uuid PRIMARY KEY);',
        'CREATE INDEX example_id_idx ON public.example (id);',
      ].join('\r\n'),
    };
    const appliedSql: string[] = [];
    const client = {
      async query(sql: string) {
        if (sql.includes('WHERE version = $1')) return { rowCount: 0, rows: [] };
        if (sql.includes('information_schema.columns')) {
          return { rows: [{ column_name: 'name' }, { column_name: 'statements' }] };
        }
        if (sql.includes('WHERE version <> $1 AND statements IS NOT NULL')) {
          return {
            rows: [{
              version: '20261105110000',
              name: 'generated_cli_alias',
              statements: [
                '-- Bella Platform direct action grants\nCREATE TABLE public.example (id uuid PRIMARY KEY)',
                'CREATE INDEX example_id_idx ON public.example (id)',
              ],
            }],
          };
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
        if (sql.includes('WHERE version <> $1 AND statements IS NOT NULL')) {
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

  it('does not ignore regular SQL comments when comparing recorded migrations', async () => {
    const migration = {
      version: '20261106120002',
      name: 'example_migration',
      sql: '-- updated behavior note\nCREATE TABLE public.example (id uuid PRIMARY KEY);',
    };
    const appliedSql: string[] = [];
    const client = {
      async query(sql: string) {
        if (sql.includes('WHERE version = $1')) return { rowCount: 0, rows: [] };
        if (sql.includes('information_schema.columns')) {
          return { rows: [{ column_name: 'name' }, { column_name: 'statements' }] };
        }
        if (sql.includes('WHERE version <> $1 AND statements IS NOT NULL')) {
          return {
            rows: [{
              version: '20261105110000',
              statements: ['-- previous behavior note\nCREATE TABLE public.example (id uuid PRIMARY KEY);'],
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
