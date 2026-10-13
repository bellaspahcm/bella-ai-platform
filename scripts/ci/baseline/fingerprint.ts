/**
 * STABLE FINGERPRINT GENERATION
 * 
 * Generates stable identities for findings that survive:
 * - Code movement (line/column changes)
 * - Whitespace/formatting changes
 * - Minor context shifts
 * 
 * But detect:
 * - Semantic changes in errors
 * - Different failure reasons
 * - Symbol/context changes
 */

import * as crypto from 'crypto';
import {
  FindingIdentity,
  TypeScriptComponents,
  ESLintComponents,
  JestComponents,
  MigrationComponents,
  Tool
} from './schema';

/**
 * Generate stable fingerprint for a finding
 */
export function generateFingerprint(finding: Omit<FindingIdentity, 'fingerprint'>): string {
  const { tool, file, components } = finding;
  
  switch (tool) {
    case 'typescript':
      return generateTypeScriptFingerprint(file, components as TypeScriptComponents);
    
    case 'eslint':
      return generateESLintFingerprint(file, components as ESLintComponents);
    
    case 'jest':
      return generateJestFingerprint(components as JestComponents);
    
    case 'migration-check':
      return generateMigrationFingerprint(components as MigrationComponents);
    
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/**
 * TypeScript fingerprint
 * Format: ts:{file}:{code}:{symbol}:{message_sig}
 */
function generateTypeScriptFingerprint(
  file: string,
  components: TypeScriptComponents
): string {
  const { code, symbol, message_sig } = components;
  const normalizedFile = normalizeFilePath(file);
  const normalizedSymbol = symbol || 'unknown';
  
  return `ts:${normalizedFile}:${code}:${normalizedSymbol}:${message_sig}`;
}

/**
 * ESLint fingerprint
 * Format: eslint:{file}:{rule_id}:{context}
 */
function generateESLintFingerprint(
  file: string,
  components: ESLintComponents
): string {
  const { rule_id, context } = components;
  const normalizedFile = normalizeFilePath(file);
  const normalizedContext = context || 'default';
  
  return `eslint:${normalizedFile}:${rule_id}:${normalizedContext}`;
}

/**
 * Jest fingerprint
 * Format: jest:{suite}:{test}:{failure_reason_hash}
 * 
 * CRITICAL: Includes failure_reason_hash
 * Same test with different failure = different finding
 */
function generateJestFingerprint(
  components: JestComponents
): string {
  const { suite, test, failure_reason_hash } = components;
  const normalizedSuite = normalizeSuitePath(suite);
  const normalizedTest = normalizeTestName(test);
  
  return `jest:${normalizedSuite}:${normalizedTest}:${failure_reason_hash}`;
}

/**
 * Migration fingerprint
 * Format: migration:{migration_id}:{rule}:{object}
 */
function generateMigrationFingerprint(
  components: MigrationComponents
): string {
  const { migration_id, rule, object } = components;
  const normalizedObject = normalizeDatabaseObject(object);
  
  return `migration:${migration_id}:${rule}:${normalizedObject}`;
}

/**
 * Generate message signature for TypeScript diagnostics
 * 
 * Extracts semantic structure from error message while
 * normalizing variable details to detect real changes
 */
export function generateMessageSignature(message: string, symbol?: string): string {
  // Remove quotes and normalize whitespace
  let normalized = message
    .replace(/['"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove specific type names but preserve structure
  // "Type 'Foo' is not assignable" → "Type is not assignable"
  normalized = normalized.replace(/\b[A-Z][a-zA-Z0-9_]*\b/g, 'T');
  
  // Include symbol if available for disambiguation
  const symbolPart = symbol ? `:${symbol}` : '';
  
  return hash(`${normalized}${symbolPart}`).substring(0, 8);
}

/**
 * Generate failure reason hash for Jest tests
 * 
 * Normalizes error messages to catch semantic equivalence:
 * - "Expected: 150000, Received: 200000" 
 * - "Expected: 150000, Received: 180000"
 * → Same hash (both are "expected vs received" failures)
 * 
 * But different from:
 * - "TypeError: Cannot read property 'x'"
 * → Different hash (different failure type)
 */
export function generateFailureReasonHash(
  message: string,
  stack?: string
): string {
  // Normalize error message
  let normalized = message
    .replace(/\d+/g, 'N')              // Numbers → N
    .replace(/0x[0-9a-f]+/gi, 'HEX')   // Hex addresses → HEX
    .replace(/['"`]/g, '')             // Remove quotes
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .toLowerCase()
    .trim();
  
  // Include stack trace signature (top 3 frames, without line:col)
  let stackSig = '';
  if (stack) {
    stackSig = stack
      .split('\n')
      .slice(0, 3)
      .map(frame => frame.replace(/:\d+:\d+/g, ''))  // Remove line:col
      .join('|');
  }
  
  return hash(`${normalized}::${stackSig}`).substring(0, 8);
}

/**
 * Generate AST context hash for ESLint
 * 
 * Captures structural context to distinguish same rule
 * violations in different code contexts
 */
export function generateASTContextHash(
  ruleId: string,
  nodeType?: string,
  parentType?: string
): string {
  const context = [ruleId, nodeType || 'unknown', parentType || 'unknown'].join(':');
  return hash(context).substring(0, 8);
}

/**
 * Normalize file path for cross-platform consistency
 */
function normalizeFilePath(file: string): string {
  let normalized = file
    .replace(/\\/g, '/')           // Windows backslash → forward slash
    .replace(/^\.\//, '');          // Remove leading ./

  // Strip absolute path prefixes to keep relative repository path
  const lower = normalized.toLowerCase();
  const markers = ['bella-ai-platform/', 'bella-spa-erp/', 'bella spa erp/'];
  for (const marker of markers) {
    const lastIdx = lower.lastIndexOf(marker);
    if (lastIdx !== -1) {
      normalized = normalized.substring(lastIdx + marker.length);
      break;
    }
  }

  return normalized;
}

/**
 * Normalize test suite path
 */
function normalizeSuitePath(suite: string): string {
  return suite
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\.test\.(ts|js|tsx|jsx)$/, '');
}

/**
 * Normalize test name (remove dynamic parts)
 */
function normalizeTestName(test: string): string {
  return test
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalize database object name
 */
function normalizeDatabaseObject(object: string): string {
  return object
    .toLowerCase()
    .replace(/["'`]/g, '');
}

/**
 * Hash utility
 */
function hash(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
}

/**
 * Complete finding with generated fingerprint
 */
export function completeFinding(
  partial: Omit<FindingIdentity, 'fingerprint'>
): FindingIdentity {
  const normalizedFile = normalizeFilePath(partial.file);
  const normalizedPartial = {
    ...partial,
    file: normalizedFile
  };
  return {
    ...normalizedPartial,
    fingerprint: generateFingerprint(normalizedPartial)
  };
}

/**
 * Normalize all findings in a loaded baseline in-memory
 */
export function normalizeBaseline(baseline: any): any {
  const normalized = JSON.parse(JSON.stringify(baseline));
  for (const scopeConfig of Object.values(normalized.scopes || {})) {
    const sc = scopeConfig as any;
    if (sc && Array.isArray(sc.findings)) {
      sc.findings = sc.findings.map((f: any) => completeFinding(f));
    }
  }
  return normalized;
}
