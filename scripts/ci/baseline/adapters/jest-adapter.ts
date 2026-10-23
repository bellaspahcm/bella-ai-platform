/**
 * JEST ADAPTER
 * 
 * Parses Jest JSON output and generates stable fingerprints
 * 
 * Input: jest --json output
 * Output: FindingIdentity[] with stable fingerprints
 * 
 * Fingerprint strategy:
 * - suite + test + failure_reason_hash
 * - CRITICAL: Same test with different failure reason = different finding
 * - This prevents historical baseline from masking new failures
 */

import { FindingIdentity, JestComponents } from '../schema';
import { completeFinding, generateFailureReasonHash } from '../fingerprint';

/**
 * Jest JSON output structure (subset of relevant fields)
 */
interface JestResult {
  testResults: JestTestResult[];
  numFailedTests: number;
  numPassedTests: number;
  success: boolean;
}

interface JestTestResult {
  name: string;  // Test file path
  status: 'passed' | 'failed';
  assertionResults: JestAssertion[];
}

interface JestAssertion {
  ancestorTitles: string[];  // Suite hierarchy
  title: string;             // Test name
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  fullName: string;
  failureMessages: string[];
  location?: {
    line: number;
    column: number;
  };
}

/**
 * Parse Jest JSON output
 */
export function parseJestJSON(jsonOutput: string): JestResult {
  if (!jsonOutput || jsonOutput.trim() === '') {
    throw new Error('Jest output is empty, cannot parse JSON');
  }
  try {
    const result = JSON.parse(jsonOutput) as JestResult;
    // Ensure testResults is an array
    if (!Array.isArray(result.testResults)) {
      throw new Error('Jest JSON missing testResults array. This indicates a catastrophic Jest failure or corrupted output.');
    }
    return result;
  } catch (error: any) {
    throw new Error(`Failed to parse Jest JSON: ${error.message}`);
  }
}

/**
 * Extract stack trace from failure message
 */
function extractStackTrace(failureMessage: string): string | undefined {
  const lines = failureMessage.split('\n');
  const stackStart = lines.findIndex(line => line.trim().startsWith('at '));
  
  if (stackStart === -1) return undefined;
  
  return lines.slice(stackStart).join('\n');
}

/**
 * Extract error message (first line before stack)
 */
