import { resolve } from 'node:path';
import { hash } from './contract.mjs';
import { isMvpPilot, pilotCommand, pilotReviewReads } from './mvp-pilot.mjs';
const fail = code => { throw new Error(code); };

export function exactTest(command, cwd, expected, workspace) {
  if (typeof command !== 'string' || typeof cwd !== 'string' || resolve(cwd) !== workspace) return false;
  if (command.trim() === expected) return true;
  const wrapped = command.match(/^(?:"[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]*[\\/](?:powershell|pwsh)\.exe"|(?:powershell|pwsh)(?:\.exe)?)\s+(?:-(?:NoProfile|NoLogo|NonInteractive)\s+)*-Command\s+(["'])(.*)\1$/i);
  return wrapped?.[2] === expected;
}

export function reviewReads(task, verificationPath) {
  if (isMvpPilot(task)) return pilotReviewReads(task, verificationPath);
  // Forward slashes avoid native Windows shell-display backslash escaping.
  const portablePath = verificationPath.replaceAll('\\', '/');
  return [`git diff -- ${task.ownedFiles.join(' ')}`, ...task.ownedFiles.map(p => `Get-Content -LiteralPath '${p}'`), `Get-Content -LiteralPath '${portablePath.replaceAll("'", "''")}'`];
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
  for (const [key,value] of Object.entries(r.native.result)) if (key!=='changed' && JSON.stringify(r[key]) !== JSON.stringify(value)) fail('NATIVE_RESULT_MISMATCH');
  if (!{LEAD:['ACCEPT','HELD'],BUILDER:['DONE','HELD'],VERIFY:['PASS','FAIL'],REVIEWER:['PASS','REVISE','HELD']}[r.role]?.includes(r.native.result.decision) || r.native.result.decision!==r.decision)fail('NATIVE_RESULT_MISMATCH');
  if (r.native.result.role !== r.role || r.native.result.candidate !== r.candidate || !Array.isArray(r.native.result.findings)) fail('NATIVE_RESULT_MISMATCH');
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
  if (r.role==='REVIEWER' && (!verificationPath || r.native.commands.some(c=>c.exitCode!==0||c.status!=='completed') || reviewReads(task,verificationPath).some(expected=>!r.native.commands.some(c=>exactTest(c.command,c.cwd,expected,workspace))))) fail('ACTUAL_REVIEW_READ_REQUIRED');
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
