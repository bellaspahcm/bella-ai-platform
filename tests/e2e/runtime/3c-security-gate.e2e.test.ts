/**
 * Runtime Security Gate - CMG-RT-001
 * 
 * 10 Security Tests for Migration 04 v1.1
 * Architecture: BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1_1_CORRECTED.md
 * Test Plan: BELLA_RUNTIME_CONTROLLED_MIGRATION_GATE.md
 * Quality Standards: BELLA_RUNTIME_TEST_QUALITY_REQUIREMENTS.md
 * 
 * Status: FROZEN FOR VALIDATION
 * Date: 2026-08-19
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedClient } from '../../utils/test-jwt-helper';
import { E2E_TENANTS } from '../../utils/e2e-fixtures';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('CMG-RT-001: Runtime Security Gate', () => {
  let authenticatedClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let serviceRoleClient: SupabaseClient;
  let testUserId: string;
  let testTenantId: string;

  beforeAll(async () => {
    // AUTH PRECONDITION CHECK
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('PRECONDITION FAILED: Missing Supabase credentials');
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error('PRECONDITION FAILED: Missing SUPABASE_JWT_SECRET');
    }

    // Use canonical auth pattern from e2e-test-setup.ts
    testTenantId = E2E_TENANTS.TENANT_A.tenantId;
    testUserId = E2E_TENANTS.TENANT_A.userId;

    authenticatedClient = createAuthenticatedClient(testTenantId, testUserId);
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

    // PRECONDITION: Verify tenant exists in registry
    const { data: tenant, error: tenantError } = await serviceRoleClient
      .from('runtime_tenant_registry')
      .select('*')
      .eq('tenant_id', testTenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`PRECONDITION FAILED: Test tenant ${testTenantId} not found in registry`);
    }

    console.log(`✅ AUTH PRECONDITIONS MET: tenant=${testTenantId}, user=${testUserId}`);
  });

  /**
   * P0 TESTS (Must PASS)
   */

  test('CMG-RT-001.1: Tenant identity derived from JWT (P0)', async () => {
    const idempotencyKey = `cmg-tenant-${Date.now()}-${Math.random()}`;

    // Submit intent
    const { data: outboxId, error } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000, currency: 'VND' }
    });

    expect(error).toBeNull();
    expect(outboxId).toBeDefined();

    // Verify tenant_id derived from JWT context
    const { data: outbox } = await serviceRoleClient
      .from('runtime_outbox')
      .select('tenant_id, created_at')
      .eq('id', outboxId)
      .single();

    expect(outbox?.tenant_id).toBe(testTenantId);

    // Verify idempotency record
    const { data: idempotency } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('tenant_id, intent_type, correlation_id, outbox_id')
      .eq('idempotency_key', idempotencyKey)
      .single();

    expect(idempotency?.tenant_id).toBe(testTenantId);
    expect(idempotency?.intent_type).toBe('INVOICE_PAYMENT');
    expect(idempotency?.correlation_id).toBe(idempotencyKey);
    expect(idempotency?.outbox_id).toBe(outboxId);

    // Verify audit record
    const { data: audit } = await serviceRoleClient
      .from('runtime_audit_log')
      .select('tenant_id, intent_type, entity_id, entity_type, correlation_id, status, source')
      .eq('correlation_id', idempotencyKey)
      .eq('entity_id', outboxId)
      .single();

    expect(audit?.tenant_id).toBe(testTenantId);
    expect(audit?.intent_type).toBe('INVOICE_PAYMENT');
    expect(audit?.entity_type).toBe('financial_intent');
    expect(audit?.status).toBe('SUCCESS');
    expect(audit?.source).toBe('submit_financial_intent');
  });

  test('CMG-RT-001.2: Unauthenticated call rejected at privilege layer (P0)', async () => {
    const { error } = await anonClient.rpc('submit_financial_intent', {
      p_idempotency_key: 'cmg-anon-test',
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error).toBeDefined();
    // Supabase returns permission denied for anon on authenticated-only function
    expect(error?.message).toMatch(/permission denied|not authorized|JWT/i);
  });

  test('CMG-RT-001.3: Concurrent duplicate blocked by database (P0)', async () => {
    const idempotencyKey = `cmg-concurrent-${Date.now()}-${Math.random()}`;
    const intent = { type: 'INVOICE_PAYMENT', payload: { amount: 1000 } };

    // Concurrent requests with SAME key
    const results = await Promise.allSettled([
      authenticatedClient.rpc('submit_financial_intent', {
        p_idempotency_key: idempotencyKey,
        p_intent_type: intent.type,
        p_intent_payload: intent.payload
      }),
      authenticatedClient.rpc('submit_financial_intent', {
        p_idempotency_key: idempotencyKey,
        p_intent_type: intent.type,
        p_intent_payload: intent.payload
      })
    ]);

    // Verify API responses: 1 success, 1 duplicate error
    const successes = results.filter(r => 
      r.status === 'fulfilled' && r.value.data && !r.value.error
    );
    const failures = results.filter(r => 
      r.status === 'fulfilled' && r.value.error?.code === '23505'
    );

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Extract outbox id from success
    const successResult = results.find(r => 
      r.status === 'fulfilled' && r.value.data
    );
    if (!successResult || successResult.status !== 'fulfilled' || !successResult.value.data) {
      throw new Error('Expected one successful submit_financial_intent result');
    }
    const outboxId = successResult.value.data;

    // Verify database: Exactly 1 idempotency record FOR THIS KEY
    const { data: idempotencyRecords } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('idempotency_key', idempotencyKey);

    expect(idempotencyRecords).toHaveLength(1);
    expect(idempotencyRecords?.[0].outbox_id).toBe(outboxId);

    // Verify database: Exactly 1 outbox record
    const { data: outboxRecords } = await serviceRoleClient
      .from('runtime_outbox')
      .select('*')
      .eq('id', outboxId);

    expect(outboxRecords).toHaveLength(1);

    // Verify database: Exactly 1 audit record
    const { data: auditRecords } = await serviceRoleClient
      .from('runtime_audit_log')
      .select('*')
      .eq('correlation_id', idempotencyKey)
      .eq('entity_id', outboxId);

    expect(auditRecords).toHaveLength(1);
  });

  test('CMG-RT-001.4: Anon role execution denied (P0)', async () => {
    // NOTE: This test verifies same boundary as 001.2 (PostgreSQL privilege layer)
    // Both tests verify privilege boundary enforcement, not RPC body logic
    const { error } = await anonClient.rpc('submit_financial_intent', {
      p_idempotency_key: 'cmg-anon-privilege-test',
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/permission denied|not authorized/i);
  });

  test('CMG-RT-001.7: Sequential duplicate submission rejected (P0)', async () => {
    const idempotencyKey = `cmg-sequential-${Date.now()}-${Math.random()}`;

    // First request: Success
    const { data: outboxId1, error: error1 } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error1).toBeNull();
    expect(outboxId1).toBeDefined();

    // Second request: Duplicate (23505)
    const { data: outboxId2, error: error2 } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error2).toBeDefined();
    expect(error2?.code).toBe('23505'); // UNIQUE violation
    expect(outboxId2).toBeNull();

    // Verify: Only ONE outbox entry FOR THIS KEY
    const { data: idempotencyRecords } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('outbox_id')
      .eq('idempotency_key', idempotencyKey);

    expect(idempotencyRecords).toHaveLength(1);
    expect(idempotencyRecords?.[0].outbox_id).toBe(outboxId1);
  });

  /**
   * TB TESTS (Transaction Boundary Verification)
   */

  test('CMG-RT-001.5: Atomic rollback on constraint violation (TB)', async () => {
    const idempotencyKey = `cmg-rollback-${Date.now()}-${Math.random()}`;

    // Count BEFORE failure attempt
    const { count: outboxBefore } = await serviceRoleClient
      .from('runtime_outbox')
      .select('*', { count: 'exact', head: true });

    const { count: idempotencyBefore } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('*', { count: 'exact', head: true });

    const { count: auditBefore } = await serviceRoleClient
      .from('runtime_audit_log')
      .select('*', { count: 'exact', head: true });

    // Trigger constraint violation (NULL idempotency_key)
    const { error } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: null, // NULL violation
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/idempotency_key.*required/i);

    // Count AFTER failure attempt
    const { count: outboxAfter } = await serviceRoleClient
      .from('runtime_outbox')
      .select('*', { count: 'exact', head: true });

    const { count: idempotencyAfter } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('*', { count: 'exact', head: true });

    const { count: auditAfter } = await serviceRoleClient
      .from('runtime_audit_log')
      .select('*', { count: 'exact', head: true });

    // Verify NO NEW RECORDS created (atomic rollback)
    expect(outboxAfter).toBe(outboxBefore);
    expect(idempotencyAfter).toBe(idempotencyBefore);
    expect(auditAfter).toBe(auditBefore);

    // Verify specific test key does NOT exist
    const { data: idempotencyCheck } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('idempotency_key', idempotencyKey);

    expect(idempotencyCheck).toHaveLength(0);
  });

  test('CMG-RT-001.6: All 3 tables populated atomically on success (TB)', async () => {
    const idempotencyKey = `cmg-atomic-success-${Date.now()}-${Math.random()}`;

    const { data: outboxId, error } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000, currency: 'VND' }
    });

    expect(error).toBeNull();
    expect(outboxId).toBeDefined();

    // Verify outbox record exists
    const { data: outbox } = await serviceRoleClient
      .from('runtime_outbox')
      .select('*')
      .eq('id', outboxId)
      .single();

    expect(outbox).toBeDefined();
    expect(outbox?.intent_type).toBe('INVOICE_PAYMENT');
    expect(outbox?.status).toBe('PENDING');
    expect(outbox?.tenant_id).toBe(testTenantId);

    // Verify idempotency record exists
    const { data: idempotency } = await serviceRoleClient
      .from('runtime_idempotency_registry')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    expect(idempotency).toBeDefined();
    expect(idempotency?.outbox_id).toBe(outboxId);
    expect(idempotency?.tenant_id).toBe(testTenantId);
    expect(idempotency?.intent_type).toBe('INVOICE_PAYMENT');
    expect(idempotency?.correlation_id).toBe(idempotencyKey);

    // Verify audit record exists
    const { data: audit } = await serviceRoleClient
      .from('runtime_audit_log')
      .select('*')
      .eq('correlation_id', idempotencyKey)
      .eq('entity_id', outboxId)
      .single();

    expect(audit).toBeDefined();
    expect(audit?.tenant_id).toBe(testTenantId);
    expect(audit?.intent_type).toBe('INVOICE_PAYMENT');
    expect(audit?.entity_type).toBe('financial_intent');
    expect(audit?.status).toBe('SUCCESS');
  });

  test('CMG-RT-001.8: Submission does not trigger outbox processing (TB)', async () => {
    const idempotencyKey = `cmg-async-${Date.now()}-${Math.random()}`;

    const { data: outboxId, error } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error).toBeNull();
    expect(outboxId).toBeDefined();

    // Verify status = PENDING (not automatically processed)
    const { data: outbox } = await serviceRoleClient
      .from('runtime_outbox')
      .select('status')
      .eq('id', outboxId)
      .single();

    expect(outbox?.status).toBe('PENDING');

    // Wait to ensure no automatic processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify status still PENDING
    const { data: outboxStill } = await serviceRoleClient
      .from('runtime_outbox')
      .select('status')
      .eq('id', outboxId)
      .single();

    expect(outboxStill?.status).toBe('PENDING');
  });

  test('CMG-RT-001.9: Processing NOT triggered, PENDING until manual call (TB)', async () => {
    const idempotencyKey = `cmg-async-boundary-${Date.now()}-${Math.random()}`;

    // Submit intent
    const { data: outboxId, error } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    });

    expect(error).toBeNull();
    expect(outboxId).toBeDefined();

    // Verify: Outbox PENDING
    const { data: outbox } = await serviceRoleClient
      .from('runtime_outbox')
      .select('status')
      .eq('id', outboxId)
      .single();

    expect(outbox?.status).toBe('PENDING');

    // Behavioral proof: Wait for any async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify: Status still PENDING (no state transition)
    const { data: outboxStill } = await serviceRoleClient
      .from('runtime_outbox')
      .select('status')
      .eq('id', outboxId)
      .single();

    expect(outboxStill?.status).toBe('PENDING');

    // NOTE: Full behavioral proof requires processOutboxOnce() + Finance emission verification
    // This is deferred to Week 2 implementation (after Migration APPLY approval)
  });

  test('CMG-RT-001.10: RPC rejects structural, accepts business invalidity (TB)', async () => {
    // TEST 1: Structural invalidity → REJECT (empty intent_type)
    const { error: structuralError } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: `cmg-boundary-structural-${Date.now()}`,
      p_intent_type: '', // Empty string (structural invalid)
      p_intent_payload: { amount: 1000 }
    });

    expect(structuralError).toBeDefined();
    expect(structuralError?.message).toMatch(/intent_type.*required/i);

    // TEST 2: Business invalid but structurally valid → ACCEPT
    const idempotencyKey = `cmg-boundary-business-${Date.now()}-${Math.random()}`;
    const { data: outboxId, error: businessError } = await authenticatedClient.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'REVENUE_RECOGNIZED', // Valid type
      p_intent_payload: { 
        amount: -1000, // Negative (business invalid, but structurally valid number)
        currency: 'VND'
      }
    });

    // Runtime accepts structurally valid intent
    expect(businessError).toBeNull();
    expect(outboxId).toBeDefined();

    // Verify persisted
    const { data: outbox } = await serviceRoleClient
      .from('runtime_outbox')
      .select('intent_type, intent_payload')
      .eq('id', outboxId)
      .single();

    expect(outbox).toBeDefined();
    expect(outbox?.intent_type).toBe('REVENUE_RECOGNIZED');
    expect(outbox?.intent_payload.amount).toBe(-1000);

    // Business validation deferred to Finance OS (TB-3)
  });
});


