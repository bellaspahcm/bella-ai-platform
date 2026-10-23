import { validateBinding } from './contract.mjs';
import { safeAuthorityFailure } from './authority.mjs';

// A collector observation of an actual failed call; never a native event.
const systemCodes = new Set(['EACCES', 'EPERM', 'EIO', 'ENOSPC', 'EDQUOT', 'ENOENT', 'EEXIST', 'EMFILE', 'ENFILE', 'EBUSY', 'EROFS', 'EINVAL', 'ENOTDIR', 'EISDIR']);
const domainCodes = new Set(['TELEMETRY_ACCESS_DENIED', 'GITHUB_AUTHORITY_UNAVAILABLE', 'EXTERNAL_PRIVATE_STORE_REQUIRED', 'UNSAFE_STORE_DIRECTORY', 'UNSAFE_EVIDENCE_CONTEXT', 'INVALID_REVIEW_RETENTION', 'REVIEW_WINDOW_EXPIRED', 'STORE_LOCK_OWNER_UNKNOWN', 'STORE_BUSY', 'STORE_READ_FAILED', 'STORE_SCOPE_MISMATCH', 'INVALID_LIFECYCLE_BINDING', 'INVALID_STORED_FACT', 'INVALID_STORE_RECORD', 'INVALID_STORE_CLOCK', 'PROOF_STORE_LIMIT', 'UNSAFE_OUTPUT']);
const methods = new Set(['turn/started', 'turn/completed', 'item/started', 'item/completed', 'thread/status/changed', 'history.item', 'history.turn']);

export function persistenceDiagnostic(error, { operation, role, binding, method = null, itemId = null, observedAt = new Date().toISOString() }) {
  validateBinding(binding);
  if (!['context.write', 'facts.ingest', 'queued.write'].includes(operation) || !['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER'].includes(role) ||
      (method !== null && !methods.has(method)) || (itemId !== null && !/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) || !Number.isFinite(Date.parse(observedAt))) throw new Error('INVALID_PERSISTENCE_DIAGNOSTIC_CONTEXT');
  const system = systemCodes.has(error?.code) ? error.code : null;
  const domain = domainCodes.has(error?.message) ? error.message : null;
  const authorityFailure = !system && domain === 'TELEMETRY_ACCESS_DENIED' ? safeAuthorityFailure(error) : null;
  return { schemaVersion: 1, source: 'COLLECTOR_FAILURE_OBSERVATION', operation, role, binding: { ...binding }, method, itemId,
    observedAt, causeCode: system || domain || 'UNKNOWN_CAUSE', causeClass: system ? 'SYSTEM_ERROR' : domain ? 'STORE_GUARD_OR_AUTHORITY' : 'UNKNOWN',
    ...(authorityFailure ? { authorityFailure } : {}), rawDiagnosticsRetained: false };
}
