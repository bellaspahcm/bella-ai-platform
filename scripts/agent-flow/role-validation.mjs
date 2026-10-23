import { resolve } from 'node:path';
import { hash } from './contract.mjs';
import { isMvpPilot, pilotId, pilotCommand, pilotReviewReads } from './mvp-pilot.mjs';
const fail = code => { throw new Error(code); };

const protectedNames = new Set(['authority.mjs', 'contract.mjs', 'store.mjs', 'probe.mjs', 'role-pipeline.mjs', 'role-native.mjs', 'role-pipeline.test.mjs', 'run-evidence.mjs', 'persistence-diagnostic.mjs', 'factory-publication.mjs', 'role-validation.mjs', 'mvp-pilot.mjs', 'mvp-pilot.test.mjs', 'mvp-pilot-runner.mjs', 'mvp-pilot-runner.test.mjs']);
export function admitTask(task) {
  const keys = ['taskId', 'sourceRevision', 'goal', 'ownedFiles', 'testFile', 'acceptance', 'maxSeconds'];
  if (!task || Object.keys(task).sort().join() !== keys.sort().join() ||
      !/^[a-f0-9-]{36}$/.test(task.taskId) || !/^[a-f0-9]{40}$/.test(task.sourceRevision) ||
      typeof task.goal !== 'string' || task.goal.length < 20 || task.goal.length > 4000 ||
      !Array.isArray(task.acceptance) || !task.acceptance.length || task.acceptance.length > 12 || task.acceptance.some(v => typeof v !== 'string' || !v.length || v.length > 1000) ||
      !Number.isSafeInteger(task.maxSeconds) || task.maxSeconds < 60 || task.maxSeconds > 1800 ||
      !Array.isArray(task.ownedFiles) || !task.ownedFiles.length || task.ownedFiles.length > 4 || new Set(task.ownedFiles).size !== task.ownedFiles.length ||
      (task.taskId === pilotId && !isMvpPilot(task)) ||
      (!isMvpPilot(task) && (task.ownedFiles.some(p => typeof p !== 'string' || !/^scripts\/agent-flow\/[a-z][a-z0-9.-]*\.mjs$/.test(p) || protectedNames.has(p.split('/').at(-1))) ||
      !/^scripts\/agent-flow\/[a-z][a-z0-9.-]*\.test\.mjs$/.test(task.testFile) || !task.ownedFiles.includes(task.testFile)))) fail('INVALID_TASK_SCOPE');
  return structuredClone(task);
}

export function nativeMode(options = []) {
  if (!Array.isArray(options) || (options.length && (options.length !== 1 || options[0] !== '--bounded-native'))) fail('INVALID_NATIVE_MODE');
  return options.length ? 'bounded-native' : 'legacy';
}

export function validateRoleResult(result, role, candidate) {
  if (!result || Object.hasOwn(result, 'reviewMethod') || result.role !== role || result.candidate !== candidate || !Array.isArray(result.findings) ||
      result.findings.some(f => typeof f !== 'string' || !f.trim() || f.length > 2000)) fail('INVALID_ROLE_RESULT');
  return result;
}

