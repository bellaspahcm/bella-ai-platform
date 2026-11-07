import { createHash, randomUUID } from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a value is a valid PostgreSQL UUID string.
 */
export function isUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Ensures a value is a valid UUID for PostgreSQL.
 * If the value is already a UUID, returns it as-is.
 * If it is null/undefined/empty, generates a fresh random UUIDv4.
 * If it is a string like 'proj-001' or 'sde-01', deterministically hashes it
 * to a valid UUID format so the same entity code consistently maps to the same UUID.
 */
export function ensureUuid(val: string | null | undefined): string {
  if (!val || typeof val !== 'string' || val.trim().length === 0) {
    return randomUUID();
  }
  const trimmed = val.trim();
  if (isUuid(trimmed)) {
    return trimmed;
  }
  const hash = createHash('sha256').update(trimmed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
