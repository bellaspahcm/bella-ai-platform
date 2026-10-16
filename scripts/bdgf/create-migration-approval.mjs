#!/usr/bin/env node
/**
 * BDGF operational approval entrypoint.
 *
 * Creates a bella_migration_approval record compatible with the current
 * execute-migration-wrapper.mjs contract.
 */

import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
import { computeApprovalHash, computeHash } from './r4-verify-approval.mjs';
import { buildOwnerAuthorityNotes, resolveGitHubActionsOwnerAuthority } from './owner-authority.mjs';
import { createBdgfDatabaseConfig } from './database-connection.mjs';

const { Client } = pg;
dotenv.config();

const AUTHORIZED_ROLES_BY_ENVIRONMENT = {
  production: ['admin', 'dba', 'emergency_override'],
  staging: ['admin', 'dba', 'tech_lead'],
  dev: ['admin', 'dba', 'tech_lead']
};

const DEFAULT_EXPIRY_MINUTES = 120;
const MAX_EXPIRY_MINUTES = 24 * 60;
const APPROVAL_MODES = ['separated', 'owner_operated'];

function parseArgs(argv) {
  return argv.reduce((args, arg) => {
    if (!arg.startsWith('--')) {
      return args;
    }

    const [key, ...valueParts] = arg.slice(2).split('=');
    const value = valueParts.length > 0 ? valueParts.join('=') : 'true';
    return { ...args, [key]: value };
  }, {});
}

