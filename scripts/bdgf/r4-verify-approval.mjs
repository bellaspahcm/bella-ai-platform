#!/usr/bin/env node
/**
 * R4.2 — verify_approval() Implementation
 * 
 * Machine-enforceable approval gate (G2)
 * Enforces 8 invariants from R4.1 contract (FROZEN)
 * 
 * Contract: docs/architecture/R4_APPROVAL_CONTRACT_SPECIFICATION.md v1.0.0
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createBdgfDatabaseConfig } from './database-connection.mjs';

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

/**
 * @typedef {'admin' | 'dba' | 'tech_lead' | 'emergency_override'} ApproverRole
 * @typedef {'production' | 'staging' | 'dev'} Environment
 * @typedef {'requested' | 'approved' | 'revoked' | 'used' | 'expired' | 'rejected'} ApprovalStatus
 */

/**
 * @typedef {Object} ApprovalGateInput
 * @property {string} migration_id - Migration identifier
 * @property {string} migration_content - Actual SQL content to execute
 * @property {Environment} execution_environment - Where migration will run
 * @property {string} [execution_schema] - Optional schema restriction
 */

/**
 * @typedef {Object} GateResult
 * @property {string} gate - Gate identifier
 * @property {'PASS' | 'BLOCK'} decision - Gate decision
 * @property {string} [reason] - Block reason (if BLOCK)
 * @property {Object} evidence - Evidence for audit trail
 * @property {number} timestamp - When gate executed
 */

// ============================================================================
// AUTHORITY MATRIX (from R4.1 contract I6)
// ============================================================================

const AUTHORITY_MATRIX = {
  production: ['admin', 'dba', 'emergency_override'],
  staging: ['admin', 'dba', 'tech_lead'],
  dev: ['admin', 'dba', 'tech_lead']
};

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Compute SHA-256 hash of content
 * @param {string} content 
 * @returns {string} Hex hash (64 chars)
 */
function computeHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Compute approval record hash for integrity check (I7)
 * @param {Object} approval 
 * @returns {string}
 */
function computeApprovalHash(approval) {
  const canonical = {
    approval_id: approval.approval_id,
    migration_id: approval.migration_id,
    migration_hash: approval.migration_hash,
    approval_mode: approval.approval_mode || 'separated',
    requester_id: approval.requester_id,
    approver_id: approval.approver_id,
    approver_role: approval.approver_role,
    approved_at: new Date(approval.approved_at).toISOString(),
    target_environment: approval.target_environment,
    expires_at: new Date(approval.expires_at).toISOString()
  };
  
  // Sort keys for canonical representation
  const sorted = Object.keys(canonical).sort().reduce((obj, key) => {
    obj[key] = canonical[key];
    return obj;
  }, {});
  
  return computeHash(JSON.stringify(sorted));
}

function computeLegacyApprovalHash(approval) {
  const canonical = {
    approval_id: approval.approval_id,
    migration_id: approval.migration_id,
    migration_hash: approval.migration_hash,
    requester_id: approval.requester_id,
    approver_id: approval.approver_id,
    approved_at: new Date(approval.approved_at).toISOString(),
    target_environment: approval.target_environment,
    expires_at: new Date(approval.expires_at).toISOString()
  };

  const sorted = Object.keys(canonical).sort().reduce((obj, key) => {
    obj[key] = canonical[key];
    return obj;
  }, {});

  return computeHash(JSON.stringify(sorted));
}

// ============================================================================
// INVARIANT CHECKS
// ============================================================================

/**
 * I0: Approval mode
 * Separated mode requires requester and approver to differ.
 * Owner-operated mode permits the same identity.
 */
function checkNoSelfApproval(approval) {
  const approvalMode = approval.approval_mode || 'separated';

  if (!['separated', 'owner_operated'].includes(approvalMode)) {
    return {
      pass: false,
      reason: 'INVALID_APPROVAL_MODE',
      evidence: {
        approval_mode: approvalMode
      }
    };
  }

  if (approvalMode === 'separated' && approval.requester_id === approval.approver_id) {
    return {
      pass: false,
      reason: 'SELF_APPROVAL_FORBIDDEN',
      evidence: {
        approval_mode: approvalMode,
        requester_id: approval.requester_id,
        approver_id: approval.approver_id
      }
    };
  }
  return { pass: true };
}

/**
 * I1: Migration Binding
 * Approved hash MUST equal executing hash
 */
function checkMigrationBinding(approval, migrationHash) {
  if (approval.migration_hash !== migrationHash) {
    return {
      pass: false,
      reason: 'MIGRATION_HASH_MISMATCH',
      evidence: {
        approved_hash: approval.migration_hash,
        executing_hash: migrationHash
      }
    };
  }
  return { pass: true };
}

