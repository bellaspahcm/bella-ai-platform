import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const baselinePath =
  process.env.CI_EDUCATION_ARCHITECTURE_BASELINES ||
  '.github/ci/education-architecture-baselines.json';
const root = path.resolve('src/products/bella-education');
const sourceRoots = [root, path.resolve('src/app/api/education'), path.resolve('src/app/dashboard/education')];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export async function getAllTsFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (filePath.includes('__tests__') || filePath.includes('node_modules')) continue;
      results.push(...await getAllTsFiles(filePath));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
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

export function compareBaseline(baseline, current) {
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

export async function scanViolations(roots = sourceRoots, relativeRoot = root) {
  const files = (await Promise.all(roots.map(getAllTsFiles))).flat();
  const violations = {
    directDatabaseAccess: {},
    internalKernelImports: {},
    crossVerticalLeakage: {},
    explicitAny: {},
  };

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');
    const relativeFile = normalizePath(path.relative(relativeRoot, file));

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      const lineNumber = index + 1;
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

    for (const access of collectDatabaseAccesses(file, content, relativeRoot)) {
      if (!access.legacyMatch) continue;
      const message = access.method === 'rpc'
        ? 'Direct RPC database execution is prohibited in the Product layer.'
        : `Direct database query targeting '${access.legacyMatch}' is prohibited in the Product layer.`;
      addCount(violations.directDatabaseAccess, `${relativeFile}:L${access.line} - ${message}`);
    }

    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const lineNumber = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        addCount(violations.explicitAny,
          `${relativeFile}:L${lineNumber} - Explicit any type is prohibited.`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return violations;
}

function memberName(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression
    && (ts.isStringLiteral(expression.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))) {
    return expression.argumentExpression.text;
  }
  return null;
}

function databaseOperation(call, method) {
  if (method === 'rpc') return 'execute';
  const operations = [];
  let current = call;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)
      || ts.isTypeAssertionExpression(parent) || ts.isNonNullExpression(parent)) {
      current = parent;
    } else if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent))
      && parent.expression === current && ts.isCallExpression(parent.parent)
      && parent.parent.expression === parent) {
      const name = memberName(parent);
      if (['select', 'insert', 'update', 'upsert', 'delete'].includes(name)) operations.push(name);
      current = parent.parent;
    } else break;
  }
  const writes = operations.filter(name => name !== 'select');
  if (writes.length > 1) return null;
  return writes[0] ?? (operations.includes('select') ? 'select' : null);
}

function callerScope(node, source) {
  const scopes = [];
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current) && current.body) {
      let name = current.name?.getText(source);
      if (!name && (ts.isVariableDeclaration(current.parent) || ts.isPropertyAssignment(current.parent)
        || ts.isPropertyDeclaration(current.parent))) name = current.parent.name.getText(source);
      scopes.unshift(name ?? '<callback>');
    } else if ((ts.isClassDeclaration(current) || ts.isClassExpression(current)) && current.name) {
      scopes.unshift(current.name.text);
    }
  }
  return scopes.length ? scopes.join('/') : '<module>';
}

function explicitSchema(expression) {
  let current = expression;
  while (current) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)
      || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
    } else if (ts.isCallExpression(current)
      && (ts.isPropertyAccessExpression(current.expression) || ts.isElementAccessExpression(current.expression))) {
      if (memberName(current.expression) === 'schema') {
        const value = current.arguments[0];
        return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) ? value.text : null;
      }
      current = current.expression.expression;
    } else break;
  }
  // The configured client's default is not asserted to be public.
  return '<client-default>';
}

// Syntactic inventory, not proof of ownership/permission. The resource check
// below never turns the historical prefix baseline into exact exceptions.
export async function scanDatabaseAccesses(roots = sourceRoots, repositoryRoot = process.cwd()) {
  const files = (await Promise.all(roots.map(getAllTsFiles))).flat();
  const accesses = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    accesses.push(...collectDatabaseAccesses(file, content, repositoryRoot));
  }
  return accesses.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
}

