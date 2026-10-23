import { readFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { hash } from './contract.mjs';

// One separately owner-approved pilot. This is not general Product admission.
export const pilotId = '4997ea7e-7f1f-4d9a-828d-94f4c4c0e444';
export const pilotBase = 'cde2d9133c650e2d1abef5315b4255e583e02b2e';
export const pilotGoal = 'BELLA MVP UI-TO-DATABASE COMPLETION: AutoMove customer preferences';
export const pilotFiles = ['src/app/dashboard/bella-auto/customers/page.tsx', 'src/app/dashboard/bella-auto/customers/__tests__/page.test.tsx'];
export const pilotTest = 'e2e/tests/47-automove-customer-preferences-pilot.spec.ts';
export const rulePath = 'docs/governance/BELLA_AI_CODING_CONSTITUTION.md';
export const ruleCommand = 'node scripts/agent-flow/mvp-pilot.mjs rules';
export const pilotCommand = 'node scripts/agent-flow/mvp-pilot-runner.mjs';
export const preparedFiles = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', rulePath,
  'scripts/agent-flow/mvp-pilot.mjs', 'scripts/agent-flow/mvp-pilot.test.mjs',
  'scripts/agent-flow/mvp-pilot-runner.mjs', 'scripts/agent-flow/mvp-pilot-runner.test.mjs',
  'scripts/agent-flow/role-pipeline.mjs', 'scripts/agent-flow/role-native.mjs',
  'scripts/agent-flow/role-validation.mjs', 'scripts/agent-flow/factory-publication.mjs',
  'scripts/agent-flow/authority.mjs', 'scripts/agent-flow/agent-flow.test.mjs',
  'scripts/agent-flow/probe.mjs', pilotTest, 'playwright.automove-mvp-pilot.config.ts'];
const fail = message => { throw Error(message); };
const require=createRequire(import.meta.url);
const sourceRead=path=>`Get-Content -LiteralPath '${path}'`;
export function pilotReads(role, verificationPath) {
  if(role==='REVIEWER') return pilotReviewReads({ownedFiles:pilotFiles},verificationPath);
  if(role==='VERIFY') return [pilotCommand];
  return [ruleCommand,...pilotFiles.map(sourceRead),sourceRead(pilotTest),
    ...(role==='LEAD' ? [sourceRead('src/modules/bella-auto/services/AutoMoveManagementHttp.ts'),sourceRead('src/modules/bella-auto/services/AutoCustomerProvider.ts')] : [])];
}

export function nonProductionDomains(values) {
  const project='bmnbqbcdbuklhopfbopv';
  try {
    if(new URL(values.NEXT_PUBLIC_SUPABASE_URL||'').href!==`https://${project}.supabase.co/`) fail('MVP_NETWORK_TARGET_REJECTED');
    const urls=['DB_URL','SUPABASE_DB_URL','DATABASE_URL','AUTOMOVE_DATABASE_URL'].map(k=>values[k]).filter(Boolean);
    if(!urls.length) fail('MVP_NETWORK_TARGET_REJECTED');
    const domains={'localhost':'allow','127.0.0.1':'allow',[`${project}.supabase.co`]:'allow','fonts.googleapis.com':'allow','fonts.gstatic.com':'allow'};
    for(const text of urls) {
      const url=new URL(text);
      if(!['postgres:','postgresql:'].includes(url.protocol) || !(url.hostname===`db.${project}.supabase.co` ||
        /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)&&decodeURIComponent(url.username).endsWith('.'+project))) fail('MVP_NETWORK_TARGET_REJECTED');
      domains[url.hostname]='allow';
    }
    return domains;
  } catch { fail('MVP_NETWORK_TARGET_REJECTED'); }
}

export function isMvpPilot(task) {
  return task?.taskId === pilotId && task.sourceRevision === pilotBase && task.goal === pilotGoal &&
    task.testFile === pilotTest && JSON.stringify(task.ownedFiles) === JSON.stringify(pilotFiles);
}

