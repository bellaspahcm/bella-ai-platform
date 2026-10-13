#!/usr/bin/env node
/**
 * BDGF owner-operated authority resolver.
 *
 * This module verifies the operator from GitHub Actions metadata and GitHub's
 * API. It deliberately does not trust CLI-supplied approver roles.
 */

const REQUIRED_GITHUB_PERMISSION_BY_ENVIRONMENT = {
  production: 'admin',
  staging: 'admin',
  dev: 'admin'
};

const BDGF_ROLE_BY_GITHUB_PERMISSION = {
  admin: 'admin'
};

function requireEnv(env, key) {
  const value = env[key];
  if (!value || String(value).trim() === '') {
    throw new Error(`${key} is required for GitHub Actions owner authority`);
  }
  return String(value).trim();
}

function buildGitHubApiUrl(apiUrl, path) {
  return `${apiUrl.replace(/\/$/, '')}${path}`;
}

async function githubGet(path, token, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is required to verify GitHub owner authority');
  }

  const apiUrl = options.apiUrl || 'https://api.github.com';
  const response = await fetchImpl(buildGitHubApiUrl(apiUrl, path), {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bella-bdgf-owner-authority'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub authority check failed for ${path}: HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeGitHubLogin(value) {
  const login = String(value || '').trim();
  if (!/^[A-Za-z0-9-]+$/.test(login)) {
    throw new Error('GitHub authority response did not include a valid actor login');
  }
  return login;
}

function resolveOperatorLogin(run) {
  return normalizeGitHubLogin(run?.triggering_actor?.login || run?.actor?.login);
}

function normalizePermission(value) {
  return String(value || '').trim().toLowerCase();
}

function roleForPermission(permission, targetEnvironment) {
  const requiredPermission = REQUIRED_GITHUB_PERMISSION_BY_ENVIRONMENT[targetEnvironment];
  if (!requiredPermission) {
    throw new Error(`Unsupported target environment for owner authority: ${targetEnvironment}`);
  }

  const normalizedPermission = normalizePermission(permission);
  if (normalizedPermission !== requiredPermission) {
    throw new Error(
      `GitHub actor permission ${normalizedPermission || 'none'} is not authorized for ${targetEnvironment}; ` +
      `${requiredPermission} is required`
    );
  }

  const role = BDGF_ROLE_BY_GITHUB_PERMISSION[normalizedPermission];
  if (!role) {
    throw new Error(`No BDGF role mapping exists for GitHub permission ${normalizedPermission}`);
  }

  return role;
}

async function resolveGitHubActionsOwnerAuthority(params = {}, options = {}) {
  const env = options.env || process.env;
  const targetEnvironment = params.targetEnvironment || 'production';

  if (env.GITHUB_ACTIONS !== 'true') {
    throw new Error('owner_operated approval requires GitHub Actions trusted runtime');
  }

  const token = requireEnv(env, 'GITHUB_TOKEN');
  const repository = requireEnv(env, 'GITHUB_REPOSITORY');
  const runId = requireEnv(env, 'GITHUB_RUN_ID');
  const expectedSha = env.GITHUB_SHA ? String(env.GITHUB_SHA).trim() : null;
  const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com';

  const apiOptions = {
    fetchImpl: options.fetchImpl,
    apiUrl: env.GITHUB_API_URL || options.apiUrl || 'https://api.github.com'
  };

  const run = await githubGet(`/repos/${repository}/actions/runs/${runId}`, token, apiOptions);
  const runRepository = run?.repository?.full_name;
  if (runRepository && runRepository !== repository) {
    throw new Error(`GitHub run repository mismatch: expected ${repository}, got ${runRepository}`);
  }

  if (expectedSha && run?.head_sha && run.head_sha !== expectedSha) {
    throw new Error(`GitHub run SHA mismatch: expected ${expectedSha}, got ${run.head_sha}`);
  }

  const operatorLogin = resolveOperatorLogin(run);
  const permission = await githubGet(
    `/repos/${repository}/collaborators/${encodeURIComponent(operatorLogin)}/permission`,
    token,
    apiOptions
  );

  const approverRole = roleForPermission(permission?.permission, targetEnvironment);
  const ownerIdentity = `github:${repository}:${operatorLogin}`;
  const runUrl = `${serverUrl.replace(/\/$/, '')}/${repository}/actions/runs/${runId}`;

  return {
    requesterId: ownerIdentity,
    approverId: ownerIdentity,
    approverRole,
    authoritySource: 'github_actions',
    evidence: {
      provider: 'github_actions',
      repository,
      run_id: runId,
      run_attempt: env.GITHUB_RUN_ATTEMPT || null,
      workflow: env.GITHUB_WORKFLOW || null,
      job: env.GITHUB_JOB || null,
      ref: env.GITHUB_REF || null,
      sha: run?.head_sha || expectedSha || null,
      operator: operatorLogin,
      github_permission: normalizePermission(permission?.permission),
      target_environment: targetEnvironment,
      run_url: runUrl,
      verified_at: new Date().toISOString()
    }
  };
}

function buildOwnerAuthorityNotes(notes, authorityEvidence) {
  return JSON.stringify({
    human_notes: notes || null,
    owner_authority: authorityEvidence
  });
}

export {
  REQUIRED_GITHUB_PERMISSION_BY_ENVIRONMENT,
  buildOwnerAuthorityNotes,
  resolveGitHubActionsOwnerAuthority,
  roleForPermission
};