function collectDatabaseAccesses(file, content, repositoryRoot) {
    const accesses = [];
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) throw new Error(`Cannot parse Education source: ${file}`);
    const shadowedConversions = new Set();
    const findBindings = node => {
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node) || ts.isImportSpecifier(node) || ts.isImportClause(node)
        || ts.isNamespaceImport(node) || ts.isBindingElement(node))
        && node.name && ts.isIdentifier(node.name)) shadowedConversions.add(node.name.text);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)) shadowedConversions.add(node.left.text);
      ts.forEachChild(node, findBindings);
    };
    findBindings(source);
    const recordMember = (expression, node, argument, form) => {
      const method = memberName(expression);
      const receiver = expression.expression.getText(source);
      const conversion = method === 'from' && (receiver === 'Array' || receiver === 'Buffer')
        && !shadowedConversions.has(receiver);
      if (conversion) return;
      const literal = form === 'call' && method && argument
        && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument));
      const member = ts.isPropertyAccessExpression(expression) ? expression.name : expression.argumentExpression;
      const position = source.getLineAndCharacterOfPosition(member.getStart(source));
      // Retain old count/signature spelling only for real executable AST calls.
      // Never scan string examples or comment text to manufacture legacy debt.
      const tail = source.text.slice(member.getStart(source) - 1, node.end);
      const pattern = method === 'rpc' ? /^\.rpc\s*\(\s*['"`]/
        : /^\.from\s*\(\s*['"`](edu_|students|assessment_|attendance_|journal_)/;
      const legacyMatch = literal && ts.isPropertyAccessExpression(expression) ? tail.match(pattern)?.[0] ?? null : null;
      accesses.push({
        file: normalizePath(path.relative(repositoryRoot, file)),
        line: position.line + 1, column: position.character + 1,
        method: method ?? '<computed>', form,
        operation: form === 'call' && method ? databaseOperation(node, method) : null,
        caller: callerScope(node, source), schema: explicitSchema(expression.expression), receiver,
        target: literal ? argument.text : null,
        targetExpression: argument?.getText(source) ?? expression.getText(source), legacyMatch,
      });
    };
    const visit = (node) => {
      if (ts.isCallExpression(node)
        && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))) {
        const method = memberName(node.expression);
        if (method === 'from' || method === 'rpc' || method === null) {
          recordMember(node.expression, node, node.arguments[0], method === null ? 'computed' : 'call');
        }
      } else if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
        && !(ts.isCallExpression(node.parent) && node.parent.expression === node)
        && ['from', 'rpc'].includes(memberName(node))) {
        // Extracted/bound/call/apply methods must not disappear into aliases.
        recordMember(node, node, null, 'reference');
      } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const property = node.propertyName ?? node.name;
        const name = ts.isIdentifier(property) || ts.isStringLiteral(property) ? property.text : null;
        if (name === 'from' || name === 'rpc' || ts.isComputedPropertyName(property)) {
          const position = source.getLineAndCharacterOfPosition(property.getStart(source));
          accesses.push({ file: normalizePath(path.relative(repositoryRoot, file)),
            line: position.line + 1, column: position.character + 1,
            method: name ?? '<computed>', form: 'binding', operation: null,
            caller: callerScope(node, source), schema: null, receiver: '<binding>',
            target: null, targetExpression: property.getText(source), legacyMatch: null });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return accesses;
}

export function resourceAccessSignature(access) {
  // JSON avoids ambiguous separators; no line-number normalization is applied
  // inside paths or literal resource names. Returning SELECT after a mutation
  // is identified by its write operation, not read permission.
  return `resource:${JSON.stringify([normalizePath(access.file), access.caller ?? null, access.method, access.schema ?? null, access.target, access.operation])}`;
}

export function compareResourceAccesses(approved, accesses) {
  const relevant = accesses.filter(access => access.method === 'rpc' || !access.target
    || /^(edu_|students$|assessment_|attendance_|journal_)/.test(access.target));
  const current = {};
  for (const access of relevant) addCount(current, resourceAccessSignature(access));
  const exact = Object.fromEntries(Object.entries(approved).filter(([key]) => key.startsWith('resource:')));
  const invalidReviewedCounts = Object.entries(exact).filter(([, count]) => !Number.isSafeInteger(count) || count < 1);
  const added = [];
  for (const [signature, count] of Object.entries(current).sort()) {
    const reviewedCount = Number.isSafeInteger(exact[signature]) && exact[signature] > 0 ? exact[signature] : 0;
    if (count > reviewedCount) added.push({ signature, baselineCount: reviewedCount, currentCount: count, delta: count - reviewedCount });
  }
  const unresolved = relevant.filter(access => !access.target || !access.operation || !access.caller || !access.schema);
  return {
    status: added.length || unresolved.length || invalidReviewedCounts.length ? 'BLOCK' : 'ALLOW',
    legacyBaselineTotal: Object.entries(approved).filter(([key]) => !key.startsWith('resource:'))
      .reduce((sum, [, count]) => sum + count, 0),
    exactBaselineTotal: Object.values(exact).filter(count => Number.isSafeInteger(count) && count > 0).reduce((sum, count) => sum + count, 0),
    currentTotal: relevant.length, added, unresolved, invalidReviewedCounts,
  };
}

export function legacyBaselineDigest(baseline) {
  return createHash('sha256').update(JSON.stringify(Object.entries(baseline)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))).digest('hex');
}