export function assertPreparedPilot(task, before, changedPaths) {
  if (!isMvpPilot(task) || before.head !== pilotBase ||
      changedPaths.some(p => !preparedFiles.includes(p)) ||
      hash(JSON.stringify({ head: before.head, files: before.files })) !== before.fingerprint) fail('MVP_PREPARED_SOURCE_REJECTED');
  return true;
}

export function readPilotRule(workspace) {
  const bytes = readFileSync(resolve(workspace, rulePath));
  const text = bytes.toString('utf8');
  const match = /^### MVP UI-to-Database Completion\r?\n[\s\S]*?(?=^### Missing Capability Process)/m.exec(text);
  if (!match || !text.includes('BELLA MVP UI-TO-DATABASE COMPLETION')) fail('MVP_WORKFLOW_RULE_MISSING');
  return { path: rulePath, baseRevision: pilotBase, sourceKind: 'uncommitted_worktree_bytes', sha256: hash(bytes), text: match[0].trim() };
}

export function observedRuleLoad(items, rule, exact) {
  const reads = items.filter(i => i.type === 'commandExecution' && exact(i.command, ruleCommand));
  if (reads.length !== 1 || reads[0].exitCode !== 0 || reads[0].status !== 'completed') fail('MVP_NATIVE_RULE_READ_REQUIRED');
  let result;
  try { result = JSON.parse(reads[0].aggregatedOutput.trim()); } catch { fail('MVP_RULE_READ_OUTPUT_INVALID'); }
  if (JSON.stringify(result) !== JSON.stringify(rule)) fail('MVP_RULE_SOURCE_MISMATCH');
  return { path: rule.path, sha256: rule.sha256, itemId: reads[0].id, outputHash: hash(reads[0].aggregatedOutput) };
}

export function pilotReviewReads(task, verificationPath) {
  return [ruleCommand, ...task.ownedFiles.map(p => `Get-Content -LiteralPath '${p}'`),
    sourceRead('scripts/agent-flow/mvp-pilot.mjs'), sourceRead('scripts/agent-flow/mvp-pilot-runner.mjs'),
    `Get-Content -LiteralPath '${pilotTest}'`,
    `Get-Content -LiteralPath '${verificationPath.replaceAll('\\', '/').replaceAll("'", "''")}'`];
}

export function pilotSupervisorContext(name, input, rule, permission, binding, networkControl) {
  const verify=name==='VERIFY';
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
  if(!['LEAD','BUILDER','VERIFY','REVIEWER'].includes(name)||!isMvpPilot(input.task)||input.before.head!==pilotBase||
      !/^[a-f0-9]{64}$/.test(input.before.fingerprint)||!/^[a-f0-9]{64}$/.test(rule.sha256)||
      permission?.profileId!==`bella_mvp_${name.toLowerCase()}`||permission.networkEnabled!==verify||permission.networkProxyEnabled!==verify||
      permission.powershellTelemetryOptout!=='1'||permission.sourceCandidate!==input.before.fingerprint||
      binding?.repository!=='bellaspahcm/bella-ai-platform'||binding.taskId!==input.task.taskId||binding.turnId!==null||
      ![binding.runId,binding.producerInstanceId,binding.threadId].every(id)||binding.runId===binding.taskId||
      (binding.sessionId!==null&&!id(binding.sessionId))||!Number.isSafeInteger(binding.attempt)||binding.attempt<1) fail('MVP_SUPERVISOR_CONTEXT_INVALID');
  if(verify) assertNetworkDenial(networkControl);
  return {schemaVersion:1,source:'SUPERVISOR_PRE_DISPATCH_OBSERVATION',role:name,taskId:input.task.taskId,
    candidate:input.before.fingerprint,sourceRevision:input.before.head,workflowSha256:rule.sha256,
    binding:{repository:binding.repository,runId:binding.runId,attempt:binding.attempt,producerInstanceId:binding.producerInstanceId,threadId:binding.threadId,sessionId:binding.sessionId},
    policy:{profileId:permission.profileId,networkEnabled:permission.networkEnabled,networkProxyEnabled:permission.networkProxyEnabled,
      powershellTelemetryOptout:permission.powershellTelemetryOptout,sourceCandidate:permission.sourceCandidate},
    networkDenial:verify?'VALIDATED_BEFORE_VERIFY_DISPATCH':'REQUIRED_BEFORE_VERIFY_ONLY',
    nativeLifecycle:'COLLECTOR_MUST_VALIDATE_AFTER_TURN',productE2E:'NOT_PROVEN',productGoLive:'NOT_PROVEN'};
}