function extractErrorMessage(failureMessage: string): string {
  const lines = failureMessage.split('\n');

  const yamlError = (startIndex: number): string | undefined => {
    const errorIndex = lines.findIndex((line, index) => index >= startIndex && /^\s+error:\s*/.test(line));
    if (errorIndex === -1) return undefined;
    const errorLine = lines[errorIndex].trim().replace(/^error:\s*/, '');
    if (errorLine && !/^[|>]([-+])?$/.test(errorLine)) return errorLine.replace(/^(['"])(.*)\1$/, '$2');
    for (const line of lines.slice(errorIndex + 1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('at ') || trimmed === '...') continue;
      if (!line.startsWith(' ') && !line.startsWith('\t')) break;
      return trimmed;
    }
    return undefined;
  };

  // Node's TAP reporter wraps failed subtests in a YAML diagnostic block.
  // Jest preserves that block in failureMessages; prefer its actual error
  // payload over the YAML document separator (`---`).
  // If the aggregate runner failed, prefer its isolated one-file diagnostic;
  // the parent TAP block often reduces a child failure to the generic text
  // `test failed` while the isolated output carries the actual assertion.
  const isolatedIndex = lines.findIndex(line => line.includes('ISOLATED scripts/'));
  if (isolatedIndex !== -1) {
    const isolatedEnd = lines.findIndex((line, index) => index > isolatedIndex && line.includes('ISOLATED scripts/'));
    const isolatedSummary = lines.slice(isolatedIndex, isolatedEnd === -1 ? isolatedIndex + 18 : isolatedEnd)
      .map(line => line.trim()).filter(Boolean).join(' ').slice(0, 1200);
    const isolatedError = yamlError(isolatedIndex);
    if (isolatedError && isolatedError !== 'test failed') return `${isolatedSummary} | ${isolatedError}`;
    return isolatedSummary || isolatedError || lines[isolatedIndex].trim();
  }
  const aggregateError = yamlError(0);
  if (aggregateError) return aggregateError;
  
  // Find first non-empty line that's not part of stack
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed !== '---' && trimmed !== '...' && !trimmed.startsWith('at ') && !trimmed.startsWith('Error:')) {
      return trimmed;
    }
  }
  
  return failureMessage.split('\n')[0] || 'Unknown error';
}

/**
 * Convert Jest assertion to FindingIdentity with stable fingerprint
 */
export function convertToFinding(
  testFile: string,
  assertion: JestAssertion
): FindingIdentity | null {
  // Only process failed tests
  if (assertion.status !== 'failed') {
    return null;
  }
  
  // Build suite path from ancestor titles
  const suite = assertion.ancestorTitles.join(' > ');
  const test = assertion.title;
  
  // Get first failure message (there may be multiple assertions)
  const failureMessage = assertion.failureMessages[0] || 'Unknown failure';
  
  // Extract error message and stack
  const errorMessage = extractErrorMessage(failureMessage);
  const stack = extractStackTrace(failureMessage);
  
  // Generate failure reason hash
  // CRITICAL: This captures the semantic nature of the failure
  // Same test with different failure type = different finding
  const failure_reason_hash = generateFailureReasonHash(errorMessage, stack);
  
  const components: JestComponents = {
    suite,
    test,
    failure_reason_hash
  };
  
  return completeFinding({
    file: testFile,
    line: assertion.location?.line,
    column: assertion.location?.column,
    tool: 'jest',
    severity: 'error',
    components,
    message: errorMessage
  });
}

/**
 * Main adapter function: parse Jest JSON → stable findings
 */
export function adaptJestOutput(jestJSON: string): FindingIdentity[] {
  const result = parseJestJSON(jestJSON);
  const findings: FindingIdentity[] = [];
  
  for (const testResult of result.testResults) {
    for (const assertion of testResult.assertionResults) {
      const finding = convertToFinding(testResult.name, assertion);
      if (finding) {
        findings.push(finding);
      }
    }
  }
  
  return findings;
}

/**
 * Filter findings by test file pattern
 */
export function filterByTestPattern(
  findings: FindingIdentity[],
  pattern: RegExp
): FindingIdentity[] {
  return findings.filter(f => pattern.test(f.file));
}

/**
 * Group findings by suite
 */
export function groupBySuite(
  findings: FindingIdentity[]
): Map<string, FindingIdentity[]> {
  const groups = new Map<string, FindingIdentity[]>();
  
  for (const finding of findings) {
    const components = finding.components as JestComponents;
    const suite = components.suite;
    const list = groups.get(suite) || [];
    list.push(finding);
    groups.set(suite, list);
  }
  
  return groups;
}

/**
 * Detect if finding is same test but different failure
 * (used for adversarial verification)
 */
export function isSameTestDifferentFailure(
  baseline: FindingIdentity,
  current: FindingIdentity
): boolean {
  const baselineComps = baseline.components as JestComponents;
  const currentComps = current.components as JestComponents;
  
  // Same suite + test
  const sameTest = 
    baselineComps.suite === currentComps.suite &&
    baselineComps.test === currentComps.test;
  
  // Different failure reason
  const differentReason = 
    baselineComps.failure_reason_hash !== currentComps.failure_reason_hash;
  
  return sameTest && differentReason;
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { adaptJestOutput } from './jest-adapter';
 * import { execSync } from 'child_process';
 * 
 * // Run Jest with JSON reporter
 * let jestOutput = '';
 * try {
 *   jestOutput = execSync(
 *     'npx jest --json --testPathPattern="src/platform"',
 *     { encoding: 'utf-8' }
 *   );
 * } catch (error: any) {
 *   // Jest outputs JSON even on failure
 *   jestOutput = error.stdout || '{}';
 * }
 * 
 * // Convert to findings
 * const findings = adaptJestOutput(jestOutput);
 * 
 * console.log(`Found ${findings.length} test failures`);
 * 
 * // Group by suite for reporting
 * const bySuite = groupBySuite(findings);
 * for (const [suite, failures] of bySuite) {
 *   console.log(`${suite}: ${failures.length} failures`);
 * }
 * ```
 */
