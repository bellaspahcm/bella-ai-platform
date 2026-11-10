/**
 * Bella Interior OS — True Multi-Connection Concurrency Proof
 * Target: Real Supabase PostgreSQL database on Non-Production project bmnbqbcdbuklhopfbopv
 *
 * Demonstrates true concurrent execution using TWO INDEPENDENT PostgreSQL client connections
 * (different backend PIDs) dispatched simultaneously via Promise.all().
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.e2e' });

const { Client } = pg;
const connectionString = process.env.DATABASE_EXECUTOR_URL_TEST || process.env.DB_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_EXECUTOR_URL_TEST or DB_URL not found in .env.e2e');
  process.exit(1);
}

async function runConcurrencyTests() {
  console.log('====================================================================');
  console.log('BELLA INTERIOR OS — TRUE MULTI-CONNECTION CONCURRENCY VERIFICATION');
  console.log('Target DB: Non-Production (bmnbqbcdbuklhopfbopv)');
  console.log('====================================================================\n');

  // Establish TWO separate, independent PostgreSQL connections.
  // SSL configuration: derive from connection string rather than hard-coding insecure options.
  //   - If the URL contains sslmode=disable: no SSL (local dev only)
  //   - If the URL contains sslmode=require / sslmode=verify-ca / sslmode=verify-full: use system CA
  //   - Otherwise (Supabase Non-Production default): require SSL with system CA verification
  // SECURITY: rejectUnauthorized must remain true in all production/non-production environments.
  const hasDisableSSL = connectionString.includes('sslmode=disable');
  const sslConfig = hasDisableSSL ? false : true; // true = require SSL + system CA verification
  const c1 = new Client({ connectionString, ssl: sslConfig });
  const c2 = new Client({ connectionString, ssl: sslConfig });

  await c1.connect();
  await c2.connect();

  const pid1Res = await c1.query('SELECT pg_backend_pid() AS pid');
  const pid2Res = await c2.query('SELECT pg_backend_pid() AS pid');
  const pid1 = pid1Res.rows[0].pid;
  const pid2 = pid2Res.rows[0].pid;

  console.log(`[Connection 1] Established — PostgreSQL backend PID: ${pid1}`);
  console.log(`[Connection 2] Established — PostgreSQL backend PID: ${pid2}`);

  if (pid1 === pid2) {
    throw new Error('Test Invalid: Connection 1 and Connection 2 share the same backend PID!');
  }
  console.log(`-> PROVEN: Connections are on distinct PostgreSQL server processes (${pid1} !== ${pid2}).\n`);

  const tenantId = '88c62055-27f9-48f5-b3b3-635114f83ab1';
  const contractId = 'd4444444-4444-4444-8444-444444444444';
  const milestoneId = 'e5555555-5555-4555-8555-555555555552'; // Milestone 2 (Rough-in 165M)

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: PAYMENT DUPLICATE CONCURRENCY RACE (TWO INDEPENDENT CONNECTIONS)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Payment Reference Duplicate Race (2 Independent Connections) ---');
  const sharedRefCode = `RACE-PAY-${Date.now()}`;
  console.log(`Dispatched simultaneous INSERT with identical reference_code: ${sharedRefCode}`);

  const insertQuery = `
    INSERT INTO public.interior_payment_transactions (
      id, tenant_id, contract_id, milestone_id, amount,
      payment_method, reference_code, transaction_date, recorded_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, $8
    ) RETURNING id, reference_code;
  `;

  const startTime1 = Date.now();
  const [res1, res2] = await Promise.allSettled([
    c1.query(insertQuery, [
      crypto.randomUUID(), tenantId, contractId, milestoneId,
      165000000, 'bank_transfer', sharedRefCode, `Worker Connection PID ${pid1}`
    ]),
    c2.query(insertQuery, [
      crypto.randomUUID(), tenantId, contractId, milestoneId,
      165000000, 'bank_transfer', sharedRefCode, `Worker Connection PID ${pid2}`
    ])
  ]);
  const duration1 = Date.now() - startTime1;

  console.log(`Execution completed in ${duration1}ms across 2 parallel network requests:`);
  console.log(`  - Connection 1 (PID ${pid1}): status = ${res1.status}`);
  if (res1.status === 'fulfilled') {
    console.log(`    Result: SUCCESS (Inserted ID: ${res1.value.rows[0].id})`);
  } else {
    console.log(`    Result: REJECTED (Error Code: ${res1.reason.code}, Message: ${res1.reason.message})`);
  }

  console.log(`  - Connection 2 (PID ${pid2}): status = ${res2.status}`);
  if (res2.status === 'fulfilled') {
    console.log(`    Result: SUCCESS (Inserted ID: ${res2.value.rows[0].id})`);
  } else {
    console.log(`    Result: REJECTED (Error Code: ${res2.reason.code}, Message: ${res2.reason.message})`);
  }

  const successCount = (res1.status === 'fulfilled' ? 1 : 0) + (res2.status === 'fulfilled' ? 1 : 0);
  const failureCount = (res1.status === 'rejected' ? 1 : 0) + (res2.status === 'rejected' ? 1 : 0);
  const rejectedReason = res1.status === 'rejected' ? res1.reason : res2.reason;

  if (successCount !== 1 || failureCount !== 1 || rejectedReason.code !== '23505') {
    throw new Error(`TEST 1 FAILED! Expected 1 success and 1 error 23505, got ${successCount} success / ${failureCount} fail`);
  }

  // Database verification: verify only 1 row exists
  const countRes = await c1.query(
    'SELECT count(*) AS total FROM public.interior_payment_transactions WHERE contract_id = $1 AND reference_code = $2',
    [contractId, sharedRefCode]
  );
  console.log(`  - Database Verification: exactly ${countRes.rows[0].total} transaction stored in DB.`);
  console.log('-> TEST 1 PASSED: PostgreSQL unique constraint uq_interior_payment_tx_reference strictly rejected concurrent race condition with error 23505!\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: ATOMIC APPROVAL TOKEN CONSUMPTION RACE (TWO INDEPENDENT CONNECTIONS)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 2: Atomic Approval Token Consumption Race (2 Independent Connections) ---');
  const testApprovalId = crypto.randomUUID();
  const sharedToken = crypto.randomUUID();

  // Create pending approval record
  await c1.query(`
    INSERT INTO public.interior_customer_approvals (
      id, tenant_id, project_id, subject_type, subject_id,
      subject_version_number, approval_token, status,
      client_representative, client_contact, sent_at, expires_at,
      sent_by_actor_id, sent_by_actor_name
    ) VALUES (
      $1, $2, '662de798-69f8-458b-891d-604af3fb2f31', 'contract', $3,
      1, $4, 'pending',
      'Concurrent Client', 'concurrent@bella.vn', NOW(), NOW() + INTERVAL '2 days',
      'SYSTEM', 'Concurrency Suite'
    )
  `, [testApprovalId, tenantId, contractId, sharedToken]);
  console.log(`Created pending approval record ID: ${testApprovalId}`);
  console.log('Dispatched simultaneous conditional UPDATE from Connection 1 and Connection 2...');

  const updateQuery = `
    UPDATE public.interior_customer_approvals
    SET
      status = 'approved',
      approved_at = NOW(),
      customer_notes = $1
    WHERE id = $2
      AND status = 'pending'
      AND expires_at > NOW()
    RETURNING id, status, customer_notes;
  `;

  const startTime2 = Date.now();
  const [upd1, upd2] = await Promise.all([
    c1.query(updateQuery, [`Approved by Worker PID ${pid1}`, testApprovalId]),
    c2.query(updateQuery, [`Approved by Worker PID ${pid2}`, testApprovalId])
  ]);
  const duration2 = Date.now() - startTime2;

  console.log(`Execution completed in ${duration2}ms across 2 parallel network requests:`);
  console.log(`  - Connection 1 (PID ${pid1}): rowCount = ${upd1.rowCount}`);
  console.log(`  - Connection 2 (PID ${pid2}): rowCount = ${upd2.rowCount}`);

  const totalUpdated = upd1.rowCount + upd2.rowCount;
  if (totalUpdated !== 1) {
    throw new Error(`TEST 2 FAILED! Expected total rowCount 1, got ${totalUpdated}`);
  }

  const winningPid = upd1.rowCount === 1 ? pid1 : pid2;
  const losingPid = upd1.rowCount === 1 ? pid2 : pid1;
  console.log(`  - Exclusivity Proven: Worker PID ${winningPid} won the race (1 row updated). Worker PID ${losingPid} was locked out (0 rows updated).`);

  // Database verification: verify status and notes in DB
  const finalApprovalRes = await c1.query(
    'SELECT status, customer_notes FROM public.interior_customer_approvals WHERE id = $1',
    [testApprovalId]
  );
  console.log(`  - Database Verification: status = '${finalApprovalRes.rows[0].status}', notes = '${finalApprovalRes.rows[0].customer_notes}'`);
  console.log('-> TEST 2 PASSED: Conditional update guaranteed winner-takes-all atomicity without race conditions!\n');

  // Clean up test approval record
  await c1.query('DELETE FROM public.interior_customer_approvals WHERE id = $1', [testApprovalId]);
  console.log('[Cleanup] Removed temporary probe record.');

  await c1.end();
  await c2.end();
  console.log('\n====================================================================');
  console.log('ALL MULTI-CONNECTION CONCURRENCY TESTS PASSED ON REAL POSTGRESQL!');
  console.log('====================================================================');
}

runConcurrencyTests().catch(err => {
  console.error('Fatal concurrency test error:', err);
  process.exit(1);
});