export function pilotPrompt(name, input, rule, reads) {
  const supervisor=input.supervisor;
  if(supervisor?.source!=='SUPERVISOR_PRE_DISPATCH_OBSERVATION'||supervisor.role!==name||supervisor.taskId!==input.task.taskId||
      supervisor.candidate!==input.before.fingerprint||supervisor.workflowSha256!==rule.sha256) fail('MVP_SUPERVISOR_CONTEXT_REQUIRED');
  const head = `Owner-approved one-task AutoMove pilot. Role=${name}; candidate=${input.before.fingerprint}.\n` +
    `GOAL: ${input.task.goal}\nACCEPTANCE: ${JSON.stringify(input.task.acceptance)}\n` +
    `SUPERVISOR OBSERVATION (configuration and pre-turn identity only, not completed lifecycle or Product proof): ${JSON.stringify(supervisor)}\n` +
    'Stage responsibilities: the supervisor checks effective shell policy and native thread binding before dispatch. The collector must validate actual lifecycle, rule reads, source stability and independent history after this turn; failure still holds the pipeline. LEAD assesses only the observed inventory and safe plan. BUILDER assesses whether a Product edit is evidenced. Neither planning role must reproduce supervisor checks, inspect inaccessible receipts, or require later VERIFY/REVIEWER proof before handing off. Keep later gates NOT_PROVEN, never claim them passed. VERIFY must satisfy its current-candidate network gate and real Product checks; REVIEWER independently evaluates retained evidence.\n' +
    `Actual rule bytes (${rule.path}, SHA256 ${rule.sha256}, uncommitted on ${pilotBase}):\n${rule.text}\n\n` +
    'Never touch Preschool, other workstreams, schema/migrations, ACL/grants, public contracts, Kernel, Production, secrets, or commit/push/merge/deploy. No extra agents, MCP, browser tools or installation. Do not dispatch another Factory. No invented defect or mock/fixture-only PASS.\n' +
    `Return exactly one final line BELLA_ROLE_RESULT=<JSON> with role:${JSON.stringify(name)}, candidate:${JSON.stringify(input.before.fingerprint)}, decision, findings:[], workflowSha256:${JSON.stringify(rule.sha256)}.\n`;
  const exactReads=['LEAD','BUILDER'].includes(name) ? `Execute each of these exact commands separately, once, and no others (no wrapper, appended commands or extra policy reads):\n${pilotReads(name).join('\n')}\n` : '';
  if (name === 'LEAD') return head + exactReads + 'Read-only: observe actual workflow loading, inspect the customer page and canonical preference contract, and state a short inventory/plan. No tests or writes. ACCEPT means only that this plan is safe, in scope, and ready for Builder to assess/execute within the approved boundaries; it does not mean the Product flow passed, the pilot is complete, or the Product is Go-Live ready. Return HELD if the plan is unsafe, out of scope, or a material business prerequisite is unclear. Native receipts generated after your turn and later runtime checks are collector/VERIFY responsibilities, not preconditions for your plan. Return ACCEPT or HELD, plan:string.\n';
  if (name === 'BUILDER') return head + exactReads + `Read-only assessment for this initial proof. No reproduced Product defect has been established. Do not invent one or make token edits. The final BELLA_ROLE_RESULT JSON must include both changed and noChange; do not put either field outside the JSON or omit them. If the authorized source reads establish no Product defect requiring a code change, return exactly this shape with the current candidate and workflow SHA substituted: {"role":"BUILDER","candidate":"<candidate>","decision":"DONE","findings":[],"changed":[],"noChange":true,"workflowSha256":"<workflowSha256>"}. This is a valid handoff to Verify even if runtime, persistence, tenant-denial, invalid-input, telemetry, proxy or Browser/DB gates remain NOT_PROVEN; those are Verify acceptance checks. If an in-scope Product defect is evidenced and fixed, set changed to the exact owned file paths and noChange:false. Return HELD only for an evidenced Product defect requiring an out-of-scope change or an unresolved material business decision; use changed:[] and noChange:false. No tests, DB or writes. PLAN:${input.plan}\n`;
  if (name === 'VERIFY') return head + `Execute exactly once, with no other command, wrapper, inspection, setup or retry: ${pilotCommand}\nThis supervised runner owns a fresh localhost runtime and real canonical Non-Production Browser/DB proof. It validates target environment before network/writes, isolates fixtures, redacts output, and retains evidence outside the source. Do not inspect env files. PASS only for 1 test passed, zero fail/skip/cancel/todo and actual real read-back; otherwise FAIL. No code or repair.\n`;
  return head + `Independent read-only Reviewer. Execute each exact read command separately, once, without wrappers or appended commands:\n${reads.join('\n')}\nReview inventory, the actual rule, existing UI behavior, Browser/DB proof and acceptance. Review the full-mode exact-domain profile, DB policy tunnel, vendor TLS validation, fresh read-back and cleanup; no direct egress or certificate exception is permitted. No tests or writes. Return PASS only if the one flow is proven; otherwise HELD. No Product-code change or broader readiness/Go-Live is claimed.\n`;
}

