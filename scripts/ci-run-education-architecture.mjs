import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const feeProgramAdapter = 'fee-program/fee-program.persistence.ts';
const feeProgramPublishRpc = 'preschool_publish_fee_program_version';

const baselinePath =
  process.env.CI_EDUCATION_ARCHITECTURE_BASELINES ||
  '.github/ci/education-architecture-baselines.json';
const root = path.resolve('src/products/bella-education');
const manifestPath = path.resolve('.github/ci/education-product-persistence-ownership.json');
const expected = {
  product: 'bella_preschool',
  adapter: 'src/products/bella-education/care-wellbeing/nutrition/weekly-menu.persistence.ts',
  rpc: 'preschool_save_weekly_menu',
  tables: ['public.edu_weekly_menus', 'public.edu_weekly_menu_days'],
};

function validateManifest() {
  const raw = readFileSync(manifestPath, 'utf8');
  const parsed = ts.parseJsonText(manifestPath, raw);
  if (parsed.parseDiagnostics.length) throw new Error('invalid JSON');
  function noDuplicateKeys(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set();
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.name) || names.has(prop.name.text)) throw new Error('duplicate or invalid key');
        names.add(prop.name.text);
      }
    }
    ts.forEachChild(node, noDuplicateKeys);
  }
  noDuplicateKeys(parsed);
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object'
      || Object.keys(value).sort().join(',') !== 'adapter,product,rpc,tables'
      || value.product !== expected.product || value.adapter !== expected.adapter || value.rpc !== expected.rpc
      || !Array.isArray(value.tables) || value.tables.length !== 2
      || value.tables[0] !== expected.tables[0] || value.tables[1] !== expected.tables[1]) throw new Error('invalid scope');
  let candidate = process.cwd();
  for (const component of value.adapter.split('/')) {
    candidate = path.join(candidate, component);
    if (!existsSync(candidate)) break;
    if (lstatSync(candidate).isSymbolicLink()) throw new Error('symlink path');
  }
  return value;
}

let ownership;
try { ownership = validateManifest(); } catch {
  console.error('WEEKLY_MENU_MANIFEST_INVALID');
  process.exit(1);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function getAllTsFiles(dir, includeTsx = false) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (filePath.includes('__tests__') || filePath.includes('node_modules')) continue;
      results.push(...await getAllTsFiles(filePath, includeTsx));
    } else if ((entry.name.endsWith('.ts') || (includeTsx && entry.name.endsWith('.tsx'))) && !entry.name.endsWith('.d.ts')) {
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

function scanFeeProgramAdapter(content, relativeFile, violations) {
  const source = ts.createSourceFile(relativeFile, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let approvedCalls = 0;
  const reject = (node) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    addCount(violations.directDatabaseAccess, `${relativeFile}:L${line} - Fee Program adapter RPC exception violation.`);
  };
  if (source.parseDiagnostics.length) reject(source);
  function visit(node) {
    if (ts.isElementAccessExpression(node)) reject(node);
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) reject(node);
    if (ts.isNewExpression(node) && !(ts.isIdentifier(node.expression) && node.expression.text === 'Error')) reject(node);
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const isRpc = ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)
        && expr.expression.text === 'client' && expr.name.text === 'rpc';
      const isArrayCheck = ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)
        && expr.expression.text === 'Array' && expr.name.text === 'isArray'
        && !expr.questionDotToken && !node.questionDotToken && node.arguments.length === 1;
      if (!isRpc && !isArrayCheck) reject(node);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'rpc') {
      const call = node.parent;
      if (!node.questionDotToken && ts.isIdentifier(node.expression) && node.expression.text === 'client'
        && ts.isCallExpression(call) && call.expression === node && !call.questionDotToken
        && call.arguments.length === 2 && ts.isStringLiteral(call.arguments[0])
        && call.arguments[0].text === feeProgramPublishRpc) approvedCalls++;
      else reject(node);
    }
    if (ts.isIdentifier(node) && node.text === 'rpc'
      && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) reject(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (approvedCalls !== 1) reject(source);
}

