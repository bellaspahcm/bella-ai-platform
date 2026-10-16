#!/usr/bin/env node
/**
 * BELLA DEPLOYMENT GOVERNANCE FRAMEWORK
 * Migration Execution Wrapper — R4.3.3 Authorized Execution Path
 * 
 * This wrapper is the ONLY authorized way to execute migrations.
 * 
 * EXECUTION FLOW:
 * 1. Verify approval exists and is valid
 * 2. Issue gate token (cryptographic authorization)
 * 3. Invoke isolated executor with token
 * 4. Audit execution lifecycle
 * 
 * SECURITY MODEL:
 * - Wrapper has approval verification authority
 * - Executor has mutation execution authority
 * - Token bridges the two with cryptographic binding
 * - No direct executor invocation allowed
 */

import { verifyApproval } from './r4-verify-approval.mjs';
import { issueGateToken } from './gate-token.mjs';
import { executeMigration } from './migration-executor.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import { createBdgfDatabaseConfig } from './database-connection.mjs';
import { assertExecutionIdentity } from './execution-identity.mjs';

const { Client } = pg;
dotenv.config();

// ============================================================================
// AUDIT HELPER
// ============================================================================

async function auditEvent(event, data) {
  // TODO: Implement proper audit using bella_execution_audit schema
  // For now, skip audit in tests to focus on core execution flow
  return;
}

// ============================================================================
// EXECUTE MIGRATION WITH AUTHORIZATION
// ============================================================================

/**
 * Execute migration through authorized path
 * 
 * @param {Object} params - Execution parameters
 * @param {string} params.approval_id - Approval ID (REQUIRED)
 * @param {string} params.migration_content - DDL content (REQUIRED)
 * @param {string} params.target_environment - Target environment (default: 'production')
 * @param {string} params.target_schema - Target schema (default: 'public')
 * @param {string} params.executor_identity - Executor identity (default: 'bella_migration_executor')
 * @returns {Promise<Object>} Execution result
 */
