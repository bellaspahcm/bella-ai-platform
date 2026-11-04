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
import { bellaEducationManifest } from '../manifest';

const BELLA_EDUCATION_ROOT = path.resolve(__dirname, '..');

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
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Bella Education V1 — Static Architecture Guard', () => {
  const sourceFiles = getAllTsFiles(BELLA_EDUCATION_ROOT);

  it('Law 3: Zero Direct Kernel Database Access (edu_*, students, assessment_*, attendance_*, journal_*)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Check for direct table query access to edu_*, students, assessment_*, attendance_*, journal_*
        const tablePattern = /\.from\s*\(\s*['"`](edu_|students|assessment_|attendance_|journal_)/;
        if (tablePattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_EDUCATION_ROOT, file)}:L${index + 1} - Direct database query targeting '${line.match(tablePattern)?.[0]}' is prohibited in the Product layer.`
          );
        }

        // Check for direct RPC database client calls
        const rpcPattern = /\.rpc\s*\(\s*['"`]/;
        if (rpcPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_EDUCATION_ROOT, file)}:L${index + 1} - Direct RPC database execution is prohibited in the Product layer.`
          );
        }
      });
    });

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

    const normalizeViolationSignature = (sig: string) => sig.replace(/\\/g, '/').replace(/:L\d+\b/g, ':L*');
    const stableBaseline: Record<string, number> = {};
    for (const [sig, count] of Object.entries(approvedViolations)) {
      const stable = normalizeViolationSignature(sig);
      stableBaseline[stable] = (stableBaseline[stable] ?? 0) + count;
    }

    const unapprovedViolations = violations.filter((v) => {
      const stable = normalizeViolationSignature(v);
      return !(stable in stableBaseline);
    });

    expect(unapprovedViolations).toEqual([]);
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
