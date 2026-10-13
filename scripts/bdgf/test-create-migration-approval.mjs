#!/usr/bin/env node
/**
 * Focused tests for the BDGF operational approval entrypoint.
 *
 * These tests do not write to the database. They verify the record contract
 * and validation logic before the command is used operationally.
 */

import assert from 'assert/strict';
import { readFileSync } from 'fs';
import { computeApprovalHash, computeHash, evaluateApprovalRecord } from './r4-verify-approval.mjs';
import {
  MAX_EXPIRY_MINUTES,
  buildApprovalHashInput,
  buildRequestFromArgs,
  parseArgs,
  parseExpiryMinutes,
  validateApprovalRequest
} from './create-migration-approval.mjs';
import { resolveGitHubActionsOwnerAuthority } from './owner-authority.mjs';

const R3_MIGRATION_PATH = 'supabase/migrations/20260926000000_r3_student_identity_resolver.sql';
const EXPECTED_R3_HASH = 'a3115b12c266d5717970337dc6f84fec4cc62fff505f12286e1db32ff744993b';

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

function validRequest(overrides = {}) {
  return {
    migrationFile: R3_MIGRATION_PATH,
    migrationContent: readFileSync(R3_MIGRATION_PATH, 'utf8'),
    migrationHash: EXPECTED_R3_HASH,
    requesterId: 'owner-requester@bella',
    approverId: 'owner-approver@bella',
    approverRole: 'admin',
    approvalMode: 'separated',
    targetEnvironment: 'production',
    targetSchema: 'public',
    expiresInMinutes: 120,
    notes: null,
    authoritySource: undefined,
    authorityEvidence: undefined,
    ...overrides
  };
}

function validOwnerAuthority(overrides = {}) {
  return {
    requesterId: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approverId: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approverRole: 'admin',
    authoritySource: 'github_actions',
    evidence: {
      provider: 'github_actions',
      repository: 'bellaspahcm/bella-spa-erp',
      run_id: '123456789',
      operator: 'bella-owner',
      github_permission: 'admin',
      target_environment: 'production',
      run_url: 'https://github.com/bellaspahcm/bella-spa-erp/actions/runs/123456789',
      verified_at: '2026-10-13T00:00:00.000Z',
      ...overrides.evidence
    },
    ...overrides
  };
}

function validOwnerApprovalRecord(overrides = {}) {
  const approval = {
    approval_id: '33333333-3333-4333-8333-333333333333',
    migration_id: '33333333-3333-4333-8333-333333333333',
    migration_hash: computeHash('SELECT 1;'),
    approval_mode: 'owner_operated',
    requester_id: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approver_id: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approver_role: 'admin',
    approved_at: '2026-10-13T00:00:00.000Z',
    target_environment: 'production',
    target_schema: 'public',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'approved',
    ...overrides
  };
  return {
    ...approval,
    approval_hash: computeApprovalHash(approval)
  };
}

function createMockGitHubFetch({ permission = 'admin', runOverrides = {} } = {}) {
  return async (url) => {
    const urlText = String(url);
    if (urlText.endsWith('/repos/bellaspahcm/bella-spa-erp/actions/runs/123456789')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 123456789,
            head_sha: 'abc123',
            repository: { full_name: 'bellaspahcm/bella-spa-erp' },
            actor: { login: 'original-actor' },
            triggering_actor: { login: 'bella-owner' },
            ...runOverrides
          };
        }
      };
    }

    if (urlText.endsWith('/repos/bellaspahcm/bella-spa-erp/collaborators/bella-owner/permission')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { permission };
        }
      };
    }

    return {
      ok: false,
      status: 404,
      async json() {
        return {};
      }
    };
  };
}

function mockGitHubEnv(overrides = {}) {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPOSITORY: 'bellaspahcm/bella-spa-erp',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_WORKFLOW: 'BDGF Migration',
    GITHUB_JOB: 'deploy',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'abc123',
    GITHUB_SERVER_URL: 'https://github.com',
    ...overrides
  };
}

await test('valid approval request is accepted', () => {
  assert.doesNotThrow(() => validateApprovalRequest(validRequest()));
});

await test('separated + same identity is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({
      requesterId: 'same@bella',
      approverId: 'same@bella',
      approvalMode: 'separated'
    })),
    /different identities/
  );
});