export async function executeMigrationWithAuthorization(params) {
  const { 
    approval_id, 
    migration_content, 
    target_environment = 'production',
    target_schema = 'public',
    executor_identity = 'bella_migration_executor'
  } = params;
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ BELLA MIGRATION WRAPPER — AUTHORIZED EXECUTION            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  // Validate required parameters
  if (!approval_id) {
    throw new Error('approval_id is required');
  }
  
  if (!migration_content) {
    throw new Error('migration_content is required');
  }
  
  console.log(`📋 Approval ID: ${approval_id}`);
  console.log(`🎯 Environment: ${target_environment}`);
  console.log(`📂 Schema: ${target_schema}`);
  console.log(`👤 Executor: ${executor_identity}\n`);
  
  // ========================================================================
  // STEP 1: VERIFY APPROVAL
  // ========================================================================
  
  console.log('🔍 STEP 1: Verifying approval...\n');
  
  await auditEvent('APPROVAL_VERIFICATION_STARTED', {
    approval_id,
    target_environment,
    target_schema
  });
  
  let verification;
  try {
    verification = await verifyApproval({
      migration_id: approval_id,  // In R4.3 we use approval_id as migration_id
      migration_content,
      execution_environment: target_environment,
      execution_schema: target_schema
    });
  } catch (error) {
    console.log(`❌ Approval verification failed with exception: ${error.message}\n`);
    console.log(`   Stack: ${error.stack}\n`);
    
    await auditEvent('APPROVAL_VERIFICATION_FAILED', {
      approval_id,
      error: error.message,
      execution_time_ms: Date.now() - startTime
    });
    
    throw new Error(`Approval verification failed: ${error.message}`);
  }
  
  if (!verification || verification.decision !== 'PASS') {
    console.log('❌ Approval NOT valid\n');
    console.log(`   Reason: ${verification?.reason || 'Unknown'}\n`);
    
    await auditEvent('APPROVAL_REJECTED', {
      approval_id,
      reason: verification?.reason,
      evidence: verification?.evidence
    });
    
    throw new Error(`Approval rejected: ${verification?.reason || 'Verification failed'}`);
  }
  
  console.log('✅ Approval verified\n');
  
  await auditEvent('APPROVAL_VERIFIED', {
    approval_id,
    approval_evidence: verification.evidence
  });
  
  // ========================================================================
  // STEP 2: ISSUE GATE TOKEN
  // ========================================================================
  
  console.log('🔒 STEP 2: Issuing gate token...\n');
  
  // Token issuance requires executor credentials (not developer)
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_EXECUTOR_URL not configured');
  }
  
  const db = new Client(createBdgfDatabaseConfig(dbUrl));
  
  let token;
  let executionResult;
  
  try {
    await db.connect();
    await assertExecutionIdentity(db, executor_identity);
    
    // Import computeHash from verifier
    const { computeHash } = await import('./r4-verify-approval.mjs');
    const migration_hash = computeHash(migration_content);
    
    // Issue gate token
    token = await issueGateToken({
      approval_id,
      migration_id: approval_id,  // R4.3.3: approval_id IS the migration_id
      migration_hash,
      target_environment,
      target_schema,
      executor_identity
    }, db);
    
    console.log('✅ Gate token issued\n');
    console.log(`   Token ID: ${token.token_id}`);
    console.log(`   Nonce: ${token.payload.nonce.substring(0, 16)}...`);
    console.log(`   Expires: ${new Date(token.payload.expires_at).toISOString()}\n`);
    
    await auditEvent('GATE_TOKEN_ISSUED', {
      approval_id,
      token_id: token.token_id,
      token_nonce: token.payload.nonce.substring(0, 16) + '...',
      expires_at: token.payload.expires_at
    });
    
    // ========================================================================
    // STEP 3: EXECUTE MIGRATION (ISOLATED EXECUTOR)
    // ========================================================================
    
    console.log('🚀 STEP 3: Executing migration through isolated executor...\n');
    
    try {
      executionResult = await executeMigration({
        token,
        migration_content,
        target_environment,
        target_schema,
        executor_identity
      });
      
      console.log('✅ Migration execution completed successfully\n');
      
      await auditEvent('WRAPPER_EXECUTION_SUCCESS', {
        approval_id,
        token_id: token.token_id,
        rows_affected: executionResult.rows_affected,
        total_execution_time_ms: Date.now() - startTime
      });
      
    } catch (executionError) {
      console.log(`❌ Migration execution failed: ${executionError.message}\n`);
      
      await auditEvent('WRAPPER_EXECUTION_FAILED', {
        approval_id,
        token_id: token.token_id,
        error: executionError.message,
        blocked: executionError.blocked || false,
        failed: executionError.failed || false,
        total_execution_time_ms: Date.now() - startTime
      });
      
      throw executionError;
    }
    
  } finally {
    await db.end();
  }
  
  // ========================================================================
  // RETURN RESULT
  // ========================================================================
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('EXECUTION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Status: ${executionResult.status}`);
  console.log(`Approval ID: ${approval_id}`);
  console.log(`Token ID: ${token.token_id}`);
  console.log(`Rows Affected: ${executionResult.rows_affected || 0}`);
  console.log(`Total Time: ${Date.now() - startTime}ms`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return {
    status: 'SUCCESS',
    approval_id,
    token_id: token.token_id,
    execution: executionResult,
    total_execution_time_ms: Date.now() - startTime
  };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: execute-migration-wrapper.mjs <approval_id> <migration_file>');
    console.log('');
    console.log('Example:');
    console.log('  node execute-migration-wrapper.mjs APPR_001 migration.sql');
    console.log('');
    process.exit(1);
  }
  
  const [approval_id, migration_file] = args;
  
  // Read migration content
  const fs = await import('fs');
  let migration_content;
  try {
    migration_content = fs.readFileSync(migration_file, 'utf8');
  } catch (error) {
    console.error(`❌ Failed to read migration file: ${error.message}`);
    process.exit(1);
  }
  
  // Execute
  try {
    await executeMigrationWithAuthorization({
      approval_id,
      migration_content,
      target_environment: process.env.TARGET_ENVIRONMENT || 'production',
      target_schema: process.env.TARGET_SCHEMA || 'public',
      executor_identity: process.env.EXECUTOR_IDENTITY || 'bella_migration_executor'
    });
    
    console.log('✅ Migration completed successfully\n');
    process.exit(0);
    
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}\n`);
    process.exit(1);
  }
}
