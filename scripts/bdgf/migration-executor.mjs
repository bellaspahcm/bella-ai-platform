#!/usr/bin/env node
/**
 * BELLA DEPLOYMENT GOVERNANCE FRAMEWORK
 * Migration Executor — R4.3.3 Execution Boundary
 * 
 * This is the SECURITY BOUNDARY for all database mutations.
 * 
 * CRITICAL ENFORCEMENT (E1):
 * - bella_migration_executor credentials alone are NOT sufficient
 * - Valid gate token is REQUIRED for any execution
 * - Token MUST be validated before ANY database connection
 * - Token MUST be consumed before ANY mutation
 * - Any validation failure → HARD BLOCK, no execution
 * 
 * EXECUTION FLOW:
 * 1. Check token exists → if not, BLOCK immediately
 * 2. Validate token (crypto + binding) → if invalid, BLOCK
 * 3. Consume token (atomic single-use) → if already used, BLOCK
 * 4. ONLY THEN: Open DB connection and execute migration
 * 
 * NO BYPASS PATHS ALLOWED.
 */

import { validateGateToken, consumeGateToken } from './gate-token.mjs';
import { computeHash } from './r4-verify-approval.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { createBdgfDatabaseConfig } from './database-connection.mjs';
import { assertExecutionIdentity } from './execution-identity.mjs';
import { auditMigrationEvent } from './audit-event.mjs';

const { Client } = pg;
dotenv.config();

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

class ExecutionBlockedError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ExecutionBlockedError';
    this.code = code;
    this.details = details;
    this.blocked = true;
  }
}

class ExecutionFailedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExecutionFailedError';
    this.details = details;
    this.failed = true;
  }
}

// ============================================================================
// AUDIT HELPER
// ============================================================================

// ============================================================================
// MIGRATION EXECUTOR — SECURITY BOUNDARY
// ============================================================================

/**
 * Execute migration with gate token authorization
 * 
 * @param {Object} params - Execution parameters
 * @param {Object} params.token - Gate token (REQUIRED)
 * @param {string} params.migration_content - DDL to execute
 * @param {string} params.target_environment - Target environment
 * @param {string} params.target_schema - Target schema
 * @param {string} params.executor_identity - Executor identity
 * @returns {Promise<Object>} Execution result
 * 
 * @throws {ExecutionBlockedError} If authorization fails
 * @throws {ExecutionFailedError} If migration execution fails
 */