function requireArg(args, key) {
  const value = args[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required argument --${key}`);
  }
  return value.trim();
}

function parseExpiryMinutes(value) {
  if (value === undefined) {
    return DEFAULT_EXPIRY_MINUTES;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('--expires-in-minutes must be a positive integer');
  }

  if (parsed > MAX_EXPIRY_MINUTES) {
    throw new Error(`--expires-in-minutes must be <= ${MAX_EXPIRY_MINUTES}`);
  }

  return parsed;
}

function validateApprovalRequest(request) {
  const authorizedRoles = AUTHORIZED_ROLES_BY_ENVIRONMENT[request.targetEnvironment];
  if (!authorizedRoles) {
    throw new Error(`Unsupported target environment: ${request.targetEnvironment}`);
  }

  if (!APPROVAL_MODES.includes(request.approvalMode)) {
    throw new Error(`Unsupported approval mode: ${request.approvalMode}`);
  }

  if (request.approvalMode === 'separated' && request.requesterId === request.approverId) {
    throw new Error('Requester and approver must be different identities');
  }

  if (request.approvalMode === 'owner_operated') {
    if (request.requesterId !== request.approverId) {
      throw new Error('Owner-operated approval requires requester and approver to be the same verified owner identity');
    }

    if (request.authoritySource !== 'github_actions') {
      throw new Error('Owner-operated approval requires trusted GitHub Actions owner authority');
    }

    if (!request.authorityEvidence || request.authorityEvidence.provider !== 'github_actions') {
      throw new Error('Owner-operated approval requires verifiable authority evidence');
    }
  }

  if (!authorizedRoles.includes(request.approverRole)) {
    throw new Error(
      `Approver role ${request.approverRole} is not authorized for ${request.targetEnvironment}`
    );
  }

  if (request.expiresInMinutes <= 0 || request.expiresInMinutes > MAX_EXPIRY_MINUTES) {
    throw new Error(`Approval expiry must be between 1 and ${MAX_EXPIRY_MINUTES} minutes`);
  }
}

function buildApprovalHashInput(row) {
  return {
    approval_id: row.approval_id,
    migration_id: row.approval_id,
    migration_hash: row.migration_hash,
    approval_mode: row.approval_mode || 'separated',
    requester_id: row.requester_id,
    approver_id: row.approver_id,
    approver_role: row.approver_role,
    approved_at: row.approved_at,
    target_environment: row.target_environment,
    expires_at: row.expires_at
  };
}

async function buildRequestFromArgs(args, options = {}) {
  const migrationFile = requireArg(args, 'migration-file');
  const migrationContent = readFileSync(migrationFile, 'utf8');
  const approvalMode = (args['approval-mode']?.trim() || 'separated').replace(/-/g, '_');
  const targetEnvironment = args.environment?.trim() || 'production';
  const targetSchema = args['target-schema']?.trim() || 'public';
  const notes = args.notes?.trim() || null;

  if (approvalMode === 'owner_operated') {
    if (args.requester || args.approver || args['approver-role']) {
      throw new Error('owner_operated approvals derive requester, approver and role from trusted authority, not CLI arguments');
    }

    const authority = options.ownerAuthority || await resolveGitHubActionsOwnerAuthority({
      targetEnvironment,
      targetSchema
    }, options);

    return {
      migrationFile,
      migrationContent,
      migrationHash: computeHash(migrationContent),
      requesterId: authority.requesterId,
      approverId: authority.approverId,
      approverRole: authority.approverRole,
      approvalMode,
      targetEnvironment,
      targetSchema,
      expiresInMinutes: parseExpiryMinutes(args['expires-in-minutes']),
      notes: buildOwnerAuthorityNotes(notes, authority.evidence),
      authoritySource: authority.authoritySource,
      authorityEvidence: authority.evidence
    };
  }

  return {
    migrationFile,
    migrationContent,
    migrationHash: computeHash(migrationContent),
    requesterId: requireArg(args, 'requester'),
    approverId: requireArg(args, 'approver'),
    approverRole: requireArg(args, 'approver-role'),
    approvalMode,
    targetEnvironment,
    targetSchema,
    expiresInMinutes: parseExpiryMinutes(args['expires-in-minutes']),
    notes
  };
}

async function createApprovalRecord(db, request) {
  validateApprovalRequest(request);

  await db.query('BEGIN');

  try {
    const temporaryMigrationId = `request_${request.migrationHash.slice(0, 16)}_${Date.now()}`;
    const approvedAt = new Date();
    const expiresAt = new Date(approvedAt.getTime() + request.expiresInMinutes * 60 * 1000);

    const insertResult = await db.query(
      `
        INSERT INTO bella_migration_approval (
          migration_id,
          migration_hash,
          approval_mode,
          requester_id,
          approver_id,
          approver_role,
          approved_at,
          target_environment,
          target_schema,
          expires_at,
          status,
          approval_hash,
          created_by,
          notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          'requested',
          $11,
          $12,
          $13
        )
        RETURNING
          approval_id,
          migration_hash,
          approval_mode,
          requester_id,
          approver_id,
          approver_role,
          approved_at,
          target_environment,
          expires_at
      `,
      [
        temporaryMigrationId,
        request.migrationHash,
        request.approvalMode,
        request.requesterId,
        request.approverId,
        request.approverRole,
        approvedAt,
        request.targetEnvironment,
        request.targetSchema,
        expiresAt,
        'pending_hash',
        request.requesterId,
        request.notes
      ]
    );

    const inserted = insertResult.rows[0];
    const approvalHash = computeApprovalHash(buildApprovalHashInput(inserted));

    const updateResult = await db.query(
      `
        UPDATE bella_migration_approval
        SET
          migration_id = approval_id::text,
          approval_hash = $1,
          status = 'approved'
        WHERE approval_id = $2
        RETURNING
          approval_id,
          migration_id,
          migration_hash,
          approval_mode,
          requester_id,
          approver_id,
          approver_role,
          approved_at,
          target_environment,
          target_schema,
          expires_at,
          status,
          approval_hash
      `,
      [approvalHash, inserted.approval_id]
    );

    await db.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const request = await buildRequestFromArgs(args);
  validateApprovalRequest(request);

  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_EXECUTOR_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL or DATABASE_EXECUTOR_URL is required');
  }

  const db = new Client(createBdgfDatabaseConfig(dbUrl));

  await db.connect();
  try {
    const approval = await createApprovalRecord(db, request);

    console.log('BDGF approval created');
    console.log(JSON.stringify({
      approval_id: approval.approval_id,
      migration_id: approval.migration_id,
      migration_hash: approval.migration_hash,
      approval_mode: approval.approval_mode,
      target_environment: approval.target_environment,
      target_schema: approval.target_schema,
      status: approval.status,
      expires_at: approval.expires_at,
      wrapper_argument: approval.approval_id,
      compatibility_note: 'Current wrapper passes CLI approval_id as migration_id; this record sets migration_id = approval_id.'
    }, null, 2));
  } finally {
    await db.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`BDGF approval creation failed: ${error.message}`);
    process.exit(1);
  });
}

export {
  AUTHORIZED_ROLES_BY_ENVIRONMENT,
  APPROVAL_MODES,
  MAX_EXPIRY_MINUTES,
  buildApprovalHashInput,
  buildRequestFromArgs,
  createApprovalRecord,
  parseArgs,
  parseExpiryMinutes,
  validateApprovalRequest
};
