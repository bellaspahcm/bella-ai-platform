const {
  analyzeSql,
  maskSqlLiteralsAndComments,
} = require('../../scripts/check-zero-downtime-migrations.cjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const attendanceMigration = 'supabase/migrations/20261026152000_harden_education_attendance_access.sql';
const attendanceException = '-- zero-downtime: reviewed-attendance-write-revoke';
const reviewedRevoke = 'REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.edu_attendance,public.edu_attendance_daily_state FROM PUBLIC,anon,authenticated;';

describe('zero-downtime migration policy', () => {
  it('accepts additive schema changes and concurrent indexes', () => {
    const sql = [
      'ALTER TABLE customers ADD COLUMN preferred_name text;',
      'CREATE INDEX CONCURRENTLY idx_customers_name ON customers(preferred_name);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });

  it.each([
    ['DROP TABLE customers;', 'drop-object'],
    ['DROP MATERIALIZED VIEW customer_totals;', 'drop-object'],
    ['ALTER TABLE customers DROP COLUMN phone;', 'drop-column'],
    ['TRUNCATE TABLE customers;', 'truncate'],
    ['ALTER TABLE customers ALTER COLUMN phone TYPE bigint;', 'alter-column-type'],
    ['ALTER TABLE customers RENAME COLUMN phone TO mobile;', 'rename-table-or-column'],
    ['ALTER TABLE customers ALTER COLUMN phone SET NOT NULL;', 'set-not-null'],
    ['ALTER TABLE customers VALIDATE CONSTRAINT customers_phone_check;', 'validate-constraint'],
    ['CREATE INDEX idx_customers_phone ON customers(phone);', 'blocking-index'],
  ])('blocks unsafe SQL: %s', (sql, code) => {
    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code, line: 1 }),
    ]);
  });

  it('detects destructive statements inside dollar-quoted procedural bodies', () => {
    const sql = [
      'DO $body$',
      'BEGIN',
      '  DROP TABLE customers;',
      'END',
      '$body$;',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([
      expect.objectContaining({ code: 'drop-object', line: 3 }),
    ]);
  });

  it('ignores keywords in strings, quoted identifiers, and comments', () => {
    const sql = [
      "-- DROP TABLE customers;",
      "SELECT 'TRUNCATE TABLE customers';",
      'SELECT "DROP TABLE customers";',
      '/* DROP VIEW customer_totals; */',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
    expect(maskSqlLiteralsAndComments(sql)).toHaveLength(sql.length);
  });

  it('requires a scoped exception code and rationale', () => {
    const sql = [
      '-- zero-downtime: allow blocking-index - table is empty before launch',
      'CREATE INDEX idx_new_table_code ON new_table(code);',
    ].join('\n');

    expect(analyzeSql(sql)).toEqual([]);
  });

  describe('reviewed attendance privilege revocation', () => {
    const exceptionSql = [attendanceException, reviewedRevoke].join('\n');

    it.each(['\n', '\r\n'])('accepts only the reviewed statement and file with %j line endings', newline => {
      expect(analyzeSql(exceptionSql.replace(/\n/g, newline), attendanceMigration)).toEqual([]);
    });

    it('accepts the Windows path of the same reviewed migration', () => {
      expect(analyzeSql(exceptionSql, attendanceMigration.replace(/\//g, '\\'))).toEqual([]);
    });

    it.each(['', 'supabase/migrations/20261026152001_other.sql'])('rejects the exception in an unreviewed file: %j', file => {
      expect(analyzeSql(exceptionSql, file)).toEqual([expect.objectContaining({ code: 'truncate' })]);
    });

    it.each([
      ['missing marker', reviewedRevoke],
      ['changed table', exceptionSql.replace('public.edu_attendance_daily_state', 'public.other_state')],
      ['changed grantee', exceptionSql.replace('PUBLIC,anon,authenticated', 'PUBLIC,anon')],
      ['changed grant direction', exceptionSql.replace('REVOKE ', 'GRANT ').replace(' FROM ', ' TO ')],
      ['actual truncation', `${attendanceException}\nTRUNCATE public.edu_attendance;`],
    ])('does not apply to %s', (_label, sql) => {
      expect(analyzeSql(sql, attendanceMigration).some((finding: { code: string }) => finding.code === 'truncate')).toBe(true);
    });

    it.each([
      ['before', `TRUNCATE public.edu_attendance;\n${exceptionSql}`],
      ['after', `${exceptionSql}\nTRUNCATE public.edu_attendance;`],
      ['same line', `${exceptionSql} TRUNCATE public.edu_attendance;`],
      ['procedural body', `DO $body$\nBEGIN\n${exceptionSql}\nTRUNCATE public.edu_attendance;\nEND;\n$body$;`],
    ])('still detects an actual TRUNCATE %s the reviewed revoke', (_label, sql) => {
      expect(analyzeSql(sql, attendanceMigration).some((finding: { code: string; statement: string }) =>
        finding.code === 'truncate' && finding.statement === 'TRUNCATE')).toBe(true);
    });

    it('accepts the full forward package through the same analyzer used by the CLI', () => {
      expect(analyzeSql(readFileSync(resolve(attendanceMigration), 'utf8'), attendanceMigration)).toEqual([]);
    });
  });
});