function scanFeeProgramCaller(content, relativeFile, violations) {
  const source = ts.createSourceFile(relativeFile, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines = content.split('\n');
  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === feeProgramPublishRpc) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      // The existing line scanner already records a direct literal .rpc call on this line.
      if (!/\.rpc\s*\(\s*['"`]/.test(lines[line])) {
        addCount(violations.directDatabaseAccess, `${relativeFile}:L${line + 1} - Fee Program publish RPC is restricted to its registered adapter.`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

export async function scanViolations(scanRoot = root) {
  const files = await getAllTsFiles(scanRoot);
  const violations = {
    directDatabaseAccess: {},
    internalKernelImports: {},
    crossVerticalLeakage: {},
  };

  // Reserve this RPC name across Product source trees without changing the
  // existing treatment of unrelated dynamic Finance/Chain calls.
  const productsRoot = path.resolve('src/products');
  for (const productFile of await getAllTsFiles(productsRoot, true)) {
    if (productFile.startsWith(root + path.sep)) continue;
    const text = await readFile(productFile, 'utf8');
    if (!text.includes('preschool_save_weekly_menu')) continue;
    const source = ts.createSourceFile(productFile, text, ts.ScriptTarget.Latest, true);
    // Until graph-aware name resolution is proven, any reference to this
    // reserved name in another Product is rejected, including aliases.
    function visitReserved(node) {
      if (ts.isStringLiteral(node) && node.text === 'preschool_save_weekly_menu') {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        addCount(violations.directDatabaseAccess,
          `${normalizePath(path.relative(productsRoot, productFile))}:L${line} - Weekly Menu RPC name outside owning Product.`);
      }
      ts.forEachChild(node, visitReserved);
    }
    visitReserved(source);
  }

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');
    const relativeFile = normalizePath(path.relative(scanRoot, file));
    const allowedRpcLines = new Map();

    // F09: reject unresolved RPC names and computed DB method access inside
    // the Weekly Menu module. The existing literal/baseline checks remain.
    // This does not grant any RPC exception or prove cross-file isolation.
    if (relativeFile.startsWith('care-wellbeing/nutrition/weekly-menu.')) {
      const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)
            && node.name.elements.some(element => (element.propertyName ?? element.name).getText(source) === 'rpc')) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          addCount(violations.directDatabaseAccess,
            `${relativeFile}:L${line} - Weekly Menu destructured RPC access is prohibited.`);
        }
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const property = ts.isPropertyAccessExpression(expression) ? expression.name.text : null;
          const bracket = ts.isElementAccessExpression(expression)
            && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : null;
          const rpcDynamic = property === 'rpc' && (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0]));
          const computedDatabaseMethod = bracket === 'rpc' || bracket === 'from'
            || (ts.isElementAccessExpression(expression) && !ts.isStringLiteral(expression.argumentExpression));
          if (property === 'rpc') {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            const name = node.arguments[0];
            const valid = path.resolve(file) === path.resolve(ownership.adapter)
              && name && ts.isStringLiteral(name) && name.text === ownership.rpc;
            const prior = allowedRpcLines.get(line);
            allowedRpcLines.set(line, prior === undefined ? valid : false);
          }
          if (rpcDynamic || computedDatabaseMethod) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            addCount(violations.directDatabaseAccess,
              `${relativeFile}:L${line} - Weekly Menu unresolved or computed database access is prohibited.`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }

    if (relativeFile === feeProgramAdapter) scanFeeProgramAdapter(content, relativeFile, violations);
    else scanFeeProgramCaller(content, relativeFile, violations);

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
      if (relativeFile !== feeProgramAdapter && rpcPattern.test(line) && allowedRpcLines.get(lineNumber) !== true) {
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

async function main() {
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