await test('owner-operated + same identity + verified production owner is accepted', () => {
  assert.doesNotThrow(() => validateApprovalRequest(validRequest({
    requesterId: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approverId: 'github:bellaspahcm/bella-spa-erp:bella-owner',
    approvalMode: 'owner_operated',
    approverRole: 'admin',
    authoritySource: 'github_actions',
    authorityEvidence: validOwnerAuthority().evidence
  })));
});

await test('owner-operated + self-declared role without authority evidence is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({
      requesterId: 'owner@bella',
      approverId: 'owner@bella',
      approvalMode: 'owner_operated',
      approverRole: 'admin'
    })),
    /trusted GitHub Actions owner authority/
  );
});

await test('missing approval mode defaults to separated and rejects same identity', () => {
  const request = validRequest({
    requesterId: 'same-default@bella',
    approverId: 'same-default@bella'
  });
  delete request.approvalMode;

  assert.throws(
    () => validateApprovalRequest({ ...request, approvalMode: request.approvalMode || 'separated' }),
    /different identities/
  );
});

await test('unauthorized production role is rejected', () => {
  assert.throws(
    () => validateApprovalRequest(validRequest({ approverRole: 'tech_lead' })),
    /not authorized for production/
  );
});

await test('approval hash uses the existing canonical algorithm', () => {
  const row = {
    approval_id: '11111111-1111-4111-8111-111111111111',
    migration_hash: EXPECTED_R3_HASH,
    approval_mode: 'owner_operated',
    requester_id: 'owner-requester@bella',
    approver_id: 'owner-approver@bella',
    approver_role: 'admin',
    approved_at: '2026-09-26T10:00:00.000Z',
    target_environment: 'production',
    expires_at: '2026-09-26T12:00:00.000Z'
  };

  const approvalInput = buildApprovalHashInput(row);
  assert.equal(approvalInput.migration_id, row.approval_id);
  assert.equal(computeApprovalHash(approvalInput), computeApprovalHash({
    approval_id: row.approval_id,
    migration_id: row.approval_id,
    migration_hash: row.migration_hash,
    approval_mode: row.approval_mode,
    requester_id: row.requester_id,
    approver_id: row.approver_id,
    approver_role: row.approver_role,
    approved_at: row.approved_at,
    target_environment: row.target_environment,
    expires_at: row.expires_at
  }));
});

await test('approval hash binds approval mode and role', () => {
  const baseApproval = {
    approval_id: '22222222-2222-4222-8222-222222222222',
    migration_id: '22222222-2222-4222-8222-222222222222',
    migration_hash: EXPECTED_R3_HASH,
    requester_id: 'owner@bella',
    approver_id: 'owner@bella',
    approver_role: 'admin',
    approved_at: '2026-09-26T10:00:00.000Z',
    target_environment: 'production',
    expires_at: '2026-09-26T12:00:00.000Z'
  };

  const separatedHash = computeApprovalHash({
    ...baseApproval,
    approval_mode: 'separated'
  });
  const ownerOperatedHash = computeApprovalHash({
    ...baseApproval,
    approval_mode: 'owner_operated'
  });
  const ownerOperatedTechLeadHash = computeApprovalHash({
    ...baseApproval,
    approval_mode: 'owner_operated',
    approver_role: 'tech_lead'
  });

  assert.notEqual(separatedHash, ownerOperatedHash);
  assert.notEqual(ownerOperatedHash, ownerOperatedTechLeadHash);
});

await test('migration hash is bound to exact file content', async () => {
  const actualHash = computeHash(readFileSync(R3_MIGRATION_PATH, 'utf8'));
  assert.equal(actualHash, EXPECTED_R3_HASH);

  const request = await buildRequestFromArgs(parseArgs([
    `--migration-file=${R3_MIGRATION_PATH}`,
    '--requester=owner-requester@bella',
    '--approver=owner-approver@bella',
    '--approver-role=admin',
    '--approval-mode=separated',
    '--environment=production',
    '--target-schema=public',
    '--expires-in-minutes=120'
  ]));

  assert.equal(request.migrationHash, EXPECTED_R3_HASH);
  assert.equal(request.approvalMode, 'separated');
});

await test('owner-operated CLI role spoof is rejected before authority lookup', async () => {
  await assert.rejects(
    () => buildRequestFromArgs(parseArgs([
      `--migration-file=${R3_MIGRATION_PATH}`,
      '--requester=owner@bella',
      '--approver=owner@bella',
      '--approver-role=admin',
      '--approval-mode=owner-operated',
      '--environment=production'
    ])),
    /not CLI arguments/
  );
});

