import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261011030000_bind_manufacturing_lot_genealogy_evidence.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing lot genealogy migration shape', () => {
  it('persists Manufacturing-owned material issue evidence on production execution', () => {
    expect(migrationSql).toContain('ALTER TABLE public.manufacturing_production_executions');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS material_issue_evidence JSONB');
    expect(migrationSql).toContain('ck_manufacturing_execution_material_issue_evidence_object');
    expect(migrationSql).toContain("jsonb_typeof(material_issue_evidence) = 'object'");
  });

  it('adds only read-support indexes for Manufacturing genealogy lookup', () => {
    expect(migrationSql).toContain('idx_manufacturing_executions_material_lot');
    expect(migrationSql).toContain("material_issue_evidence #>> '{itemId}'");
    expect(migrationSql).toContain("material_issue_evidence #>> '{lotNumber}'");
    expect(migrationSql).toContain('idx_manufacturing_completions_receipt_evidence_gin');
    expect(migrationSql).toContain('receipt_evidence jsonb_path_ops');
  });

  it('does not introduce Logistics mutation, Finance posting, UI, or ProductRegistry surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('CREATE TABLE IF NOT EXISTS logistics.');
    expect(migrationSqlWithoutComments).not.toContain('ALTER TABLE logistics.');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
  });
});