// Per-role execution, never inherited ambient secrets or a global permission change.
export function pilotExecution(workspace, { task, role, candidate, output, envFile }) {
  if (!isMvpPilot(task) || !['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER'].includes(role) ||
      resolve(workspace) !== resolve(dirname(fileURLToPath(import.meta.url)), '../..') || !/^[a-f0-9]{64}$/.test(candidate || '')) fail('MVP_PERMISSION_SCOPE_REJECTED');
  const verify = role === 'VERIFY';
  const outside = value => { const child=relative(resolve(workspace),resolve(value)); return child==='..' || child.startsWith('..'+sep) || isAbsolute(child); };
  if(!output||!isAbsolute(output)||!outside(output)) fail('MVP_EXTERNAL_ENV_OUTPUT_REQUIRED');
  const filesystem = {};
  if (verify) for (const p of [resolve(workspace, '.next'), resolve(workspace, 'next-env.d.ts'), output]) {
    if (!p) fail('MVP_OUTPUT_REQUIRED');
    filesystem[p.replaceAll('\\', '/')] = 'write';
  }
  const scratch = resolve(output, '..', 'scratch', pilotId);
  filesystem[scratch.replaceAll('\\', '/')] = 'write';
  const environment = Object.fromEntries(['SystemDrive', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles', 'HOMEDRIVE', 'HOMEPATH'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  // Disable optional shell telemetry before native PowerShell starts. Its
  // Application Insights endpoint is intentionally outside this task's policy.
  Object.assign(environment, { TEMP: scratch, TMP: scratch, CI: '1', NEXT_TELEMETRY_DISABLED: '1', POWERSHELL_TELEMETRY_OPTOUT: '1', NODE_USE_ENV_PROXY:'1', NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S: '', FACTORY_MVP_CANDIDATE: candidate });
  if (verify) {
    if (!envFile || !output || !outside(output) || !outside(envFile)) fail('MVP_EXTERNAL_ENV_OUTPUT_REQUIRED');
    Object.assign(environment, { E2E_ENV_FILE: resolve(envFile), FACTORY_MVP_OUTPUT: resolve(output), FACTORY_MVP_NETWORK_MODE: 'full' });
    // Windows AppContainer virtualizes LOCALAPPDATA; bind the existing browser
    // cache before entering it rather than downloading a second installation.
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
      environment.PLAYWRIGHT_BROWSERS_PATH = resolve(process.env.LOCALAPPDATA, 'ms-playwright');
    }
  }
  const domains=verify ? nonProductionDomains(require('dotenv').parse(readFileSync(envFile))) : null;
  const profileId = 'bella_mvp_' + role.toLowerCase();
  const network=verify ? `enabled=true,mode="full",domains={${Object.entries(domains).map(([host,action])=>`${JSON.stringify(host)}=${JSON.stringify(action)}`).join(',')}},allow_local_binding=true` : 'enabled=false';
  const encoded = `{extends=":read-only",filesystem={${Object.entries(filesystem).map(([p,v]) => `${JSON.stringify(p)}=${JSON.stringify(v)}`).join(',')}},network={${network}}}`;
  const overrides = [`permissions.${profileId}=${encoded}`, 'approval_policy="never"', 'windows.sandbox="mxc"',
    ...(verify ? ['features.network_proxy=true'] : []),
    'analytics.enabled=false', 'shell_environment_policy.inherit="none"',
    `shell_environment_policy.set={${Object.entries(environment).map(([k,v]) => `${JSON.stringify(k)}=${JSON.stringify(v)}`).join(',')}}`];
  return { args: [...overrides.flatMap(v => ['-c',v]), 'app-server','--listen','stdio://'], experimentalApi: true,
    profileId, filesystem, networkEnabled: verify, domains, environment, scratch,
    thread: { permissions: profileId }, turn: { permissions: profileId } };
}

export async function checkPilotPermission(server, execution, cwd) {
  const { config } = await server.rpc('config/read', { cwd, includeLayers:false });
  const profiles = await server.rpc('permissionProfile/list', { cwd, limit:100 });
  const actual = config?.permissions?.[execution.profileId];
  const rules = Object.fromEntries(Object.entries(actual?.filesystem || {}).filter(([k,v]) => !(k === 'glob_scan_max_depth' && v === null)));
  const sameEntries=(a,b)=>Object.keys(a||{}).length===Object.keys(b||{}).length && Object.entries(a||{}).every(([k,v])=>b[k]===v);
  if (actual?.extends !== ':read-only' || actual?.network?.enabled !== execution.networkEnabled ||
      !sameEntries(rules,execution.filesystem) || config?.approval_policy !== 'never' || config?.windows?.sandbox !== 'mxc' ||
      config?.shell_environment_policy?.inherit !== 'none' || !sameEntries(config?.shell_environment_policy?.set,execution.environment) ||
      (execution.networkEnabled && (config?.features?.network_proxy!==true || !sameEntries(actual?.network?.domains,execution.domains) || actual?.network?.mode!=='full' || actual?.network?.allow_local_binding!==true)) ||
      !profiles.data?.some(p => p.id === execution.profileId && p.allowed)) fail('MVP_PERMISSION_POLICY_MISMATCH');
  return { profileId:execution.profileId, filesystem:rules, networkEnabled:execution.networkEnabled, networkProxyEnabled:execution.networkEnabled && config?.features?.network_proxy===true, domains:execution.domains, environmentKeys:Object.keys(execution.environment).sort(),
    powershellTelemetryOptout:execution.environment.POWERSHELL_TELEMETRY_OPTOUT||null,sourceCandidate:execution.environment.FACTORY_MVP_CANDIDATE||null };
}

export function pilotNativeTurnFailure(turn) {
  return turn?.status==='failed'&&(turn.error?.codexErrorInfo==='usageLimitExceeded'||turn.error?.codex_error_info==='usage_limit_exceeded')
    ? 'NATIVE_USAGE_LIMIT_EXCEEDED':'NATIVE_RUNTIME_UNCERTAIN';
}

export function assertNetworkDenial(result) {
  let outcome;
  try { outcome=JSON.parse(result.stdout.trim()); } catch { fail('MVP_NETWORK_ENFORCEMENT_NOT_PROVEN'); }
  const allowedStatus=outcome.allowed?.status;
  const proxyHost=outcome.proxy?.host;
  const blocked=outcome.prohibited;
  if(result.exitCode!==0 || !['127.0.0.1','localhost','[::1]'].includes(proxyHost) || outcome.proxy?.nodeUseEnvProxy!==true ||
      outcome.allowed?.destination!=='bmnbqbcdbuklhopfbopv.supabase.co:443' || outcome.allowed?.tunnelStatus!==200 || ![200,401].includes(allowedStatus) ||
      blocked?.destination!=='example.com:443' || blocked.status!==403 ||
      blocked.policyError!=='blocked-by-allowlist' || blocked.body!=='Domain not in allowlist.') fail('MVP_NETWORK_ENFORCEMENT_NOT_PROVEN');
}

export async function pilotNetworkProbe(server, execution, cwd) {
  // No credentials or business mutation: retain an allowed API response and
  // an explicit proxy policy denial before a role can invoke the Browser/DB runner.
  const apiHost=Object.keys(execution.domains).find(host=>host.endsWith('.supabase.co')&&!host.startsWith('db.'));
  if(!apiHost) fail('MVP_NETWORK_TARGET_REJECTED');
  const allowedUrl=JSON.stringify(`https://${apiHost}/auth/v1/health`);
  const allowedDestination=JSON.stringify(`${apiHost}:443`);
  const code=`import net from 'node:net';
const proxyText=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const proxy=new URL(proxyText||'');
if(!['127.0.0.1','localhost','[::1]'].includes(proxy.hostname)||proxy.username||proxy.password||process.env.NODE_USE_ENV_PROXY!=='1') throw Error('PROXY_ROUTE_NOT_ALLOWED');
async function connect(destination){return await new Promise(resolve=>{
 let raw='',settled=false; const socket=net.connect(Number(proxy.port),proxy.hostname);
 const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();resolve(value)};
 const timer=setTimeout(()=>finish({destination,error:'TIMEOUT'}),5000);
 socket.on('connect',()=>socket.write('CONNECT '+destination+' HTTP/1.1\\r\\nHost: '+destination+'\\r\\nConnection: close\\r\\n\\r\\n'));
 socket.on('data',chunk=>{raw+=chunk.toString();const split=raw.indexOf('\\r\\n\\r\\n');if(split<0)return;const head=raw.slice(0,split);const length=/content-length:\\s*(\\d+)/i.exec(head);if(!length||Buffer.byteLength(raw.slice(split+4))>=Number(length[1])){const body=raw.slice(split+4).trim();finish({destination,status:Number(/^HTTP\\/1\\.1\\s+(\\d+)/.exec(head)?.[1]||0),policyError:/^x-proxy-error:\\s*([^\\r\\n]+)/im.exec(head)?.[1]||null,body})}});
 socket.on('end',()=>finish({destination,error:'CONNECTION_ENDED'}));
 socket.on('error',e=>finish({destination,error:e.code||e.name}));
})}
const allowedTunnel=await connect(${allowedDestination});
const allowed=await fetch(${allowedUrl},{signal:AbortSignal.timeout(5000)});
const allowedStatus=allowed.status; await allowed.body?.cancel();
const destination='example.com:443';
const prohibited=await connect(destination);
console.log(JSON.stringify({proxy:{host:proxy.hostname,nodeUseEnvProxy:process.env.NODE_USE_ENV_PROXY==='1'},allowed:{destination:allowedTunnel.destination,tunnelStatus:allowedTunnel.status,status:allowedStatus},prohibited}));`;
  return server.rpc('command/exec',{command:[process.execPath,'--input-type=module','-e',code],cwd,
    permissionProfile:execution.profileId,timeoutMs:20000,outputBytesCap:2000});
}

export function validatePilotReceipt(result, items, rule, exact, verificationPath) {
  if (result.workflowSha256 !== rule.sha256) fail('MVP_RULE_RESULT_MISMATCH');
  if (items.some(i => i.type === 'fileChange')) fail('MVP_INITIAL_PROOF_READ_ONLY');
  const allowed=pilotReads(result.role,verificationPath);
  const commands=items.filter(i=>i.type==='commandExecution');
  if(commands.length!==allowed.length || allowed.some(command=>commands.filter(i=>exact(i.command,command)).length!==1)) fail('MVP_EXACT_COMMANDS_REQUIRED');
  return result.role === 'VERIFY' ? null : observedRuleLoad(items, rule, exact);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join() !== 'rules') throw Error('INVALID_MVP_OPERATION');
  console.log(JSON.stringify(readPilotRule(process.cwd())));
}
