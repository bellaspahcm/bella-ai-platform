/**
 * BELLA EDUCATION — STATIC ARCHITECTURE GUARD
 *
 * Enforces strict Education OS Architectural Laws:
 * - Law 2: Product Bounded Scoping (no cross-vertical imports)
 * - Law 3: Contract-Only Access (no direct database queries to edu_*, students, assessment_*, attendance_*, journal_*)
 * - Kernel Decoupling: Zero imports of internal engine files outside platform/education/contracts.
 *
 * @module src/products/bella-education/__tests__/bella-education-architecture.test
 */

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { bellaEducationManifest } from '../manifest';

const BELLA_EDUCATION_ROOT = path.resolve(__dirname, '..');
const EDUCATION_SOURCE_ROOTS = [
  BELLA_EDUCATION_ROOT,
  path.resolve(__dirname, '../../../app/api/education'),
  path.resolve(__dirname, '../../../app/dashboard/education'),
];

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!filePath.includes('__tests__') && !filePath.includes('node_modules')) {
        results = results.concat(getAllTsFiles(filePath));
      }
    } else if (/\.tsx?$/.test(file) && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

function findUnapprovedViolations(violations: readonly string[], approved: Record<string, number>): string[] {
  const normalize = (signature: string) => signature.replace(/\\/g, '/').replace(/:L\d+\b/g, ':L*');
  const remaining = new Map<string, number>();
  for (const [signature, count] of Object.entries(approved)) {
    const stable = normalize(signature);
    remaining.set(stable, (remaining.get(stable) ?? 0) + count);
  }
  return violations.filter(signature => {
    const stable = normalize(signature);
    const count = remaining.get(stable) ?? 0;
    if (count <= 0) return true;
    remaining.set(stable, count - 1);
    return false;
  });
}

function explicitAnyViolations(file: string, content: string): string[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      violations.push(`${path.relative(BELLA_EDUCATION_ROOT, file)}:L${line} - Explicit any type is prohibited.`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

type DatabaseScanResult = { resources: { status: 'ALLOW' | 'BLOCK' }; legacy: Record<string, number> };
let databaseScanResult: DatabaseScanResult | undefined;
function scanDatabaseControls(): DatabaseScanResult {
  if (databaseScanResult) return databaseScanResult;
  const repositoryRoot = path.resolve(__dirname, '../../../..');
  const scanner = pathToFileURL(path.join(repositoryRoot, 'scripts/ci-run-education-architecture.mjs')).href;
  const code = [
    `import { scanViolations, scanDatabaseAccesses, evaluateDatabaseControls, loadDispositionMetadata } from ${JSON.stringify(scanner)};`,
    "import { readFileSync } from 'node:fs';",
    "const baseline = JSON.parse(readFileSync('.github/ci/education-architecture-baselines.json', 'utf8'));",
    'const accesses = await scanDatabaseAccesses();',
    'const legacy = (await scanViolations()).directDatabaseAccess;',
    'const result = evaluateDatabaseControls(baseline.directDatabaseAccess.violations, legacy, accesses, loadDispositionMetadata());',
    'process.stdout.write(JSON.stringify({ resources: result.resources, legacy: result.effectiveLegacyCounts }));',
  ].join('\n');
  databaseScanResult = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as DatabaseScanResult;
  return databaseScanResult;
}

describe('Bella Education V1 — Static Architecture Guard', () => {
  const sourceFiles = EDUCATION_SOURCE_ROOTS.flatMap(getAllTsFiles);

  it('Law 3: exact resource access stays within bounded debt and approved contract paths', () => {
    expect(scanDatabaseControls().resources.status).toBe('ALLOW');
  });

  it('Law 3: legacy database matches stay within reviewed debt after exact contract dispositions', () => {
    const violations = Object.entries(scanDatabaseControls().legacy)
      .flatMap(([signature, count]) => Array.from({ length: count }, () => signature));

    // Load approved baseline from .github/ci/education-architecture-baselines.json
    const baselineFile = path.resolve(__dirname, '../../../../.github/ci/education-architecture-baselines.json');
    let approvedViolations: Record<string, number> = {};
    if (fs.existsSync(baselineFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
        approvedViolations = raw.directDatabaseAccess?.violations || {};
      } catch {
        approvedViolations = {};
      }
    }

    const unapprovedViolations = findUnapprovedViolations(violations, approvedViolations);

    expect(unapprovedViolations).toEqual([]);
  });

  it('Strict Typing: Zero Explicit Any Types', () => {
    expect(sourceFiles.flatMap(file => explicitAnyViolations(file, fs.readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('Law 3: Zero Internal Kernel Imports (only contracts allowed)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit direct imports from internal engines/repositories for education or accounting
        const internalKernelPattern = /import\s+.*\s+from\s+['"].*(platform\/(education|accounting)\/(engines|repositories|domain))\b/;
        if (internalKernelPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_EDUCATION_ROOT, file)}:L${index + 1} - Direct import of internal Kernel modules is prohibited. Use Public Contracts instead.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Law 2: Zero Cross-Vertical Leakage (no imports of other product verticals)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit cross-vertical imports to healthcare or real-estate products
        const crossVerticalPattern = /import\s+.*\s+from\s+['"].*products\/(bella-medical|bella-dental|bella-land)\b/;
        if (crossVerticalPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_EDUCATION_ROOT, file)}:L${index + 1} - Cross-vertical import of other product layers is prohibited.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Manifest Compliance: Manifest.ts capability list is present', () => {
    expect(bellaEducationManifest.id).toBe('bella-education');
    expect(bellaEducationManifest.capabilities).toContain('course_catalog_query');
    expect(bellaEducationManifest.capabilities).toContain('student_enrollment_command');
    expect(bellaEducationManifest.capabilities).toContain('attendance_checkpoint_command');
    expect(bellaEducationManifest.capabilities).toContain('grade_reporting_command');
  });
});

describe('Education guard regression controls', () => {
  const approved = { 'service.ts:L10 - Direct RPC': 1 };
  it('allows line movement and reductions within the reviewed count', () => {
    expect(findUnapprovedViolations(['service.ts:L50 - Direct RPC'], approved)).toEqual([]);
    expect(findUnapprovedViolations([], approved)).toEqual([]);
  });
  it('rejects an extra occurrence of an existing signature', () => {
    expect(findUnapprovedViolations(['service.ts:L50 - Direct RPC', 'service.ts:L60 - Direct RPC'], approved))
      .toEqual(['service.ts:L60 - Direct RPC']);
  });
  it('rejects a new signature', () => {
    expect(findUnapprovedViolations(['other.ts:L10 - Direct RPC'], approved)).toHaveLength(1);
  });
  it('distinguishes actual any types from comments and strings in TSX', () => {
    expect(explicitAnyViolations('fixture.tsx', 'const label = "any"; // any\nconst view = <div>any</div>;')).toEqual([]);
    expect(explicitAnyViolations('fixture.tsx', 'type Event<T = any> = { payload: T };')).toHaveLength(1);
  });
});
