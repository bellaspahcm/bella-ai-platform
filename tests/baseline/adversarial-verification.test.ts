/**
 * ADVERSARIAL VERIFICATION SUITE
 * 
 * 8 scenarios that MUST PASS before CI integration
 * 
 * Purpose: Prove baseline system correctly distinguishes:
 * - Code movement vs semantic change
 * - Same test/different failure
 * - Modified vs unchanged migrations
 * - Debt reduction vs debt laundering
 * 
 * GATE: All 8 scenarios MUST PASS before I9 (CI integration)
 */

import { describe, it, expect } from '@jest/globals';
import {
  FindingIdentity,
  TypeScriptComponents,
  ESLintComponents,
  JestComponents,
  MigrationComponents,
  MigrationFinding
} from '../../scripts/ci/baseline/schema';
import { completeFinding, generateMessageSignature, generateFailureReasonHash } from '../../scripts/ci/baseline/fingerprint';
import { compareFindings, applyPolicy } from '../../scripts/ci/baseline/comparator';

describe('Adversarial Verification Suite', () => {
  
  /**
   * SCENARIO 1: Line shift → ALLOW
   * 
   * Same error, moved to different line
   * Expected: Fingerprint matches, existing finding (ALLOW)
   */
  it('Scenario 1: Line shift should be tolerated', () => {
    const baseline: FindingIdentity = completeFinding({
      file: 'src/test.ts',
      line: 10,
      column: 5,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2353',
        symbol: 'turboConfig',
        message_sig: generateMessageSignature('Property turboConfig does not exist', 'turboConfig')
      } as TypeScriptComponents,
      message: 'Property turboConfig does not exist'
    });
    
    const current: FindingIdentity = completeFinding({
      file: 'src/test.ts',
      line: 15,  // Line shifted by 5 (code added above)
      column: 5,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2353',
        symbol: 'turboConfig',
        message_sig: generateMessageSignature('Property turboConfig does not exist', 'turboConfig')
      } as TypeScriptComponents,
      message: 'Property turboConfig does not exist'
    });
    
    // Fingerprints should be identical (line not part of identity)
    expect(current.fingerprint).toBe(baseline.fingerprint);
    
    // Comparison should show as existing (not new)
    const comparison = compareFindings([current], [baseline]);
    expect(comparison.newFindings).toHaveLength(0);
    expect(comparison.existingFindings).toHaveLength(1);
    
    // Policy should ALLOW
    const result = applyPolicy('test', 'no-new-debt', [current], [baseline]);
    expect(result.verdict).toBe('pass');
  });

  it('Scenario 1B: GitHub Actions bella-ai-platform paths should match baseline-relative paths', () => {
    const baseline: FindingIdentity = completeFinding({
      file: 'eslint.config.mjs',
      line: 8,
      column: 1,
      tool: 'eslint',
      severity: 'warning',
      components: {
        rule_id: 'import/no-anonymous-default-export',
        context: 'c3310bc1'
      } as ESLintComponents,
      message: 'Assign array to a variable before exporting as module default'
    });

    const current: FindingIdentity = completeFinding({
      file: '/home/runner/work/bella-ai-platform/bella-ai-platform/eslint.config.mjs',
      line: 8,
      column: 1,
      tool: 'eslint',
      severity: 'warning',
      components: {
        rule_id: 'import/no-anonymous-default-export',
        context: 'c3310bc1'
      } as ESLintComponents,
      message: 'Assign array to a variable before exporting as module default'
    });

    expect(current.file).toBe('eslint.config.mjs');
    expect(current.fingerprint).toBe(baseline.fingerprint);

    const result = applyPolicy('eslint-changed', 'no-new-debt', [current], [baseline]);
    expect(result.verdict).toBe('pass');
  });
  
  /**
   * SCENARIO 2: New error → BLOCK
   * 
   * Genuinely new TypeScript error introduced
   * Expected: New finding detected, policy blocks
   */
  it('Scenario 2: New error should be blocked', () => {
    const baseline: FindingIdentity[] = [
      completeFinding({
        file: 'src/test.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'oldError',
          message_sig: generateMessageSignature('Property oldError does not exist', 'oldError')
        } as TypeScriptComponents,
        message: 'Property oldError does not exist'
      })
    ];
    
    const current: FindingIdentity[] = [
      ...baseline,
      completeFinding({
        file: 'src/test.ts',
        line: 20,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2322',
          symbol: 'newError',
          message_sig: generateMessageSignature('Type string is not assignable to type number', 'newError')
        } as TypeScriptComponents,
        message: 'Type string is not assignable to type number'
      })
    ];
    
    // Should detect 1 new finding
    const comparison = compareFindings(current, baseline);
    expect(comparison.newFindings).toHaveLength(1);
    expect(comparison.existingFindings).toHaveLength(1);
    
    // Policy should BLOCK
    const result = applyPolicy('test', 'no-new-debt', current, baseline);
    expect(result.verdict).toBe('block');
    expect(result.reason).toContain('1 new violation');
  });
  
  /**
   * SCENARIO 3: Same test, new cause → BLOCK
   * 
   * CRITICAL: Same test name, different failure reason
   * Expected: Different fingerprint, new finding (BLOCK)
   */
  it('Scenario 3: Same test with different failure cause should be blocked', () => {
    const baseline: FindingIdentity = completeFinding({
      file: 'src/__tests__/payroll.test.ts',
      line: 45,
      tool: 'jest',
      severity: 'error',
      components: {
        suite: 'PayrollProvider',
        test: 'should calculate max bonus correctly',
        failure_reason_hash: generateFailureReasonHash('Expected: 150000, Received: 200000')
      } as JestComponents,
      message: 'Expected: 150000, Received: 200000'
    });
    
    const current: FindingIdentity = completeFinding({
      file: 'src/__tests__/payroll.test.ts',
      line: 45,
      tool: 'jest',
      severity: 'error',
      components: {
        suite: 'PayrollProvider',
        test: 'should calculate max bonus correctly',  // Same test
        failure_reason_hash: generateFailureReasonHash('TypeError: Cannot read property salary of undefined')  // Different cause
      } as JestComponents,
      message: 'TypeError: Cannot read property salary of undefined'
    });
    
    // Fingerprints should differ (different failure reason)
    expect(current.fingerprint).not.toBe(baseline.fingerprint);
    
    // Should detect as new finding
    const comparison = compareFindings([current], [baseline]);
    expect(comparison.newFindings).toHaveLength(1);
    expect(comparison.resolvedFindings).toHaveLength(1);
    
    // Policy should BLOCK
    const result = applyPolicy('test', 'no-new-debt-with-reason', [current], [baseline]);
    expect(result.verdict).toBe('block');
  });
  
  /**
   * SCENARIO 4: Unchanged migration + grandfathered → ALLOW
   * 
   * Migration not modified by PR, violation in baseline
   * Expected: Grandfathered, policy allows
   */
  it('Scenario 4: Unchanged migration with baseline violation should be allowed', () => {
    const baselineFinding: FindingIdentity = completeFinding({
      file: 'migrations/20260511500000_create_inventory_items.sql',
      line: 38,
      tool: 'migration-check',
      severity: 'error',
      components: {
        migration_id: '20260511500000',
        rule: 'blocking-index',
        object: 'inventory_items_idx'
      } as MigrationComponents,
      message: 'Creating index without CONCURRENTLY'
    });
    
    const currentFinding: MigrationFinding = {
      ...completeFinding({
        file: 'migrations/20260511500000_create_inventory_items.sql',
        line: 38,
        tool: 'migration-check',
        severity: 'error',
        components: {
          migration_id: '20260511500000',
          rule: 'blocking-index',
          object: 'inventory_items_idx'
        } as MigrationComponents,
        message: 'Creating index without CONCURRENTLY'
      }),
      grandfathered: true  // PR did not modify this migration
    };
    
    // Fingerprints match
    expect(currentFinding.fingerprint).toBe(baselineFinding.fingerprint);
    
    // Policy should ALLOW (conditional grandfathering)
    const result = applyPolicy(
      'migration-check',
      'conditional-grandfathering',
      [currentFinding],
      [baselineFinding]
    );
    expect(result.verdict).toBe('pass');
  });
  
  /**
   * SCENARIO 5: Modified migration → STRICT BLOCK
   * 
   * Migration modified by PR, violation present
   * Expected: NOT grandfathered, policy blocks
   */
  it('Scenario 5: Modified migration with violation should be blocked', () => {
    const baselineFinding: FindingIdentity = completeFinding({
      file: 'migrations/20260915000000_add_user_roles.sql',
      line: 12,
      tool: 'migration-check',
      severity: 'error',
      components: {
        migration_id: '20260915000000',
        rule: 'blocking-index',
        object: 'user_roles_idx'
      } as MigrationComponents,
      message: 'Creating index without CONCURRENTLY'
    });
    
    const currentFinding: MigrationFinding = {
      ...completeFinding({
        file: 'migrations/20260915000000_add_user_roles.sql',
        line: 12,
        tool: 'migration-check',
        severity: 'error',
        components: {
          migration_id: '20260915000000',
          rule: 'blocking-index',
          object: 'user_roles_idx'
        } as MigrationComponents,
        message: 'Creating index without CONCURRENTLY'
      }),
      grandfathered: false  // PR modified this migration
    };
    
    // Fingerprints match BUT not grandfathered
    expect(currentFinding.fingerprint).toBe(baselineFinding.fingerprint);
    expect(currentFinding.grandfathered).toBe(false);
    
    // Policy should BLOCK (modified migration must be clean)
    const result = applyPolicy(
      'migration-check',
      'conditional-grandfathering',
      [currentFinding],
      [baselineFinding]
    );
    expect(result.verdict).toBe('block');
  });
  
  /**
   * SCENARIO 6: Resolved debt → ALLOW + ratchet
   * 
   * Historical violation fixed
   * Expected: Resolved finding detected, ratchet opportunity
   */
  it('Scenario 6: Resolved debt should be allowed with ratchet opportunity', () => {
    const baseline: FindingIdentity[] = [
      completeFinding({
        file: 'src/old-error.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'oldError',
          message_sig: generateMessageSignature('Property oldError does not exist', 'oldError')
        } as TypeScriptComponents,
        message: 'Property oldError does not exist'
      }),
      completeFinding({
        file: 'src/fixed-error.ts',
        line: 20,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2322',
          symbol: 'fixedError',
          message_sig: generateMessageSignature('Type mismatch', 'fixedError')
        } as TypeScriptComponents,
        message: 'Type mismatch'
      })
    ];
    
    const current: FindingIdentity[] = [
      baseline[0]  // Only first error remains, second was fixed
    ];
    
    // Should detect 1 resolved
    const comparison = compareFindings(current, baseline);
    expect(comparison.resolvedFindings).toHaveLength(1);
    expect(comparison.newFindings).toHaveLength(0);
    
    // Policy should ALLOW with ratchet opportunity
    const result = applyPolicy('test', 'no-new-debt', current, baseline);
    expect(result.verdict).toBe('pass');
    expect(result.canRatchet).toBe(true);
    expect(result.reason).toContain('resolved');
  });
  
  /**
   * SCENARIO 7: Debt laundering → BLOCK
   * 
   * Removes C, introduces X, count stays same
   * Expected: Detects as new violation (BLOCK)
   */
  it('Scenario 7: Debt laundering (swap violations) should be blocked', () => {
    const baseline: FindingIdentity[] = [
      completeFinding({
        file: 'src/file-a.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'errorA',
          message_sig: generateMessageSignature('Error A', 'errorA')
        } as TypeScriptComponents,
        message: 'Error A'
      }),
      completeFinding({
        file: 'src/file-b.ts',
        line: 20,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'errorB',
          message_sig: generateMessageSignature('Error B', 'errorB')
        } as TypeScriptComponents,
        message: 'Error B'
      }),
      completeFinding({
        file: 'src/file-c.ts',
        line: 30,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'errorC',
          message_sig: generateMessageSignature('Error C', 'errorC')
        } as TypeScriptComponents,
        message: 'Error C'
      })
    ];
    
    const current: FindingIdentity[] = [
      baseline[0],  // A remains
      baseline[1],  // B remains
      completeFinding({  // X introduced (replacing C)
        file: 'src/file-x.ts',
        line: 40,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2322',
          symbol: 'errorX',
          message_sig: generateMessageSignature('Error X', 'errorX')
        } as TypeScriptComponents,
        message: 'Error X'
      })
    ];
    
    // Count is same (3 → 3) BUT composition changed
    expect(current).toHaveLength(3);
    expect(baseline).toHaveLength(3);
    
    // Should detect 1 new, 1 resolved
    const comparison = compareFindings(current, baseline);
    expect(comparison.newFindings).toHaveLength(1);
    expect(comparison.resolvedFindings).toHaveLength(1);
    
    // Policy should BLOCK (new violation detected)
    const result = applyPolicy('test', 'no-new-debt', current, baseline);
    expect(result.verdict).toBe('block');
    expect(result.reason).toContain('1 new violation');
  });
  
  /**
   * SCENARIO 8: Same code, changed semantic → BLOCK
   * 
   * Same diagnostic code (TS2322), same file, but different symbol/context
   * Expected: Different fingerprint, new finding (BLOCK)
   */
  it('Scenario 8: Same diagnostic code with different semantic context should be blocked', () => {
    const baseline: FindingIdentity = completeFinding({
      file: 'src/test.ts',
      line: 10,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2322',
        symbol: 'customerId',
        message_sig: generateMessageSignature('Type string is not assignable to type number', 'customerId')
      } as TypeScriptComponents,
      message: 'Type string is not assignable to type number'
    });
    
    const current: FindingIdentity = completeFinding({
      file: 'src/test.ts',
      line: 10,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2322',  // Same code
        symbol: 'customerId',  // Same symbol
        message_sig: generateMessageSignature('Type boolean is not assignable to type number', 'customerId')  // Different semantic
      } as TypeScriptComponents,
      message: 'Type boolean is not assignable to type number'
    });
    
    // Fingerprints should differ (different message signature)
    expect(current.fingerprint).not.toBe(baseline.fingerprint);
    
    // Should detect as new finding
    const comparison = compareFindings([current], [baseline]);
    expect(comparison.newFindings).toHaveLength(1);
    expect(comparison.resolvedFindings).toHaveLength(1);
    
    // Policy should BLOCK
    const result = applyPolicy('test', 'no-new-debt', [current], [baseline]);
    expect(result.verdict).toBe('block');
  });
});

/**
 * GATE VERIFICATION
 * 
 * Run this test suite: npm test -- tests/baseline/adversarial-verification.test.ts
 * 
 * All 8 scenarios MUST PASS before I9 (CI integration)
 * 
 * If any scenario fails, the baseline system has a design flaw
 * that could lead to:
 * - False negatives (regressions not caught)
 * - False positives (legitimate changes blocked)
 * - Debt laundering (swapping old violations for new ones)
 */