/**
 * I2 + I5: Scope Binding (Environment Match)
 */
function checkEnvironmentMatch(approval, executionEnvironment) {
  if (approval.target_environment !== executionEnvironment) {
    return {
      pass: false,
      reason: 'ENVIRONMENT_MISMATCH',
      evidence: {
        approved_for: approval.target_environment,
        executing_in: executionEnvironment
      }
    };
  }
  return { pass: true };
}

/**
 * I2: Scope Binding (Schema Match, if specified)
 */
function checkSchemaMatch(approval, executionSchema) {
  if (approval.target_schema && executionSchema && approval.target_schema !== executionSchema) {
    return {
      pass: false,
      reason: 'SCHEMA_MISMATCH',
      evidence: {
        approved_schema: approval.target_schema,
        executing_schema: executionSchema
      }
    };
  }
  return { pass: true };
}

/**
 * I4: Time Validity
 * Approval must be within validity window
 */
function checkTimeValidity(approval) {
  const now = new Date();
  const expiresAt = new Date(approval.expires_at);
  
  // Check expiration
  if (now > expiresAt) {
    return {
      pass: false,
      reason: 'APPROVAL_EXPIRED',
      evidence: {
        expires_at: approval.expires_at,
        now: now.toISOString()
      }
    };
  }
  
  // Check valid_from (if set)
  if (approval.valid_from) {
    const validFrom = new Date(approval.valid_from);
    if (now < validFrom) {
      return {
        pass: false,
        reason: 'APPROVAL_NOT_YET_VALID',
        evidence: {
          valid_from: approval.valid_from,
          now: now.toISOString()
        }
      };
    }
  }
  
  // Check valid_until (if set)
  if (approval.valid_until) {
    const validUntil = new Date(approval.valid_until);
    if (now > validUntil) {
      return {
        pass: false,
        reason: 'APPROVAL_VALIDITY_WINDOW_PASSED',
        evidence: {
          valid_until: approval.valid_until,
          now: now.toISOString()
        }
      };
    }
  }
  
  return { pass: true };
}

/**
 * I6: Approver Authority
 * Approver role must have authority for target environment
 */
function checkApproverAuthority(approval) {
  const authorizedRoles = AUTHORITY_MATRIX[approval.target_environment];
  
  if (!authorizedRoles || !authorizedRoles.includes(approval.approver_role)) {
    return {
      pass: false,
      reason: 'UNAUTHORIZED_APPROVER',
      evidence: {
        approver_role: approval.approver_role,
        target_environment: approval.target_environment,
        authorized_roles: authorizedRoles
      }
    };
  }
  
  return { pass: true };
}

/**
 * I7: Integrity
 * Approval record has not been tampered with
 */
function checkIntegrity(approval) {
  const computed = computeApprovalHash(approval);
  
  if (computed !== approval.approval_hash) {
    const approvalMode = approval.approval_mode || 'separated';
    const legacyComputed = computeLegacyApprovalHash(approval);

    if (approvalMode === 'separated' && legacyComputed === approval.approval_hash) {
      return { pass: true };
    }

    return {
      pass: false,
      reason: 'APPROVAL_TAMPERED',
      evidence: {
        stored_hash: approval.approval_hash,
        computed_hash: computed
      }
    };
  }
  
  return { pass: true };
}

function buildBlockResult(reason, evidence, timestamp) {
  return {
    gate: 'G2_APPROVAL',
    decision: 'BLOCK',
    reason,
    evidence,
    timestamp
  };
}

