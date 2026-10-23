/**
 * Isolated service-layer Real DB diagnostic. No Product/Kernel fix is applied.
 * Launch commit and retry phases in separate Jest processes with the local-only
 * runner. Only event publication is fault injected; repository/RPC/policies are real.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Database } from '@/types/database.types';

const mockPublish = jest.fn(async () => undefined);
jest.mock('@/platform/host/event-bus', () => ({
  eventBus: { publish: mockPublish, subscribe: jest.fn() },
}));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => { throw new Error('Diagnostic must inject the actual isolated client'); },
}));

const { EnrollmentContractImpl } = require('@/platform/education/contracts/enrollment.contract.impl') as
  typeof import('@/platform/education/contracts/enrollment.contract.impl');
const { StudentContractImpl } = require('@/platform/education/contracts/student.contract.impl') as
  typeof import('@/platform/education/contracts/student.contract.impl');

const artifactPath = 'implementation-artifacts/preschool-full-chain/ENROLLMENT_RECOVERY_REAL_DB.json';
const phase = process.env.PRESCHOOL_RECOVERY_DB_PHASE;
const faultMessage = 'Controlled event failure after actual enrollment COMMIT';

interface Scenario {
  tenantId: string;
  studentPartyId: string;
  courseId: string;
  requestId: string;
  originalEnrollmentId: string;
}
interface Evidence {
  target: string;
  baseline: string;
  classification: string;
  commitProcessId: number;
  retryProcessId?: number;
  tenantId: string;
  actorId: string;
  partyIds: string[];
  courseIds: string[];
  capacity: Scenario;
  credits: Scenario;
  archived: Scenario;
  beforeRetry: Database['public']['Tables']['edu_enrollments']['Row'][];
  afterRetry?: Database['public']['Tables']['edu_enrollments']['Row'][];
  results?: Record<string, string>;
}

function localClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url !== 'http://127.0.0.1:55421' || !key || key === 'mock-service-role-key') {
    throw new Error('REFUSE_NON_ISOLATED_REAL_DB_TARGET');
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function assertNoDbError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

// Explicit opt-in prevents an ordinary unit run from writing a database.
// This file's skipped state outside the local runner is not Real DB PASS.
const diagnostic = phase === 'commit' || phase === 'retry' ? describe : describe.skip;
diagnostic('isolated public Enrollment contract recovery diagnostic', () => {
  jest.setTimeout(90000);

  if (phase !== 'commit' && phase !== 'retry') {
    it('requires explicit local diagnostic opt-in; ordinary unit runs do not write DB', () => {
      throw new Error('Run through the isolated local diagnostic launcher');
    });
  }

  if (phase === 'commit') {
    it('persists controlled fixtures and loses the post-COMMIT acknowledgement', async () => {
      const db = localClient();
      const tenantId = randomUUID();
      const { error: tenantError } = await db.from('tenants').insert({
        id: tenantId, name: 'Isolated Preschool recovery diagnostic', status: 'active',
      });
      assertNoDbError(tenantError, 'create controlled tenant');

      const { data: auth, error: authError } = await db.auth.admin.createUser({
        email: `preschool-recovery-${randomUUID()}@example.test`,
        password: `${randomUUID()}${randomUUID()}`, email_confirm: true,
      });
      assertNoDbError(authError, 'create controlled Auth user');
      if (!auth.user?.email) throw new Error('Controlled Auth identity missing');
      const { error: userError } = await db.from('users').insert({
        id: auth.user.id, email: auth.user.email, full_name: 'Controlled diagnostic actor',
        tenant_id: tenantId, role: 'admin_staff', status: 'active',
      });
      assertNoDbError(userError, 'create matching public user');

      const partyIds = [randomUUID(), randomUUID(), randomUUID()];
      const { error: partyError } = await db.from('party_parties').insert(partyIds.map((id, index) => ({
        id, tenant_id: tenantId, party_type: 'person',
        display_name: `Controlled diagnostic child ${index + 1}`,
        created_by: auth.user.id, updated_by: auth.user.id,
      })));
      assertNoDbError(partyError, 'create controlled canonical Parties');
      for (const [index, partyId] of partyIds.entries()) {
        const student = await new StudentContractImpl(db).registerStudent({
          tenantId, partyId, studentCode: `EDU-2026-${Date.now()}${index}`,
        });
        expect(student.partyId).toBe(partyId);
        expect((await new StudentContractImpl(db).getStudent(tenantId, partyId))?.partyId).toBe(partyId);
      }

      const courseIds = Array.from({ length: 10 }, () => randomUUID());
      const { error: courseError } = await db.from('edu_courses').insert(courseIds.map((id, index) => ({
        id, tenant_id: tenantId, course_code: `DIAG-${index}-${randomUUID()}`,
        title: `Controlled diagnostic course ${index + 1}`, status: 'active',
        max_students: 1, current_enrollment: 0, prerequisite_course_codes: [],
      })));
      assertNoDbError(courseError, 'create canonical schema course fixtures');

      async function loseAcknowledgement(studentPartyId: string, courseId: string): Promise<Scenario> {
        const requestId = randomUUID();
        mockPublish.mockRejectedValueOnce(new Error(faultMessage));
        await expect(new EnrollmentContractImpl(db).enrollStudent({
          tenantId, studentPartyId, courseId, requestId,
        })).rejects.toThrow(faultMessage);
        // Diagnostic DB observer only. Product runtime is prohibited from this lookup.
        const { data: rows, error } = await db.from('edu_enrollments').select('*')
          .eq('tenant_id', tenantId).eq('request_id', requestId);
        assertNoDbError(error, 'read actual committed enrollment after failure');
        expect(rows).toHaveLength(1);
        const row = rows?.[0];
        if (!row) throw new Error('Actual persisted enrollment missing');
        expect(row.student_party_id).toBe(studentPartyId);
        expect(row.course_id).toBe(courseId);
        return { tenantId, studentPartyId, courseId, requestId, originalEnrollmentId: row.id };
      }

      const capacity = await loseAcknowledgement(partyIds[0], courseIds[0]);
      for (const courseId of courseIds.slice(1, 8)) {
        await new EnrollmentContractImpl(db).enrollStudent({
          tenantId, studentPartyId: partyIds[1], courseId, requestId: randomUUID(),
        });
      }
      const credits = await loseAcknowledgement(partyIds[1], courseIds[8]);
      const archived = await loseAcknowledgement(partyIds[2], courseIds[9]);
      const { error: archiveError } = await db.from('edu_courses').update({ status: 'archived' })
        .eq('tenant_id', tenantId).eq('id', archived.courseId);
      assertNoDbError(archiveError, 'controlled archived course fixture transition');

      const { data: beforeRetry, error: readError } = await db.from('edu_enrollments').select('*')
        .eq('tenant_id', tenantId).order('id');
      assertNoDbError(readError, 'capture before-restart actual enrollment rows');
      expect(beforeRetry).toHaveLength(10);
      const evidence: Evidence = {
        target: 'http://127.0.0.1:55421 isolated Non-Production',
        baseline: process.env.PRESCHOOL_PROOF_SHA ?? 'UNKNOWN',
        classification: 'SERVICE_LAYER_REAL_DB_DIAGNOSTIC_NOT_RLS_OR_BROWSER_PROOF',
        commitProcessId: process.pid, tenantId, actorId: auth.user.id,
        partyIds, courseIds, capacity, credits, archived, beforeRetry: beforeRetry ?? [],
      };
      writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
    });
  }

  if (phase === 'retry') {
    it('restarts in another process, recovers capacity replay and proves the two eligibility blocks', async () => {
      const db = localClient();
      const evidence = JSON.parse(readFileSync(artifactPath, 'utf8')) as Evidence;
      expect(process.pid).not.toBe(evidence.commitProcessId);
      const contract = new EnrollmentContractImpl(db);
      const recovered = await contract.enrollStudent(evidence.capacity);
      expect(recovered.id).toBe(evidence.capacity.originalEnrollmentId);
      await expect(contract.enrollStudent(evidence.credits)).rejects.toThrow('Platform credit limit exceeded');
      await expect(contract.enrollStudent(evidence.archived)).rejects.toThrow('expected active');
      // No creation event on successful duplicate recovery; blocked attempts never reached persistence.
      expect(mockPublish).not.toHaveBeenCalled();

      const { data: afterRetry, error } = await db.from('edu_enrollments').select('*')
        .eq('tenant_id', evidence.tenantId).order('id');
      assertNoDbError(error, 'read-back after fresh-process retry');
      expect(afterRetry).toEqual(evidence.beforeRetry);
      for (const scenario of [evidence.capacity, evidence.credits, evidence.archived]) {
        const matching = afterRetry?.filter((row) => row.request_id === scenario.requestId) ?? [];
        expect(matching).toHaveLength(1);
        expect(matching[0].id).toBe(scenario.originalEnrollmentId);
      }
      evidence.retryProcessId = process.pid;
      evidence.afterRetry = afterRetry ?? [];
      evidence.results = {
        capacity1LostAcknowledgementRestartRecovery: 'PASS_ORIGINAL_CANONICAL_ID',
        eighthEnrollmentLostAcknowledgementRestartRecovery: 'FAIL_CREDIT_ELIGIBILITY_BEFORE_DEDUPLICATION',
        archivedCourseLostAcknowledgementRestartRecovery: 'FAIL_COURSE_ELIGIBILITY_BEFORE_DEDUPLICATION',
        persistedEnrollmentRowsUnchanged: 'PASS_10_BEFORE_10_AFTER_EXACT_ROWS_EQUAL',
        restrictedActorRlsBrowser: 'NOT_PROVEN',
      };
      writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`);
    });
  }
});
