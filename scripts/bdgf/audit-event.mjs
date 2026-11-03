const AUDIT_EVENTS = new Set([
  'APPROVAL_VERIFIED',
  'GATE_TOKEN_ISSUED',
  'EXECUTION_BLOCKED',
  'EXECUTION_STARTED',
  'EXECUTION_SUCCEEDED',
  'EXECUTION_FAILED'
]);

const SAFE_METADATA_KEYS = new Set([
  'event',
  'rows_affected',
  'failure_code',
  'block_reason',
  'token_validation_reason',
  'approval_validation_reason',
  'rollback_attempted',
  'rollback_succeeded'
]);

function safeMetadata(event, metadata = {}) {
  const safe = { event };
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || key === 'event') continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      safe[key] = value;
    } else if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value)) {
      safe[key] = value;
    }
  }
  return safe;
}

export async function auditMigrationEvent(db, record) {
  if (!db || !AUDIT_EVENTS.has(record?.event)) {
    throw new Error('Migration audit context is incomplete.');
  }

  const required = [record.migration_id, record.migration_hash, record.target_environment,
    record.executor_identity, record.created_by];
  if (required.some(value => typeof value !== 'string' || value.length === 0)) {
    throw new Error('Migration audit context is incomplete.');
  }

  const failureCode = typeof record.metadata?.failure_code === 'string'
    && /^[A-Za-z0-9_]{1,32}$/.test(record.metadata.failure_code)
    ? record.metadata.failure_code
    : 'UNKNOWN';
  const executionError = record.event === 'EXECUTION_FAILED'
    ? `Migration execution failed (${failureCode}).`
    : null;

  const result = await db.query(`
    INSERT INTO public.bella_execution_audit (
      token_id, approval_id, migration_id, migration_hash,
      target_environment, target_schema, gate_decision, block_reason,
      execution_result, execution_error, execution_duration_ms,
      transaction_committed, executor_identity, executor_role, created_by, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb
    ) RETURNING audit_id
  `, [
    record.token_id || null,
    record.approval_id || null,
    record.migration_id,
    record.migration_hash,
    record.target_environment,
    record.target_schema || null,
    record.gate_decision,
    record.block_reason || null,
    record.execution_result || null,
    executionError,
    Number.isInteger(record.execution_duration_ms) ? record.execution_duration_ms : null,
    typeof record.transaction_committed === 'boolean' ? record.transaction_committed : null,
    record.executor_identity,
    record.executor_role || record.executor_identity,
    record.created_by,
    JSON.stringify(safeMetadata(record.event, record.metadata))
  ]);

  if (result.rowCount !== 1 || !result.rows?.[0]?.audit_id) {
    throw new Error('Migration audit insert did not return one record.');
  }
  return result.rows[0].audit_id;
}
