import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { roleForPermission } from '../bdgf/owner-authority.mjs';

const exec = promisify(execFile);
export const REPOSITORY = 'bellaspahcm/bella-ai-platform';

const providerCauses = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_COMMAND_FAILED', 'PROVIDER_INVALID_JSON', 'PROVIDER_UNAVAILABLE']);
const failureCauses = {
  ACTOR_LOOKUP: providerCauses,
  GRANT_LOOKUP: providerCauses,
  ACTOR_VALIDATION: new Set(['ACTOR_INVALID']),
  GRANT_VALIDATION: new Set(['GRANT_IDENTITY_MISMATCH']),
  PERMISSION_CHECK: new Set(['PERMISSION_REJECTED']),
};

function providerCause(error) {
  if (providerCauses.has(error?.providerFailure)) return error.providerFailure;
  if (error?.code === 'ETIMEDOUT' || (error?.killed === true && ['SIGTERM', 'SIGKILL'].includes(error?.signal))) return 'PROVIDER_TIMEOUT';
  if (Number.isInteger(error?.code) || ['ENOENT', 'EACCES', 'EPERM', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(error?.code)) return 'PROVIDER_COMMAND_FAILED';
  if (error instanceof SyntaxError) return 'PROVIDER_INVALID_JSON';
  return 'PROVIDER_UNAVAILABLE';
}

// Companion diagnostics only: no provider payload, identity, message or stack.
// This projection neither authorizes callers nor authenticates an observation.
export function safeAuthorityFailure(error) {
  const value = error?.authorityFailure;
  if (error?.message !== 'TELEMETRY_ACCESS_DENIED' || !value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'cause,stage'
    || typeof value.stage !== 'string' || typeof value.cause !== 'string'
    || !Object.hasOwn(failureCauses, value.stage) || !failureCauses[value.stage].has(value.cause)) return null;
  return { stage: value.stage, cause: value.cause };
}

// GitHub authenticates the caller. No caller-supplied username or tenant role.
export async function authorizeRepository(repository, githubGet = githubApi) {
  if (repository !== REPOSITORY) throw new Error('TELEMETRY_SCOPE_DENIED');
  let stage = 'ACTOR_LOOKUP';
  try {
    const user = await githubGet('user');
    stage = 'ACTOR_VALIDATION';
    if (typeof user?.login !== 'string' || !/^[A-Za-z0-9-]+$/.test(user.login)) throw new Error();
    stage = 'GRANT_LOOKUP';
    const grant = await githubGet(`repos/${repository}/collaborators/${encodeURIComponent(user.login)}/permission`);
    stage = 'GRANT_VALIDATION';
    if (typeof grant?.user?.login !== 'string' || grant.user.login.toLowerCase() !== user.login.toLowerCase()) throw new Error();
    stage = 'PERMISSION_CHECK';
    roleForPermission(grant.permission, 'dev');
    return { repository, actor: user.login, permission: grant.permission, verifiedAt: new Date().toISOString() };
  } catch (error) {
    const cause = stage === 'ACTOR_VALIDATION' ? 'ACTOR_INVALID'
      : stage === 'GRANT_VALIDATION' ? 'GRANT_IDENTITY_MISMATCH'
        : stage === 'PERMISSION_CHECK' ? 'PERMISSION_REJECTED' : providerCause(error);
    const denied = new Error('TELEMETRY_ACCESS_DENIED');
    denied.authorityFailure = { stage, cause };
    throw denied;
  }
}

async function githubApi(endpoint) {
  try {
    const { stdout } = await exec('gh', ['api', endpoint], {
      windowsHide: true, timeout: 15000, maxBuffer: 256 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    // Never propagate gh stderr (which can include request/auth diagnostics).
    const unavailable = new Error('GITHUB_AUTHORITY_UNAVAILABLE');
    unavailable.providerFailure = providerCause(error);
    throw unavailable;
  }
}