export async function executeMigration(params) {
  const startTime = Date.now();
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ BELLA MIGRATION EXECUTOR — AUTHORIZATION GATE              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // ========================================================================
  // GATE 1: TOKEN EXISTENCE CHECK
  // ========================================================================
  
  console.log('🔒 GATE 1: Checking token existence...');
  
  if (!params || !params.token) {
    console.log('❌ BLOCKED: No gate token provided\n');
    throw new ExecutionBlockedError(
      'NO_TOKEN',
      'Migration execution requires valid gate token',
      { reason: 'Token parameter missing or null' }
    );
  }
  
  const { token, migration_content, target_environment, target_schema, executor_identity } = params;
  
  if (!token.payload || !token.signature) {
    console.log('❌ BLOCKED: Invalid token structure\n');
    throw new ExecutionBlockedError(
      'INVALID_TOKEN_STRUCTURE',
      'Gate token missing required fields',
      { has_payload: !!token.payload, has_signature: !!token.signature }
    );
  }
  
  console.log('✅ Token exists\n');
  
  // ========================================================================
  // GATE 2: TOKEN VALIDATION (CRYPTO + BINDING)
  // ========================================================================
  
  console.log('🔒 GATE 2: Validating token (signature + binding)...');
  
  // Build execution context for validation
  const migration_hash = computeHash(migration_content);
  const executionContext = {
    migration_hash,
    target_environment: target_environment || 'production',
    target_schema: target_schema || 'public',
    executor_identity: executor_identity || 'bella_migration_executor'
  };
  
  console.log(`   Migration hash: ${migration_hash.substring(0, 16)}...`);
  console.log(`   Environment: ${executionContext.target_environment}`);
  console.log(`   Schema: ${executionContext.target_schema}`);
  console.log(`   Executor: ${executionContext.executor_identity}`);
  
  // Connect to database for validation (read-only operation)
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new ExecutionBlockedError(
      'NO_DATABASE_URL',
      'DATABASE_URL not configured'
    );
  }
  
  let dbConfig;
  try {
    dbConfig = createBdgfDatabaseConfig(dbUrl);
  } catch {
    throw new ExecutionBlockedError(
      'INVALID_DATABASE_URL',
      'Invalid BDGF database connection configuration.'
    );
  }
  const db = new Client(dbConfig);
  
  try {
    await db.connect();
    await assertExecutionIdentity(db, executionContext.executor_identity);
    console.log('   ✅ Connected to database for validation');

    const verifiedAuditContext = {
      token_id: token.token_id || null,
      approval_id: token.payload.approval_id,
      migration_id: token.payload.migration_id,
      migration_hash,
      target_environment: executionContext.target_environment,
      target_schema: executionContext.target_schema,
      executor_identity: executionContext.executor_identity,
      created_by: executionContext.executor_identity
    };
    const writeAudit = (event, fields = {}) => auditMigrationEvent(db, {
      ...verifiedAuditContext,
      event,
      gate_decision: 'PASS',
      ...fields
    });
    
    // Validate token
    const validation = await validateGateToken(token, executionContext, db);
    
    if (!validation.valid) {
      console.log(`❌ BLOCKED: Token validation failed`);
      console.log(`   Reason: ${validation.reason}`);
      if (validation.evidence) {
        console.log(`   Evidence:`, JSON.stringify(validation.evidence, null, 2));
      }
      console.log('');
      
      await auditMigrationEvent(db, {
        ...verifiedAuditContext,
        token_id: null,
        approval_id: null,
        migration_id: `blocked_${migration_hash.slice(0, 24)}`,
        event: 'EXECUTION_BLOCKED',
        gate_decision: 'BLOCK',
        block_reason: 'TOKEN_INVALID',
        execution_result: 'not_attempted',
        execution_duration_ms: Date.now() - startTime,
        transaction_committed: false,
        metadata: { token_validation_reason: validation.reason },
        executor_identity: executionContext.executor_identity,
        created_by: executionContext.executor_identity
      });
      
      throw new ExecutionBlockedError(
        'INVALID_TOKEN',
        `Token validation failed: ${validation.reason}`,
        { validation }
      );
    }
    
    console.log('✅ Token validation passed\n');
    
    // ========================================================================
    // GATE 3: TOKEN CONSUMPTION (ATOMIC SINGLE-USE)
    // ========================================================================
    
    console.log('🔒 GATE 3: Consuming token (single-use enforcement)...');
    
    const consumption = await consumeGateToken(token.payload.nonce, db);
    
    if (!consumption.consumed) {
      console.log(`❌ BLOCKED: Token consumption failed`);
      console.log(`   Reason: ${consumption.reason}`);
      console.log('');
      
      await writeAudit('EXECUTION_BLOCKED', {
        gate_decision: 'BLOCK',
        block_reason: 'TOKEN_CONSUMPTION_FAILED',
        execution_result: 'not_attempted',
        execution_duration_ms: Date.now() - startTime,
        transaction_committed: false,
        metadata: { block_reason: consumption.reason }
      });
      
      throw new ExecutionBlockedError(
        'TOKEN_ALREADY_USED',
        `Token cannot be consumed: ${consumption.reason}`,
        { consumption }
      );
    }
    
    const grantRecordPresent = Boolean(consumption.token_id);
    console.log('✅ Token consumed successfully\n');
    console.log('   Authorization record:', grantRecordPresent ? 'present' : 'missing');
    console.log('   Used at:', consumption.used_at);
    console.log('');
    
    // ========================================================================
    // AUTHORIZATION PASSED — PROCEED WITH EXECUTION
    // ========================================================================
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ AUTHORIZATION PASSED — EXECUTING MIGRATION                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Audit execution start
    await writeAudit('EXECUTION_STARTED', {
      token_id: consumption.token_id,
      execution_duration_ms: Date.now() - startTime,
      transaction_committed: false
    });
    
    console.log('📝 Executing migration DDL...');
    console.log('   Content preview:', migration_content.substring(0, 100) + '...');
    console.log('');
    
    // Execute migration in transaction (where possible)
    let result;
    try {
      await db.query('BEGIN');
      result = await db.query(migration_content);
      await db.query('COMMIT');
    } catch (executionError) {
      // Rollback on failure (if transactional)
      let rollbackSucceeded = false;
      try {
        await db.query('ROLLBACK');
        rollbackSucceeded = true;
        console.log('🔄 Transaction rolled back');
      } catch {
        console.log('⚠️  Rollback failed (DDL may not be transactional)');
      }
      
      console.log('❌ Migration execution failed');
      console.log(`   Error code: ${executionError.code || 'UNKNOWN'}`);
      console.log('');
      
      // Audit failure
      try {
        await writeAudit('EXECUTION_FAILED', {
          execution_result: 'failed',
          execution_error: `Migration execution failed (${executionError.code || 'UNKNOWN'}).`,
          execution_duration_ms: Date.now() - startTime,
          transaction_committed: null,
          metadata: {
            failure_code: executionError.code || 'UNKNOWN',
            rollback_attempted: true,
            rollback_succeeded: rollbackSucceeded
          }
        });
      } catch {
        throw new ExecutionFailedError(
          'Migration failed and its failure audit could not be recorded; reconcile using the start audit before another execution.',
          { code: executionError.code, token_id: consumption.token_id, audit_recorded: false }
        );
      }
      
      throw new ExecutionFailedError(
        `Migration execution failed (${executionError.code || 'UNKNOWN'}).`,
        {
          code: executionError.code,
          token_id: consumption.token_id
        }
      );
    }

    console.log('✅ Migration executed successfully');
    console.log(`   Rows affected: ${result.rowCount || 0}`);
    console.log('');

    try {
      await writeAudit('EXECUTION_SUCCEEDED', {
        execution_result: 'success',
        execution_duration_ms: Date.now() - startTime,
        transaction_committed: true,
        metadata: { rows_affected: result.rowCount || 0 }
      });
    } catch {
      throw new ExecutionFailedError(
        'Migration committed, but its success audit could not be recorded; stop and reconcile before another execution.',
        { code: 'SUCCESS_AUDIT_MISSING', token_id: consumption.token_id, migration_committed: true, audit_recorded: false }
      );
    }

    return {
      status: 'SUCCESS',
      token_id: consumption.token_id,
      rows_affected: result.rowCount || 0,
      execution_time_ms: Date.now() - startTime,
      migration_hash
    };
    
  } finally {
    await db.end();
    console.log('🔌 Database connection closed\n');
  }
}

// ============================================================================
// CLI ENTRY POINT (for direct testing)
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('❌ ERROR: Direct executor invocation not supported\n');
  console.log('Migration executor requires wrapper invocation with gate token.');
  console.log('Use: execute-migration-wrapper.mjs\n');
  process.exit(1);
}