await test('owner-operated CLI spelling is normalized with verified authority', async () => {
  const request = await buildRequestFromArgs(parseArgs([
    `--migration-file=${R3_MIGRATION_PATH}`,
    '--approval-mode=owner-operated',
    '--environment=production'
  ]), {
    ownerAuthority: validOwnerAuthority()
  });

  assert.equal(request.approvalMode, 'owner_operated');
  assert.equal(request.requesterId, 'github:bellaspahcm/bella-spa-erp:bella-owner');
  assert.equal(request.approverRole, 'admin');
  assert.doesNotThrow(() => validateApprovalRequest(request));
});

await test('GitHub Actions owner authority resolves run actor and admin role', async () => {
  const authority = await resolveGitHubActionsOwnerAuthority({
    targetEnvironment: 'production'
  }, {
    env: mockGitHubEnv(),
    fetchImpl: createMockGitHubFetch()
  });

  assert.equal(authority.requesterId, 'github:bellaspahcm/bella-spa-erp:bella-owner');
  assert.equal(authority.approverId, authority.requesterId);
  assert.equal(authority.approverRole, 'admin');
  assert.equal(authority.evidence.github_permission, 'admin');
});

await test('GitHub Actions owner authority rejects non-admin permission', async () => {
  await assert.rejects(
    () => resolveGitHubActionsOwnerAuthority({
      targetEnvironment: 'production'
    }, {
      env: mockGitHubEnv(),
      fetchImpl: createMockGitHubFetch({ permission: 'write' })
    }),
    /admin is required/
  );
});

await test('GitHub Actions owner authority rejects run SHA mismatch', async () => {
  await assert.rejects(
    () => resolveGitHubActionsOwnerAuthority({
      targetEnvironment: 'production'
    }, {
      env: mockGitHubEnv({ GITHUB_SHA: 'expected-sha' }),
      fetchImpl: createMockGitHubFetch({ runOverrides: { head_sha: 'different-sha' } })
    }),
    /SHA mismatch/
  );
});

await test('approval gate passes a valid owner-operated record', () => {
  const result = evaluateApprovalRecord(validOwnerApprovalRecord(), {
    migration_id: '33333333-3333-4333-8333-333333333333',
    migration_content: 'SELECT 1;',
    execution_environment: 'production',
    execution_schema: 'public'
  });

  assert.equal(result.decision, 'PASS');
});

await test('approval gate blocks wrong migration hash', () => {
  const result = evaluateApprovalRecord(validOwnerApprovalRecord(), {
    migration_id: '33333333-3333-4333-8333-333333333333',
    migration_content: 'SELECT 2;',
    execution_environment: 'production',
    execution_schema: 'public'
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reason, 'MIGRATION_HASH_MISMATCH');
});

await test('approval gate blocks wrong environment', () => {
  const result = evaluateApprovalRecord(validOwnerApprovalRecord(), {
    migration_id: '33333333-3333-4333-8333-333333333333',
    migration_content: 'SELECT 1;',
    execution_environment: 'staging',
    execution_schema: 'public'
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reason, 'ENVIRONMENT_MISMATCH');
});

await test('approval gate blocks tampered owner role', () => {
  const approval = validOwnerApprovalRecord();
  const result = evaluateApprovalRecord({
    ...approval,
    approver_role: 'tech_lead'
  }, {
    migration_id: '33333333-3333-4333-8333-333333333333',
    migration_content: 'SELECT 1;',
    execution_environment: 'production',
    execution_schema: 'public'
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reason, 'UNAUTHORIZED_APPROVER');
});

await test('expiry is present and bounded', () => {
  assert.equal(parseExpiryMinutes(undefined), 120);
  assert.equal(parseExpiryMinutes('60'), 60);
  assert.throws(() => parseExpiryMinutes('0'), /positive integer/);
  assert.throws(() => parseExpiryMinutes(String(MAX_EXPIRY_MINUTES + 1)), /must be <=/);
  assert.throws(
    () => validateApprovalRequest(validRequest({ expiresInMinutes: MAX_EXPIRY_MINUTES + 1 })),
    /Approval expiry/
  );
});

const failed = results.filter(result => !result.pass);
console.log(`\nBDGF approval entrypoint tests: ${results.length - failed.length}/${results.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
