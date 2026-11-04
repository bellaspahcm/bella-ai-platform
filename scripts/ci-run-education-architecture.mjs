import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const baselinePath =
  process.env.CI_EDUCATION_ARCHITECTURE_BASELINES ||
  '.github/ci/education-architecture-baselines.json';
const root = path.resolve('src/products/bella-education');

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function getAllTsFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (filePath.includes('__tests__') || filePath.includes('node_modules')) continue;
      results.push(...await getAllTsFiles(filePath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(filePath);
    }
  }

  return results;
}

function addCount(counts, signature) {
  counts[signature] = (counts[signature] ?? 0) + 1;
}

function normalizeViolationSignature(signature) {
  return signature.replace(/:L\d+\b/g, ':L*');
}

function normalizeViolationCounts(counts) {
  const normalized = {};
  for (const [signature, count] of Object.entries(counts)) {
    const stableSignature = normalizeViolationSignature(signature);
    normalized[stableSignature] = (normalized[stableSignature] ?? 0) + count;
  }
  return normalized;
}

function compareBaseline(baseline, current) {
  const stableBaseline = normalizeViolationCounts(baseline);
  const stableCurrent = normalizeViolationCounts(current);
  const added = [];
  const reduced = [];
  const signatures = new Set([...Object.keys(stableBaseline), ...Object.keys(stableCurrent)]);

  for (const signature of [...signatures].sort()) {
    const baselineCount = stableBaseline[signature] ?? 0;
    const currentCount = stableCurrent[signature] ?? 0;
    const delta = currentCount - baselineCount;

    if (delta > 0) {
      added.push({ signature, baselineCount, currentCount, delta });
    } else if (delta < 0) {
      reduced.push({ signature, baselineCount, currentCount, delta });
    }
  }

  const baselineTotal = Object.values(baseline).reduce((sum, count) => sum + count, 0);
  const currentTotal = Object.values(current).reduce((sum, count) => sum + count, 0);

  return {
    status: added.length > 0 ? 'BLOCK' : 'ALLOW',
    baselineTotal,
    currentTotal,
    added,
    reduced,
  };
}

async function scanViolations() {
  const files = await getAllTsFiles(root);
  const violations = {
    directDatabaseAccess: {},
    internalKernelImports: {},
    crossVerticalLeakage: {},
  };

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');
    const relativeFile = normalizePath(path.relative(root, file));

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      const lineNumber = index + 1;
      const tablePattern = /\.from\s*\(\s*['"`](edu_|students|assessment_|attendance_|journal_)/;
      const tableMatch = line.match(tablePattern);
      if (tableMatch) {
        addCount(
          violations.directDatabaseAccess,
          `${relativeFile}:L${lineNumber} - Direct database query targeting '${tableMatch[0]}' is prohibited in the Product layer.`
        );
      }

      const rpcPattern = /\.rpc\s*\(\s*['"`]/;
      if (rpcPattern.test(line)) {
        addCount(
          violations.directDatabaseAccess,
          `${relativeFile}:L${lineNumber} - Direct RPC database execution is prohibited in the Product layer.`
        );
      }

      const internalKernelPattern =
        /import\s+.*\s+from\s+['"].*(platform\/(education|accounting)\/(engines|repositories|domain))\b/;
      if (internalKernelPattern.test(line)) {
        addCount(
          violations.internalKernelImports,
          `${relativeFile}:L${lineNumber} - Direct import of internal Kernel modules is prohibited. Use Public Contracts instead.`
        );
      }

      const crossVerticalPattern =
        /import\s+.*\s+from\s+['"].*products\/(bella-medical|bella-dental|bella-land)\b/;
      if (crossVerticalPattern.test(line)) {
        addCount(
          violations.crossVerticalLeakage,
          `${relativeFile}:L${lineNumber} - Cross-vertical import of other product layers is prohibited.`
        );
      }
    });
  }

  return violations;
}

function loadBaselines() {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    return {};
  }
}

function printComparison(name, comparison) {
  console.log(`${name} baseline: ${comparison.baselineTotal}`);
  console.log(`${name} current: ${comparison.currentTotal}`);

  if (comparison.added.length > 0) {
    console.error(`New ${name} violation(s) detected; blocking.`);
    for (const item of comparison.added.slice(0, 25)) {
      console.error(`+${item.delta} ${item.signature}`);
    }
    if (comparison.added.length > 25) {
      console.error(`... ${comparison.added.length - 25} more new violation signature(s)`);
    }
  }

  if (comparison.reduced.length > 0) {
    console.log(`${name} debt reduced versus baseline; allowing improvement.`);
  } else if (comparison.added.length === 0 && comparison.currentTotal > 0) {
    console.log(`${name} matches reviewed baseline; allowing with bounded debt.`);
  } else if (comparison.currentTotal === 0) {
    console.log(`${name} has zero violations.`);
  }
}

const current = await scanViolations();
const baselines = loadBaselines();
const categories = [
  ['directDatabaseAccess', 'Education direct database access'],
  ['internalKernelImports', 'Education internal kernel import'],
  ['crossVerticalLeakage', 'Education cross-vertical leakage'],
];

let blocked = false;
for (const [key, label] of categories) {
  const comparison = compareBaseline(baselines[key]?.violations ?? {}, current[key]);
  printComparison(label, comparison);
  if (comparison.status === 'BLOCK') {
    blocked = true;
  }
}

if (blocked) {
  console.error('Education architecture baseline policy: BLOCK');
  process.exit(1);
}

console.log('Education architecture baseline policy: ALLOW');
