import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { roleForPermission } from '../bdgf/owner-authority.mjs';

const exec = promisify(execFile);
export const REPOSITORY = 'bellaspahcm/bella-ai-platform';

// GitHub authenticates the caller. No caller-supplied username or tenant role.
export async function authorizeRepository(repository, githubGet = githubApi) {
  if (repository !== REPOSITORY) throw new Error('TELEMETRY_SCOPE_DENIED');
  try {
    const user = await githubGet('user');
    if (!/^[A-Za-z0-9-]+$/.test(user?.login || '')) throw new Error();
    const grant = await githubGet(`repos/${repository}/collaborators/${encodeURIComponent(user.login)}/permission`);
    if (grant?.user?.login?.toLowerCase() !== user.login.toLowerCase()) throw new Error();
    roleForPermission(grant.permission, 'dev');
    return { repository, actor: user.login, permission: grant.permission, verifiedAt: new Date().toISOString() };
  } catch (error) {
    // Preserve only the known provider code; never forward its raw diagnostics.
    if (error?.message === 'GITHUB_AUTHORITY_UNAVAILABLE') throw new Error('GITHUB_AUTHORITY_UNAVAILABLE');
    throw new Error('TELEMETRY_ACCESS_DENIED');
  }
}

async function githubApi(endpoint) {
  try {
    const { stdout } = await exec('gh', ['api', endpoint], {
      windowsHide: true, timeout: 15000, maxBuffer: 256 * 1024,
    });
    return JSON.parse(stdout);
  } catch {
    // Never propagate gh stderr (which can include request/auth diagnostics).
    throw new Error('GITHUB_AUTHORITY_UNAVAILABLE');
  }
}