export function loadDispositionMetadata(file = '.github/ci/education-architecture-dispositions.json') {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
}

export function validateDispositionMetadata(metadata, baseline) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const errors = [];
  if (!record(metadata) || !record(baseline)) return ['Missing or invalid disposition metadata/baseline'];
  if (metadata.version !== 1 || typeof metadata.policyId !== 'string' || !metadata.policyId
    || !/^[a-f0-9]{40}$/.test(metadata.sourceBase ?? '')) errors.push('Invalid policy provenance');
  if (!record(metadata.approval) || metadata.approval.scope !== 'local-enforcement'
    || typeof metadata.approval.decision !== 'string' || !metadata.approval.decision.trim()
    || !Array.isArray(metadata.approval.exceptionIds)) errors.push('Missing owner control decision');
  if (metadata.legacyBaselineDigest !== legacyBaselineDigest(baseline)) errors.push('Historical baseline fingerprint mismatch');
  if (!Array.isArray(metadata.knownDebt) || !Array.isArray(metadata.approvedExceptions)) {
    return [...errors, 'Disposition collections must be arrays'];
  }
  const identities = new Set();
  const ids = new Set();
  const fields = ['id', 'file', 'caller', 'method', 'schema', 'target', 'operation', 'maxOccurrences'].sort().join(',');
  const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
  for (const [kind, entries] of [['debt', metadata.knownDebt], ['exception', metadata.approvedExceptions]]) {
    for (const entry of entries) {
      if (!record(entry) || Object.keys(entry).sort().join(',') !== fields) {
        errors.push('Invalid disposition entry shape'); continue;
      }
      const label = typeof entry.id === 'string' ? entry.id : '<invalid-id>';
      const scope = kind === 'debt' ? 'src/products/bella-education/' : 'src/app/api/education/';
      if (typeof entry.file !== 'string' || !entry.file.startsWith(scope)
        || path.posix.normalize(entry.file) !== entry.file || entry.file.includes('\\')
        || /[*?]/.test(entry.file) || !/\.tsx?$/.test(entry.file)
        || typeof entry.caller !== 'string' || !entry.caller.trim() || /[*?]|\$\{/.test(entry.caller)
        || typeof entry.target !== 'string' || !identifier.test(entry.target)
        || typeof entry.schema !== 'string' || !(entry.schema === '<client-default>' || identifier.test(entry.schema))
        || !Number.isSafeInteger(entry.maxOccurrences) || entry.maxOccurrences < 1
        || kind === 'exception' && entry.maxOccurrences !== 1
        || !(entry.method === 'rpc' && entry.operation === 'execute'
          || entry.method === 'from' && ['select', 'insert', 'update', 'upsert', 'delete'].includes(entry.operation))) {
        errors.push(`Invalid exact disposition: ${label}`); continue;
      }
      if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) errors.push('Invalid or duplicate disposition ID');
      ids.add(entry.id);
      const key = resourceAccessSignature(entry);
      if (identities.has(key)) errors.push(`Duplicate/overlapping disposition: ${label}`);
      identities.add(key);
    }
  }
  const baselineCounts = Object.values(baseline);
  if (baselineCounts.some(count => !Number.isSafeInteger(count) || count < 1)) errors.push('Invalid historical counts');
  const historicalTotal = baselineCounts.reduce((sum, count) => sum + count, 0);
  if (metadata.knownDebt.reduce((sum, entry) => sum + (Number.isSafeInteger(entry?.maxOccurrences) ? entry.maxOccurrences : 0), 0) !== historicalTotal) {
    errors.push('Historical projection quota does not match existing debt');
  }
  const expectedIds = metadata.approval?.exceptionIds;
  const actualIds = metadata.approvedExceptions.map(entry => entry?.id);
  if (!Array.isArray(expectedIds) || expectedIds.some(id => typeof id !== 'string' || !id)
    || actualIds.some(id => typeof id !== 'string' || !id)
    || new Set(expectedIds).size !== expectedIds.length
    || JSON.stringify([...expectedIds].sort()) !== JSON.stringify([...actualIds].sort())) {
    errors.push('Exception IDs differ from owner decision');
  }
  return errors;
}