export function exactTest(command, cwd, expected, workspace) {
  if (typeof command !== 'string' || typeof cwd !== 'string' || resolve(cwd) !== workspace) return false;
  if (command.trim() === expected) return true;
  const wrapped = command.match(/^(?:"[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]*[\\/](?:powershell|pwsh)\.exe"|(?:powershell|pwsh)(?:\.exe)?)\s+(?:-(?:NoProfile|NoLogo|NonInteractive)\s+)*-Command\s+(["'])(.*)\1$/i);
  return wrapped?.[2] === expected;
}

export function reviewReads(task, verificationPath, method) {
  if (isMvpPilot(task)) {
    if (method !== undefined) fail('INVALID_REVIEW_METHOD');
    return pilotReviewReads(task, verificationPath);
  }
  // Forward slashes avoid native Windows shell-display backslash escaping.
  const portablePath = verificationPath.replaceAll('\\', '/');
  if (method !== undefined && method !== 'PINNED_BASELINE_AND_CURRENT') fail('INVALID_REVIEW_METHOD');
  const reads = method === 'PINNED_BASELINE_AND_CURRENT'
    ? task.ownedFiles.flatMap(p => [`git show "${task.sourceRevision}:${p}"`, `Get-Content -LiteralPath '${p}'`])
    : [`git diff -- ${task.ownedFiles.join(' ')}`, ...task.ownedFiles.map(p => `Get-Content -LiteralPath '${p}'`)];
  return [...reads, `Get-Content -LiteralPath '${portablePath.replaceAll("'", "''")}'`];
}

export function validateReviewCommands(commands, task, workspace, verificationPath, method) {
  if (!verificationPath || !Array.isArray(commands)) fail('ACTUAL_REVIEW_READ_REQUIRED');
  const expected = reviewReads(task, verificationPath, method);
  if (commands.some(c => c.exitCode !== 0 || c.status !== 'completed') ||
      expected.some(read => {
        const count = commands.filter(c => exactTest(c.command, c.cwd, read, workspace)).length;
        return method === undefined ? count === 0 : count !== 1;
      }) ||
      (method !== undefined && commands.length !== expected.length)) fail('ACTUAL_REVIEW_READ_REQUIRED');
  return true;
}

export function counters(output) {
  const values = {};
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$/);
    if (match) {
      if (Object.hasOwn(values, match[1]) || !Number.isSafeInteger(Number(match[2]))) return null;
      values[match[1]] = Number(match[2]);
    }
  }
  const names = ['pass', 'fail', 'cancelled', 'skipped', 'todo'];
  if (!Number.isSafeInteger(values.tests) || values.tests < 1 || names.some(n => !Number.isSafeInteger(values[n])) || names.reduce((n, k) => n + values[k], 0) !== values.tests) return null;
  return values;
}

export function canonicalVerifyDecision(result, test) {
  const c = test?.counters;
  if (!result || typeof result.decision !== 'string' || !c || !Number.isSafeInteger(test.exitCode) ||
      !Number.isSafeInteger(c.tests) || !Number.isSafeInteger(c.pass) || !Number.isSafeInteger(c.fail) ||
      !Number.isSafeInteger(c.cancelled) || !Number.isSafeInteger(c.skipped) || !Number.isSafeInteger(c.todo)) fail('INVALID_VERIFY_DECISION');
  const expected = test.exitCode === 0 && c.tests > 0 && c.pass === c.tests &&
    c.fail === 0 && c.cancelled === 0 && c.skipped === 0 && c.todo === 0 ? 'PASS' : 'FAIL';
  if (result.decision === expected) return expected;
  if (result.decision === 'PASS' || result.decision === 'FAIL') fail('VERIFY_DECISION_MISMATCH');
  const match = result.decision.match(/^(PASS|FAIL) \(tests=(\d+), suites=(\d+), pass=(\d+), fail=(\d+), cancelled=(\d+), skipped=(\d+), todo=(\d+); exit=(\d+)\)$/);
  if (!match) fail('INVALID_VERIFY_DECISION');
  const [, declared, tests, suites, pass, failures, cancelled, skipped, todo, exitCode] = match;
  if (![tests, suites, pass, failures, cancelled, skipped, todo, exitCode].every(value => Number.isSafeInteger(Number(value)))) fail('INVALID_VERIFY_DECISION');
  const suiteLines = typeof test.output === 'string' ? test.output.split(/\r?\n/).filter(line => /^(?:#|ℹ)[ \t]+suites\b/.test(line)) : [];
  const observedSuites = suiteLines.length === 1 && suiteLines[0].match(/^(?:#|ℹ)[ \t]+suites[ \t]+(\d+)[ \t]*$/);
  if (!observedSuites || !Number.isSafeInteger(Number(observedSuites[1]))) fail('INVALID_VERIFY_DECISION');
  if (declared !== expected || Number(tests) !== c.tests || Number(pass) !== c.pass || Number(failures) !== c.fail ||
      Number(cancelled) !== c.cancelled || Number(skipped) !== c.skipped || Number(todo) !== c.todo || Number(exitCode) !== test.exitCode || Number(suites) !== Number(observedSuites[1])) {
    fail('VERIFY_DECISION_MISMATCH');
  }
  return expected;
}

export function validateHandoff(terminal, task) {
  if (terminal.status !== 'PASS' || ![0, 1].includes(terminal.revisions) || terminal.taskId !== task.taskId) fail('HANDOFF_NOT_PASS');
  const roles = ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER', ...(terminal.revisions ? ['BUILDER', 'VERIFY', 'REVIEWER'] : [])];
  if (terminal.receipts.length !== roles.length || new Set(terminal.receipts.map(r => r.binding?.threadId)).size !== roles.length) fail('HANDOFF_ROLE_SEQUENCE');
  let candidate = terminal.receipts[0].before;
  terminal.receipts.forEach((r, i) => {
    if (r.role !== roles[i] || !r.nativeVerified || r.before !== candidate || r.revision !== (i < 4 ? 0 : 1)) fail('HANDOFF_ROLE_SEQUENCE');
    if (r.role !== 'BUILDER' && (r.after !== r.before || r.candidate !== candidate)) fail('HANDOFF_CANDIDATE_MISMATCH');
    const verifiedExisting = isMvpPilot(task) && r.role === 'BUILDER' && r.noChange === true && r.decision === 'DONE' && r.changed.length === 0 && r.after === r.before;
    if (r.role === 'BUILDER' && !verifiedExisting && (!r.changed.length || r.after === r.before || r.changed.some(p => !task.ownedFiles.includes(p)))) fail('HANDOFF_BUILDER_MISMATCH');
    if (r.role === 'LEAD' && r.decision !== 'ACCEPT') fail('HANDOFF_LEAD_MISMATCH');
    if (r.role === 'VERIFY' && r.test?.candidate !== candidate) fail('HANDOFF_TEST_MISMATCH');
    if (r.role === 'REVIEWER' && i !== roles.length - 1 && (r.decision !== 'REVISE' || !r.findings?.length)) fail('HANDOFF_REVISION_MISMATCH');
    candidate = r.after;
  });
  const verify = terminal.receipts.at(-2), review = terminal.receipts.at(-1), c = verify.test?.counters;
  if (verify.decision !== 'PASS' || verify.test.exitCode !== 0 || !c || c.tests < 1 || c.pass !== c.tests || ['fail', 'cancelled', 'skipped', 'todo'].some(k => c[k] !== 0) || review.decision !== 'PASS' || review.findings.length || terminal.candidate !== candidate) fail('HANDOFF_FINAL_MISMATCH');
  return true;
}

// Validate retained source payloads without starting a native process.
export function validateRetainedRole(r, records, task, workspace, verificationPath) {
  if (JSON.stringify(r.native?.binding) !== JSON.stringify(r.binding) || !r.native?.result || !Array.isArray(r.native.commands) || !Array.isArray(r.native.changes)) fail('NATIVE_PAYLOAD_MISMATCH');
  for (const [key,value] of Object.entries(r.native.result)) if (key!=='changed' && !(r.role==='VERIFY'&&key==='decision') && JSON.stringify(r[key]) !== JSON.stringify(value)) fail('NATIVE_RESULT_MISMATCH');
  if (!{LEAD:['ACCEPT','HELD'],BUILDER:['DONE','HELD'],VERIFY:['PASS','FAIL'],REVIEWER:['PASS','REVISE','HELD']}[r.role]?.includes(r.native.result.decision) && r.role!=='VERIFY')fail('NATIVE_RESULT_MISMATCH');
  if (r.role==='VERIFY') {
    const canonicalDecision = canonicalVerifyDecision(r.native.result,r.test);
    if (r.decision !== canonicalDecision && r.decision !== r.native.result.decision) fail('NATIVE_RESULT_MISMATCH');
  }
  if (r.role!=='VERIFY' && r.native.result.decision!==r.decision) fail('NATIVE_RESULT_MISMATCH');
  validateRoleResult(r.native.result, r.role, r.candidate);
  const completed=records.filter(row=>row.fact.method==='item/completed'&&row.fact.itemType==='commandExecution').map(row=>row.fact);
  if (completed.length!==r.native.commands.length || new Set(r.native.commands.map(c=>c.itemId)).size!==completed.length) fail('NATIVE_COMMAND_MISMATCH');
  for (const c of r.native.commands) {
    const f=completed.find(f=>f.itemId===c.itemId);
    if (!f || typeof c.command!=='string' || !c.command.trim() || typeof c.cwd!=='string' || resolve(c.cwd)!==resolve(workspace) || !Number.isSafeInteger(c.exitCode) || c.exitCode!==f.exitCode || c.status!==f.status || !/^[a-f0-9]{64}$/.test(c.outputHash||'')) fail('NATIVE_COMMAND_MISMATCH');
  }
  const changes=records.filter(row=>row.fact.method==='item/completed'&&row.fact.itemType==='fileChange').map(row=>row.fact);
  if(changes.length!==r.native.changes.length || new Set(r.native.changes.map(c=>c.itemId)).size!==changes.length)fail('NATIVE_CHANGE_MISMATCH');
  for(const c of r.native.changes)if(!changes.some(f=>f.itemId===c.itemId&&f.status==='completed')||!Array.isArray(c.paths)||!c.paths.length||c.paths.some(p=>!task.ownedFiles.includes(p)))fail('NATIVE_CHANGE_MISMATCH');
  if(JSON.stringify([...new Set(r.native.changes.flatMap(c=>c.paths))].sort())!==JSON.stringify([...r.changed].sort()))fail('NATIVE_CHANGE_MISMATCH');
  if (r.role!=='BUILDER' && (!r.native.commands.length || r.native.changes.length)) fail('NATIVE_READ_REQUIRED');
  if (r.role==='VERIFY') {
    const expected=isMvpPilot(task) ? pilotCommand : 'node --test --test-reporter=tap '+task.testFile, c=r.native.commands[0], parsed=counters(r.test?.output);
    if (r.native.commands.length!==1 || !exactTest(c.command,c.cwd,expected,workspace) || c.status!=='completed' || r.test?.itemId!==c.itemId || r.test?.command!==expected || r.test?.exitCode!==c.exitCode || r.test?.candidate!==r.candidate || !parsed || hash(r.test.output)!==r.test.outputHash || c.outputHash!==r.test.outputHash || Object.keys(r.test.counters||{}).length!==6 || Object.entries(parsed).some(([k,v])=>r.test.counters[k]!==v)) fail('TEST_OUTPUT_MISMATCH');
  }
  if (r.role==='REVIEWER') validateReviewCommands(r.native.commands, task, workspace, verificationPath, r.reviewMethod);
  return true;
}

// Failure-only collector observation. No payload values are retained.
export function nativePayloadDifferences(left,right) {
  const differences=[];
  const inspect=(path,a,b)=>{
    const x=JSON.stringify(a)??'undefined',y=JSON.stringify(b)??'undefined';
    if(x!==y)differences.push({path,leftSha256:hash(x),rightSha256:hash(y),leftBytes:Buffer.byteLength(x),rightBytes:Buffer.byteLength(y)});
  };
  for(const kind of ['commands','changes']){
    if(!Array.isArray(left?.[kind])||!Array.isArray(right?.[kind])){inspect(kind,left?.[kind],right?.[kind]);continue;}
    inspect(kind+'.length',left[kind].length,right[kind].length);
    for(let i=0;i<Math.max(left[kind].length,right[kind].length);i++)for(const key of new Set([...Object.keys(left[kind][i]||{}),...Object.keys(right[kind][i]||{})]))inspect(`${kind}[${i}].${key}`,left[kind][i]?.[key],right[kind][i]?.[key]);
  }
  inspect('result',left?.result,right?.result);inspect('binding',left?.binding,right?.binding);return differences;
}