function evaluateApprovalRecord(approval, input, timestamp = Date.now()) {
  const migrationHash = computeHash(input.migration_content);

  const i0Check = checkNoSelfApproval(approval);
  if (!i0Check.pass) {
    return buildBlockResult(i0Check.reason, { invariant: 'I0', ...i0Check.evidence }, timestamp);
  }

  const i1Check = checkMigrationBinding(approval, migrationHash);
  if (!i1Check.pass) {
    return buildBlockResult(i1Check.reason, { invariant: 'I1', ...i1Check.evidence }, timestamp);
  }

  const i5Check = checkEnvironmentMatch(approval, input.execution_environment);
  if (!i5Check.pass) {
    return buildBlockResult(i5Check.reason, { invariant: 'I2/I5', ...i5Check.evidence }, timestamp);
  }

  if (input.execution_schema) {
    const schemaCheck = checkSchemaMatch(approval, input.execution_schema);
    if (!schemaCheck.pass) {
      return buildBlockResult(schemaCheck.reason, { invariant: 'I2', ...schemaCheck.evidence }, timestamp);
    }
  }

  const i4Check = checkTimeValidity(approval);
  if (!i4Check.pass) {
    return buildBlockResult(i4Check.reason, { invariant: 'I4', ...i4Check.evidence }, timestamp);
  }

  const i6Check = checkApproverAuthority(approval);
  if (!i6Check.pass) {
    return buildBlockResult(i6Check.reason, { invariant: 'I6', ...i6Check.evidence }, timestamp);
  }

  const i7Check = checkIntegrity(approval);
  if (!i7Check.pass) {
    return buildBlockResult(i7Check.reason, { invariant: 'I7', ...i7Check.evidence }, timestamp);
  }

  if (approval.status !== 'approved') {
    return buildBlockResult('APPROVAL_ALREADY_USED', {
      invariant: 'I3',
      approval_id: approval.approval_id,
      current_status: approval.status,
      note: 'Approval no longer in approved state'
    }, timestamp);
  }

  return {
    gate: 'G2_APPROVAL',
    decision: 'PASS',
    evidence: {
      approval_id: approval.approval_id,
      migration_id: approval.migration_id,
      approval_mode: approval.approval_mode || 'separated',
      requester_id: approval.requester_id,
      approver_id: approval.approver_id,
      approver_role: approval.approver_role,
      approved_at: approval.approved_at,
      target_environment: approval.target_environment,
      execution_started_at: new Date().toISOString(),
      invariants_verified: ['I0', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7']
    },
    timestamp
  };
}

// ============================================================================
// MAIN GATE LOGIC
// ============================================================================

/**
 * G2 — Approval Gate
 * Verifies approval according to R4.1 contract (8 invariants)
 * 
 * @param {ApprovalGateInput} input 
 * @returns {Promise<GateResult>}
 */
async function verifyApproval(input) {
  const startTime = Date.now();
  
  // Connect to database
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'DATABASE_CONNECTION_FAILED',
      evidence: { error: 'DATABASE_URL not configured' },
      timestamp: startTime
    };
  }
  
  // Import pg for direct PostgreSQL connection
  const pg = await import('pg');
  const { Client } = pg.default;
  
  let dbConfig;
  try {
    dbConfig = createBdgfDatabaseConfig(dbUrl);
  } catch {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'INVALID_DATABASE_URL',
      evidence: {},
      timestamp: startTime
    };
  }
  
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    // 1. Find approval (status MUST be 'approved')
    const result = await client.query(`
      SELECT * FROM bella_migration_approval
      WHERE migration_id = $1
        AND status = 'approved'
      LIMIT 1
    `, [input.migration_id]);
    
    if (result.rows.length === 0) {
      return {
        gate: 'G2_APPROVAL',
        decision: 'BLOCK',
        reason: 'NO_APPROVAL_FOUND',
        evidence: { 
          migration_id: input.migration_id,
          searched_status: 'approved'
        },
        timestamp: startTime
      };
    }
    
    const approval = result.rows[0];
    return evaluateApprovalRecord(approval, input, startTime);
    
  } catch (error) {
    console.error('❌ verifyApproval() EXCEPTION CAUGHT:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'VERIFICATION_ERROR',
      evidence: {
        error: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        note: 'Fail closed - any error blocks execution'
      },
      timestamp: startTime
    };
  } finally {
    await client.end();
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * CLI wrapper for testing
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node r4-verify-approval.mjs <migration_id> <migration_file> <environment>');
    console.error('Example: node r4-verify-approval.mjs M001 migration.sql production');
    process.exit(1);
  }
  
  const [migrationId, migrationFile, environment] = args;
  
  // Read migration content
  const fs = await import('fs');
  let migrationContent;
  try {
    migrationContent = fs.readFileSync(migrationFile, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${error.message}`);
    process.exit(1);
  }
  
  // Verify approval
  console.log('🔒 G2 — Approval Gate Verification\n');
  console.log(`Migration ID: ${migrationId}`);
  console.log(`Environment: ${environment}`);
  console.log(`Content hash: ${computeHash(migrationContent).substring(0, 16)}...\n`);
  
  const result = await verifyApproval({
    migration_id: migrationId,
    migration_content: migrationContent,
    execution_environment: environment
  });
  
  console.log(`Gate: ${result.gate}`);
  console.log(`Decision: ${result.decision}`);
  
  if (result.decision === 'BLOCK') {
    console.log(`Reason: ${result.reason}`);
  }
  
  console.log('\nEvidence:');
  console.log(JSON.stringify(result.evidence, null, 2));
  
  process.exit(result.decision === 'PASS' ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing
export { verifyApproval, evaluateApprovalRecord, computeHash, computeApprovalHash };