export function evaluateDatabaseControls(baseline, rawLegacyCounts, accesses, metadata) {
  const configurationErrors = validateDispositionMetadata(metadata, baseline);
  const debt = configurationErrors.length ? [] : metadata.knownDebt;
  const exceptions = configurationErrors.length ? [] : metadata.approvedExceptions;
  const entries = new Map([...debt.map(entry => [resourceAccessSignature(entry), { ...entry, kind: 'KNOWN_DEBT_BOUNDED' }]),
    ...exceptions.map(entry => [resourceAccessSignature(entry), { ...entry, kind: 'APPROVED_CONTRACT_PATH' }])]);
  const approvedCounts = Object.fromEntries([...entries].map(([key, entry]) => [key, entry.maxOccurrences]));
  const remaining = new Map([...entries].map(([key, entry]) => [key, entry.maxOccurrences]));
  const effectiveLegacyCounts = { ...rawLegacyCounts };
  const recognizedDebt = [], recognizedExceptions = [], blocked = [];
  for (const access of accesses) {
    if (!(access.method === 'rpc' || !access.target || /^(edu_|students$|assessment_|attendance_|journal_)/.test(access.target))) continue;
    const key = resourceAccessSignature(access);
    const entry = entries.get(key);
    const resolved = access.target && access.operation && access.caller && access.schema;
    if (!resolved || !entry || !(remaining.get(key) > 0)) { blocked.push(access); continue; }
    remaining.set(key, remaining.get(key) - 1);
    if (entry.kind === 'KNOWN_DEBT_BOUNDED') { recognizedDebt.push(access); continue; }
    recognizedExceptions.push(access);
    if (access.legacyMatch) {
      const file = path.posix.relative('src/products/bella-education', access.file);
      const message = access.method === 'rpc' ? 'Direct RPC database execution is prohibited in the Product layer.'
        : `Direct database query targeting '${access.legacyMatch}' is prohibited in the Product layer.`;
      const signature = `${file}:L${access.line} - ${message}`;
      if (!(effectiveLegacyCounts[signature] > 0)) configurationErrors.push(`Legacy observation mismatch: ${access.file}:${access.line}`);
      else if (--effectiveLegacyCounts[signature] === 0) delete effectiveLegacyCounts[signature];
    }
  }
  const rawLegacy = compareBaseline(baseline, rawLegacyCounts);
  const legacy = compareBaseline(baseline, effectiveLegacyCounts);
  const resources = compareResourceAccesses({ ...baseline, ...approvedCounts }, accesses);
  if (configurationErrors.length) resources.status = 'BLOCK';
  return { status: configurationErrors.length || legacy.status === 'BLOCK' || resources.status === 'BLOCK' ? 'BLOCK' : 'ALLOW',
    configurationErrors, rawLegacy, legacy, resources, effectiveLegacyCounts, recognizedDebt, recognizedExceptions, blocked };
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

export async function runArchitectureGuard() {
  const current = await scanViolations();
  const baselines = loadBaselines();
  const inventory = await scanDatabaseAccesses();
  const database = evaluateDatabaseControls(baselines.directDatabaseAccess?.violations ?? {},
    current.directDatabaseAccess, inventory, loadDispositionMetadata());
  const categories = [
    ['internalKernelImports', 'Education internal kernel import'],
    ['crossVerticalLeakage', 'Education cross-vertical leakage'],
    ['explicitAny', 'Education explicit any'],
  ];

  console.log(`Education raw legacy matches: ${database.rawLegacy.currentTotal}; added: ${database.rawLegacy.added.reduce((sum, item) => sum + item.delta, 0)}`);
  printComparison('Education effective legacy database matches', database.legacy);
  const resources = database.resources;
  console.log(`Education dispositions: known debt ${database.recognizedDebt.length}; approved paths ${database.recognizedExceptions.length}; blocked ${database.blocked.length}`);
  for (const error of database.configurationErrors) console.error(`Education disposition policy error: ${error}`);
  console.log(`Education exact-resource disposition quota: ${resources.exactBaselineTotal}; unchanged historical baseline: ${resources.legacyBaselineTotal}`);
  console.log(`Education exact-resource candidates: ${resources.currentTotal}; unresolved: ${resources.unresolved.length}`);
  for (const item of resources.added.slice(0, 10)) console.error(`Unreviewed resource +${item.delta} ${item.signature}`);
  let blocked = database.status === 'BLOCK';
  for (const [key, label] of categories) {
    const comparison = compareBaseline(baselines[key]?.violations ?? {}, current[key]);
    printComparison(label, comparison);
    if (comparison.status === 'BLOCK') {
      blocked = true;
    }
  }

  if (blocked) {
    console.error('Education architecture baseline policy: BLOCK');
    return 1;
  }
  console.log('Education architecture baseline policy: ALLOW');
  return 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  process.exitCode = await runArchitectureGuard();
}
